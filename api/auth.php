<?php
/**
 * Glitch.TEC — cuentas de usuario y sesión
 *
 * Esto NO es un endpoint: es la biblioteca que comparten registro.php,
 * login.php, logout.php, sesion.php, mis_partidas.php y partida_start.php.
 * Acá viven las tres cosas que no se pueden escribir dos veces distinto:
 *   - las reglas de validación de usuario, correo y contraseña
 *   - cómo se guarda y cómo se comprueba una contraseña
 *   - cómo se abre, se lee y se cierra la sesión
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

const SESSION_NAME       = 'glitchtec_sid';
const SESSION_TTL        = 604800;   // 7 dias, en segundos
const LOGIN_MAX_INTENTOS = 5;        // fallos seguidos antes de bloquear la cuenta
const LOGIN_BLOQUEO_MIN  = 5;        // minutos que dura el bloqueo
const PASS_MIN           = 8;
const PASS_MAX           = 72;       // bcrypt ignora todo lo que pase de 72 bytes

/* ============================================================
   Validación
   Cada función devuelve null si el dato está bien, o el mensaje de
   error para mostrarle al jugador. Son las MISMAS reglas que aplica
   js/auth.js antes de mandar el formulario: el navegador valida para
   avisar rápido, el servidor valida porque es el único que manda.
   Lo del navegador se saltea con un curl; esto no.
   ============================================================ */

function validar_username(string $username): ?string
{
    /* Lista blanca: digo qué caracteres SÍ acepto en vez de intentar adivinar
       cuáles son peligrosos. Con letras, números, punto y guiones no hay forma
       de armar HTML ni SQL, y el nombre entra limpio en el ranking. */
    if (!preg_match('/^[A-Za-z0-9_.\-]{3,24}$/', $username)) {
        return 'El usuario debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.';
    }
    return null;
}

function validar_email(string $email): ?string
{
    if (strlen($email) > 120 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return 'Ingresá un correo electrónico válido.';
    }
    return null;
}

function validar_password(string $password, string $username = ''): ?string
{
    /* strlen y no mb_strlen: el tope de bcrypt es en BYTES. Una clave con
       acentos o emojis ocupa más bytes que letras, y lo que pase de 72 se
       ignoraría en silencio: dos claves distintas darían el mismo hash. */
    if (strlen($password) < PASS_MIN) {
        return 'La contraseña debe tener al menos ' . PASS_MIN . ' caracteres.';
    }
    if (strlen($password) > PASS_MAX) {
        return 'La contraseña no puede superar los ' . PASS_MAX . ' caracteres.';
    }
    if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/[0-9]/', $password)) {
        return 'La contraseña debe combinar letras y números.';
    }
    if ($username !== '' && strcasecmp($password, $username) === 0) {
        return 'La contraseña no puede ser igual al nombre de usuario.';
    }
    return null;
}

/* ============================================================
   Contraseñas
   ============================================================ */

/**
 * Convierte la contraseña en el hash que se guarda en usuarios.password_hash.
 *
 * password_hash() hace tres cosas que a mano se hacen mal:
 *  - usa bcrypt, un algoritmo LENTO a propósito. md5 o sha1 calculan millones
 *    de hashes por segundo, y eso es justo lo que necesita el que quiere
 *    probar un diccionario entero contra una base robada.
 *  - le agrega una "sal" al azar distinta para cada usuario: dos personas con
 *    la misma clave quedan con hashes distintos, y no sirven las tablas de
 *    hashes ya calculados.
 *  - guarda el algoritmo, el costo y la sal adentro del mismo string, así
 *    password_verify() sabe cómo comprobarlo sin columnas extra.
 */
