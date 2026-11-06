<?php
/**
 * Glitch.TEC — conexión a MySQL / MariaDB
 * Ajustá usuario, clave y nombre de BD según tu XAMPP/WAMP.
 * En el hosting van en config.local.php, que no está en git
 * (copiá config.local.example.php).
 */
declare(strict_types=1);

if (is_file(__DIR__ . '/config.local.php')) {
    require __DIR__ . '/config.local.php';
}

/* define() y no const: const no se puede declarar adentro de un if, y acá
   cada valor se define sólo si config.local.php no lo definió antes. */
defined('DB_DRIVER')   || define('DB_DRIVER', 'mysql');     // 'pgsql' para Supabase
defined('DB_HOST')     || define('DB_HOST', '127.0.0.1');
defined('DB_PORT')     || define('DB_PORT', DB_DRIVER === 'pgsql' ? 5432 : 3306);
defined('DB_SSLMODE')  || define('DB_SSLMODE', 'require');   // Postgres: Supabase exige SSL
defined('DB_NAME')     || define('DB_NAME', 'glitchtec');
defined('DB_USER')     || define('DB_USER', 'root');
defined('DB_PASS')     || define('DB_PASS', '');          // XAMPP por defecto: vacío
defined('DB_CHARSET')  || define('DB_CHARSET', 'utf8mb4');
defined('CORS_ORIGIN') || define('CORS_ORIGIN', '*');    // en producción, el dominio propio

/**
 * Devuelve LA conexion a la base (patron singleton hecho a mano).
 *
 * La variable estatica es la clave: en PHP, una $variable marcada como static
 * dentro de una funcion NO se borra cuando la funcion termina, sobrevive hasta
 * el final del request. Entonces la primera llamada a db() abre la conexion y
 * todas las siguientes devuelven esa misma. Sin esto, cada consulta abriria
 * una conexion TCP nueva a MySQL: lentisimo y para nada necesario.
 *
 * Las tres opciones del final valen la pena entenderlas:
 *  - ERRMODE_EXCEPTION: si una consulta falla, PDO TIRA una excepcion en vez de
 *    devolver false en silencio. Asi el try/catch de cada endpoint se entera de
 *    verdad y puedo responder un JSON de error en lugar de una pagina en blanco.
 *  - FETCH_ASSOC: los resultados vienen como array asociativo ($fila['score'])
 *    y no duplicados tambien por indice numerico, que es el default y solo
 *    gasta memoria.
 *  - EMULATE_PREPARES => false: obliga a usar sentencias preparadas REALES del
 *    motor. Con la emulacion, PHP arma el SQL como string antes de mandarlo;
 *    con esto apagado, la consulta y los datos viajan por separado y la
 *    inyeccion SQL se vuelve imposible por diseno, no por escaparse bien.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    // DSN = "Data Source Name": la cadena que describe a que base me conecto
    /* Postgres no lleva charset en el DSN (usa UTF-8) y Supabase exige SSL */
    $dsn = DB_DRIVER === 'pgsql'
        ? 'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';sslmode=' . DB_SSLMODE
        : 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    return $pdo;
}

/**
 * Responde JSON y CORTA la ejecucion (ese exit del final no es opcional: si
 * siguiera, PHP podria mandar mas texto despues del JSON y el fetch del
 * navegador no lo podria parsear).
 *
 * Los headers Access-Control-Allow-* son CORS: el permiso que el navegador le
 * pide al servidor para dejar que una pagina de un origen consulte a otro.
 * Los necesito porque el juego se puede abrir desde file:// o desde otro
 * puerto. El '*' acepta cualquier origen: sirve para un TP local; en el
 * hosting, config.local.php lo limita al dominio propio (CORS_ORIGIN).
 */
function json_out(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . CORS_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $code = 400): void
{
    json_out(['ok' => false, 'error' => $message], $code);
}

/**
 * Convierte a entero y lo encierra entre $min y $max.
 * El (int) solo no alcanza: las columnas son TINYINT / INT UNSIGNED y MySQL
 * en modo estricto rechaza un -5 o un 300 en integrity_end con un error, y la
 * partida no se guardaria. Prefiero recortar el valor aca y seguir.
 */
function clamp_int($value, int $min, int $max): int
{
    return max($min, min($max, (int)$value));
}

/**
 * ¿La partida existe, es de este token y sigue abierta?
 * Lo exigen evento.php y ronda.php: sin el token de partida_start.php cualquiera
 * podria escribir eventos o rondas en partidas ajenas (los id son correlativos).
 */
function partida_abierta(int $matchId, string $token): bool
{
    if ($matchId <= 0 || !preg_match('/^[a-f0-9]{32}$/', $token)) {
        return false;
    }
    $stmt = db()->prepare(
        'SELECT 1 FROM partidas WHERE id = :id AND token = :t AND status = \'running\''
    );
    $stmt->execute([':id' => $matchId, ':t' => $token]);
    return (bool)$stmt->fetchColumn();
}

/**
 * Lee el cuerpo de un POST en JSON.
 * php://input es el flujo crudo del pedido. Hace falta porque $_POST SOLO se
 * llena cuando el cuerpo viene como formulario (application/x-www-form-
 * urlencoded o multipart). Como desde el JS mando JSON, $_POST llega vacio y
 * tengo que leer y decodificar a mano.
 * El "is_array" del final es defensivo: si llega basura, json_decode devuelve
 * null y prefiero seguir con un array vacio antes que reventar.
 */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* PREFLIGHT de CORS: antes de un POST con Content-Type: application/json, el
   navegador manda solo un OPTIONS para preguntar "¿me dejas?". Si no le
   contesto, el POST real ni siquiera sale. Respondo que si y termino aca. */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    json_out(['ok' => true]);
}
