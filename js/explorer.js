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
    if (node.scanned && node.malicious) return GT.ui.icons.danger;
    if (node.kind === 'exe' || node.kind === 'bin') return GT.ui.icons.exe;
    return GT.ui.icons.doc;
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
      icon: GT.ui.icons.folder,
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

    exp.refresh();
  };

  exp.refresh = function () {
    if (!GT.ui.isOpen(WIN_ID)) return;

    var pathEl = document.getElementById('exp-path');
    var filesEl = document.getElementById('exp-files');
    var sideEl = document.getElementById('exp-side');
    var statusEl = document.getElementById('exp-status');
    if (!filesEl) return;

    var node = GT.fs.getNode(root(), path);
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
      if (GT.fs.hasDoubleExtension(name) || (child.scanned && child.malicious)) cls += ' danger';
      item.className = cls;
      item.innerHTML = iconFor(child, name) + '<span>' + GT.escapeHtml(name) + '</span>';

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

    statusEl.textContent = names.length + ' elemento(s)';
    renderSide();

    /* renderSide esta declarada ADENTRO de refresh a proposito: necesita ver
       la variable "node" de esta ejecucion y la puede usar libremente gracias
       a la clausura. Ademas, al ser funcion declarada (no una var), el hoisting
       me permite llamarla arriba aunque este escrita aca abajo. */
    function renderSide() {
      var html = '';
      if (selected && node.children[selected.name]) {
        var n = selected.node;
        html += '<h4>Detalles</h4>';
        html += '<p><b>' + GT.escapeHtml(selected.name) + '</b>' +
                (n.type === 'dir' ? 'Carpeta' : GT.fs.humanSize(n.size)) + '</p>';
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
      icon: GT.ui.icons.doc,
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
