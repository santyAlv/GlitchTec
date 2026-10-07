/* ============================================================
   Glitch.TEC — tabla de posiciones (ranking)
   Muestra los mejores puntajes de partidas GANADAS. Se puede ver
   el ranking global (la base MySQL, todos los jugadores) o el
   local (lo guardado en este navegador), y filtrar por modo.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var ranking = GT.ranking = {};

  var LIMIT = 10;
  var scope = 'global';     // 'global' | 'local'
  var modo = '';            // '' = todos | 'virus' | 'tecnico'
  var lastRequest = 0;

  var MODE_NAMES = { virus: 'PC Corrompida', tecnico: 'Servicio Técnico' };

  ranking.open = function () {
    GT.ui.setScreen('screen-ranking');
    load();
  };

  /* Si el jugador toca dos filtros rapido, la respuesta del primero puede
     llegar DESPUES que la del segundo (el fetch no garantiza orden) y me
     pintaria la tabla equivocada. Numero cada pedido y solo dibujo el ultimo. */
  function load() {
    var mine = ++lastRequest;
    showMessage('Cargando...');
    GT.api.getRanking(LIMIT, modo, scope).then(function (data) {
      if (mine === lastRequest) render(data || {});
    });
  }

  function render(data) {
    var note = document.getElementById('rk-note');
    var fallback = (scope === 'global' && data.offline);

    note.className = 'rk-note' + (fallback ? ' warn' : '');
    note.textContent = fallback
      ? 'No hay conexión con el servidor: se muestra el ranking de esta PC.'
      : scope === 'global'
        ? 'Mejores partidas ganadas de todos los jugadores.'
        : 'Mejores partidas ganadas en esta PC.';

    var rows = data.ranking || [];
    if (!rows.length) {
      showMessage('Todavía no hay partidas ganadas. ¡La primera puede ser la tuya!');
      return;
    }

    var body = document.getElementById('rk-body');
    var me = GT.api.getPlayerName();
    body.innerHTML = '';

    /* Armo las celdas con textContent y no con innerHTML: el nombre lo
       escribe cualquier jugador y viene de la base, asi que si alguien se
       pone de nombre <img onerror=...> tiene que verse como texto. */
    rows.forEach(function (r, i) {
      var tr = document.createElement('tr');
      if (r.player === me) tr.className = 'is-me';

      [
        i + 1,
        r.player,
        MODE_NAMES[r.modo] || r.modo || '—',
        r.score,
        r.streak || 0,
        GT.formatTime(r.time || 0),
        formatDate(r.at)
      ].forEach(function (value) {
        var td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });

      body.appendChild(tr);
    });
  }

  function showMessage(text) {
    var body = document.getElementById('rk-body');
    body.innerHTML = '';
    var tr = document.createElement('tr');
    var td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'rk-empty';
    td.textContent = text;
    tr.appendChild(td);
    body.appendChild(tr);
  }

  /* MySQL devuelve "2026-09-18 21:40:05" y el localStorage guarda ISO
     ("2026-09-18T21:40:05.000Z"). Cambiando el espacio por una T los dos
     formatos los entiende new Date(). */
  function formatDate(at) {
    if (!at) return '—';
    var d = new Date(String(at).replace(' ', 'T'));
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR');
  }

  /* Marca como activo el boton elegido dentro de su grupo de filtros. */
  function select(selector, btn) {
    document.querySelectorAll(selector).forEach(function (b) {
      var on = (b === btn);
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-rk-scope]').forEach(function (b) {
      b.addEventListener('click', function () {
        scope = b.dataset.rkScope;
        select('[data-rk-scope]', b);
        load();
      });
    });

    document.querySelectorAll('[data-rk-modo]').forEach(function (b) {
      b.addEventListener('click', function () {
        modo = b.dataset.rkModo;
        select('[data-rk-modo]', b);
        load();
      });
    });

    /* Nombre del jugador: se guarda mientras escribe. api.js lo recorta a
       40 caracteres (lo que mide la columna) y si queda vacio usa
       "estudiante". */
    var input = document.getElementById('player-name');
    if (input) {
      var saved = GT.api.getPlayerName();
      input.value = (saved === 'estudiante') ? '' : saved;
      input.addEventListener('input', function () { GT.api.setPlayerName(input.value); });
    }
  });

})(window, document);
