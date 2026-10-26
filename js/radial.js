/* ============================================================
   Glitch.TEC — Menú radial del mando
   Mantener apretado el boton derecho abre un menu circular
   alrededor del cursor. El stick elige la opcion (no hace falta
   apuntar con precision: alcanza con inclinarlo hacia el lado) y
   se confirma soltando el boton derecho o con el izquierdo.

   Las opciones dependen de lo que este en pantalla:
     taller                 -> herramientas de la mesa
     Terminal en primer plano -> comandos (los que no llevan
                               argumentos se ejecutan; los otros se
                               escriben en la linea para completarlos)
     escritorio             -> programas

   Un toque corto del boton derecho sigue siendo un clic derecho
   comun. Mientras haya un minijuego (que usa ese boton para lo
   suyo) el menu no se abre.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var radial = GT.radial = {};

  var HOLD_MS = 320;              // cuanto hay que mantener el boton para abrirlo
  var RADIUS = 112;               // distancia del centro a cada opcion

  /* Comandos de la Terminal que ofrece el menu, en el orden en que se
     reparten alrededor. arg: true -> se escribe "comando " para completarlo. */
  var TERM_OPTS = [
    { cmd: 'dir',    label: 'dir',    desc: 'Ver la carpeta actual' },
    { cmd: 'scan',   label: 'scan',   desc: 'Analizar un archivo', arg: true },
    { cmd: 'ps',     label: 'ps',     desc: 'Ver los procesos' },
    { cmd: 'kill',   label: 'kill',   desc: 'Terminar un proceso', arg: true },
    { cmd: 'unlock', label: 'unlock', desc: 'Desbloquear una carpeta', arg: true },
    { cmd: 'type',   label: 'type',   desc: 'Leer un archivo', arg: true },
    { cmd: 'cd ..',  label: 'cd ..',  desc: 'Subir una carpeta' },
    { cmd: 'pista',  label: 'pista',  desc: 'Ayuda del nivel (cuesta puntos)' }
  ];

  var timer = null;               // espera para abrir mientras se mantiene el boton
  var menu = null;                // { el, items, opts, sel }

  /* ---------------- Contexto: que opciones mostrar ---------------- */
  function terminalActive() {
    var w = GT.ui.getWindow('terminal');
    return !!w && !w.el.classList.contains('inactive') && !w.el.classList.contains('minimized');
  }

  function optionsFor() {
    var s = GT.state;
    if (s.mode === 'tecnico' && GT.tech.isRunning()) {
      var held = GT.bench.held();
      return [{ id: 'mano', label: 'Mano', desc: 'Soltar la herramienta' }]
        .concat(GT.bench.tools().map(function (t) {
          return { id: t.id, label: t.label.charAt(0) + t.label.slice(1).toLowerCase(), desc: 'Agarrar' };
        }))
        .map(function (o) { o.kind = 'tool'; o.on = (o.id === held); return o; });
    }

    if (terminalActive()) {
      var have = GT.terminal.commands().map(function (c) { return c.name; });
      return TERM_OPTS.filter(function (o) { return have.indexOf(o.cmd.split(' ')[0]) !== -1; })
        .map(function (o) { return { id: o.cmd, label: o.label, desc: o.desc, arg: o.arg, kind: 'cmd' }; });
    }

    return GT.ui.apps().filter(function (a) { return a.id !== 'trash'; }).map(function (a) {
      return { id: a.id, label: a.label, asset: a.asset, icon: a.icon, locked: a.locked, kind: 'app',
               desc: a.locked ? 'Bloqueado' : 'Abrir' };
    });
  }

  /* ---------------- Abrir y cerrar ---------------- */
  function open() {
    timer = null;
    if (menu || !GT.state.running || GT.state.finished || GT.minigame.isActive()) return;
    var opts = optionsFor();
    if (!opts.length) return;

    /* El menu se queda con el stick: el cursor deja de moverse y no hace
       clics por detras mientras se elige. */
    GT.cursor.hold(true);

    var p = GT.cursor.pos();
    var box = RADIUS + 52;
    var cx = Math.max(box, Math.min(window.innerWidth - box, p.x));
    var cy = Math.max(box, Math.min(window.innerHeight - box, p.y));

    var el = document.createElement('div');
    el.id = 'radial-menu';
    el.style.left = cx + 'px';
    el.style.top = cy + 'px';
    el.setAttribute('role', 'menu');
    el.innerHTML = '<div class="rm-ring"></div><div class="rm-center"><b></b><small></small></div>';

    var n = opts.length;
    var items = opts.map(function (o, i) {
      /* El 0 queda arriba y se reparte en sentido horario, igual que
         GT.input.sector: asi el sector que devuelve es el indice. */
      var ang = (i / n) * 2 * Math.PI;
      var it = document.createElement('div');
      it.className = 'rm-item rm-' + o.kind + (o.locked ? ' is-locked' : '') + (o.on ? ' is-on' : '');
      it.setAttribute('role', 'menuitem');
      it.style.left = Math.round(Math.sin(ang) * RADIUS) + 'px';
      it.style.top = Math.round(-Math.cos(ang) * RADIUS) + 'px';
      if (o.kind === 'app') it.innerHTML = GT.ui.slot(o.asset, o.icon, 'lg', o.label);
      it.appendChild(document.createElement('span')).textContent = o.label;
      el.appendChild(it);
      return it;
    });

    document.body.appendChild(el);
    menu = { el: el, items: items, opts: opts, sel: -1 };
    pick(GT.input.axes());
    GT.audio.click();
  }

  function close() {
    if (!menu) return;
    menu.el.remove();
    menu = null;
    GT.cursor.hold(false);
  }

  /* El stick elige. Si vuelve al centro se queda la ultima opcion marcada:
     asi soltar el stick antes que el boton no pierde la eleccion. */
  function pick(a) {
    if (!menu) return;
    var s = GT.input.sector(a.x, a.y, menu.opts.length);
    if (s === -1 || s === menu.sel) { label(); return; }
    menu.sel = s;
    menu.items.forEach(function (it, i) { it.classList.toggle('is-sel', i === s); });
    GT.audio.key();
    label();
  }

  function label() {
    var o = menu.opts[menu.sel];
    menu.el.querySelector('.rm-center b').textContent = o ? o.label : 'Elegí con el stick';
    menu.el.querySelector('.rm-center small').textContent = o ? o.desc : 'Soltá para cancelar';
  }

  /* ---------------- Ejecutar la opcion ---------------- */
  function confirm() {
    if (!menu) return;
    var o = menu.opts[menu.sel];
    close();
    if (!o) return;

    if (o.kind === 'tool') {
      GT.bench.hold(o.id);
      GT.audio.open();
      return;
    }
    if (o.kind === 'app') {
      GT.ui.launch(o.id);
      return;
    }
    /* Comando: si necesita un argumento se escribe en la linea de la
       Terminal para que el jugador lo complete; si no, se ejecuta. */
    var input = document.getElementById('term-input');
    if (o.arg && input) {
      input.value = o.id + ' ';
      input.focus();
      GT.audio.key();
    } else {
      GT.terminal.run(o.id);
      GT.audio.click();
    }
  }
  radial.isOpen = function () { return !!menu; };

  /* ---------------- Botones y stick ---------------- */
  GT.on('pad:right', function (e) {
    if (e.down) {
      if (menu || GT.minigame.isActive()) return;
      clearTimeout(timer);
      timer = setTimeout(open, HOLD_MS);
      return;
    }
    if (timer) { clearTimeout(timer); timer = null; }   // toque corto: clic derecho comun
    confirm();
  });
  GT.on('pad:left', function (e) { if (menu && e.down) confirm(); });
  GT.on('pad:stick', function (a) { pick(a); });
  GT.on('pad:status', function (e) { if (!e.connected) { clearTimeout(timer); timer = null; close(); } });

  /* Si la partida se corta (derrota, victoria, volver al menu) el menu no
     puede quedar flotando ni quedarse con el cursor. */
  GT.on('gameover', close);
  GT.on('victory', close);
  GT.on('minigame:start', close);

})(window, document);
