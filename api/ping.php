<?php
/**
 * Glitch.TEC — healthcheck del backend
 * GET api/ping.php  →  { ok: true, db: true/false, cuentas: true/false }
 *
 * "cuentas" avisa si la base ya tiene la estructura de usuarios (la tabla
 * usuarios y la columna partidas.user_id). Si la base se creó con un esquema
 * anterior hay que correr la migración del final de sql/schema.sql.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$dbOk = false;
try {
    db()->query('SELECT 1');
    $dbOk = true;
} catch (Throwable $e) {
    $dbOk = false;
}

/* LIMIT 0 no trae ninguna fila: sólo comprueba que la tabla y la columna
   existan. Si falta alguna, la consulta falla y cae en el catch. */
$cuentasOk = false;
if ($dbOk) {
    try {
        db()->query('SELECT id FROM usuarios LIMIT 0');
        db()->query('SELECT user_id FROM partidas LIMIT 0');
        $cuentasOk = true;
    } catch (Throwable $e) {
        $cuentasOk = false;
    }
}

json_out([
    'ok'      => true,
    'db'      => $dbOk,
    'cuentas' => $cuentasOk,
    'service' => 'Glitch.TEC API',
    'version' => '0.5',
    'time'    => date('c'),
]);
