/* ============================================================
   Glitch.TEC — Emulador del mando (solo para desarrollo)
   Se carga abriendo el juego con  index.html?emu
   Reemplaza navigator.getGamepads() por un mando virtual con la forma del
   real: un stick (ejes 0 y 1) y dos botones (indices 0 y 1, los de
   GT.input.MAP). Se maneja con el panel de la esquina o con el teclado:

     W A S D / flechas  -> stick        Z -> boton izquierdo      X -> boton derecho
   ============================================================ */
(function () {
  'use strict';

  var pad = { id: 'Mando emulado', axes: [0, 0], buttons: [{ pressed: false }, { pressed: false }] };
  navigator.getGamepads = function () { return [pad]; };

  var keys = {};
  var KEYMAP = { w: 'u', arrowup: 'u', s: 'd', arrowdown: 'd', a: 'l', arrowleft: 'l', d: 'r', arrowright: 'r' };

  /* ---------- Panel ---------- */
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:10px;bottom:46px;z-index:99999;display:flex;gap:14px;' +
    'align-items:center;padding:10px 14px;background:rgba(4,9,30,.88);border:2px solid #4a6bff;' +
    'border-radius:14px;font:11px monospace;color:#9fb4ff;user-select:none;touch-action:none';
  box.innerHTML = '<div id="emu-base" style="width:84px;height:84px;border-radius:50%;background:#000;' +
    'display:flex;align-items:center;justify-content:center"><div id="emu-knob" style="width:48px;' +
    'height:48px;border-radius:50%;background:#7a2fe0;border:3px solid #4a6bff"></div></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><div id="emu-l" title="Botón izquierdo (Z)" ' +
    'style="width:40px;height:40px;border-radius:50%;border:3px solid #9fe;text-align:center;line-height:34px">◐</div>' +
    '<div id="emu-r" title="Botón derecho (X)" style="width:40px;height:40px;border-radius:50%;' +
    'border:3px solid #9fe;text-align:center;line-height:34px">◑</div></div>' +
    '<div>MANDO<br>EMULADO<br>WASD · Z · X</div>';
  document.body.appendChild(box);
  var knob = box.querySelector('#emu-knob'), bl = box.querySelector('#emu-l'), br = box.querySelector('#emu-r');
  var base = box.querySelector('#emu-base');
  var drag = { x: 0, y: 0 }, dragging = false;

  function clamp(v) { return Math.max(-1, Math.min(1, v)); }

  function sync() {
    pad.axes[0] = clamp((keys.r ? 1 : 0) - (keys.l ? 1 : 0) + drag.x);
    pad.axes[1] = clamp((keys.d ? 1 : 0) - (keys.u ? 1 : 0) + drag.y);
    knob.style.transform = 'translate(' + pad.axes[0] * 28 + 'px,' + pad.axes[1] * 28 + 'px)';
    bl.style.background = pad.buttons[0].pressed ? '#ff4ad8' : '#8a2a78';
    br.style.background = pad.buttons[1].pressed ? '#4a6bff' : '#2a3a8a';
  }

  function stickAt(e) {
    var r = base.getBoundingClientRect();
    drag.x = clamp((e.clientX - (r.left + r.width / 2)) / 28);
    drag.y = clamp((e.clientY - (r.top + r.height / 2)) / 28);
    sync();
  }
  base.addEventListener('pointerdown', function (e) { dragging = true; stickAt(e); });
  window.addEventListener('pointermove', function (e) { if (dragging) stickAt(e); });
  window.addEventListener('pointerup', function () { dragging = false; drag.x = drag.y = 0; sync(); });

  function hold(el, idx) {
    ['pointerdown', 'pointerup', 'pointerleave'].forEach(function (t) {
      el.addEventListener(t, function () { pad.buttons[idx].pressed = (t === 'pointerdown'); sync(); });
    });
  }
  hold(bl, 0); hold(br, 1);

  /* ---------- Teclado ---------- */
  function onKey(e, down) {
    var k = e.key.toLowerCase();
    if (KEYMAP[k]) { keys[KEYMAP[k]] = down; sync(); e.preventDefault(); }
    else if (k === 'z' || k === 'x') { pad.buttons[k === 'z' ? 0 : 1].pressed = down; sync(); }
  }
  window.addEventListener('keydown', function (e) { onKey(e, true); });
  window.addEventListener('keyup', function (e) { onKey(e, false); });

  sync();
})();
