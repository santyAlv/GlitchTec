/* Glitch.TEC — prueba de punta a punta de la API PHP (partidas, eventos, rondas, ranking).
   Necesita PHP + MySQL corriendo con la base cargada (sql/schema.sql).
   Uso:  node tools/probar_api.js [http://localhost/GlitchTec/api]
   Crea partidas de prueba ("test_*") en la base: usar una base de desarrollo. */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090/api').replace(/\/$/, '');
let fallos = 0;

async function call(path, body) {
  const r = await fetch(BASE + '/' + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  });
  let json = null;
  try { json = await r.json(); } catch (e) { /* respuesta sin JSON */ }
  return { status: r.status, json };
}

function check(nombre, ok, extra) {
  console.log((ok ? 'OK    ' : 'FALLA ') + nombre + (ok ? '' : '  -> ' + JSON.stringify(extra)));
  if (!ok) fallos++;
}

async function partida(nombre) {
  const r = await call('partida_start.php', { player_name: nombre, mode: 'virus' });
  return r.json;   // { id, token }
}

(async () => {
  const ping = await call('ping.php');
  check('ping con base conectada', ping.json && ping.json.ok && ping.json.db === true, ping.json);
  if (fallos) return process.exit(1);

  // ---- eventos: exigen token, tienen tope de tamaño ----
  const p = await partida('test_honesto');
  check('partida_start devuelve id y token', p.ok && p.id > 0 && /^[a-f0-9]{32}$/.test(p.token), p);

  let r = await call('evento.php', { match_id: p.id, event_type: 'bot_hint', detail: {} });
  check('evento SIN token se rechaza (403)', r.status === 403, r);
  r = await call('evento.php', { match_id: p.id, token: 'a'.repeat(32), event_type: 'bot_hint', detail: {} });
  check('evento con token ajeno se rechaza (403)', r.status === 403, r);
  r = await call('evento.php', { match_id: p.id, token: p.token, event_type: 'bot_hint', detail: { nivel: 1 } });
  check('evento con token correcto se guarda', r.status === 200 && r.json.ok, r);
  r = await call('evento.php', { match_id: p.id, token: p.token, event_type: 'bot_hint', detail: { x: 'x'.repeat(5000) } });
  check('evento con detalle gigante se rechaza (413)', r.status === 413, r);

  // ---- rondas de minijuego ----
  const ronda = (extra) => Object.assign({
    match_id: p.id, token: p.token, tipo: 'firewall', puntos: 120, segundos: 40, precision: 85,
    detalle: { captured: 17, blocked: 9 }
  }, extra);
  r = await call('ronda.php', ronda({ tipo: 'Firewall!' }));
  check('ronda con tipo inválido se rechaza (400)', r.status === 400, r);
  r = await call('ronda.php', ronda({ token: undefined }));
  check('ronda SIN token se rechaza (403)', r.status === 403, r);
  r = await call('ronda.php', ronda());
  check('ronda válida se guarda', r.status === 200 && r.json.ok, r);
  r = await call('ronda.php', ronda({ puntos: 9999999, precision: 500, segundos: -4 }));
  check('ronda con números fuera de rango se recorta, no rompe', r.status === 200, r);

  // ---- cierre de partida y ranking ----
  r = await call('partida_end.php', {
    match_id: p.id, token: p.token, won: true, score: 3000, base_score: 2800,
    level_reached: 4, elapsed_sec: 5, integrity: 80, mode: 'virus'
  });
  check('partida_end legítima cierra la partida', r.status === 200 && r.json.ok, r);
  r = await call('evento.php', { match_id: p.id, token: p.token, event_type: 'bot_hint', detail: {} });
  check('evento en partida YA cerrada se rechaza (403)', r.status === 403, r);

  r = await call('ranking.php?limit=50');
  check('ranking global incluye la partida honesta', r.json.ranking.some(x => x.player === 'test_honesto'), r.json);
  r = await call('ranking.php?minijuego=firewall&limit=50');
  check('ranking del minijuego incluye la ronda de 120 puntos',
    r.json.ranking.some(x => x.player === 'test_honesto' && x.puntos === 120 && x.precision === 85), r.json);
  check('la ronda con puntos absurdos quedó recortada a 100000',
    r.json.ranking.some(x => x.puntos === 100000), r.json);
  r = await call('ranking.php?minijuego=NO%20VALE');
  check('ranking con minijuego inválido se rechaza (400)', r.status === 400, r);

  // ---- partida sospechosa: dice haber jugado 9999 s en medio segundo ----
  const t = await partida('test_tramposo');
  r = await call('partida_end.php', {
    match_id: t.id, token: t.token, won: true, score: 999999, base_score: 999999,
    level_reached: 4, elapsed_sec: 9999, integrity: 100, mode: 'virus'
  });
  check('partida_end del tramposo se acepta (se cierra igual)', r.status === 200, r);
  r = await call('ranking.php?limit=50');
  check('el tramposo NO entra al ranking global', !r.json.ranking.some(x => x.player === 'test_tramposo'), r.json);

  // ---- tope de rondas por partida ----
  const q = await partida('test_tope');
  let ultimo = null;
  for (let i = 0; i < 201; i++) {
    ultimo = await call('ronda.php', { match_id: q.id, token: q.token, tipo: 'popups', puntos: 1, segundos: 1, precision: 1 });
  }
  check('la ronda 201 de una partida se rechaza (429)', ultimo.status === 429, ultimo);

  console.log(fallos ? `\n${fallos} prueba(s) fallaron` : '\nTodas las pruebas pasaron');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
