<?php
/**
 * Glitch.TEC — cierra la sesión
 * POST  →  { ok }
 */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

/* POST y no GET: un GET lo dispara cualquier <img src="api/logout.php"> o un
   enlace precargado por el navegador. Lo que cambia estado va por POST. */
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Método no permitido', 405);
}

// Sin cookie no hay sesión que cerrar: respondo ok sin crear una para destruirla
if (!empty($_COOKIE[SESSION_NAME])) {
    sesion_cerrar();
}

json_out(['ok' => true]);
