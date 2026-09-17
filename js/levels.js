/* ============================================================
   Glitch.TEC — progresion por niveles y objetivos
   Cada nivel define sus objetivos, su narrativa de entrada, sus
   pistas y su condicion de avance. Es el pegamento entre la
   Terminal, el Administrador de tareas, el correo y el jefe final.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var levels = GT.levels = {};

  /* Bandera anti-reentrada. Sin ella pasa esto: el ultimo objetivo se cumple,
     arranco la transicion de nivel (que tiene un setTimeout de 700ms), y en
     ese ratito otro modulo completa otro objetivo -> checkLevelDone corre de
     nuevo, vuelve a ver todo completo y avanza DOS niveles de una. Con la
     bandera, la primera vez que entro cierro la puerta hasta el nivel
     siguiente. Es un "candado" clasico para procesos asincronicos. */
  var advancing = false;

  /* ============================================================
     Definicion de niveles
     ============================================================ */
  /* NIVELES COMO DATOS, NO COMO CODIGO. Cada nivel es un objeto con:
       name       nombre que muestra el HUD
       bonus      puntos por completarlo
       objectives lista de objetivos (con id; el id es el que usan los otros
                  modulos para avisar "esto ya esta")
       intro      dialogo de entrada  (el hacker + el sistema)
       outro      dialogo de salida
       hint       FUNCION, no texto: se evalua en el momento y devuelve la
                  pista del primer objetivo que falte. Por eso la pista es
                  siempre util y no un texto generico.
     La ventaja de tenerlo asi: para agregar un nivel 5 agrego una clave "5"
     aca y el motor de abajo no se entera. */
  var DEFS = {

    /* ---------------- NIVEL 1 ---------------- */
    1: {
      name: 'Reconocimiento',
      bonus: 250,
      objectives: [
        { id: 'l1_help',    text: 'Escribir "help" en la Terminal' },
        { id: 'l1_note',    text: 'Leer C:\\Documentos\\leeme.txt' },
        { id: 'l1_scan',    text: 'Analizar el archivo con doble extensión' },
        { id: 'l1_log',     text: 'Leer C:\\Sistema\\registro.log' },
        { id: 'l1_unlock',  text: 'Desbloquear la carpeta cuarentena' },
        { id: 'l1_payload', text: 'Analizar payload.bin' }
      ],
      intro: [
        { text: 'Hola, estudiante. Gracias por abrir esa foto tan linda que te mandaron.' },
        { text: 'Ahora vivo acá. En tu disco. Entre tus apuntes y tus contraseñas en texto plano.' },
        { text: 'Adelante, buscame. Te dejo la terminal abierta. No vas a encontrar nada.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Abrí la Terminal y escribí "help". Empezá leyendo tus propias notas en C:\\Documentos.' }
      ],
      outro: [
        { text: 'Encontraste mi cuerpo. Muy bien. Pero un archivo no es un proceso.' },
        { text: 'Yo ya estoy corriendo en memoria. Borrame el .bin, no me hace ni cosquillas.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Se habilitó el Administrador de tareas. Buscá qué está consumiendo la CPU.' }
      ],
      hint: function () {
        var f = doneMap();
        if (!f.l1_help)    return 'Escribí  help  en la Terminal y presioná Enter.';
        if (!f.l1_note)    return 'Usá:  cd Documentos   y después   type leeme.txt';
        if (!f.l1_scan)    return 'En C:\\Descargas hay un archivo que termina en .jpg.exe. Usá:  scan foto_vacaciones.jpg.exe';
        if (!f.l1_log)     return 'Andá a C:\\Sistema con  cd \\Sistema  y leé:  type registro.log';
        if (!f.l1_unlock)  return 'El log dice bin2dec(101101). Pasá 101101 de binario a decimal y usá:  unlock <numero>';
        if (!f.l1_payload) return 'Entrá con  cd cuarentena  y ejecutá:  scan payload.bin';
        return 'Ya completaste todo este nivel.';
      }
    },

    /* ---------------- NIVEL 2 ---------------- */
    2: {
      name: 'Contención',
      bonus: 350,
      objectives: [
        { id: 'l2_open', text: 'Abrir el Administrador de tareas' },
        { id: 'l2_kill', text: 'Terminar los procesos sin firma digital', count: 0, total: 4 }
      ],
      intro: [
        { text: 'Contá conmigo: cuatro procesos míos, y suben la CPU cada segundo que dudás.' },
        { text: 'Ah, y algunos tienen nombres parecidos a los tuyos. Suerte con eso.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Los procesos legítimos están firmados por "WinTEC Corp.". Los del malware no tienen firma. Terminalos con el botón o con  kill <pid>  en la Terminal.' }
      ],
      outro: [
        { text: 'Me sacaste de la memoria. Bien. Igual tengo cómo volver a entrar.' },
        { text: 'Tu casilla de correo, por ejemplo. Ya te mandé algunas cositas.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Se habilitó TEC-Mail. Revisá la bandeja y clasificá cada correo antes de que el malware reingrese.' }
      ],
      hint: function () {
        var f = doneMap();
        if (!f.l2_open) return 'Doble click en el icono "Administrador de tareas" del escritorio.';
        return 'Mirá la columna FIRMA DIGITAL: los que dicen "Sin firma ✘" son del malware. ' +
               'Ojo con svch0st.exe, tiene un CERO en lugar de la letra O.';
      }
    },

    /* ---------------- NIVEL 3 ---------------- */
    3: {
      name: 'Phishing',
      bonus: 350,
      objectives: [
        { id: 'l3_open',   text: 'Abrir TEC-Mail' },
        { id: 'l3_triage', text: 'Clasificar todos los correos', count: 0, total: 5 }
      ],
      intro: [
        { text: 'Cinco correos. Algunos son míos. Otros no. ¿Sabés cuáles?' },
        { text: 'Si te equivocás, me abrís la puerta de nuevo. Y esta vez traigo amigos.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Antes de decidir, mirá el dominio real del remitente, los adjuntos y a dónde apunta el enlace.' }
      ],
      outro: [
        { text: 'Basta. Ya no me divertís.' },
        { text: 'Vení al núcleo si tenés tanto coraje. Terminal. Escribí purge. Te espero.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Última fase: escribí  purge  en la Terminal para atacar el núcleo del malware.' }
      ],
      hint: function () {
        var f = doneMap();
        if (!f.l3_open) return 'Doble click en el icono "TEC-Mail" del escritorio.';
        return 'Revisá el dominio DESPUÉS de la última arroba y antes de la primera barra: ' +
               'en "tec-edu.verificacion-cuenta.com" el dominio real es verificacion-cuenta.com.';
      }
    },

    /* ---------------- NIVEL 4 ---------------- */
    4: {
      name: 'Purga',
      bonus: 500,
      objectives: [
        { id: 'l4_open', text: 'Escribir "purge" en la Terminal' },
        { id: 'l4_boss', text: 'Reducir la integridad del malware a 0', count: 0, total: 5 }
      ],
      intro: [
        { text: 'Estoy en el núcleo del sistema. Para sacarme tenés que demostrar que entendiste algo.' },
        { text: 'Cinco preguntas. Cada respuesta correcta me borra un pedazo. Cada error, te borra a vos.' },
        { friendly: true, who: 'SISTEMA',
          text: 'Escribí  purge  en la Terminal para iniciar la secuencia final.' }
      ],
      hint: function () {
        return 'Escribí  purge  en la Terminal. Después respondé con lo que aprendiste en los niveles anteriores.';
      }
    }
  };

  levels.DEFS = DEFS;

  /* Convierte la lista de objetivos en un objeto { id: true/false } para
     poder preguntar  f.l1_help  en vez de recorrer el array cada vez. Lo usan
     las funciones hint() de arriba, que son un encadenado de ifs. */
  function doneMap() {
    var m = {};
    GT.state.objectives.forEach(function (o) { m[o.id] = o.done; });
    return m;
  }

  /* ============================================================
     Arranque de nivel
     ============================================================ */
  levels.start = function (n) {
    var def = DEFS[n];
    if (!def) return;

    advancing = false;
    GT.state.level = n;
    /* COPIO los objetivos de la definicion en vez de usarlos directo. Es
       obligatorio: el juego les va a escribir encima (done, count), y si
       escribiera sobre DEFS quedarian marcados como cumplidos para siempre;
       la segunda partida arrancaria con el nivel 1 ya resuelto. map() me
       devuelve un array nuevo con objetos nuevos. */
    GT.state.objectives = def.objectives.map(function (o) {
      return { id: o.id, text: o.text, done: false, count: o.count, total: o.total };
    });

    levels.renderObjectives();
    GT.emit('hud');

    /* DOSIFICACION: las herramientas se van desbloqueando de a una. No es
       solo narrativo, es diseno: si el jugador tuviera todo disponible desde
       el minuto cero no sabria por donde empezar. Uso >= y no === para que, si
       alguna vez salteo un nivel por debug, no queden iconos trabados. */
    if (n >= 2) GT.ui.setIconLocked('taskmgr', false);
    if (n >= 3) GT.ui.setIconLocked('mail', false);

    if (n === 2) {
      GT.procs.init();
      GT.ui.pulseIcon('taskmgr', true);
    }
    if (n === 3) {
      GT.procs.stop();
      GT.mail.init();
      GT.ui.pulseIcon('mail', true);
    }
    if (n === 4) {
      GT.ui.toast('Escribí  purge  en la Terminal', 'warn');
    }

    GT.ui.say(def.intro, function () {
      if (n === 1) {
        GT.popups.start();
        GT.terminal.open();
      }
    });
  };

  /* ============================================================
     Objetivos
     ============================================================ */
  levels.find = function (id) {
    for (var i = 0; i < GT.state.objectives.length; i++) {
      if (GT.state.objectives[i].id === id) return GT.state.objectives[i];
    }
    return null;
  };

  /** Marca un objetivo como cumplido (ignora ids desconocidos).
      Esta funcion es el PUNTO DE UNION entre todos los modulos: la terminal
      llama a complete('l1_help'), el correo a complete('l3_open')... y ninguno
      necesita saber en que nivel esta el jugador ni si ese objetivo existe.

      El  if (!o || o.done) return  hace dos cosas de una:
        !o      -> el id no pertenece al nivel actual: lo ignoro en silencio
                   (asi la terminal puede cantar objetivos del nivel 1 aunque
                   el jugador ya vaya por el 3, sin romper nada);
        o.done  -> ya estaba cumplido: no sumo los puntos dos veces. */
  levels.complete = function (id) {
    var o = levels.find(id);
    if (!o || o.done) return;

    o.done = true;
    if (o.total) o.count = o.total;

    GT.addScore(80, 'objetivo cumplido');
    GT.audio.ok();
    GT.ui.toast('✔ Objetivo: ' + o.text, 'info');
    levels.renderObjectives(id);
    checkLevelDone();
  };

  /** Suma progreso a un objetivo con contador (2 de 5, 3 de 5...). */
  levels.progress = function (id, amount) {
    var o = levels.find(id);
    if (!o || o.done) return;

    o.count = (o.count || 0) + (amount || 1);

    /* CASO ESPECIAL del nivel 2. Ahi el total no es fijo: el malware puede
       inyectar procesos nuevos mientras el jugador limpia, asi que "matar 4"
       puede terminar siendo "matar 7". En vez de un total quemado, lo
       recalculo como  ya matados + los que quedan vivos , y el objetivo se
       cumple cuando no queda ninguno hostil. Asi la barra de progreso dice la
       verdad en todo momento, aunque el total se mueva. */
    if (id === 'l2_kill') {
      o.total = o.count + GT.procs.remainingHostile();
      if (GT.procs.remainingHostile() === 0) { o.done = true; }
    } else if (o.total && o.count >= o.total) {
      o.done = true;                      // el resto: total fijo, comparacion normal
    }

    if (o.done) {
      GT.addScore(80, 'objetivo cumplido');
      GT.audio.ok();
      GT.ui.toast('✔ Objetivo: ' + o.text, 'info');
    }

    levels.renderObjectives(id);
    checkLevelDone();
  };

  levels.renderObjectives = function (flashId) {
    var ul = document.getElementById('objective-list');
    if (!ul) return;
    ul.innerHTML = '';

    GT.state.objectives.forEach(function (o) {
      var li = document.createElement('li');
      li.className = (o.done ? 'done' : '') + (o.id === flashId ? ' fresh' : '');
      var counter = (o.total && !o.done) ? ' (' + (o.count || 0) + '/' + o.total + ')' : '';
      li.innerHTML = '<span class="mark">' + (o.done ? '[x]' : '[ ]') + '</span>' +
                     '<span>' + GT.escapeHtml(o.text + counter) + '</span>';
      ul.appendChild(li);
    });
  };

  levels.getHint = function () {
    var def = DEFS[GT.state.level];
    return def && def.hint ? def.hint() : null;
  };

  /* ============================================================
     Avance
     ============================================================ */
  /* every() devuelve true solo si TODOS los elementos cumplen la condicion.
     Le agrego el  length > 0  adelante porque every() sobre un array vacio
     devuelve true (verdad vacua), y sin ese chequeo un nivel sin objetivos
     cargados se daria por completado apenas empieza. */
  function allDone() {
    return GT.state.objectives.length > 0 &&
           GT.state.objectives.every(function (o) { return o.done; });
  }

  /* Se llama despues de CADA objetivo cumplido. Los tres cortes de la primera
     linea, en orden: ya estoy avanzando / la partida termino / todavia falta
     algo. Si pasa los tres, el nivel esta hecho de verdad. */
  function checkLevelDone() {
    if (advancing || GT.state.finished || !allDone()) return;

    var n = GT.state.level;

    // Nivel 3: castigo extra si no llego al minimo de aciertos
    if (n === 3 && GT.mail.correctCount() < GT.mail.requiredCorrect) {
      GT.damage(10, 'demasiados correos mal clasificados');
      GT.ui.toast('Clasificaste mal varios correos: el malware amplió su acceso', 'bad');
    }

    advancing = true;
    var def = DEFS[n];

    GT.addScore(def.bonus, 'nivel completado');
    GT.audio.levelUp();
    GT.ui.flash('gain');

    // Recompensa de integridad por terminar limpio
    if (GT.state.integrity < 90) GT.heal(8, 'nivel completado');

    /* Espero 700ms antes del dialogo de cierre para que el jugador alcance a
       ver el aviso del ultimo objetivo y escuche el sonido de nivel superado.
       Vuelvo a chequear "finished" adentro del setTimeout porque en esos 700ms
       puede haber perdido (un pop-up drenando la ultima integridad): sin ese
       segundo chequeo se le abriria el dialogo de victoria de nivel encima del
       pantallazo azul. Regla general: despues de un await/timeout, lo que
       creias del estado puede haber cambiado. */
    setTimeout(function () {
      if (GT.state.finished) return;

      if (def.outro && def.outro.length) {
        GT.ui.say(def.outro, function () { goNext(n); });
      } else {
        goNext(n);
      }
    }, 700);
  }

  /* Avanza al nivel siguiente o, si no hay siguiente, gana la partida.
     Fijate que no hay ningun "4" escrito aca: pregunto si existe DEFS[n+1].
     Si manana agrego un nivel 5, esto sigue andando sin tocar una linea. */
  function goNext(n) {
    if (GT.state.finished) return;
    if (DEFS[n + 1]) {
      levels.start(n + 1);
    } else {
      GT.emit('victory');
    }
  }

  /** El jefe final avisa por aca cuando el malware muere. */
  levels.finishBoss = function () {
    var o = levels.find('l4_boss');
    if (o) { o.done = true; o.count = o.total; }
    levels.renderObjectives('l4_boss');
    GT.emit('victory');
  };

  levels.reset = function () { advancing = false; };

})(window, document);
