<?php
/**
 * Glitch.TEC — conexión a MySQL / MariaDB
 * Ajustá usuario, clave y nombre de BD según tu XAMPP/WAMP.
 */
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'glitchtec';
const DB_USER = 'root';
const DB_PASS = '';          // XAMPP por defecto: vacío
const DB_CHARSET = 'utf8mb4';

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
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
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
 * puerto. El '*' acepta cualquier origen: para un TP local esta bien, pero si
 * esto saliera a produccion habria que limitarlo al dominio propio.
 */
function json_out(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
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
