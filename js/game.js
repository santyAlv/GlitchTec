/* ============================================================
   Glitch.TEC — orquestador principal
   Arranque, secuencia de boot, escritorio, loop de juego,
   HUD y condiciones de victoria/derrota.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var game = GT.game = {};

  var loopId = null;
  var lastTs = 0;

  /* ============================================================
     Secuencia de arranque
     ============================================================ */
  var BOOT_LINES = [
    { t: 'WinTEC BIOS v2.04  —  Corporación WinTEC', c: 'dim', d: 260 },
    { t: 'CPU: Pentium(R) TEC 2.4 GHz', d: 90 },
    { t: 'Memoria: 2048 MB OK', d: 90 },
    { t: '', d: 60 },
    { t: 'Detectando dispositivos IDE...', d: 260 },
    { t: '  Primary Master  : WDC-TEC-40GB', c: 'ok', d: 120 },
    { t: '  Primary Slave   : none', c: 'dim', d: 90 },
    { t: '', d: 60 },
    { t: 'Verificando integridad del sistema de archivos...', d: 420 },
    { t: '  C:\\Documentos ........ OK', c: 'ok', d: 130 },
    { t: '  C:\\Descargas ......... OK', c: 'ok', d: 130 },
    { t: '  C:\\Sistema ........... ', c: 'ok', d: 420 },
    { t: '  [!] SECTOR CORRUPTO EN \\Sistema\\cuarentena', c: 'err', d: 520 },
    { t: '  [!] 1 proceso sin firma digital en el arranque', c: 'err', d: 420 },
    { t: '', d: 120 },
    { t: 'Iniciando WinTEC 95...', c: 'warn', d: 620 },
    { t: 'h o l a   e s t u d i a n t e', c: 'err', d: 900 },
    { t: '', d: 200 }
  ];

  /* Apertura del taller (modo tecnico): mismo recurso, otro relato. */
  var TECH_BOOT_LINES = [
    { t: 'SERVICIO TÉCNICO TEC  —  sistema de órdenes v1.8', c: 'dim', d: 300 },
    { t: 'Abriendo el taller...', d: 260 },
    { t: '', d: 60 },
    { t: 'Inventario de herramientas:', d: 220 },
    { t: '  Destornilladores ....... OK', c: 'ok', d: 110 },
    { t: '  Aire comprimido ........ OK', c: 'ok', d: 110 },
    { t: '  Pasta térmica .......... OK', c: 'ok', d: 110 },
    { t: '  Disco externo (backup).. OK', c: 'ok', d: 110 },
    { t: '  Multímetro ............. OK', c: 'ok', d: 200 },
    { t: '', d: 80 },
    { t: 'Sincronizando órdenes de trabajo pendientes...', d: 460 },
    { t: '  4 equipos esperando en el mostrador', c: 'warn', d: 420 },
    { t: '', d: 100 },
    { t: 'Técnico de turno: vos. Buena suerte.', c: 'ok', d: 640 },
    { t: '', d: 200 }
  ];

  function runBoot(lines, done) {
    var log = document.getElementById('boot-log');
    log.innerHTML = '';
    GT.ui.setScreen('screen-boot');
    GT.audio.boot();

    var i = 0;
    (function step() {
      if (i >= lines.length) { setTimeout(done, 320); return; }
      var line = lines[i++];
      var span = document.createElement('span');
      span.className = line.c || '';
      span.textContent = line.t + '\n';
      log.appendChild(span);
      if (line.c === 'err') { GT.audio.glitch(); GT.ui.shake(); }
      else if (line.t) GT.audio.key();
      setTimeout(step, line.d || 120);
    })();
  }

  /* ============================================================
     Iconos del escritorio
     ============================================================ */
  function buildDesktop() {
    GT.ui.resetDesktop();

    GT.ui.registerIcon({
      id: 'terminal', label: 'Terminal', icon: GT.ui.icons.terminal,
      hint: 'Línea de comandos', onOpen: function () { GT.terminal.open(); }
    });

    GT.ui.registerIcon({
      id: 'explorer', label: 'Mi PC', icon: GT.ui.icons.folder,
      hint: 'Explorador de archivos', onOpen: function () { GT.explorer.open(); }
    });

    GT.ui.registerIcon({
      id: 'taskmgr', label: 'Administrador de tareas', icon: GT.ui.icons.taskmgr,
      hint: 'Procesos y recursos', locked: true, onOpen: function () { GT.procs.open(); }
    });

    GT.ui.registerIcon({
      id: 'mail', label: 'TEC-Mail', icon: GT.ui.icons.mail,
      hint: 'Cliente de correo', locked: true, onOpen: function () { GT.mail.open(); }
    });

    GT.ui.registerIcon({
      id: 'manual', label: 'Manual', icon: GT.ui.icons.book,
      hint: 'Ayuda y comandos', onOpen: openManual
    });

    GT.ui.registerIcon({
      id: 'trash', label: 'Papelera', icon: GT.ui.icons.trash,
      hint: 'Vacía', onOpen: function () {
        GT.ui.toast('La papelera está vacía. Borrar archivos no elimina procesos en memoria.', 'info');
      }
    });
  }

  function openManual() {
    var el = document.createElement('div');
    el.className = 'viewer';
    el.style.background = '#fbfbf7';
    el.innerHTML =
      '<b>MANUAL DE SUPERVIVENCIA — Glitch.TEC</b>\n' +
      '=======================================\n\n' +
      'OBJETIVO\n' +
      '  Rastrear, contener y purgar el malware antes de que la\n' +
      '  integridad del sistema llegue a 0%.\n\n' +
      'COMANDOS DE LA TERMINAL\n' +
      '  help              lista de comandos\n' +
      '  dir               contenido de la carpeta actual\n' +
      '  cd <carpeta>      entrar   (cd .. vuelve atrás)\n' +
      '  type <archivo>    leer un archivo de texto\n' +
      '  scan <archivo>    analizar amenazas\n' +
      '  unlock <clave>    desbloquear carpeta protegida\n' +
      '  ps / kill <pid>   ver y terminar procesos\n' +
      '  objetivos         objetivos del nivel\n' +
      '  pista             ayuda (cuesta ' + GT.CONFIG.HINT_COST + ' puntos)\n' +
      '  cls               limpiar pantalla\n\n' +
      'EL HACKER\n' +
      '  Se pasea por la pantalla y cada tanto te ataca:\n' +
      '  · te BLOQUEA TECLAS: para recuperarlas respondé bien la\n' +
      '    pregunta de software del panel (con el mouse).\n' +
      '  · te CORROMPE LOS COLORES durante 20 segundos.\n' +
      '  Si le hacés click se escapa y retrasa su próximo ataque.\n\n' +
      'INTEGRIDAD (tus vidas)\n' +
      '  Baja si dejás pop-ups abiertos, si aceptás lo que ofrecen,\n' +
      '  si matás procesos legítimos o si caés en un phishing.\n' +
      '  Si llega a 0% perdés la partida.\n\n' +
      'CÓMO SE PUNTÚA\n' +
      '  +80   objetivo cumplido\n' +
      '  +120  proceso hostil eliminado\n' +
      '  +140  correo clasificado correctamente\n' +
      '  +200  respuesta correcta en la purga\n' +
      '  +10   pop-up cerrado sin aceptar\n' +
      '  -40   aceptar un pop-up      -60  matar proceso legítimo\n' +
      '  -50   clasificar mal un correo   -' + GT.CONFIG.HINT_COST + '  usar una pista\n';

    GT.ui.openWindow({
      id: 'manual', title: 'Manual de supervivencia', icon: GT.ui.icons.book,
      width: 560, height: 420, body: el
    });
  }

  /* ============================================================
     Inicio de partida
     ============================================================ */
  game.start = function (mode) {
    stopLoop();

    mode = (mode === 'tecnico') ? 'tecnico' : 'virus';

    GT.resetState();
    GT.state.mode = mode;
    GT.state.fsRoot = GT.fs.create();
    GT.state.running = true;

    GT.terminal.reset();
    GT.explorer.reset();
    GT.procs.reset();
    GT.mail.reset();
    GT.popups.reset();
    GT.boss.reset();
    GT.levels.reset();
    GT.hacker.reset();
    GT.tech.reset();
    GT.ui.setGlitch(0);

    if (GT.api) GT.api.startMatch();

    if (mode === 'tecnico') {
      runBoot(TECH_BOOT_LINES, function () {
        GT.tech.start();
        startLoop();
      });
      return;
    }

    runBoot(BOOT_LINES, function () {
      GT.ui.setScreen('screen-desktop');
      buildDesktop();
      GT.ui.setGlitch(0.08);
      updateHud();

      // Los pop-ups arrancan después del diálogo introductorio (ver levels.start)
      startLoop();
      GT.levels.start(1);

      // El hacker entra en escena unos segundos después del diálogo
      setTimeout(function () {
        if (GT.state.running && !GT.state.finished && GT.state.mode === 'virus') GT.hacker.start();
      }, 9000);
    });
  };

  /* ============================================================
     Loop principal
     ============================================================ */
  function startLoop() {
    lastTs = performance.now();
    loopId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = null;
  }

  function frame(ts) {
    var dt = Math.min(0.25, (ts - lastTs) / 1000);   // evita saltos al cambiar de pestaña
    lastTs = ts;

    if (GT.state.running && !GT.state.finished) {
      GT.state.elapsed += dt;

      if (GT.state.mode === 'tecnico') {
        GT.tech.tick(dt);
      } else {
        GT.popups.tick(dt);
        GT.procs.tick(dt);
        GT.boss.tick(dt);
        GT.hacker.tick(dt);
        updateHud();
      }
    }

    loopId = requestAnimationFrame(frame);
  }

  /* ============================================================
     HUD
     ============================================================ */
  function updateHud() {
    var s = GT.state;
    if (s.mode === 'tecnico') { GT.tech.tick(0); return; }

    var def = GT.levels.DEFS[s.level];

    document.getElementById('hud-level').textContent = 'NIVEL ' + s.level + ' / 4';
    document.getElementById('hud-levelname').textContent = def ? def.name : '—';

    var integ = Math.max(0, Math.round(s.integrity));
    var barI = document.getElementById('bar-integrity');
    barI.style.width = integ + '%';
    barI.parentNode.className = 'bar' + (integ <= 25 ? ' crit' : integ <= 55 ? ' warn' : '');
    document.getElementById('val-integrity').textContent = integ + '%';

    var inf = GT.getInfection();
    document.getElementById('bar-infection').style.width = inf + '%';
    document.getElementById('val-infection').textContent = inf + '%';

    document.getElementById('val-score').textContent = s.score;
    document.getElementById('val-time').textContent = GT.formatTime(s.elapsed);
    document.getElementById('val-popups').textContent = GT.popups.count();

    GT.ui.setGlitch(Math.min(1, inf / 100));
  }

  GT.on('hud', updateHud);

  /* ============================================================
     Final de partida
     ============================================================ */
  function computeSummary(won) {
    var s = GT.state;
    var timeBonus = won ? Math.max(0, Math.round(600 - s.elapsed * 1.2)) : 0;
    var integrityBonus = won ? Math.round(s.integrity * 6) : 0;
    var total = Math.max(0, s.score + timeBonus + integrityBonus);

    return {
      won: won,
      mode: s.mode,
      techMinutes: s.techMinutes || 0,
      techCost: s.techCost || 0,
      techSolved: s.techSolved || 0,
      base: s.score,
      timeBonus: timeBonus,
      integrityBonus: integrityBonus,
      total: total,
      level: s.level,
      elapsed: Math.round(s.elapsed),
      integrity: Math.round(s.integrity),
      mistakes: s.mistakes,
      hints: s.hintsUsed,
      popupsClosed: s.popupsClosed,
      learned: s.learned.slice()
    };
  }

  GT.on('gameover', function () {
    if (GT.state.finished) return;
    GT.state.finished = true;
    GT.state.running = false;

    GT.popups.stop();
    GT.procs.stop();
    GT.hacker.stop();
    GT.tech.stop();
    stopLoop();
    GT.ui.hideDialog();
    GT.audio.defeat();

    var sum = computeSummary(false);
    if (GT.api) GT.api.finishMatch(sum);

    if (sum.mode === 'tecnico') {
      setLoseText(
        'TALLER CERRADO',
        'La reputación del taller llegó a cero.',
        'REPUTATION_ZERO (0x00TALLER)',
        'Cambiaste piezas sanas, perdiste datos o te comiste los tiempos. ' +
        'En el oficio, el diagnóstico es el trabajo: el destornillador viene después.',
        'Presioná REINTENTAR para volver a abrir el taller.'
      );
      document.getElementById('lose-stats').innerHTML =
        row('Órdenes cerradas', sum.techSolved + ' / ' + GT.tech.totalCases) +
        row('Puntaje', sum.base) +
        row('Tiempo de taller', sum.techMinutes + ' min') +
        row('Gastado en repuestos', '$' + money(sum.techCost)) +
        row('Errores cometidos', sum.mistakes);
    } else {
      setLoseText(
        'WINTEC',
        'Se ha detectado un problema y el sistema fue apagado para evitar daños.',
        'SYSTEM_INTEGRITY_FAILURE (0x000000GL1TCH)',
        'El malware tomó control total del equipo.',
        'Presioná REINTENTAR para restaurar el último punto seguro.'
      );
      document.getElementById('lose-stats').innerHTML =
        row('Nivel alcanzado', sum.level + ' / 4') +
        row('Puntaje', sum.base) +
        row('Tiempo sobrevivido', GT.formatTime(sum.elapsed)) +
        row('Errores cometidos', sum.mistakes) +
        row('Pop-ups cerrados', sum.popupsClosed);
    }

    setTimeout(function () { GT.ui.setScreen('screen-lose'); }, 550);
  });

  /** El BSOD se reusa para las dos derrotas, con otro texto. */
  function setLoseText(title, lead, code, detail, hint) {
    var box = document.querySelector('#screen-lose .bsod');
    box.querySelector('h2').textContent = title;
    var ps = box.querySelectorAll('p');
    ps[0].textContent = lead;
    box.querySelector('.bsod-code').textContent = code;
    ps[2].textContent = detail;
    box.querySelector('.bsod-hint').textContent = hint;
  }

  GT.on('victory', function () {
    if (GT.state.finished) return;
    GT.state.finished = true;
    GT.state.running = false;

    GT.popups.stop();
    GT.popups.clearAll();
    GT.procs.stop();
    GT.hacker.stop();
    GT.tech.stop();
    stopLoop();
    GT.ui.hideDialog();
    GT.audio.victory();

    var sum = computeSummary(true);
    if (GT.api) GT.api.finishMatch(sum);

    var tecnico = (sum.mode === 'tecnico');

    document.querySelector('#screen-win .doc-title-win').textContent =
      tecnico ? '// TODOS LOS EQUIPOS ENTREGADOS' : '// SISTEMA RESTAURADO';
    document.querySelector('#screen-win .win-lead').textContent = tecnico
      ? 'Cerraste las cuatro órdenes. Cuatro clientes se van con su equipo andando.'
      : 'El proceso hostil fue eliminado. Tu PC vuelve a ser tuya.';

    document.getElementById('win-stats').innerHTML =
      row('Puntaje de la partida', sum.base) +
      row('Bonus por tiempo', '+' + sum.timeBonus) +
      row(tecnico ? 'Bonus por reputación (' + sum.integrity + '%)'
                  : 'Bonus por integridad (' + sum.integrity + '%)', '+' + sum.integrityBonus) +
      row('PUNTAJE FINAL', '<b>' + sum.total + '</b>') +
      row('Tiempo total', GT.formatTime(sum.elapsed)) +
      (tecnico ? row('Tiempo de taller', sum.techMinutes + ' min') +
                 row('Gastado en repuestos', '$' + money(sum.techCost)) : '') +
      row('Errores', sum.mistakes) +
      row('Pistas usadas', sum.hints);

    var ul = document.getElementById('win-learn-list');
    ul.innerHTML = '';
    var items = sum.learned.length ? sum.learned : ['Completaste el sistema sin registrar conceptos.'];
    items.slice(0, 12).forEach(function (l) {
      var li = document.createElement('li');
      li.textContent = l;
      ul.appendChild(li);
    });

    setTimeout(function () { GT.ui.setScreen('screen-win'); }, 700);
  });

  function row(label, value) {
    return '<li><span>' + label + '</span><b>' + value + '</b></li>';
  }

  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* ============================================================
     Menus y navegacion
     ============================================================ */
  function bindMenus() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      GT.audio.click();

      if (action === 'modes')   { GT.ui.setScreen('screen-mode'); }
      if (action === 'play')    { hardStop(); game.start(btn.dataset.mode); }
      if (action === 'start')   { game.start(GT.state.mode); }
      if (action === 'help')    { GT.ui.setScreen('screen-help'); }
      if (action === 'credits') { GT.ui.setScreen('screen-credits'); }
      if (action === 'back')    { GT.ui.setScreen('screen-title'); }
      if (action === 'menu')    { hardStop(); GT.ui.setScreen('screen-title'); }
      if (action === 'restart') { var m = GT.state.mode; hardStop(); game.start(m); }
    });

    // Las tarjetas de modo son divs con rol de boton: hay que darles teclado
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var card = e.target.closest && e.target.closest('.mode-card[data-action="play"]');
      if (!card) return;
      e.preventDefault();
      hardStop();
      game.start(card.dataset.mode);
    });

    document.querySelectorAll('[data-sm]').forEach(function (b) {
      b.addEventListener('click', function () {
        GT.ui.toggleStartMenu(false);
        if (b.dataset.sm === 'help') openManual();
        if (b.dataset.sm === 'restart') { var m = GT.state.mode; hardStop(); game.start(m); }
      });
    });
  }

  function hardStop() {
    stopLoop();
    GT.state.running = false;
    GT.state.finished = true;
    GT.popups.reset();
    GT.procs.reset();
    GT.hacker.reset();
    GT.tech.stop();
    GT.ui.resetDesktop();
    GT.ui.setGlitch(0);
  }

  /* ============================================================
     Init
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {
    GT.ui.init();
    GT.hacker.init();
    bindMenus();
    if (GT.engine && GT.engine.startCrt) GT.engine.startCrt();
    GT.ui.setScreen('screen-title');
  });

})(window, document);
