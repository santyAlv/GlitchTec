/* ============================================================
   Glitch.TEC — GL1TCH-M4N, el hacker que vive en la pantalla
   ------------------------------------------------------------
   Es la cara visible del malware. A diferencia de los pop-ups
   (que son ventanas), este tipo es un personaje: aparece sobre
   el escritorio, se mueve solo cada cierto tiempo, te amenaza y
   cada tanto te ataca de dos formas:

     1. SECUESTRO DE TECLADO — te bloquea un puñado de teclas y
        solo las libera si respondes bien una pregunta de
        software (se responde con el mouse, porque el teclado
        justamente esta bloqueado).

     2. CORRUPCION DE VISTA — te da vuelta los colores de la
        pantalla durante 20 segundos.

   Todo el modulo es autonomo: game.js solo lo arranca, lo
   tickea y lo frena.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var hacker = GT.hacker = {};

  /* ============================================================
     Configuracion
     ============================================================ */
  var CFG = hacker.CFG = {
    MOVE_MIN: 6.5,          // segundos entre reposicionamientos
    MOVE_MAX: 12,

    LOCK_FIRST: 38,         // primer secuestro de teclado
    LOCK_MIN: 54,           // y despues, cada tanto
    LOCK_MAX: 80,
    LOCK_DRAIN: 0.4,        // integridad por segundo con el teclado tomado
    LOCK_KEYS_MIN: 3,
    LOCK_KEYS_MAX: 5,
    LOCK_REWARD: 150,
    LOCK_PENALTY: 9,

    COLOR_FIRST: 64,        // primera corrupcion de colores
    COLOR_MIN: 76,
    COLOR_MAX: 112,
    COLOR_TIME: 20,         // duracion exacta pedida: 20 segundos
    COLOR_DAMAGE: 4
  };

  /* Teclas candidatas: todas se usan al escribir comandos reales.
     No es una lista al azar: son las letras de dir, cd, type, scan, unlock,
     kill, purge... Si bloqueara la W o la Z el ataque no se sentiria. Tampoco
     meto numeros, porque la clave de la cuarentena (45) se escribe con ellos y
     seria bloquear el progreso en vez de molestar. */
  var KEY_POOL = ['a', 'c', 'd', 'e', 'i', 'k', 'l', 'n', 'o', 'p', 'r', 's', 't', 'u'];

  /* ============================================================
     Amenazas (se dicen al moverse)
     ============================================================ */
  var TAUNTS = [
    'te veo escribir, ¿sabés lo que hacés?',
    'estoy en tu RAM y tenés la mano temblando',
    'cada segundo copio un archivo tuyo',
    'la webcam también es mía, sonreí',
    'te falta poco para el pantallazo azul',
    'tus contraseñas estaban en un .txt, gracias',
    'puedo apagarte el teclado cuando quiera',
    'no cierres, empeora',
    'me estoy multiplicando mientras dudás',
    'esa terminal no te va a salvar',
    'tengo tus apuntes de tres años',
    'contá tus teclas, capaz te faltan algunas',
    'estoy detrás del ícono que no mirás',
    'tu antivirus me da risa'
  ];

  var LOCK_TAUNTS = [
    'me llevo unas teclas de recuerdo',
    'tu teclado ahora es mío. rescate: una respuesta',
    'a ver si sabés algo o solo apretás botones',
    'sin esas teclas no escribís ni "help"'
  ];

  var COLOR_TAUNTS = [
    'te di vuelta los colores. aguantá 20 segundos',
    'así se ve mi mundo. te va a gustar',
    'no toques nada, no ves nada'
  ];

  /* ============================================================
     Banco de preguntas para liberar el teclado
     Son de SOFTWARE / informatica general, distintas a las del
     jefe final para no repetir contenido.
     ============================================================ */
  var QUESTIONS = [
    {
      q: '¿Qué es un <b>sistema operativo</b>?',
      options: [
        'Un antivirus que viene de fábrica',
        'El software que administra el hardware y ejecuta los demás programas',
        'La parte física donde se guardan los archivos',
        'Un lenguaje de programación'
      ],
      correct: 1,
      why: 'El sistema operativo (Windows, Linux, macOS) es el software base: administra memoria, ' +
           'procesos, archivos y le da a los programas una forma común de usar el hardware.'
    },
    {
      q: 'Se corta la luz. ¿Qué se pierde?',
      options: [
        'Lo que estaba solo en la memoria RAM',
        'Todo lo guardado en el disco',
        'El sistema operativo completo',
        'Nada, todo es permanente'
      ],
      correct: 0,
      why: 'La <b>RAM es volátil</b>: se borra al cortarse la alimentación. El disco (HDD/SSD) es ' +
           'almacenamiento persistente. Por eso "guardar" significa pasar de RAM a disco.'
    },
    {
      q: '¿Qué hace un <b>driver</b> (controlador)?',
      options: [
        'Acelera el procesador',
        'Traduce las órdenes del sistema operativo a un dispositivo concreto',
        'Guarda copias de seguridad automáticas',
        'Bloquea páginas peligrosas'
      ],
      correct: 1,
      why: 'El <b>driver</b> es el intérprete entre el sistema operativo y un dispositivo ' +
           '(placa de video, impresora, wifi). Sin el driver correcto el hardware está pero no responde bien.'
    },
    {
      q: '¿Para qué sirve un <b>firewall</b>?',
      options: [
        'Enfría el gabinete',
        'Elimina virus del disco',
        'Filtra las conexiones de red que entran y salen del equipo',
        'Comprime archivos grandes'
      ],
      correct: 2,
      why: 'El <b>firewall</b> controla el tráfico de red según reglas: decide qué conexiones se ' +
           'permiten. No borra virus, pero le corta la salida a un malware que quiere comunicarse.'
    },
    {
      q: 'La regla <b>3-2-1</b> de backups dice que hay que tener...',
      options: [
        '3 copias, en 2 medios distintos, 1 fuera del lugar',
        '3 antivirus, 2 firewalls, 1 contraseña',
        '3 particiones, 2 discos, 1 usuario',
        '3 respaldos por día durante 2 semanas'
      ],
      correct: 0,
      why: '<b>3 copias</b> de los datos, en <b>2 medios</b> diferentes y al menos <b>1 fuera</b> ' +
           'del edificio (o en la nube). Es la única defensa real contra el ransomware.'
    },
    {
      q: 'En un sitio con <b>HTTPS</b>, el candado garantiza que...',
      options: [
        'La página es confiable y no tiene estafas',
        'El tráfico viaja cifrado hasta ese servidor',
        'El sitio fue revisado por el gobierno',
        'No puede tener virus'
      ],
      correct: 1,
      why: 'HTTPS <b>cifra</b> la comunicación, nada más. Una web de phishing también puede tener ' +
           'candado: hay que mirar el dominio, no el candado.'
    },
    {
      q: '¿Por qué conviene instalar las <b>actualizaciones</b> del sistema?',
      options: [
        'Porque cambian el diseño',
        'Porque liberan espacio en disco',
        'Porque corrigen fallas de seguridad ya conocidas y publicadas',
        'Porque aceleran internet'
      ],
      correct: 2,
      why: 'Cuando sale un parche, la vulnerabilidad se hace <b>pública</b>. Un equipo sin actualizar ' +
           'es un blanco con las instrucciones de ataque ya escritas.'
    },
    {
      q: '¿Cuál es la contraseña más segura?',
      options: [
        'Sant1ago2024!',
        'perro-verde-lampara-42-tren',
        'admin123',
        'La fecha de nacimiento al revés'
      ],
      correct: 1,
      why: 'La <b>longitud</b> gana. Una frase larga de palabras sin relación es mucho más difícil ' +
           'de romper por fuerza bruta que una palabra corta con símbolos, y es más fácil de recordar.'
    },
    {
      q: 'Un archivo <b>.exe</b> se diferencia de un <b>.txt</b> porque...',
      options: [
        'Pesa más',
        'El .exe es un programa que se ejecuta; el .txt son solo datos de texto',
        'El .txt no se puede abrir sin permiso',
        'No hay diferencia real'
      ],
      correct: 1,
      why: 'Un <b>ejecutable</b> corre código con tus permisos. Un archivo de datos, en cambio, ' +
           'solo se lee. Por eso el malware siempre busca que ejecutes algo.'
    },
    {
      q: 'Tu PC va lenta y en el administrador de tareas hay un proceso al 95% de CPU que no reconocés. ¿Qué hacés primero?',
      options: [
        'Reinstalar Windows',
        'Formatear el disco',
        'Investigar el nombre y la firma digital del proceso antes de tocarlo',
        'Matar todos los procesos de la lista'
      ],
      correct: 2,
      why: 'Primero se <b>identifica</b>. Matar procesos a ciegas puede tumbar el sistema, y ' +
           'formatear sin diagnóstico borra la evidencia y tus datos.'
    },
    {
      q: '¿Qué es la <b>memoria caché</b> del procesador?',
      options: [
        'Una memoria muy rápida y chica que guarda datos de uso frecuente',
        'El espacio libre del disco',
        'Una copia de seguridad del sistema',
        'La memoria de la placa de video'
      ],
      correct: 0,
      why: 'La <b>caché</b> está dentro del CPU: es diminuta pero rapidísima. Guarda lo que se usa ' +
           'seguido para no ir a buscarlo a la RAM, que es mucho más lenta en comparación.'
    },
    {
      q: 'Un <b>troyano</b> se llama así porque...',
      options: [
        'Se esconde en la placa madre',
        'Viene de un país específico',
        'Se disfraza de programa útil para que vos mismo lo instales',
        'Ataca solo a servidores'
      ],
      correct: 2,
      why: 'Como el caballo de Troya: <b>entra porque lo dejás entrar</b>. No explota una falla ' +
           'técnica, explota la confianza del usuario.'
    }
  ];

  /* ============================================================
     Estado interno
     ============================================================ */
  /* --- Referencias al DOM (se crean una vez en init) --- */
  var layer = null;         // capa donde vive el personaje
  var fig = null;           // el personaje en si
  var bubble = null;        // globo de dialogo
  var badge = null;         // cartel de "vista corrompida"
  var modal = null;         // panel de rescate del teclado

  /* --- Tres relojes independientes ---
     Este modulo es basicamente una MAQUINA DE ESTADOS con tres contadores que
     bajan solos en el tick: uno para moverse, uno para el ataque de teclado y
     uno para el de colores. Cuando alguno llega a cero, dispara su ataque y se
     vuelve a cargar con un valor aleatorio. Al ser independientes, el jugador
     no puede aprenderse el patron. */
  var running = false;
  var moveTimer = 0;
  var lockTimer = 0;
  var colorTimer = 0;

  /* --- Estado del ataque 1: secuestro de teclado --- */
  var locked = false;       // ¿hay teclas bloqueadas ahora mismo?
  var lockedKeys = [];      // cuales
  var lockQuestion = null;  // la pregunta que tiene que responder para liberarlas
  var lockAsked = [];       // indices ya preguntados, para no repetir
  var lastBlockFeedback = 0;// timestamp: evita spamear el aviso de tecla muerta

  /* --- Estado del ataque 2: colores invertidos --- */
  var colorActive = false;
  var colorLeft = 0;        // segundos que faltan (cuenta regresiva a la vista)

  var clickCooldown = 0;    // para que no lo puedan clickear 20 veces seguidas
  var bubbleTimer = null;
  var bound = false;        // ¿ya enganche los listeners globales? (una sola vez)

  /* ============================================================
     Personaje (SVG): capucha violeta, ojos encendidos, notebook.
     Deliberadamente "mascota": tiene que leerse como un bicho que
     se pasea por la pantalla, no como una ventana mas.
     ============================================================ */
  var SPRITE =
    '<svg viewBox="0 0 120 130" class="hk-svg">' +
      '<defs>' +
        '<linearGradient id="hkHood" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#c07bff"/>' +
          '<stop offset="55%" stop-color="#8a3ff0"/>' +
          '<stop offset="100%" stop-color="#4b169c"/>' +
        '</linearGradient>' +
        '<radialGradient id="hkGlow" cx="50%" cy="50%" r="50%">' +
          '<stop offset="0%" stop-color="#35ff7a" stop-opacity=".95"/>' +
          '<stop offset="100%" stop-color="#35ff7a" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +

      '<ellipse cx="60" cy="122" rx="34" ry="6" fill="#000" opacity=".38"/>' +

      /* cuerpo / campera con capucha */
      '<path d="M24 118c0-24 9-40 22-46h28c13 6 22 22 22 46z" fill="url(#hkHood)" stroke="#2d0a63" stroke-width="2.5"/>' +
      '<path d="M46 72c5 9 23 9 28 0" fill="none" stroke="#2d0a63" stroke-width="2.2"/>' +

      /* capucha */
      '<path d="M60 10c-19 0-31 14-31 32 0 14 7 24 15 29 5 3 27 3 32 0 8-5 15-15 15-29 0-18-12-32-31-32z" ' +
            'fill="url(#hkHood)" stroke="#2d0a63" stroke-width="2.5"/>' +

      /* sombra interior de la cara */
      '<path d="M60 20c-14 0-23 11-23 24 0 11 6 19 12 22 4 2 18 2 22 0 6-3 12-11 12-22 0-13-9-24-23-24z" fill="#150626"/>' +

      /* ojos */
      '<circle cx="49" cy="46" r="11" fill="url(#hkGlow)" opacity=".55"/>' +
      '<circle cx="71" cy="46" r="11" fill="url(#hkGlow)" opacity=".55"/>' +
      '<rect class="hk-eye" x="43" y="43" width="13" height="6" rx="2" fill="#35ff7a"/>' +
      '<rect class="hk-eye" x="64" y="43" width="13" height="6" rx="2" fill="#35ff7a"/>' +

      /* sonrisa de datos */
      '<path d="M50 61h4v3h4v-3h4v3h4v-3h4" fill="none" stroke="#35ff7a" stroke-width="2" opacity=".8"/>' +

      /* notebook */
      '<path d="M34 104h52l6 14H28z" fill="#1b2732" stroke="#0a1118" stroke-width="2"/>' +
      '<rect x="40" y="88" width="40" height="17" rx="2" fill="#0d1a14" stroke="#0a1118" stroke-width="2"/>' +
      '<text x="44" y="100" font-family="monospace" font-size="9" fill="#35ff7a">&gt;_</text>' +
    '</svg>';

  /* ============================================================
     Construccion del DOM
     ============================================================ */
  /* Creo el personaje UNA sola vez en toda la vida de la pagina (el "if
     (layer) return" lo garantiza). Despues, entre partida y partida, solo lo
     muestro u oculto con una clase: recrear los nodos en cada partida seria
     tirar trabajo al pedo y, peor, me obligaria a re-enganchar los listeners
     y arriesgarme a dejar duplicados. */
  hacker.init = function () {
    if (layer) return;

    var crt = document.getElementById('crt');
    if (!crt) return;

    layer = document.createElement('div');
    layer.id = 'hacker-layer';
    layer.className = 'hidden';
    layer.innerHTML =
      '<div id="hk-bubble" class="hk-bubble hidden"></div>' +
      '<div id="hk-fig" class="hk-fig" role="img" aria-label="hacker">' + SPRITE + '</div>';
    crt.appendChild(layer);

    fig = layer.querySelector('#hk-fig');
    bubble = layer.querySelector('#hk-bubble');

    fig.addEventListener('click', onFigClick);

    /* EL FILTRO GLOBAL DE TECLADO. Este es el corazon del ataque 1 y el
       tercer parametro (true) es lo que lo hace posible:

         addEventListener(evento, fn, true)  ->  fase de CAPTURA

       Un evento de teclado viaja primero de la raiz del documento HACIA ABAJO
       (captura) y recien despues vuelve hacia arriba (burbujeo). Los listeners
       normales escuchan en el burbujeo, o sea DESPUES de que el <input> de la
       terminal ya recibio la letra. Escuchando en captura me pongo PRIMERO en
       la fila: intercepto la tecla antes que nadie y, si esta bloqueada, la
       mato con preventDefault. Por eso el bloqueo funciona en todo el sistema
       y no solo en la terminal.

       "bound" me asegura enganchar esto una sola vez: como init() se puede
       llamar varias veces, sin esa bandera acumularia un listener por partida
       y la misma tecla se bloquearia (y sonaria) N veces. */
    if (!bound) {
      document.addEventListener('keydown', onKeyCapture, true);
      window.addEventListener('resize', clampToScreen);
      bound = true;
    }
  };

  /* ============================================================
     Ciclo de vida
     ============================================================ */
  hacker.start = function () {
    hacker.init();
    if (!layer) return;

    running = true;
    moveTimer = GT.rand(3, 6);
    lockTimer = CFG.LOCK_FIRST;
    colorTimer = CFG.COLOR_FIRST;
    clickCooldown = 0;

    layer.classList.remove('hidden');
    moveTo(0.72, 0.24, true);
    appear();
    say('llegué. no me vas a poder cerrar.', 3600);
  };

  hacker.stop = function () {
    running = false;
    releaseKeys(false);
    stopColors();
    if (layer) layer.classList.add('hidden');
  };

  hacker.reset = function () {
    hacker.stop();
    lockAsked = [];
    moveTimer = lockTimer = colorTimer = 0;
    if (fig) fig.classList.remove('is-in', 'is-attacking');
  };

  hacker.isRunning = function () { return running; };
  hacker.isLocked = function () { return locked; };
  hacker.blockedKeys = function () { return lockedKeys.slice(); };
  hacker.isColorHijacked = function () { return colorActive; };

  /* ============================================================
     Tick (lo llama el loop principal de game.js)
     ============================================================ */
  /* EL TICK: se llama ~60 veces por segundo desde el loop de game.js con el
     dt en segundos. Todo lo que hace es restar dt a los tres relojes y actuar
     cuando alguno llega a cero. Trabajar con dt (y no con "cada N frames")
     hace que los tiempos sean reales: LOCK_FIRST = 38 son 38 segundos de
     verdad en cualquier maquina. */
  hacker.tick = function (dt) {
    if (!running || !GT.state.running || GT.state.finished) return;

    if (clickCooldown > 0) clickCooldown -= dt;

    /* --- Paseo por la pantalla --- */
    moveTimer -= dt;
    if (moveTimer <= 0) {
      moveTimer = randf(CFG.MOVE_MIN, CFG.MOVE_MAX);
      wander();
    }

    /* --- Corrupcion de colores (20 s) --- */
    if (colorActive) {
      colorLeft -= dt;
      renderBadge();
      if (colorLeft <= 0) stopColors();
    } else {
      colorTimer -= dt;
      if (colorTimer <= 0) {
        colorTimer = randf(CFG.COLOR_MIN, CFG.COLOR_MAX);
        startColors();
      }
    }

    /* --- Secuestro de teclado --- */
    if (locked) {
      GT.damage(CFG.LOCK_DRAIN * dt, 'teclado secuestrado');
    } else {
      lockTimer -= dt;
      if (lockTimer <= 0) {
        /* Recargo el reloj ANTES de atacar: si canLock() dice que no es
           momento (por ejemplo, porque esta corriendo el jefe final), lo piso
           con 12 segundos y vuelvo a intentar pronto. Asi el ataque queda
           "pendiente" en vez de perderse hasta el proximo ciclo largo. */
        lockTimer = randf(CFG.LOCK_MIN, CFG.LOCK_MAX);
        if (canLock()) startLock();
        else lockTimer = 12;               // reintenta pronto si no era momento
      }
    }
  };

  function canLock() {
    if (locked || GT.state.finished) return false;
    if (GT.boss && GT.boss.isActive && GT.boss.isActive()) return false;  // el jefe ya es bastante
    return GT.state.level >= 1;
  }

  /* ============================================================
     Movimiento
     ============================================================ */
  function bounds() {
    var crt = document.getElementById('crt');
    return {
      w: crt ? crt.clientWidth : window.innerWidth,
      h: crt ? crt.clientHeight : window.innerHeight
    };
  }

  /** Coloca al personaje usando fracciones (0..1) del alto/ancho.
      Trabajo con fracciones y no con pixeles fijos para que el hacker caiga en
      el mismo lugar RELATIVO en cualquier resolucion: 0.5 es siempre el medio,
      tenga la pantalla 1920 o 1280 de ancho.
      Despues convierto a pixeles y encierro el resultado entre 8 y (borde - 8)
      para que nunca quede medio cuerpo afuera. El -52 extra en la Y es para no
      taparle la barra de tareas. */
  function moveTo(fx, fy, instant) {
    if (!fig) return;
    var b = bounds();
    var w = 108, h = 118;                   // tamano aproximado del personaje
    var x = Math.round(Math.max(8, Math.min(b.w - w - 8, fx * (b.w - w))));
    var y = Math.round(Math.max(8, Math.min(b.h - h - 52, fy * (b.h - h - 52))));

    /* El CSS anima los cambios de left/top (por eso "salta" suave de un lugar
       a otro). Cuando quiero que aparezca YA en un lugar —al empezar la
       partida— le pongo la clase no-anim, muevo, fuerzo el reflow con
       offsetWidth para que el navegador aplique la posicion sin transicion, y
       recien ahi le devuelvo la animacion. */
    if (instant) fig.classList.add('no-anim');
    fig.style.left = x + 'px';
    fig.style.top = y + 'px';
    if (instant) {
      void fig.offsetWidth;
      fig.classList.remove('no-anim');
    }
    placeBubble(x, y, w);
  }

  function clampToScreen() {
    if (!fig || !layer || layer.classList.contains('hidden')) return;
    var b = bounds();
    var x = Math.min(parseInt(fig.style.left, 10) || 0, b.w - 116);
    var y = Math.min(parseInt(fig.style.top, 10) || 0, b.h - 170);
    fig.style.left = Math.max(8, x) + 'px';
    fig.style.top = Math.max(8, y) + 'px';
    placeBubble(x, y, 108);
  }

  /** Salto a un punto aleatorio + amenaza. Evita quedar sobre el HUD.
      No uso random puro: elijo una de estas 7 zonas y le sumo un desvio chico
      (+-0.06). Con random puro terminaria tapando el HUD o quedandose siempre
      en el medio; con zonas fijas + ruido consigo variedad pero controlada.
      Es el mismo criterio que se usa para spawnear enemigos en un mapa. */
  function wander() {
    var zones = [
      [0.05, 0.55], [0.30, 0.10], [0.62, 0.62],
      [0.12, 0.82], [0.78, 0.86], [0.45, 0.38], [0.86, 0.20]
    ];
    var z = GT.pick(zones);
    var fx = clamp01(z[0] + (Math.random() - 0.5) * 0.12);
    var fy = clamp01(z[1] + (Math.random() - 0.5) * 0.12);

    fig.classList.add('is-jumping');
    setTimeout(function () { if (fig) fig.classList.remove('is-jumping'); }, 420);

    moveTo(fx, fy, false);
    GT.audio.key();

    if (Math.random() < 0.62) say(GT.pick(TAUNTS), 3400);
    if (Math.random() < 0.18 && GT.terminal) {
      GT.terminal.notify('[GLITCH] ' + GT.pick(TAUNTS), 'evil');
    }
  }

  function clamp01(v) { return Math.max(0.02, Math.min(0.96, v)); }
  function randf(a, b) { return a + Math.random() * (b - a); }

  function appear() {
    if (!fig) return;
    fig.classList.remove('is-in');
    void fig.offsetWidth;
    fig.classList.add('is-in');
  }

  /* ============================================================
     Globo de dialogo
     ============================================================ */
  function placeBubble(x, y, w) {
    if (!bubble) return;
    var b = bounds();
    var half = Math.min(140, b.w / 2 - 8);      // el globo mide hasta 260px de ancho
    var left = x + w / 2;
    bubble.style.left = Math.max(half, Math.min(b.w - half, left)) + 'px';
    bubble.style.top = Math.max(4, y - 46) + 'px';
  }

  function say(text, ms) {
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      if (bubble) bubble.classList.add('hidden');
    }, ms || 3200);
  }
  hacker.say = say;

  /** Click del jugador: lo espanta y le retrasa el proximo ataque.
      Le doy al jugador algo que HACER contra el hacker, aunque sea chico: si
      no, el personaje seria solo un castigo que llega y no se puede evitar.
      El cooldown de 2.5s existe para que no se pueda farmear puntos a fuerza
      de clicks: sin el, alcanzaria con clickearlo sin parar para ganar. */
  function onFigClick() {
    if (!running || clickCooldown > 0) return;
    clickCooldown = 2.5;

    GT.addScore(5, 'le apuntaste al hacker');
    GT.audio.click();
    say(GT.pick([
      '¡ey! no me toques',
      'muy lento',
      'ni me despeinaste',
      'seguí perdiendo tiempo conmigo'
    ]), 2200);

    lockTimer += 8;
    colorTimer += 6;
    moveTimer = 0.15;                       // se escapa enseguida
  }

  /* ============================================================
     ATAQUE 1 — Secuestro de teclado
     ============================================================ */
  /* Elige 3 a 5 teclas SIN repetir. El truco esta en trabajar sobre una copia
     del pool (.slice()) y usar splice, que saca el elemento elegido del array:
     como ya no esta, no lo puedo volver a sacar. Es "sacar bolillas de una
     bolsa" en vez de "tirar un dado varias veces".
     splice(i, 1) devuelve un ARRAY con lo que saco, por eso el [0] del final. */
  function pickKeys() {
    var pool = KEY_POOL.slice();
    var n = GT.rand(CFG.LOCK_KEYS_MIN, CFG.LOCK_KEYS_MAX);
    var out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return out;
  }

  /* Elige una pregunta que todavia no haya salido en esta partida. Armo la
     lista de candidatos (los indices que NO estan en lockAsked) y sorteo entre
     esos. Cuando ya salieron todas, vacio lockAsked y vuelve a empezar la
     ronda: asi nunca repito una pregunta antes de haber pasado por las 12. */
  function pickQuestion() {
    if (lockAsked.length >= QUESTIONS.length) lockAsked = [];
    var candidates = [];
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (lockAsked.indexOf(i) === -1) candidates.push(i);
    }
    var idx = GT.pick(candidates);
    lockAsked.push(idx);
    return { idx: idx, data: QUESTIONS[idx] };
  }

  /* DISPARO DEL ATAQUE 1. Ojo con el orden: primero dejo el estado consistente
     (locked, teclas, pregunta) y RECIEN DESPUES aviso por pantalla y sonido.
     Si lo hiciera al reves, entre el aviso y el seteo habria un instante en el
     que el panel ya existe pero lockQuestion todavia es null -> click a
     destiempo y error de null. */
  function startLock() {
    locked = true;
    lockedKeys = pickKeys();
    lockQuestion = pickQuestion();

    fig.classList.add('is-attacking');
    say(GT.pick(LOCK_TAUNTS), 4200);
    GT.audio.alarm();
    GT.ui.shake();
    GT.ui.flash('hit');
    GT.ui.toast('✘ El hacker te bloqueó teclas del teclado', 'bad');
    if (GT.terminal) {
      GT.terminal.notify('[GLITCH] driver de teclado secuestrado: ' +
        lockedKeys.join(' ').toUpperCase(), 'evil');
    }
    if (GT.api) GT.api.logEvent('keylock_start', { keys: lockedKeys });

    renderLockModal();
  }

  function renderLockModal() {
    closeLockModal();

    var q = lockQuestion.data;
    modal = document.createElement('div');
    modal.className = 'hk-modal';
    modal.innerHTML =
      '<div class="hk-modal-box">' +
        '<div class="hk-modal-bar">' +
          '<span class="hk-skull">☠</span>' +
          '<span class="hk-modal-name">TECLADO SECUESTRADO — keylock.sys</span>' +
          '<button class="hk-fold" title="Plegar / desplegar">▬</button>' +
        '</div>' +
        /* El panel se puede PLEGAR y ARRASTRAR a proposito: el ataque tiene
           que molestar, no trabar el juego. El jugador puede correrlo, seguir
           leyendo la terminal y responder cuando quiera (mientras tanto sigue
           perdiendo integridad, que es el verdadero apuro). */
        '<div class="hk-modal-body">' +
          '<p class="hk-modal-lead">Te bloqueé estas teclas. Están muertas en todo el sistema ' +
             'hasta que demuestres que entendés algo de lo que estás usando. ' +
             'Podés seguir jugando, pero sin ellas no escribís ni un comando.</p>' +
          '<div class="hk-keys" id="hk-keys"></div>' +
          '<p class="hk-modal-q">' + q.q + '</p>' +
          '<div class="hk-opts" id="hk-opts"></div>' +
          '<div class="hk-feedback hidden" id="hk-feedback"></div>' +
          '<p class="hk-modal-foot">Respondé con el mouse: el teclado es mío. ' +
             'Mientras tanto, la integridad del sistema baja. ' +
             'Podés arrastrar este panel de la barra violeta.</p>' +
        '</div>' +
      '</div>';

    var keysBox = modal.querySelector('#hk-keys');
    lockedKeys.forEach(function (k) {
      var cap = document.createElement('span');
      cap.className = 'hk-key';
      cap.textContent = k.toUpperCase();
      keysBox.appendChild(cap);
    });

    var opts = modal.querySelector('#hk-opts');
    q.options.forEach(function (opt, i) {
      var b = document.createElement('button');
      b.className = 'hk-opt';
      /* String.fromCharCode(65 + i) convierte 0,1,2,3 en A,B,C,D: 65 es el
         codigo ASCII de la "A", asi que sumandole el indice recorro el
         abecedario. Mucho mejor que escribir un array ['A','B','C','D'] a mano. */
      b.innerHTML = '<b>' + String.fromCharCode(65 + i) + ')</b> ' + opt;
      /* Cada boton se lleva SU indice i por clausura: cuando el jugador
         clickee, este callback va a saber exactamente que opcion era. */
      b.addEventListener('click', function () { answerLock(i, b); });
      opts.appendChild(b);
    });

    var box = modal.querySelector('.hk-modal-box');

    /* Plegar: el panel puede estar tapando la Terminal y el juego sigue. */
    modal.querySelector('.hk-fold').addEventListener('click', function (e) {
      e.stopPropagation();
      var folded = box.classList.toggle('collapsed');
      modal.querySelector('.hk-modal-name').textContent = folded
        ? 'TECLADO SECUESTRADO — clic para responder'
        : 'TECLADO SECUESTRADO — keylock.sys';
      GT.audio.click();
    });

    /* Desplegar tocando la barra cuando está plegado */
    modal.querySelector('.hk-modal-bar').addEventListener('click', function (e) {
      if (e.target.closest('.hk-fold')) return;
      if (!box.classList.contains('collapsed')) return;
      box.classList.remove('collapsed');
      modal.querySelector('.hk-modal-name').textContent = 'TECLADO SECUESTRADO — keylock.sys';
    });

    document.getElementById('crt').appendChild(modal);
    dragBox(box, modal.querySelector('.hk-modal-bar'));
  }

  /** El panel se corre de lugar: puede estar tapando la Terminal. */
  function dragBox(box, handle) {
    var dragging = false, offX = 0, offY = 0;

    handle.addEventListener('mousedown', function (e) {
      var r = box.getBoundingClientRect();
      dragging = true;
      offX = e.clientX - r.left;
      offY = e.clientY - r.top;
      box.classList.add('dragged');
      box.style.left = r.left + 'px';
      box.style.top = r.top + 'px';
      box.style.bottom = 'auto';
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var b = bounds();
      box.style.left = Math.max(0, Math.min(e.clientX - offX, b.w - 120)) + 'px';
      box.style.top = Math.max(0, Math.min(e.clientY - offY, b.h - 60)) + 'px';
    });

    document.addEventListener('mouseup', function () { dragging = false; });
  }

  function answerLock(choice, btn) {
    var q = lockQuestion.data;
    var opts = modal.querySelectorAll('.hk-opt');
    var fb = modal.querySelector('#hk-feedback');

    if (choice === q.correct) {
      for (var i = 0; i < opts.length; i++) opts[i].disabled = true;
      btn.classList.add('right');

      fb.className = 'hk-feedback ok';
      fb.innerHTML = '<b>✔ CORRECTO.</b> Teclado liberado.<br>' + q.why;

      GT.addScore(CFG.LOCK_REWARD, 'teclado recuperado');
      /* Guardo la explicacion en la lista de "conceptos aprendidos" que se
         muestra al ganar, pero SIN las etiquetas HTML: el replace con el regex
         /<[^>]+>/g borra todo lo que este entre < y > (el /g es para que los
         saque todos, no solo el primero). Si no lo limpiara, en la pantalla
         final se leerian los <b> literales. */
      GT.learn(q.why.replace(/<[^>]+>/g, ''));
      GT.audio.ok();
      GT.ui.flash('gain');
      if (GT.api) GT.api.logEvent('keylock_ok', { question: lockQuestion.idx });

      setTimeout(function () { releaseKeys(true); }, 1500);
      return;
    }

    btn.classList.add('wrong');
    btn.disabled = true;

    fb.className = 'hk-feedback bad';
    fb.innerHTML = '<b>✘ NO.</b> El bloqueo sigue. Probá de nuevo.';

    GT.state.mistakes++;
    GT.damage(CFG.LOCK_PENALTY, 'respuesta incorrecta con el teclado secuestrado');
    GT.addScore(-40, 'respuesta incorrecta');
    GT.audio.hurt();
    GT.ui.shake();
    say(GT.pick(['jaja', 'no sabés', 'seguí adivinando']), 2000);
  }

  function releaseKeys(won) {
    var wasLocked = locked;
    locked = false;
    lockedKeys = [];
    closeLockModal();
    if (fig) fig.classList.remove('is-attacking');

    if (wasLocked && won) {
      GT.ui.toast('✔ Teclado liberado (+' + CFG.LOCK_REWARD + ')', 'info');
      say('devolvé eso... está bien, quedátelo', 2600);
      if (GT.terminal) GT.terminal.notify('[SISTEMA] Driver de teclado restaurado.', 'ok');
    }
  }
  hacker.releaseKeys = releaseKeys;

  function closeLockModal() {
    if (modal && modal.parentNode) modal.parentNode.removeChild(modal);
    modal = null;
  }

  /** Filtro global: mata las pulsaciones de las teclas secuestradas.
      Corre en fase de captura (ver init), o sea ANTES que cualquier otro
      listener de la pagina. Esta funcion se ejecuta con CADA tecla que se
      apriete en todo el juego, asi que las salidas rapidas de arriba tienen
      que ser lo primero: si no hay bloqueo activo, no hago absolutamente nada. */
  function onKeyCapture(e) {
    if (!locked || !lockedKeys.length) return;
    var k = (e.key || '').toLowerCase();
    /* e.key de una letra es un string de 1 caracter ("a"); el de una tecla
       especial es una palabra ("Enter", "ArrowUp", "Backspace"). Con esa
       comparacion de longitud dejo pasar todas las especiales sin tener que
       listarlas: nunca bloqueo Enter ni Backspace, asi el jugador siempre
       puede borrar y ejecutar. */
    if (k.length !== 1) return;
    if (lockedKeys.indexOf(k) === -1) return;      // no es una de las secuestradas

    /* Las dos lineas que MATAN la tecla:
         preventDefault  -> cancela el efecto por defecto (escribir la letra)
         stopPropagation -> corta el viaje del evento: no llega a nadie mas  */
    e.preventDefault();
    e.stopPropagation();

    /* THROTTLE: si el jugador mantiene apretada la tecla, el navegador repite
       el evento decenas de veces por segundo. Sin este freno sonarian 30
       errores por segundo y se llenaria la pantalla de avisos. Guardo el
       momento del ultimo aviso y solo dejo pasar uno cada 420ms. */
    var now = Date.now();
    if (now - lastBlockFeedback > 420) {
      lastBlockFeedback = now;
      GT.audio.error();
      if (modal) {
        modal.classList.remove('nudge');
        void modal.offsetWidth;
        modal.classList.add('nudge');
      }
      GT.ui.toast('Tecla "' + k.toUpperCase() + '" bloqueada por el hacker', 'bad');
    }
  }

  /* ============================================================
     ATAQUE 2 — Corrupcion de colores (20 segundos)
     ============================================================ */
  /* ATAQUE 2 — invertir los colores durante 20 segundos.
     Todo el efecto es UNA clase CSS: .color-hijack aplica un filter con
     invert() + hue-rotate() sobre el contenedor principal, asi que con una
     sola linea de JS se corrompe toda la pantalla de golpe (el CSS lo resuelve
     por GPU, no tengo que redibujar nada).
     La cuenta regresiva la lleva el tick restando dt a colorLeft; cuando llega
     a cero llama a stopColors y se saca la clase. */
  function startColors() {
    if (colorActive || GT.state.finished) return;

    colorActive = true;
    colorLeft = CFG.COLOR_TIME;

    var crt = document.getElementById('crt');
    crt.classList.add('color-hijack');

    fig.classList.add('is-attacking');
    say(GT.pick(COLOR_TAUNTS), 4000);
    GT.audio.glitch();
    GT.ui.shake();
    GT.ui.toast('✘ El hacker corrompió los colores de la pantalla (20 s)', 'bad');
    GT.damage(CFG.COLOR_DAMAGE, 'corrupción de video');
    if (GT.terminal) GT.terminal.notify('[GLITCH] perfil de color reescrito. disfrutá.', 'evil');
    if (GT.api) GT.api.logEvent('color_hijack', { seconds: CFG.COLOR_TIME });

    badge = document.createElement('div');
    badge.className = 'hk-badge';
    document.getElementById('crt').appendChild(badge);
    renderBadge();
  }

  function renderBadge() {
    if (!badge) return;
    var s = Math.max(0, Math.ceil(colorLeft));
    badge.innerHTML = '<b>VISTA CORROMPIDA</b><span>' +
                      (s < 10 ? '00:0' : '00:') + s + '</span>';
  }

  function stopColors() {
    if (!colorActive) {
      if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
      badge = null;
      return;
    }
    colorActive = false;
    colorLeft = 0;

    var crt = document.getElementById('crt');
    if (crt) crt.classList.remove('color-hijack');

    if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
    badge = null;

    if (fig && !locked) fig.classList.remove('is-attacking');
    GT.ui.toast('Colores restaurados', 'info');
    GT.audio.ok();
  }

  /* Ganchos para depurar / disparar a mano desde la consola del navegador.
     Sin esto, para probar un ataque tendria que jugar 38 segundos cada vez.
     Con esto escribo GlitchTec.hacker.forceLock() en la consola y listo. */
  hacker.forceLock = function () { if (canLock()) startLock(); };
  hacker.forceColors = startColors;
  hacker.forceMove = wander;
  hacker.questions = QUESTIONS;

})(window, document);