function hash_password(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

/* ============================================================
   Sesión
   ============================================================ */

/**
 * Arranca la sesión de PHP con la cookie configurada como corresponde.
 *
 * La sesión funciona así: PHP guarda los datos en el servidor y le da al
 * navegador solamente un identificador al azar adentro de una cookie. El
 * navegador nunca ve ni puede tocar lo que hay guardado; sólo presenta su
 * identificador en cada pedido.
 *
 * Los cuatro atributos de la cookie:
 *  - httponly: JavaScript no la puede leer. Si alguna vez se cuela un script
 *    ajeno en la página, no se puede llevar la sesión.
 *  - samesite Strict: el navegador no la manda en pedidos que nacen en otro
 *    sitio. Eso corta el CSRF (que otra página haga pedidos con mi sesión).
 *  - secure: sólo viaja por HTTPS. En el XAMPP local no hay HTTPS, así que se
 *    activa sola cuando el sitio se sirve cifrado.
 *  - path: la cookie vale sólo para la carpeta del juego, no para todo lo
 *    que haya en el mismo localhost.
 */
function sesion_iniciar(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';

    /* Carpeta del proyecto, sacada de la URL del script: de
       "/glitch-tec/api/login.php" me quedo con "/glitch-tec/". Cambio las
       barras porque en Windows dirname() devuelve "\" para la raíz. */
    $script = (string)($_SERVER['SCRIPT_NAME'] ?? '/api/x.php');
    $base   = rtrim(str_replace('\\', '/', dirname(dirname($script))), '/') . '/';

    /* use_strict_mode: PHP rechaza un identificador de sesión que no haya
       generado él. Sin esto, un atacante puede fabricar un id, hacer que la
       víctima lo use y después entrar con ese mismo id (fijación de sesión). */
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)SESSION_TTL);

    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => SESSION_TTL,
        'path'     => $base,
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

/**
 * Deja la sesión abierta a nombre de un usuario (después de un login o de un
 * registro correctos).
 *
 * session_regenerate_id(true) cambia el identificador y borra el viejo: el id
 * que el navegador tenía ANTES de autenticarse deja de servir. Es la otra
 * mitad de la defensa contra la fijación de sesión.
 */
function sesion_abrir(array $user): void
{
    sesion_iniciar();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$user['id'];
}

/** Cierra la sesión: borra los datos del servidor y vence la cookie. */
function sesion_cerrar(): void
{
    sesion_iniciar();
    $_SESSION = [];

    $p = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 42000,
        'path'     => $p['path'],
        'domain'   => $p['domain'],
        'secure'   => $p['secure'],
        'httponly' => $p['httponly'],
        'samesite' => $p['samesite'] !== '' ? $p['samesite'] : 'Strict',
    ]);
    session_destroy();
}

/**
 * Usuario de la sesión actual, o null si el pedido es de un invitado.
 *
 * Si el navegador no manda la cookie, ni arranco la sesión: así los que
 * juegan sin cuenta no reciben una cookie ni ocupan lugar en el servidor.
 *
 * El id sale SIEMPRE de la sesión, nunca del cuerpo del pedido: si aceptara
 * un "user_id" que manda el cliente, cualquiera podría jugar a nombre de otro.
 */
function usuario_actual(): ?array
{
    if (empty($_COOKIE[SESSION_NAME])) {
        return null;
    }
    sesion_iniciar();

    $uid = (int)($_SESSION['uid'] ?? 0);
    if ($uid <= 0) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, username, email, fecha_registro FROM usuarios WHERE id = :id'
    );
    $stmt->execute([':id' => $uid]);
    $row = $stmt->fetch();

    // La cuenta se borró mientras la sesión seguía abierta: la cierro
    if (!$row) {
        sesion_cerrar();
        return null;
    }
    return $row;
}

/**
 * Lo que se puede devolver al navegador sobre un usuario. El hash de la
 * contraseña y los contadores del bloqueo no salen NUNCA de la base.
 */
function usuario_publico(array $row): array
{
    return [
        'id'             => (int)$row['id'],
        'username'       => (string)$row['username'],
        'email'          => (string)$row['email'],
        'fecha_registro' => (string)($row['fecha_registro'] ?? ''),
    ];
}
