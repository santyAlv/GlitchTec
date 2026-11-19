/* ============================================================
   Glitch.TEC — filtro de nombres y correos ofensivos (navegador)
   ------------------------------------------------------------
   El mismo filtro que api/filtro.php y con la misma lista
   (api/filtro_palabras.json). Acá sólo sirve para avisar al
   momento; el que bloquea de verdad es el servidor.
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec;
  var lista = null;

  fetch('api/filtro_palabras.json')
    .then(function (r) { return r.json(); })
    .then(function (j) {
      lista = j;
      /* Cada palabra como /p+u+t+a+/, para agarrar "puuuta" */
      lista.re = (j.bloqueadas || []).map(function (b) { return new RegExp(b.split('').join('+') + '+'); });
    })
    .catch(function () { /* sin servidor (file://): queda sólo el filtro del servidor */ });

  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
               '$': 's', '!': 'i', '|': 'i', '€': 'e' };

  /** Minúsculas, sin acentos, leetspeak a letras y sólo a-z. */
  function normalizar(texto) {
    return String(texto).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[0-9$!|€]/g, function (c) { return LEET[c] || c; })
      .replace(/[^a-z]/g, '');
  }

  GT.filtro = {
    esOfensivo: function (texto) {
      if (!lista || !texto) return false;
      texto = String(texto);
      if ((lista.numeros || []).some(function (n) { return texto.indexOf(n) !== -1; })) return true;

      /* La @ del correo no se pega: "input@tal.com" no tiene que leerse "inputa..." */
      var t = texto.split('@').map(normalizar).join('-');
      (lista.permitidas || []).forEach(function (p) { t = t.split(p).join('-'); });
      return lista.re.some(function (re) { return re.test(t); });
    }
  };

})(window);
