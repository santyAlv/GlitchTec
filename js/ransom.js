/* ============================================================
   Glitch.TEC — Nivel 4: Ransomware y secuestro de datos
   El malware cifra los archivos del usuario, bloquea las
   herramientas del sistema y pone un reloj: cada vez que llega
   a cero destruye un archivo. Para salir hay que hacer, en orden,
   lo que se hace ante un ransomware de verdad:

     1. no pagar
     2. contener: terminar el proceso que cifra (ps / kill)
     3. conseguir la clave: quedo en el volcado de memoria del
        proceso, y hay que calcularla (un XOR de dos bytes)
     4. recuperar: descifrar carpeta por carpeta (decrypt) y traer
        del backup lo que el cifrador rompio

   El estado vive en GT.state.ransom.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var ransom = GT.ransom = {};

  var WIN_ID = 'ransom';
  var EXT = '.locked';
  var NOTE_NAME = 'LEEME_RESCATE.txt';
  var DUMP_PATH = ['Sistema'];
  var DUMP_NAME = 'volcado.dmp';
  var CIPHER = {
    name: 'gl1tch_lock.exe', cpu: 34, ram: 388, desc: 'Servicio de cifrado de disco',
    family: 'Ransomware',
    lesson: 'Al ransomware primero se lo CONTIENE: mientras el proceso viva, sigue cifrando archivos.'
  };

  /* Las carpetas del usuario que el cifrador ataca apenas arranca, y las
     que va alcanzando despues si nadie lo frena. */
  var FIRST_TARGETS = [['Documentos'], ['Usuarios']];
  var NEXT_TARGETS = [['Descargas']];
  /* Este archivo queda con la cabecera rota: la clave no lo recupera. Es el
     que obliga a usar el backup del nivel 1. */
  var DAMAGED = 'tp_redes.docx';

  var selfRemoving = false;   // true mientras el propio ransomware borra un archivo

  function st() { return GT.state.ransom; }
  function root() { return GT.state.fsRoot; }
  function print(text, cls) { GT.terminal.print(text, cls); }

  /* ============================================================
     Ciclo de vida
     ============================================================ */
  ransom.reset = function () {
    GT.state.ransom = {
      active: false,          // el nivel esta en curso
      armed: false,           // el reloj ya corre (arranca al cerrar el dialogo de entrada)
      timeLeft: 0,
      seed: 0, victim: 0, key: 0,
      pid: 0,
      alive: false,           // el proceso cifrador sigue corriendo
      spreadIn: 0,            // segundos para el proximo archivo cifrado
      queue: [],              // lo que le falta cifrar: [{ path, name }]
      everLocked: 0,          // archivos cifrados en total
      lost: 0,                // archivos destruidos (por el reloj o a mano)
      keyFound: false,
      paid: false
    };
  };
  ransom.reset();

  ransom.isActive = function () { return !!(GT.state.ransom && GT.state.ransom.active); };
  ransom.cipherAlive = function () { return ransom.isActive() && st().alive; };
  ransom.timeLeft = function () { return st().timeLeft; };

  /* Premio de racha "tiempo extra": lo llama state.js si el nivel esta activo. */
  ransom.addTime = function (secs) { st().timeLeft += secs; };

  /** Un byte al azar que no sea trivial de adivinar ni de calcular (ni 0, ni
      255, ni potencias redondas): entre 0x11 y 0xEE. */
  function randomByte() { return GT.rand(0x11, 0xEE); }

  /** Arranca el nivel: elige la clave, cifra los primeros archivos, lanza el
      proceso y bloquea las herramientas. */
  ransom.start = function () {
    ransom.reset();
    var s = st();
    s.active = true;
    s.timeLeft = GT.CONFIG.RANSOM_TIME;
    s.spreadIn = GT.CONFIG.RANSOM_SPREAD;

    /* La clave es el XOR de dos bytes al azar, distintos en cada partida:
       no sirve de nada acordarse de la de la vez pasada. Si justo salen
       iguales el XOR daria 0 (no cifraria nada), asi que vuelvo a tirar. */
    do {
      s.seed = randomByte();
      s.victim = randomByte();
      s.key = s.seed ^ s.victim;
    } while (s.key < 0x10);

    ensureVictimFiles();

    FIRST_TARGETS.forEach(function (p) { collect(p).forEach(function (t) { encrypt(t.path, t.name); }); });
    NEXT_TARGETS.forEach(function (p) { s.queue = s.queue.concat(collect(p)); });
    dropNotes();

    GT.procs.ensureList();
    s.pid = GT.procs.inject(CIPHER).pid;
    s.alive = true;

    /* "Bloquear el acceso a herramientas del sistema": el Administrador de
       tareas y el correo quedan cerrados. La Terminal no: es la salida. */
    ['taskmgr', 'mail'].forEach(function (id) {
      GT.ui.closeWindow(id);
      GT.ui.setIconLocked(id, true);
    });

    GT.audio.alarm();
    GT.ui.shake();
    GT.ui.flash('hit');
    if (GT.explorer) GT.explorer.refresh();
    updateObjective();
  };

  /** Lo llama levels.js cuando termina el dialogo de entrada: recien ahi
      empieza a correr el reloj y aparece la nota. */
  ransom.arm = function () {
    if (!ransom.isActive()) return;
    st().armed = true;
    ransom.openNote();
    GT.terminal.open();
  };

  /** Fin del nivel (o de la partida): saca las notas, cierra la ventana y
      devuelve las herramientas. */
  ransom.stop = function () {
    var s = GT.state.ransom;
    if (!s || !s.active) return;
    s.active = false;
    s.armed = false;

    removeNotes();
    if (GT.ui.isOpen(WIN_ID)) { noteVeto = false; GT.ui.closeWindow(WIN_ID); }
    ['taskmgr', 'mail'].forEach(function (id) { GT.ui.setIconLocked(id, false); });
    if (GT.explorer) GT.explorer.refresh();
    GT.emit('hud');
  };

  /* ============================================================
     Cifrado
     ============================================================ */
  /* Archivos "secuestrables" de una carpeta y sus subcarpetas: los del
     usuario. Quedan afuera los del sistema, el propio malware, la basura y
     lo que ya esta cifrado. */
  function collect(path) {
    var out = [];
    var dir = GT.fs.getNode(root(), path);
    if (!dir || dir.type !== 'dir') return out;
    Object.keys(dir.children).forEach(function (k) {
      var n = dir.children[k];
      if (n.type === 'dir') { if (!n.locked && !n.system) out = out.concat(collect(path.concat(k))); return; }
      if (n.system || n.malicious || n.junk || n.encrypted || n.kind === 'exe' || k === NOTE_NAME) return;
      out.push({ path: path, name: k });
    });
    return out;
  }

  /* Si el jugador borro sus documentos en los niveles anteriores, el nivel
     se quedaria sin nada que secuestrar. Repongo los que falten desde un
     arbol recien armado (el mismo de fs.create). */
  function ensureVictimFiles() {
    var fresh = GT.fs.create();
    [['Documentos'], ['Usuarios', 'estudiante']].forEach(function (path) {
      var src = GT.fs.getNode(fresh, path);
      var dst = GT.fs.ensureDir(path);
      Object.keys(src.children).forEach(function (k) {
        if (src.children[k].type === 'dir' || GT.fs.findChildName(dst, k)) return;
        dst.children[k] = src.children[k];
      });
    });
  }

  /* Dos digitos hexadecimales de un byte: 10 -> "0A". */
  function hex2(n) { return (n < 16 ? '0' : '') + n.toString(16).toUpperCase(); }
  function bin8(n) { var b = n.toString(2); while (b.length < 8) b = '0' + b; return b.slice(0, 4) + ' ' + b.slice(4); }

  /* Lo que se ve al abrir un archivo cifrado: los primeros bytes del
     contenido original pasados por XOR con la clave, en hexadecimal. No es
     decorado: es el cifrado de verdad, y aplicarle el mismo XOR con la misma
     clave devuelve el texto. Esa es la gracia del XOR, que se deshace solo. */
  function cipherText(content, key) {
    var lines = [];
    var row = [];
    var text = String(content || '');
    for (var i = 0; i < Math.min(text.length, 64); i++) {
      row.push(hex2((text.charCodeAt(i) & 0xFF) ^ key));
      if (row.length === 16) { lines.push(row.join(' ')); row = []; }
    }
    if (row.length) lines.push(row.join(' '));
    return '[GL1TCH-LOCK v2 — archivo cifrado]\r\n' + lines.join('\r\n') + '\r\n...\r\n';
  }

  /** Cifra un archivo: le cambia la extension, guarda lo original para
      poder devolverlo y deja a la vista solo el contenido cifrado. */
  function encrypt(path, name) {
    var dir = GT.fs.getNode(root(), path);
    var node = dir && dir.children[name];
    if (!node || node.encrypted) return false;
    var s = st();

    delete dir.children[name];
    node.encrypted = true;
    node.origName = name;
    node.origKind = node.kind;
    node.origContent = node.content;
    node.origInfo = node.info;
    node.origSize = node.size;
    node.damaged = (name.toLowerCase() === DAMAGED);
    delete node.objective;

    node.name = name + EXT;
    node.kind = 'locked';
    node.content = cipherText(node.origContent, s.key);
    node.info = 'Archivo cifrado por un ransomware. Sin la clave no se puede leer.';
    node.size = node.origSize + 4096;       // el cifrador le agrega su cabecera
    dir.children[node.name] = node;

    s.everLocked++;
    return true;
  }

  /** Devuelve un archivo a su estado original. */
  function decrypt(path, lockedName) {
    var dir = GT.fs.getNode(root(), path);
    var node = dir.children[lockedName];
    delete dir.children[lockedName];

    /* Si el original ya volvio por otro lado (lo restauraron del backup), el
       cifrado sobra: con borrarlo alcanza. */
    if (GT.fs.findChildName(dir, node.origName)) return node.origName;

    node.name = node.origName;
    node.kind = node.origKind;
    node.content = node.origContent;
    node.info = node.origInfo;
    node.size = node.origSize;
    ['encrypted', 'origName', 'origKind', 'origContent', 'origInfo', 'origSize', 'damaged'].forEach(function (k) {
      delete node[k];
    });
    dir.children[node.name] = node;
    return node.name;
  }

  /** Todos los archivos cifrados del disco: [{ path, name, node }]. */
  ransom.lockedFiles = function () {
    var out = [];
    GT.fs.walk(root(), [], function (node, path, name) {
      if (node.encrypted) out.push({ path: path, name: name, node: node });
    });
    return out;
  };

  /* ============================================================
     La nota de rescate
     ============================================================ */
  function noteText() {
    return 'TUS ARCHIVOS FUERON CIFRADOS\r\n' +
           '============================\r\n\r\n' +
           'Hola, estudiante. Tus documentos ahora terminan en ' + EXT + '.\r\n' +
           'Los cifre con una clave de 8 bits que solo existe en la memoria\r\n' +
           'de mi proceso. Sin ella son ruido.\r\n\r\n' +
           'Paga el rescate antes de que el reloj llegue a cero.\r\n' +
           'Cada vez que llegue a cero, destruyo un archivo. Uno por vez.\r\n\r\n' +
           'No intentes nada raro.   -- GL1TCH\r\n';
  }

  /* Una copia de la nota en cada carpeta con archivos cifrados, como hace
     el ransomware de verdad. */
  function dropNotes() {
    var seen = {};
    ransom.lockedFiles().forEach(function (f) {
      var key = f.path.join('\\');
      if (seen[key]) return;
      seen[key] = true;
      var dir = GT.fs.getNode(root(), f.path);
      if (!dir.children[NOTE_NAME]) {
        dir.children[NOTE_NAME] = {
          type: 'file', name: NOTE_NAME, kind: 'txt', size: 612, ransomNote: true,
          info: 'Nota que dejó el ransomware.', content: noteText()
        };
      }
    });
  }

  function removeNotes() {
    var found = [];
    GT.fs.walk(root(), [], function (node, path, name) { if (node.ransomNote) found.push({ path: path, name: name }); });
    found.forEach(function (f) { delete GT.fs.getNode(root(), f.path).children[f.name]; });
  }

  /* La ventana se puede cerrar con la X, pero mientras el jugador no haya
     decidido que hacer con el rescate vuelve a aparecer: el ransomware no se
     deja ignorar. noteVeto es lo que usa onClose para frenar el cierre. */
  var noteVeto = true;

  /* MAQUETA PROVISIONAL de la nota de rescate. El diseño (issue #19) puede
     rehacerla entera; lo que usa la logica son los id ransom-clock y
     ransom-count y los data-ransom de los dos botones. */
  ransom.openNote = function () {
    if (!ransom.isActive()) return;
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); return; }

    var body = document.createElement('div');
    body.className = 'viewer ransom-note';
    body.innerHTML =
      '<b>TUS ARCHIVOS FUERON CIFRADOS</b>\n\n' +
      'Archivos secuestrados: <b id="ransom-count">0</b>\n' +
      'Próximo archivo destruido en: <b id="ransom-clock">--:--</b>\n\n' +
      'Tus documentos ahora terminan en ' + EXT + '. La clave está en la\n' +
      'memoria de mi proceso. Pagá el rescate o empiezo a borrar.\n\n' +
      '<button class="xp-btn danger" data-ransom="pay">PAGAR EL RESCATE</button> ' +
      '<button class="xp-btn" data-ransom="refuse">NO PAGAR</button>\n\n' +
      '<span id="ransom-msg"></span>';

    noteVeto = true;
    GT.ui.openWindow({
      id: WIN_ID, title: 'GL1TCH-LOCK', icon: GT.ui.icons.skull, asset: 'aviso.malware',
      width: 500, height: 330, body: body,
      onClose: function () {
        /* Cerrar con la X sin haber decidido no alcanza: se reabre sola. */
        var o = GT.levels.find('l4_note');
        if (noteVeto && ransom.isActive() && !GT.state.finished && o && !o.done) {
          GT.ui.toast('La nota no se va sola: hay que decidir si pagás o no', 'warn');
          return false;
        }
      }
    });

    body.querySelector('[data-ransom="pay"]').addEventListener('click', pay);
    body.querySelector('[data-ransom="refuse"]').addEventListener('click', refuse);
    renderNote();
  };

  function renderNote() {
    var clock = document.getElementById('ransom-clock');
    if (!clock) return;
    clock.textContent = GT.formatTime(Math.max(0, st().timeLeft));
    document.getElementById('ransom-count').textContent = ransom.lockedFiles().length;
  }

  /* Pagar es la trampa del nivel. No devuelve nada: solo cuesta. */
  function pay() {
    var s = st();
    if (s.paid) return;
    s.paid = true;

    GT.audio.hurt();
    GT.ui.shake();
    GT.ui.flash('hit');
    GT.wrong(120, 'pagaste el rescate');
    GT.damage(15, 'pagaste el rescate');
    GT.learn('Ante un ransomware no se paga: nada obliga al atacante a devolver los archivos y el pago financia el próximo ataque.');

    var msg = document.getElementById('ransom-msg');
    if (msg) msg.textContent = 'Pago recibido. La clave no llegó, y no va a llegar. Gracias.';
    var btn = document.querySelector('[data-ransom="pay"]');
    if (btn) btn.disabled = true;
    GT.terminal.notify('[GLITCH] Gracias por el pago. La clave... no, mejor me la quedo.', 'evil');
  }

  function refuse() {
    GT.levels.complete('l4_note');
    if (!st().paid) GT.learn('Ante un ransomware no se paga: se contiene el proceso y se recupera desde un backup.');
    noteVeto = false;
    GT.ui.closeWindow(WIN_ID);
    GT.terminal.notify('[SISTEMA] Sin pagar. Busca el proceso que cifra:  ps  y despues  kill <pid>', 'info');
  }

  /* ============================================================
     Reloj y propagacion
     ============================================================ */
  /** Lo llama el loop de game.js. */
  ransom.tick = function (dt) {
    var s = GT.state.ransom;
    if (!s || !s.active || !s.armed) return;

    var locked = ransom.lockedFiles();

    /* Mientras el proceso viva sigue cifrando: cada tanto cae un archivo mas
       de la cola. Es lo que hace que contener PRIMERO valga la pena. */
    if (s.alive && s.queue.length) {
      s.spreadIn -= dt;
      if (s.spreadIn <= 0) {
        s.spreadIn = GT.CONFIG.RANSOM_SPREAD;
        var next = s.queue.shift();
        if (encrypt(next.path, next.name)) {
          dropNotes();
          GT.audio.error();
          GT.ui.toast('El ransomware cifró otro archivo: ' + next.name, 'bad');
          GT.emit('fs', { op: 'write', path: next.path.slice(), name: next.name + EXT });
          updateObjective();
        }
      }
    }

    /* Sin archivos cifrados no hay nada que el reloj pueda destruir. */
    if (!locked.length) { renderNote(); return; }

    s.timeLeft -= dt;
    if (s.timeLeft <= 0) {
      s.timeLeft = GT.CONFIG.RANSOM_REPEAT;
      destroyOne(locked);
    }
    renderNote();
    GT.emit('ransom', { timeLeft: s.timeLeft, locked: locked.length });
  };

  /* El reloj llego a cero: se pierde un archivo para siempre. */
  function destroyOne(locked) {
    var s = st();
    var f = GT.pick(locked);
    selfRemoving = true;
    GT.fs.remove(f.path, f.name, { force: true });
    selfRemoving = false;
    s.lost++;

    GT.audio.hurt();
    GT.ui.shake();
    GT.ui.flash('hit');
    GT.ui.toast('ARCHIVO DESTRUIDO: ' + f.node.origName, 'bad');
    GT.terminal.notify('[GLITCH] Se acabo el tiempo. Adios, ' + f.node.origName + '.', 'evil');
    GT.wrong(0, 'archivo destruido');
    GT.damage(GT.CONFIG.RANSOM_LOSS_DAMAGE, 'el ransomware destruyó un archivo');
    updateObjective();
  }

  /* Si el jugador borra a mano un archivo cifrado, lo da por perdido: cuenta
     igual que si lo hubiera destruido el reloj. */
  GT.on('fs', function (e) {
    if (e.op !== 'remove' || selfRemoving || !ransom.isActive()) return;
    if (!e.node || !e.node.encrypted) return;
    st().lost++;
    GT.wrong(0, 'archivo cifrado eliminado');
    GT.damage(GT.CONFIG.RANSOM_LOSS_DAMAGE, 'diste por perdido un archivo secuestrado');
    GT.ui.toast('Diste por perdido ' + e.node.origName, 'bad');
    updateObjective();
  });

  /* ============================================================
     Contencion: matar al cifrador
     ============================================================ */
  GT.on('proc-killed', function (p) {
    if (!ransom.isActive() || p.pid !== st().pid) return;
    var s = st();
    s.alive = false;
    s.queue = [];

    /* Al morir, el proceso deja un volcado de memoria. Ahi quedaron los dos
       numeros con los que armo la clave: de la clave en si, solo la formula.
       El calculo es el ejercicio del nivel. */
    var dir = GT.fs.ensureDir(DUMP_PATH);
    dir.children[DUMP_NAME] = {
      type: 'file', name: DUMP_NAME, kind: 'log', size: 2048, system: true,
      info: 'Volcado de memoria del proceso terminado.',
      content:
        'VOLCADO DE MEMORIA  -  ' + CIPHER.name + ' (PID ' + s.pid + ')\r\n' +
        '-------------------------------------------------\r\n' +
        'algoritmo ........ XOR, clave de 8 bits\r\n' +
        'semilla .......... 0x' + hex2(s.seed) + '  =  ' + bin8(s.seed) + '\r\n' +
        'id_victima ....... 0x' + hex2(s.victim) + '  =  ' + bin8(s.victim) + '\r\n' +
        'clave ............ semilla XOR id_victima\r\n' +
        '\r\n' +
        'XOR compara los dos numeros bit a bit:\r\n' +
        '  bits IGUALES    -> 0\r\n' +
        '  bits DISTINTOS  -> 1\r\n' +
        '\r\n' +
        'Con la clave:  decrypt <clave>   en cada carpeta con archivos ' + EXT + '\r\n' +
        '(se acepta en decimal, o en hexadecimal con 0x adelante)\r\n'
    };
    GT.emit('fs', { op: 'write', path: DUMP_PATH.slice(), name: DUMP_NAME });

    GT.levels.complete('l4_kill');
    GT.terminal.notify('[SISTEMA] El cifrado se detuvo. El proceso dejo un volcado de memoria:', 'info');
    GT.terminal.notify('          type \\Sistema\\' + DUMP_NAME, 'info');
  });

  /* ============================================================
     Recuperacion
     ============================================================ */
  /* Acepta la clave como la escriba el jugador: decimal ("102"), hexadecimal
     ("0x66" o "66h") o los 8 bits ("01100110"). Devuelve NaN si no es nada
     de eso. El orden importa: "01100110" tambien es un decimal valido, asi
     que el caso binario se mira primero. */
  function parseKey(text) {
    var t = String(text || '').trim().toLowerCase().replace(/\s+/g, '');
    if (/^[01]{8}$/.test(t)) return parseInt(t, 2);
    if (/^0x[0-9a-f]{1,2}$/.test(t)) return parseInt(t.slice(2), 16);
    if (/^[0-9a-f]{1,2}h$/.test(t)) return parseInt(t.slice(0, -1), 16);
    if (/^[0-9]{1,3}$/.test(t)) return parseInt(t, 10);
    return NaN;
  }

  function cmdDecrypt(args) {
    var s = st();
    if (!ransom.isActive()) { print('No hay archivos cifrados en el sistema.', 'dim'); return; }

    if (s.alive) {
      print('El proceso que cifra sigue corriendo: lo que descifres lo vuelve a cifrar.', 'err');
      print('Primero hay que contenerlo:  ps   y   kill <pid>', 'warn');
      GT.audio.error();
      return;
    }
    if (!args.length) {
      print('Uso: decrypt <clave>      descifra los archivos ' + EXT + ' de la carpeta actual', 'warn');
      print('La clave se calcula con los datos de  \\Sistema\\' + DUMP_NAME, 'dim');
      return;
    }

    var key = parseKey(args.join(''));
    if (isNaN(key)) {
      print('La clave tiene que ser un numero de 8 bits: decimal (0 a 255) o hexadecimal (0x00 a 0xFF).', 'err');
      GT.audio.error();
      return;
    }

    if (key !== s.key) {
      print('Clave incorrecta. El intento fallido corrompio un bloque de datos (-' +
            GT.CONFIG.RANSOM_WRONG_KEY + ' integridad).', 'err');
      print('Revisa el XOR bit por bit: iguales da 0, distintos da 1.', 'dim');
      GT.audio.error();
      GT.wrong(0, 'clave de descifrado incorrecta');
      GT.damage(GT.CONFIG.RANSOM_WRONG_KEY, 'clave de descifrado incorrecta');
      return;
    }

    if (!s.keyFound) {
      s.keyFound = true;
      print('');
      print('  CLAVE CORRECTA — ' + bin8(s.seed) + ' XOR ' + bin8(s.victim) + ' = ' + bin8(s.key) +
            '  (0x' + hex2(s.key) + ' = ' + s.key + ')', 'ok');
      GT.audio.ok();
      GT.correct(200, 'clave de descifrado');
      GT.levels.complete('l4_key');
      GT.learn('XOR: bits iguales dan 0, distintos dan 1. Aplicar dos veces la misma clave devuelve el dato original.');
    }

    var cwd = GT.terminal.getCwd();
    var here = ransom.lockedFiles().filter(function (f) { return f.path.join('\\') === cwd.join('\\'); });

    if (!here.length) {
      print('En ' + GT.fs.pathString(cwd) + ' no hay archivos cifrados.', 'warn');
      listPending();
      return;
    }

    print('');
    here.forEach(function (f) {
      if (f.node.damaged) {
        print('  ' + f.name + '   CABECERA DAÑADA: no se puede descifrar', 'err');
        return;
      }
      var name = decrypt(f.path, f.name);
      GT.addScore(50, 'archivo descifrado');
      print('  ' + f.name + '  ->  ' + name, 'ok');
    });
    print('');
    GT.emit('fs', { op: 'write', path: cwd, name: '' });

    var damaged = here.filter(function (f) { return f.node.damaged; });
    if (damaged.length) {
      print('  El cifrador rompio ' + damaged[0].node.origName + ' al cifrarlo: la clave no alcanza.', 'warn');
      print('  Lo unico que lo trae de vuelta es una copia de seguridad:', 'warn');
      print('      backup list     y     backup restore <n>', 'info');
      if (!GT.sys.backups().length) {
        print('  No queda ninguna copia. Si no hay de donde recuperarlo, dalo por perdido:', 'err');
        print('      del ' + damaged[0].name, 'dim');
      }
      print('');
    }

    updateObjective();
    listPending();
  }

  function listPending() {
    var dirs = {};
    ransom.lockedFiles().forEach(function (f) { dirs[GT.fs.pathString(f.path)] = true; });
    var names = Object.keys(dirs);
    if (names.length) print('  Quedan archivos cifrados en: ' + names.join(', '), 'dim');
  }

  /* El backup devolvio archivos: si entre ellos estaba el que la clave no
     podia recuperar, es el momento de decir para que servia el backup. */
  GT.on('backup', function (e) {
    if (e.op !== 'restore' || !ransom.isActive()) return;
    var rescued = e.files.some(function (f) { return f.name.toLowerCase() === DAMAGED; });
    if (rescued) {
      GT.correct(150, 'archivo recuperado del backup');
      GT.learn('El backup es la única defensa segura contra el ransomware: lo que está copiado en otro lado no hay que pagarlo ni descifrarlo.');
      GT.terminal.notify('[SISTEMA] ' + DAMAGED + ' volvio desde la copia de seguridad.', 'ok');
    }
    updateObjective();
  });

  /* Progreso de "recuperar los archivos". El total no es fijo (el cifrador
     puede sumar archivos y el reloj puede destruirlos), asi que lo recalculo
     del estado real cada vez, igual que el objetivo de procesos del nivel 2:
       recuperados = cifrados en total - perdidos - los que siguen cifrados */
  function updateObjective() {
    if (!ransom.isActive()) return;
    var s = st();
    var o = GT.levels.find('l4_decrypt');
    if (!o || o.done) return;

    var pending = ransom.lockedFiles().length;
    o.count = Math.max(0, s.everLocked - s.lost - pending);
    o.total = o.count + pending;
    GT.levels.renderObjectives('l4_decrypt');

    /* Se cumple cuando no queda nada cifrado... y el proceso ya esta muerto:
       si no, en cuanto cifre el proximo el objetivo se "descumpliria". */
    if (pending === 0 && !s.alive) GT.levels.complete('l4_decrypt');
  }

  /* ============================================================
     Terminal
     ============================================================ */
  GT.terminal.register('decrypt', {
    desc: 'Descifra los archivos de la carpeta actual.', run: cmdDecrypt,
    help: { section: 'SEGURIDAD', usage: 'decrypt <clave>', text: 'descifra los archivos .locked de la carpeta actual' }
  }, ['descifrar']);

  /* Mientras el cifrador viva, el antivirus esta deshabilitado: scan no anda.
     Es un "guardia" de la Terminal: devuelve el mensaje con el que se frena
     el comando, o nada para dejarlo pasar. */
  GT.terminal.guard(function (name) {
    if (!ransom.cipherAlive()) return null;
    if (name === 'scan' || name === 'analizar') {
      return 'El antivirus fue deshabilitado por el ransomware. Termina primero su proceso (ps / kill).';
    }
    return null;
  });

})(window, document);
