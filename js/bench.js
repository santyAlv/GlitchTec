/* ============================================================
   Glitch.TEC — BANCO DE TRABAJO (sketch p5.js)
   ------------------------------------------------------------
   El sector de hardware dibujado con el motor del proyecto
   (Processing / p5.js) en lugar de HTML. Son dos cosas sobre
   la mesa del taller:

     1. EL GABINETE, visto de costado y en corte. Arranca cerrado:
        hasta que el técnico no saca la tapa, el interior no se ve
        ni se puede tocar. Cada pieza es una zona clickeable con
        su estado (sin revisar / revisada / falla / arreglada).

     2. EL MONITOR DE PRUEBA. No es un dibujo decorativo: cuando
        se aprieta el botón de encendido, el monitor muestra lo
        que de verdad mostraría el equipo — POST, pitidos, código
        de error, arranque del sistema, apagón térmico o "sin
        señal" — y de esa pantalla se lee el síntoma.

   El módulo no sabe nada de las órdenes de trabajo ni del
   puntaje: sólo dibuja, avisa qué pieza se tocó (onSelect) y
   reproduce la secuencia de prueba que le piden (screenTest).
   La lógica del taller vive en tech.js.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var bench = GT.bench = {};

  /* Lienzo lógico: todo se dibuja en estas coordenadas y después
     se escala al ancho disponible, así el banco se ve igual en
     una pantalla de 1920 y en un celular. */
  var W = 790, H = 430;

  var sketch = null;
  var host = null;
  var scale = 1;

  /* ============================================================
     Piezas del equipo
     Rectángulos en coordenadas lógicas. El orden de ESTA lista
     es el orden de prioridad para el click: las piezas chicas
     que están encima de la placa madre se prueban antes que ella.
     ============================================================ */
  var PARTS = [
    { id: 'cooler',  x:  66, y: 170, w: 106, h: 106, label: 'CPU + DISIPADOR', inside: true },
    { id: 'ram',     x: 188, y: 148, w:  58, h: 124, label: 'MEMORIA RAM',     inside: true },
    { id: 'gpu',     x:  58, y: 300, w: 198, h:  36, label: 'PLACA DE VIDEO',  inside: true },
    { id: 'disco',   x: 266, y: 298, w:  76, h:  72, label: 'DISCO',           inside: true },
    { id: 'fuente',  x:  44, y:  52, w: 120, h:  64, label: 'FUENTE',          inside: true },
    { id: 'boton',   x: 272, y:  46, w:  70, h:  52, label: 'PANEL FRONTAL',   inside: false },
    { id: 'cable',   x: 170, y:  44, w:  62, h:  44, label: 'ALIMENTACIÓN',    inside: false },
    { id: 'monitor', x: 420, y:  44, w: 338, h: 252, label: 'MONITOR',         inside: false },
    { id: 'placa',   x:  44, y: 128, w: 300, h: 262, label: 'PLACA MADRE',     inside: true }
  ];

  var byId = {};
  PARTS.forEach(function (p) { byId[p.id] = p; });

  /* Estado visible del equipo */
  var status = {};          // id de pieza -> 'ok' | 'bad' | 'fixed'
  var hit = {};             // id -> ms restantes de destello
  var hover = null;
  var selected = null;
  var openCase = false;
  var fansOn = false;
  var ledOn = false;
  var pickMode = false;     // true = el jugador tiene que señalar la pieza culpable

  /* Monitor */
  var mon = {
    mode: 'off',            // 'off' | 'nosignal' | 'post' | 'desktop' | 'black'
    osd: null,              // cartel del propio monitor ("SIN SEÑAL")
    lines: [],              // renglones del POST ya escritos
    temp: null,             // lectura de temperatura, si la secuencia la usa
    busy: false
  };

  /* Reproductor de secuencias de prueba */
  var seq = null, seqIdx = 0, seqT0 = 0, seqDone = null, seqHold = 0;

  /* Avisos hacia tech.js */
  bench.onSelect = null;    // function (idPieza)
  bench.onPower = null;     // function ()

  /* ============================================================
     Montaje del sketch
     ============================================================ */
  bench.mount = function (hostId) {
    if (typeof window.p5 === 'undefined') {
      console.warn('[Glitch.TEC] p5.js no cargó: el banco de trabajo queda sin dibujar.');
      return;
    }
    host = document.getElementById(hostId);
    if (!host || sketch) return;

    sketch = new window.p5(function (p) {

      p.setup = function () {
        var c = p.createCanvas(W, H);
        c.parent(host);
        p.pixelDensity(1);
        p.textFont('monospace');
        fit(p);
      };

      p.windowResized = function () { fit(p); };

      /* El taller arranca oculto (display:none), así que al crear el
         sketch el host mide 0. Hay que re-medirlo en cada frame hasta
         que la pantalla aparezca, igual que el fondo CRT. */
      function fit(pp) {
        if (!host) return false;
        var w = host.clientWidth;
        if (w < 40) return false;
        scale = Math.min(1.25, w / W);
        var cw = Math.round(W * scale), ch = Math.round(H * scale);
        if (pp.width !== cw || pp.height !== ch) pp.resizeCanvas(cw, ch);
        return true;
      }

      p.draw = function () {
        if (!fit(p)) return;

        p.push();
        p.scale(scale);
        drawBench(p);
        drawMonitor(p);
        drawCase(p);
        drawOverlays(p);
        p.pop();

        advanceSeq(p);
        decayHits(p);
      };

      /* ---------------- Mouse ---------------- */
      p.mouseMoved = function () {
        var m = logical(p);
        hover = m ? pick(m.x, m.y) : null;
        if (host) host.style.cursor = hover ? 'pointer' : 'default';
      };

      p.mouseOut = function () { hover = null; };

      p.mousePressed = function () {
        var m = logical(p);
        if (!m) return;

        /* Si hay una prueba corriendo, el click la saltea. */
        if (seq) { finishSeq(p, true); return; }

        /* El botón físico de encendido: el centro de todo el modo. */
        if (inRect(m.x, m.y, 286, 54, 42, 20) && typeof bench.onPower === 'function') {
          bench.onPower();
          return;
        }

        var id = pick(m.x, m.y);
        if (!id) return;
        if (typeof bench.onSelect === 'function') bench.onSelect(id);
      };

      function logical(pp) {
        var x = pp.mouseX / scale, y = pp.mouseY / scale;
        if (x < 0 || y < 0 || x > W || y > H) return null;
        return { x: x, y: y };
      }
    });
  };

  bench.destroy = function () {
    if (sketch) { sketch.remove(); sketch = null; }
    host = null;
  };

  /* ============================================================
     API que usa tech.js
     ============================================================ */
  bench.reset = function () {
    status = {};
    hit = {};
    selected = null;
    hover = null;
    openCase = false;
    fansOn = false;
    ledOn = false;
    pickMode = false;
    seq = null;
    mon.mode = 'off';
    mon.osd = null;
    mon.lines = [];
    mon.temp = null;
    mon.busy = false;
  };

  bench.setStatus = function (part, st) {
    if (!part || !byId[part]) return;
    status[part] = st;
    hit[part] = 700;
  };

  bench.statusOf = function (part) { return status[part] || null; };
  bench.setOpen = function (v) { openCase = !!v; };
  bench.isOpen = function () { return openCase; };
  bench.select = function (part) { selected = byId[part] ? part : null; };
  bench.selected = function () { return selected; };
  bench.setPickMode = function (v) { pickMode = !!v; };
  bench.has = function (part) { return !!byId[part]; };
  bench.labelOf = function (part) { return byId[part] ? byId[part].label : ''; };
  bench.isBusy = function () { return !!seq; };

  /* ============================================================
     SECUENCIAS DE PRUEBA
     Cada una es la pantalla que mostraría el equipo con esa falla.
     Campos de cada paso: at (ms), line/cls (renglón del POST),
     beep, mode, osd, led, fans, temp.
     ============================================================ */
  var BIOS = [
    { at:   0, led: true, fans: true, mode: 'post' },
    { at: 260, line: 'WinTEC BIOS v4.51PG — TEC Systems', cls: 'dim' },
    { at: 560, line: 'CPU  : TEC 586 DX  ·  133 MHz' },
    { at: 860, line: 'Memoria: 640K base, 15360K extendida' }
  ];

  function withBios(rest) { return BIOS.concat(rest); }

  var SEQ = {
    /* No enciende: el equipo no da señales de vida. El monitor
       muestra su propio cartel, que es dato: el monitor SÍ anda. */
    muerta: [
      { at:    0, led: false, fans: false, mode: 'nosignal', osd: 'SIN SEÑAL' },
      { at:  700, line: '· sin luces, sin ventiladores, sin pitidos', cls: 'bad' },
      { at: 1500, line: '· el monitor enciende solo: no es el monitor', cls: 'dim' },
      { at: 2300, osd: 'SIN SEÑAL — REVISAR EQUIPO', mode: 'nosignal' }
    ],

    /* Enciende pero no hay imagen: ventiladores y luz sí, video no. */
    sin_senal: [
      { at:    0, led: true, fans: true, mode: 'nosignal', osd: 'SIN SEÑAL' },
      { at:  600, line: '· ventiladores girando, luz de encendido OK', cls: 'dim' },
      { at: 1400, line: '· el monitor no recibe nada por el cable', cls: 'bad' },
      { at: 2200, osd: 'SIN SEÑAL — VERIFICAR CABLE DE VIDEO' }
    ],

    /* POST detenido en memoria: el código de pitidos es la pista. */
    post_ram: withBios([
      { at: 1200, beep: 'long',  line: 'Verificando memoria . . .', cls: 'dim' },
      { at: 1850, beep: 'short' },
      { at: 2150, beep: 'short', line: 'ERROR 0164 — fallo en el banco de memoria', cls: 'bad' },
      { at: 2900, line: '1 pitido largo + 2 cortos = RAM', cls: 'warn' },
      { at: 3500, line: 'POST DETENIDO. El equipo no llega a arrancar.', cls: 'bad' }
    ]),

    /* Apagón térmico: arranca bien y se corta sola con el calor. */
    apagon: withBios([
      { at: 1200, beep: 'short', line: 'POST OK — 1 pitido corto', cls: 'ok' },
      { at: 1700, line: 'Iniciando WinTEC . . .', cls: 'dim' },
      { at: 2400, mode: 'desktop', temp: 62 },
      { at: 3000, temp: 74 },
      { at: 3600, temp: 86 },
      { at: 4200, temp: 97 },
      { at: 4700, mode: 'black', led: false, fans: false, temp: null,
        line: '— el equipo se apagó solo, sin aviso —', cls: 'bad' },
      { at: 5400, mode: 'nosignal', osd: 'SIN SEÑAL' }
    ]),

    /* Disco agonizando: arranca, pero no se puede trabajar. */
    lenta: withBios([
      { at: 1200, beep: 'short', line: 'POST OK — 1 pitido corto', cls: 'ok' },
      { at: 1800, line: 'Disco  : TEC-HDD 500GB  (reintentando)', cls: 'warn' },
      { at: 2600, line: 'clic . . . clic . . . reintento de sector', cls: 'bad' },
      { at: 3400, mode: 'desktop' },
      { at: 4100, line: 'WinTEC no responde — uso de disco 100%', cls: 'bad' }
    ]),

    /* Equipo sano: la pantalla que el técnico quiere ver. */
    ok: withBios([
      { at: 1200, line: 'Memoria OK — 16384K', cls: 'ok' },
      { at: 1700, beep: 'short', line: 'POST OK — 1 pitido corto', cls: 'ok' },
      { at: 2200, line: 'Disco  : TEC-SSD 240GB  ·  sin errores', cls: 'ok' },
      { at: 2700, line: 'Iniciando WinTEC . . .', cls: 'dim' },
      { at: 3300, mode: 'desktop', temp: 61 },
      { at: 4000, line: 'EQUIPO OPERATIVO — listo para entregar', cls: 'ok' }
    ])
  };

  bench.hasSeq = function (kind) { return !!SEQ[kind]; };

  /** Reproduce la pantalla de prueba. done() se llama al terminar. */
  bench.screenTest = function (kind, done) {
    var s = SEQ[kind] || SEQ.ok;
    seq = s;
    seqIdx = 0;
    seqT0 = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    seqDone = done || null;
    seqHold = 900;
    mon.lines = [];
    mon.osd = null;
    mon.temp = null;
    mon.mode = 'black';
    mon.busy = true;
  };

  function advanceSeq(p) {
    if (!seq) return;
    var now = (window.performance && window.performance.now) ? window.performance.now() : Date.now();
    var t = now - seqT0;

    while (seqIdx < seq.length && seq[seqIdx].at <= t) {
      applyStep(seq[seqIdx]);
      seqIdx++;
    }

    if (seqIdx >= seq.length && t > seq[seq.length - 1].at + seqHold) finishSeq(p, false);
  }

  function applyStep(st) {
    if (st.mode) mon.mode = st.mode;
    if (st.osd !== undefined) mon.osd = st.osd;
    if (st.led !== undefined) ledOn = st.led;
    if (st.fans !== undefined) fansOn = st.fans;
    if (st.temp !== undefined) mon.temp = st.temp;
    if (st.line) {
      mon.lines.push({ t: st.line, cls: st.cls || null });
      if (mon.lines.length > 9) mon.lines.shift();
    }
    if (st.beep && GT.audio && GT.audio.beep) GT.audio.beep(st.beep === 'long');
  }

  /** Cierra la secuencia: si se saltea, se aplican todos los pasos de golpe. */
  function finishSeq(p, skipped) {
    if (!seq) return;
    if (skipped) {
      while (seqIdx < seq.length) { applyStep(seq[seqIdx]); seqIdx++; }
    }
    var cb = seqDone;
    seq = null;
    seqDone = null;
    mon.busy = false;
    if (cb) cb();
  }

  function decayHits(p) {
    var dt = p.deltaTime || 16;
    for (var k in hit) {
      if (hit[k] > 0) { hit[k] -= dt; if (hit[k] <= 0) delete hit[k]; }
    }
  }

  /* ============================================================
     DIBUJO — mesa del taller
     ============================================================ */
  function drawBench(p) {
    p.background(8, 13, 17);

    /* Luz del banco cayendo sobre el equipo */
    var g = p.drawingContext.createRadialGradient(200, 150, 40, 200, 220, 460);
    g.addColorStop(0, 'rgba(90,140,120,.20)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    p.drawingContext.save();
    p.drawingContext.fillStyle = g;
    p.drawingContext.fillRect(0, 0, W, H);
    p.drawingContext.restore();

    /* Trama de la mesa */
    p.stroke(22, 36, 42);
    p.strokeWeight(1);
    for (var x = 0; x < W; x += 26) p.line(x, 392, x, H);
    p.line(0, 392, W, 392);
    p.noStroke();
  }

  /* ============================================================
     DIBUJO — gabinete
     ============================================================ */
  function drawCase(p) {
    /* Chasis */
    p.fill(19, 28, 36); p.stroke(61, 79, 94); p.strokeWeight(2);
    p.rect(24, 24, 340, 376, 5);

    /* Interior */
    p.noStroke(); p.fill(11, 18, 25);
    p.rect(32, 32, 324, 360, 3);

    drawPsu(p);
    drawBoard(p);
    drawCooler(p);
    drawRam(p);
    drawGpu(p);
    drawDisk(p);

    /* Tapa lateral: mientras el gabinete esté cerrado, el interior
       se ve apenas y no se puede trabajar. */
    if (!openCase) {
      p.fill(28, 40, 50, 232);
      p.stroke(74, 95, 112); p.strokeWeight(2);
      p.rect(32, 32, 324, 360, 3);
      p.noStroke();
      p.fill(120, 146, 160);
      p.textSize(11); p.textAlign(p.CENTER, p.CENTER);
      p.text('TAPA LATERAL CERRADA', 194, 200);
      p.textSize(9); p.fill(96, 120, 134);
      p.text('hay que abrir el gabinete para tocar el interior', 194, 218);
      /* Tornillos */
      p.fill(86, 106, 120);
      [[44, 44], [344, 44], [44, 380], [344, 380]].forEach(function (s) {
        p.circle(s[0], s[1], 7);
      });
    }

    /* Estas dos se trabajan con el gabinete cerrado, así que van
       siempre arriba de la tapa. */
    drawCable(p);
    drawFrontPanel(p);
  }

  function drawPsu(p) {
    var a = alphaOf('fuente');
    p.fill(34, 48, 60, a); p.stroke(74, 95, 112, a); p.strokeWeight(1.6);
    p.rect(44, 52, 120, 64, 2);
    p.noFill(); p.stroke(93, 115, 135, a);
    p.circle(104, 84, 38);
    spinner(p, 104, 84, 15, 4, fansOn ? 1.6 : 0, a);
    p.noStroke(); p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.LEFT, p.TOP);
    p.text('FUENTE 450W', 48, 104);
  }

  function drawBoard(p) {
    var a = alphaOf('placa');
    p.fill(18, 48, 36, a); p.stroke(47, 107, 76, a); p.strokeWeight(1.6);
    p.rect(44, 128, 300, 262, 2);

    /* Pistas del circuito: decorativas, dan la textura de placa */
    p.stroke(36, 84, 60, a * 0.8); p.strokeWeight(1);
    for (var i = 0; i < 7; i++) {
      var y = 140 + i * 36;
      p.line(50, y, 150 + (i % 3) * 60, y);
    }
    p.noStroke();
    p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.LEFT, p.TOP);
    p.text('PLACA MADRE  TEC-440BX', 50, 374);
  }

  function drawCooler(p) {
    var a = alphaOf('cooler');
    /* Aletas del disipador */
    p.fill(36, 72, 92, a); p.stroke(78, 138, 168, a); p.strokeWeight(1.6);
    p.rect(66, 170, 106, 106, 3);
    p.stroke(78, 138, 168, a * 0.9); p.strokeWeight(1.1);
    for (var x = 72; x < 170; x += 8) p.line(x, 176, x, 270);
    /* Ventilador */
    p.noFill(); p.stroke(127, 195, 224, a); p.strokeWeight(1.6);
    p.circle(119, 223, 60);
    spinner(p, 119, 223, 25, 5, fansOn ? 2.4 : 0, a);
    p.noStroke(); p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.CENTER, p.TOP);
    p.text('CPU', 119, 280);
  }

  function drawRam(p) {
    var a = alphaOf('ram');
    p.fill(59, 42, 82, a); p.stroke(138, 107, 208, a); p.strokeWeight(1.5);
    p.rect(190, 148, 22, 124, 2);
    p.rect(220, 148, 22, 124, 2);
    /* Contactos */
    p.stroke(176, 150, 230, a); p.strokeWeight(1);
    for (var y = 156; y < 266; y += 9) { p.line(192, y, 210, y); p.line(222, y, 240, y); }
    p.noStroke(); p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.CENTER, p.BOTTOM);
    p.text('RAM', 216, 146);
  }

  function drawGpu(p) {
    var a = alphaOf('gpu');
    p.fill(58, 34, 48, a); p.stroke(192, 106, 144, a); p.strokeWeight(1.5);
    p.rect(58, 300, 198, 36, 2);
    p.fill(78, 46, 64, a);
    p.rect(176, 306, 70, 24, 2);
    p.noStroke(); p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.LEFT, p.CENTER);
    p.text('PLACA DE VIDEO', 64, 318);
  }

  function drawDisk(p) {
    var a = alphaOf('disco');
    p.fill(44, 42, 28, a); p.stroke(179, 155, 63, a); p.strokeWeight(1.5);
    p.rect(266, 298, 76, 72, 2);
    p.noFill(); p.stroke(179, 155, 63, a);
    p.circle(304, 330, 38);
    spinner(p, 304, 330, 16, 2, fansOn ? 3.2 : 0, a);
    p.noStroke(); p.fill(138, 168, 162, a);
    p.textSize(7.5); p.textAlign(p.CENTER, p.TOP);
    p.text('DISCO', 304, 352);
  }

  /** Cable de alimentación + interruptor, por detrás del gabinete. */
  function drawCable(p) {
    var a = alphaOf('cable');
    p.fill(43, 58, 71, a); p.stroke(74, 95, 112, a); p.strokeWeight(1.5);
    p.rect(176, 52, 26, 18, 2);
    p.noStroke(); p.fill(190, 206, 216, a);
    p.textSize(7); p.textAlign(p.CENTER, p.CENTER);
    p.text(status.cable === 'fixed' || status.cable === 'ok' ? 'I' : '0', 189, 61);

    /* El cable sale por atrás y cruza hacia el toma */
    p.noFill(); p.stroke(109, 129, 148, a); p.strokeWeight(3.4);
    p.bezier(202, 62, 240, 62, 236, 116, 206, 118);
    p.bezier(206, 118, 170, 120, 120, 132, 36, 132);
    p.noStroke();
  }

  /** Panel frontal: botón de encendido y luz. Siempre accesible. */
  function drawFrontPanel(p) {
    var a = alphaOf('boton');
    p.fill(31, 44, 55, a); p.stroke(74, 95, 112, a); p.strokeWeight(1.5);
    p.rect(272, 46, 70, 52, 3);

    /* Botón físico: es el que dispara la prueba */
    p.fill(seq ? 70 : 48, seq ? 92 : 62, seq ? 84 : 74, a);
    p.stroke(126, 150, 164, a); p.strokeWeight(1.4);
    p.rect(286, 54, 42, 20, 2);
    p.noStroke(); p.fill(206, 226, 218, a);
    p.textSize(8); p.textAlign(p.CENTER, p.CENTER);
    p.text('ENCENDER', 307, 64);

    /* LED de encendido */
    if (ledOn) {
      p.fill(43, 240, 122);
      p.drawingContext.shadowColor = 'rgba(43,240,122,.9)';
      p.drawingContext.shadowBlur = 12;
    } else {
      p.fill(30, 48, 42);
    }
    p.circle(307, 86, 9);
    p.drawingContext.shadowBlur = 0;
  }

  /* ============================================================
     DIBUJO — monitor de prueba
     ============================================================ */
  function drawMonitor(p) {
    var a = alphaOf('monitor');

    /* Cable de video del monitor al gabinete */
    p.noFill(); p.stroke(96, 116, 132, a * 0.85); p.strokeWeight(3);
    p.bezier(420, 300, 392, 348, 360, 300, 344, 322);

    /* Carcasa */
    p.fill(32, 44, 54, a); p.stroke(86, 108, 124, a); p.strokeWeight(2);
    p.rect(420, 44, 338, 252, 6);
    /* Pie */
    p.fill(27, 38, 47, a); p.noStroke();
    p.rect(548, 296, 82, 26, 2);
    p.rect(506, 322, 166, 12, 3);

    /* Tubo */
    p.fill(5, 10, 9); p.stroke(14, 24, 22, a); p.strokeWeight(1);
    p.rect(436, 58, 306, 206, 3);

    drawScreenContent(p);
    drawScanlines(p);

    /* Luz del monitor */
    p.noStroke();
    p.fill(mon.mode === 'off' ? p.color(40, 50, 46) : p.color(255, 198, 60));
    p.circle(732, 278, 8);
    p.fill(150, 172, 182, a);
    p.textSize(7.5); p.textAlign(p.LEFT, p.CENTER);
    p.text('MONITOR DE PRUEBA TEC-15"', 440, 278);
  }

  function drawScreenContent(p) {
    var x = 442, y = 64, w = 294, h = 194;

    if (mon.mode === 'off') {
      p.fill(120, 140, 136, 150);
      p.textSize(10); p.textAlign(p.CENTER, p.CENTER);
      p.text('— apagado —', x + w / 2, y + h / 2);
      p.textSize(8); p.fill(100, 120, 118, 130);
      p.text('apretá ENCENDER en el gabinete para probar el equipo', x + w / 2, y + h / 2 + 18);
      return;
    }

    /* Cartel del propio monitor: el monitor anda, el equipo no manda nada */
    if (mon.mode === 'nosignal') {
      p.push();
      p.fill(12, 20, 28); p.stroke(70, 120, 150); p.strokeWeight(1.4);
      p.rect(x + 54, y + 72, 186, 50, 3);
      p.noStroke();
      p.fill(79, 210, 255);
      p.textSize(13); p.textAlign(p.CENTER, p.CENTER);
      p.text(mon.osd || 'SIN SEÑAL', x + 147, y + 90);
      p.textSize(8); p.fill(130, 180, 200);
      p.text('TEC-15"  ·  entrada VGA', x + 147, y + 108);
      p.pop();
    }

    /* Escritorio WinTEC simulado: el equipo arrancó */
    if (mon.mode === 'desktop') {
      p.fill(30, 107, 102);
      p.rect(x, y, w, h);
      p.fill(16, 58, 56);
      p.rect(x, y + h - 18, w, 18);
      p.fill(195, 199, 195);
      p.rect(x + 4, y + h - 15, 54, 12, 1);
      p.fill(13, 17, 20);
      p.textSize(8); p.textAlign(p.LEFT, p.CENTER);
      p.text('Inicio', x + 10, y + h - 9);
      /* Iconos */
      p.fill(195, 199, 195, 220);
      for (var i = 0; i < 3; i++) p.rect(x + 12, y + 12 + i * 34, 22, 18, 1);
      /* Lectura de temperatura, cuando la secuencia la informa */
      if (mon.temp !== null) {
        var hot = mon.temp >= 85;
        p.fill(hot ? p.color(122, 16, 32) : p.color(13, 60, 56));
        p.rect(x + w - 112, y + 10, 102, 30, 2);
        p.fill(hot ? p.color(255, 170, 180) : p.color(140, 230, 190));
        p.textSize(9); p.textAlign(p.LEFT, p.CENTER);
        p.text('CPU  ' + mon.temp + ' °C', x + w - 104, y + 25);
      }
    }

    /* Renglones del POST */
    if (mon.lines.length) {
      var top = (mon.mode === 'desktop') ? y + h - 34 - mon.lines.length * 13 : y + 10;
      if (mon.mode === 'desktop') {
        p.fill(0, 0, 0, 170);
        p.rect(x + 6, top - 7, w - 12, mon.lines.length * 13 + 10, 2);
      }
      p.textSize(9.5); p.textAlign(p.LEFT, p.TOP);
      for (var j = 0; j < mon.lines.length; j++) {
        var ln = mon.lines[j];
        p.fill(lineColor(p, ln.cls));
        p.text(ln.t, x + 12, top + j * 13);
      }
      /* Cursor del POST, mientras la prueba corre */
      if (seq && mon.mode === 'post' && Math.floor(p.frameCount / 18) % 2 === 0) {
        p.fill(43, 240, 122);
        p.rect(x + 12, top + mon.lines.length * 13 + 2, 7, 9);
      }
    }
  }

  function lineColor(p, cls) {
    if (cls === 'ok')   return p.color(143, 232, 179);
    if (cls === 'bad')  return p.color(255, 143, 160);
    if (cls === 'warn') return p.color(255, 198, 60);
    if (cls === 'dim')  return p.color(111, 138, 134);
    return p.color(185, 245, 207);
  }

  /** Scanlines + viñeta del tubo: el monitor se ve como un CRT. */
  function drawScanlines(p) {
    p.stroke(0, 0, 0, 58); p.strokeWeight(1);
    for (var y = 60; y < 262; y += 3) p.line(438, y, 740, y);
    p.noStroke();
    if (mon.mode !== 'off' && p.frameCount % 150 < 2) {
      p.fill(255, 255, 255, 14);
      p.rect(436, 58, 306, 206);
    }
  }

  /* ============================================================
     DIBUJO — selección, estados y etiquetas
     ============================================================ */
  function drawOverlays(p) {
    PARTS.forEach(function (part) {
      var st = status[part.id];
      var isHover = hover === part.id;
      var isSel = selected === part.id;
      var flash = hit[part.id] > 0;
      if (!st && !isHover && !isSel && !flash) return;
      if (part.inside && !openCase) return;       // adentro y cerrado: no se marca

      var col = st === 'bad'   ? p.color(255, 59, 82)
              : st === 'fixed' ? p.color(43, 240, 122)
              : st === 'ok'    ? p.color(79, 210, 255)
              : p.color(170, 190, 186);

      /* Marco de estado */
      p.noFill();
      p.stroke(col);
      p.strokeWeight(flash ? 3 : (isSel ? 2 : 1.4));
      p.rect(part.x - 5, part.y - 5, part.w + 10, part.h + 10, 3);

      /* Selección: marquesina punteada, como la del escritorio */
      if (isSel) {
        p.drawingContext.setLineDash([4, 3]);
        p.stroke(255, 255, 255, 190); p.strokeWeight(1);
        p.rect(part.x - 9, part.y - 9, part.w + 18, part.h + 18, 2);
        p.drawingContext.setLineDash([]);
      }

      /* Chapita con el estado */
      if (st || isHover) {
        var txt = st === 'bad' ? 'FALLA DETECTADA'
                : st === 'fixed' ? 'REPARADO'
                : st === 'ok' ? 'REVISADO · SIN NOVEDAD'
                : part.label;
        p.noStroke();
        p.textSize(8);
        var tw = p.textWidth(txt) + 12;
        var bx = Math.min(part.x - 5, W - tw - 4);
        var by = part.y - 22 < 4 ? part.y + part.h + 8 : part.y - 22;
        p.fill(6, 11, 14, 232);
        p.rect(bx, by, tw, 15, 2);
        p.fill(col);
        p.textAlign(p.LEFT, p.CENTER);
        p.text(txt, bx + 6, by + 8);
      }
      p.noStroke();
    });

    /* Modo "señalá la pieza": el cierre de la orden se hace sobre el equipo */
    if (pickMode) {
      p.fill(255, 198, 60, 232);
      p.rect(24, 400, 340, 24, 2);
      p.fill(16, 18, 10);
      p.textSize(9.5); p.textAlign(p.CENTER, p.CENTER);
      p.text('SEÑALÁ EN EL EQUIPO LA PIEZA QUE FALLÓ', 194, 412);
    }

    /* Aviso de prueba en curso */
    if (seq) {
      p.fill(6, 11, 14, 214);
      p.rect(420, 300, 338, 22, 2);
      p.fill(79, 210, 255);
      p.textSize(9); p.textAlign(p.CENTER, p.CENTER);
      p.text('PRUEBA EN CURSO — click para saltear', 589, 311);
    }
  }

  /** Las piezas de adentro se ven apagadas mientras el gabinete está cerrado. */
  function alphaOf(id) {
    var part = byId[id];
    if (!part || !part.inside) return 255;
    return openCase ? 255 : 90;
  }

  /** Aspas girando: un ventilador que gira es "el equipo tiene corriente". */
  function spinner(p, cx, cy, r, blades, speed, a) {
    if (a === undefined) a = 255;
    var ang = speed ? (p.frameCount * speed * 0.04) : 0.6;
    p.push();
    p.translate(cx, cy);
    p.rotate(ang);
    p.stroke(127, 195, 224, a * (speed ? 1 : 0.6));
    p.strokeWeight(1.4);
    for (var i = 0; i < blades; i++) {
      var th = (Math.PI * 2 / blades) * i;
      p.line(0, 0, Math.cos(th) * r, Math.sin(th) * r);
    }
    p.pop();
    p.noStroke();
  }

  /* ============================================================
     Hit testing
     ============================================================ */
  function pick(x, y) {
    for (var i = 0; i < PARTS.length; i++) {
      var part = PARTS[i];
      if (part.inside && !openCase) continue;     // cerrado: el interior no se toca
      if (inRect(x, y, part.x - 5, part.y - 5, part.w + 10, part.h + 10)) return part.id;
    }
    return null;
  }

  function inRect(x, y, rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
  }

})(window, document);
