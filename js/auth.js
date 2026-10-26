/* ============================================================
   Glitch.TEC — cuentas de usuario (cliente)
   Registro, inicio y cierre de sesion contra la API PHP, y la
   pantalla de cuenta. Jugar sin cuenta sigue andando
   igual: la sesion solo agrega que las partidas queden asociadas
   al usuario y que se pueda ver el historial.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var auth = GT.auth = {};

  var BASE = 'api';
  var MSG_OFFLINE = 'No hay conexión con el servidor: las cuentas necesitan el backend PHP.';

  /* Usuario con sesion iniciada, o null si es un invitado. Es la UNICA fuente
     de verdad del lado del navegador: quien necesite saber si hay sesion lee
     GT.auth.user o escucha el evento 'auth' del bus. */
  auth.user = null;

  /* ============================================================
     Validacion del lado del cliente
     Las MISMAS reglas que api/auth.php. Aca sirven para avisarle al
     jugador sin esperar la respuesta del servidor; la validacion que
     vale es la del servidor, porque esta se saltea desde la consola.
     Cada funcion devuelve '' si el dato esta bien o el mensaje de error.
     ============================================================ */
  auth.RULES = { USER_MIN: 3, USER_MAX: 24, PASS_MIN: 8, PASS_MAX: 72, EMAIL_MAX: 120 };

  auth.checkUsername = function (v) {
    return /^[A-Za-z0-9_.\-]{3,24}$/.test(String(v || ''))
      ? '' : 'El usuario debe tener entre 3 y 24 caracteres: letras, números, punto, guion o guion bajo.';
  };

  auth.checkEmail = function (v) {
    v = String(v || '');
    /* Chequeo de forma, nada mas: algo@algo.algo sin espacios. El formato
       exacto de un correo es mucho mas enredado y lo decide el servidor. */
    return (v.length <= auth.RULES.EMAIL_MAX && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      ? '' : 'Ingresá un correo electrónico válido.';
  };

  auth.checkPassword = function (v, username) {
    v = String(v || '');
    /* El tope de bcrypt es en BYTES, no en caracteres: una letra con acento
       ocupa dos. TextEncoder me da el largo real en UTF-8. */
    var bytes = window.TextEncoder ? new window.TextEncoder().encode(v).length : v.length;
    if (bytes < auth.RULES.PASS_MIN) return 'La contraseña debe tener al menos ' + auth.RULES.PASS_MIN + ' caracteres.';
    if (bytes > auth.RULES.PASS_MAX) return 'La contraseña no puede superar los ' + auth.RULES.PASS_MAX + ' caracteres.';
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return 'La contraseña debe combinar letras y números.';
    if (username && v.toLowerCase() === String(username).toLowerCase()) {
      return 'La contraseña no puede ser igual al nombre de usuario.';
    }
    return '';
  };

  /** Valida el formulario de registro entero.
      Devuelve { ok, errors } con un mensaje por campo que fallo. */
  auth.validate = function (data) {
    var errors = {};
    var e;
    if ((e = auth.checkUsername(data.username))) errors.username = e;
    if ((e = auth.checkEmail(data.email))) errors.email = e;
    if ((e = auth.checkPassword(data.password, data.username))) errors.password = e;
    return { ok: Object.keys(errors).length === 0, errors: errors };
  };

  /* ============================================================
     Llamadas a la API
     ============================================================ */
  /* A diferencia del post() de api.js, este NO tira excepcion con un 401 o
     un 422: en las cuentas, la respuesta de error es justamente lo que
     necesito leer (que campo esta mal, si la cuenta esta bloqueada). Siempre
     resuelve con un objeto { ok, ... } y nunca rechaza, asi el que llama no
     necesita un .catch().
     credentials 'same-origin' hace que el navegador mande la cookie de sesion
     a la API del propio juego y a ningun otro lado. */
  function call(method, path, body) {
    if (GT.api && GT.api.isOffline()) {
      return Promise.resolve({ ok: false, offline: true, error: MSG_OFFLINE });
    }
    var opts = { method: method, credentials: 'same-origin' };
    if (body) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    return fetch(BASE + '/' + path, opts).then(function (r) {
      return r.json().then(function (data) {
        data.status = r.status;
        return data;
      });
    }).catch(function () {
      return { ok: false, offline: true, error: MSG_OFFLINE };
    });
  }

  /* Todo cambio de sesion pasa por aca: guardo el usuario y lo grito por el
     bus. El que dibuja (la pantalla de cuenta, el campo de nombre) escucha
     'auth' y se actualiza solo. */
  function setUser(user) {
    auth.user = user || null;
    GT.emit('auth', { user: auth.user });
    return auth.user;
  }

  /** Pregunta al servidor si este navegador ya tiene una sesion abierta. */
  auth.refresh = function () {
    return call('GET', 'sesion.php').then(function (data) {
      setUser(data.ok ? data.user : null);
      return auth.user;
    });
  };

  /** Crea la cuenta. data = { username, email, password }.
      Valida aca antes de mandar: si ya se que esta mal, me ahorro el viaje. */
  auth.register = function (data) {
    var payload = {
      username: String(data.username || '').trim(),
      email: String(data.email || '').trim().toLowerCase(),
      password: String(data.password || '')
    };
    var check = auth.validate(payload);
    if (!check.ok) {
      return Promise.resolve({ ok: false, error: 'Revisá los datos del formulario.', errors: check.errors });
    }
    return call('POST', 'registro.php', payload).then(function (res) {
      if (res.ok) setUser(res.user);
      return res;
    });
  };

  /** Inicia sesion. login = nombre de usuario o correo. */
  auth.login = function (login, password) {
    login = String(login || '').trim();
    password = String(password || '');
    if (!login || !password) {
      return Promise.resolve({ ok: false, error: 'Completá el usuario y la contraseña.' });
    }
    return call('POST', 'login.php', { login: login, password: password }).then(function (res) {
      if (res.ok) setUser(res.user);
      return res;
    });
  };

  auth.logout = function () {
    return call('POST', 'logout.php', {}).then(function (res) {
      /* Aunque el servidor no conteste, del lado del navegador la sesion se
         da por cerrada: es lo que el jugador pidio. */
      setUser(null);
      return res;
    });
  };

  /** Historial de partidas de la cuenta: { ok, resumen, partidas }. */
  auth.history = function (limit) {
    return call('GET', 'mis_partidas.php?limit=' + (parseInt(limit, 10) || 20));
  };

  auth.isLogged = function () { return !!auth.user; };

  /* ============================================================
     Pantalla de cuenta
     El diseño vive en css/cuenta.css. Este codigo solo se agarra de los
     id, de los data-auth* y de los name de los campos.
     ============================================================ */
  var MODE_NAMES = { virus: 'PC Corrompida', tecnico: 'Servicio Técnico' };

  function $(id) { return document.getElementById(id); }

  auth.open = function () {
    GT.ui.setScreen('screen-auth');
    setNote('');
    render();
  };

  function setNote(text, bad) {
    var note = $('auth-note');
    if (!note) return;
    note.textContent = text || '';
    note.className = 'cta-note' + (bad ? ' warn' : '');
  }

  /* Muestra los errores de cada campo debajo de su input. textContent y no
     innerHTML: el mensaje viene del servidor. El aria-invalid pinta el
     campo y ademas lo anuncia el lector de pantalla. */
  function showErrors(form, errors) {
    var slots = form.querySelectorAll('[data-error]');
    for (var i = 0; i < slots.length; i++) {
      var name = slots[i].dataset.error;
      setFieldError(form, name, (errors && errors[name]) || '');
    }
  }

  function setFieldError(form, name, msg) {
    var slot = form.querySelector('[data-error="' + name + '"]');
    if (slot) slot.textContent = msg;
    var input = form.elements[name];
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  /* Validacion de cada campo del registro al salir de el, con las mismas
     reglas de arriba: el jugador se entera antes de mandar el formulario. */
  function checkField(form, name) {
    var el = form.elements;
    var msg = '';
    if (name === 'username') msg = auth.checkUsername(el.username.value);
    if (name === 'email')    msg = auth.checkEmail(el.email.value);
    if (name === 'password') msg = auth.checkPassword(el.password.value, el.username.value);
    if (name === 'password2' && el.password2.value !== el.password.value) msg = 'Las contraseñas no coinciden.';
    setFieldError(form, name, msg);
  }

  /* Despues de entrar o registrarse, las contraseñas vuelven a puntitos:
     si no, al cerrar sesion el campo aparece mostrando el texto. */
  function hidePasswords() {
    document.querySelectorAll('[data-auth-eye]').forEach(function (b) {
      b.parentNode.querySelector('input').type = 'password';
      b.textContent = 'VER';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', 'Mostrar contraseña');
    });
  }

  function showTab(tab) {
    var login = (tab !== 'registro');
    $('auth-login').hidden = !login;
    $('auth-registro').hidden = login;
    var btns = document.querySelectorAll('[data-auth-tab]');
    for (var i = 0; i < btns.length; i++) {
      var on = (btns[i].dataset.authTab === (login ? 'login' : 'registro'));
      btns[i].classList.toggle('is-on', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    setNote('');
  }

  function render() {
    var box = $('auth-forms');
    if (!box) return;                       // la pantalla no esta en este HTML
    var logged = auth.isLogged();
    box.hidden = logged;
    $('auth-user').hidden = !logged;

    if (GT.api && GT.api.isOffline()) setNote(MSG_OFFLINE, true);
    if (!logged) return;

    $('auth-username').textContent = auth.user.username;
    $('auth-email').textContent = auth.user.email;
    renderHistory();
  }

  /* Resumen por modo (una tarjeta cada uno) y la tabla de las ultimas
     partidas. Todo con createElement y textContent: los datos vienen de la
     base y el nombre de usuario lo eligio el jugador. */
  var historyReq = 0;

  function renderHistory() {
    var stats = $('auth-resumen');
    var body = $('auth-history');
    stats.innerHTML = '';
    body.innerHTML = '';
    emptyRow(body, 'Cargando...');

    /* Si la pantalla se redibuja antes de que vuelva la respuesta (abrir
       la cuenta justo cuando cambia la sesion), solo vale el ultimo pedido:
       si no, las dos respuestas se suman y aparece todo repetido. */
    var req = ++historyReq;
    auth.history(10).then(function (data) {
      if (req !== historyReq) return;
      body.innerHTML = '';
      if (!data.ok) { emptyRow(body, data.error || 'El historial no está disponible.'); return; }

      Object.keys(MODE_NAMES).forEach(function (modo) {
        stats.appendChild(statCard(modo, data.resumen && data.resumen[modo]));
      });

      if (!data.partidas || !data.partidas.length) {
        emptyRow(body, 'Todavía no jugaste ninguna partida con esta cuenta.');
        return;
      }
      data.partidas.forEach(function (p) {
        var tr = document.createElement('tr');
        cell(tr, MODE_NAMES[p.modo] || p.modo);
        var res = cell(tr, '');
        var tag = el('span', 'cta-res ' + (p.won ? 'gano' : 'perdio'), p.won ? 'GANADA' : 'PERDIDA');
        res.appendChild(tag);
        cell(tr, String(p.score), 'num');
        cell(tr, GT.formatTime(p.time || 0), 'num');
        cell(tr, formatDate(p.at));
        body.appendChild(tr);
      });
    });
  }

  function statCard(modo, r) {
    var card = el('div', 'cta-stat ' + modo);
    card.appendChild(el('h4', '', MODE_NAMES[modo].toUpperCase()));
    if (!r) {
      card.appendChild(el('p', '', 'Sin partidas todavía.'));
      return card;
    }
    var dl = el('dl');
    [['Partidas', r.jugadas], ['Ganadas', r.ganadas],
     ['Mejor puntaje', r.mejor_puntaje], ['Mejor racha', r.mejor_racha || 0]].forEach(function (par) {
      dl.appendChild(el('dt', '', par[0]));
      dl.appendChild(el('dd', '', String(par[1])));
    });
    card.appendChild(dl);
    return card;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function cell(tr, text, cls) {
    var td = el('td', cls, text);
    tr.appendChild(td);
    return td;
  }

  function emptyRow(body, text) {
    var tr = document.createElement('tr');
    var td = cell(tr, text, 'vacio');
    td.colSpan = 5;
    body.appendChild(tr);
  }

  /* La base devuelve "2026-09-18 21:40:05"; con la T en el medio lo
     entiende new Date(). Igual que en el ranking. */
  function formatDate(at) {
    if (!at) return '—';
    var d = new Date(String(at).replace(' ', 'T'));
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
  }

  /* El campo "tu nombre para el ranking" de la pantalla de modos: con sesion
     iniciada el nombre es el de la cuenta y no se puede escribir otro. */
  function syncPlayerField() {
    var input = $('player-name');
    if (!input) return;
    if (auth.user) {
      input.value = auth.user.username;
      input.disabled = true;
    } else if (input.disabled) {
      input.disabled = false;
      var saved = GT.api ? GT.api.getGuestName() : '';
      input.value = (saved === 'estudiante') ? '' : saved;
    }
  }

  GT.on('auth', function () {
    syncPlayerField();
    var btn = $('auth-menu-btn');
    if (btn) btn.textContent = auth.user ? 'CUENTA: ' + auth.user.username.toUpperCase() : 'INICIAR SESIÓN';
    if (document.querySelector('#screen-auth.is-active')) render();
  });

  function bindForms() {
    var loginForm = $('auth-login');
    var regForm = $('auth-registro');
    if (!loginForm || !regForm) return;

    document.querySelectorAll('[data-auth-tab]').forEach(function (b) {
      b.addEventListener('click', function () {
        showTab(b.dataset.authTab);
        var form = (b.dataset.authTab === 'registro') ? regForm : loginForm;
        form.elements[0].focus();
      });
    });

    /* Boton VER: alterna la contraseña entre puntitos y texto. Es un
       button type="button" para que no mande el formulario. */
    document.querySelectorAll('[data-auth-eye]').forEach(function (b) {
      b.addEventListener('click', function () {
        var input = b.parentNode.querySelector('input');
        var show = (input.type === 'password');
        input.type = show ? 'text' : 'password';
        b.textContent = show ? 'OCULTAR' : 'VER';
        b.setAttribute('aria-pressed', show ? 'true' : 'false');
        b.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
        input.focus();
      });
    });

    /* Registro: cada campo se revisa al salir de el, y el error se borra
       en cuanto el jugador vuelve a escribir. */
    ['username', 'email', 'password', 'password2'].forEach(function (name) {
      var input = regForm.elements[name];
      input.addEventListener('blur', function () { if (input.value) checkField(regForm, name); });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') setFieldError(regForm, name, '');
      });
    });

    /* submit del FORM y no click del boton: asi tambien entra con Enter. El
       preventDefault frena el envio clasico del formulario, que recargaria la
       pagina y se llevaria puesta la partida. */
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!loginForm.elements.login.value.trim() || !loginForm.elements.password.value) {
        setNote('Completá el usuario (o el correo) y la contraseña.', true);
        return;
      }
      setNote('Verificando...');
      auth.login(loginForm.elements.login.value, loginForm.elements.password.value).then(function (res) {
        loginForm.elements.password.value = '';      // la clave no se queda en el campo
        if (res.ok) { loginForm.reset(); hidePasswords(); setNote(''); }
        else setNote(res.error || 'No se pudo iniciar sesión.', true);
      });
    });

    regForm.addEventListener('submit', function (e) {
      e.preventDefault();
      ['username', 'email', 'password', 'password2'].forEach(function (name) { checkField(regForm, name); });
      var bad = regForm.querySelector('[aria-invalid="true"]');
      if (bad) { bad.focus(); return; }

      setNote('Creando la cuenta...');
      auth.register({
        username: regForm.elements.username.value,
        email: regForm.elements.email.value,
        password: regForm.elements.password.value
      }).then(function (res) {
        if (res.ok) { regForm.reset(); hidePasswords(); setNote(''); return; }
        showErrors(regForm, res.errors);
        setNote(res.error || 'No se pudo crear la cuenta.', true);
      });
    });

    var out = $('auth-logout');
    if (out) out.addEventListener('click', function () { auth.logout(); });
  }

  /* Al cargar: espero a que api.js termine de averiguar si hay backend y
     recien ahi pregunto por la sesion. Si preguntara antes, la bandera
     offline todavia no estaria puesta. */
  document.addEventListener('DOMContentLoaded', function () {
    bindForms();
    var ready = (GT.api && GT.api.ready) || Promise.resolve();
    ready.then(auth.refresh);
  });

})(window, document);
