<?php
/**
 * Glitch.TEC — cierra una partida con el resumen
 * POST { match_id, won, score, level_reached, elapsed_sec, ... }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = read_json_body();
$matchId = (int)($body['match_id'] ?? 0);
if ($matchId <= 0) {
    json_error('match_id inválido');
}

/* Normalizo cada campo a su tipo antes de tocar la base: el (int) de los
   numeros y el !empty() del booleano me garantizan que a MySQL le llega lo que
   la columna espera, aunque el cliente mande cualquier cosa (o nada). */
$won       = !empty($body['won']) ? 1 : 0;
$score     = (int)($body['score'] ?? 0);
$base      = (int)($body['base_score'] ?? 0);
$level     = (int)($body['level_reached'] ?? 0);
$elapsed   = (int)($body['elapsed_sec'] ?? 0);
$integrity = (int)($body['integrity'] ?? 0);
$mistakes  = (int)($body['mistakes'] ?? 0);
$hints     = (int)($body['hints'] ?? 0);
$popups    = (int)($body['popups_closed'] ?? 0);
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
            finished_at    = NOW()
         WHERE id = :id'
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
        ':id'        => $matchId,
    ]);

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
        ], JSON_UNESCAPED_UNICODE),
    ]);

    json_out(['ok' => true, 'id' => $matchId, 'status' => $status]);
} catch (Throwable $e) {
    json_error('No se pudo cerrar la partida: ' . $e->getMessage(), 500);
}
