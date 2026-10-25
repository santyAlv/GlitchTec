/* ============================================================
   Glitch.TEC — Marco comun de minijuegos
   Cada minijuego (Firewall, caza de pop-ups, soldadura...) se registra aca y
   el marco se ocupa de lo repetitivo: engancharlo al loop de game.js (tick),
   frenarlo al reiniciar la partida, quedarse con el stick mientras corre y
   guardar el resumen de la ronda en la base. Solo corre UNO a la vez.

     GT.minigame.register('popups', {
       holdCursor: true,              // por defecto: el minijuego usa el stick para lo suyo.
                                      // false = deja el cursor del escritorio (ej. cerrar ventanas)
       start: function (opts) {},     // arranca la ronda
       tick:  function (dt) {},       // cada frame, con dt en segundos; llama GT.minigame.finish(...) al terminar
       stop:  function () {}          // limpia (se llama al terminar, al abortar o al reiniciar)
     });

     GT.minigame.start('popups', opts)       // true si arranco
     GT.minigame.finish({ accuracy: 80 })    // fin normal: guarda la ronda, avisa y llama stop()
     GT.minigame.stop()                      // aborta sin guardar (cerrar la ventana, por ejemplo)
     GT.minigame.isActive('popups')          // o sin argumento: hay alguno corriendo

   Eventos del bus: 'minigame:start' {id} y 'minigame:end' {id, result}.
   Puntaje, rachas y salud se tocan con las funciones de siempre (GT.correct,
   GT.wrong, GT.damage, GT.heal, GT.addScore). La RAM virtual es GT.drainRam /
   GT.freeRam (state.js). La reputacion del taller es la integridad: GT.damage /
   GT.heal; los minutos de la orden, GT.tech.addMinutes.
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec;
  var mg = GT.minigame = {};

  var defs = {};
  var current = null;             // { id, def }

  mg.register = function (id, def) { defs[id] = def; };

  mg.isActive = function (id) { return !!current && (id === undefined || current.id === id); };

  function end() {
    var c = current;
    current = null;
    if (!c) return;
    if (c.def.stop) c.def.stop();
    if (c.def.holdCursor !== false) GT.cursor.hold(false);
  }

  mg.start = function (id, opts) {
    var def = defs[id];
    if (!def || !GT.state.running || GT.state.finished) return false;
    end();
    current = { id: id, def: def };
    if (def.holdCursor !== false) GT.cursor.hold(true);
    if (def.start) def.start(opts || {});
    GT.emit('minigame:start', { id: id });
    return true;
  };

  /** Fin normal de la ronda: guarda el resumen en la base y avisa. */
  mg.finish = function (result) {
    if (!current) return;
    var id = current.id;
    end();
    if (GT.api) GT.api.logRound(id, result || {});
    GT.emit('minigame:end', { id: id, result: result || {} });
  };

  /** Aborta sin guardar nada. */
  mg.stop = function () { end(); };

  /** Lo llama el loop de game.js en cada frame. */
  mg.tick = function (dt) {
    if (current && current.def.tick) current.def.tick(dt);
  };

  /** Lo llama game.start: una partida nueva no hereda un minijuego en curso. */
  mg.reset = function () { end(); };

  /* Si la partida termina (derrota o victoria), el loop se frena y el minijuego
     no puede seguir: se cierra solo y devuelve el cursor. */
  GT.on('gameover', mg.stop);
  GT.on('victory', mg.stop);

})(window);
