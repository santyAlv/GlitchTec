/* ============================================================
   Glitch.TEC — TEC-Mail (Nivel 3: Analisis de Phishing)
   Sistema de decisiones: por cada correo el jugador elige
   CONFIAR o REPORTAR. Siempre recibe una explicacion con las
   señales concretas que habia que mirar.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var mail = GT.mail = {};

  var WIN_ID = 'mail';
  var current = 0;

  var REQUIRED_CORRECT = 4;   // aciertos necesarios para superar el nivel

  var EMAILS = [
    {
      from: 'secretaria.academica@tec.edu.ar',
      name: 'Secretaría Académica TEC',
      date: 'Hoy 08:42',
      subject: 'Recordatorio: entrega del TP de Redes',
      body:
        'Buenos días,\n\n' +
        'Les recordamos que la entrega del Trabajo Práctico de Redes vence el jueves 23:59 ' +
        'a través del campus virtual.\n\n' +
        'Ante cualquier duda pueden responder este correo o consultar en la mesa de ayuda.\n\n' +
        'Saludos,\nSecretaría Académica',
      link: 'https://campus.tec.edu.ar/entregas/redes',
      phishing: false,
      reasons: [
        'El dominio es <b>tec.edu.ar</b>, el oficial de la institución.',
        'El enlace apunta al mismo dominio y usa <b>HTTPS</b>.',
        'No pide credenciales ni genera urgencia artificial.',
        'No trae archivos adjuntos ejecutables.'
      ]
    },
    {
      from: 'soporte@tec-edu.verificacion-cuenta.com',
      name: 'Soporte TEC (?)',
      date: 'Hoy 09:15',
      subject: '¡URGENTE! Tu cuenta será eliminada en 24 horas',
      body:
        'ESTIMADO USUARIO,\n\n' +
        'Detectamos actividad inusual en tu cuenta. Si no VERIFICAS tus datos en las ' +
        'próximas 24 HORAS tu cuenta y todos tus archivos serán ELIMINADOS PERMANENTEMENTE.\n\n' +
        'Hace click aqui para verificar ahora mismo.\n\n' +
        'Departamento de Seguridad',
      link: 'http://tec-edu.verificacion-cuenta.com/login?id=8871',
      phishing: true,
      reasons: [
        'El dominio real es <b>verificacion-cuenta.com</b>: "tec-edu" es solo un subdominio para engañarte.',
        'Usa <b>http://</b> sin cifrado.',
        'Crea <b>urgencia artificial</b> ("24 horas", "eliminadas permanentemente").',
        'Saludo genérico "Estimado usuario" y errores de ortografía.'
      ]
    },
    {
      from: 'premios@sorteos-ganaste.biz',
      name: 'Sorteos Online',
      date: 'Ayer 22:03',
      subject: 'FELICITACIONES: ganaste una notebook 🎉',
      body:
        'Hola!!!\n\n' +
        'Resultaste GANADOR de una notebook gamer en nuestro sorteo mensual.\n\n' +
        'Para reclamar tu premio descargá y completá el formulario adjunto.\n' +
        'Tenés 48hs antes de que el premio pase al siguiente participante.',
      attachment: 'premio_notebook.pdf.exe',
      phishing: true,
      reasons: [
        'El adjunto <b>premio_notebook.pdf.exe</b> tiene <b>doble extensión</b>: es un programa, no un PDF.',
        'Nunca participaste de ese sorteo.',
        'Dominio comercial desconocido (<b>.biz</b>) sin relación con vos.',
        'Premio inesperado + plazo corto: el combo clásico de la ingeniería social.'
      ]
    },
    {
      from: 'no-reply@github.com',
      name: 'GitHub',
      date: 'Ayer 18:30',
      subject: 'Nuevo inicio de sesión en tu cuenta',
      body:
        'Hola estudiante-tec,\n\n' +
        'Detectamos un inicio de sesión desde un dispositivo nuevo:\n\n' +
        '  Dispositivo: Chrome en Windows\n' +
        '  Ubicación: Córdoba, Argentina\n\n' +
        'Si fuiste vos, podés ignorar este mensaje. Si no reconocés la actividad, ' +
        'revisá la configuración de seguridad de tu cuenta.',
      link: 'https://github.com/settings/security',
      phishing: false,
      reasons: [
        'El dominio <b>github.com</b> es el oficial y el enlace apunta ahí mismo.',
        'Es una <b>notificación informativa</b>: no pide contraseña ni datos.',
        'Te deja ir por tu cuenta a la configuración en vez de darte un formulario.',
        'No todo correo de alerta es phishing: hay que verificar, no entrar en pánico.'
      ]
    },
    {
      from: 'seguridad@banco-nacion.gma1l.com',
      name: 'Banco Nación - Seguridad',
      date: 'Hoy 10:01',
      subject: 'Validá tu clave de home banking',
      body:
        'Estimado cliente:\n\n' +
        'Por una actualización de seguridad necesitamos que confirmes tus datos.\n\n' +
        'Responde este correo indicando:\n' +
        '  - Usuario de home banking\n' +
        '  - Clave\n' +
        '  - Código de coordenadas\n\n' +
        'Gracias por confiar en nosotros.',
      phishing: true,
      reasons: [
        'El dominio es <b>gma1l.com</b> (con el número 1): typosquatting de gmail.com.',
        'Un banco <b>jamás</b> pide tu clave ni tu tarjeta de coordenadas por correo.',
        'Pide responder con credenciales en texto plano.',
        'Un banco real nunca usaría una casilla de correo gratuita.'
      ]
    }
  ];

  /* answers[i] guarda como le fue al jugador con el correo i:
       null    = todavia no lo clasifico
       'right' = acerto
       'wrong' = erro
     Es un array "paralelo" a EMAILS: misma longitud, mismos indices. Podria
     guardar el resultado adentro de cada correo, pero entonces estaria
     ensuciando los DATOS con el estado de la partida y tendria que limpiarlos
     a mano en cada reinicio. */
  var answers = [];

  /* map() sobre EMAILS me da un array de la misma longitud lleno de null, sin
     tener que escribir la cantidad a mano: si manana agrego un sexto correo,
     esto se ajusta solo. */
  mail.init = function () {
    answers = EMAILS.map(function () { return null; });
    current = 0;
  };

  mail.reset = function () { answers = []; current = 0; };

  /* filter() devuelve un array nuevo solo con los que cumplen la condicion;
     su .length es el conteo. Es la forma corta de un for con contador. */
  mail.correctCount = function () {
    return answers.filter(function (a) { return a === 'right'; }).length;
  };

  mail.answeredCount = function () {
    return answers.filter(function (a) { return a !== null; }).length;
  };

  mail.requiredCorrect = REQUIRED_CORRECT;
  mail.total = EMAILS.length;

  /* ============================================================
     Ventana
     ============================================================ */
  mail.open = function () {
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); return; }
    if (!answers.length) mail.init();

    var body = document.createElement('div');
    body.className = 'mail';
    body.innerHTML =
      '<div class="mail-head">' +
        '<b>TEC-Mail</b><span>Bandeja de entrada</span>' +
        '<span class="prog" id="mail-prog"></span>' +
      '</div>' +
      '<div class="mail-main">' +
        '<div class="mail-list" id="mail-list"></div>' +
        '<div class="mail-read" id="mail-read"></div>' +
      '</div>';

    GT.ui.openWindow({
      id: WIN_ID,
      title: 'TEC-Mail — estudiante@tec.edu.ar',
      icon: GT.ui.icons.mail,
      width: 720, height: 450,
      x: 70, y: 30,
      body: body
    });

    GT.levels.complete('l3_open');
    render();
  };

  function render() {
    if (!GT.ui.isOpen(WIN_ID)) return;
    renderList();
    renderReader();
    var prog = document.getElementById('mail-prog');
    if (prog) {
      prog.textContent = 'Clasificados ' + mail.answeredCount() + '/' + EMAILS.length +
                         '  ·  Aciertos ' + mail.correctCount();
    }
  }

  function renderList() {
    var el = document.getElementById('mail-list');
    if (!el) return;
    el.innerHTML = '';

    EMAILS.forEach(function (m, i) {
      var b = document.createElement('button');
      var cls = 'mail-item';
      if (i === current) cls += ' active';
      if (answers[i]) cls += ' solved ' + (answers[i] === 'right' ? 'ok' : 'bad');
      b.className = cls;

      var tag = '';
      if (answers[i] === 'right') tag = '<span class="tag">✔ CORRECTO</span>';
      else if (answers[i] === 'wrong') tag = '<span class="tag">✘ ERROR</span>';

      b.innerHTML =
        '<span class="from">' + GT.escapeHtml(m.name) + '</span>' +
        '<span class="subj">' + GT.escapeHtml(m.subject) + '</span>' + tag;

      b.addEventListener('click', function () {
        current = i;
        GT.audio.click();
        render();
      });
      el.appendChild(b);
    });
  }

  function renderReader() {
    var el = document.getElementById('mail-read');
    if (!el) return;

    var m = EMAILS[current];
    var state = answers[current];

    var html =
      '<div class="mail-meta">' +
        '<h3>' + GT.escapeHtml(m.subject) + '</h3>' +
        '<dl>' +
          '<dt>De:</dt><dd>' + GT.escapeHtml(m.name) + ' &lt;' + GT.escapeHtml(m.from) + '&gt;</dd>' +
          '<dt>Para:</dt><dd>estudiante@tec.edu.ar</dd>' +
          '<dt>Fecha:</dt><dd>' + GT.escapeHtml(m.date) + '</dd>' +
        '</dl>' +
      '</div>' +
      '<div class="mail-bodytext">' + GT.escapeHtml(m.body) + '</div>';

    if (m.attachment) {
      html += '<div class="mail-attach">📎 Adjunto: <b>' + GT.escapeHtml(m.attachment) + '</b></div>';
    }
    if (m.link) {
      html += '<div class="mail-link">🔗 El enlace apunta realmente a:<br><b>' +
              GT.escapeHtml(m.link) + '</b></div>';
    }

    if (!state) {
      html +=
        '<div class="mail-actions">' +
          '<span class="q">¿Este correo es confiable?</span>' +
          '<button class="xp-btn trust"  data-act="trust">✔ Confiar</button>' +
          '<button class="xp-btn report" data-act="report">⚑ Reportar como phishing</button>' +
        '</div>';
    } else {
      var right = (state === 'right');
      html +=
        '<div class="mail-verdict ' + state + '">' +
          '<h4>' + (right ? '✔ DECISIÓN CORRECTA' : '✘ DECISIÓN INCORRECTA') + ' — ' +
            (m.phishing ? 'era PHISHING' : 'era LEGÍTIMO') + '</h4>' +
          '<div>Señales a mirar:</div>' +
          '<ul><li>' + m.reasons.join('</li><li>') + '</li></ul>' +
        '</div>';
    }

    el.innerHTML = html;

    var trust = el.querySelector('[data-act="trust"]');
    var report = el.querySelector('[data-act="report"]');
    if (trust)  trust.addEventListener('click', function () { decide(false); });
    if (report) report.addEventListener('click', function () { decide(true); });
  }

  /* LA LINEA CLAVE DEL NIVEL 3, y es mas sutil de lo que parece:

       right = (reportedAsPhishing === m.phishing)

     No estoy preguntando "¿es phishing?", estoy comparando lo que DIJO el
     jugador contra lo que ES el correo. Los cuatro casos salen de una sola
     comparacion:
       reporto phishing (true)  y era phishing (true)   -> true   ACIERTO
       confio          (false) y era legitimo (false)   -> true   ACIERTO
       reporto phishing (true)  y era legitimo (false)  -> false  ERROR
       confio          (false) y era phishing (true)    -> false  ERROR

     Es importante que los DOS errores cuenten como error: reportar un correo
     legitimo tambien es un problema real (bloqueas comunicacion de verdad),
     aunque duela menos —abajo le doy 6 de dano en vez de 12—. */
  function decide(reportedAsPhishing) {
    var m = EMAILS[current];
    var right = (reportedAsPhishing === m.phishing);
    answers[current] = right ? 'right' : 'wrong';

    if (right) {
      GT.audio.ok();
      GT.addScore(140, 'correo clasificado correctamente');
      GT.ui.flash('gain');
      GT.ui.toast('✔ Correcto: ' + (m.phishing ? 'era phishing' : 'era legítimo'), 'info');
      /* Guardo las senales como "conceptos aprendidos" para la pantalla final,
         sacandoles el HTML con el regex /<[^>]+>/g (todo lo que este entre
         < y >, el /g para que los saque todos y no solo el primero). */
      m.reasons.forEach(function (r) {
        GT.learn(r.replace(/<[^>]+>/g, ''));
      });
    } else {
      GT.audio.hurt();
      GT.state.mistakes++;
      var dmg = m.phishing ? 12 : 6;   // confiar en un phishing duele mas
      GT.damage(dmg, m.phishing ? 'caíste en un phishing' : 'reportaste un correo legítimo');
      GT.addScore(-50, 'clasificación incorrecta');
      GT.ui.shake();
      GT.ui.flash('hit');
      GT.ui.toast(m.phishing ? '✘ Era phishing: acabás de entregar tus datos'
                             : '✘ Era legítimo: bloqueaste comunicación real', 'bad');
      if (m.phishing) GT.terminal.notify('[GLITCH] Gracias por los datos, estudiante.', 'evil');
    }

    GT.levels.progress('l3_triage', 1);
    render();
  }

  mail.getEmails = function () { return EMAILS; };

})(window, document);
