/* ============================================================
   Glitch.TEC — Nivel 4: Purga (enfrentamiento final)
   El malware solo se borra si el jugador demuestra lo aprendido.
   Combate contra reloj, jugador vs. nucleo: cada acierto le saca
   vida al nucleo (mas con racha), cada error se la devuelve y le
   cuesta integridad al jugador. Termina cuando uno llega a 0.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var boss = GT.boss = {};

  var WIN_ID = 'boss';

  var TIME_LIMIT = 120;          // segundos para completar la purga
  var MAX_HP = 100;
  /* 20 por acierto: sin errores ni racha son 5 respuestas, una vuelta justa
     al cuestionario. El multiplicador de racha lo sube (x1.5 = 30, x2 = 40),
     asi que jugar fino acorta la pelea. */
  var DAMAGE_PER_HIT = 20;
  /* Cada error el nucleo se recupera. Sin esto, errar no le cambiaba nada al
     jefe y el texto de "el malware recupera terreno" era mentira. */
  var REGEN_PER_MISS = 10;

  var hp = MAX_HP;               // "vida" del nucleo
  var timeLeft = TIME_LIMIT;
  var idx = 0;                   // en que pregunta voy
  var answered = false;          // ¿ya conteste la actual? (evita doble click)
  var askedAt = 0;               // elapsed en que aparecio la pregunta (para el bonus por velocidad)
  var active = false;            // ¿el jefe esta en curso? (lo mira el reloj)

  var QUESTIONS = [
    {
      q: '¿Qué tipo de malware cifra tus archivos y exige un pago para devolvértelos?',
      options: ['Adware', 'Ransomware', 'Keylogger', 'Rootkit'],
      correct: 1,
      why: 'El <b>ransomware</b> cifra la información y pide un rescate. En el Nivel 2 lo viste ' +
           'como crypt0_lock.exe: consumía muchísima CPU justamente porque estaba cifrando el disco.'
    },
    {
      q: 'Te llega un adjunto llamado <b>curriculum.pdf.exe</b>. ¿Por qué es peligroso?',
      options: [
        'Porque los PDF siempre tienen virus',
        'Porque pesa demasiado para ser un currículum',
        'Porque la extensión real es .exe: es un programa disfrazado de documento',
        'Porque viene comprimido'
      ],
      correct: 2,
      why: 'Es una <b>doble extensión</b>. Windows oculta la extensión conocida, así que el usuario ve ' +
           '"curriculum.pdf" y ejecuta un programa sin darse cuenta. Igual que foto_vacaciones.jpg.exe.'
    },
    {
      q: '¿Cuál es la función de un <b>keylogger</b>?',
      options: [
        'Registrar todo lo que escribís con el teclado',
        'Acelerar el arranque del sistema',
        'Bloquear la pantalla hasta pagar',
        'Duplicar archivos para hacer copias de seguridad'
      ],
      correct: 0,
      why: 'Un <b>keylogger</b> captura cada pulsación y la envía al atacante: así obtiene usuarios, ' +
           'contraseñas y datos de tarjetas sin necesidad de romper ningún cifrado.'
    },
    {
      q: 'En el enlace <b>http://tec-edu.verificacion-cuenta.com/login</b>, ¿cuál es el dominio real?',
      options: ['tec-edu.com', 'tec-edu', 'verificacion-cuenta.com', 'login'],
      correct: 2,
      why: 'El dominio real son las <b>dos últimas partes antes de la primera barra</b>: ' +
           'verificacion-cuenta.com. Todo lo que está a la izquierda es un subdominio que el ' +
           'atacante puede escribir como quiera para imitar una marca.'
    },
    {
      q: 'Si <b>svchost.exe</b> es un proceso legítimo, ¿por qué <b>svch0st.exe</b> es sospechoso?',
      options: [
        'Porque consume menos memoria',
        'Porque imita el nombre real cambiando la "o" por un cero (typosquatting)',
        'Porque los procesos del sistema no terminan en .exe',
        'Porque tiene un PID muy alto'
      ],
      correct: 1,
      why: 'Se llama <b>typosquatting</b>: cambiar un carácter para pasar desapercibido en una lista larga. ' +
           'La verificación confiable no es el nombre sino la <b>firma digital</b> del proceso.'
    }
  ];

  /* ============================================================
     Ciclo
     ============================================================ */
  boss.reset = function () {
    hp = MAX_HP;
    timeLeft = TIME_LIMIT;
    idx = 0;
    answered = false;
    active = false;
  };

  boss.isActive = function () { return active; };

  /* Premio de racha "tiempo extra": lo llama state.js si el jefe esta activo. */
  boss.addTime = function (secs) {
    timeLeft += secs;
    renderHeader();
  };
  boss.getHp = function () { return hp; };

  /* Las dos funciones que mueven la vida del nucleo. Van clampeadas entre 0 y
     MAX_HP igual que la integridad del jugador en state.js: la barra es un
     ancho en %, y un 110% o un -20% la romperian. */
  boss.hit = function (amount) {
    hp = Math.max(0, hp - amount);
    renderHeader('hit');
    if (GT.engine && GT.engine.hitCore) GT.engine.hitCore();
  };

  boss.heal = function (amount) {
    hp = Math.min(MAX_HP, hp + amount);
    renderHeader('healed');
  };

  boss.open = function () {
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); return; }

    GT.levels.complete('l4_open');
    active = true;

    var body = document.createElement('div');
    body.className = 'boss';
    body.innerHTML =
      '<div class="boss-head">' +
        '<div class="who">NÚCLEO DEL MALWARE — GLITCH.CORE</div>' +
        '<div id="boss-canvas" style="height:74px;margin-bottom:9px;"></div>' +
        '<div class="boss-hpwrap">' +
          '<span class="lbl">MALWARE</span>' +
          '<div class="boss-hp" id="boss-hp"><i id="boss-hp-bar" style="width:100%"></i></div>' +
          '<span class="pct" id="boss-hp-pct">100%</span>' +
        '</div>' +
        '<div class="boss-hpwrap you">' +
          '<span class="lbl">VOS</span>' +
          '<div class="boss-hp you" id="boss-you"><i id="boss-you-bar" style="width:100%"></i></div>' +
          '<span class="pct" id="boss-you-pct">100%</span>' +
        '</div>' +
        '<div class="boss-timer" id="boss-timer">TIEMPO RESTANTE: 02:00</div>' +
      '</div>' +
      '<div class="boss-body" id="boss-body"></div>' +
      '<div class="boss-foot">' +
        '<span class="info" id="boss-info">Respondé con lo que aprendiste en los niveles anteriores.</span>' +
        '<button class="boss-next" id="boss-next" disabled>SIGUIENTE ▸</button>' +
      '</div>';

    GT.ui.openWindow({
      id: WIN_ID,
      title: 'purge.exe — secuencia de purga',
      icon: GT.ui.icons.skull,
      className: 'win-terminal',
      width: 660, height: 470,
      x: 130, y: 20,
      body: body,
      /* noClose: la ventana no tiene boton de cerrar. Es la unica del juego
         asi. Si se pudiera cerrar, el jugador esquivaria el enfrentamiento
         final y el reloj seguiria corriendo sin que pueda hacer nada. */
      noClose: true
    });

    document.getElementById('boss-next').addEventListener('click', next);

    if (GT.engine && GT.engine.startCore) GT.engine.startCore('boss-canvas');

    GT.audio.alarm();
    renderQuestion();
    renderHeader();
  };

  /* ============================================================
     Render
     ============================================================ */
  /* Dibuja las dos barras del combate. fx es opcional ('hit' o 'healed') y
     re-dispara la animacion de la barra del nucleo con el truco del reflow
     (ver ui.shake). La barra del jugador la anima game.js, que escucha los
     eventos damage/heal de todo el juego. */
  function renderHeader(fx) {
    var bar = document.getElementById('boss-hp-bar');
    if (!bar) return;
    var pct = Math.round(hp / MAX_HP * 100);
    bar.style.width = pct + '%';
    document.getElementById('boss-hp-pct').textContent = pct + '%';

    var box = document.getElementById('boss-hp');
    box.classList.toggle('crit', pct <= 25);
    if (fx) {
      box.classList.remove('hit', 'healed');
      void box.offsetWidth;
      box.classList.add(fx);
    }

    var you = Math.max(0, Math.round(GT.state.integrity));
    document.getElementById('boss-you-bar').style.width = you + '%';
    document.getElementById('boss-you-pct').textContent = you + '%';
    document.getElementById('boss-you').classList.toggle('crit', you <= 25);

    var t = document.getElementById('boss-timer');
    t.textContent = 'TIEMPO RESTANTE: ' + GT.formatTime(Math.max(0, timeLeft));
    t.style.color = timeLeft < 30 ? '#ff3b52' : '#ffcc44';
  }

  function renderQuestion() {
    var box = document.getElementById('boss-body');
    if (!box) return;

    var q = QUESTIONS[idx];
    answered = false;
    askedAt = GT.state.elapsed;

    var html = '<p class="boss-q"><span class="idx">[' + (idx + 1) + '/' + QUESTIONS.length + ']</span> ' +
               q.q + '</p><div class="boss-opts">';
    q.options.forEach(function (opt, i) {
      html += '<button class="boss-opt" data-i="' + i + '">' +
              String.fromCharCode(65 + i) + ')  ' + opt + '</button>';
    });
    html += '</div>';
    box.innerHTML = html;

    var btns = box.querySelectorAll('.boss-opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        answer(parseInt(this.dataset.i, 10));
      });
    }

    document.getElementById('boss-next').disabled = true;
    document.getElementById('boss-info').textContent =
      'Pregunta ' + (idx + 1) + ' de ' + QUESTIONS.length;
  }

  /* Procesa la respuesta. La bandera "answered" es importante: sin ella, dos
     clicks rapidos sobre la misma opcion contarian doble (doble dano al nucleo
     o doble castigo). La levanto ANTES de hacer cualquier otra cosa. */
  function answer(choice) {
    if (answered) return;
    answered = true;

    var q = QUESTIONS[idx];
    var right = (choice === q.correct);

    var box = document.getElementById('boss-body');
    /* Deshabilito TODAS las opciones y las pinto: en verde la correcta y en
       rojo la que eligio (si erro). Marcar siempre la correcta, aunque haya
       fallado, es a proposito: la idea es que aprenda, no solo que pierda. */
    var btns = box.querySelectorAll('.boss-opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (i === q.correct) btns[i].classList.add('right');
      else if (i === choice) btns[i].classList.add('wrong');
    }

    var fb = document.createElement('div');
    fb.className = 'boss-feedback';

    if (right) {
      GT.correct(200, 'respuesta correcta', askedAt);
      /* El dano sale DESPUES de GT.correct a proposito: asi este acierto ya
         cuenta para la racha y, si con el sube el multiplicador, pega fuerte. */
      var dmg = Math.round(DAMAGE_PER_HIT * GT.getMultiplier());
      boss.hit(dmg);
      GT.audio.ok();
      GT.ui.flash('gain');
      GT.learn(q.why.replace(/<[^>]+>/g, ''));
      fb.innerHTML = '<b>✔ CORRECTO.</b> Núcleo dañado −' + dmg + '%.<br>' + q.why;
    } else {
      GT.wrong(70, 'respuesta incorrecta');
      boss.heal(REGEN_PER_MISS);
      GT.damage(14, 'respuesta incorrecta en la purga');
      GT.audio.hurt();
      GT.ui.shake();
      GT.ui.flash('hit');
      GT.popups.burst(2);
      fb.innerHTML = '<b>✘ INCORRECTO.</b> El malware recupera terreno (+' + REGEN_PER_MISS + '%).<br>' + q.why;
    }

    box.appendChild(fb);
    box.scrollTop = box.scrollHeight;

    renderHeader();

    /* Si con este acierto el nucleo llego a 0, no espero a que apriete
       SIGUIENTE: termino ya. */
    if (hp <= 0) {
      finish();
      return;
    }

    document.getElementById('boss-next').disabled = false;
  }

  /* Las preguntas dan la vuelta: despues de la ultima vuelve la primera. La
     pelea no se termina por quedarse sin preguntas sino cuando alguno de los
     dos llega a 0 (o se acaba el reloj, que es una derrota). */
  function next() {
    idx = (idx + 1) % QUESTIONS.length;
    renderQuestion();
  }

  /* Victoria sobre el nucleo: dialogo final y GT.emit('victory') via levels.
     La derrota no pasa por aca: si la integridad del jugador llega a 0,
     GT.damage emite 'gameover' y game.js muestra el pantallazo azul. */
  function finish() {
    active = false;

    if (hp <= 0) {
      GT.ui.say([
        { text: 'no. no no no. me estás borrando de verdad.' },
        { text: 'aprendiste. eso es lo único que no puedo revertir.' },
        { friendly: true, who: 'SISTEMA', text: 'Núcleo eliminado. Restaurando integridad del sistema...' }
      ], function () {
        GT.ui.closeWindow(WIN_ID);
        GT.levels.finishBoss();
      });
      GT.audio.victory();
    }
  }

  /* ============================================================
     Reloj del jefe
     ============================================================ */
  /* El reloj del jefe. Lo llama el loop principal de game.js, igual que a
     todos los demas: no uso un setInterval propio justamente para que, si el
     juego se frena o el jugador cambia de pestana, el tiempo del jefe se frene
     tambien. Un setInterval seguiria corriendo por su cuenta y lo mataria
     mientras no esta mirando. */
  boss.tick = function (dt) {
    if (!active || GT.state.finished) return;
    timeLeft -= dt;
    renderHeader();

    if (timeLeft <= 0) {
      active = false;
      GT.ui.toast('Se acabó el tiempo: el malware tomó el control total', 'bad');
      /* 999 de dano = muerte segura, sea cual sea la integridad que le
         quedara. Es mas claro que llamar a gameover por otro lado: el camino
         es el mismo que el de cualquier otra derrota y no duplico logica. */
      GT.damage(999, 'tiempo agotado en la purga');
    }
  };

  /* La barra "VOS" de la ventana del jefe tiene que moverse apenas el jugador
     recibe un golpe, no recien en el proximo frame del reloj. */
  GT.on('hud', function () { if (active) renderHeader(); });

  boss.totalQuestions = QUESTIONS.length;

})(window, document);
