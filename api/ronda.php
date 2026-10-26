<?php
/**
 * Glitch.TEC — registra una ronda de minijuego
 * POST { match_id, token, tipo, puntos, segundos, precision, detalle }
 *
 * Lo llama GT.api.logRound (js/api.js) cuando termina una ronda del Firewall,
 * de la caza de pop-ups, de la soldadura... Guarda la ronda en `minijuegos`
 * (para el ranking y las estadisticas) y un evento "<tipo>_round" en `eventos`
 * (para la historia de la partida).
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/* Tope de rondas por partida: una partida normal tiene unas pocas decenas.
   Sin tope, un cliente podria llenar la tabla con una partida abierta. */
const MAX_RONDAS_POR_PARTIDA = 200;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body    = read_json_body();
$matchId = (int)($body['match_id'] ?? 0);
$token   = (string)($body['token'] ?? '');

/* El tipo es el id con que el minijuego se registro en el juego. No hay lista
   fija a proposito (un minijuego nuevo no tendria que tocar el PHP): solo se
   exige la forma. Al ir como parametro preparado, no puede inyectar nada. */
$tipo = (string)($body['tipo'] ?? '');
if (!preg_match('/^[a-z][a-z0-9_]{1,29}$/', $tipo)) {
    json_error('tipo inválido');
}

/* Cada numero se normaliza a su rango antes de tocar la base (ver clamp_int). */
$puntos    = clamp_int($body['puntos'] ?? 0, -100000, 100000);
$segundos  = clamp_int($body['segundos'] ?? 0, 0, 3600);
$precision = clamp_int($body['precision'] ?? 0, 0, 100);

$detalle     = $body['detalle'] ?? [];
$detalleJson = json_encode($detalle, JSON_UNESCAPED_UNICODE);
if ($detalleJson === false || strlen($detalleJson) > 4096) {
    json_error('El detalle de la ronda es demasiado grande', 413);
}

try {
    if (!partida_abierta($matchId, $token)) {
        json_error('Partida inexistente, cerrada o token inválido', 403);
    }

    $n = db()->prepare('SELECT COUNT(*) FROM minijuegos WHERE partida_id = :pid');
    $n->execute([':pid' => $matchId]);
    if ((int)$n->fetchColumn() >= MAX_RONDAS_POR_PARTIDA) {
        json_error('Demasiadas rondas en esta partida', 429);
    }

    /* Las dos escrituras van en una transaccion: o quedan las dos o ninguna,
       asi la tabla de rondas y la historia de eventos nunca se contradicen. */
    db()->beginTransaction();

    $ins = db()->prepare(
        'INSERT INTO minijuegos (partida_id, tipo, puntos, segundos, precision_pct, detail_json, created_at)
         VALUES (:pid, :tipo, :puntos, :seg, :prec, :detail, NOW())'
    );
    $ins->execute([
        ':pid' => $matchId, ':tipo' => $tipo, ':puntos' => $puntos,
        ':seg' => $segundos, ':prec' => $precision, ':detail' => $detalleJson,
    ]);

    $ev = db()->prepare(
        'INSERT INTO eventos (partida_id, event_type, detail_json, created_at)
         VALUES (:pid, :etype, :detail, NOW())'
    );
    $ev->execute([
        ':pid'    => $matchId,
        ':etype'  => $tipo . '_round',
        ':detail' => json_encode(
            ['puntos' => $puntos, 'segundos' => $segundos, 'precision' => $precision] + (is_array($detalle) ? $detalle : []),
            JSON_UNESCAPED_UNICODE
        ),
    ]);

    db()->commit();
    json_out(['ok' => true]);
} catch (Throwable $e) {
    if (db()->inTransaction()) {
        db()->rollBack();
    }
    json_error('No se pudo registrar la ronda: ' . $e->getMessage(), 500);
}
