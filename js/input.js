/* ============================================================
   Glitch.TEC — Entrada del mando
   El mando es la app del celular (stick + dos botones de clic). Manda JSON
   por WebSocket a tools/mando_server, que lo reenvia a todos los clientes,
   el juego incluido. Mensajes que entiende este modulo:

     {"x":0.5,"y":-0.3}                    stick, de -1 a 1 (y arriba = +)
     {"button":"left","down":true}         boton izquierdo apretado / soltado
     {"button":"right","down":false}       boton derecho

   Los botones tambien se aceptan como {"action":"LEFT_DOWN"|"LEFT_UP"|
   "RIGHT_DOWN"|"RIGHT_UP"}. Si el APK real manda otra forma, se cambia
   solo apply() mas abajo.

   Sin servidor, el mouse sigue funcionando: los minijuegos tambien escuchan
   mousemove / mousedown / contextmenu. Direccion: ws://localhost:3000, o
   index.html?mando=IP:PUERTO.

   Uso, una vez por frame y desde UN solo consumidor (guarda el estado
   anterior para detectar el flanco de cada boton):

     var p = GT.input.poll();          // null si el mando no esta conectado
     if (p) {
       aim.x += p.x * VEL * dt;        // stick, de -1 a 1, ya sin zona muerta
       if (p.left.pressed) ...         // recien apretado
       if (p.right.released) ...       // recien soltado
     }

   Menus radiales: GT.input.sector(dx, dy, n) devuelve a que sector de n
   apunta el stick (o el cursor respecto al centro del menu).
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var input = GT.input = {};

  input.DEADZONE = 0.2;           // el stick nunca queda en 0 exacto
  input.connected = false;

  var stick = { x: 0, y: 0 };
  var down = { left: false, right: false };
  var prev = { left: false, right: false };

  /** Interpreta un mensaje del mando. */
  function apply(text) {
    var m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m) return;
    if (typeof m.x === 'number' && typeof m.y === 'number') {
      stick.x = Math.max(-1, Math.min(1, m.x));
      stick.y = Math.max(-1, Math.min(1, m.y));
      return;
    }
    var side = null, isDown = null;
    if (m.button) { side = String(m.button).toLowerCase(); isDown = !!m.down; }
    else if (m.action) {
      var a = /^(LEFT|RIGHT)_(DOWN|UP)$/.exec(String(m.action).toUpperCase());
      if (a) { side = a[1].toLowerCase(); isDown = a[2] === 'DOWN'; }
    }
    if (side === 'left' || side === 'right') down[side] = isDown;
  }

  /* ---------- Conexion ---------- */
  function connect() {
    var m = /[?&]mando=([^&]+)/.exec(window.location.search);
    var ws;
    try { ws = new window.WebSocket('ws://' + (m ? decodeURIComponent(m[1]) : 'localhost:3000')); }
    catch (e) { return; }
    ws.onopen = function () { input.connected = true; };
    ws.onmessage = function (ev) { apply(ev.data); };
    ws.onclose = function () {                       // reintenta cada 2 s
      input.connected = false;
      stick.x = stick.y = 0; down.left = down.right = false;
      setTimeout(connect, 2000);
    };
  }
  if (window.WebSocket && window.location) connect();

  function button(key) {
    var b = { down: down[key], pressed: down[key] && !prev[key], released: !down[key] && prev[key] };
    prev[key] = down[key];
    return b;
  }

  /** Estado del mando para este frame, o null si no hay mando conectado.
      Devuelve y en coordenadas de pantalla (abajo = +), invertido respecto
      al JSON de la app. */
  input.poll = function () {
    if (!input.connected) return null;
    var live = Math.hypot(stick.x, stick.y) > input.DEADZONE;
    return { x: live ? stick.x : 0, y: live ? -stick.y : 0, left: button('left'), right: button('right') };
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
    var was = input.connected;
    input.connected = true;
    apply('{"x":0.5,"y":0.8}'); apply('{"button":"left","down":true}'); apply('{"action":"RIGHT_DOWN"}');
    var p = input.poll();
    var ok = p.x === 0.5 && p.y === -0.8 && p.left.pressed && p.right.pressed && !input.poll().left.pressed;
    apply('{"button":"left","down":false}'); apply('{"x":0,"y":0}'); apply('basura');
    ok = ok && input.poll().left.released;
    apply('{"action":"RIGHT_UP"}'); input.poll();
    input.connected = was;
    return ok &&
           input.sector(0, -1, 8) === 0 && input.sector(1, 0, 8) === 2 &&
           input.sector(0, 1, 8) === 4 && input.sector(-1, 0, 8) === 6 &&
           input.sector(0, 0, 8) === -1 && input.sector(0.1, -1, 4) === 0 &&
           input.sector(-0.1, -1, 4) === 0;
  };

})(window);
