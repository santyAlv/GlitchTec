/* ============================================================
   Glitch.TEC — FICHA DETALLADA DE UN COMPONENTE (Servicio Técnico)
   ------------------------------------------------------------
   Una ventana emergente que se abre al tocar una pieza del equipo
   en el banco de trabajo: imagen ampliada, qué hace la pieza, datos
   técnicos y una lista de indicadores de estado para ayudar al
   diagnóstico visual (polvo, sulfato, pasta térmica, etc.).

   Regla de juego: la ficha NO regala el diagnóstico. Los indicadores
   que se ven a simple vista en la pieza (polvo, sulfato, humedad) se
   muestran siempre; los que hay que medir o probar dicen "SIN REVISAR"
   hasta que el jugador hace esa inspección en la bandeja.

   El módulo no conoce la orden de trabajo: tech.js le pasa el estado
   ({ fallas, found, fixed, estado }) cada vez que la abre.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var detalle = GT.detalle = {};

  /* ----------------------------------------------------------
     Datos de cada pieza.
       asset       nombre del catálogo de js/assets.js
       specs       [[dato, valor], ...]
       indicadores { label, fallas: [ids de falla que lo encienden],
                     visible: true si se ve a simple vista en la pieza }
     ---------------------------------------------------------- */
  var DATOS = {
    fuente: {
      titulo: 'Fuente de alimentación (PSU)', asset: 'app.pc',
      texto: 'Convierte los 220 V de la pared en las tensiones continuas que usa el equipo. ' +
             'Si falla, el equipo no enciende o se apaga solo. Con los años, los capacitores ' +
             'se hinchan y la tensión cae bajo carga.',
      specs: [['Entrada', '220 V CA'], ['Salidas', '+12 V · +5 V · +3,3 V'],
              ['Conectores', '24 pines, CPU 4+4, SATA'], ['Potencia típica', '450 - 600 W']],
      indicadores: [
        { label: 'Tensión en el conector de 24 pines', fallas: ['fuente'] }
      ]
    },
    placa: {
      titulo: 'Placa madre (motherboard)', asset: 'app.pc',
      texto: 'Conecta todos los componentes entre sí. Trae el zócalo del procesador, las ranuras ' +
             'de RAM y los buses de datos. La humedad deja una costra de sulfato sobre el cobre ' +
             'que corta pistas y contactos.',
      specs: [['Zócalo', 'CPU (LGA / AM)'], ['Ranuras', 'RAM DDR · PCIe'], ['Chipset', 'comunica CPU, RAM y discos'],
              ['Aviso de falla', 'pitidos del POST']],
      indicadores: [
        { label: 'Costra de sulfato en las pistas', fallas: ['sulfato'], visible: true },
        { label: 'Marcas de humedad en el gabinete', fallas: ['humedad'], visible: true }
      ]
    },
    cooler: {
      titulo: 'Procesador y disipador', asset: 'hw.ventilador',
      texto: 'El procesador hace los cálculos y se calienta. La pasta térmica lleva el calor al ' +
             'disipador y el ventilador lo saca del gabinete. Sin refrigeración el equipo se ' +
             'apaga solo para protegerse.',
      specs: [['Temperatura normal', '35 - 60 °C'], ['Temperatura crítica', 'más de 90 °C'],
              ['Pasta térmica', 'se reemplaza cada 2 - 3 años'], ['Limpieza', 'aire comprimido']],
      indicadores: [
        { label: 'Polvo sobre las aletas y el filtro', fallas: ['polvo', 'filtro'], visible: true },
        { label: 'Pasta térmica seca o gastada', fallas: ['pasta'] },
        { label: 'Ventilador girando libre', fallas: ['vent_trabado'] }
      ]
    },
    ram: {
      titulo: 'Memoria RAM', asset: 'hw.ram',
      texto: 'Guarda los datos de los programas que se están usando. Si un módulo está mal ' +
             'asentado o tiene los contactos sucios, el equipo no arranca y da pitidos.',
      specs: [['Tipo', 'DDR3 / DDR4'], ['Contactos', 'dorados, se limpian con alcohol'],
              ['Ranuras', 'se traban con dos clips'], ['Aviso de falla', 'pitidos repetidos']],
      indicadores: [
        { label: 'Contactos con sulfato', fallas: ['sulfato_ram'], visible: true },
        { label: 'Módulo bien asentado y sano', fallas: ['ram', 'ram_rota'] }
      ]
    },
    gpu: {
      titulo: 'Placa de video', asset: 'app.pc',
      texto: 'Genera la imagen que sale por el monitor. Va en una ranura PCIe y tiene su propio ' +
             'ventilador. Si el cable de video está en la placa madre en vez de en esta placa, ' +
             'el monitor puede quedar sin señal.',
      specs: [['Ranura', 'PCIe x16'], ['Salidas', 'HDMI · DisplayPort · VGA'],
              ['Refrigeración', 'ventilador propio']],
      indicadores: [
        { label: 'Placa asentada y con señal', fallas: ['gpu', 'gpu_rota'] }
      ]
    },
    disco: {
      titulo: 'Disco de almacenamiento', asset: 'hw.disco',
      texto: 'Guarda el sistema operativo y los datos del usuario. Los sectores dañados aparecen ' +
             'como ruidos, lentitud o archivos que no abren. Antes de tocarlo hay que hacer una ' +
             'copia de respaldo.',
      specs: [['Tipo', 'HDD mecánico / SSD'], ['Conexión', 'SATA'], ['Diagnóstico', 'estado SMART'],
              ['Regla', 'primero el respaldo']],
      indicadores: [
        { label: 'Sectores dañados (SMART)', fallas: ['disco'] },
        { label: 'Copia de respaldo del cliente', fallas: ['respaldo'] }
      ]
    },
    cable: {
      titulo: 'Cable de alimentación', asset: 'hw.cable',
      texto: 'Lleva la corriente de la pared a la fuente. Antes de culpar a la fuente conviene ' +
             'probar el cable y el tomacorriente con otro equipo.',
      specs: [['Conector', 'C13 / IRAM'], ['Prueba', 'tester o equipo conocido']],
      indicadores: [
        { label: 'Cable y tomacorriente', fallas: ['cable', 'toma'] }
      ]
    },
    boton: {
      titulo: 'Panel frontal y pulsador', asset: 'app.pc',
      texto: 'El pulsador cierra un contacto en la placa madre para encender el equipo. Si su ' +
             'cable se suelta, todo parece "muerto" aunque la fuente esté bien.',
      specs: [['Conexión', 'PWR SW en la placa'], ['Luces', 'encendido y disco']],
      indicadores: [
        { label: 'Cable del pulsador', fallas: ['boton'] }
      ]
    },
    monitor: {
      titulo: 'Monitor y cable de video', asset: 'app.pc',
      texto: 'Muestra la imagen. "Sin señal" casi siempre es el cable de video flojo o enchufado ' +
             'en el puerto equivocado.',
      specs: [['Cables', 'HDMI · DisplayPort · VGA'], ['Mensaje típico', 'Sin señal']],
      indicadores: [
        { label: 'Cable y puerto de video', fallas: ['monitor', 'video'] }
      ]
    },
    nic: {
      titulo: 'Placa de red (NIC)', asset: 'hw.nic',
      texto: 'Conecta el equipo a la red por cable. Una descarga que entra por el cable UTP puede ' +
             'quemar el puerto y dejar al equipo sin conexión.',
      specs: [['Conector', 'RJ45'], ['Velocidad', '100 Mbps / 1 Gbps'], ['Indicadores', 'LED de enlace y actividad']],
      indicadores: [
        { label: 'Placa de red reconocida', fallas: ['nic'] },
        { label: 'Puerto RJ45 sano', fallas: ['puerto'] }
      ]
    },
    patch: {
      titulo: 'Cable de red (patch cord)', asset: 'hw.cable',
      texto: 'Cable UTP con una ficha RJ45 en cada punta. Una ficha mal crimpada deja pines ' +
             'doblados o hilos cortos que no hacen contacto.',
      specs: [['Norma', 'T568B'], ['Hilos', '4 pares trenzados'], ['Herramienta', 'crimpeadora y probador']],
      indicadores: [
        { label: 'Fichas RJ45 bien crimpadas', fallas: ['rj45'] }
      ]
    },
    switch: {
      titulo: 'Switch', asset: 'hw.nic',
      texto: 'Reparte la red entre los equipos del laboratorio. Si su ventilación se tapa, se ' +
             'recalienta y se reinicia solo.',
      specs: [['Puertos', '8 / 16 / 24'], ['Indicadores', 'un LED por puerto'], ['Refrigeración', 'ventilador o disipador']],
      indicadores: [
        { label: 'Luces de los puertos', fallas: ['switch', 'switch_muerto'] },
        { label: 'Temperatura y ventilación', fallas: ['vent_switch', 'vent_switch_roto'] }
      ]
    }
  };

  var ESTADO_TXT = {
    bad:   ['DETECTADO', 'bad'],
    vis:   ['VISIBLE', 'bad'],
    ok:    ['SIN NOVEDAD', 'ok'],
    fixed: ['REPARADO', 'fixed'],
    unk:   ['SIN REVISAR', 'unk']
  };

  /** ¿Hay ficha para esta pieza? */
  detalle.tiene = function (zona) { return !!DATOS[zona]; };

  /** Estado de un indicador según lo que ya sabe el jugador. */
  function estadoDe(ind, est) {
    var presentes = ind.fallas.filter(function (f) { return est.fallas.indexOf(f) !== -1; });
    var hay = presentes.length > 0;
    if (hay && presentes.every(function (f) { return est.fixed[f]; })) return 'fixed';
    if (ind.visible) return hay ? 'vis' : 'ok';
    if (hay && presentes.some(function (f) { return est.found[f]; })) return 'bad';
    if (!hay && est.estado === 'ok') return 'ok';
    return 'unk';
  }

  var root = null;
  var lastFocus = null;

  function build() {
    if (root) return;
    root = document.createElement('div');
    root.id = 'detalle';
    root.className = 'detalle hidden';
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) detalle.close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && detalle.isOpen()) { e.stopPropagation(); detalle.close(); }
    }, true);
    var host = document.getElementById('screen-tech') || document.body;
    host.appendChild(root);
  }

  /** Abre la ficha. est = { fallas, found, fixed, estado }. */
  detalle.open = function (zona, est) {
    var d = DATOS[zona];
    if (!d) return false;
    build();
    est = est || {};
    est = { fallas: est.fallas || [], found: est.found || {}, fixed: est.fixed || {}, estado: est.estado };

    var specs = d.specs.map(function (s) {
      return '<dt>' + GT.escapeHtml(s[0]) + '</dt><dd>' + GT.escapeHtml(s[1]) + '</dd>';
    }).join('');

    var inds = d.indicadores.map(function (ind) {
      var e = ESTADO_TXT[estadoDe(ind, est)];
      return '<li class="det-ind is-' + e[1] + '"><i class="det-dot"></i>' +
             '<span class="det-ind-txt">' + GT.escapeHtml(ind.label) + '</span>' +
             '<b class="det-ind-st">' + e[0] + '</b></li>';
    }).join('');

    root.innerHTML =
      '<div class="det-back" data-close></div>' +
      '<div class="det-win" role="dialog" aria-modal="true" aria-label="' + GT.escapeHtml(d.titulo) + '">' +
        '<div class="det-bar"><span>FICHA TÉCNICA — ' + GT.escapeHtml(d.titulo.toUpperCase()) + '</span>' +
          '<button class="det-x" data-close aria-label="Cerrar">X</button></div>' +
        '<div class="det-body">' +
          '<div class="det-img">' + GT.assets.html(d.asset, { size: 'hero', alt: d.titulo }) + '</div>' +
          '<div class="det-info">' +
            '<p class="det-texto">' + GT.escapeHtml(d.texto) + '</p>' +
            '<dl class="det-specs">' + specs + '</dl>' +
          '</div>' +
        '</div>' +
        '<div class="det-estado"><h4>INDICADORES DE ESTADO <small>(lo que se ve a simple vista; el resto, inspeccionando)</small></h4>' +
          '<ul>' + inds + '</ul></div>' +
        '<div class="det-foot"><button class="det-cerrar" data-close>CERRAR</button></div>' +
      '</div>';

    lastFocus = document.activeElement;
    root.classList.remove('hidden');
    var b = root.querySelector('.det-cerrar');
    if (b) b.focus();
    return true;
  };

  detalle.close = function () {
    if (!root || root.classList.contains('hidden')) return;
    root.classList.add('hidden');
    root.innerHTML = '';
    if (GT.audio && GT.audio.click) GT.audio.click();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* nada */ } }
  };

  detalle.isOpen = function () { return !!root && !root.classList.contains('hidden'); };

})(window, document);
