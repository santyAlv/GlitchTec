/* ============================================================
   Glitch.TEC — Minijuego: filtrado de paquetes de red
   Una ronda de ROUND_SECS segundos. Cruzan paquetes legitimos (verdes) y
   maliciosos (rojos) por trayectorias distintas. La mira se mueve con el
   stick izquierdo del mando (o con el mouse):

     clic izquierdo / boton izq -> CAPTURAR (validar) trafico legitimo
     clic derecho   / boton der -> BLOQUEAR (destruir) un troyano

   Acertar suma puntos con velocidad y racha (GT.correct). Equivocarse corta
   la racha (GT.wrong) y un troyano que pasa o se captura le pega a la
   integridad. Al cerrar la ronda se registra el resumen en la base
   (api.logEvent -> evento.php).
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var fw = GT.firewall = {};

  var W = 560, H = 320;
  var ROUND_SECS = 40;
  var HIT_RADIUS = 26;          // que tan cerca de la mira tiene que estar el paquete
  var AIM_SPEED = 340;          // px/s con el stick a fondo

  var run = null;               // estado de la ronda en curso (null = no hay)

  function newRun(canvas) {
    return {
      canvas: canvas, ctx: canvas.getContext('2d'),
      aim: { x: W / 2, y: H / 2 },
      packets: [], spawnIn: 0.5, left: ROUND_SECS, last: 0,
      stats: { captured: 0, blocked: 0, wrongHits: 0, breached: 0, lostLegit: 0 }
    };
  }

  /* ---------------- Paquetes ---------------- */
  /* Cuatro trayectorias: de izquierda a derecha, al reves y en diagonal; la
     ultima ondula. La velocidad sube con el nivel de infeccion. */
  function spawn() {
    var evil = Math.random() < 0.4;
    var dir = GT.pick([1, -1]);
    var speed = GT.rand(90, 150) * (1 + GT.getInfection() / 200);
    var y = GT.rand(30, H - 30);
    run.packets.push({
      evil: evil, x: dir > 0 ? -20 : W + 20, y: y, y0: y,
      vx: dir * speed, vy: GT.pick([0, 0, -40, 40]), wave: Math.random() < 0.3 ? GT.rand(20, 45) : 0,
      t: 0, label: evil ? GT.pick(['TROYANO', 'SYN-FLOOD', 'KEYLOG', 'BOTNET']) : GT.pick(['HTTP', 'DNS', 'MAIL', 'TCP'])
    });
  }

  function step(dt) {
    var r = run;
    r.left -= dt;
    r.spawnIn -= dt;
    if (r.spawnIn <= 0) { spawn(); r.spawnIn = Math.max(0.45, 1 - (ROUND_SECS - r.left) / 80); }

    r.packets = r.packets.filter(function (p) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y = p.y0 + p.vy * p.t + (p.wave ? Math.sin(p.t * 3) * p.wave : 0);
      if (p.x > -30 && p.x < W + 30) return true;
      /* Se fue de pantalla sin que lo tocaran: un troyano que pasa duele, un
         paquete legitimo perdido solo cuesta puntos. */
      if (p.evil) { r.stats.breached++; GT.damage(6, 'troyano atravesó el firewall'); GT.wrong(0, 'troyano'); }
      else { r.stats.lostLegit++; GT.addScore(-5, 'paquete legítimo perdido'); }
      return false;
    });
  }

  /* ---------------- Acciones ---------------- */
  function act(kind) {   // kind: 'capture' | 'block'
    var r = run, best = null, bd = HIT_RADIUS;
    r.packets.forEach(function (p) {
      var d = Math.hypot(p.x - r.aim.x, p.y - r.aim.y);
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) return;
    r.packets.splice(r.packets.indexOf(best), 1);

    var ok = (kind === 'capture') !== best.evil;      // capturar lo bueno o bloquear lo malo
    if (ok) {
      if (kind === 'capture') r.stats.captured++; else r.stats.blocked++;
      GT.correct(kind === 'capture' ? 12 : 18, kind === 'capture' ? 'paquete validado' : 'troyano bloqueado');
      GT.audio.close();
    } else {
      r.stats.wrongHits++;
      GT.wrong(10, 'filtraste mal un paquete');
      GT.damage(best.evil ? 8 : 4, best.evil ? 'dejaste entrar un troyano' : 'bloqueaste tráfico legítimo');
      GT.audio.hurt();
    }
  }

  /* ---------------- Mando ---------------- */
  /* El mando del celular llega por WebSocket (js/input.js). Sin mando conectado,
     poll() devuelve null y el mouse sigue funcionando por los eventos del canvas. */
  function pollPad(dt) {
    var p = GT.input.poll();
    if (!p) return;
    run.aim.x = Math.max(0, Math.min(W, run.aim.x + p.x * AIM_SPEED * dt));
    run.aim.y = Math.max(0, Math.min(H, run.aim.y + p.y * AIM_SPEED * dt));
    if (p.left.pressed) act('capture');
    if (p.right.pressed) act('block');
  }

  /* ---------------- Dibujo ---------------- */
  function draw() {
    var c = run.ctx;
    c.fillStyle = '#04090b'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(43,240,122,.12)';
    for (var gx = 0; gx < W; gx += 40) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, H); c.stroke(); }
    for (var gy = 0; gy < H; gy += 40) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }

    c.font = '10px monospace'; c.textAlign = 'center';
    run.packets.forEach(function (p) {
      c.fillStyle = p.evil ? '#ff3b4a' : '#2bf07a';
      c.fillRect(p.x - 16, p.y - 9, 32, 18);
      c.fillStyle = '#04090b'; c.fillText(p.label.slice(0, 5), p.x, p.y + 3);
    });

    var a = run.aim;
    c.strokeStyle = '#ffd84a'; c.lineWidth = 2;
    c.beginPath(); c.arc(a.x, a.y, HIT_RADIUS - 6, 0, 6.283); c.stroke();
    c.beginPath(); c.moveTo(a.x - 14, a.y); c.lineTo(a.x + 14, a.y);
    c.moveTo(a.x, a.y - 14); c.lineTo(a.x, a.y + 14); c.stroke();
    c.lineWidth = 1;

    var s = run.stats;
    c.fillStyle = '#2bf07a'; c.textAlign = 'left'; c.font = '12px monospace';
    c.fillText('TIEMPO ' + Math.ceil(run.left) + 's   RACHA x' + GT.getMultiplier() +
               '   VALIDADOS ' + s.captured + '   BLOQUEADOS ' + s.blocked, 8, 16);
  }

  /* ---------------- Ronda ---------------- */
  function loop(ts) {
    if (!run || !run.canvas.isConnected) { run = null; return; }       // ventana cerrada
    var dt = Math.min(0.1, (ts - (run.last || ts)) / 1000);
    run.last = ts;
    if (GT.state.running && !GT.state.finished) {
      pollPad(dt); step(dt); draw();
      if (run.left <= 0) return finish();
    }
    window.requestAnimationFrame(loop);
  }

  function finish() {
    var s = run.stats, good = s.captured + s.blocked;
    var total = good + s.wrongHits + s.breached + s.lostLegit;
    var acc = total ? Math.round(100 * good / total) : 0;
    GT.state.firewallRounds = (GT.state.firewallRounds || 0) + 1;
    if (acc >= 70) { GT.heal(8, 'firewall estable'); GT.addScore(50, 'ronda de firewall'); }
    GT.ui.toast('Firewall: ' + good + ' paquetes filtrados, ' + acc + '% de precisión.', acc >= 70 ? 'info' : 'bad');
    if (GT.api) GT.api.logEvent('firewall_round', {
      captured: s.captured, blocked: s.blocked, wrong: s.wrongHits,
      breached: s.breached, lost_legit: s.lostLegit, accuracy: acc
    });
    run.canvas.parentNode.querySelector('.fw-start').hidden = false;
    run = null;
  }

  function begin(canvas) {
    run = newRun(canvas);
    window.requestAnimationFrame(loop);
  }

  fw.isActive = function () { return !!run; };

  fw.open = function () {
    var el = document.createElement('div');
    el.className = 'fw';
    el.innerHTML =
      '<canvas width="' + W + '" height="' + H + '"></canvas>' +
      '<button class="xp-btn fw-start">INICIAR FILTRADO (' + ROUND_SECS + ' s)</button>' +
      '<small>Clic izq: validar tráfico legítimo · Clic der: bloquear troyanos · Stick: mover la mira</small>';
    var cv = el.querySelector('canvas');

    cv.addEventListener('mousemove', function (e) {
      if (!run) return;
      var b = cv.getBoundingClientRect();
      run.aim.x = (e.clientX - b.left) * W / b.width;
      run.aim.y = (e.clientY - b.top) * H / b.height;
    });
    cv.addEventListener('mousedown', function (e) {
      if (run) act(e.button === 2 ? 'block' : 'capture');
    });
    cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    el.querySelector('.fw-start').addEventListener('click', function (e) {
      e.target.hidden = true;
      begin(cv);
    });

    GT.ui.openWindow({
      id: 'firewall', title: 'Firewall — Filtro de paquetes', icon: GT.ui.icons.taskmgr, asset: 'app.firewall',
      width: W + 16, height: H + 90, body: el
    });
  };

})(window, document);
