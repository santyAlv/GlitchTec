<?php
/**
 * Glitch.TEC — inicia sesión
 * POST { login, password }  →  { ok, user }
 * "login" puede ser el nombre de usuario o el correo.
 */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body     = read_json_body();
$login    = trim((string)($body['login'] ?? ''));
$password = (string)($body['password'] ?? '');

/* UN SOLO mensaje para "no existe el usuario" y para "la clave está mal".
   Si contestara distinto en cada caso, el formulario serviría para averiguar
   qué correos tienen cuenta: se prueba una lista y se anota cuáles responden
   "contraseña incorrecta". */
const LOGIN_ERROR = 'Usuario o contraseña incorrectos.';

if ($login === '' || $password === '') {
    json_error('Completá el usuario y la contraseña.', 422);
}
/* Una clave más larga que el máximo no puede ser válida: la rechazo antes de
   gastar tiempo de CPU calculando su hash. */
if (strlen($login) > 120 || strlen($password) > PASS_MAX) {
    json_error(LOGIN_ERROR, 401);
}

try {
    /* :u y :e llevan el mismo valor pero son dos marcadores distintos: con
       sentencias preparadas reales no se puede repetir un mismo nombre. */
    $stmt = db()->prepare(
        'SELECT id, username, email, password_hash, fecha_registro, intentos_fallidos,
                (bloqueado_hasta IS NOT NULL AND bloqueado_hasta > NOW()) AS bloqueado
         FROM usuarios
         WHERE username = :u OR email = :e
         LIMIT 1'
    );
    $stmt->execute([':u' => $login, ':e' => strtolower($login)]);
    $user = $stmt->fetch();

    if (!$user) {
        /* El usuario no existe, pero calculo un hash igual. Si respondiera
           al toque, el TIEMPO de la respuesta delataría lo mismo que quise
           tapar con el mensaje único: rápido = no existe, lento = existe. */
        hash_password($password);
        json_error(LOGIN_ERROR, 401);
    }

    $uid = (int)$user['id'];

    if ((int)$user['bloqueado'] === 1) {
        json_error('Demasiados intentos fallidos. Probá de nuevo en unos minutos.', 429);
    }

    /* password_verify lee del propio hash el algoritmo y la sal, vuelve a
       hashear lo que escribió el jugador y compara. Nunca comparo contraseñas
       entre sí: del otro lado de la comparación no hay ninguna guardada. */
    if (!password_verify($password, (string)$user['password_hash'])) {
        $fallos = (int)$user['intentos_fallidos'] + 1;

        if ($fallos >= LOGIN_MAX_INTENTOS) {
            /* El intervalo va concatenado porque es una constante mía, no un
               dato del usuario: MySQL no acepta un marcador en ese lugar. */
            $upd = db()->prepare(
                'UPDATE usuarios
                 SET intentos_fallidos = 0,
                     bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ' . LOGIN_BLOQUEO_MIN . ' MINUTE)
                 WHERE id = :id'
            );
            $upd->execute([':id' => $uid]);
        } else {
            $upd = db()->prepare('UPDATE usuarios SET intentos_fallidos = :n WHERE id = :id');
            $upd->execute([':n' => $fallos, ':id' => $uid]);
        }
        json_error(LOGIN_ERROR, 401);
    }

    /* Si PHP subió el costo o cambió de algoritmo desde que se creó la
       cuenta, aprovecho que acá tengo la clave en claro (es el único momento)
       para guardar el hash con la configuración nueva. */
    if (password_needs_rehash((string)$user['password_hash'], PASSWORD_DEFAULT)) {
        $upd = db()->prepare('UPDATE usuarios SET password_hash = :h WHERE id = :id');
        $upd->execute([':h' => hash_password($password), ':id' => $uid]);
    }

    $upd = db()->prepare(
        'UPDATE usuarios
         SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW()
         WHERE id = :id'
    );
    $upd->execute([':id' => $uid]);

    sesion_abrir($user);
    json_out(['ok' => true, 'user' => usuario_publico($user)]);
} catch (Throwable $e) {
    json_error('No se pudo iniciar sesión.', 500);
}
