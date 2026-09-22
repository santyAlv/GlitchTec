<?php
/**
 * Glitch.TEC — inicia una partida
 * POST { player_name, mode, started_at }  →  { ok, id, token }
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body = read_json_body();
/* El ?? es el operador "null coalescente": si la clave no existe o es null,
   uso el valor de la derecha. Me ahorra el isset() y evita el warning de
   indice indefinido. Despues el (string) fuerza el tipo y mb_substr recorta a
   los 40 caracteres de la columna (mb_ = version que entiende acentos y no
   parte un caracter multibyte por la mitad). */
$name = trim((string)($body['player_name'] ?? 'estudiante'));
$name = mb_substr($name !== '' ? $name : 'estudiante', 0, 40);

// Modo de juego: 'virus' (PC corrompida) o 'tecnico' (servicio tecnico)
$mode = (string)($body['mode'] ?? 'virus');
$mode = ($mode === 'tecnico') ? 'tecnico' : 'virus';

/* Token de la partida: 32 caracteres hex al azar. random_bytes es el
   generador criptografico de PHP (rand() o uniqid() se pueden adivinar).
   Solo lo conoce el navegador que abrio la partida y partida_end.php lo
   exige para cerrarla. Sin esto cualquiera podria mandar un POST con
   match_id = 1, 2, 3... y pisar el puntaje de partidas ajenas, porque los
   id son correlativos. */
$token = bin2hex(random_bytes(16));

try {
    $stmt = db()->prepare(
        'INSERT INTO partidas (player_name, modo, token, started_at, status)
         VALUES (:name, :modo, :token, NOW(), \'running\')'
    );
    $stmt->execute([':name' => $name, ':modo' => $mode, ':token' => $token]);
    /* lastInsertId() devuelve el id AUTO_INCREMENT que acaba de generar el
       INSERT. Es por conexion, no global, asi que no hay riesgo de que me
       devuelva el id de la partida de otro jugador que entro al mismo tiempo.
       Este id vuelve al navegador y es el que despues usan evento.php y
       partida_end.php para saber a que fila pegarle. */
    $id = (int) db()->lastInsertId();

    // Evento de arranque
    $ev = db()->prepare(
        'INSERT INTO eventos (partida_id, event_type, detail_json, created_at)
         VALUES (:pid, \'match_start\', :detail, NOW())'
    );
    $ev->execute([
        ':pid'    => $id,
        ':detail' => json_encode(['player' => $name, 'mode' => $mode], JSON_UNESCAPED_UNICODE),
    ]);

    json_out(['ok' => true, 'id' => $id, 'token' => $token]);
} catch (Throwable $e) {
    json_error('No se pudo crear la partida: ' . $e->getMessage(), 500);
}
