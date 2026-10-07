/* ============================================================
   Glitch.TEC — Motor p5.js (Processing)
   Capa de renderizado generativo. El HTML/CSS maneja la UI
   interactiva; p5.js dibuja los efectos visuales procedurales:
     1. Fondo CRT del escritorio (scanlines + ruido + glitches)
     2. Gráficos en vivo de CPU/RAM en el Administrador de tareas
     3. Núcleo del malware en la purga final
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var engine = GT.engine = {};

  /* ============================================================
     1. FONDO CRT DEL ESCRITORIO
     Un p5 instance mode montado detrás de la capa de iconos.
     ============================================================ */
  var crtSketch = null;

  /* RECORDATORIO p5: hay dos formas de usar Processing en la web.
       - modo GLOBAL: escribo setup() y draw() sueltas y p5 las busca en window.
         Comodo para un sketch solo, pero me pisa nombres globales y SOLO
         admite un sketch por pagina.
       - modo INSTANCE (el que uso): le paso a new p5() una funcion que recibe
         "p", y todo lo de p5 se usa como p.algo(). Es mas verboso (p.rect en
         vez de rect) pero me deja tener TRES sketches vivos a la vez (fondo
         CRT + medidores + nucleo) sin que se pisen entre ellos.
     El segundo argumento de new p5(fn, elemento) es el nodo del DOM donde va
     a colgar el canvas. */
  engine.startCrt = function () {
    /* Defensa: si p5.min.js no cargo (ruta mal, sin internet, lo que sea) NO
       quiero que explote todo el juego. Aviso por consola y sigo: el escritorio
       funciona igual, solo que sin el efecto de television vieja. */
    if (typeof window.p5 === 'undefined') {
      console.warn('[Glitch.TEC] p5.js no cargó; el motor visual queda desactivado.');
      return;
    }
    if (crtSketch) return;                  // ya esta montado, no duplico canvas

    var host = document.getElementById('desktop');
    if (!host) return;

    // Contenedor dedicado detrás de iconos/ventanas
    var wrap = document.createElement('div');
    wrap.id = 'p5-crt';
    wrap.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.55;';
    host.insertBefore(wrap, host.firstChild);

    crtSketch = new window.p5(function (p) {
      /* Estas variables viven DENTRO del sketch (clausura): son el estado
         privado de la animacion, nadie de afuera las puede tocar. */
      var particles = [];                   // la "estatica" que cae
      var tearY = -40;                      // barra de tearing; arranca arriba
      var noiseSeed = 0;                    //  y fuera de pantalla (-40)

      /* setup() corre UNA sola vez, apenas se crea el sketch. */
      p.setup = function () {
        var c = p.createCanvas(host.clientWidth, host.clientHeight);
        c.parent(wrap);
        /* pixelDensity(1) = no dibujar en alta resolucion en pantallas Retina.
           Pierdo nitidez pero gano MUCHO rendimiento (dibujar al doble de
           resolucion es dibujar 4 veces mas pixeles), y para un efecto de
           monitor viejo con scanlines el pixelado hasta suma. */
        p.pixelDensity(1);
        p.noStroke();
        /* Precalculo las 28 particulas una vez y despues solo les muevo la Y.
           Crearlas y destruirlas en cada frame seria tirar basura al recolector
           60 veces por segundo al pedo. */
        for (var i = 0; i < 28; i++) {
          particles.push({
            x: p.random(p.width),
            y: p.random(p.height),
            s: p.random(1, 3),
            v: p.random(0.2, 1.4),
            a: p.random(40, 120)
          });
        }
      };

      p.windowResized = function () { fitCanvas(); };

      /* El escritorio arranca oculto (display:none), asi que al crear el
         sketch mide 0x0. Hay que re-medirlo cuando la pantalla aparece:
         si no, el canvas queda en cero y ademas p.copy() rompe.

         Este fue un bug real y me costo encontrarlo: un elemento con
         display:none mide clientWidth = 0. Como monto el sketch al cargar la
         pagina (cuando todavia se ve el menu), el canvas nacia de 0x0 y nunca
         se agrandaba. La solucion es preguntar el tamano en CADA frame y
         redimensionar solo cuando cambio de verdad; devuelvo false mientras
         siga oculto para que draw() corte antes de dibujar al vacio. */
      function fitCanvas() {
        var w = host.clientWidth, h = host.clientHeight;
        if (w < 2 || h < 2) return false;
        if (p.width !== w || p.height !== h) p.resizeCanvas(w, h);
        return true;
      }

      p.draw = function () {
        if (!fitCanvas()) return;              // pantalla oculta: no hay nada que dibujar

        /* TODO el efecto se maneja con UNA sola variable: la infeccion,
           normalizada de 0 a 1 (por eso el /100). Cuanto mas infectado el
           sistema, mas feo se ve todo. El "? :" con el 0.08 es el valor por
           defecto para cuando todavia no arranco ninguna partida. */
        var infection = (GT.state && typeof GT.getInfection === 'function')
          ? GT.getInfection() / 100 : 0.08;
        var running = GT.state && GT.state.running && !GT.state.finished;

        /* lerp = interpolacion lineal. lerp(a, b, t) devuelve a cuando t=0,
           b cuando t=1, y el punto intermedio para valores del medio.
           Aca lo uso como "mezclador de color": con infeccion 0 el fondo es
           azulado (18,42,68) y con infeccion 1 vira a rojo sucio (55,12,28).
           Fijate que el verde BAJA (42->12) mientras el rojo SUBE: eso es lo
           que hace que la pantalla se vaya pudriendo de a poco.
           El cuarto parametro (28) es alpha: al pintar el fondo semi-
           transparente, los frames anteriores quedan abajo y se genera el
           rastro/estela sin tener que guardar nada. */
        var r = p.lerp(18, 55, infection);
        var g = p.lerp(42, 12, infection);
        var b = p.lerp(68, 28, infection);
        p.background(r, g, b, 28);

        // Partículas de "estática"
        for (var i = 0; i < particles.length; i++) {
          var pt = particles[i];
          p.fill(180 + infection * 70, 220 - infection * 100, 200, pt.a * (0.4 + infection));
          p.rect(pt.x, pt.y, pt.s, pt.s);
          pt.y += pt.v + infection * 2;
          if (pt.y > p.height) { pt.y = -4; pt.x = p.random(p.width); }
        }

        // Scanlines
        p.stroke(0, 0, 0, 35 + infection * 40);
        p.strokeWeight(1);
        for (var y = 0; y < p.height; y += 3) {
          p.line(0, y, p.width, y);
        }
        p.noStroke();

        /* Barra de tearing: una franja clara que baja sin parar, como el
           "rolling" de los televisores viejos mal sincronizados. Cuando se va
           por abajo la teletransporto arriba (-40) y vuelve a empezar. Su
           velocidad y su opacidad tambien dependen de la infeccion. */
        if (running) {
          tearY += 2.2 + infection * 6;
          if (tearY > p.height + 40) tearY = -40;
          p.fill(255, 255, 255, 18 + infection * 40);
          p.rect(0, tearY, p.width, 8 + infection * 14);

          /* Glitch horizontal: p.random() devuelve un decimal entre 0 y 1, asi
             que "if (random() < X)" es literalmente "que pase con probabilidad
             X en este frame". Con infeccion 1 da 0.04 = 4% de los frames, o
             sea ~2 veces por segundo a 60fps. Con infeccion 0 nunca pasa.

             p.copy(sx,sy,sw,sh, dx,dy,dw,dh) copia un pedazo del canvas SOBRE
             si mismo, corrido unos pixeles al azar en X: eso es exactamente el
             corte desalineado tipico de una senal de video rota. */
          if (p.random() < infection * 0.04) {
            var gy = p.random(p.height);
            var gh = p.random(4, 28);
            p.copy(0, gy, p.width, gh, p.random(-20, 20), gy, p.width, gh);
          }
        }

        /* Vineta (bordes oscuros). p5 no trae degradados radiales, asi que
           me bajo al canvas 2D crudo: p.drawingContext ES el contexto nativo
           del navegador, el mismo que usaria con getContext('2d').
           El save()/restore() de los extremos es obligatorio: dejo el estado
           del contexto como lo encontre para no ensuciarle el fillStyle a p5
           en el proximo frame. */
        p.drawingContext.save();
        var grd = p.drawingContext.createRadialGradient(
          p.width / 2, p.height / 2, p.width * 0.25,
          p.width / 2, p.height / 2, p.width * 0.75
        );
        grd.addColorStop(0, 'rgba(0,0,0,0)');
        grd.addColorStop(1, 'rgba(0,0,0,' + (0.35 + infection * 0.35) + ')');
        p.drawingContext.fillStyle = grd;
        p.drawingContext.fillRect(0, 0, p.width, p.height);
        p.drawingContext.restore();

        noiseSeed += 0.01;
      };
    }, wrap);
  };

  /* ============================================================
     2. GRÁFICOS CPU / RAM (Administrador de tareas)
     ============================================================ */
  var meterSketch = null;
  /* Los graficos del Administrador de tareas son una "ventana deslizante":
     guardo los ultimos 60 valores y cada frame agrego uno al final y saco el
     primero (shift). Como el array nunca crece, el grafico avanza solo. */
  var cpuHistory = [];
  var ramHistory = [];
  var HISTORY = 60;                         // cuantas muestras entran a lo ancho

  engine.startMeters = function (containerId) {
    if (typeof window.p5 === 'undefined') return;
    /* Si ya habia un sketch de medidores (ventana cerrada y vuelta a abrir),
       lo destruyo ANTES de crear otro. Sin este remove() cada apertura dejaria
       un draw() corriendo a 60fps de fondo para siempre: la clasica fuga que
       hace que el juego se vaya poniendo lento sin motivo aparente. */
    if (meterSketch) {
      try { meterSketch.remove(); } catch (e) { /* ignore */ }
      meterSketch = null;
    }

    var host = document.getElementById(containerId);
    if (!host) return;

    cpuHistory = [];
    ramHistory = [];

    meterSketch = new window.p5(function (p) {
      p.setup = function () {
        var c = p.createCanvas(host.clientWidth || 300, 70);
        c.parent(host);
        p.pixelDensity(1);
        p.noFill();
      };

      p.draw = function () {
        p.background(11, 22, 16);

        var cpu = (GT.procs && GT.procs.getCpu) ? GT.procs.getCpu() : 0;
        var ramPct = 0;
        if (GT.procs && GT.procs.list) {
          var list = GT.procs.list();
          var r = 0;
          for (var i = 0; i < list.length; i++) r += list[i].ram;
          ramPct = Math.min(100, Math.round(r / 2048 * 100));
        }

        /* push al final + shift del principio = cinta transportadora.
           El array jamas pasa de 60 elementos. */
        cpuHistory.push(cpu);
        ramHistory.push(ramPct);
        if (cpuHistory.length > HISTORY) cpuHistory.shift();
        if (ramHistory.length > HISTORY) ramHistory.shift();

        drawSeries(p, cpuHistory, 0, 0, p.width, p.height / 2 - 2, [46, 227, 107], 'CPU');
        drawSeries(p, ramHistory, 0, p.height / 2 + 2, p.width, p.height / 2 - 2, [86, 216, 255], 'RAM');
      };
    }, host);
  };

  /* Dibuja UNA serie (la curva de CPU o la de RAM) dentro del rectangulo que
     le indico. La escribi generica para no tener el mismo codigo dos veces:
     le paso posicion, tamano, color y etiqueta, y la funcion no sabe ni le
     importa si esta dibujando CPU o RAM.

     push()/pop() + translate() es el truco clasico de Processing: muevo el
     ORIGEN de coordenadas (el 0,0) al rincon del rectangulo, dibujo como si
     empezara en cero, y al final pop() restaura todo. Asi me olvido de sumar
     "+x, +y" en cada vertice. */
  function drawSeries(p, data, x, y, w, h, rgb, label) {
    p.push();
    p.translate(x, y);
    p.noStroke();
    p.fill(15, 28, 22);
    p.rect(0, 0, w, h);

    // Grilla
    p.stroke(30, 50, 40, 120);
    p.strokeWeight(1);
    for (var gx = 0; gx < w; gx += 20) p.line(gx, 0, gx, h);
    for (var gy = 0; gy < h; gy += 14) p.line(0, gy, w, gy);

    if (data.length > 1) {
      p.noFill();
      p.stroke(rgb[0], rgb[1], rgb[2], 220);
      p.strokeWeight(1.5);
      /* La curva: un solo shape con un vertice por muestra.
           px: la posicion en el array (0..59) llevada a ancho real (0..w).
           py: el valor (0..100) llevado a alto real... PERO invertido con
               "h - ..." porque en pantalla la Y crece hacia ABAJO, y yo quiero
               que 100% quede arriba y 0% abajo. Ese "h -" es el error clasico
               de todo grafico hecho a mano. */
      p.beginShape();
      for (var i = 0; i < data.length; i++) {
        var px = (i / (HISTORY - 1)) * w;
        var py = h - (data[i] / 100) * h;
        p.vertex(px, py);
      }
      p.endShape();

      /* Relleno bajo la curva: repito los mismos puntos pero ahora cierro la
         figura bajando a la base (vertice en 0,h al empezar y en w,h al
         terminar) y uso endShape(CLOSE). Es la misma linea de arriba pero
         convertida en area. */
      p.fill(rgb[0], rgb[1], rgb[2], 40);
      p.noStroke();
      p.beginShape();
      p.vertex(0, h);
      for (var j = 0; j < data.length; j++) {
        p.vertex((j / (HISTORY - 1)) * w, h - (data[j] / 100) * h);
      }
      p.vertex(w, h);
      p.endShape(p.CLOSE);
    }

    p.fill(rgb[0], rgb[1], rgb[2]);
    p.noStroke();
    p.textSize(10);
    p.textFont('Consolas');
    var last = data.length ? data[data.length - 1] : 0;
    p.text(label + ' ' + last + '%', 6, 12);
    p.pop();
  }

  engine.stopMeters = function () {
    if (meterSketch) {
      try { meterSketch.remove(); } catch (e) { /* ignore */ }
      meterSketch = null;
    }
  };

  /* ============================================================
     3. NÚCLEO DEL MALWARE (purga final)
     ============================================================ */
  var coreSketch = null;
  var coreShake = 0;
  var coreHits = 0;

  engine.startCore = function (containerId) {
    if (typeof window.p5 === 'undefined') return;
    if (coreSketch) {
      try { coreSketch.remove(); } catch (e) { /* ignore */ }
      coreSketch = null;
    }

    var host = document.getElementById(containerId);
    if (!host) return;
    coreShake = 0;
    coreHits = 0;

    coreSketch = new window.p5(function (p) {
      var rings = [];
      for (var i = 0; i < 5; i++) {
        rings.push({ r: 10 + i * 8, speed: 0.02 + i * 0.008, phase: p.random(p.TWO_PI) });
      }

      p.setup = function () {
        var c = p.createCanvas(host.clientWidth || 620, 74);
        c.parent(host);
        p.pixelDensity(1);
      };

      p.draw = function () {
        p.background(5, 9, 12);
        var cx = p.width / 2 + (coreShake ? p.random(-coreShake, coreShake) : 0);
        var cy = p.height / 2 + (coreShake ? p.random(-coreShake, coreShake) : 0);
        if (coreShake > 0) coreShake *= 0.9;

        /* El nucleo "respira": pulse oscila alrededor de 1 y multiplica todos
           los tamanos. sin() va de -1 a 1; frameCount es el contador de frames
           de p5, asi que frameCount*0.08 es el reloj del latido (mas grande =
           mas rapido) y el 0.08 final es la amplitud (cuanto se infla).
           Lo multiplico por (hp/100) para que, a medida que le voy ganando al
           jefe, el latido se vaya apagando hasta quedar quieto. */
        var hp = (GT.boss && GT.boss.getHp) ? GT.boss.getHp() : 100;
        var pulse = 1 + p.sin(p.frameCount * 0.08) * 0.08 * (hp / 100);

        // Anillos orbitando
        for (var i = 0; i < rings.length; i++) {
          var rg = rings[i];
          rg.phase += rg.speed;
          p.noFill();
          p.stroke(255, 59, 82, 60 + (hp / 100) * 80);
          p.strokeWeight(1);
          p.ellipse(cx, cy, rg.r * 2 * pulse, rg.r * 1.2 * pulse);

          /* Trigonometria basica para mover un punto en circulo:
                x = centro + cos(angulo) * radio
                y = centro + sin(angulo) * radio
             Sumandole a "phase" un poquito en cada frame, el punto gira.
             El 0.55 en la Y aplasta el circulo y lo convierte en elipse: es
             lo que le da la perspectiva de orbita vista de costado. */
          var px = cx + p.cos(rg.phase) * rg.r * pulse;
          var py = cy + p.sin(rg.phase) * rg.r * 0.55 * pulse;
          p.noStroke();
          p.fill(255, 100, 120);
          p.circle(px, py, 3);
        }

        // Núcleo
        var size = 18 * pulse * (0.5 + hp / 200);
        /* Halo "a mano": no hay blur, asi que dibujo 4 circulos cada vez mas
           grandes y cada vez mas transparentes, del mas grande al mas chico.
           Al superponerse las transparencias queda un degradado de brillo. */
        p.noStroke();
        for (var k = 4; k >= 1; k--) {
          p.fill(255, 40, 70, 20 * k);
          p.circle(cx, cy, size + k * 6);
        }
        p.fill(255, 80 + (100 - hp), 100);
        p.circle(cx, cy, size);

        // Texto glitch
        p.fill(255, 107, 138);
        p.textFont('Consolas');
        p.textSize(11);
        p.textAlign(p.LEFT, p.CENTER);
        /* Texto "glitcheado": en el 4% de los frames rompo la etiqueta.
           split('') me deja un array de caracteres sueltos, map() decide letra
           por letra (30% de chance) si la reemplazo por un caracter ASCII al
           azar —del 33 al 126 son los imprimibles— y join('') vuelve a armar
           el string. Como esto pasa por frame y no guardo el resultado, el
           texto tiembla y se corrige solo. */
        var label = hp > 0 ? 'GLITCH.CORE  ACTIVE' : 'GLITCH.CORE  PURGED';
        if (p.random() < 0.04 && hp > 0) {
          label = label.split('').map(function (ch) {
            return p.random() < 0.3 ? String.fromCharCode(p.random(33, 126)) : ch;
          }).join('');
        }
        p.text(label, 14, cy);

        p.textAlign(p.RIGHT, p.CENTER);
        p.fill(180, 200, 190);
        p.text('hits ' + coreHits + '/5', p.width - 14, cy);
      };
    }, host);
  };

  /* Lo llama boss.js cuando el jugador acierta una pregunta. No dibuja nada:
     solo sube coreShake, y el draw() —que corre por su cuenta— se encarga de
     sacudir el nucleo y de ir bajando ese valor solo (coreShake *= 0.9 en cada
     frame, o sea una caida exponencial suave hasta cero). */
  engine.hitCore = function () {
    coreShake = 10;
    coreHits++;
    if (GT.audio && GT.audio.glitch) GT.audio.glitch();
  };

  engine.stopCore = function () {
    if (coreSketch) {
      try { coreSketch.remove(); } catch (e) { /* ignore */ }
      coreSketch = null;
    }
  };

})(window);
