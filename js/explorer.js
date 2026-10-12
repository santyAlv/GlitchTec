/* ============================================================
   Glitch.TEC — Explorador de archivos
   Vista grafica del mismo sistema de archivos que usa la Terminal.
   Sirve para que el jugador vea lo que la CLI le muestra en texto.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var exp = GT.explorer = {};

  var WIN_ID = 'explorer';
  /* OJO: el explorador tiene su PROPIA ruta, separada del cwd de la terminal.
     Es a proposito y es como funciona en un sistema real: puedo estar parado
     en C:\Descargas en la consola y mirando C:\Sistema en la ventana. Lo que
     SI comparten es el arbol de datos (GT.state.fsRoot), asi que si desbloqueo
     la cuarentena por terminal, el explorador la ve desbloqueada. */
  var path = [];
  var selected = null;

  function root() { return GT.state.fsRoot; }

  /* Elige el icono segun el nodo. El ORDEN de los if importa, es una cadena
     de prioridades: primero carpetas (con o sin candado), despues el de
     peligro —pero SOLO si ya lo escanearon: el juego no le regala al jugador
     cual es el archivo malo antes de que lo analice—, despues ejecutables y
     por ultimo el documento generico como caso por defecto. */
  function iconFor(node, name) {
    if (node.type === 'dir') return node.locked ? GT.ui.icons.folderLock : GT.ui.icons.folder;
    if (node.encrypted) return GT.ui.icons.skull;
    if (node.scanned && node.malicious) return GT.ui.icons.danger;
    if (node.kind === 'exe' || node.kind === 'bin') return GT.ui.icons.exe;
    return GT.ui.icons.doc;
  }

  /* El mismo criterio, pero para la pieza gráfica: el icono que se ve es el
     arte final si ya existe, y si no el dibujo provisional de arriba. Los dos
     entran en el mismo contenedor, así que la rejilla no se mueve. */
  function assetFor(node) {
    if (node.type === 'dir') return node.locked ? 'fs.carpeta-lock' : 'fs.carpeta';
    if (node.encrypted) return 'fs.cifrado';
    if (node.scanned && node.malicious) return 'fs.peligro';
    if (node.kind === 'exe' || node.kind === 'bin') return 'fs.ejecutable';
    if (node.kind === 'img') return 'fs.imagen';
    if (node.kind === 'zip' || node.kind === 'rar') return 'fs.comprimido';
    if (node.kind === 'mp3' || node.kind === 'wav') return 'fs.musica';
    if (node.corrupt) return 'fs.roto';
    return 'fs.documento';
  }

  exp.open = function (startPath) {
    if (startPath) path = startPath.slice();

    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); exp.refresh(); return; }

    var body = document.createElement('div');
    body.className = 'exp';
    body.innerHTML =
      '<div class="exp-toolbar">' +
        '<button class="exp-btn" data-nav="up">▲ Arriba</button>' +
        '<button class="exp-btn" data-nav="root">C:\\</button>' +
        '<button class="exp-btn" data-nav="del" disabled>✕ Eliminar</button>' +
        '<div class="exp-path" id="exp-path"></div>' +
      '</div>' +
      '<div class="exp-main">' +
        '<div class="exp-side" id="exp-side"></div>' +
        '<div class="exp-files" id="exp-files"></div>' +
      '</div>' +
      '<div class="exp-status" id="exp-status"></div>';

    GT.ui.openWindow({
      id: WIN_ID,
      title: 'Mi PC',
      icon: GT.ui.icons.folder, asset: 'app.explorador',
      width: 600, height: 400,
      x: 220, y: 110,
      body: body
    });

    body.querySelector('[data-nav="up"]').addEventListener('click', function () {
      if (path.length) { path.pop(); selected = null; exp.refresh(); GT.audio.click(); }
    });
    body.querySelector('[data-nav="root"]').addEventListener('click', function () {
      path = []; selected = null; exp.refresh(); GT.audio.click();
    });
    body.querySelector('[data-nav="del"]').addEventListener('click', deleteSelected);

    exp.refresh();
  };

  /* Borrar desde el Explorador pasa por la MISMA funcion que el "del" de la
     Terminal (GT.fs.remove), asi que las reglas son identicas: lo que no deja
     borrar una, no lo deja borrar la otra. Aca una carpeta se borra con todo
     lo que tiene adentro, como en cualquier explorador grafico. */
  function deleteSelected() {
    if (!selected) return;
    var res = GT.fs.remove(path, selected.name, { recursive: true });
    if (res.error) {
      GT.audio.error();
      GT.ui.toast(GT.fs.explain(res), 'warn');
      return;
    }
    GT.audio.click();
    GT.ui.toast('Eliminado: ' + res.name + ' (' + GT.fs.humanSize(res.freed) + ' liberados)', 'info');
  }

  /* "3 elemento(s) · 1.60 GB usados de 2.00 GB · 412.0 MB libres" */
  function statusText(count) {
    var u = GT.fs.usage();
    return count + ' elemento(s)  ·  ' + GT.fs.humanSize(u.used) + ' usados de ' +
           GT.fs.humanSize(u.capacity) + '  ·  ' + GT.fs.humanSize(u.free) + ' libres';
  }

  /* El disco cambio (alguien creo, borro o movio algo, desde aca o desde la
     Terminal): me redibujo para mostrar lo que hay ahora. */
  GT.on('fs', function () { exp.refresh(); });

  /* El aviso periodico de la cuota solo toca el texto de la barra de estado:
     redibujar la carpeta entera una vez por segundo le sacaria la seleccion
     al jugador mientras elige un archivo. */
  GT.on('disk', function () {
    var statusEl = document.getElementById('exp-status');
    if (!statusEl || !GT.ui.isOpen(WIN_ID)) return;
    var node = GT.fs.getNode(root(), path);
    statusEl.textContent = statusText(node ? Object.keys(node.children || {}).length : 0);
  });

  exp.refresh = function () {
    if (!GT.ui.isOpen(WIN_ID)) return;

    var pathEl = document.getElementById('exp-path');
    var filesEl = document.getElementById('exp-files');
    var sideEl = document.getElementById('exp-side');
    var statusEl = document.getElementById('exp-status');
    if (!filesEl) return;

    var node = GT.fs.getNode(root(), path);
    /* La carpeta que estaba mirando ya no existe (la borraron o la movieron
       desde la Terminal): vuelvo a la raiz en vez de quedarme en la nada. */
    if (!node || node.type !== 'dir') { path = []; selected = null; node = root(); }
    if (selected && !node.children[selected.name]) selected = null;
    pathEl.textContent = GT.fs.pathString(path);
    GT.ui.getWindow(WIN_ID).setTitle(path.length ? path[path.length - 1] : 'Mi PC');

    filesEl.innerHTML = '';
    var names = Object.keys(node.children || {});

    if (!names.length) {
      filesEl.innerHTML = '<div class="exp-empty">Esta carpeta está vacía.</div>';
    }

    names.forEach(function (name) {
      var child = node.children[name];
      var item = document.createElement('button');
      var cls = 'exp-item';
      if (child.locked) cls += ' locked';
      if (child.encrypted) cls += ' encrypted';
      if (GT.fs.hasDoubleExtension(name) || child.encrypted || (child.scanned && child.malicious)) cls += ' danger';
      item.className = cls;
      item.innerHTML = GT.ui.slot(assetFor(child), iconFor(child, name), 'lg', name) +
                       '<span>' + GT.escapeHtml(name) + '</span>';

      item.addEventListener('click', function () {
        selected = { name: name, node: child };
        var prev = filesEl.querySelector('.exp-item.selected');
        if (prev) prev.classList.remove('selected');
        item.classList.add('selected');
        renderSide();
      });

      item.addEventListener('dblclick', function () { openItem(name, child); });
      filesEl.appendChild(item);
    });

    statusEl.textContent = statusText(names.length);
    renderSide();

    /* renderSide esta declarada ADENTRO de refresh a proposito: necesita ver
       la variable "node" de esta ejecucion y la puede usar libremente gracias
       a la clausura. Ademas, al ser funcion declarada (no una var), el hoisting
       me permite llamarla arriba aunque este escrita aca abajo. */
    function renderSide() {
      var html = '';
      var delBtn = document.querySelector('.exp [data-nav="del"]');
      if (delBtn) delBtn.disabled = !(selected && node.children[selected.name]);

      if (selected && node.children[selected.name]) {
        var n = selected.node;
        html += '<h4>Detalles</h4>';
        /* De una carpeta muestro lo que ocupa TODO su contenido: es el dato
           que sirve para decidir que borrar cuando falta lugar. */
        html += '<p><b>' + GT.escapeHtml(selected.name) + '</b>' +
                (n.type === 'dir' ? 'Carpeta · ' : '') + GT.fs.humanSize(GT.fs.sizeOf(n)) + '</p>';
        if (GT.fs.hasDoubleExtension(selected.name)) {
          html += '<h4>⚠ Advertencia</h4><p>Este archivo tiene <b>doble extensión</b>. ' +
                  'Analizalo desde la Terminal con <b>scan ' + GT.escapeHtml(selected.name) + '</b>.</p>';
        } else if (n.info) {
          html += '<p style="opacity:.85">' + GT.escapeHtml(n.info) + '</p>';
        }
      } else {
        html += '<h4>Mi PC</h4><p>Doble click para abrir una carpeta o un archivo de texto.</p>';
        html += '<h4>Recordá</h4><p>La Terminal puede hacer cosas que el Explorador no: ' +
                'analizar archivos (<b>scan</b>) y desbloquear carpetas (<b>unlock</b>).</p>';
      }
      sideEl.innerHTML = html;
    }
  };

  function openItem(name, child) {
    if (child.type === 'dir') {
      if (child.locked) {
        GT.audio.error();
        GT.ui.toast('Carpeta protegida: usá "unlock <clave>" en la Terminal', 'warn');
        GT.state.flags.sawLockedFolder = true;
        return;
      }
      path.push(name);
      selected = null;
      exp.refresh();
      GT.audio.click();
      return;
    }

    /* Un archivo secuestrado no se abre: lo unico que hay para ver es la
       nota de rescate. */
    if (child.encrypted || child.ransomNote) {
      GT.audio.error();
      GT.ransom.openNote();
      return;
    }

    /* Doble click sobre un ejecutable: NUNCA lo "ejecuto". Este es el momento
       educativo del explorador —es literalmente el error que cometio el
       personaje de la historia para infectarse—, asi que lo castigo con dano
       si el archivo era malicioso y lo explico con un aviso. */
    if (child.kind === 'exe' || child.kind === 'bin') {
      GT.audio.error();
      GT.ui.toast('Nunca ejecutes un archivo sospechoso. Analizalo primero.', 'bad');
      if (child.malicious) {
        GT.damage(6, 'ejecutaste un archivo malicioso');
        GT.ui.shake();
        GT.ui.flash('hit');
        GT.terminal.notify('[!] Intentaste ejecutar ' + name + '. Mala idea.', 'evil');
      }
      return;
    }

    openViewer(name, child);
  }

  /* Abre un archivo de texto en una "ventana de bloc de notas".
     El id se arma sacandole al nombre todo lo que no sea letra o numero
     (el regex /[^a-z0-9]/gi: ^ adentro de los corchetes significa "cualquier
     cosa MENOS esto", g = todos, i = sin importar mayusculas). Asi
     "leeme.txt" -> "viewer-leemetxt": un id valido y, sobre todo, ESTABLE, de
     modo que abrir dos veces el mismo archivo reusa la ventana en vez de
     apilar copias. */
  function openViewer(name, child) {
    var id = 'viewer-' + name.replace(/[^a-z0-9]/gi, '');
    var pre = document.createElement('div');
    pre.className = 'viewer';
    pre.textContent = child.content || '[archivo vacío]';

    GT.ui.openWindow({
      id: id,
      title: name + ' — Bloc de notas',
      icon: GT.ui.icons.doc, asset: 'fs.documento',
      width: 520, height: 340,
      body: pre
    });

    if (name.toLowerCase() === 'leeme.txt') {
      GT.levels.complete('l1_note');
      GT.learn('Windows oculta las extensiones conocidas: un .jpg puede ser un .exe.');
    }
    if (name.toLowerCase() === 'registro.log') {
      GT.levels.complete('l1_log');
    }
  }

  exp.reset = function () { path = []; selected = null; };

})(window, document);
