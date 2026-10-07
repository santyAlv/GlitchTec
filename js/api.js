/* ============================================================
   Glitch.TEC — cliente API (PHP + MySQL)
   Guarda partidas y eventos en el servidor. Si PHP no está
   disponible (abrir index.html en file://), cae a localStorage
   para que el prototipo siga funcionando offline.
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var api = GT.api = {};

  /* LA IDEA DE ESTE ARCHIVO: el juego NO tiene que saber si hay un servidor
     PHP atras o no. Llama siempre a los mismos metodos (startMatch,
     finishMatch...) y este modulo decide por dentro si va a la base MySQL o
     al localStorage del navegador. Eso me deja abrir index.html con doble
     click en cualquier maquina y que igual funcione, que es clave para poder
     mostrar el TP sin depender de que ande XAMPP. */
  var BASE = 'api';           // carpeta de los endpoints PHP
  var matchId = null;         // id que me devuelve la base al abrir la partida
  var matchToken = null;      // token secreto de esa partida (lo pide partida_end.php)
  var offline = false;        // bandera: ¿hay backend o no?
  var PLAYER_KEY = 'glitchtec_player';
  var playerName = loadPlayerName();

  function storageKey() { return 'glitchtec_scores'; }

  /* El nombre queda guardado en el navegador para no tener que escribirlo en
     cada partida. try/catch porque localStorage puede estar bloqueado (modo
     incognito estricto) y eso no puede romper el juego. */
  function loadPlayerName() {
    try { return localStorage.getItem(PLAYER_KEY) || 'estudiante'; }
    catch (e) { return 'estudiante'; }
  }

  /** Modo de juego actual: 'virus' (PC corrompida) o 'tecnico' (taller). */
  function currentMode() {
    return (GT.state && GT.state.mode === 'tecnico') ? 'tecnico' : 'virus';
  }

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(storageKey()) || '[]'); }
    catch (e) { return []; }
  }

  /* Guardo ordenado de mayor a menor puntaje, asi el recorte a 50 tira los
     peores y no los mas viejos: es un ranking, no un historial. */
  function saveLocal(rows) {
    rows.sort(function (a, b) { return b.score - a.score; });
    try { localStorage.setItem(storageKey(), JSON.stringify(rows.slice(0, 50))); }
    catch (e) { /* ignore */ }
  }

  /* Envoltorio de fetch para no repetir la configuracion en cada llamada.
     Dos cosas para acordarme:
       - el body de un POST JSON tiene que ir como STRING (JSON.stringify) y
         con el header Content-Type: application/json, si no PHP no sabe que
         le estoy mandando y file_get_contents('php://input') me llega crudo;
       - fetch NO tira error con un 404 o un 500: la promesa se cumple igual.
         Por eso chequeo r.ok a mano y lanzo la excepcion yo, para que el
         .catch() de mas abajo se entere. */
  function post(path, body) {
    return fetch(BASE + '/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function get(path) {
    return fetch(BASE + '/' + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  /** Comprueba si el backend PHP responde. Lo llamo una vez al cargar la
      pagina: si contesta, juego online; si falla (porque abri el archivo con
      file:// o porque Apache no esta prendido), levanto la bandera offline y
      de ahi en mas ni intento conectarme. */
  api.ping = function () {
    return get('ping.php').then(function (data) {
      offline = !(data && data.ok);
      return !offline;
    }).catch(function () {
      offline = true;
      return false;
    });
  };

  api.isOffline = function () { return offline; };

  api.setPlayerName = function (name) {
    playerName = String(name || '').trim().slice(0, 40) || 'estudiante';
    try { localStorage.setItem(PLAYER_KEY, playerName); } catch (e) { /* ignore */ }
  };

  api.getPlayerName = function () { return playerName; };

  /** Abre una partida nueva (al iniciar el juego).
      Guardo el id que devuelve la base porque todo lo que venga despues
      (eventos y cierre) tiene que apuntar a ESA fila. En modo offline me
      invento un id local con el timestamp, asi el resto del codigo no tiene
      que preguntar nunca si estoy online: siempre hay un matchId. */
  api.startMatch = function () {
    matchId = null;
    matchToken = null;
    var payload = {
      player_name: playerName,
      mode: currentMode(),
      started_at: new Date().toISOString()
    };

    if (offline) {
      matchId = 'local-' + Date.now();
      return Promise.resolve({ id: matchId, offline: true });
    }

    /* El .catch() es la red de seguridad: si el servidor se cae EN EL MEDIO de
       la partida (o nunca estuvo), no quiero un error rojo en consola ni que
       se corte el juego. Paso a offline y devuelvo un resultado valido, como
       si nada hubiera pasado. El jugador no se entera. */
    return post('partida_start.php', payload).then(function (data) {
      matchId = data.id;
      matchToken = data.token;
      return data;
    }).catch(function () {
      offline = true;
      matchId = 'local-' + Date.now();
      return { id: matchId, offline: true };
    });
  };

  /** Registra un evento de juego (opcional, para analytics). */
  api.logEvent = function (type, detail) {
    if (!matchId) return;
    var payload = {
      match_id: matchId,
      event_type: type,
      detail: detail || {},
      at: new Date().toISOString()
    };
    if (offline) return;
    post('evento.php', payload).catch(function () { /* silencioso */ });
  };

  /** Cierra la partida con el resumen final. */
  api.finishMatch = function (summary) {
    var row = {
      match_id: matchId,
      token: matchToken,
      player_name: playerName,
      mode: summary.mode || currentMode(),
      won: !!summary.won,
      score: summary.total || summary.base || 0,
      base_score: summary.base || 0,
      level_reached: summary.level || 0,
      elapsed_sec: summary.elapsed || 0,
      integrity: summary.integrity || 0,
      mistakes: summary.mistakes || 0,
      hints: summary.hints || 0,
      popups_closed: summary.popupsClosed || 0,
      best_streak: summary.bestStreak || 0,
      finished_at: new Date().toISOString()
    };

    /* Las partidas GANADAS van SIEMPRE al localStorage, incluso estando
       online. Es a proposito: ese es el ranking "local" (el de esta PC), y
       ademas funciona de respaldo si la base se cae. Las perdidas no entran
       porque el ranking es de partidas ganadas. */
    if (row.won) {
      var local = loadLocal();
      local.push({
        player: row.player_name,
        modo: row.mode,
        score: row.score,
        won: true,
        level: row.level_reached,
        time: row.elapsed_sec,
        streak: row.best_streak,
        at: row.finished_at
      });
      saveLocal(local);
    }

    if (offline) return Promise.resolve({ offline: true, saved: true });

    return post('partida_end.php', row).catch(function () {
      offline = true;
      return { offline: true, saved: true };
    });
  };

  /** Ranking. scope 'global' = la base MySQL (todos los jugadores),
      'local' = lo guardado en este navegador. Si pido el global y no hay
      servidor, devuelvo el local con offline: true para que la pantalla
      pueda avisar que no es el global. */
  api.getRanking = function (limit, modo, scope) {
    limit = limit || 10;
    var filtro = (modo === 'virus' || modo === 'tecnico') ? modo : null;

    /* Filtro los won por las dudas: versiones viejas del juego guardaban
       tambien las partidas perdidas en el localStorage. */
    function localRanking() {
      var rows = loadLocal().filter(function (r) {
        return r.won && (!filtro || (r.modo || 'virus') === filtro);
      });
      rows.sort(function (a, b) { return b.score - a.score; });
      return rows.slice(0, limit);
    }

    if (scope === 'local') {
      return Promise.resolve({ offline: offline, scope: 'local', modo: filtro || 'todos', ranking: localRanking() });
    }

    if (offline) {
      return Promise.resolve({ offline: true, modo: filtro || 'todos', ranking: localRanking() });
    }

    return get('ranking.php?limit=' + limit + (filtro ? '&modo=' + filtro : '')).then(function (data) {
      return data;
    }).catch(function () {
      offline = true;
      return { offline: true, modo: filtro || 'todos', ranking: localRanking() };
    });
  };

  // Al cargar la página, intentar detectar el backend
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      api.ping().then(function (ok) {
        if (ok) console.info('[Glitch.TEC] API PHP conectada');
        else console.info('[Glitch.TEC] Modo offline (localStorage)');
      });
    });
  }

})(window);
