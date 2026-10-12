<?php
/**
 * Glitch.TEC — ¿quién soy?
 * GET  →  { ok, user }      (user = null si es un invitado)
 *
 * Lo llama el juego al cargar la página para saber si el navegador ya tiene
 * una sesión abierta de una visita anterior.
 */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

try {
    $user = usuario_actual();
    json_out(['ok' => true, 'user' => $user ? usuario_publico($user) : null]);
} catch (Throwable $e) {
    json_error('No se pudo consultar la sesión.', 500);
}
