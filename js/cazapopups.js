/* ============================================================
   Glitch.TEC — Minijuego: caza de pop-ups (Whack-a-Malware)
   Evento de alta intensidad de la PC Corrompida: el malware
   llena el escritorio de anuncios y cada uno abierto se come la
   RAM virtual (GT.drainRam). Se juega con el cursor del mando:

     stick              -> mover el cursor
     boton izquierdo    -> clic en la X del anuncio: cerrarlo
                           (clic en el anuncio en si: lo "abriste")
     boton derecho      -> limpiador de area: cierra todo lo que
                           este cerca del cursor. Tiene pocas cargas.

   Si la RAM llega a 0 el sistema se satura y la ronda se pierde.
   Aparece sola una vez por nivel, del nivel 2 en adelante (tick),
   o a mano con GT.cazaPopups.start().
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var caza = GT.cazaPopups = {};

  var ROUND_SECS = 30;
  var CLEANER_CHARGES = 2;
  var CLEANER_RADIUS = 170;       // px alrededor del cursor
  var DRAIN_PER_AD = 1.6;         // RAM por segundo que se come cada anuncio abierto
  var FREE_PER_CLOSE = 5;         // RAM que libera cerrar uno
  var MAX_ADS = 14;               // mas que esto no entra en pantalla

  /* Anuncios: el contenido es lo que se ve; ninguno tiene una salida segura
     adentro, la unica forma de sacarlo es la X. */
  var ADS = [
    { title: 'RAM Doubler 2000', head: '¡DUPLICÁ TU MEMORIA!', text: 'Descargá RAM gratis en 3 segundos.', cta: 'DESCARGAR RAM' },
    { title: 'Felicitaciones', head: '¡GANASTE UN iPod!', text: 'Sos el visitante número 1.000.000.', cta: 'RECLAMAR' },
    { title: 'Alerta del sistema', head: 'TU PC ESTÁ LENTA', text: '1.204 errores encontrados en el registro.', cta: 'REPARAR YA' },
    { title: 'Codec requerido', head: 'Falta un códec de video', text: 'Instalá el pack para ver este contenido.', cta: 'INSTALAR' },
    { title: 'Barra gratis', head: 'SuperSearch Toolbar', text: 'Buscá más rápido con nuestra barra.', cta: 'AGREGAR' },
    { title: 'Oferta flash', head: '90% OFF SOLO HOY', text: 'Quedan 2 unidades. No te lo pierdas.', cta: 'COMPRAR' },
    { title: 'Chat', head: 'Alguien te mandó un mensaje', text: 'Hacé clic para leerlo antes de que se borre.', cta: 'LEER' },
    { title: 'Antivirus Total', head: '¡47 VIRUS DETECTADOS!', text: 'Tu equipo corre peligro. Escaneá ahora.', cta: 'ESCANEAR' }
  ];

  var run = null;                 // ronda en curso (null = no hay)

  /* ---------------- Programacion del evento ----------------
     Una oleada por nivel, del 2 en adelante, entre 50 y 90 segundos despues
     de empezar el nivel. Si en ese momento hay otro minijuego, un dialogo o
     el jefe, se corre 10 segundos. */
  var sched = { level: 0, wait: 0, done: {} };

  caza.tick = function (dt) {
    var s = GT.state;
    if (s.mode !== 'virus' || s.level < 2 || sched.done[s.level]) return;
    if (sched.level !== s.level) { sched.level = s.level; sched.wait = GT.rand(50, 90); }
    if (GT.minigame.isActive()) return;
    sched.wait -= dt;
    if (sched.wait > 0) return;
    if (document.querySelector('.dialog') || (GT.boss && GT.boss.isActive())) { sched.wait = 10; return; }
    sched.done[s.level] = true;
    caza.start();
  };

  /** Arranca la oleada. Devuelve true si arranco. */
  caza.start = function () {
    var desk = document.getElementById('desktop');
    if (!desk) return false;
    return GT.minigame.start('popups', { desk: desk });
  };

  caza.isActive = function () { return GT.minigame.isActive('popups'); };

  /* ---------------- Ronda ---------------- */
  function begin(o) {
    var layer = document.createElement('div');
    layer.id = 'caza-layer';
    layer.innerHTML =
      '<div class="caza-banner" role="status">' +
        '<strong>⚠ OLEADA DE POP-UPS</strong>' +
        '<span class="caza-time"></span>' +
        '<span class="caza-ram"><i>RAM</i><b><em></em></b></span>' +
        '<span class="caza-clean"></span>' +
        '<small>Clic izq en la <kbd>×</kbd>: cerrar · Botón der: limpiador de área</small>' +
      '</div>';
    o.desk.appendChild(layer);

    run = {
      layer: layer, left: ROUND_SECS, spawnIn: 0.2, charges: CLEANER_CHARGES,
      ads: [], seq: 0, failed: false,
      stats: { closed: 0, cleaned: 0, misclicks: 0, leftover: 0 }
    };
    GT.freeRam(GT.CONFIG.MAX_RAM, 'empieza la oleada');
    GT.audio.alarm();
    GT.ui.shake();
    for (var i = 0; i < 3; i++) spawn();
    renderBanner();
  }

  /* Un anuncio nuevo en un lugar al azar. Se evita tapar el HUD, que es lo
     que el jugador necesita ver para saber cuanta RAM le queda. */
  function spawn() {
    if (!run || run.ads.length >= MAX_ADS) return;
    var ad = GT.pick(ADS);
    var W = run.layer.clientWidth, H = run.layer.clientHeight;
    var w = Math.min(232, W - 20), h = 150;
    var hud = document.getElementById('hud');
    var hr = hud ? hud.getBoundingClientRect() : null;
    var lr = run.layer.getBoundingClientRect();
    var x = 10, y = 60;
    for (var tries = 0; tries < 10; tries++) {
      x = GT.rand(10, Math.max(10, W - w - 10));
      y = GT.rand(56, Math.max(56, H - h - 10));
      if (!hr || x + lr.left > hr.right || x + w + lr.left < hr.left ||
          y + lr.top > hr.bottom || y + h + lr.top < hr.top) break;
    }

    var el = document.createElement('div');
    el.className = 'caza-ad';
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.width = Math.round(w) + 'px';
    el.style.zIndex = ++run.seq;
    el.innerHTML =
      '<div class="caza-ad-bar"><span></span><button class="caza-x" aria-label="Cerrar anuncio">×</button></div>' +
      '<div class="caza-ad-body"><b></b><p></p><span class="caza-cta"></span></div>';
    el.querySelector('.caza-ad-bar span').textContent = ad.title;
    el.querySelector('.caza-ad-body b').textContent = ad.head;
    el.querySelector('.caza-ad-body p').textContent = ad.text;
    el.querySelector('.caza-cta').textContent = ad.cta;

    el.addEventListener('click', function (e) {
      if (!run) return;
      if (e.target.closest('.caza-x')) close(el, 'x');
      else misclick(el);
    });
    run.layer.appendChild(el);
    run.ads.push(el);
    GT.audio.popup();
  }

  function close(el, how) {
    var i = run.ads.indexOf(el);
    if (i === -1) return;
    run.ads.splice(i, 1);
    el.classList.add('is-closing');
    setTimeout(function () { el.remove(); }, 120);
    GT.freeRam(FREE_PER_CLOSE, 'pop-up cerrado');
    if (how === 'x') {
      run.stats.closed++;
      GT.correct(8, 'pop-up cerrado');
      GT.audio.close();
    } else {
      run.stats.cleaned++;
      GT.addScore(4, 'limpiador de área');
    }
  }

  /* Clic en el anuncio y no en la X: es exactamente lo que el malware
     quiere. Se come RAM y abre otro mas. */
  function misclick(el) {
    run.stats.misclicks++;
    el.classList.remove('is-shaking');
    void el.offsetWidth;
    el.classList.add('is-shaking');
    GT.wrong(5, 'abriste un anuncio');
    GT.drainRam(8, 'abriste un anuncio');
    GT.audio.error();
    spawn();
  }

  /* Limpiador de area: boton derecho del mando, con cargas contadas. Cierra
     todo lo que tenga el centro dentro del radio, alrededor del cursor. */
  function cleaner() {
    if (!run) return;
    if (run.charges <= 0) { GT.audio.error(); GT.ui.toast('El limpiador de área no tiene más cargas.', 'warn'); return; }
    run.charges--;
    var p = GT.cursor.pos();
    var lr = run.layer.getBoundingClientRect();

    var ring = document.createElement('div');
    ring.className = 'caza-ring';
    ring.style.left = (p.x - lr.left) + 'px';
    ring.style.top = (p.y - lr.top) + 'px';
    ring.style.width = ring.style.height = (CLEANER_RADIUS * 2) + 'px';
    run.layer.appendChild(ring);
    setTimeout(function () { ring.remove(); }, 420);

    run.ads.slice().forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (Math.hypot(r.left + r.width / 2 - p.x, r.top + r.height / 2 - p.y) <= CLEANER_RADIUS) close(el, 'area');
    });
    GT.audio.kill();
    renderBanner();
  }
  GT.on('pad:right', function (e) { if (run && e.down) cleaner(); });

  GT.on('ramfull', function () {
    if (!run || run.failed) return;
    run.failed = true;
    GT.damage(15, 'la RAM se saturó');
    GT.ui.flash('hit');
    GT.audio.hurt();
    finish();
  });

  function renderBanner() {
    if (!run) return;
    var b = run.layer.querySelector('.caza-banner');
    var ram = Math.round(GT.state.ram);
    b.querySelector('.caza-time').textContent = Math.ceil(run.left) + ' s';
    var bar = b.querySelector('.caza-ram em');
    bar.style.width = ram + '%';
    b.querySelector('.caza-ram').classList.toggle('is-low', ram < 30);
    b.querySelector('.caza-ram').setAttribute('aria-label', 'RAM libre ' + ram + '%');
    b.querySelector('.caza-clean').textContent = 'LIMPIADOR ×' + run.charges;
    b.querySelector('.caza-clean').classList.toggle('is-empty', run.charges === 0);
  }

  function tick(dt) {
    if (!run) return;
    run.left -= dt;
    run.spawnIn -= dt;
    if (run.spawnIn <= 0) {
      spawn();
      /* Cada vez mas rapido: de 1,1 s al principio a 0,45 s al final. */
      run.spawnIn = Math.max(0.45, 1.1 - (ROUND_SECS - run.left) / 45);
    }
    if (run.ads.length) GT.drainRam(DRAIN_PER_AD * run.ads.length * dt, 'pop-ups abiertos');
    renderBanner();
    if (run && run.left <= 0) finish();
  }

  function finish() {
    if (!run) return;
    var s = run.stats;
    s.leftover = run.ads.length;
    var good = s.closed + s.cleaned;
    var total = good + s.misclicks + s.leftover;
    var acc = total ? Math.round(100 * good / total) : 0;

    if (!run.failed) {
      if (acc >= 70) { GT.heal(6, 'oleada contenida'); GT.addScore(60, 'oleada de pop-ups'); }
      GT.ui.toast('Oleada contenida: ' + good + ' pop-ups cerrados, ' + acc + '% de precisión.', acc >= 70 ? 'info' : 'bad');
    } else {
      GT.ui.toast('La RAM se saturó: el sistema se trabó con ' + s.leftover + ' pop-ups abiertos.', 'bad');
    }
    GT.minigame.finish({
      closed: s.closed, cleaned: s.cleaned, misclicks: s.misclicks,
      leftover: s.leftover, saturated: run.failed, accuracy: acc
    });
  }

  function stop() {
    if (!run) return;
    run.layer.remove();
    run = null;
    GT.freeRam(GT.CONFIG.MAX_RAM, 'termina la oleada');
  }

  /* holdCursor false: se juega con el cursor del escritorio, el mismo que
     cierra ventanas. El boton derecho igual lo escucha este modulo. */
  GT.minigame.register('popups', { holdCursor: false, start: begin, tick: tick, stop: stop });

  /* Partida nueva: se vuelve a programar una oleada por nivel. */
  caza.reset = function () { sched = { level: 0, wait: 0, done: {} }; };

})(window, document);
