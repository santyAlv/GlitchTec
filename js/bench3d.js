/* ============================================================
   Glitch.TEC — BANCO DE TRABAJO EN 3D (p5.js / WEBGL)
   ------------------------------------------------------------
   El sector de hardware es una escena 3D: un escritorio con el
   equipo del cliente y un monitor de prueba. La cámara no camina:
   está sentada frente al banco y sólo se acerca a lo que estás
   trabajando, como cuando te sentás a arreglar una máquina.

   Lo que se puede hacer sobre el equipo:
     · agarrar una herramienta de la mesa (destornillador, aire
       comprimido, pasta térmica, tester, disco de respaldo)
     · sacar la tapa lateral con el destornillador
     · girar el gabinete para llegar a los conectores de atrás
     · sacar y volver a poner componentes (RAM, placa de video,
       disco, fuente)
     · soplarle el polvo al disipador
     · pasar la ficha del monitor al puerto que corresponde
     · encender y mirar qué hace la pantalla

   Cómo está armado:
     - Toda la escena son cajas (p5 box) ubicadas en coordenadas
       del mundo. El gabinete tiene sus piezas en coordenadas
       LOCALES y el banco las pasa a mundo según cómo esté girado.
     - El click no usa lectura de píxeles: se proyectan las ocho
       esquinas de cada pieza a la pantalla con las mismas
       matrices que usa la cámara, y gana la más cercana. Así el
       mismo cálculo sirve para poner los carteles en HTML encima
       del canvas, que quedan nítidos y se pueden leer.
     - La pantalla del monitor es una textura: un p5.Graphics 2D
       que se redibuja en cada cuadro con el POST, el escritorio
       o el cartel de "sin señal".

   El módulo no sabe nada de órdenes de trabajo ni de puntaje:
   avisa qué se tocó (onSelect / onTool / onPower) y reproduce la
   prueba que le piden. La lógica del taller vive en tech.js.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var bench = GT.bench = {};

  /* ============================================================
     1. Matrices
     Las mismas cuentas que hace la cámara de p5, pero en JS, para
     poder proyectar un punto del mundo a la pantalla.
     ============================================================ */
  function mat4() { return new Float32Array(16); }

  function perspective(out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) * nf; out[11] = -1;
    out[12] = 0; out[13] = 0; out[14] = 2 * far * near * nf; out[15] = 0;
    return out;
  }

  function lookAt(out, eye, center, up) {
    var z0 = eye[0] - center[0], z1 = eye[1] - center[1], z2 = eye[2] - center[2];
    var len = Math.hypot(z0, z1, z2) || 1;
    z0 /= len; z1 /= len; z2 /= len;

    var x0 = up[1] * z2 - up[2] * z1,
        x1 = up[2] * z0 - up[0] * z2,
        x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2) || 1;
    x0 /= len; x1 /= len; x2 /= len;

    var y0 = z1 * x2 - z2 * x1,
        y1 = z2 * x0 - z0 * x2,
        y2 = z0 * x1 - z1 * x0;

    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
  }

  function mul(out, a, b) {
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] +
                         a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  var VP = mat4(), VIEW = mat4(), PROJ = mat4();

  /** Punto del mundo -> pixel del canvas. Devuelve null si quedó atrás. */
  function project(x, y, z, w, h) {
    var cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12];
    var cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13];
    var cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (cw <= 0.0001) return null;
    return { x: (cx / cw * 0.5 + 0.5) * w, y: (cy / cw * 0.5 + 0.5) * h, d: cw };
  }

  /* ============================================================
     2. La escena
     Medidas en "milímetros de juguete": el gabinete mide 300 de
     fondo, 360 de alto y 180 de ancho.
     ============================================================ */
  var CASE = { x: -150, y: -180, z: 0 };     // centro del gabinete (el piso del escritorio es y = 0)
  var MON  = { x: 185, y: -150, z: -30 };    // centro del monitor

  /* Piezas, en coordenadas locales del gabinete.
     cara: dónde se trabaja la pieza —
       'interior' se ve con la tapa sacada y el gabinete de costado
       'frente'   se ve siempre de costado (panel de encendido)
       'atras'    se ve con el gabinete girado */
  var PARTS = [
    { id: 'fuente',  cara: 'interior', c: [-80, -128, -10], s: [122,  88, 132], label: 'FUENTE' },
    { id: 'placa',   cara: 'interior', c: [ 10,   50, -32], s: [262, 242,  14], label: 'PLACA MADRE' },
    { id: 'cooler',  cara: 'interior', c: [-25,    8,  14], s: [ 98,  98,  80], label: 'CPU + DISIPADOR' },
    { id: 'ram',     cara: 'interior', c: [ 78,   10, -10], s: [ 66, 120,  24], label: 'MEMORIA RAM' },
    { id: 'gpu',     cara: 'interior', c: [  5,  112,  -4], s: [212,  26,  70], label: 'PLACA DE VIDEO' },
    { id: 'disco',   cara: 'interior', c: [105,  140, -26], s: [ 76,  64,  70], label: 'DISCO' },
    { id: 'boton',   cara: 'frente',   c: [152, -150,  10], s: [ 14,  70,  80], label: 'PANEL FRONTAL' },
    { id: 'fuente',  cara: 'atras',    c: [-154,-150,  22], s: [ 14,  76,  72], label: 'FUENTE (ATRÁS)' },
    { id: 'cable',   cara: 'atras',    c: [-154,-150, -48], s: [ 14,  76,  74], label: 'ALIMENTACIÓN' },
    { id: 'monitor', cara: 'atras',    c: [-154,  70, -10], s: [ 14,  96,  92], label: 'PUERTOS DE VIDEO' }
  ];

  /* Herramientas sobre la mesa. Se agarran con un click. */
  var TOOLS = [
    { id: 'destornillador', x: -236, label: 'DESTORNILLADOR', col: [196,  84,  52] },
    { id: 'aire',           x: -126, label: 'AIRE COMPRIMIDO', col: [ 70, 150, 190] },
    { id: 'pasta',          x:  -16, label: 'PASTA TÉRMICA',   col: [205, 205, 210] },
    { id: 'tester',         x:   94, label: 'TESTER',          col: [220, 170,  40] },
    { id: 'respaldo',       x:  204, label: 'DISCO DE RESPALDO', col: [120, 190, 130] }
  ];

  var TOOL_NAME = {};
  TOOLS.forEach(function (t) { TOOL_NAME[t.id] = t.label; });
  TOOL_NAME.mano = 'MANO';

  /* Vistas de la cámara: el jugador no camina, se acerca. */
  var VIEWS = {
    general:  { eye: [ 240, -265, 790 ], at: [  10, -125, -10 ] },
    gabinete: { eye: [ 130, -245, 660 ], at: [-140, -150,   0 ] },
    interior: { eye: [ -50, -220, 610 ], at: [-152, -135, -15 ] },
    monitor:  { eye: [ 265, -190, 540 ], at: [ 195, -150, -20 ] },
    atras:    { eye: [ -55, -230, 600 ], at: [-152, -148,   0 ] }
  };

  /* ============================================================
     3. Estado del banco
     ============================================================ */
  var sketch = null, host = null, labelLayer = null, screenTex = null;

  var yaw = 0;              // giro del gabinete: 0 = de costado, -90° = de atrás
  var yawTarget = 0;
  var dragging = false, dragX = 0, dragYaw = 0, dragged = false;

  var panel = 0;            // tapa lateral: 0 puesta, 1 sacada
  var panelTarget = 0;

  var view = 'general', camEye = VIEWS.general.eye.slice(), camAt = VIEWS.general.at.slice();

  var status = {};          // zona -> 'ok' | 'bad' | 'fixed'
  var anim = {};            // pieza -> 0..1 (sale y vuelve del zócalo)
  var hover = null, selected = null, held = 'mano';
  var dust = true;          // polvo en el disipador
  var videoOnGpu = false;   // dónde está enchufada la ficha del monitor
  var pickMode = false;
  var fansOn = false, ledOn = false;
  var hitboxes = [];        // cajas en coordenadas de mundo, recalculadas por cuadro

  var mon = { mode: 'off', osd: null, lines: [], temp: null };
  var seq = null, seqIdx = 0, seqT0 = 0, seqDone = null;

  bench.onSelect = null;    // function (zona)
  bench.onPower = null;     // function ()
  bench.onTool = null;      // function (herramienta)

  /* ============================================================
     4. Montaje
     ============================================================ */
  bench.mount = function (hostId) {
    if (typeof window.p5 === 'undefined') {
      console.warn('[Glitch.TEC] p5.js no cargó: el banco 3D queda sin dibujar.');
      return;
    }
    host = document.getElementById(hostId);
    if (!host || sketch) return;

    /* Los carteles van en HTML encima del canvas: el texto 3D de p5
       necesita una fuente cargada y además se lee peor. */
    labelLayer = document.createElement('div');
    labelLayer.className = 'rig-labels';
    host.appendChild(labelLayer);

    sketch = new window.p5(function (p) {

      p.setup = function () {
        var c = p.createCanvas(900, 520, p.WEBGL);
        c.parent(host);
        host.insertBefore(c.elt, labelLayer);
        p.pixelDensity(1);
        p.setAttributes('antialias', true);
        screenTex = p.createGraphics(512, 384);
        screenTex.pixelDensity(1);
        screenTex.textFont('monospace');
        fit(p);
      };

      p.windowResized = function () { fit(p); };

      function fit(pp) {
        if (!host) return false;
        var w = host.clientWidth;
        if (w < 40) return false;
        var h = Math.round(Math.min(560, Math.max(320, w * 0.58)));
        if (pp.width !== w || pp.height !== h) pp.resizeCanvas(w, h);
        return true;
      }

      p.draw = function () {
        if (!fit(p)) return;

        stepAnims(p);
        advanceSeq();
        paintScreen();

        /* Cámara: se acomoda sola hacia la vista elegida. */
        var v = VIEWS[view] || VIEWS.general;
        for (var i = 0; i < 3; i++) {
          camEye[i] += (v.eye[i] - camEye[i]) * 0.12;
          camAt[i] += (v.at[i] - camAt[i]) * 0.12;
        }

        var fov = 50 * Math.PI / 180;
        p.perspective(fov, p.width / p.height, 10, 4000);
        p.camera(camEye[0], camEye[1], camEye[2], camAt[0], camAt[1], camAt[2], 0, 1, 0);

        perspective(PROJ, fov, p.width / p.height, 10, 4000);
        lookAt(VIEW, camEye, camAt, [0, 1, 0]);
        mul(VP, PROJ, VIEW);

        p.background(9, 14, 18);
        lights(p);

        buildHitboxes();
        drawRoom(p);
        drawDesk(p);
        drawTools(p);
        drawMonitor(p);
        drawCase(p);
        drawSelection(p);
        paintLabels(p);
      };

      /* ---------------- Mouse ---------------- */
      p.mousePressed = function () {
        if (!inCanvas(p)) return;
        if (seq) { skipSeq(); return; }

        dragging = true; dragged = false;
        dragX = p.mouseX; dragYaw = yaw;
      };

      p.mouseDragged = function () {
        if (!dragging) return;
        /* Arrastrar sobre el equipo lo gira: así se llega a los conectores
           de atrás sin menúes. */
        var d = p.mouseX - dragX;
        if (Math.abs(d) > 6) dragged = true;
        if (dragged) yaw = constrainYaw(dragYaw + d * 0.35);
      };

      p.mouseReleased = function () {
        if (!dragging) return;
        dragging = false;

        if (dragged) {                       // soltó después de girar: se acomoda
          yawTarget = (yaw > 45) ? 90 : 0;
          return;
        }
        if (!inCanvas(p)) return;
        clickAt(p.mouseX, p.mouseY);
      };

      p.mouseMoved = function () {
        if (!inCanvas(p)) { hover = null; return; }
        var h = pickAt(p.mouseX, p.mouseY);
        hover = h ? h.id : null;
        host.style.cursor = h ? 'pointer' : 'default';
      };

      function inCanvas(pp) {
        return pp.mouseX >= 0 && pp.mouseY >= 0 && pp.mouseX <= pp.width && pp.mouseY <= pp.height;
      }
    });
  };

  bench.destroy = function () {
    if (sketch) { sketch.remove(); sketch = null; }
    if (labelLayer && labelLayer.parentNode) labelLayer.parentNode.removeChild(labelLayer);
    labelLayer = null; host = null;
  };

  function constrainYaw(v) { return Math.max(0, Math.min(90, v)); }

  /** Lado del gabinete que está mirando a la cámara. */
  function facing() { return yaw > 45 ? 'atras' : 'lado'; }

  /* ============================================================
     5. API para tech.js
     ============================================================ */
  bench.reset = function () {
    status = {}; anim = {};
    hover = null; selected = null; held = 'mano';
    yaw = 0; yawTarget = 0; panel = 0; panelTarget = 0;
    dust = true; videoOnGpu = false; pickMode = false;
    fansOn = false; ledOn = false;
    seq = null;
    view = 'general';
    mon = { mode: 'off', osd: null, lines: [], temp: null };
  };

  bench.setStatus = function (zone, st) { if (zone) status[zone] = st; };
  bench.statusOf = function (zone) { return status[zone] || null; };
  bench.setOpen = function (v) { panelTarget = v ? 1 : 0; if (v) bench.look('interior'); };
  bench.isOpen = function () { return panelTarget === 1; };
  bench.select = function (zone) { selected = zone || null; };
  bench.selected = function () { return selected; };
  bench.setPickMode = function (v) { pickMode = !!v; };
  bench.has = function (zone) { return PARTS.some(function (p) { return p.id === zone; }); };
  bench.labelOf = function (zone) {
    var f = PARTS.filter(function (p) { return p.id === zone; })[0];
    return f ? f.label : '';
  };
  bench.isBusy = function () { return !!seq; };

  /** Herramienta en la mano. 'mano' es no tener ninguna. */
  bench.hold = function (tool) {
    held = tool || 'mano';
    if (typeof bench.onTool === 'function') bench.onTool(held);
  };
  bench.held = function () { return held; };
  bench.toolName = function (t) { return TOOL_NAME[t] || 'MANO'; };
  bench.tools = function () { return TOOLS.slice(); };

  /** Vista de la cámara: 'general' | 'gabinete' | 'interior' | 'monitor'. */
  bench.look = function (v) { if (VIEWS[v]) view = v; };
  bench.view = function () { return view; };

  /** Gira el gabinete para ver la parte de atrás (o volver). */
  bench.turn = function (toBack) {
    yawTarget = (toBack === undefined) ? (yawTarget === 0 ? 90 : 0) : (toBack ? 90 : 0);
    /* Girarlo sirve para llegar a los conectores: la cámara acompaña. */
    bench.look(yawTarget === 90 ? 'atras' : (panelTarget ? 'interior' : 'gabinete'));
    return yawTarget !== 0;
  };
  bench.facingBack = function () { return yawTarget === 90; };

  /** Efectos de las acciones del taller sobre la escena. */
  bench.cleanDust = function () { dust = false; };
  bench.plugVideoToGpu = function () { videoOnGpu = true; };
  bench.pullPart = function (id) { anim[id] = 1; };     // sale del zócalo y vuelve

  /* ============================================================
     6. Luces y sala
     ============================================================ */
  /** Color de una superficie: con luces, p5 usa fill() como color difuso
      y ambientMaterial() como color de ambiente. Hay que dar los dos o
      todo sale blanco. */
  function mat(p, r, g, b) {
    p.fill(r, g, b);
    p.ambientMaterial(r, g, b);
  }

  function lights(p) {
    /* Poca luz de ambiente y una lámpara arriba a la izquierda: así las
       caras del gabinete se diferencian y la escena se lee en volumen. */
    p.ambientLight(54, 58, 62);
    p.directionalLight(196, 202, 192, -0.45, 0.72, -0.38);
    p.pointLight(110, 140, 128, -240, -520, 420);
    p.pointLight(64, 72, 78, 220, -260, 640);   // relleno desde el banco
  }

  function drawRoom(p) {
    p.push();
    p.noStroke();
    p.translate(0, -320, -480);
    mat(p, 20, 30, 36);
    p.box(2000, 1200, 20);
    p.pop();
  }

  function drawDesk(p) {
    p.push();
    p.noStroke();
    p.translate(0, 14, 10);
    mat(p, 84, 62, 42);
    p.box(1000, 28, 520);
    p.pop();

    /* Alfombrilla del banco: marca dónde se apoya el equipo */
    p.push();
    p.noStroke();
    p.translate(-150, -1, 20);
    mat(p, 24, 40, 40);
    p.box(430, 4, 410);
    p.pop();
  }

  /* ============================================================
     7. Herramientas
     ============================================================ */
  function drawTools(p) {
    TOOLS.forEach(function (t) {
      var isHeld = (held === t.id);
      var isHover = (hover === 'tool:' + t.id);
      p.push();
      p.noStroke();
      p.translate(t.x, isHeld ? -40 : -8, 190);
      if (isHeld) p.rotateZ(-0.5);
      mat(p, t.col[0], t.col[1], t.col[2]);

      if (t.id === 'destornillador') {
        p.box(14, 16, 74);                       // mango
        p.push(); p.translate(0, 0, -62); mat(p, 190, 195, 200);
        p.box(6, 6, 54); p.pop();
      } else if (t.id === 'aire') {
        p.box(30, 54, 30);
        p.push(); p.translate(0, -36, 0); mat(p, 150, 160, 170);
        p.box(8, 24, 8); p.pop();
      } else if (t.id === 'pasta') {
        p.box(16, 18, 76);
      } else if (t.id === 'tester') {
        p.box(54, 20, 76);
        p.push(); p.translate(0, -11, -10); mat(p, 60, 80, 70);
        p.box(34, 2, 30); p.pop();
      } else {
        p.box(64, 16, 84);
      }

      if (isHover || isHeld) {
        p.push(); p.noFill(); p.stroke(255, 212, 90); p.strokeWeight(1.5);
        p.box(78, 62, 104); p.pop();
      }
      p.pop();
    });
  }

  /* ============================================================
     8. El gabinete y sus piezas
     ============================================================ */
  function drawCase(p) {
    p.push();
    p.translate(CASE.x, CASE.y, CASE.z);
    p.rotateY(yaw * Math.PI / 180);
    p.noStroke();

    /* Chasis: cinco caras (la lateral se saca aparte) */
    p.push(); mat(p, 44, 56, 66);
    p.translate(0, 0, -92); p.box(300, 360, 10); p.pop();      // lado cerrado
    p.push(); mat(p, 36, 46, 56);
    p.translate(-152, 0, 0); p.box(10, 360, 184); p.pop();     // atrás
    p.push(); mat(p, 58, 70, 80);
    p.translate(152, 0, 0); p.box(10, 360, 184); p.pop();      // frente
    p.push(); mat(p, 40, 52, 62);
    p.translate(0, -182, 0); p.box(300, 10, 184); p.pop();     // techo
    p.push(); mat(p, 34, 44, 54);
    p.translate(0, 182, 0); p.box(300, 10, 184); p.pop();      // piso

    /* Detalle del frente: bahías de disquetera y CD, rejilla y patas.
       Es lo que se ve cuando el equipo entra al taller. */
    p.push(); mat(p, 78, 88, 96);
    p.translate(158, -78, 20); p.box(4, 26, 110); p.pop();
    p.push(); mat(p, 78, 88, 96);
    p.translate(158, -34, 20); p.box(4, 16, 90); p.pop();
    p.push(); mat(p, 30, 40, 48);
    for (var v = 0; v < 6; v++) {
      p.push(); p.translate(158, 60 + v * 16, 10); p.box(3, 7, 120); p.pop();
    }
    p.pop();
    p.push(); mat(p, 26, 32, 38);
    p.translate(-110, 190, 60); p.box(50, 14, 50); p.pop();
    p.push(); mat(p, 26, 32, 38);
    p.translate(110, 190, 60); p.box(50, 14, 50); p.pop();

    drawPsu(p);
    drawBoard(p);
    drawCooler(p);
    drawRam(p);
    drawGpu(p);
    drawDisk(p);
    drawFront(p);
    drawBack(p);

    p.pop();

    drawSidePanel(p);
  }

  /* La tapa se dibuja aparte, en coordenadas del mundo: cuando se
     desatornilla se va del gabinete y queda apoyada en la mesa, al
     costado, como cuando trabajás de verdad. */
  function drawSidePanel(p) {
    var puesta = toWorld([0, 0, 96]);
    var apoyada = [-368, -16, 150];      // acostada sobre la mesa, al costado
    var k = panel;

    p.push();
    p.translate(
      puesta[0] + (apoyada[0] - puesta[0]) * k,
      puesta[1] + (apoyada[1] - puesta[1]) * k,
      puesta[2] + (apoyada[2] - puesta[2]) * k
    );
    p.rotateY(yaw * Math.PI / 180 * (1 - k) + k * 0.35);
    p.rotateX(k * Math.PI / 2);
    p.rotateZ(k * 0.3);
    p.noStroke();

    mat(p, hover === 'tapa' ? 96 : 62, 78, 90);
    p.box(300, 360, 8);
    p.push(); mat(p, 40, 50, 58);
    p.translate(-120, 0, 6); p.box(14, 180, 5); p.pop();          // tirador
    p.push(); mat(p, 150, 158, 160);                              // tornillos
    p.translate(132, -150, 6); p.box(10, 10, 5); p.pop();
    p.push(); mat(p, 150, 158, 160);
    p.translate(132, 150, 6); p.box(10, 10, 5); p.pop();
    p.pop();
  }

  /** Color de la pieza según su estado en la orden de trabajo. */
  function matFor(p, id, base) {
    var st = status[id];
    if (st === 'bad') mat(p, base[0] + 80, base[1] - 20, base[2] - 14);
    else if (st === 'fixed') mat(p, base[0] - 12, base[1] + 56, base[2] + 10);
    else if (st === 'ok') mat(p, base[0], base[1] + 16, base[2] + 44);
    else mat(p, base[0], base[1], base[2]);
  }

  function offsetOf(id) { return (anim[id] || 0) * 70; }      // cuánto salió del zócalo

  function drawPsu(p) {
    p.push();
    p.translate(-80, -128, -10 + offsetOf('fuente'));
    matFor(p, 'fuente', [62, 74, 86]);
    p.box(120, 86, 130);
    p.push(); p.translate(0, 0, 66); mat(p, 40, 52, 60);
    p.box(80, 80, 4); p.pop();
    fan(p, 0, 0, 70, 34, 1.6);
    p.pop();
  }

  function drawBoard(p) {
    p.push();
    p.translate(10, 50, -32);
    matFor(p, 'placa', [26, 74, 54]);
    p.box(260, 240, 10);
    /* Zócalos y chips sueltos, para que se lea como una placa */
    p.push(); p.translate(-70, -80, 8); mat(p, 20, 52, 40); p.box(70, 50, 6); p.pop();
    p.push(); p.translate(90, 96, 8); mat(p, 20, 52, 40); p.box(60, 20, 6); p.pop();
    p.pop();
  }

  function drawCooler(p) {
    p.push();
    p.translate(-25, 8, 14 + offsetOf('cooler'));
    /* Con polvo encima, el disipador se ve opaco y sucio. */
    matFor(p, 'cooler', dust ? [78, 76, 64] : [70, 96, 118]);
    p.box(92, 92, 56);
    fan(p, 0, 0, 34, 30, 2.4);

    /* El polvo se ve: una manta parda sobre las aletas y pelusas sueltas */
    if (dust) {
      p.push();
      mat(p, 126, 106, 72);
      p.translate(0, -48, 2); p.box(100, 14, 66);
      p.translate(0, 10, 30); p.box(96, 70, 8);
      p.pop();

      p.push();
      mat(p, 112, 96, 68);
      [[-38, -58, 34], [26, -54, 36], [-10, 40, 34], [40, 20, 32]].forEach(function (f) {
        p.push(); p.translate(f[0], f[1], f[2]); p.box(14, 9, 7); p.pop();
      });
      p.pop();
    }
    p.pop();
  }

  function drawRam(p) {
    var off = offsetOf('ram');
    p.push();
    p.translate(78, 10 - off, -10);
    matFor(p, 'ram', [92, 66, 132]);
    p.push(); p.translate(-16, 0, 0); p.box(20, 116, 14); p.pop();
    p.push(); p.translate(16, 0, 0); p.box(20, 116, 14); p.pop();
    p.pop();
  }

  function drawGpu(p) {
    p.push();
    p.translate(5, 112, -4 + offsetOf('gpu'));
    matFor(p, 'gpu', [108, 54, 78]);
    p.box(208, 22, 66);
    p.push(); p.translate(40, 0, 8); mat(p, 60, 32, 46); p.box(90, 16, 46); p.pop();
    p.pop();
  }

  function drawDisk(p) {
    p.push();
    p.translate(105, 140, -26 + offsetOf('disco'));
    matFor(p, 'disco', [96, 88, 52]);
    p.box(72, 60, 66);
    p.pop();
  }

  /** Frente: botón de encendido y luz. */
  function drawFront(p) {
    p.push();
    p.translate(152, -150, 10);
    matFor(p, 'boton', [72, 86, 98]);
    p.box(12, 66, 76);

    p.push(); p.translate(8, -14, 0);
    mat(p, hover === 'power' ? 150 : 96, 110, 104);
    p.box(8, 22, 26); p.pop();

    p.push(); p.translate(8, 18, 0);
    if (ledOn) { p.fill(43, 240, 122); p.emissiveMaterial(43, 240, 122); } else { mat(p, 30, 48, 42); }
    p.box(6, 10, 10); p.pop();
    p.pop();
  }

  /** Atrás: entrada de corriente, interruptor y los dos puertos de video. */
  function drawBack(p) {
    /* Zona de la fuente */
    p.push();
    p.translate(-154, -150, 22);
    matFor(p, 'fuente', [58, 70, 82]);
    p.box(10, 72, 68);
    p.push(); p.translate(-6, -16, 0);
    mat(p, status.fuente === 'fixed' ? 90 : 60, 70, 66);
    p.box(4, 16, 24); p.pop();                       // interruptor 0 / I
    p.pop();

    /* Entrada de corriente + cable que se va a la pared */
    p.push();
    p.translate(-154, -150, -48);
    matFor(p, 'cable', [52, 64, 76]);
    p.box(10, 72, 70);
    p.push(); p.translate(-14, 0, 0); mat(p, 44, 52, 60);
    p.box(22, 26, 30); p.pop();
    p.pop();

    /* Puertos de video: el de la placa madre y el de la placa de video */
    p.push();
    p.translate(-154, 70, -10);
    matFor(p, 'monitor', [56, 68, 80]);
    p.box(10, 92, 90);
    p.push(); p.translate(-6, -30, 0);
    mat(p, videoOnGpu ? 50 : 150, 130, 60); p.box(4, 18, 40); p.pop();   // puerto placa madre
    p.push(); p.translate(-6, 26, 0);
    mat(p, videoOnGpu ? 150 : 50, 130, 60); p.box(4, 18, 46); p.pop();   // puerto placa de video
    p.pop();
  }

  /** Aspas girando: un ventilador que gira es "el equipo tiene corriente". */
  function fan(p, x, y, z, r, speed) {
    p.push();
    p.translate(x, y, z);
    p.rotateZ(fansOn ? (p.frameCount * speed * 0.05) : 0.4);
    mat(p, 150, 180, 196);
    for (var i = 0; i < 5; i++) {
      p.push();
      p.rotateZ(i * Math.PI * 2 / 5);
      p.translate(r * 0.5, 0, 0);
      p.box(r, 5, 3);
      p.pop();
    }
    p.pop();
  }

  /* ============================================================
     9. Monitor de prueba
     ============================================================ */
  function drawMonitor(p) {
    p.push();
    p.translate(MON.x, MON.y, MON.z);
    p.rotateY(-0.22);
    p.noStroke();

    matFor(p, 'monitor', [66, 78, 90]);
    p.box(330, 260, 46);                                  // carcasa

    p.push();                                             // pantalla
    p.translate(0, -6, 25);
    p.texture(screenTex);
    p.plane(286, 208);
    p.pop();

    p.push(); p.translate(0, 148, 0); mat(p, 54, 64, 74);
    p.box(70, 42, 60); p.pop();                           // cuello
    p.push(); p.translate(0, 172, 10); mat(p, 48, 58, 68);
    p.box(190, 14, 150); p.pop();                         // base
    p.pop();

    drawCables(p);
  }

  /** Un cable: una tira de puntos que cuelga entre dos extremos. */
  function cableRun(p, a, b, sag, col) {
    p.push();
    p.noStroke();
    mat(p, col[0], col[1], col[2]);
    for (var i = 0; i <= 16; i++) {
      var t = i / 16;
      p.push();
      p.translate(
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * sag,
        a[2] + (b[2] - a[2]) * t
      );
      p.sphere(5, 6, 4);
      p.pop();
    }
    p.pop();
  }

  /* Los dos cables que importan en el taller: el de alimentación, que
     va del gabinete al toma de la pared, y el de video, que se ve
     entrar al puerto de la placa madre o al de la placa de video. */
  function drawCables(p) {
    /* Toma de pared */
    p.push(); p.noStroke(); mat(p, 70, 78, 84);
    p.translate(-430, -150, -460); p.box(50, 70, 10); p.pop();

    var inlet = toWorld([-164, -150, -48]);
    cableRun(p, inlet, [-430, -140, -452], 40, [34, 40, 46]);

    /* Video: del monitor al puerto donde esté enchufado */
    var port = toWorld(videoOnGpu ? [-166, 96, -10] : [-166, 44, -10]);
    cableRun(p, [MON.x - 150, MON.y + 60, MON.z - 30], port, 55, [38, 46, 54]);
  }

  /** La pantalla es una textura 2D que se redibuja en cada cuadro. */
  function paintScreen() {
    var g = screenTex;
    if (!g) return;
    var W = g.width, H = g.height;

    g.push();
    g.background(5, 10, 9);

    if (mon.mode === 'off') {
      g.fill(110, 130, 126);
      g.textSize(17); g.textAlign(g.CENTER, g.CENTER);
      g.text('— apagado —', W / 2, H / 2 - 12);
      g.textSize(12); g.fill(92, 112, 110);
      g.text('apretá ENCENDER en el frente del gabinete', W / 2, H / 2 + 14);
      scan(g); g.pop(); return;
    }

    if (mon.mode === 'nosignal') {
      g.fill(12, 20, 28); g.stroke(70, 120, 150); g.strokeWeight(2);
      g.rect(W / 2 - 150, H / 2 - 44, 300, 88, 4);
      g.noStroke();
      g.fill(79, 210, 255);
      g.textSize(23); g.textAlign(g.CENTER, g.CENTER);
      g.text(mon.osd || 'SIN SEÑAL', W / 2, H / 2 - 12);
      g.textSize(13); g.fill(130, 180, 200);
      g.text('TEC-15"  ·  entrada VGA', W / 2, H / 2 + 20);
    }

    if (mon.mode === 'desktop') {
      g.noStroke();
      g.fill(30, 107, 102); g.rect(0, 0, W, H);
      g.fill(16, 58, 56); g.rect(0, H - 34, W, 34);
      g.fill(195, 199, 195); g.rect(8, H - 28, 96, 22, 2);
      g.fill(13, 17, 20); g.textSize(13); g.textAlign(g.LEFT, g.CENTER);
      g.text('Inicio', 20, H - 17);
      g.fill(195, 199, 195, 220);
      for (var i = 0; i < 3; i++) g.rect(20, 22 + i * 58, 38, 32, 2);

      if (mon.temp !== null) {
        var hot = mon.temp >= 85;
        g.fill(hot ? g.color(122, 16, 32) : g.color(13, 60, 56));
        g.rect(W - 180, 18, 160, 46, 3);
        g.fill(hot ? g.color(255, 170, 180) : g.color(140, 230, 190));
        g.textSize(16); g.textAlign(g.LEFT, g.CENTER);
        g.text('CPU  ' + mon.temp + ' °C', W - 166, 41);
      }
    }

    if (mon.lines.length) {
      var top = (mon.mode === 'desktop') ? H - 58 - mon.lines.length * 20 : 20;
      if (mon.mode === 'desktop') {
        g.fill(0, 0, 0, 170);
        g.rect(14, top - 12, W - 28, mon.lines.length * 20 + 18, 3);
      }
      g.textSize(14.5); g.textAlign(g.LEFT, g.TOP);
      for (var j = 0; j < mon.lines.length; j++) {
        var ln = mon.lines[j];
        g.fill(lineColor(g, ln.cls));
        g.text(ln.t, 24, top + j * 20);
      }
      if (seq && mon.mode === 'post' && Math.floor(Date.now() / 300) % 2 === 0) {
        g.fill(43, 240, 122);
        g.rect(24, top + mon.lines.length * 20 + 4, 11, 14);
      }
    }

    scan(g);
    g.pop();
  }

  function lineColor(g, cls) {
    if (cls === 'ok')   return g.color(143, 232, 179);
    if (cls === 'bad')  return g.color(255, 143, 160);
    if (cls === 'warn') return g.color(255, 198, 60);
    if (cls === 'dim')  return g.color(111, 138, 134);
    return g.color(185, 245, 207);
  }

  function scan(g) {
    g.stroke(0, 0, 0, 52); g.strokeWeight(1);
    for (var y = 0; y < g.height; y += 4) g.line(0, y, g.width, y);
    g.noStroke();
  }

  /* ============================================================
     10. Secuencias de prueba
     Cada una es la pantalla que mostraría el equipo con esa falla.
     ============================================================ */
  var BIOS = [
    { at:   0, led: true, fans: true, mode: 'post' },
    { at: 260, line: 'WinTEC BIOS v4.51PG — TEC Systems', cls: 'dim' },
    { at: 560, line: 'CPU  : TEC 586 DX  ·  133 MHz' },
    { at: 860, line: 'Memoria: 640K base, 15360K extendida' }
  ];
  function withBios(rest) { return BIOS.concat(rest); }

  var SEQ = {
    muerta: [
      { at:    0, led: false, fans: false, mode: 'nosignal', osd: 'SIN SEÑAL' },
      { at:  700, line: '· sin luces, sin ventiladores, sin pitidos', cls: 'bad' },
      { at: 1500, line: '· el monitor enciende solo: no es el monitor', cls: 'dim' },
      { at: 2300, osd: 'SIN SEÑAL — REVISAR EQUIPO', mode: 'nosignal' }
    ],
    sin_senal: [
      { at:    0, led: true, fans: true, mode: 'nosignal', osd: 'SIN SEÑAL' },
      { at:  600, line: '· ventiladores girando, luz de encendido OK', cls: 'dim' },
      { at: 1400, line: '· el monitor no recibe nada por el cable', cls: 'bad' },
      { at: 2200, osd: 'SIN SEÑAL — VERIFICAR CABLE DE VIDEO' }
    ],
    post_ram: withBios([
      { at: 1200, beep: 'long',  line: 'Verificando memoria . . .', cls: 'dim' },
      { at: 1850, beep: 'short' },
      { at: 2150, beep: 'short', line: 'ERROR 0164 — fallo en el banco de memoria', cls: 'bad' },
      { at: 2900, line: '1 pitido largo + 2 cortos = RAM', cls: 'warn' },
      { at: 3500, line: 'POST DETENIDO. El equipo no llega a arrancar.', cls: 'bad' }
    ]),
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
    lenta: withBios([
      { at: 1200, beep: 'short', line: 'POST OK — 1 pitido corto', cls: 'ok' },
      { at: 1800, line: 'Disco  : TEC-HDD 500GB  (reintentando)', cls: 'warn' },
      { at: 2600, line: 'clic . . . clic . . . reintento de sector', cls: 'bad' },
      { at: 3400, mode: 'desktop' },
      { at: 4100, line: 'WinTEC no responde — uso de disco 100%', cls: 'bad' }
    ]),
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

  bench.screenTest = function (kind, done) {
    seq = SEQ[kind] || SEQ.ok;
    seqIdx = 0;
    seqT0 = Date.now();
    seqDone = done || null;
    mon.lines = []; mon.osd = null; mon.temp = null; mon.mode = 'black';
    bench.look('monitor');
  };

  function advanceSeq() {
    if (!seq) return;
    var t = Date.now() - seqT0;
    while (seqIdx < seq.length && seq[seqIdx].at <= t) { applyStep(seq[seqIdx]); seqIdx++; }
    if (seqIdx >= seq.length && t > seq[seq.length - 1].at + 900) endSeq();
  }

  function applyStep(st) {
    if (st.mode) mon.mode = st.mode;
    if (st.osd !== undefined) mon.osd = st.osd;
    if (st.led !== undefined) ledOn = st.led;
    if (st.fans !== undefined) fansOn = st.fans;
    if (st.temp !== undefined) mon.temp = st.temp;
    if (st.line) {
      mon.lines.push({ t: st.line, cls: st.cls || null });
      if (mon.lines.length > 8) mon.lines.shift();
    }
    if (st.beep && GT.audio && GT.audio.beep) GT.audio.beep(st.beep === 'long');
  }

  function skipSeq() {
    while (seqIdx < seq.length) { applyStep(seq[seqIdx]); seqIdx++; }
    endSeq();
  }

  function endSeq() {
    var cb = seqDone;
    seq = null; seqDone = null;
    if (cb) cb();
  }

  /* ============================================================
     11. Animaciones
     ============================================================ */
  function stepAnims(p) {
    var k = Math.min(0.2, (p.deltaTime || 16) / 260);

    yaw += (yawTarget - yaw) * (dragging ? 0 : k * 1.4);
    panel += (panelTarget - panel) * k;

    for (var id in anim) {
      anim[id] -= k * 0.9;
      if (anim[id] <= 0) delete anim[id];
    }
  }

  /* ============================================================
     12. Click y carteles
     Se proyectan las esquinas de cada caja a la pantalla: lo que
     está más cerca de la cámara gana el click.
     ============================================================ */
  function pushBox(id, zone, cx, cy, cz, sx, sy, sz, label) {
    hitboxes.push({ id: id, zone: zone, c: [cx, cy, cz], s: [sx, sy, sz], label: label });
  }

  /** Pasa un punto local del gabinete a coordenadas del mundo. */
  function toWorld(c) {
    var a = yaw * Math.PI / 180, s = Math.sin(a), co = Math.cos(a);
    return [
      CASE.x + c[0] * co + c[2] * s,
      CASE.y + c[1],
      CASE.z - c[0] * s + c[2] * co
    ];
  }

  function buildHitboxes() {
    hitboxes = [];
    var cara = facing();

    PARTS.forEach(function (part) {
      if (part.cara === 'interior' && (panel < 0.5 || cara !== 'lado')) return;
      if (part.cara === 'frente' && cara !== 'lado') return;
      if (part.cara === 'atras' && cara !== 'atras') return;

      var w = toWorld(part.c);
      /* Con el gabinete girado, el ancho y el fondo se intercambian. */
      var sx = (cara === 'atras') ? part.s[2] : part.s[0];
      var sz = (cara === 'atras') ? part.s[0] : part.s[2];
      pushBox(part.id, part.id, w[0], w[1], w[2], sx, part.s[1], sz, part.label);
    });

    /* El botón de encendido y la tapa, sólo con el equipo de costado */
    if (cara === 'lado') {
      var b = toWorld([160, -164, 10]);
      pushBox('power', null, b[0], b[1], b[2], 26, 30, 34, 'ENCENDER');

      if (panel < 0.5) {
        var t = toWorld([0, 0, 92]);
        pushBox('tapa', 'placa', t[0], t[1], t[2], 300, 360, 12, 'TAPA LATERAL');
      }
    }

    /* El monitor */
    pushBox('monitor', 'monitor', MON.x, MON.y, MON.z, 330, 260, 60, 'MONITOR');

    /* Las herramientas sobre la mesa */
    TOOLS.forEach(function (t) {
      pushBox('tool:' + t.id, null, t.x, -22, 190, 86, 56, 96, t.label);
    });
  }

  /** Rectángulo en pantalla que ocupa una caja del mundo. */
  function screenRect(box, w, h) {
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, depth = 0, n = 0;
    for (var i = 0; i < 8; i++) {
      var pt = project(
        box.c[0] + ((i & 1) ? 0.5 : -0.5) * box.s[0],
        box.c[1] + ((i & 2) ? 0.5 : -0.5) * box.s[1],
        box.c[2] + ((i & 4) ? 0.5 : -0.5) * box.s[2], w, h);
      if (!pt) continue;
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
      depth += pt.d; n++;
    }
    if (!n) return null;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, d: depth / n };
  }

  function pickAt(mx, my) {
    var w = sketch.width, h = sketch.height, best = null, bestD = 1e9;
    for (var i = 0; i < hitboxes.length; i++) {
      var r = screenRect(hitboxes[i], w, h);
      if (!r) continue;
      if (mx < r.x || my < r.y || mx > r.x + r.w || my > r.y + r.h) continue;
      if (r.d < bestD) { bestD = r.d; best = hitboxes[i]; }
    }
    return best;
  }

  function clickAt(mx, my) {
    var box = pickAt(mx, my);
    if (!box) return;

    if (box.id === 'power') {
      if (typeof bench.onPower === 'function') bench.onPower();
      return;
    }
    if (box.id.indexOf('tool:') === 0) {
      var t = box.id.slice(5);
      bench.hold(held === t ? 'mano' : t);
      if (GT.audio) GT.audio.click();
      return;
    }
    if (box.zone && typeof bench.onSelect === 'function') bench.onSelect(box.zone);
  }

  /* Marco de la pieza apuntada o elegida */
  function drawSelection(p) {
    hitboxes.forEach(function (box) {
      var isHover = hover === box.id;
      var isSel = box.zone && selected === box.zone;
      var st = box.zone ? status[box.zone] : null;
      if (!isHover && !isSel && !st) return;

      p.push();
      p.noFill();
      p.strokeWeight(isSel ? 2.5 : 1.5);
      if (st === 'bad') p.stroke(255, 59, 82);
      else if (st === 'fixed') p.stroke(43, 240, 122);
      else if (st === 'ok') p.stroke(79, 210, 255);
      else p.stroke(255, 255, 255, 150);
      p.translate(box.c[0], box.c[1], box.c[2]);
      p.box(box.s[0] + 8, box.s[1] + 8, box.s[2] + 8);
      p.pop();
    });
  }

  /* Los carteles van en HTML: se leen mejor y no necesitan fuente 3D */
  function paintLabels(p) {
    if (!labelLayer) return;

    var items = [];
    hitboxes.forEach(function (box) {
      var isHover = hover === box.id;
      var isSel = box.zone && selected === box.zone;
      var st = box.zone ? status[box.zone] : null;
      if (!isHover && !isSel && !st) return;

      var r = screenRect(box, p.width, p.height);
      if (!r) return;

      var txt = st === 'bad' ? box.label + ' · FALLA'
              : st === 'fixed' ? box.label + ' · REPARADO'
              : st === 'ok' ? box.label + ' · SIN NOVEDAD'
              : box.label;
      items.push({
        x: Math.round(r.x + r.w / 2), y: Math.round(r.y - 6),
        txt: txt, cls: st ? ('is-' + st) : (isSel ? 'is-sel' : '')
      });
    });

    var html = items.map(function (it) {
      return '<span class="rig-tag ' + it.cls + '" style="left:' + it.x + 'px;top:' + it.y + 'px">' +
             it.txt + '</span>';
    }).join('');

    if (held !== 'mano') {
      html += '<span class="rig-tool">EN LA MANO: ' + TOOL_NAME[held] + '</span>';
    }
    if (pickMode) {
      html += '<span class="rig-banner">SEÑALÁ EN EL EQUIPO LA PIEZA QUE FALLÓ</span>';
    } else if (seq) {
      html += '<span class="rig-banner">PRUEBA EN CURSO — click para saltear</span>';
    }

    if (labelLayer.innerHTML !== html) labelLayer.innerHTML = html;
  }

})(window, document);
