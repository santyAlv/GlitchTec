/* ============================================================
   Glitch.TEC — estado global del juego
   Centraliza integridad (vidas), puntaje, tiempo, nivel e infeccion.
   Cualquier modulo lee/escribe aca y avisa por el bus de eventos.
   ============================================================ */
/* NOTA PARA MI MISMO — ¿por que envuelvo TODO en (function(){...})() ?
   Eso se llama IIFE (funcion que se invoca sola apenas se define). Sirve para
   no ensuciar el ambito global: todas las variables que declaro adentro
   (listeners, helpers, etc.) mueren dentro de esta funcion y no chocan con las
   de los otros archivos .js. Lo unico que sale afuera es lo que yo cuelgo a
   mano de window.GlitchTec. Es el "modulo" del pobre, sin import/export. */
(function (window) {
  'use strict';

  /* window.GlitchTec es el UNICO objeto global del juego: mi namespace.
     Este "||" es importante: si otro archivo ya lo creo, lo reuso; si soy el
     primero en cargar, lo creo yo. Asi el orden de los <script> del index.html
     no me rompe nada. Por costumbre lo llamo GT adentro de cada archivo. */
  var GT = window.GlitchTec || (window.GlitchTec = {});

  /* Numeros magicos del balance, todos juntos y en un solo lugar.
     Si manana quiero que el juego sea mas facil, toco aca y no salgo a buscar
     un "0.55" perdido en el medio de popups.js. */
  GT.CONFIG = {
    MAX_INTEGRITY: 100,
    POPUP_DRAIN_PER_SEC: 0.55,   // integridad que roba cada pop-up abierto
    POPUP_MAX_ON_SCREEN: 6,
    HINT_COST: 40,
    TICK_MS: 250,

    /* Puntaje por velocidad y rachas (ver GT.correct mas abajo) */
    SPEED_WINDOW: 30,         // segundos: si respondes antes, cobras bonus por agilidad
    STREAK_STEP: 3,           // cada 3 aciertos seguidos sube el multiplicador...
    STREAK_MULT_STEP: 0.5,    // ...medio punto: x1 -> x1.5 -> x2 -> x2.5 -> x3
    STREAK_MULT_MAX: 3,
    SHIELD_SECONDS: 20,       // premio de racha: el dano entra a la mitad
    SHIELD_FACTOR: 0.5,
    EXTRA_TIME: 15            // premio de racha: segundos de regalo
  };

  /* ---------------- Bus de eventos minimo ----------------
     ¿Por que un bus de eventos y no llamar directo a cada modulo?
     Porque si popups.js tuviera que avisarle al HUD, y el HUD a la terminal,
     y la terminal al nivel... termino con todos los archivos dependiendo de
     todos (un plato de fideos). Con el bus, el que hace algo solo GRITA
     ("pasó esto") y el que le interese ESCUCHA. Ninguno conoce al otro:
     los dos conocen solamente el NOMBRE del evento, que es un simple string.

     La estructura es un objeto que mapea:  nombre_evento -> [ fn, fn, fn ]
     Ej:  listeners = { hud: [updateHud], gameover: [mostrarBSOD] }             */
  var listeners = {};

  /* Suscribirse: "cuando pase <evt>, llamame a mi (fn)". */
  GT.on = function (evt, fn) {
    /* Linea condensada, la leo de adentro hacia afuera:
       listeners[evt] || (listeners[evt] = [])
         -> si ya existe el array para ese evento lo devuelve;
         -> si no existe, lo crea vacio Y lo devuelve (la asignacion tambien
            "vale" como expresion, ese es el truco).
       Sobre ese array, recien ahi, hago .push(fn). Es la forma corta de:
         if (!listeners[evt]) listeners[evt] = [];
         listeners[evt].push(fn);                                              */
    (listeners[evt] || (listeners[evt] = [])).push(fn);
  };

  /* Disparar: "pasó <evt>, aca va la info (payload)". */
  GT.emit = function (evt, payload) {
    var fns = listeners[evt];
    if (!fns) return;                       // nadie escucha: no hago nada
    for (var i = 0; i < fns.length; i++) {
      /* El try/catch NO es decorativo: si un listener explota (un getElementById
         que devolvio null, por ejemplo), sin esto se corta el for y los que
         venian DESPUES nunca se enteran del evento. Con el try, el que se rompe
         se rompe solo, lo veo en la consola y el juego sigue andando. */
      try { fns[i](payload); } catch (e) { console.error('[' + evt + ']', e); }
    }
  };

  /* ---------------- Estado ---------------- */
  GT.state = null;

  /* Todo el estado vive en UN solo objeto que se reconstruye entero en cada
     partida. Es a proposito: para "reiniciar" no tengo que acordarme de poner
     en cero quince variables sueltas repartidas en diez archivos; tiro el
     objeto viejo a la basura y armo uno nuevo de cero. */
  GT.resetState = function () {
    GT.state = {
      running: false,
      finished: false,
      mode: 'virus',            // 'virus' (PC corrompida) | 'tecnico' (servicio tecnico)
      level: 0,                 // 0 = todavia no arranco
      integrity: GT.CONFIG.MAX_INTEGRITY,
      score: 0,
      elapsed: 0,               // segundos jugados
      hintsUsed: 0,
      mistakes: 0,
      popupsClosed: 0,
      popupsSpawned: 0,
      objectives: [],           // objetivos del nivel actual
      flags: {},                // marcas de progreso libres (ej. archivo escaneado)
      learned: [],              // conceptos educativos desbloqueados

      /* Rachas */
      streak: 0,                // aciertos seguidos (un error la corta)
      bestStreak: 0,            // la mejor de la partida, va al ranking
      puzzleStart: 0,           // segundo (de elapsed) en que arranco el acertijo actual
      shieldLeft: 0,            // segundos que le quedan al escudo de la racha

      /* Modo tecnico */
      techMinutes: 0,           // minutos de taller consumidos
      techCost: 0,              // plata gastada en repuestos
      techSolved: 0             // ordenes de trabajo cerradas
    };
    return GT.state;
  };

  GT.resetState();

  /* ---------------- Puntaje ---------------- */
  GT.addScore = function (points, reason) {
    var s = GT.state;
    if (!s.running) return;
    s.score = Math.max(0, s.score + points);
    GT.emit('score', { delta: points, reason: reason, total: s.score });
    GT.emit('hud');
  };

  /* ---------------- Integridad (vidas) ---------------- */
  GT.damage = function (amount, reason) {
    var s = GT.state;
    if (!s.running || s.finished) return;
    /* Con el escudo de la racha activo el dano entra a la mitad. Lo aplico
       aca y no en cada modulo: todo el dano del juego pasa por esta funcion,
       asi que un solo if cubre pop-ups, procesos, correos, hacker y jefe. */
    if (s.shieldLeft > 0) amount *= GT.CONFIG.SHIELD_FACTOR;
    s.integrity = Math.max(0, s.integrity - amount);
    GT.emit('damage', { amount: amount, reason: reason, integrity: s.integrity });
    GT.emit('hud');
    if (s.integrity <= 0) GT.emit('gameover', { reason: reason });
  };

  GT.heal = function (amount, reason) {
    var s = GT.state;
    if (!s.running) return;
    s.integrity = Math.min(GT.CONFIG.MAX_INTEGRITY, s.integrity + amount);
    GT.emit('heal', { amount: amount, reason: reason });
    GT.emit('hud');
  };

  /* ---------------- Aciertos, velocidad y rachas ----------------
     Los acertijos (preguntas del jefe y del hacker, correos, procesos, el
     diagnostico del taller) ya no suman un puntaje fijo: pasan por
     GT.correct / GT.wrong, que calculan cuanto vale la respuesta.

       puntos = base x factor de velocidad x multiplicador de racha

     Velocidad: 1 + lo que sobro de la ventana de SPEED_WINDOW segundos.
       Contestar al toque vale casi x2, a los 15 s x1.5, a los 30 s o mas x1.
       Nunca baja de x1: tardar no castiga, solo deja de premiar.
     Racha: cada STREAK_STEP aciertos seguidos el multiplicador sube medio
       punto, hasta STREAK_MULT_MAX. Un error lo vuelve a x1. */

  /* Marca el arranque de un acertijo (nivel nuevo, orden de trabajo nueva).
     Si nadie lo llama, el tiempo se mide desde la ultima respuesta. */
  GT.startPuzzle = function () { GT.state.puzzleStart = GT.state.elapsed; };

  GT.getMultiplier = function () {
    var c = GT.CONFIG;
    var steps = Math.floor(GT.state.streak / c.STREAK_STEP);
    return Math.min(c.STREAK_MULT_MAX, 1 + steps * c.STREAK_MULT_STEP);
  };

  GT.speedFactor = function (secs) {
    return 1 + Math.max(0, Math.min(1, 1 - secs / GT.CONFIG.SPEED_WINDOW));
  };

  /* since: opcional, el elapsed en que aparecio ESTE acertijo (lo pasan el
     jefe, el hacker y el correo, que saben cuando mostraron la pregunta). */
  GT.correct = function (base, reason, since) {
    var s = GT.state;
    if (!s.running || s.finished) return 0;

    var secs = s.elapsed - (typeof since === 'number' ? since : s.puzzleStart);
    var speed = GT.speedFactor(secs);

    s.streak++;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    var mult = GT.getMultiplier();

    var points = Math.round(base * speed * mult);
    s.puzzleStart = s.elapsed;
    GT.addScore(points, reason);
    GT.emit('streak', { streak: s.streak, mult: mult, speed: speed, points: points });
    streakReward(s.streak);
    return points;
  };

  GT.wrong = function (penalty, reason) {
    var s = GT.state;
    if (!s.running || s.finished) return;

    var lost = s.streak;
    s.streak = 0;
    s.mistakes++;
    s.puzzleStart = s.elapsed;
    if (penalty) GT.addScore(-penalty, reason);
    GT.emit('streak', { streak: 0, mult: 1, lost: lost });
    GT.emit('hud');
  };

  /* Premios de la racha, alternados: a los 3 aciertos escudo, a los 5 tiempo
     extra, a los 8 escudo, a los 10 tiempo... (n % 5 da 3, 0, 3, 0...).
     El tiempo extra va al reloj que este apurando al jugador: si el jefe
     esta activo se lo sumo a su cuenta regresiva; si no, le descuento esos
     segundos al reloj de la partida, que es lo que mira el bonus por tiempo
     del final. */
  function streakReward(n) {
    var c = GT.CONFIG;
    var s = GT.state;

    if (n % 5 === 3) {
      s.shieldLeft = c.SHIELD_SECONDS;
      GT.emit('bonus', { kind: 'shield', seconds: c.SHIELD_SECONDS, streak: n });
    } else if (n % 5 === 0) {
      if (GT.boss && GT.boss.isActive()) {
        GT.boss.addTime(c.EXTRA_TIME);
      } else {
        s.elapsed = Math.max(0, s.elapsed - c.EXTRA_TIME);
        s.puzzleStart = s.elapsed;
      }
      GT.emit('bonus', { kind: 'time', seconds: c.EXTRA_TIME, streak: n });
    }
  }

  /* Lo llama el loop de game.js: el escudo se gasta con tiempo de juego, asi
     que si la partida se frena, el escudo se frena tambien. */
  GT.tickShield = function (dt) {
    var s = GT.state;
    if (s.shieldLeft <= 0) return;
    s.shieldLeft = Math.max(0, s.shieldLeft - dt);
    if (s.shieldLeft === 0) GT.emit('bonus', { kind: 'shield-end' });
  };

  /* La infeccion es el reverso de la integridad, con un piso por nivel:
     aunque estes al 100%, avanzar de nivel implica un sistema mas comprometido.

     Desarmo la cuenta para acordarme de por que es asi:
       base       = piso narrativo. Sube 8 por nivel pero lo topeo en 40 con
                    Math.min, si no en el nivel 4 ya arrancaria en 32-40 y
                    sumado al dano se iria a 100 sin que el jugador haga nada.
       fromDamage = lo que perdi de integridad, pero pesado 0.75 para que
                    perder 100 de integridad NO signifique 100 de infeccion:
                    quiero que las dos barras se muevan juntas pero no sean
                    espejo exacto (si fueran iguales, una de las dos sobra).
       Math.max(0, Math.min(100, ...)) es el clamp clasico: pase lo que pase
       el resultado queda encerrado entre 0 y 100, porque este numero termina
       siendo un ancho en % en el HUD y un 120% romperia la barra.

     Este valor lo usan ademas el motor p5 (cuanta estatica dibuja) y los
     pop-ups (cada cuanto aparecen): una sola formula, tres consumidores. */
  GT.getInfection = function () {
    var s = GT.state;
    var base = Math.min(40, s.level * 8);
    var fromDamage = (GT.CONFIG.MAX_INTEGRITY - s.integrity) * 0.75;
    return Math.max(0, Math.min(100, Math.round(base + fromDamage)));
  };

  /* ---------------- Conceptos aprendidos ---------------- */
  GT.learn = function (concept) {
    if (GT.state.learned.indexOf(concept) === -1) GT.state.learned.push(concept);
  };

  /* ---------------- Utilidades ---------------- */
  GT.formatTime = function (totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var sec = Math.floor(totalSeconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
  };

  GT.rand = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  GT.pick = function (arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  };

  /* SEGURIDAD: todo texto que venga de datos (nombre de archivo, asunto de un
     correo, etc.) y que yo meta con innerHTML tiene que pasar SI O SI por aca.
     Si no, un nombre como <img onerror=...> se ejecutaria como HTML de verdad.
     Cambio los 4 caracteres que le dan sentido al HTML por su "entidad", asi
     el navegador los DIBUJA como texto en vez de interpretarlos.
     Ojo con el orden: el & va PRIMERO, porque si lo reemplazara al final me
     comeria los & que yo mismo genero en &lt; y quedaria "&amp;lt;". */
  GT.escapeHtml = function (str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

})(window);
