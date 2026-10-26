<?php
/**
 * Glitch.TEC — historial de partidas de la cuenta
 * GET api/mis_partidas.php?limit=20  →  { ok, resumen, partidas }
 * Exige sesión iniciada: cada uno ve solamente lo suyo.
 */
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$limit = clamp_int($_GET['limit'] ?? 20, 1, 50);

try {
    $user = usuario_actual();
    if (!$user) {
        json_error('Iniciá sesión para ver tu historial.', 401);
    }
    $uid = (int)$user['id'];

    /* Resumen por modo. SUM(won) cuenta las ganadas porque won vale 0 o 1, y
       el CASE deja afuera del MAX a las perdidas: el mejor puntaje es de
       partidas ganadas, igual que en el ranking. Las que quedaron 'running'
       (se cerró la pestaña a mitad de camino) no cuentan como jugadas. */
    $stmt = db()->prepare(
        'SELECT modo,
                COUNT(*) AS jugadas,
                SUM(won) AS ganadas,
                MAX(CASE WHEN won = 1 THEN score ELSE 0 END) AS mejor_puntaje,
                MAX(best_streak) AS mejor_racha
         FROM partidas
         WHERE user_id = :uid AND status IN (\'won\', \'lost\')
         GROUP BY modo'
    );
    $stmt->execute([':uid' => $uid]);

    $resumen = [];
    foreach ($stmt->fetchAll() as $r) {
        $resumen[$r['modo']] = [
            'jugadas'       => (int)$r['jugadas'],
            'ganadas'       => (int)$r['ganadas'],
            'mejor_puntaje' => (int)$r['mejor_puntaje'],
            'mejor_racha'   => (int)$r['mejor_racha'],
        ];
    }

    /* Resumen por minijuego: cuantas rondas jugo, su mejor puntaje y la
       precision media. Las rondas de partidas que quedaron abiertas tambien
       cuentan: ya se jugaron, aunque la partida no se haya cerrado. */
    $stmt = db()->prepare(
        'SELECT m.tipo, COUNT(*) AS rondas, MAX(m.puntos) AS mejor,
                ROUND(AVG(m.precision_pct)) AS precision_media
         FROM minijuegos m
         JOIN partidas p ON p.id = m.partida_id
         WHERE p.user_id = :uid
         GROUP BY m.tipo'
    );
    $stmt->execute([':uid' => $uid]);
    $minijuegos = [];
    foreach ($stmt->fetchAll() as $r) {
        $minijuegos[$r['tipo']] = [
            'rondas'          => (int)$r['rondas'],
            'mejor'           => (int)$r['mejor'],
            'precision_media' => (int)$r['precision_media'],
        ];
    }

    $stmt = db()->prepare(
        'SELECT id, modo, won, score, level_reached AS level, elapsed_sec AS time,
                best_streak AS streak, finished_at AS at
         FROM partidas
         WHERE user_id = :uid AND status IN (\'won\', \'lost\')
         ORDER BY finished_at DESC
         LIMIT :lim'
    );
    $stmt->bindValue(':uid', $uid, PDO::PARAM_INT);
    $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $r['id']     = (int)$r['id'];
        $r['won']    = (bool)$r['won'];
        $r['score']  = (int)$r['score'];
        $r['level']  = (int)$r['level'];
        $r['time']   = (int)$r['time'];
        $r['streak'] = (int)$r['streak'];
    }
    unset($r);

    json_out([
        'ok'       => true,
        'user'     => usuario_publico($user),
        'resumen'  => $resumen,
        'minijuegos' => $minijuegos,
        'partidas' => $rows,
    ]);
} catch (Throwable $e) {
    json_error('No se pudo obtener el historial.', 500);
}
