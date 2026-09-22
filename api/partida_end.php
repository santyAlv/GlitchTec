<?php
/**
 * Glitch.TEC — cierra una partida con el resumen
 * POST { match_id, token, won, score, level_reached, elapsed_sec, best_streak, ... }
 *
 * Solo el ranking lee las partidas ganadas (status = 'won'); las perdidas se
 * cierran igual porque sirven para las estadisticas.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = read_json_body();
$matchId = (int)($body['match_id'] ?? 0);
$token   = (string)($body['token'] ?? '');
/* El token tiene que tener exactamente la forma que genera partida_start.php
   (32 hex). Si no, ni consulto la base. */
if ($matchId <= 0 || !preg_match('/^[a-f0-9]{32}$/', $token)) {
    json_error('match_id o token inválido');
}

/* Normalizo cada campo a su tipo Y a su rango antes de tocar la base: con
   clamp_int (config.php) a MySQL le llega lo que la columna espera aunque el
   cliente mande cualquier cosa (o nada). Los topes son generosos, solo estan
   para que un numero absurdo no rompa la columna ni el ranking. */
$won       = !empty($body['won']) ? 1 : 0;
$score     = clamp_int($body['score'] ?? 0, 0, 1000000);
$base      = clamp_int($body['base_score'] ?? 0, 0, 1000000);
$level     = clamp_int($body['level_reached'] ?? 0, 0, 10);
$elapsed   = clamp_int($body['elapsed_sec'] ?? 0, 0, 86400);
$integrity = clamp_int($body['integrity'] ?? 0, 0, 100);
$mistakes  = clamp_int($body['mistakes'] ?? 0, 0, 65535);
$hints     = clamp_int($body['hints'] ?? 0, 0, 65535);
$popups    = clamp_int($body['popups_closed'] ?? 0, 0, 65535);
$streak    = clamp_int($body['best_streak'] ?? 0, 0, 65535);
$status    = $won ? 'won' : 'lost';

$mode = (string)($body['mode'] ?? 'virus');
$mode = ($mode === 'tecnico') ? 'tecnico' : 'virus';

try {
    $stmt = db()->prepare(
        'UPDATE partidas SET
            modo           = :modo,
            status         = :status,
            won            = :won,
            score          = :score,
            base_score     = :base,
            level_reached  = :level,
            elapsed_sec    = :elapsed,
            integrity_end  = :integrity,
            mistakes       = :mistakes,
            hints_used     = :hints,
            popups_closed  = :popups,
            best_streak    = :streak,
            finished_at    = NOW()
         WHERE id = :id AND token = :token AND status = \'running\''
    );
    $stmt->execute([
        ':modo'      => $mode,
        ':status'    => $status,
        ':won'       => $won,
        ':score'     => $score,
        ':base'      => $base,
        ':level'     => $level,
        ':elapsed'   => $elapsed,
        ':integrity' => $integrity,
        ':mistakes'  => $mistakes,
        ':hints'     => $hints,
        ':popups'    => $popups,
        ':streak'    => $streak,
        ':id'        => $matchId,
        ':token'     => $token,
    ]);

    /* El WHERE pide las tres cosas juntas: que la partida exista, que el
       token sea el suyo y que siga abierta. Si rowCount() da 0 fallo alguna,
       y no digo cual a proposito (no le doy pistas al que esta probando).
       El "status = running" ademas impide cerrar dos veces la misma partida
       para reescribir el puntaje despues de ganar. */
    if ($stmt->rowCount() !== 1) {
        json_error('La partida no existe, ya fue cerrada o el token no coincide', 409);
    }

    /* Ademas de cerrar la fila de la partida, dejo asentado un evento de
       cierre. Es redundante a proposito: la tabla "partidas" guarda el ESTADO
       final (una fila por partida, que es lo que consulta el ranking) y la
       tabla "eventos" guarda la HISTORIA (muchas filas por partida), que sirve
       para analizar despues donde se traba la gente. Es la misma idea que
       tener un log al lado de una tabla de resultados. */
    $ev = db()->prepare(
        'INSERT INTO eventos (partida_id, event_type, detail_json, created_at)
         VALUES (:pid, :etype, :detail, NOW())'
    );
    $ev->execute([
        ':pid'    => $matchId,
        ':etype'  => $won ? 'match_won' : 'match_lost',
        ':detail' => json_encode([
            'mode'  => $mode,
            'score' => $score,
            'level' => $level,
            'time'  => $elapsed,
            'streak' => $streak,
        ], JSON_UNESCAPED_UNICODE),
    ]);

    json_out(['ok' => true, 'id' => $matchId, 'status' => $status]);
} catch (Throwable $e) {
    json_error('No se pudo cerrar la partida: ' . $e->getMessage(), 500);
}
