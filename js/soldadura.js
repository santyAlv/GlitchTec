/* ============================================================
   Glitch.TEC — Minijuego: banco de soldadura (Modo Hardware)
   Vista de cerca de la placa madre. El stick guía la punta de la
   herramienta, más lenta mientras se suelda para que se pueda
   apuntar con precisión:

     boton izquierdo (mantener) -> SOLDAR: rehacer una soldadura
                                   fria o puentear la pista cortada
     boton derecho   (mantener) -> TESTER sobre una pista o junta:
                                   mide continuidad y marca la falla.
                                   SPRAY sobre el flux que deja el
                                   estaño: lo limpia.

   Soldar arriba de un pin sano hace un puente de estaño: con tres
   puentes la placa queda en corto y la reparación sale mal. Se
   abre desde el taller (paso "soldar_pista" de js/tech.js) y el
   resultado vuelve con GT.tech.applyRepair: reputación y minutos
   de la orden.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var sold = GT.soldadura = {};

  var W = 600, H = 340;
  var ROUND_SECS = 60;
  var SPEED = 210;                // px/s con el stick a fondo
  var SPEED_SOLDANDO = 95;        // mas lento con el boton apretado: precision
  var MAX_PUENTES = 3;            // puentes de estaño hasta el corto
  var PIN_R = 8;                  // radio en el que un pin sano se puentea

  /* ---------------- La placa ----------------
     Coordenadas del canvas (600 x 340). Las pistas van del conector de 24
     pines (izquierda) al regulador (derecha). */
  var CONN = { x: 52, y: 70, w: 56, h: 200 };          // conector ATX de 24 pines
  var REG = { x: 470, y: 120, w: 70, h: 100 };         // regulador de tension
  var TRACES = [96, 124, 152, 180, 208, 236];          // y de cada pista horizontal
  var CRACK_TRACE = 3;                                 // la que se fisuro

  function pins() {
    var list = [];
    for (var i = 0; i < 12; i++) {
      list.push({ x: CONN.x + 14, y: CONN.y + 12 + i * 16 });
      list.push({ x: CONN.x + 42, y: CONN.y + 12 + i * 16 });
    }
    return list;
  }

  var run = null;                 // ronda en curso
  var root = null;                // la ventana (se arma una vez)
  var fault = null;               // falla de la orden que se esta reparando

  function newRun(canvas) {
    var p = pins();
    /* Las dos juntas frias son pines del conector que dan a la pista
       fisurada; el resto de los pines son los que se pueden puentear. */
    var j1 = p[2 * 6 + 1], j2 = p[2 * 7 + 1];
    var crackY = TRACES[CRACK_TRACE];
    return {
      canvas: canvas, ctx: canvas.getContext('2d'),
      tip: { x: W / 2, y: H - 40 },
      left: ROUND_SECS, t: 0,
      targets: [
        { kind: 'pista', x: 300, y: crackY, r: 13, need: 1.6, prog: 0, done: false, found: false },
        { kind: 'junta', x: j1.x, y: j1.y, r: 9, need: 1.0, prog: 0, done: false, found: false },
        { kind: 'junta', x: j2.x, y: j2.y, r: 9, need: 1.0, prog: 0, done: false, found: false }
      ],
      hazards: p.filter(function (q) { return q !== j1 && q !== j2; })
        .concat([{ x: REG.x - 6, y: 150 }, { x: REG.x - 6, y: 170 }, { x: REG.x - 6, y: 190 },
                 { x: 300, y: crackY - 20 }, { x: 300, y: crackY + 20 }]),       // pads del integrado
      flux: [], blobs: [], msg: null, msgFor: 0, cool: 0,
      stats: { soldadas: 0, puentes: 0, limpiado: 0, medidas: 0 }
    };
  }

  /* ---------------- Acciones ---------------- */
  function near(list, p, r) {
    var best = null, bd = Infinity;
    list.forEach(function (o) {
      var d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d <= (r || o.r) && d < bd) { bd = d; best = o; }
    });
    return best;
  }

  function say(text, ms) { run.msg = text; run.msgFor = (ms || 1200) / 1000; }

  function solder(dt) {
    var tg = near(run.targets.filter(function (t) { return !t.done; }), run.tip);
    if (tg) {
      tg.prog += dt;
      if (tg.prog >= tg.need) {
        tg.done = true;
        run.stats.soldadas++;
        /* El estaño deja flux alrededor: hay que limpiarlo con el spray. */
        run.flux.push({ x: tg.x, y: tg.y, r: 18, need: 0.7, prog: 0 });
        say(tg.kind === 'pista' ? 'Pista puenteada con estaño' : 'Soldadura rehecha: brillante y lisa');
        GT.audio.ok();
      }
      return;
    }
    /* Estaño arriba de un pin sano: puente. Con un enfriamiento corto, si
       no mantener el boton apretado sobre un pin sumaria uno por frame. */
    if (run.cool > 0) return;
    var hz = near(run.hazards, run.tip, PIN_R);
    if (!hz) return;
    run.stats.puentes++;
    run.blobs.push({ x: hz.x, y: hz.y });
    run.cool = 0.6;
    say('¡Puente de estaño! Unió dos pines que no tenían que tocarse', 1600);
    GT.audio.error();
    GT.ui.shake();
  }

  function spray(dt) {
    var fx = near(run.flux, run.tip);
    if (fx) {
      fx.prog += dt;
      if (fx.prog >= fx.need) {
        run.flux.splice(run.flux.indexOf(fx), 1);
        run.stats.limpiado++;
        say('Flux limpio con alcohol isopropílico');
        GT.audio.close();
      }
      return;
    }
    /* Sin flux debajo: el boton derecho es el tester */
    if (run.cool > 0) return;
    var tg = near(run.targets.filter(function (t) { return !t.done; }), run.tip);
    run.cool = 0.5;
    if (tg) {
      if (!tg.found) { tg.found = true; run.stats.medidas++; }
      say(tg.kind === 'pista' ? 'TESTER: sin continuidad. La pista está cortada acá' : 'TESTER: contacto intermitente. Soldadura fría', 1600);
      GT.audio.alarm();
      return;
    }
    if (onCopper(run.tip)) { say('TESTER: continuidad OK', 700); GT.audio.beep(); }
  }

  function onCopper(p) {
    if (p.x > CONN.x + CONN.w && p.x < REG.x) {
      return TRACES.some(function (y) { return Math.abs(p.y - y) <= 4; });
    }
    return !!near(run.hazards, p, PIN_R);
  }

  /* ---------------- Ronda ---------------- */
  function tick(dt) {
    if (!run.canvas.isConnected) return GT.minigame.stop();
    run.left -= dt;
    run.t += dt;
    run.cool = Math.max(0, run.cool - dt);
    run.msgFor = Math.max(0, run.msgFor - dt);

    var soldando = GT.input.isDown('left');
    var a = GT.input.axes();
    var v = soldando ? SPEED_SOLDANDO : SPEED;
    run.tip.x = Math.max(6, Math.min(W - 6, run.tip.x + a.x * v * dt));
    run.tip.y = Math.max(6, Math.min(H - 6, run.tip.y + a.y * v * dt));

    if (soldando) solder(dt);
    else if (GT.input.isDown('right')) spray(dt);

    draw(soldando);
    renderStatus();

    var hecho = run.targets.every(function (t) { return t.done; }) && !run.flux.length;
    if (hecho) return finish(true);
    if (run.stats.puentes >= MAX_PUENTES) return finish(false, 'Tres puentes de estaño: la placa quedó en corto.');
    if (run.left <= 0) finish(false, 'Se terminó el tiempo y la reparación quedó a medias.');
  }

  function finish(ok, why) {
    var s = run.stats;
    var secs = Math.round(run.t);
    /* Minutos de taller: una base por armar el banco más lo que se tardó.
       Fallar tambien cuesta el tiempo que se uso. */
    var mins = 6 + Math.round(secs / 4);
    var pendientes = run.targets.filter(function (t) { return !t.done; }).length + run.flux.length;
    var acc = Math.max(0, 100 - s.puentes * 25 - pendientes * 15);

    GT.tech.applyRepair(fault, ok, { minutes: mins, rep: 8, part: ok ? 'placa' : null });
    /* Salio bien pero con estaño donde no iba: el equipo anda, aunque el
       trabajo quedo prolijo a medias y eso le cuesta algo de reputacion. */
    if (ok && s.puentes) GT.damage(2 * s.puentes, 'puentes de estaño en la placa');
    showResult(ok, ok
      ? 'Reparación lista en ' + secs + ' s (' + mins + ' min de taller). ' +
        (s.puentes === 1 ? 'Quedó 1 puente de estaño: anduvo, pero con riesgo.'
          : s.puentes ? 'Quedaron ' + s.puentes + ' puentes de estaño: anduvo, pero con riesgo.' : 'Sin puentes de estaño.')
      : why + ' Se pierden ' + mins + ' min y reputación. Podés volver a intentarlo.');
    GT.minigame.finish({
      soldadas: s.soldadas, puentes: s.puentes, limpiado: s.limpiado, medidas: s.medidas,
      ok: ok, accuracy: ok ? acc : Math.min(acc, 40)
    });
  }

  /* ---------------- Dibujo ---------------- */
  function draw(soldando) {
    var c = run.ctx;

    /* Placa: verde con trama */
    c.fillStyle = '#0b4a2e'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,220,160,.07)';
    for (var gx = 0; gx < W; gx += 20) { c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, H); c.stroke(); }
    for (var gy = 0; gy < H; gy += 20) { c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke(); }

    /* Pistas de cobre */
    var crack = run.targets[0];
    c.lineWidth = 5; c.lineCap = 'round';
    TRACES.forEach(function (y, i) {
      c.strokeStyle = '#c98b3a';
      if (i === CRACK_TRACE && !crack.done) {
        c.beginPath(); c.moveTo(CONN.x + CONN.w, y); c.lineTo(crack.x - 4, y); c.stroke();
        c.beginPath(); c.moveTo(crack.x + 4, y); c.lineTo(REG.x, y); c.stroke();
        /* La fisura: una linea oscura en zigzag */
        c.strokeStyle = '#1a0d05'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(crack.x - 3, y - 4); c.lineTo(crack.x + 1, y); c.lineTo(crack.x - 1, y + 4); c.stroke();
        c.lineWidth = 5;
      } else {
        c.beginPath(); c.moveTo(CONN.x + CONN.w, y); c.lineTo(REG.x, y); c.stroke();
      }
    });
    if (crack.done) {                                   // el puente de estaño
      c.fillStyle = '#dfe6ea';
      c.beginPath(); c.ellipse(crack.x, crack.y, 9, 5, 0, 0, 6.283); c.fill();
    }

    /* Integrado chico al lado de la fisura, con sus pads */
    c.fillStyle = '#111'; c.fillRect(288, TRACES[CRACK_TRACE] - 28, 24, 10);
    c.fillRect(288, TRACES[CRACK_TRACE] + 18, 24, 10);

    /* Conector de 24 pines */
    c.fillStyle = '#f2f2ec'; c.fillRect(CONN.x, CONN.y, CONN.w, CONN.h);
    c.strokeStyle = '#8c8c86'; c.lineWidth = 2; c.strokeRect(CONN.x, CONN.y, CONN.w, CONN.h);
    pins().forEach(function (p) {
      var cold = run.targets.some(function (t) { return t.kind === 'junta' && !t.done && t.x === p.x && t.y === p.y; });
      c.fillStyle = cold ? '#77786f' : '#d9dee2';
      c.beginPath(); c.arc(p.x, p.y, 5, 0, 6.283); c.fill();
      if (cold) {                                      // grieta de la soldadura fria
        c.strokeStyle = '#2b2b26'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(p.x - 4, p.y - 2); c.lineTo(p.x + 3, p.y + 2); c.stroke();
      }
    });
    c.fillStyle = '#0b4a2e'; c.font = 'bold 10px monospace'; c.textAlign = 'center';
    c.fillText('ATX 24', CONN.x + CONN.w / 2, CONN.y - 6 + 0);

    /* Regulador y capacitores */
    c.fillStyle = '#1d1d22'; c.fillRect(REG.x, REG.y, REG.w, REG.h);
    c.fillStyle = '#9aa0a6'; c.font = '10px monospace';
    c.fillText('VRM', REG.x + REG.w / 2, REG.y + REG.h / 2 + 4);
    [[REG.x + 20, 70], [REG.x + 50, 70], [REG.x + 20, 270], [REG.x + 50, 270]].forEach(function (k) {
      c.fillStyle = '#2b3d8f'; c.beginPath(); c.arc(k[0], k[1], 13, 0, 6.283); c.fill();
      c.strokeStyle = '#c7cbe6'; c.lineWidth = 2; c.beginPath(); c.arc(k[0], k[1], 13, 0, 6.283); c.stroke();
    });

    /* Puentes de estaño y flux */
    run.blobs.forEach(function (b) {
      c.fillStyle = '#e8eef2'; c.beginPath(); c.ellipse(b.x + 6, b.y, 12, 6, 0, 0, 6.283); c.fill();
    });
    run.flux.forEach(function (f) {
      c.fillStyle = 'rgba(214,170,60,' + (0.55 * (1 - f.prog / f.need) + 0.1) + ')';
      c.beginPath(); c.arc(f.x, f.y, f.r, 0, 6.283); c.fill();
    });

    /* Marcas del tester y progreso */
    run.targets.forEach(function (t) {
      if (t.found && !t.done) {
        c.strokeStyle = '#ff80ff'; c.lineWidth = 2; c.setLineDash([4, 3]);
        c.beginPath(); c.arc(t.x, t.y, t.r + 7, 0, 6.283); c.stroke(); c.setLineDash([]);
      }
      if (t.prog > 0 && !t.done) bar(c, t.x, t.y - t.r - 12, t.prog / t.need, '#ffd84a');
    });
    run.flux.forEach(function (f) { if (f.prog > 0) bar(c, f.x, f.y - f.r - 8, f.prog / f.need, '#00bbf5'); });

    /* La punta: rojo encendido si suelda, celeste si mide o rocia */
    var tip = run.tip;
    var rojo = soldando, azul = !soldando && GT.input.isDown('right');
    if (rojo) {
      c.fillStyle = 'rgba(255,120,40,.35)'; c.beginPath(); c.arc(tip.x, tip.y, 16, 0, 6.283); c.fill();
    }
    c.strokeStyle = rojo ? '#ff7a28' : (azul ? '#00bbf5' : '#ffffff'); c.lineWidth = 2;
    c.beginPath(); c.arc(tip.x, tip.y, 8, 0, 6.283); c.stroke();
    c.beginPath(); c.moveTo(tip.x - 13, tip.y); c.lineTo(tip.x - 4, tip.y); c.moveTo(tip.x + 4, tip.y); c.lineTo(tip.x + 13, tip.y);
    c.moveTo(tip.x, tip.y - 13); c.lineTo(tip.x, tip.y - 4); c.moveTo(tip.x, tip.y + 4); c.lineTo(tip.x, tip.y + 13); c.stroke();

    /* Mensaje del momento */
    if (run.msgFor > 0 && run.msg) {
      c.font = 'bold 12px monospace'; c.textAlign = 'center';
      var w = c.measureText(run.msg).width + 20;
      c.fillStyle = 'rgba(0,16,58,.88)'; c.fillRect(W / 2 - w / 2, H - 34, w, 22);
      c.fillStyle = '#b8e6f8'; c.fillText(run.msg, W / 2, H - 19);
    }
    if (!GT.input.connected) {
      c.font = '12px monospace'; c.textAlign = 'left'; c.fillStyle = '#ff80ff';
      c.fillText('SIN MANDO: abrí la app del celular y conectala al relay', 10, 18);
    }
  }

  function bar(c, x, y, f, col) {
    c.fillStyle = 'rgba(0,16,58,.85)'; c.fillRect(x - 17, y - 3, 34, 6);
    c.fillStyle = col; c.fillRect(x - 16, y - 2, 32 * Math.min(1, f), 4);
  }

  /* ---------------- Ventana ---------------- */
  function build() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'sold hidden';
    root.innerHTML =
      '<div class="sold-back"></div>' +
      '<div class="sold-win" role="dialog" aria-labelledby="sold-title">' +
        '<div class="sold-bar"><span id="sold-title">Banco de soldadura — placa madre</span>' +
          '<button class="sold-x" aria-label="Cerrar">×</button></div>' +
        '<div class="sold-body">' +
          '<div class="sold-stage"><canvas width="' + W + '" height="' + H + '"></canvas>' +
            '<div class="sold-intro">' +
              '<p><b>Qué hay que hacer:</b> rehacer las dos soldaduras frías del conector, puentear ' +
              'con estaño la pista fisurada y limpiar el flux que queda.</p>' +
              '<ul>' +
                '<li><kbd>Stick</kbd> mueve la herramienta (más lento mientras soldás)</li>' +
                '<li><kbd>Izq</kbd> mantenido: soldar</li>' +
                '<li><kbd>Der</kbd> mantenido: tester sobre una pista, spray sobre el flux</li>' +
              '</ul>' +
              '<p class="sold-warn">Cuidado: soldar arriba de un pin sano hace un puente de estaño. ' +
              'Con ' + MAX_PUENTES + ' puentes la placa queda en corto.</p>' +
              '<button class="menu-btn sold-start">EMPEZAR (' + ROUND_SECS + ' s)</button>' +
            '</div>' +
            '<div class="sold-result" hidden><b></b><p></p><button class="menu-btn sold-close">VOLVER AL TALLER</button></div>' +
          '</div>' +
          '<div class="sold-status" aria-live="polite"></div>' +
        '</div>' +
      '</div>';

    root.querySelector('.sold-x').addEventListener('click', sold.close);
    root.querySelector('.sold-back').addEventListener('click', sold.close);
    root.querySelector('.sold-close').addEventListener('click', sold.close);
    root.querySelector('.sold-start').addEventListener('click', function () {
      var cv = root.querySelector('canvas');
      if (!GT.minigame.start('soldadura', { canvas: cv })) return;
      root.querySelector('.sold-intro').hidden = true;
    });

    var host = document.getElementById('screen-tech') || document.body;
    host.appendChild(root);
  }

  function renderStatus() {
    var box = root.querySelector('.sold-status');
    if (!run) { box.textContent = ''; return; }
    var hechas = run.targets.filter(function (t) { return t.done; }).length;
    box.innerHTML = '';
    [['TIEMPO', Math.max(0, Math.ceil(run.left)) + ' s'],
     ['REPARADAS', hechas + ' / ' + run.targets.length],
     ['FLUX', run.flux.length ? run.flux.length + ' sin limpiar' : 'limpio'],
     ['PUENTES', run.stats.puentes + ' / ' + MAX_PUENTES]].forEach(function (p, i) {
      var s = document.createElement('span');
      if (i === 3 && run.stats.puentes) s.className = 'is-bad';
      s.appendChild(document.createElement('i')).textContent = p[0];
      s.appendChild(document.createElement('b')).textContent = p[1];
      box.appendChild(s);
    });
  }

  function showResult(ok, text) {
    var r = root.querySelector('.sold-result');
    r.hidden = false;
    r.className = 'sold-result ' + (ok ? 'is-ok' : 'is-bad');
    r.querySelector('b').textContent = ok ? '✔ PLACA REPARADA' : '✘ LA REPARACIÓN SALIÓ MAL';
    r.querySelector('p').textContent = text;
  }

  /** Abre el banco para reparar la falla `f` de la orden en curso. */
  sold.open = function (f) {
    build();
    fault = f;
    root.classList.remove('hidden');
    root.querySelector('.sold-intro').hidden = false;
    root.querySelector('.sold-result').hidden = true;
    run = newRun(root.querySelector('canvas'));
    draw(false);
    run = null;
    renderStatus();
    GT.audio.open();
  };

  /* Cerrar en medio de la ronda la aborta: no repara nada, pero el tiempo
     que se uso igual se cobra en la orden. */
  sold.close = function () {
    if (!root) return;
    if (GT.minigame.isActive('soldadura')) {
      GT.tech.addMinutes(Math.round(run.t / 4));
      GT.minigame.stop();
    }
    root.classList.add('hidden');
  };

  sold.isOpen = function () { return !!root && !root.classList.contains('hidden'); };

  GT.minigame.register('soldadura', {
    start: function (o) { run = newRun(o.canvas); },
    tick: tick,
    stop: function () { run = null; if (root) renderStatus(); }
  });

})(window, document);
