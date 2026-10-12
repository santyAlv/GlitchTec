<?php
/**
 * Glitch.TEC — crea una cuenta
 * POST { username, email, password }  →  { ok, user }
 * Si algo no valida:  { ok: false, error, errors: { campo: mensaje } }
 */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

$body     = read_json_body();
$username = trim((string)($body['username'] ?? ''));
/* El correo se guarda en minúscula: "Ana@Mail.com" y "ana@mail.com" son la
   misma casilla y no tienen que poder registrarse como dos cuentas. */
$email    = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');

/* Junto TODOS los errores antes de responder, en vez de cortar en el primero:
   así el formulario puede marcar los tres campos de una y el jugador no tiene
   que mandar tres veces para enterarse de tres problemas. */
$errors = [];
$e = validar_username($username);
if ($e !== null) $errors['username'] = $e;
$e = validar_email($email);
if ($e !== null) $errors['email'] = $e;
$e = validar_password($password, $username);
if ($e !== null) $errors['password'] = $e;

if ($errors) {
    json_out(['ok' => false, 'error' => 'Revisá los datos del formulario.', 'errors' => $errors], 422);
}

try {
    $stmt = db()->prepare(
        'INSERT INTO usuarios (username, email, password_hash, fecha_registro)
         VALUES (:username, :email, :hash, NOW())'
    );
    $stmt->execute([
        ':username' => $username,
        ':email'    => $email,
        ':hash'     => hash_password($password),
    ]);
    $id = (int) db()->lastInsertId();

    // Cuenta creada: queda con la sesión iniciada, sin pasar por el login
    sesion_abrir(['id' => $id]);

    /* Releo la fila en vez de armar la respuesta a mano: la fecha la puso
       MySQL con su reloj, y el de PHP puede estar en otra zona horaria. */
    $sel = db()->prepare('SELECT id, username, email, fecha_registro FROM usuarios WHERE id = :id');
    $sel->execute([':id' => $id]);

    json_out(['ok' => true, 'user' => usuario_publico($sel->fetch())], 201);
} catch (PDOException $e) {
    /* 1062 es el código de MySQL para "entrada duplicada": saltó alguno de
       los dos UNIQUE de la tabla. No consulto antes si el usuario existe: lo
       intento y dejo que la base decida, porque entre un SELECT previo y el
       INSERT otro registro podría colarse. El mensaje del error trae el nombre
       del índice que falló, y de ahí saco a qué campo culpar. */
    if ((int)($e->errorInfo[1] ?? 0) === 1062) {
        $campo = (strpos($e->getMessage(), 'uq_email') !== false) ? 'email' : 'username';
        $msg   = ($campo === 'email')
            ? 'Ya hay una cuenta registrada con ese correo.'
            : 'Ese nombre de usuario ya está en uso.';
        json_out(['ok' => false, 'error' => $msg, 'errors' => [$campo => $msg]], 409);
    }
    json_error('No se pudo crear la cuenta.', 500);
} catch (Throwable $e) {
    json_error('No se pudo crear la cuenta.', 500);
}
