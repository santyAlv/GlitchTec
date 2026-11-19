<?php
/**
 * Glitch.TEC — filtro de nombres y correos ofensivos
 *
 * es_ofensivo() dice si un texto (usuario, correo o nombre de invitado del
 * ranking) trae un insulto, algo racista o agresivo. La lista vive en
 * filtro_palabras.json y es la misma que usa js/filtro.js en el navegador.
 *
 * Antes de buscar se normaliza el texto para que no se pueda esquivar con
 * mayúsculas, acentos, leetspeak (n1gg3r), separadores (n.i.g.g.e.r) ni
 * letras repetidas (niiigger).
 */
declare(strict_types=1);

function filtro_lista(): array
{
    static $lista = null;
    if ($lista === null) {
        $lista = json_decode((string)file_get_contents(__DIR__ . '/filtro_palabras.json'), true) ?: [];
    }
    return $lista;
}

/** Minúsculas, sin acentos, leetspeak a letras y sólo a-z. */
function filtro_normalizar(string $texto): string
{
    $t = mb_strtolower($texto, 'UTF-8');
    $t = strtr($t, [
        'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a', 'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
        'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i', 'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
        'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u', 'ñ' => 'n', 'ç' => 'c',
        '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '8' => 'b', '9' => 'g',
        '$' => 's', '!' => 'i', '|' => 'i', '€' => 'e',
    ]);
    return (string)preg_replace('/[^a-z]/', '', $t);
}

function es_ofensivo(string $texto): bool
{
    $lista = filtro_lista();

    foreach ($lista['numeros'] ?? [] as $n) {
        if (strpos($texto, $n) !== false) return true;
    }

    /* La @ del correo no se pega: "input@tal.com" no tiene que leerse "inputa..." */
    $t = '';
    foreach (explode('@', $texto) as $parte) {
        $t .= filtro_normalizar($parte) . '-';
    }
    foreach ($lista['permitidas'] ?? [] as $p) {
        $t = str_replace($p, '-', $t);
    }
    foreach ($lista['bloqueadas'] ?? [] as $b) {
        /* "puta" -> /p+u+t+a+/: también agarra "puuuta" */
        if (preg_match('/' . implode('+', str_split($b)) . '+/', $t)) return true;
    }
    return false;
}
