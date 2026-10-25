/* ============================================================
   Glitch.TEC — Entrada del mando
   El mando tiene un stick y dos botones (izquierdo y derecho). Si el PC
   lo ve como mouse, el stick mueve el cursor y los botones hacen clic:
   los minijuegos ya lo reciben por mousemove / mousedown / contextmenu y
   no necesitan nada de este archivo. Si lo ve como gamepad, GT.input.poll()
   lo lee. Los minijuegos usan las dos vias, asi que sirve cualquiera.

   Uso, una vez por frame y desde UN solo consumidor (guarda el estado
   anterior para detectar el flanco de cada boton):

     var p = GT.input.poll();          // null si no hay mando conectado
     if (p) {
       aim.x += p.x * VEL * dt;        // stick, de -1 a 1, ya sin zona muerta
       if (p.left.pressed) ...         // recien apretado este frame
       if (p.right.released) ...       // recien soltado este frame
     }

   Menus radiales: GT.input.sector(dx, dy, n) devuelve a que sector de n
   apunta el stick (o el cursor respecto al centro del menu).
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var input = GT.input = {};

  /* Indices del Gamepad API. Si el mando real manda otros, se cambian aca. */
  input.MAP = { axisX: 0, axisY: 1, left: 0, right: 1 };
  input.DEADZONE = 0.2;           // el stick nunca queda en 0 exacto

  var prev = { left: false, right: false };

  function pad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (var i = 0; i < pads.length; i++) if (pads[i]) return pads[i];
    return null;
  }

  function button(p, idx, key) {
    var down = !!(p.buttons[idx] && p.buttons[idx].pressed);
    var b = { down: down, pressed: down && !prev[key], released: !down && prev[key] };
    prev[key] = down;
    return b;
  }

  input.poll = function () {
    var p = pad();
    if (!p) return null;
    var ax = p.axes[input.MAP.axisX] || 0, ay = p.axes[input.MAP.axisY] || 0;
    var live = Math.hypot(ax, ay) > input.DEADZONE;
    return {
      x: live ? ax : 0, y: live ? ay : 0,
      left: button(p, input.MAP.left, 'left'),
      right: button(p, input.MAP.right, 'right')
    };
  };

  /** Sector (0..n-1) al que apunta el vector (dx, dy). El 0 es arriba y se
      cuenta en sentido horario. Devuelve -1 si el vector es mas corto que
      `min` (stick en reposo; para un cursor en pixeles, el radio muerto del
      centro del menu). `dy` positivo es hacia abajo, como en pantalla. */
  input.sector = function (dx, dy, n, min) {
    if (Math.hypot(dx, dy) <= (min === undefined ? input.DEADZONE : min)) return -1;
    var turn = Math.atan2(dx, -dy) / (2 * Math.PI);          // 0 = arriba, +1/4 = derecha
    var step = 1 / n;
    return Math.floor(((turn + step / 2) % 1 + 1) % 1 / step);
  };

  /* Chequeo rapido: en la consola, GT.input.selfTest() debe devolver true. */
  input.selfTest = function () {
    return input.sector(0, -1, 8) === 0 && input.sector(1, 0, 8) === 2 &&
           input.sector(0, 1, 8) === 4 && input.sector(-1, 0, 8) === 6 &&
           input.sector(0, 0, 8) === -1 && input.sector(0.1, -1, 4) === 0 &&
           input.sector(-0.1, -1, 4) === 0;
  };

})(window);
