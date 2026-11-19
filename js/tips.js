/* ============================================================
   Glitch.TEC — TIPS AUTOMÁTICOS
   ------------------------------------------------------------
   Si el jugador pasa un rato sin avanzar, aparece un globo con una
   pista para seguir. La pista es la misma que da TEC-Bot (la de la
   Terminal en la PC, la del taller en el modo técnico), pero acá no
   se pide: llega sola cuando hace falta, y no gasta el cupo del bot.

   "Avanzar" no es mover el mouse: en la PC es cumplir (o sumar a) un
   objetivo; en el taller, hacer un paso o cerrar la orden.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;

  var FIRST = 40;     // segundos sin avanzar hasta el primer tip
  var AGAIN = 75;     // y entre un tip y el siguiente

  var idle = 0;
  var wait = FIRST;
  var firma = null;
  var el = null;

  /** Algo que cambia sólo cuando el jugador avanza de verdad. */
  function progreso(s) {
    if (s.mode === 'tecnico') return s.level + '|' + (s.techMinutes || 0) + '|' + s.score;
    return s.level + '|' + (s.objectives || []).map(function (o) {
      return (o.done ? 1 : 0) + ':' + (o.count || 0);
    }).join(',');
  }

  function pista(s) {
    var p = s.mode === 'tecnico' ? GT.tech.getHint() : GT.levels.getHint();
    return p || null;
  }

  /* Mientras habla un personaje o hay un minijuego abierto, no se interrumpe */
  function ocupado() {
    return !!document.querySelector('#dialog:not(.hidden), .sold:not(.hidden)');
  }

  function globo() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'tip';
    el.className = 'tip hidden';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<b class="tip-head">💡 ¿Te trabaste? Probá esto:</b>' +
                   '<p class="tip-text"></p>' +
                   '<button type="button" class="tip-ok">Entendido</button>';
    el.querySelector('.tip-ok').addEventListener('click', ocultar);
    var capa = document.getElementById('toast-layer');
    (capa ? capa.parentNode : document.body).appendChild(el);
    return el;
  }

  function mostrar(txt) {
    var g = globo();
    g.querySelector('.tip-text').textContent = txt;
    g.classList.remove('hidden');
    if (GT.audio && GT.audio.beep) GT.audio.beep();
  }

  function ocultar() { if (el) el.classList.add('hidden'); }

  setInterval(function () {
    var s = GT.state;
    if (!s || !s.running || s.finished || document.hidden) { idle = 0; ocultar(); return; }

    var f = progreso(s);
    if (f !== firma) { firma = f; idle = 0; wait = FIRST; ocultar(); return; }
    if (ocupado()) return;

    if (++idle < wait) return;
    idle = 0;
    wait = AGAIN;
    var txt = pista(s);
    if (txt) mostrar(txt);
  }, 1000);

})(window, document);
