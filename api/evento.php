<?php
/**
 * Glitch.TEC — registra un evento de gameplay
 * POST { match_id, event_type, detail }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = read_json_body();
$matchId = (int)($body['match_id'] ?? 0);
$token   = (string)($body['token'] ?? '');
$type    = trim((string)($body['event_type'] ?? ''));
$detail  = $body['detail'] ?? [];

if ($matchId <= 0 || $type === '') {
    json_error('match_id y event_type son obligatorios');
}

/* El detalle es libre (cada evento tiene su forma), pero con tope: sin el, un
   cliente podria llenar la base con JSON gigantes. 4 KB sobra para cualquier
   evento del juego. */
$detailJson = json_encode($detail, JSON_UNESCAPED_UNICODE);
if ($detailJson === false || strlen($detailJson) > 4096) {
    json_error('El detalle del evento es demasiado grande', 413);
}

/* SANEAR LA ENTRADA. Nunca confio en lo que manda el cliente, aunque el
   cliente sea mi propio JavaScript: cualquiera puede mandarle un POST a este
   endpoint con curl. Le saco todo lo que no sea letra, numero, guion o guion
   bajo, y lo recorto a 40 caracteres, que es lo que mide la columna. Asi lo
   que entra a la base siempre tiene la forma que espero. */
$type = mb_substr(preg_replace('/[^a-z0-9_\-]/i', '', $type) ?? 'event', 0, 40);

try {
    /* Sin el token de la partida (y con la partida abierta) no se escribe nada:
       los id son correlativos, cualquiera podria probar match_id = 1, 2, 3... */
    if (!partida_abierta($matchId, $token)) {
        json_error('Partida inexistente, cerrada o token inválido', 403);
    }

    /* SENTENCIA PREPARADA — la forma correcta de hablar con la base.
       Los :pid, :etype y :detail son MARCADORES, no texto: primero mando la
       consulta con los huecos (prepare) y despues los valores por separado
       (execute). El motor nunca mezcla datos con instrucciones, asi que aunque
       alguien mandara  "; DROP TABLE partidas; --"  como valor, se guardaria
       como un string cualquiera. Concatenar los valores dentro del SQL es
       exactamente lo que hace posible la inyeccion SQL.
       NOW() lo calcula MySQL, no PHP: asi la hora es la del servidor y no
       depende del reloj (ni de la zona horaria) de la maquina del jugador. */
    $stmt = db()->prepare(
        'INSERT INTO eventos (partida_id, event_type, detail_json, created_at)
         VALUES (:pid, :etype, :detail, NOW())'
    );
    $stmt->execute([
        ':pid'    => $matchId,
        ':etype'  => $type,
        ':detail' => $detailJson,
    ]);
    json_out(['ok' => true]);
} catch (Throwable $e) {
    json_error('No se pudo registrar el evento: ' . $e->getMessage(), 500);
}
