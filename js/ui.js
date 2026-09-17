/* ============================================================
   Glitch.TEC — capa de interfaz
   Gestor de ventanas (arrastrables, foco, minimizar, cerrar),
   iconos del escritorio, barra de tareas, avisos y dialogos.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var ui = GT.ui = {};

  /* EL REGISTRO DE VENTANAS. Es la pieza central de todo este archivo:
     un objeto que mapea  id -> { el, body, bar, taskBtn, onClose, ... }.
     Tenerlas indexadas por id me deja preguntar "¿ya esta abierta la
     terminal?" en O(1) (windows['terminal']) en vez de andar buscando en el
     DOM con querySelector. */
  var windows = {};
  /* zTop: el z-index mas alto entregado hasta ahora. Cada vez que enfoco una
     ventana le doy ++zTop, asi queda arriba de todas sin tener que reordenar
     nada. Crece para siempre, pero un entero no se agota nunca en una partida. */
  var zTop = 100;
  /* cascade: contador para que las ventanas nuevas no se apilen exactamente
     una encima de otra. Va de 0 a 5 y vuelve a empezar (modulo 6). */
  var cascade = 0;

  /* ============================================================
     Iconos (SVG inline, sin archivos externos)
     ============================================================ */
  ui.icons = {
    terminal:
      '<svg viewBox="0 0 32 32"><rect x="1.5" y="3.5" width="29" height="25" rx="2" fill="#0b1712" stroke="#3a5c4c"/>' +
      '<rect x="1.5" y="3.5" width="29" height="5" fill="#1d3129" stroke="#3a5c4c"/>' +
      '<text x="6" y="21" font-family="monospace" font-size="11" fill="#35ff7a">&gt;_</text></svg>',

    folder:
      '<svg viewBox="0 0 32 32"><path d="M2 8a2 2 0 012-2h8l3 3h13a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2z" fill="#f2c14e" stroke="#a97d16"/>' +
      '<path d="M2 12h28v12a2 2 0 01-2 2H4a2 2 0 01-2-2z" fill="#ffd977" stroke="#a97d16"/></svg>',

    folderLock:
      '<svg viewBox="0 0 32 32"><path d="M2 8a2 2 0 012-2h8l3 3h13a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2z" fill="#c9b municipal" /></svg>',

    taskmgr:
      '<svg viewBox="0 0 32 32"><rect x="2.5" y="4.5" width="27" height="23" rx="2" fill="#e8eef5" stroke="#5b6b7c"/>' +
      '<rect x="2.5" y="4.5" width="27" height="4" fill="#5b8fd6" stroke="#5b6b7c"/>' +
      '<rect x="6" y="18" width="4" height="6" fill="#2f9c52"/><rect x="12" y="14" width="4" height="10" fill="#2f9c52"/>' +
      '<rect x="18" y="11" width="4" height="13" fill="#d6a029"/><rect x="24" y="17" width="3" height="7" fill="#d6293e"/></svg>',

    mail:
      '<svg viewBox="0 0 32 32"><rect x="2.5" y="7.5" width="27" height="18" rx="2" fill="#fff" stroke="#5b6b7c"/>' +
      '<path d="M3 9l13 9 13-9" fill="none" stroke="#5b8fd6" stroke-width="2"/>' +
      '<path d="M3 25l9-8M29 25l-9-8" fill="none" stroke="#b8c4d0"/></svg>',

    doc:
      '<svg viewBox="0 0 32 32"><path d="M7 3h13l6 6v20H7z" fill="#fff" stroke="#7a8592"/>' +
      '<path d="M20 3v6h6" fill="#dde5ee" stroke="#7a8592"/>' +
      '<path d="M11 14h12M11 18h12M11 22h8" stroke="#8aa0b5" stroke-width="1.4"/></svg>',

    exe:
      '<svg viewBox="0 0 32 32"><rect x="4.5" y="4.5" width="23" height="23" rx="2" fill="#3b4a5a" stroke="#1e2a36"/>' +
      '<rect x="7" y="7" width="18" height="6" fill="#5b8fd6"/>' +
      '<text x="8" y="24" font-family="monospace" font-size="9" fill="#ffd24d">EXE</text></svg>',

    danger:
      '<svg viewBox="0 0 32 32"><path d="M16 3l14 25H2z" fill="#ffd24d" stroke="#b5121b" stroke-width="1.6"/>' +
      '<path d="M16 12v8" stroke="#7a0c12" stroke-width="2.6" stroke-linecap="round"/>' +
      '<circle cx="16" cy="24" r="1.5" fill="#7a0c12"/></svg>',

    book:
      '<svg viewBox="0 0 32 32"><path d="M4 5h10a3 3 0 013 3v20a3 3 0 00-3-3H4z" fill="#4a90d9" stroke="#245e96"/>' +
      '<path d="M28 5H18a3 3 0 00-3 3v20a3 3 0 013-3h10z" fill="#6fb0ef" stroke="#245e96"/></svg>',

    trash:
      '<svg viewBox="0 0 32 32"><path d="M8 10h16l-1.6 18a2 2 0 01-2 1.8H11.6a2 2 0 01-2-1.8z" fill="#b8c4d0" stroke="#5b6b7c"/>' +
      '<rect x="6" y="6" width="20" height="4" rx="1" fill="#8fa0b0" stroke="#5b6b7c"/>' +
      '<path d="M13 14v11M19 14v11" stroke="#5b6b7c" stroke-width="1.4"/></svg>',

    shield:
      '<svg viewBox="0 0 32 32"><path d="M16 3l11 4v10c0 7-4.6 11.4-11 13-6.4-1.6-11-6-11-13V7z" fill="#2f9c52" stroke="#14562a"/>' +
      '<path d="M10 16l4.4 4.4L23 12" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',

    skull:
      '<svg viewBox="0 0 32 32"><path d="M16 3C9.4 3 4 8 4 14.4c0 3.8 1.9 6.6 4.4 8.3V27h15.2v-4.3c2.5-1.7 4.4-4.5 4.4-8.3C28 8 22.6 3 16 3z" fill="#e6ebf0" stroke="#3a4652"/>' +
      '<circle cx="11.4" cy="15" r="3.1" fill="#1a222b"/><circle cx="20.6" cy="15" r="3.1" fill="#1a222b"/>' +
      '<path d="M16 19l-1.6 3h3.2z" fill="#1a222b"/></svg>'
  };

  ui.icons.folderLock =
    '<svg viewBox="0 0 32 32"><path d="M2 8a2 2 0 012-2h8l3 3h13a2 2 0 012 2v14a2 2 0 01-2 2H4a2 2 0 01-2-2z" fill="#c9bda0" stroke="#7d7458"/>' +
    '<path d="M2 12h28v12a2 2 0 01-2 2H4a2 2 0 01-2-2z" fill="#ded4b8" stroke="#7d7458"/>' +
    '<rect x="12" y="17" width="9" height="7" rx="1" fill="#5b6b7c" stroke="#333d47"/>' +
    '<path d="M14 17v-2.2a2.5 2.5 0 015 0V17" fill="none" stroke="#333d47" stroke-width="1.6"/></svg>';

  /* ============================================================
     Pantallas
     ============================================================ */
  /* Navegacion entre pantallas (menu, boot, escritorio, taller, victoria...).
     Estan TODAS en el index.html al mismo tiempo; la que se ve es la que tiene
     la clase is-active, el resto las esconde el CSS. Cambiar de pantalla es
     entonces sacarle la clase a todas y ponersela a una: no recargo nada, no
     pierdo estado y la transicion la anima el CSS. */
  ui.setScreen = function (id) {
    var all = document.querySelectorAll('.screen');
    for (var i = 0; i < all.length; i++) all[i].classList.remove('is-active');
    var el = document.getElementById(id);
    if (el) el.classList.add('is-active');
  };

  /* ============================================================
     Avisos flotantes (toasts)
     ============================================================ */
  ui.toast = function (message, type) {
    var layer = document.getElementById('toast-layer');
    if (!layer) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    layer.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2700);
  };

  /* ============================================================
     Efectos de pantalla
     ============================================================ */
  var crt = null;
  function getCrt() { return crt || (crt = document.getElementById('crt')); }

  /* TRUCO IMPORTANTE (lo repito en varios lados del proyecto, conviene que lo
     entienda bien): para re-disparar una animacion CSS no alcanza con sacar y
     volver a poner la clase en la misma linea, porque el navegador agrupa los
     cambios y al final ve que la clase sigue puesta -> no reinicia nada.
     Leer una propiedad de layout como offsetWidth lo obliga a recalcular el
     estilo AHORA (se llama "reflow forzado"), y ahi si registra que la clase
     estuvo ausente un instante. El "void" es solo para dejar claro que leo la
     propiedad por su efecto y tiro el valor. */
  ui.shake = function () {
    var c = getCrt();
    c.classList.remove('shake');
    void c.offsetWidth;                    // fuerza reinicio de la animacion
    c.classList.add('shake');
    setTimeout(function () { c.classList.remove('shake'); }, 360);
  };

  ui.flash = function (kind) {
    var f = document.getElementById('flash');
    f.className = '';
    void f.offsetWidth;
    f.className = kind || 'hit';
    setTimeout(function () { f.className = ''; }, 320);
  };

  /* Puente JS -> CSS: en vez de tocar diez propiedades desde JavaScript,
     escribo UNA variable CSS (--glitch) y el archivo .css se encarga de todo
     lo demas (opacidad de la estatica, intensidad del temblor, etc.).
     Asi el efecto visual se ajusta en el CSS, que es donde corresponde, y
     desde el JS solo mando un numero de 0 a 1. */
  ui.setGlitch = function (level0to1) {
    var c = getCrt();
    c.style.setProperty('--glitch', level0to1.toFixed(2));
    c.classList.toggle('corrupt', level0to1 > 0.45);
    var desk = document.getElementById('desktop');
    if (desk) desk.style.setProperty('--corrupt', (level0to1 * 0.42).toFixed(2));
  };

  /* ============================================================
     Gestor de ventanas
     ============================================================ */
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* Enfocar = apagar visualmente a todas y prender esta, mas subirla al tope
     del z-index. Recorro TODAS en lugar de acordarme de cual estaba activa
     antes: son 5 o 6 ventanas como mucho, y asi no puedo quedar en un estado
     inconsistente con dos barras de titulo en azul. */
  ui.focusWindow = function (id) {
    var w = windows[id];
    if (!w) return;
    Object.keys(windows).forEach(function (k) {
      windows[k].el.classList.add('inactive');
      var tb = windows[k].taskBtn;
      if (tb) tb.classList.remove('active');
    });
    w.el.classList.remove('inactive', 'minimized');
    w.el.style.zIndex = ++zTop;
    if (w.taskBtn) w.taskBtn.classList.add('active');
    if (typeof w.onFocus === 'function') w.onFocus();
  };

  ui.getWindow = function (id) { return windows[id]; };
  ui.isOpen = function (id) { return !!windows[id]; };

  ui.closeWindow = function (id) {
    var w = windows[id];
    if (!w) return;
    /* Le doy derecho a veto al que creo la ventana: si su onClose devuelve
       exactamente false, cancelo el cierre. Lo uso para ventanas de las que no
       se puede escapar (el jefe final). Comparo con === false para que una
       funcion que no devuelve nada (undefined) NO cuente como veto. */
    if (typeof w.onClose === 'function' && w.onClose() === false) return;
    if (w.el.parentNode) w.el.parentNode.removeChild(w.el);
    if (w.taskBtn && w.taskBtn.parentNode) w.taskBtn.parentNode.removeChild(w.taskBtn);
    delete windows[id];
    GT.audio.close();
  };

  /**
   * Crea (o enfoca, si ya existe) una ventana del escritorio.
   * opts: { id, title, icon, width, height, x, y, body, noClose, onClose, onFocus }
   * `body` puede ser un HTMLElement o un string de HTML.
   */
  ui.openWindow = function (opts) {
    if (windows[opts.id]) {
      ui.focusWindow(opts.id);
      return windows[opts.id];
    }

    var layer = document.getElementById('window-layer');
    var deskW = layer.clientWidth;
    var deskH = layer.clientHeight;

    var w = Math.min(opts.width || 560, deskW - 20);
    var h = Math.min(opts.height || 380, deskH - 20);

    /* Posicion: si el que abre la ventana no me dice donde, la centro y le
       sumo un desplazamiento en cascada (26px a la derecha y 24 abajo por cada
       ventana nueva) para que no queden perfectamente superpuestas, igual que
       Windows. El clamp la mantiene siempre dentro del escritorio.
       El "% 6" hace que la cascada vuelva a empezar cada 6 ventanas y no se
       me escape para abajo infinitamente. */
    var x = opts.x;
    var y = opts.y;
    if (x === undefined) x = clamp(Math.round((deskW - w) / 2) - 90 + cascade * 26, 8, deskW - w - 8);
    if (y === undefined) y = clamp(30 + cascade * 24, 8, Math.max(8, deskH - h - 8));
    cascade = (cascade + 1) % 6;

    var el = document.createElement('div');
    el.className = 'win' + (opts.className ? ' ' + opts.className : '');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    var iconSvg = opts.icon || ui.icons.doc;

    var bar = document.createElement('div');
    bar.className = 'win-bar';
    bar.innerHTML =
      iconSvg +
      '<div class="win-title">' + GT.escapeHtml(opts.title || 'Ventana') + '</div>' +
      '<div class="win-btns">' +
        '<button class="wb-min" title="Minimizar">_</button>' +
        (opts.noClose ? '' : '<button class="wb-close" title="Cerrar">X</button>') +
      '</div>';

    /* El contenido puede venir de dos formas y acepto las dos:
         - un nodo del DOM ya armado (lo mas comun: asi el modulo que lo creo
           se queda con la referencia y puede seguir actualizandolo);
         - un string de HTML, para contenidos simples y fijos.
       instanceof HTMLElement es la forma de distinguirlas. */
    var body = document.createElement('div');
    body.className = 'win-body';
    if (opts.body instanceof window.HTMLElement) body.appendChild(opts.body);
    else if (typeof opts.body === 'string') body.innerHTML = opts.body;

    el.appendChild(bar);
    el.appendChild(body);
    layer.appendChild(el);

    var winObj = {
      id: opts.id,
      el: el,
      body: body,
      bar: bar,
      onClose: opts.onClose,
      onFocus: opts.onFocus,
      setTitle: function (t) { bar.querySelector('.win-title').textContent = t; }
    };
    windows[opts.id] = winObj;

    /* --- Boton en la barra de tareas --- */
    var taskBtn = document.createElement('button');
    taskBtn.className = 'task-btn';
    taskBtn.innerHTML = iconSvg + '<i>' + GT.escapeHtml(opts.title || 'Ventana') + '</i>';
    taskBtn.addEventListener('click', function () {
      if (el.classList.contains('minimized') || el.classList.contains('inactive')) {
        el.classList.remove('minimized');
        ui.focusWindow(opts.id);
      } else {
        el.classList.add('minimized');
        taskBtn.classList.remove('active');
      }
    });
    document.getElementById('task-buttons').appendChild(taskBtn);
    winObj.taskBtn = taskBtn;

    /* --- Controles --- */
    bar.querySelector('.wb-min').addEventListener('click', function (e) {
      e.stopPropagation();
      el.classList.add('minimized');
      taskBtn.classList.remove('active');
      GT.audio.close();
    });
    var closeBtn = bar.querySelector('.wb-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        ui.closeWindow(opts.id);
      });
    }

    el.addEventListener('mousedown', function () { ui.focusWindow(opts.id); });

    /* --- Arrastre --- */
    makeDraggable(el, bar, layer);

    ui.focusWindow(opts.id);
    GT.audio.open();
    return winObj;
  };

  /* ARRASTRAR UNA VENTANA — el patron es siempre el mismo y conviene tenerlo
     claro porque lo repito en popups.js y en el panel del hacker:

       1. mousedown SOBRE LA BARRA: enciendo la bandera "dragging" y guardo el
          OFFSET, o sea en que parte de la barra agarre (distancia entre el
          mouse y la esquina de la ventana). Sin ese offset, la ventana saltaria
          poniendo su esquina superior izquierda bajo el cursor.
       2. mousemove EN EL DOCUMENT (no en la barra): la nueva posicion es
          mouse - offset. Va en el document porque si el mouse se adelanta a la
          ventana y sale de la barra, el evento se perderia y el arrastre se
          cortaria solo.
       3. mouseup EN EL DOCUMENT: apago la bandera. Tambien va en document por
          si el jugador suelta el boton fuera de la ventana (o fuera de la
          pagina). */
  function makeDraggable(el, handle, bounds) {
    var dragging = false, offX = 0, offY = 0;

    handle.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) return;   // no arrastrar desde minimizar/cerrar
      dragging = true;
      offX = e.clientX - el.offsetLeft;
      offY = e.clientY - el.offsetTop;
      /* preventDefault mata la seleccion de texto del navegador: sin esto,
         arrastrar la barra pinta de azul medio escritorio. */
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;                    // salida rapida: no estoy arrastrando
      /* Limites: dejo que la ventana se vaya bastante para afuera (hasta que
         solo queden 60px visibles) porque es comodo, pero nunca del todo:
         si se fuera entera, no habria barra de donde volver a agarrarla. */
      var maxX = bounds.clientWidth - 60;
      var maxY = bounds.clientHeight - 30;
      el.style.left = clamp(e.clientX - offX, -el.offsetWidth + 80, maxX) + 'px';
      el.style.top = clamp(e.clientY - offY, 0, maxY) + 'px';
    });

    document.addEventListener('mouseup', function () { dragging = false; });
  }

  ui.closeAllWindows = function () {
    Object.keys(windows).forEach(function (id) {
      var w = windows[id];
      if (w.el.parentNode) w.el.parentNode.removeChild(w.el);
      if (w.taskBtn && w.taskBtn.parentNode) w.taskBtn.parentNode.removeChild(w.taskBtn);
      delete windows[id];
    });
    cascade = 0;
  };

  /* ============================================================
     Iconos del escritorio
     ============================================================ */
  /* Los iconos NO estan escritos en el index.html: cada uno se registra desde
     JS con su etiqueta, su SVG y —clave— la funcion onOpen que hay que llamar
     al abrirlo. Como el escritorio se arma desde datos, agregar un programa
     nuevo es agregar un objeto a esta lista y nada mas. */
  var iconDefs = [];

  ui.registerIcon = function (def) {
    iconDefs.push(def);
    renderIcons();
  };

  ui.setIconLocked = function (id, locked) {
    for (var i = 0; i < iconDefs.length; i++) {
      if (iconDefs[i].id === id) iconDefs[i].locked = locked;
    }
    renderIcons();
    renderStartMenu();
  };

  ui.pulseIcon = function (id, on) {
    var el = document.querySelector('.desk-icon[data-id="' + id + '"]');
    if (el) el.classList.toggle('pulse', on !== false);
  };

  function renderIcons() {
    var layer = document.getElementById('icon-layer');
    if (!layer) return;
    layer.innerHTML = '';

    iconDefs.forEach(function (def) {
      var b = document.createElement('button');
      b.className = 'desk-icon' + (def.locked ? ' locked' : '');
      b.dataset.id = def.id;
      b.innerHTML = def.icon + '<span>' + GT.escapeHtml(def.label) + '</span>';

      b.addEventListener('click', function () {
        var sel = layer.querySelector('.desk-icon.selected');
        if (sel) sel.classList.remove('selected');
        b.classList.add('selected');
      });

      /* Doble click para abrir (como en Windows). "def" queda capturado en la
         CLAUSURA de esta funcion: aunque renderIcons ya haya terminado hace
         rato, cuando el jugador haga doble click dentro de dos minutos este
         callback va a seguir teniendo SU definicion, la correcta. */
      b.addEventListener('dblclick', function () {
        if (def.locked) {
          GT.audio.error();
          ui.toast('Acceso bloqueado: todavía no disponible', 'warn');
          return;
        }
        b.classList.remove('pulse');
        def.onOpen();
      });

      layer.appendChild(b);
    });

    renderStartMenu();
  }

  ui.refreshIcons = renderIcons;

  /* ============================================================
     Menu Inicio
     ============================================================ */
  function renderStartMenu() {
    var box = document.getElementById('sm-programs');
    if (!box) return;
    box.innerHTML = '';

    iconDefs.forEach(function (def) {
      var b = document.createElement('button');
      b.className = 'sm-item';
      b.disabled = !!def.locked;
      b.innerHTML = def.icon + '<span>' + GT.escapeHtml(def.label) +
                    (def.hint ? '<small>' + GT.escapeHtml(def.hint) + '</small>' : '') + '</span>';
      b.addEventListener('click', function () {
        ui.toggleStartMenu(false);
        def.onOpen();
      });
      box.appendChild(b);
    });
  }

  ui.toggleStartMenu = function (force) {
    var menu = document.getElementById('start-menu');
    var btn = document.getElementById('start-btn');
    var show = (force === undefined) ? menu.classList.contains('hidden') : force;
    menu.classList.toggle('hidden', !show);
    btn.classList.toggle('open', show);
    if (show) GT.audio.click();
  };

  /* ============================================================
     Dialogos narrativos (con efecto maquina de escribir)
     ============================================================ */
  /* DIALOGOS TIPO MAQUINA DE ESCRIBIR. El estado es minimo pero cada variable
     cumple una funcion:
       dlgQueue  = las lineas que faltan mostrar. Siempre trabajo con la [0] y
                   cuando termina la saco con shift(): la cola se vacia sola.
       dlgTimer  = el id del setInterval que va escupiendo letra por letra.
                   Lo guardo para poder cortarlo (clearInterval).
       dlgDone   = callback para avisar cuando se termino TODO el dialogo.
       dlgTyping = si en este momento se esta tipeando. Lo necesito para que el
                   primer click complete el texto y el segundo pase de linea. */
  var dlgQueue = [];
  var dlgTimer = null;
  var dlgDone = null;
  var dlgTyping = false;

  function renderDialogLine(line) {
    var box = document.getElementById('dialog');
    var who = document.getElementById('dialog-who');
    var txt = document.getElementById('dialog-text');
    var av = document.getElementById('dialog-avatar');
    var next = document.getElementById('dialog-next');

    box.classList.remove('hidden');
    box.classList.toggle('friendly', !!line.friendly);
    who.textContent = line.who || (line.friendly ? 'SISTEMA' : 'GLITCH');
    av.textContent = line.friendly ? '>' : '☠';
    next.textContent = 'CONTINUAR ▸';

    /* El efecto maquina de escribir: un setInterval que agrega UN caracter
       cada 17ms. clearInterval ANTES de crear el nuevo es obligatorio: si una
       linea empieza mientras la anterior seguia tipeando, quedarian dos
       intervalos escribiendo sobre el mismo elemento y saldria todo mezclado.
       El sonidito cada 3 letras (i % 3) es para que no sature el oido. */
    var full = line.text;
    var i = 0;
    txt.textContent = '';
    dlgTyping = true;
    clearInterval(dlgTimer);

    dlgTimer = setInterval(function () {
      if (i >= full.length) {
        clearInterval(dlgTimer);
        dlgTyping = false;
        return;
      }
      txt.textContent += full.charAt(i);
      if (i % 3 === 0) GT.audio.key();
      i++;
    }, 17);
  }

  /* El boton CONTINUAR hace dos cosas distintas segun el momento, igual que
     en cualquier juego con dialogos: si todavia esta escribiendo, el primer
     click COMPLETA la linea de golpe (para el que no quiere esperar); si ya
     esta completa, el click PASA a la siguiente. Cuando la cola queda vacia,
     escondo el cuadro y recien ahi disparo el callback final. */
  function advanceDialog() {
    var txt = document.getElementById('dialog-text');

    if (dlgTyping) {                       // primer click: completar el texto
      clearInterval(dlgTimer);
      dlgTyping = false;
      txt.textContent = dlgQueue[0].text;
      return;
    }

    dlgQueue.shift();
    if (dlgQueue.length) {
      renderDialogLine(dlgQueue[0]);
    } else {
      document.getElementById('dialog').classList.add('hidden');
      /* Copio el callback a una variable local y LIMPIO dlgDone ANTES de
         llamarlo. Parece un detalle al pedo pero no lo es: ese callback suele
         arrancar el nivel siguiente, que puede abrir otro dialogo enseguida.
         Si limpiara despues, le estaria pisando el callback nuevo al viejo. */
      var cb = dlgDone;
      dlgDone = null;
      if (cb) cb();
    }
  }

  /** ui.say([{text, who, friendly}], callbackAlTerminar) */
  ui.say = function (lines, onDone) {
    dlgQueue = lines.slice();
    dlgDone = onDone || null;
    if (!dlgQueue.length) { if (onDone) onDone(); return; }
    renderDialogLine(dlgQueue[0]);
  };

  ui.hideDialog = function () {
    clearInterval(dlgTimer);
    dlgQueue = [];
    dlgDone = null;
    dlgTyping = false;
    var d = document.getElementById('dialog');
    if (d) d.classList.add('hidden');
  };

  /* ============================================================
     Init
     ============================================================ */
  ui.init = function () {
    document.getElementById('dialog-next').addEventListener('click', advanceDialog);

    document.getElementById('start-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      ui.toggleStartMenu();
    });

    document.getElementById('desktop').addEventListener('mousedown', function (e) {
      if (!e.target.closest('#start-menu')) ui.toggleStartMenu(false);
      if (!e.target.closest('.desk-icon')) {
        var sel = document.querySelector('.desk-icon.selected');
        if (sel) sel.classList.remove('selected');
      }
    });

    var muteBtn = document.getElementById('mute-btn');
    muteBtn.addEventListener('click', function () {
      var m = GT.audio.toggleMute();
      muteBtn.classList.toggle('off', m);
      muteBtn.textContent = m ? '×' : '♪';
    });

    /* Reloj de la barra de tareas. Chequeo cada segundo aunque el minuto
       cambie cada 60: es mas barato preguntar la hora que calcular cuanto
       falta para el proximo minuto, y asi no se desfasa nunca. */
    setInterval(function () {
      var d = new Date();
      var h = d.getHours(), m = d.getMinutes();
      document.getElementById('clock').textContent =
        (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }, 1000);
  };

  ui.resetDesktop = function () {
    ui.closeAllWindows();
    ui.hideDialog();
    iconDefs = [];
    renderIcons();
    document.getElementById('popup-layer').innerHTML = '';
  };

})(window, document);
