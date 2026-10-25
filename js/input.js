/* ============================================================
   Glitch.TEC — Entrada del mando
   El mando es SOLO la app Android del celular (stick + dos botones de clic).
   Manda JSON por WebSocket a tools/mando_server, que lo reenvia a todos los
   clientes, el juego incluido. La pagina no tiene ningun control propio (ni
   mouse, ni gamepad, ni teclado). Mensajes que entiende este modulo:

     {"x":0.5,"y":-0.3}                    stick, de -1 a 1 (y arriba = +)
     {"button":"left","down":true}         boton izquierdo apretado / soltado
     {"button":"right","down":false}       boton derecho

   Los botones tambien se aceptan como {"action":"LEFT_DOWN"|"LEFT_UP"|
   "RIGHT_DOWN"|"RIGHT_UP"}. Si el APK cambia de formato, se toca solo apply().
   Direccion del relay: ws://localhost:3000, o index.html?mando=IP:PUERTO.

   Cualquier modulo se entera por el bus de eventos (GT.on), sin coordinarse
   con los demas:

     GT.on('pad:left',   function (e) { e.down })     // true al apretar, false al soltar
     GT.on('pad:right',  function (e) { ... })        // idem
     GT.on('pad:stick',  function (e) { e.x, e.y })   // ya sin zona muerta; y abajo = +
     GT.on('pad:status', function (e) { e.connected })

   Y para leer el estado de este instante (en un loop, por ejemplo):

     GT.input.axes()        -> { x, y }   stick, y abajo = + (como en pantalla)
     GT.input.isDown('left')               boton mantenido
     GT.input.connected                    hay mando conectado

   Menus radiales: GT.input.sector(dx, dy, n) devuelve a que sector de n
   apunta el stick (o el cursor respecto al centro del menu).
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var input = GT.input = {};

  input.DEADZONE = 0.2;           // el stick nunca queda en 0 exacto
  input.connected = false;

  var stick = { x: 0, y: 0 };     // tal como llega: y arriba = +
  var down = { left: false, right: false };

  function emit(evt, data) { if (GT.emit) GT.emit(evt, data); }

  /** Stick de este instante, en coordenadas de pantalla y sin zona muerta. */
  input.axes = function () {
    var live = Math.hypot(stick.x, stick.y) > input.DEADZONE;
    return { x: live ? stick.x : 0, y: live ? -stick.y : 0 };
  };

  input.isDown = function (side) { return !!down[side]; };

  function setButton(side, isDown) {
    if (down[side] === isDown) return;
    down[side] = isDown;
    emit('pad:' + side, { down: isDown });
  }

  /** Interpreta un mensaje del mando. */
  function apply(text) {
    var m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m) return;
    if (typeof m.x === 'number' && typeof m.y === 'number') {
      stick.x = Math.max(-1, Math.min(1, m.x));
      stick.y = Math.max(-1, Math.min(1, m.y));
      emit('pad:stick', input.axes());
      return;
    }
    var side = null, isDown = null;
    if (m.button) { side = String(m.button).toLowerCase(); isDown = !!m.down; }
    else if (m.action) {
      var a = /^(LEFT|RIGHT)_(DOWN|UP)$/.exec(String(m.action).toUpperCase());
      if (a) { side = a[1].toLowerCase(); isDown = a[2] === 'DOWN'; }
    }
    if (side === 'left' || side === 'right') setButton(side, isDown);
  }

  function setConnected(on) {
    if (input.connected === on) return;
    input.connected = on;
    if (!on) {                                       // sin mando: todo en reposo
      stick.x = stick.y = 0;
      setButton('left', false); setButton('right', false);
      emit('pad:stick', input.axes());
    }
    emit('pad:status', { connected: on });
  }

  /* ---------- Conexion ---------- */
  function connect() {
    var m = /[?&]mando=([^&]+)/.exec(window.location.search);
    var ws;
    try { ws = new window.WebSocket('ws://' + (m ? decodeURIComponent(m[1]) : 'localhost:3000')); }
    catch (e) { return; }
    ws.onopen = function () { setConnected(true); };
    ws.onmessage = function (ev) { apply(ev.data); };
    ws.onclose = function () {                       // reintenta cada 2 s
      setConnected(false);
      setTimeout(connect, 2000);
    };
  }
  if (window.WebSocket && window.location) connect();

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
    var got = [];
    GT.on('pad:left', function (e) { got.push('L' + e.down); });
    GT.on('pad:right', function (e) { got.push('R' + e.down); });
    apply('{"x":0.5,"y":0.8}'); apply('{"button":"left","down":true}'); apply('{"button":"left","down":true}');
    apply('{"action":"RIGHT_DOWN"}');
    var a = input.axes();
    var ok = a.x === 0.5 && a.y === -0.8 && input.isDown('left') && input.isDown('right');
    apply('{"button":"left","down":false}'); apply('{"action":"RIGHT_UP"}');
    apply('{"x":0,"y":0}'); apply('basura');
    ok = ok && !input.isDown('left') && input.axes().x === 0 &&
         got.join() === 'Ltrue,Rtrue,Lfalse,Rfalse';     // sin repetidos del mismo estado
    return ok &&
           input.sector(0, -1, 8) === 0 && input.sector(1, 0, 8) === 2 &&
           input.sector(0, 1, 8) === 4 && input.sector(-1, 0, 8) === 6 &&
           input.sector(0, 0, 8) === -1 && input.sector(0.1, -1, 4) === 0 &&
           input.sector(-0.1, -1, 4) === 0;
  };

})(window);
