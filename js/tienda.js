/* ============================================================
   Glitch.TEC — TIENDA DE REPUESTOS (Servicio Técnico)
   ------------------------------------------------------------
   El taller no tiene repuestos de regalo: el técnico los compra con
   su plata. Cada paso de reparación que cuesta algo (cambiar la fuente,
   la pila CMOS, la pasta...) necesita el repuesto en la mochila, y se
   gasta al usarlo, sirva o no. Comprar a ciegas es tirar plata: hay que
   diagnosticar primero y comprar lo que corresponde.

   Plata: arranca con un fondo, cada orden trae un anticipo del cliente
   para repuestos y paga el resto al cerrarse (lo maneja tech.js).
   Reusa las clases de la ficha técnica (css/detalle.css).
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var tienda = GT.tienda = {};

  var FONDO_INICIAL = 250000;

  /* Catálogo: id -> nombre, precio en pesos y para qué sirve */
  var CATALOGO = [
    { id: 'pila',         nombre: 'Pila CR2032 (CMOS)',        precio: 1800,   uso: 'Mantiene el reloj y el BIOS de la placa madre' },
    { id: 'pasta',        nombre: 'Pasta térmica',              precio: 1500,   uso: 'Entre el procesador y el disipador' },
    { id: 'cable',        nombre: 'Cable de alimentación',      precio: 2500,   uso: 'De la pared a la fuente' },
    { id: 'ventilador',   nombre: 'Ventilador de disipador',    precio: 9000,   uso: 'Refrigeración del procesador' },
    { id: 'ram',          nombre: 'Módulo de memoria RAM',      precio: 38000,  uso: 'Reemplazo o ampliación de memoria' },
    { id: 'ssd',          nombre: 'Disco SSD',                  precio: 55000,  uso: 'Reemplazo de disco' },
    { id: 'fuente',       nombre: 'Fuente de 500 W',            precio: 42000,  uso: 'Reemplazo de fuente de alimentación' },
    { id: 'fuente_pot',   nombre: 'Fuente de 750 W',            precio: 58000,  uso: 'Para equipos con placa de video exigente' },
    { id: 'gpu',          nombre: 'Placa de video',             precio: 120000, uso: 'Reemplazo de placa de video' },
    { id: 'monitor',      nombre: 'Monitor',                    precio: 95000,  uso: 'Reemplazo de pantalla' },
    { id: 'placa',        nombre: 'Placa madre',                precio: 95000,  uso: 'Último recurso: cambia todo el equipo por dentro' },
    { id: 'teclado',      nombre: 'Teclado',                    precio: 8500,   uso: 'Reemplazo de teclado' },
    { id: 'nic',          nombre: 'Placa de red',               precio: 18000,  uso: 'Reemplazo de la placa Ethernet' },
    { id: 'patch',        nombre: 'Patch cord de fábrica',      precio: 2500,   uso: 'Cable de red ya armado' },
    { id: 'rj45',         nombre: 'Ficha RJ45',                 precio: 300,    uso: 'Para armar un cable de red' },
    { id: 'vent_switch',  nombre: 'Ventilador de switch',       precio: 6000,   uso: 'Refrigeración interna del switch' },
    { id: 'switch',       nombre: 'Switch de 8 puertos',        precio: 65000,  uso: 'Reemplazo de switch' }
  ];

  /* Qué repuesto consume cada paso de reparación */
  var REPUESTO = {
    cambiar_pila: 'pila', cambiar_pasta: 'pasta', cambiar_cable: 'cable', cambiar_vent: 'ventilador',
    cambiar_ram: 'ram', ampliar_ram: 'ram', cambiar_disco: 'ssd', cambiar_fuente: 'fuente',
    cambiar_fuente_potente: 'fuente_pot', cambiar_gpu: 'gpu', cambiar_monitor: 'monitor',
    cambiar_placa: 'placa', cambiar_teclado: 'teclado', cambiar_nic: 'nic', cambiar_patch: 'patch',
    crimpar_rj45: 'rj45', cambiar_vent_switch: 'vent_switch', cambiar_switch: 'switch'
  };

  var porId = {};
  CATALOGO.forEach(function (c) { porId[c.id] = c; });

  var dinero = FONDO_INICIAL;
  var mochila = {};
  var root = null;

  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  tienda.reset = function () { dinero = FONDO_INICIAL; mochila = {}; };
  tienda.dinero = function () { return dinero; };
  tienda.cobrar = function (n) { dinero += n; };
  tienda.repuestoDe = function (paso) { return REPUESTO[paso] || null; };
  tienda.nombreDe = function (id) { return porId[id] ? porId[id].nombre : id; };
  tienda.hay = function (id) { return !id || (mochila[id] || 0) > 0; };

  /** Gasta el repuesto del paso (sirva o no). Devuelve el precio. */
  tienda.usar = function (paso) {
    var id = REPUESTO[paso];
    if (!id || !mochila[id]) return 0;
    mochila[id]--;
    GT.state.techCost = (GT.state.techCost || 0) + porId[id].precio;
    return porId[id].precio;
  };

  tienda.comprar = function (id) {
    var c = porId[id];
    if (!c || dinero < c.precio) return false;
    dinero -= c.precio;
    mochila[id] = (mochila[id] || 0) + 1;
    return true;
  };

  tienda.onChange = null;          // tech.js lo usa para refrescar la bandeja

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'tienda';
    root.className = 'detalle hidden';
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { tienda.close(); return; }
      var b = e.target.closest('[data-comprar]');
      if (!b) return;
      if (tienda.comprar(b.dataset.comprar)) {
        if (GT.audio && GT.audio.ok) GT.audio.ok();
        render();
        if (tienda.onChange) tienda.onChange();
      } else if (GT.audio && GT.audio.error) GT.audio.error();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && tienda.isOpen()) { e.stopPropagation(); tienda.close(); }
    }, true);
    (document.getElementById('screen-tech') || document.body).appendChild(root);
  }

  function render() {
    var filas = CATALOGO.map(function (c) {
      var tengo = mochila[c.id] || 0;
      return '<li class="tienda-fila">' +
        '<span class="tienda-nom"><b>' + GT.escapeHtml(c.nombre) + '</b><small>' + GT.escapeHtml(c.uso) + '</small></span>' +
        '<span class="tienda-tengo">' + (tengo ? 'tenés ' + tengo : '') + '</span>' +
        '<span class="tienda-precio">$' + money(c.precio) + '</span>' +
        '<button class="tienda-buy" data-comprar="' + c.id + '"' + (dinero < c.precio ? ' disabled' : '') + '>COMPRAR</button>' +
        '</li>';
    }).join('');

    root.innerHTML =
      '<div class="det-back" data-close></div>' +
      '<div class="det-win" role="dialog" aria-modal="true" aria-label="Tienda de repuestos">' +
        '<div class="det-bar"><span>TIENDA DE REPUESTOS TEC</span>' +
          '<button class="det-x" data-close aria-label="Cerrar">X</button></div>' +
        '<div class="tienda-cab"><span>Tu plata: <b>$' + money(dinero) + '</b></span>' +
          '<small>Comprá sólo lo que el diagnóstico pida: el repuesto se gasta aunque no sirva.</small></div>' +
        '<ul class="tienda-lista">' + filas + '</ul>' +
        '<div class="det-foot"><button class="det-cerrar" data-close>VOLVER AL BANCO</button></div>' +
      '</div>';
  }

  tienda.open = function () {
    build();
    render();
    root.classList.remove('hidden');
    if (GT.audio && GT.audio.open) GT.audio.open();
  };

  tienda.close = function () {
    if (!root || root.classList.contains('hidden')) return;
    root.classList.add('hidden');
    root.innerHTML = '';
    if (GT.audio && GT.audio.click) GT.audio.click();
  };

  tienda.isOpen = function () { return !!root && !root.classList.contains('hidden'); };

})(window, document);
