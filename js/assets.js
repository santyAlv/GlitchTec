/* ============================================================
   Glitch.TEC — CAPA DE RECURSOS GRÁFICOS
   ------------------------------------------------------------
   La interfaz se dibujó sin imágenes: cada icono es un SVG de
   16x16 escrito a mano. Eso sirvió para maquetar, pero el arte
   final del equipo de diseño sale de Figma como PNG, y meter
   imágenes dentro de una maqueta hecha para texto es la forma
   más fácil de que se desarme todo: el renglón crece cuando la
   imagen termina de cargar, el icono empuja al de al lado, la
   tipografía se corre.

   Este módulo resuelve eso con una idea sola: NINGÚN elemento
   gráfico se escribe suelto en el HTML. Todos van adentro de un
   CONTENEDOR de medida fija (`.asset`), que ocupa exactamente el
   mismo lugar tenga adentro:

     1. el arte final          (hay PNG en el catálogo)
     2. el dibujo provisional  (el SVG que ya estaba, estado "draft")
     3. un marcador            (no hay nada todavía, estado "pending")

   Como los tres miden igual, se puede ir reemplazando pieza por
   pieza sin tocar la maqueta y sin que se mueva un pixel. Si un
   archivo falta o se renombra, el `onerror` lo devuelve al
   marcador en vez de dejar el icono roto del navegador.

   Para el equipo de diseño: para enchufar una pieza nueva alcanza
   con agregarla al catálogo de acá abajo. No hace falta tocar
   ningún otro archivo.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec || (window.GlitchTec = {});
  var assets = GT.assets = {};

  /* Carpeta donde el equipo de diseño exporta los iconos. Va
     codificada porque el nombre tiene ñ y si no, el navegador no
     la encuentra en algunos servidores. */
  var BASE = 'EntidadesGraficas/Dise%C3%B1o/iconos/';

  /* ============================================================
     CATÁLOGO
     nombre lógico -> archivo dentro de BASE.
     Un valor con barra se toma como ruta desde la raíz del proyecto.
     null = la pieza está identificada pero todavía no tiene arte
     final: el contenedor existe igual y muestra el provisional.
     ============================================================ */
  var MAP = {
    /* ---- aplicaciones del escritorio ---- */
    'app.terminal':   null,              // sin arte final: queda el SVG
    'app.explorador': 'busc-carp.png',
    'app.taskmgr':    null,
    'app.mail':       'mail.png',
    'app.manual':     null,
    'app.papelera':   null,            // no hay papelera dibujada todavía
    'app.pc':         'pc.png',

    /* ---- sistema de archivos (explorador) ---- */
    'fs.carpeta':      'carpeta.png',
    'fs.carpeta-lock': null,
    'fs.documento':    null,            // los txt*.png del set son globos de diálogo, no documentos
    'fs.imagen':       'img.png',
    'fs.comprimido':   'rar.png',
    'fs.musica':       'musica.png',
    'fs.ejecutable':   null,
    'fs.roto':         'error-file.png',
    'fs.peligro':      'fire.png',

    /* ---- avisos y diálogos del sistema ---- */
    'aviso.alerta':   'alerta.png',
    'aviso.error':    'dino-error.png',
    'aviso.info':     'i.png',
    'aviso.cargando': 'cargar.png',
    'aviso.malware':  null,

    /* ---- procesos (administrador de tareas) ---- */
    'proceso.firmado':   'wind.png',
    'proceso.sin-firma': 'alerta.png',

    /* ---- gráficos del sistema ---- */
    'sys.reloj':     'reloj.png',
    'sys.usuario':   'user.png',
    'sys.apagar':    'apagar.png',
    'sys.red':       'wif.png',
    'sys.disco':     'disco.png',
    'sys.impresora': 'imp.png',
    'sys.ventana':   'ventana.png',
    /* El logotipo viene dentro de un lienzo cuadrado con mucho margen
       transparente, así que se encuadra recortando en vez de entrar
       entero: si no, queda diminuto. Lo ideal es exportarlo ajustado. */
    'sys.logo':      { src: 'EntidadesGraficas/IdentidadVisual/logo/21.png', fit: 'cover' },
    'sys.isotipo':   { src: 'EntidadesGraficas/IdentidadVisual/logo/22.png' },

    /* ---- piezas de hardware, para la ventana de componentes ----
       Ya están exportadas y catalogadas; la pantalla que las use sólo
       tiene que pedirlas por nombre. */
    'hw.ram':        '1.png',
    'hw.ventilador': '2.png',
    'hw.disco':      'disco.png',
    'hw.cable':      'cabl.png',
    'hw.placa':      null,
    'hw.fuente':     null
  };

  /* Medidas de los contenedores. Son las únicas permitidas: así ninguna
     pantalla inventa un tamaño que después no entra. 'banner' es para las
     piezas apaisadas (logotipos, cabeceras), que no son cuadradas. */
  var SIZES = {
    xs: 16, sm: 20, md: 24, lg: 32, xl: 48, xxl: 64, hero: 96,
    banner: 'apaisado'          // logotipos y cabeceras: lo mide el CSS
  };

  /* ============================================================
     API del catálogo
     ============================================================ */
  assets.sizes = SIZES;
  assets.setBase = function (ruta) { BASE = ruta; };

  /** Da de alta (o reemplaza) el arte de una pieza. */
  assets.register = function (nombre, archivo) {
    MAP[nombre] = archivo || null;
    return assets;
  };

  /** ¿Esta pieza ya tiene arte final? */
  assets.has = function (nombre) { return !!MAP[nombre]; };

  /* Una entrada del catálogo puede ser un nombre de archivo suelto o
     un objeto { src, fit } cuando la pieza necesita encuadre especial. */
  function entrada(nombre) {
    var v = MAP[nombre];
    if (!v) return null;
    return (typeof v === 'string') ? { src: v, fit: null } : v;
  }

  /** Ruta del archivo, o null si todavía no hay arte. */
  assets.src = function (nombre) {
    var e = entrada(nombre);
    if (!e) return null;
    return e.src.indexOf('/') !== -1 ? encodeURI(e.src) : BASE + e.src;
  };

  /** Cómo se encuadra la pieza adentro de su contenedor. */
  assets.fit = function (nombre) {
    var e = entrada(nombre);
    return (e && e.fit) || 'contain';
  };

  /** Lo que falta dibujar. Sirve para el informe del equipo de diseño. */
  assets.pending = function () {
    var faltan = [];
    for (var k in MAP) { if (!MAP[k]) faltan.push(k); }
    return faltan.sort();
  };

  /* ============================================================
     EL CONTENEDOR
     Devuelve HTML listo para meter con innerHTML. Siempre el mismo
     cajón: lo que cambia es lo que hay adentro.

     opts: { size, alt, fallback (SVG provisional), className, title }
     ============================================================ */
  assets.html = function (nombre, opts) {
    opts = opts || {};
    /* Ojo: con hasOwnProperty, no con truthiness. Un tamaño que valga 0
       o una cadena igual tiene que ser válido. */
    var size = Object.prototype.hasOwnProperty.call(SIZES, opts.size) ? opts.size : 'md';
    var extra = opts.className ? ' ' + opts.className : '';
    var alt = opts.alt || '';
    var src = assets.src(nombre);

    if (src) {
      /* Arte final. El contenedor ya tiene su medida, así que la
         imagen no mueve nada cuando termina de cargar.

         Los iconos chicos cargan de una: hay listas que se redibujan
         en cada tick (el administrador de tareas, por ejemplo) y con
         carga diferida el navegador descarta la imagen antes de
         terminarla, así que no se veía nunca. Diferida queda sólo
         para las piezas grandes, que no están en listas vivas. */
      var carga = (size === 'banner' || size === 'hero' || size === 'xxl') ? 'lazy' : 'eager';
      return '<span class="asset asset-' + size + ' is-final fit-' + assets.fit(nombre) + extra + '"' +
               ' data-asset="' + esc(nombre) + '">' +
               '<img src="' + esc(src) + '" alt="' + esc(alt) + '"' +
               ' loading="' + carga + '" decoding="async" draggable="false"' +
               ' onerror="window.GlitchTec.assets.broken(this)">' +
             '</span>';
    }

    if (opts.fallback) {
      /* Maqueta provisional: el dibujo que ya estaba, marcado como
         borrador para poder listarlo después. */
      return '<span class="asset asset-' + size + ' is-draft' + extra + '"' +
               ' data-asset="' + esc(nombre) + '" title="' + esc(alt || nombre) +
               ' · arte provisional">' + opts.fallback + '</span>';
    }

    return marcador(nombre, size, extra, alt);
  };

  /** Marcador para lo que todavía no tiene ni provisional. */
  function marcador(nombre, size, extra, alt) {
    var corto = (nombre || '?').split('.').pop().slice(0, 2).toUpperCase();
    return '<span class="asset asset-' + size + ' is-pending' + (extra || '') + '"' +
             ' data-asset="' + esc(nombre) + '" title="' + esc(alt || nombre) +
             ' · falta el arte">' +
             '<span class="asset-ph" aria-hidden="true">' + esc(corto) + '</span>' +
           '</span>';
  }

  /** Nodo en vez de texto, para cuando conviene armarlo a mano. */
  assets.node = function (nombre, opts) {
    var wrap = document.createElement('span');
    wrap.innerHTML = assets.html(nombre, opts);
    return wrap.firstChild;
  };

  /* Si el archivo no está o cambió de nombre, el contenedor vuelve al
     marcador: nunca se ve el icono roto del navegador ni se descuadra
     la fila. */
  assets.broken = function (img) {
    var cont = img.parentNode;
    if (!cont) return;
    var nombre = cont.getAttribute('data-asset') || '';
    cont.className = cont.className.replace('is-final', 'is-pending');
    cont.title = nombre + ' · no se pudo cargar el archivo';
    cont.innerHTML = '<span class="asset-ph" aria-hidden="true">!</span>';
    if (window.console) console.warn('[Glitch.TEC] falta el recurso gráfico:', nombre);
  };

  /* ============================================================
     Montaje declarativo
     Para los contenedores escritos directamente en el index.html:
     <span data-asset="sys.logo" data-size="hero"></span>
     ============================================================ */
  assets.mount = function (root) {
    var nodos = (root || document).querySelectorAll('[data-asset]:empty');
    for (var i = 0; i < nodos.length; i++) {
      var el = nodos[i];
      var nombre = el.getAttribute('data-asset');
      var wrap = document.createElement('span');
      wrap.innerHTML = assets.html(nombre, {
        size: el.getAttribute('data-size') || 'md',
        alt: el.getAttribute('data-alt') || ''
      });
      el.parentNode.replaceChild(wrap.firstChild, el);
    }
  };

  /* ============================================================
     Modo revisión
     Marca en pantalla todo lo que todavía no es arte final, para que
     el equipo de diseño vea de una qué falta. Se prende desde la
     consola: GlitchTec.assets.revisar(true)
     ============================================================ */
  assets.revisar = function (on) {
    document.body.classList.toggle('ver-assets', on !== false);
    return assets.pending();
  };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  document.addEventListener('DOMContentLoaded', function () { assets.mount(); });

})(window, document);
