/* ============================================================
   Glitch.TEC — Pop-ups del malware
   Obstaculo constante: aparecen solos, tapan la pantalla y drenan
   integridad mientras esten abiertos. Cada uno ofrece un boton
   "trampa" (aceptar) y una salida segura (rechazar / cerrar).
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var pop = GT.popups = {};

  var running = false;     // ¿estoy generando pop-ups? (nivel 1 en adelante)
  var timer = 0;           // acumulador de segundos hasta el proximo pop-up
  var openList = [];       // los que estan abiertos AHORA: [{ el, tpl }, ...]
  var seq = 0;             // contador para el z-index (el ultimo tocado va arriba)

  var TEMPLATES = [
    {
      title: 'Advertencia de seguridad',
      head: '¡Tu PC está infectada con 47 virus!',
      text: 'Nuestro escáner detectó amenazas críticas. Instalá WinTEC Cleaner Pro para eliminarlas ahora.',
      bait: 'Limpiar ahora', safe: 'Cancelar',
      lesson: 'Ningún antivirus real te avisa desde una ventana emergente del navegador.'
    },
    {
      title: 'Felicitaciones',
      head: 'Sos el visitante 1.000.000',
      text: 'Ganaste un teléfono de última generación. Ingresá tus datos para coordinar la entrega.',
      bait: 'Reclamar premio', safe: 'No, gracias',
      lesson: 'Si no participaste de nada, no ganaste nada. Es un cebo para robar datos.'
    },
    {
      title: 'Actualización requerida',
      head: 'Tu reproductor está desactualizado',
      text: 'Se requiere Flash Player 11.2 para ver este contenido. Descargá el instalador.',
      bait: 'Descargar (2.1 MB)', safe: 'Ahora no',
      lesson: 'Las actualizaciones reales se instalan desde el programa o el sistema, nunca desde un pop-up.'
    },
    {
      title: 'Licencia de Windows',
      head: 'Tu copia de WinTEC no es original',
      text: 'Activá tu licencia en los próximos 5 minutos o el equipo se bloqueará.',
      bait: 'Activar ahora', safe: 'Cerrar',
      lesson: 'La urgencia extrema es la señal más común de una estafa.'
    },
    {
      title: 'Optimizador del sistema',
      head: 'Tu PC está 300% más lenta',
      text: 'Detectamos 1.482 errores en el registro. Reparalos con un solo click.',
      bait: 'Acelerar PC', safe: 'Cancelar',
      lesson: 'Los "limpiadores de registro" gratuitos suelen ser el malware, no la cura.'
    },
    {
      title: 'error_desconocido.exe',
      head: 'no cierres esto',
      text: 'me estás molestando, estudiante. cada ventana que cerrás me cuesta trabajo. dejala abierta.',
      bait: 'Está bien', safe: 'Cerrar igual',
      evil: true,
      lesson: 'Si un programa te ruega que no lo cierres, cerralo.'
    }
  ];

  /* ============================================================
     Control
     ============================================================ */
  pop.start = function () { running = true; timer = 0; };
  pop.stop  = function () { running = false; };

  pop.count = function () { return openList.length; };

  pop.clearAll = function () {
    openList.slice().forEach(function (p) { removePopup(p, false); });
    openList = [];
    GT.emit('hud');
  };

  pop.reset = function () {
    pop.clearAll();
    running = false;
    timer = 0;
    seq = 0;
  };

  /** Intervalo entre pop-ups: baja a medida que sube la infeccion.
      Esta funcioncita es la que hace que el juego se ponga cada vez mas
      agobiante sin que yo tenga que scriptear nada:

        base = 17 - (inf/100)*9   con 0% de infeccion sale un pop-up cada 17s,
                                  con 100% cada 8s.
        lvl  = 1.2s menos por cada nivel superado (el -1 es porque el nivel 1
               todavia no tiene que descontar nada).
        Math.max(6, ...) es el piso: nunca menos de 6 segundos, porque abajo de
        eso el juego deja de ser dificil y pasa a ser injugable.

      Es un BUCLE DE REALIMENTACION: mas pop-ups abiertos -> mas dano -> mas
      infeccion -> aparecen mas seguido. Por eso el piso no es opcional. */
  function interval() {
    var inf = GT.getInfection();
    var base = 17 - (inf / 100) * 9;             // de 17s a 8s
    var lvl = Math.max(0, GT.state.level - 1) * 1.2;
    return Math.max(6, base - lvl);
  }

  pop.tick = function (dt) {
    if (!running || GT.state.finished) return;

    /* Dano por segundo, multiplicado por la CANTIDAD de ventanas abiertas: dos
       pop-ups duelen el doble que uno. Multiplicar por dt es lo que hace que
       el dano sea por segundo real y no por frame (si fuera por frame, en una
       PC rapida perderias el triple de vida que en una lenta). */
    if (openList.length) {
      GT.damage(GT.CONFIG.POPUP_DRAIN_PER_SEC * openList.length * dt, 'pop-ups abiertos');
    }

    /* Acumulador de tiempo: sumo los dt hasta pasar el umbral, disparo y
       vuelvo a cero. Es un "temporizador" hecho a mano, mas controlable que
       un setInterval porque se frena solo cuando el juego se frena. */
    timer += dt;
    if (timer >= interval()) {
      timer = 0;
      if (openList.length < GT.CONFIG.POPUP_MAX_ON_SCREEN) pop.spawn();
    }
  };

  /* ============================================================
     Creacion
     ============================================================ */
  pop.spawn = function (templateIndex) {
    var t = (templateIndex !== undefined) ? TEMPLATES[templateIndex] : GT.pick(TEMPLATES);
    var layer = document.getElementById('popup-layer');
    if (!layer) return;

    var el = document.createElement('div');
    el.className = 'popup' + (t.evil ? ' leaking' : '');

    /* Posicion al azar, pero descontando el tamano del pop-up (330x220) para
       que no nazca mitad afuera de la pantalla. El Math.max(10, ...) cubre el
       caso de una ventana del navegador chiquita, donde esa resta podria dar
       negativo y romper el rand. */
    var maxX = Math.max(10, layer.clientWidth - 330);
    var maxY = Math.max(10, layer.clientHeight - 220);
    el.style.left = GT.rand(20, maxX) + 'px';
    el.style.top = GT.rand(20, maxY) + 'px';
    el.style.zIndex = 320 + (seq++);         // el mas nuevo, arriba de todo

    el.innerHTML =
      '<div class="popup-bar"><span>' + GT.escapeHtml(t.title) + '</span>' +
        '<button class="popup-x" title="Cerrar">X</button></div>' +
      '<div class="popup-body">' +
        '<div class="popup-ico">' + (t.evil ? '☠' : '!') + '</div>' +
        '<div class="popup-txt"><b>' + GT.escapeHtml(t.head) + '</b>' +
          GT.escapeHtml(t.text) + '</div>' +
      '</div>' +
      '<div class="popup-foot">' +
        '<button class="xp-btn" data-p="bait">' + GT.escapeHtml(t.bait) + '</button>' +
        '<button class="xp-btn" data-p="safe">' + GT.escapeHtml(t.safe) + '</button>' +
      '</div>';

    layer.appendChild(el);

    /* "entry" ata el nodo del DOM con la plantilla que lo genero. Guardo ese
       par en la lista para despues poder, desde el nodo, llegar a la leccion
       educativa sin tener que volver a buscar cual plantilla era. */
    var entry = { el: el, tpl: t };
    openList.push(entry);

    /* Los tres botones cierran la ventana, pero NO son lo mismo:
         X y "safe"  -> dismiss   (+10 puntos: hiciste lo correcto)
         "bait"      -> takeBait  (-40 y dano: picaste)
       Cada callback se queda con SU entry por clausura, asi que aunque haya
       seis pop-ups en pantalla cada boton sabe exactamente cual cerrar. */
    el.querySelector('.popup-x').addEventListener('click', function () { dismiss(entry); });
    el.querySelector('[data-p="safe"]').addEventListener('click', function () { dismiss(entry); });
    el.querySelector('[data-p="bait"]').addEventListener('click', function () { takeBait(entry); });

    // Traer al frente al hacer click
    el.addEventListener('mousedown', function () { el.style.zIndex = 320 + (seq++); });
    dragPopup(el, el.querySelector('.popup-bar'), layer);

    GT.audio.popup();
    GT.state.popupsSpawned++;
    GT.emit('hud');
  };

  function dismiss(entry) {
    removePopup(entry, true);
    GT.addScore(10, 'pop-up cerrado');
    GT.audio.close();
    if (entry.tpl.lesson && Math.random() < 0.55) {
      GT.ui.toast(entry.tpl.lesson, 'info');
    }
    GT.learn(entry.tpl.lesson);
    GT.state.popupsClosed++;
    GT.emit('hud');
  }

  /* El jugador apreto el boton trampa. Esta es la parte mas "educativa" del
     modulo: el castigo no es solo mecanico (dano y puntos), tambien le muestro
     POR QUE estaba mal, y encima aparece otro pop-up 700ms despues. Eso imita
     el comportamiento real del adware: aceptar uno te trae mas. */
  function takeBait(entry) {
    removePopup(entry, true);
    GT.state.mistakes++;
    GT.damage(10, 'aceptaste un pop-up del malware');
    GT.addScore(-40, 'aceptaste un pop-up');
    GT.audio.hurt();
    GT.ui.shake();
    GT.ui.flash('hit');
    GT.ui.toast('✘ ' + entry.tpl.lesson, 'bad');
    GT.terminal.notify('[GLITCH] Hiciste click. Siempre hacen click.', 'evil');

    // Aceptar la trampa invoca mas ventanas
    setTimeout(function () { if (running) pop.spawn(); }, 700);
    GT.emit('hud');
  }

  /* Sacar un pop-up son SIEMPRE dos pasos y hay que hacer los dos:
       1. sacarlo de openList (mi lista logica) -> deja de drenar integridad;
       2. sacar el nodo del DOM               -> deja de verse.
     Si me olvidara del 1, el jugador seguiria perdiendo vida por una ventana
     que ya cerro. Si me olvidara del 2, quedaria una ventana fantasma clickeable.
     indexOf + splice es la forma clasica de borrar por valor en un array. */
  function removePopup(entry, animate) {
    var i = openList.indexOf(entry);
    if (i !== -1) openList.splice(i, 1);
    if (entry.el && entry.el.parentNode) entry.el.parentNode.removeChild(entry.el);
    GT.emit('hud');
  }

  function dragPopup(el, handle, bounds) {
    var dragging = false, offX = 0, offY = 0;
    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;
      dragging = true;
      offX = e.clientX - el.offsetLeft;
      offY = e.clientY - el.offsetTop;
      e.preventDefault();
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      el.style.left = Math.max(0, Math.min(e.clientX - offX, bounds.clientWidth - 60)) + 'px';
      el.style.top = Math.max(0, Math.min(e.clientY - offY, bounds.clientHeight - 30)) + 'px';
    });
    document.addEventListener('mouseup', function () { dragging = false; });
  }

  /** Rafaga de pop-ups (la usa el jefe final cuando fallas).
      Los escalono de a 220ms para que "lluevan" en vez de aparecer todos
      juntos de golpe: se siente mucho peor, que es la idea.

      El (function (d) { ... })(i) de adentro del for es el patron clasico para
      CAPTURAR el valor de i. Con "var", la variable del for es una sola y
      compartida: para cuando los setTimeout se ejecuten, i ya vale n en todos,
      y los tres pop-ups saldrian a la vez. Al pasar i como argumento de una
      funcion, cada vuelta se queda con su propia copia (d). Con "let" en vez
      de "var" esto no haria falta, pero mantengo var en todo el proyecto para
      que ande en navegadores viejos. */
  pop.burst = function (n) {
    for (var i = 0; i < n; i++) {
      (function (d) { setTimeout(function () { pop.spawn(); }, d * 220); })(i);
    }
  };

})(window, document);
