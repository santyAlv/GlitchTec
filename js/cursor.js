/* ============================================================
   Glitch.TEC — Cursor virtual del mando
   La pagina ya no responde al mouse como control de juego: el unico mando
   es la app Android. Este modulo dibuja un puntero que mueve el stick y
   convierte los botones en eventos de mouse reales sobre el elemento que
   tenga debajo, asi todo el escritorio (iconos, ventanas, botones, pop-ups,
   arrastre de ventanas) se maneja con el mando sin tocar cada modulo:

     stick            -> mousemove
     boton izquierdo  -> mousedown / mouseup / click
     boton derecho    -> mousedown / contextmenu / mouseup

   Un minijuego que usa el stick para otra cosa (la mira del Firewall, el
   menu radial) pide el control con GT.cursor.hold(true) y lo devuelve con
   GT.cursor.hold(false): mientras tanto el puntero se oculta y no hace clics.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var cur = GT.cursor = {};

  var SPEED = 520;                // px/s con el stick a fondo
  var x = window.innerWidth / 2, y = window.innerHeight / 2;
  var held = false;               // un minijuego se quedo con el stick
  var downOn = { left: null, right: null };   // elemento donde se apreto cada boton
  var last = 0;

  var el = document.createElement('div');
  el.id = 'pad-cursor';
  el.textContent = '↖';      // flecha simple, sin diseño
  el.style.cssText = 'position:fixed;left:0;top:0;z-index:100000;pointer-events:none;' +
    'font:26px/1 monospace;color:#fff;text-shadow:0 0 2px #000,0 0 2px #000,0 0 4px #000;display:none';
  document.body.appendChild(el);

  function under() { return document.elementFromPoint(x, y); }

  function fire(type, target, button) {
    if (!target) return;
    target.dispatchEvent(new window.MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, clientX: x, clientY: y,
      button: button, buttons: type === 'mouseup' || type === 'mousemove' ? 0 : (button === 2 ? 2 : 1)
    }));
  }

  function show() {
    var visible = GT.input.connected && !held;
    el.style.display = visible ? 'block' : 'none';
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }

  /** Posicion actual del puntero, en coordenadas de la ventana. */
  cur.pos = function () { return { x: x, y: y }; };

  cur.moveTo = function (nx, ny) {
    x = Math.max(0, Math.min(window.innerWidth - 1, nx));
    y = Math.max(0, Math.min(window.innerHeight - 1, ny));
    show();
    fire('mousemove', under(), 0);
  };

  /** Un modulo toma (true) o devuelve (false) el stick y los botones. */
  cur.hold = function (on) {
    held = !!on;
    if (held) {                                 // suelta lo que estuviera apretado
      ['left', 'right'].forEach(function (s) { if (downOn[s]) release(s); });
    }
    show();
  };

  function press(side) {
    var t = under();
    if (!t) return;
    var b = side === 'left' ? 0 : 2;
    downOn[side] = t;
    if (side === 'left' && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) t.focus();
    fire('mousedown', t, b);
    if (side === 'right') fire('contextmenu', t, b);
  }

  function release(side) {
    var t = under(), started = downOn[side];
    downOn[side] = null;
    if (!t || !started) return;
    var b = side === 'left' ? 0 : 2;
    fire('mouseup', t, b);
    if (side === 'left' && (t === started || started.contains(t) || t.contains(started))) fire('click', started, 0);
  }

  ['left', 'right'].forEach(function (side) {
    GT.on('pad:' + side, function (e) {
      if (held || !GT.input.connected) return;
      if (e.down) press(side); else release(side);
    });
  });
  GT.on('pad:status', show);

  function loop(ts) {
    var dt = Math.min(0.1, (ts - (last || ts)) / 1000);
    last = ts;
    if (GT.input.connected && !held) {
      var a = GT.input.axes();
      if (a.x || a.y) cur.moveTo(x + a.x * SPEED * dt, y + a.y * SPEED * dt);
    }
    window.requestAnimationFrame(loop);
  }
  show();
  window.requestAnimationFrame(loop);

})(window, document);
