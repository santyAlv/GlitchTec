<?php
/**
 * Glitch.TEC — credenciales del hosting.
 * Copiá este archivo como config.local.php (en esta misma carpeta) y
 * completalo con los datos de la base que creaste en el cPanel. Ese archivo
 * no va a git: lo sube tools/desplegar.sh aparte, con permisos 600.
 *
 * En HostGator la base y el usuario llevan adelante tu usuario de cPanel:
 * si tu usuario es "santi123", la base queda "santi123_glitchtec".
 */
declare(strict_types=1);

const DB_HOST     = 'localhost';
const DB_NAME     = 'usuariocpanel_glitchtec';
const DB_USER     = 'usuariocpanel_glitch';
const DB_PASS     = 'la-clave-que-elegiste-en-el-cpanel';
const CORS_ORIGIN = 'https://glitchtec.dpdns.org';
