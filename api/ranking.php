<?php
/**
 * Glitch.TEC — ranking de mejores puntajes (solo partidas ganadas)
 * GET api/ranking.php?limit=10[&modo=virus|tecnico]
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/* El (int) no es cosmetico: es lo que convierte cualquier cosa que venga por
   la URL en un numero. Y aunque despues lo paso como parametro preparado,
   igual lo encierro entre 1 y 50: sin tope, un ?limit=999999 obligaria a la
   base a devolver la tabla entera. Validar RANGO ademas de tipo. */
$limit = (int)($_GET['limit'] ?? 10);
if ($limit < 1)  $limit = 10;
if ($limit > 50) $limit = 50;

// Filtro opcional por modo de juego: los dos modos puntuan distinto
$modo = isset($_GET['modo']) ? (string)$_GET['modo'] : '';
$filtraModo = ($modo === 'virus' || $modo === 'tecnico');

/* Armo la consulta concatenando el filtro opcional de modo. Ojo: lo unico
   que concateno es un pedazo FIJO de SQL escrito por mi (' AND modo = :modo'),
   nunca el valor que mando el usuario —ese sigue viajando como parametro. Esa
   es la linea que separa una consulta dinamica sana de una inyeccion SQL. */
try {
    $stmt = db()->prepare(
        'SELECT player_name AS player,
                modo,
                score,
                won,
                level_reached AS level,
                elapsed_sec AS time,
                best_streak AS streak,
                finished_at AS at
         FROM partidas
         WHERE status = \'won\''
        . ($filtraModo ? ' AND modo = :modo' : '') .
        ' ORDER BY score DESC, finished_at ASC
         LIMIT :lim'
    );
    if ($filtraModo) $stmt->bindValue(':modo', $modo, PDO::PARAM_STR);
    /* Aca SI o SI va bindValue con PARAM_INT y no execute([...]).
       ¿Por que? Porque con sentencias preparadas reales, los parametros se
       mandan como STRING por defecto, y MySQL no acepta  LIMIT '10'  entre
       comillas: tira error de sintaxis. Declarando el tipo entero, el valor
       viaja como numero y el LIMIT funciona. Es el clasico que hace perder
       media hora la primera vez que aparece. */
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    /* MySQL me devuelve TODO como string (score = "2840", won = "1"). Si se lo
       mandara asi al JavaScript, cosas como  if (fila.won)  o un ordenamiento
       numerico se comportarian raro ("10" < "9" comparando strings). Por eso
       normalizo los tipos antes de responder.
       El &$r toma la fila POR REFERENCIA, o sea que modifico el array original
       y no una copia. Por eso abajo va el unset($r): si no, esa referencia
       queda viva apuntando al ultimo elemento y un foreach posterior sobre el
       mismo array lo pisaria. Es una de las trampas clasicas de PHP. */
    foreach ($rows as &$r) {
        $r['score'] = (int)$r['score'];
        $r['won']   = (bool)$r['won'];
        $r['level'] = (int)$r['level'];
        $r['time']  = (int)$r['time'];
        $r['streak'] = (int)$r['streak'];
    }
    unset($r);

    json_out([
        'ok'      => true,
        'offline' => false,
        'modo'    => $filtraModo ? $modo : 'todos',
        'ranking' => $rows,
    ]);
} catch (Throwable $e) {
    json_error('No se pudo obtener el ranking: ' . $e->getMessage(), 500);
}
