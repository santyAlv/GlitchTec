/* ============================================================
   Glitch.TEC — orquestador principal
   Arranque, secuencia de boot, escritorio, loop de juego,
   HUD y condiciones de victoria/derrota.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var game = GT.game = {};

  var loopId = null;       // id que devuelve requestAnimationFrame (para cancelarlo)
  var lastTs = 0;          // timestamp del frame anterior, para calcular el dt

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
    { t: 'Iniciando WinTEC XP...', c: 'warn', d: 620 },
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

  /* Escribe el boot linea por linea, cada una con SU propia demora (el campo
     "d" de arriba). Eso es lo que le da ritmo: las lineas de error tardan mas
     y pegan mas fuerte.

     ¿Por que no un for con sleep? Porque en JavaScript NO existe el sleep:
     si bloqueo el hilo, se congela toda la pagina. La solucion es una funcion
     que se llama a si misma con setTimeout: dibuja UNA linea, agenda la
     siguiente y devuelve el control al navegador mientras tanto. Es una
     recursion "en el tiempo", no en la pila (cada llamada arranca limpia, asi
     que no hay riesgo de desbordar la pila por mas lineas que tenga).

     El (function step(){...})() es un IIFE con nombre: lo defino y lo ejecuto
     en el acto, pero como tiene nombre puede volver a llamarse desde adentro.

     "done" es un CALLBACK: lo que hay que hacer cuando termine el boot. Lo
     recibo por parametro porque el boot del modo virus y el del taller siguen
     caminos distintos, y asi esta funcion no necesita saber cual es cual. */
  function runBoot(lines, done) {
    var log = document.getElementById('boot-log');
    log.innerHTML = '';                     // limpio por si es un reintento
    GT.ui.setScreen('screen-boot');
    GT.audio.boot();

    var i = 0;
    (function step() {
      // Corte de la recursion: se acabaron las lineas -> aviso y me voy
      if (i >= lines.length) { setTimeout(done, 320); return; }
      var line = lines[i++];
      var span = document.createElement('span');
      span.className = line.c || '';
      /* textContent y NO innerHTML: estas lineas tienen backslashes y signos
         raros ("C:\Sistema", "[!]"), no quiero que se interpreten como HTML. */
      span.textContent = line.t + '\n';
      log.appendChild(span);
      if (line.c === 'err') { GT.audio.glitch(); GT.ui.shake(); }
      else if (line.t) GT.audio.key();
      setTimeout(step, line.d || 120);      // <- aca se encadena la siguiente
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
      '  -50   clasificar mal un correo   -' + GT.CONFIG.HINT_COST + '  usar una pista\n\n' +
      'VELOCIDAD Y RACHAS\n' +
      '  Responder rápido paga: hasta el doble si contestás enseguida.\n' +
      '  Cada 3 aciertos seguidos el multiplicador sube (x1.5, x2... x3).\n' +
      '  Un error corta la racha y vuelve a x1.\n' +
      '  3 seguidos: ESCUDO, el daño entra a la mitad por 20 s.\n' +
      '  5 seguidos: TIEMPO EXTRA, +15 s de reloj.\n';

    GT.ui.openWindow({
      id: 'manual', title: 'Manual de supervivencia', icon: GT.ui.icons.book,
      width: 560, height: 420, body: el
    });
  }

  /* ============================================================
     Inicio de partida
     ============================================================ */
  /* PUNTO DE ENTRADA de una partida. Todo lo que sigue depende de que este
     orden se respete: primero freno lo viejo, despues reseteo, despues arranco.
     Si arrancara sin frenar el loop anterior tendria DOS loops corriendo, el
     tiempo avanzaria al doble y los pop-ups saldrian de a pares. */
  game.start = function (mode) {
    stopLoop();

    /* Normalizo el modo: cualquier cosa que no sea exactamente 'tecnico' cae
       en 'virus'. Nunca confio en el string que me llega del dataset del HTML. */
    mode = (mode === 'tecnico') ? 'tecnico' : 'virus';

    GT.resetState();
    GT.state.mode = mode;
    GT.state.fsRoot = GT.fs.create();
    GT.state.running = true;

    /* Cada modulo sabe como limpiarse a si mismo; yo solo les aviso. Este es
       el beneficio de haber separado todo en modulos con la misma interfaz
       (reset / start / tick / stop): agregar una mecanica nueva manana es
       agregar una linea mas a esta lista, y nada mas. */
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
  /* EL CORAZON DEL JUEGO: el game loop.

     Uso requestAnimationFrame y no setInterval porque rAF lo maneja el
     navegador: lo sincroniza con el refresco de la pantalla (~60 veces por
     segundo) y lo PAUSA solo cuando la pestana no esta visible. setInterval
     seguiria disparando en segundo plano y acumularia trabajo atrasado. */
  function startLoop() {
    lastTs = performance.now();
    loopId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (loopId) cancelAnimationFrame(loopId);
    loopId = null;
  }

  function frame(ts) {
    /* dt = "delta time": cuantos SEGUNDOS pasaron desde el frame anterior.
       Todo el juego se mueve en funcion del tiempo real y no de los frames,
       asi el ritmo es el mismo en una maquina de 144Hz que en una de 30fps
       (el que va a 144 recibe dt chiquitos y muchos; el otro, pocos y grandes,
       pero el total del segundo es el mismo).

       El Math.min(0.25, ...) es un "tope de seguridad": si el jugador se va a
       otra pestana 5 minutos, rAF se pausa y al volver el primer dt valdria
       300 segundos de golpe. Sin el tope, en UN frame se le drenaria toda la
       integridad y perderia sin tocar nada. Con el tope, lo peor que puede
       pasar es un salto de un cuarto de segundo. */
    var dt = Math.min(0.25, (ts - lastTs) / 1000);
    lastTs = ts;

    if (GT.state.running && !GT.state.finished) {
      GT.state.elapsed += dt;
      GT.tickShield(dt);

      /* Cada modulo tiene su tick(dt) y se ocupa de lo suyo: yo desde aca no
         se ni me importa que hace adentro. El loop solo reparte el tiempo. */
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

    /* Me re-agendo SIEMPRE, aunque la partida este frenada: asi el loop sigue
       vivo y listo para cuando se reanude. Quien lo corta de verdad es
       stopLoop() con cancelAnimationFrame. */
    loopId = requestAnimationFrame(frame);
  }

  /* ============================================================
     HUD
     ============================================================ */
  /* Refresca la barra superior. La llamo desde dos lados: desde el loop (60
     veces por segundo) y por el bus de eventos cuando algo cambia de golpe
     (ver el GT.on('hud', ...) de mas abajo). Es barato porque solo toca texto
     y anchos en %, no reconstruye nodos del DOM. */
  function updateHud() {
    var s = GT.state;
    // En modo taller el HUD es otro; lo dibuja tech.js y me borro de aca
    if (s.mode === 'tecnico') { GT.tech.tick(0); return; }

    var def = GT.levels.DEFS[s.level];

    document.getElementById('hud-level').textContent = 'NIVEL ' + s.level + ' / 4';
    document.getElementById('hud-levelname').textContent = def ? def.name : '—';

    var integ = Math.max(0, Math.round(s.integrity));
    var barI = document.getElementById('bar-integrity');
    barI.style.width = integ + '%';
    /* El color de la barra lo decide el CSS, yo solo le pongo la clase:
       <=25 critico, <=55 advertencia, si no normal. Uso classList.toggle y no
       className = '...' porque esto corre 60 veces por segundo y pisaria la
       clase de la animacion de golpe (ver pulseLifeBar) antes de que se vea. */
    barI.parentNode.classList.toggle('crit', integ <= 25);
    barI.parentNode.classList.toggle('warn', integ > 25 && integ <= 55);
    document.getElementById('hud').classList.toggle('critical', integ <= 25);
    document.getElementById('val-integrity').textContent = integ + '%';

    var inf = GT.getInfection();
    document.getElementById('bar-infection').style.width = inf + '%';
    document.getElementById('val-infection').textContent = inf + '%';

    document.getElementById('val-score').textContent = s.score;
    document.getElementById('val-time').textContent = GT.formatTime(s.elapsed);
    document.getElementById('val-popups').textContent = GT.popups.count();

    /* Racha: la barrita muestra cuanto falta para el proximo multiplicador
       (1 de 3, 2 de 3...). Ya en el tope, queda llena. */
    var step = GT.CONFIG.STREAK_STEP;
    var mult = GT.getMultiplier();
    var toNext = (mult >= GT.CONFIG.STREAK_MULT_MAX) ? step : s.streak % step;
    document.getElementById('bar-streak').style.width = Math.round(toNext / step * 100) + '%';
    document.getElementById('val-streak').textContent = 'x' + mult;
    document.getElementById('hud').classList.toggle('shielded', s.shieldLeft > 0);

    GT.ui.setGlitch(Math.min(1, inf / 100));
  }

  /* Me suscribo al bus: cualquier modulo que llame a GT.emit('hud') hace que
     el HUD se refresque al instante, sin tener que conocerme ni importarme. */
  GT.on('hud', updateHud);

  /* Animacion de la barra de vida del jugador (la del HUD, la de reputacion
     del taller o la de adentro de la ventana del jefe, la que este a la
     vista). Solo para golpes de verdad: el drenaje de los pop-ups y del
     teclado secuestrado llama a GT.damage en cada frame con valores de
     centesimas, y si animara esos la barra temblaria sin parar. */
  function pulseLifeBar(kind) {
    ['bar-integrity', 'tech-bar-rep', 'boss-you-bar'].forEach(function (id) {
      var bar = document.getElementById(id);
      if (!bar) return;
      var box = bar.parentNode;
      box.classList.remove('hit', 'healed');
      void box.offsetWidth;
      box.classList.add(kind);
    });
  }

  GT.on('damage', function (e) { if (e.amount >= 2) pulseLifeBar('hit'); });
  GT.on('heal', function () { pulseLifeBar('healed'); });

  /* Avisos de la racha. Solo aviso cuando cambia algo que al jugador le
     conviene saber (sube el multiplicador, gana un premio, pierde una racha
     larga): si avisara cada acierto taparia los toasts de los otros modulos. */
  GT.on('streak', function (e) {
    var step = GT.CONFIG.STREAK_STEP;
    if (e.streak === 0) {
      if (e.lost >= step) GT.ui.toast('Se cortó la racha de ' + e.lost + ' aciertos. Multiplicador x1', 'warn');
      return;
    }
    if (e.streak % step === 0) {
      GT.ui.toast('RACHA DE ' + e.streak + ' · multiplicador x' + e.mult, 'streak');
      GT.audio.levelUp();
    } else if (e.speed >= 1.6) {
      GT.ui.toast('Respuesta rápida: +' + e.points + ' puntos', 'streak');
    }
  });

  GT.on('bonus', function (b) {
    if (b.kind === 'shield') GT.ui.toast('ESCUDO: el daño entra a la mitad por ' + b.seconds + ' s', 'streak');
    if (b.kind === 'shield-end') GT.ui.toast('Se terminó el escudo', 'info');
    if (b.kind === 'time') GT.ui.toast('TIEMPO EXTRA: +' + b.seconds + ' s', 'streak');
    GT.emit('hud');
  });

  /* ============================================================
     Final de partida
     ============================================================ */
  /* Arma el resumen final. Separo el calculo del dibujado a proposito: esta
     funcion no toca el DOM, solo devuelve numeros, asi la puedo reusar para
     mandarsela a la API (partida_end.php) y para pintar la pantalla.

     La formula de los bonus:
       timeBonus      = 600 menos 1.2 puntos por segundo jugado. O sea: a los
                        500 segundos (8 min) el bonus ya es cero. El Math.max
                        evita que quede NEGATIVO y te descuente por tardar.
       integrityBonus = la integridad que te quedo x6. Terminar con 80% da
                        480 puntos: premia jugar prolijo, no solo rapido.
     Los dos bonus son cero si perdiste ("won ? ... : 0"): solo se premia al
     que llega al final. */
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
      bestStreak: s.bestStreak,
      /* .slice() sin argumentos = copia del array. Devuelvo una COPIA y no el
         array original para que el que reciba el resumen no pueda modificar
         por accidente el estado del juego. */
      learned: s.learned.slice()
    };
  }

  /* DERROTA. Se dispara desde GT.damage() cuando la integridad toca 0, pero
     cualquiera puede emitirlo (el reloj del jefe final, por ejemplo).

     El "if (finished) return" es un candado de reentrada: si dos cosas me
     matan en el mismo frame (un pop-up drenando + el teclado secuestrado),
     el evento llega dos veces y sin este corte mostraria el BSOD dos veces y
     guardaria la partida repetida en la base. */
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

    document.querySelector('#screen-win .win-title').textContent =
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
      row('Mejor racha', sum.bestStreak) +
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
  /* DELEGACION DE EVENTOS: en vez de ponerle un addEventListener a cada boton
     del menu, pongo UN solo listener en todo el document y despues pregunto
     quien fue el que recibio el click. Ventajas: un listener en lugar de
     quince, y funciona tambien con botones que todavia no existen cuando corre
     este codigo (los que creo despues por JS).

     e.target es el nodo exacto que se clickeo (puede ser el <span> de adentro
     del boton); .closest('[data-action]') sube por los padres hasta encontrar
     el elemento que tiene ese atributo. Si no encuentra nada, devuelve null y
     significa que el click fue en cualquier otro lado: me voy. */
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

    /* ACCESIBILIDAD: las tarjetas de seleccion de modo son <div>, no <button>,
       asi que el navegador NO les da el comportamiento de teclado gratis. Un
       boton de verdad se activa con Enter y con Espacio; aca lo replico a mano
       para que se pueda jugar sin mouse. El preventDefault es para que la
       barra espaciadora no scrollee la pagina. */
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

  /* Frenada de emergencia: la llamo cuando el jugador se va al menu o
     reinicia en el medio de una partida. Es distinto de 'gameover': aca no
     hay pantalla de derrota ni se guarda nada, solo apago todo lo que estaba
     corriendo (timers, procesos, el hacker) para que no quede nada zombi
     molestando en la partida siguiente. */
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
  /* DOMContentLoaded = "el HTML ya esta parseado y puedo tocar el DOM".
     Si corriera esto antes, todos los getElementById devolverian null porque
     los elementos todavia no existen. No uso window.onload porque ese espera
     ademas a imagenes y fuentes: tardaria de mas sin necesidad. */
  document.addEventListener('DOMContentLoaded', function () {
    GT.ui.init();
    GT.hacker.init();
    bindMenus();
    if (GT.engine && GT.engine.startCrt) GT.engine.startCrt();
    GT.ui.setScreen('screen-title');
  });

})(window, document);
