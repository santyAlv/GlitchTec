/* ============================================================
   Glitch.TEC — QR para conectar el mando
   El celular se conecta escaneando un QR con "IP:PUERTO" del relay. Ese QR se
   muestra SOLO mientras corre un minijuego (los que necesitan el mando) y todavia
   no hay un celular conectado; al conectarse, o al cerrar el minijuego, se oculta.
   Las direcciones las manda el relay (GT.input.lan); el QR lo dibuja js/vendor/qrcode.js.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var active = false;             // hay un minijuego corriendo
  var panel = null;

  function qrSvg(texto) {
    var qr = window.qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function hide() { if (panel) { panel.remove(); panel = null; } }

  function render() {
    var inp = GT.input;
    if (!active || inp.connected) return hide();

    var cuerpo;
    if (!inp.relay) {
      cuerpo = '<p>El relay del mando no está encendido.</p>' +
               '<p>Ejecutá <code>npm start</code> en <code>tools/mando_server</code>.</p>';
    } else if (!inp.lan.length) {
      cuerpo = '<p>El relay no encontró una red local. Conectá la PC al Wi-Fi o al cable y reiniciá el relay.</p>';
    } else {
      cuerpo = '<div class="mandoqr-code">' + qrSvg(inp.lan[0]) + '</div>' +
               '<p>Escaneá el código con la app del mando.</p>' +
               '<p class="mandoqr-ip">A mano: <code>' + inp.lan.join('</code> · <code>') + '</code></p>';
    }
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'mandoqr';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', 'Conectar el mando');
      document.body.appendChild(panel);
    }
    panel.innerHTML = '<div class="mandoqr-bar">Conectar el mando</div><div class="mandoqr-body">' + cuerpo + '</div>';
  }

  GT.on('minigame:start', function () { active = true; render(); });
  GT.on('minigame:close', function () { active = false; render(); });
  GT.on('pad:relay', render);
  GT.on('pad:status', function (e) {
    if (active && e.connected && GT.ui && GT.ui.toast) GT.ui.toast('Mando conectado.', 'info');
    render();
  });

})(window, document);
