/* ============================================================
   Glitch.TEC — capa de interfaz
   Gestor de ventanas (arrastrables, foco, minimizar, cerrar),
   iconos del escritorio, barra de tareas, avisos y dialogos.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var ui = GT.ui = {};

  var windows = {};        // id -> objeto ventana
  var zTop = 100;
  var cascade = 0;

  /* ============================================================
     Iconos (SVG inline, sin archivos externos)
     ============================================================ */
  /* Iconos de 16x16 pixeles, dibujados sobre rejilla entera y con
     shape-rendering="crispEdges": nada de curvas ni degrades, para
     que al escalarlos a 32 px se vean como los del sistema. */
  function pix(inner) {
    return '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' + inner + '</svg>';
  }

  ui.icons = {
    terminal: pix(
      '<path d="M0 1h16v11H0z" fill="#5a625f"/>' +
      '<path d="M1 2h14v9H1z" fill="#04090b"/>' +
      '<path d="M3 4h1v1H3zM4 5h1v1H4zM5 6h1v1H5zM4 7h1v1H4zM3 8h1v1H3z" fill="#2bf07a"/>' +
      '<path d="M7 8h4v1H7z" fill="#2bf07a"/>' +
      '<path d="M6 12h4v2H6zM3 14h10v1H3z" fill="#5a625f"/>'),

    folder: pix(
      '<path d="M0 2h6l2 2h8v10H0z" fill="#8a6a10"/>' +
      '<path d="M1 3h5l2 2h7v8H1z" fill="#f5c344"/>' +
      '<path d="M1 6h14v7H1z" fill="#ffd968"/>'),

    folderLock: pix(
      '<path d="M0 2h6l2 2h8v10H0z" fill="#5f6360"/>' +
      '<path d="M1 3h5l2 2h7v8H1z" fill="#a9ada6"/>' +
      '<path d="M1 6h14v7H1z" fill="#cfd3cb"/>' +
      '<path d="M6 7h1v2H6zM9 7h1v2H9zM7 6h2v1H7z" fill="#2f3433"/>' +
      '<path d="M5 9h6v4H5z" fill="#4d5459"/>' +
      '<path d="M7 10h2v2H7z" fill="#ffd968"/>'),

    taskmgr: pix(
      '<path d="M0 1h16v13H0z" fill="#5a625f"/>' +
      '<path d="M1 2h14v11H1z" fill="#e8e8e0"/>' +
      '<path d="M1 2h14v2H1z" fill="#0a2a86"/>' +
      '<path d="M3 9h2v3H3zM6 7h2v5H6z" fill="#12833c"/>' +
      '<path d="M9 5h2v7H9z" fill="#c98f10"/>' +
      '<path d="M12 8h2v4h-2z" fill="#a3121b"/>'),

    mail: pix(
      '<path d="M0 3h16v10H0z" fill="#4d5459"/>' +
      '<path d="M1 4h14v8H1z" fill="#ffffff"/>' +
      '<path d="M1 4h14v1H1zM2 5h12v1H2zM3 6h10v1H3zM4 7h8v1H4zM5 8h6v1H5zM6 9h4v1H6zM7 10h2v1H7z" fill="#c3ccd4"/>'),

    doc: pix(
      '<path d="M2 0h8l4 4v12H2z" fill="#5a625f"/>' +
      '<path d="M3 1h6v4h4v10H3z" fill="#ffffff"/>' +
      '<path d="M9 1l4 4H9z" fill="#c8ccd0"/>' +
      '<path d="M5 7h6v1H5zM5 9h6v1H5zM5 11h4v1H5z" fill="#8a93a0"/>'),

    exe: pix(
      '<path d="M1 2h14v12H1z" fill="#2f3433"/>' +
      '<path d="M2 3h12v10H2z" fill="#c3c7c3"/>' +
      '<path d="M2 3h12v2H2z" fill="#0a2a86"/>' +
      '<path d="M4 7h3v3H4zM9 7h3v3H9z" fill="#2bf07a"/>' +
      '<path d="M4 11h8v1H4z" fill="#5a625f"/>'),

    danger: pix(
      '<path d="M8 1l7 13H1z" fill="#7a0c12"/>' +
      '<path d="M8 3l5 10H3z" fill="#ffd24d"/>' +
      '<path d="M7 6h2v4H7zM7 11h2v2H7z" fill="#3a0a0e"/>'),

    book: pix(
      '<path d="M1 2h14v12H1z" fill="#0a2a86"/>' +
      '<path d="M2 3h5v10H2zM9 3h5v10H9z" fill="#eef2f8"/>' +
      '<path d="M3 5h3v1H3zM3 7h3v1H3zM10 5h3v1h-3zM10 7h3v1h-3z" fill="#8a93a0"/>' +
      '<path d="M7 2h2v12H7z" fill="#06133f"/>'),

    trash: pix(
      '<path d="M6 1h4v1H6zM3 2h10v2H3z" fill="#4d5459"/>' +
      '<path d="M4 5h8v9H4z" fill="#b8bcc0"/>' +
      '<path d="M4 5h8v1H4z" fill="#8e9398"/>' +
      '<path d="M6 7h1v6H6zM9 7h1v6H9z" fill="#6d7479"/>'),

    shield: pix(
      '<path d="M2 2h12v6H2zM2 8h12l-6 6z" fill="#0d4a20"/>' +
      '<path d="M3 3h10v5H3zM3 8h10l-5 5z" fill="#2f9c52"/>' +
      '<path d="M5 6h1v1H5zM6 7h1v1H6zM7 8h1v1H7zM8 7h1v1H8zM9 6h1v1H9zM10 5h1v1h-1z" fill="#ffffff"/>' +
      '<path d="M5 7h1v1H5zM6 8h1v1H6zM7 9h1v1H7zM8 8h1v1H8zM9 7h1v1H9zM10 6h1v1h-1z" fill="#ffffff"/>'),

    skull: pix(
      '<path d="M3 2h10v8H3zM5 10h6v4H5z" fill="#e8e8e0"/>' +
      '<path d="M3 2h1v8H3zM12 2h1v8h-1z" fill="#c2c2ba"/>' +
      '<path d="M5 5h2v2H5zM9 5h2v2H9z" fill="#14181a"/>' +
      '<path d="M7 8h2v1H7z" fill="#14181a"/>' +
      '<path d="M6 10h1v4H6zM9 10h1v4H9z" fill="#8e9398"/>')
  };

  /* ============================================================
     Pantallas
     ============================================================ */
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

  function makeDraggable(el, handle, bounds) {
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
