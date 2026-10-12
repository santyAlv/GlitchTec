/* ============================================================
   Glitch.TEC — herramientas de mantenimiento del sistema operativo
   Copias de seguridad, puntos de restauracion, particiones y
   diagnostico de congelamientos. Son comandos de la Terminal y
   cada uno es requisito de algun nivel:

     backup   nivel 1  respaldar los documentos antes de pelear
     diag     nivel 2  destrabar el sistema cuando se tilda
     restore  purga    sacar la persistencia del malware
     part     purga    borrar la particion donde se esconde

   Todo el estado vive en GT.state.sys y se rearma en cada partida.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var sys = GT.sys = {};

  var MB = 1048576;
  var freezeIn = -1;          // segundos que faltan para que el sistema se tilde (-1 = nada agendado)
  var frozenFor = 0;          // acumulador para el dano por segundo del congelamiento

  function st() { return GT.state.sys; }
  function root() { return GT.state.fsRoot; }
  function print(text, cls) { GT.terminal.print(text, cls); }

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  /* Copia profunda de un objeto de datos (ver fs.copy en filesystem.js). */
  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }

  /* Mientras el malware tenga procesos en memoria, lo que se le borre de la
     configuracion lo vuelve a escribir. Por eso restaurar el sistema o borrar
     su particion recien "prende" en el nivel de la purga, cuando ya no le
     queda ningun proceso vivo (nivel 2) ni via de entrada (nivel 3). */
  function malwareInMemory() { return GT.state.level < GT.levels.PURGE_LEVEL; }

  /* ============================================================
     Estado inicial
     ============================================================ */
  var RESTORE_DIR = ['Sistema', 'Restauracion'];

  /* El archivo de arranque: lo que el sistema ejecuta al encender. Con la
     persistencia activa tiene una linea de mas, que es la del malware. */
  function bootIni(persist) {
    return '[arranque]\r\n' +
           'shell=C:\\WINTEC\\escritorio.exe\r\n' +
           'servicio=C:\\WINTEC\\defender_rt.exe\r\n' +
           (persist ? 'servicio=C:\\Sistema\\cuarentena\\payload.bin   ; agregado ayer 12:07\r\n' : '') +
           '\r\n' +
           '; Todo lo que figura aca se ejecuta solo en cada encendido.\r\n';
  }

  function rpFileName(id) { return 'RP' + (id < 10 ? '00' : id < 100 ? '0' : '') + id + '.dat'; }

  /** Arma el estado de las herramientas. Va DESPUES de GT.fs.mount(), porque
      deja archivos del sistema en el arbol. */
  sys.reset = function () {
    freezeIn = -1;
    frozenFor = 0;
    setFrozenClass(false);

    GT.state.sys = {
      persist: true,            // la entrada del malware sigue en el arranque
      /* Los tres puntos que ya traia la PC. La fecha es la pista: la
         infeccion fue ayer a las 12:06 (esta en registro.log), asi que el
         de las 12:07 ya se guardo con el malware adentro. */
      restorePoints: [
        { id: 1, when: 'hace 3 dias 18:20', label: 'Instalacion del controlador de video', clean: true },
        { id: 2, when: 'ayer 11:48',        label: 'Antes de instalar instalador_java.exe', clean: true },
        { id: 3, when: 'ayer 12:07',        label: 'Punto automatico del sistema', clean: false }
      ],
      nextRestoreId: 4,
      rewardedCleanPoint: false,

      backups: [],
      nextBackupId: 1,

      /* Tabla de particiones del disco. La 3 es la del malware: sin letra,
         sin etiqueta y creada un minuto despues de la infeccion. */
      partitions: [
        { n: 1, letter: 'C:', label: 'WINTEC',   fs: 'FAT32', size: 2048 * MB, kind: 'sistema',
          note: 'Particion de arranque. Aca esta instalado el sistema.' },
        { n: 2, letter: 'D:', label: 'RESPALDO', fs: 'FAT32', size: GT.CONFIG.BACKUP_CAPACITY, kind: 'datos',
          note: 'Particion de datos. Aca se guardan las copias de seguridad.' },
        { n: 3, letter: '',   label: '',         fs: 'RAW',   size: 512 * MB,  kind: 'oculta',
          note: 'Sin letra ni etiqueta, formato desconocido. Creada ayer 12:07. ' +
                'Contiene una imagen de arranque: glitch.core' }
      ],

      frozen: null,             // { pid, name, victim, since, diagnosed } mientras el sistema esta tildado
      hadFreeze: false
    };

    var sistema = GT.fs.ensureDir(['Sistema']);
    sistema.children['arranque.ini'] = {
      type: 'file', name: 'arranque.ini', kind: 'txt', size: 412, system: true,
      info: 'Programas que el sistema ejecuta solo al encender.',
      content: bootIni(true)
    };

    /* Cada punto de restauracion ocupa lugar en el disco: es una copia de la
       configuracion del sistema. */
    var dir = GT.fs.ensureDir(RESTORE_DIR);
    dir.system = true;
    GT.state.sys.restorePoints.forEach(function (rp) { dir.children[rpFileName(rp.id)] = rpFile(rp.id); });
  };

  function rpFile(id) {
    return {
      type: 'file', name: rpFileName(id), kind: 'sys', size: GT.CONFIG.RESTORE_POINT_SIZE, system: true,
      info: 'Punto de restauracion del sistema. Se administra con el comando restore.',
      content: '[Copia de la configuracion del sistema]\r\n'
    };
  }

  /* ============================================================
     Copias de seguridad (backup)
     ============================================================ */
  /* Un backup es una COPIA de los archivos del usuario guardada en otra
     particion (D:). Esa es toda la idea: si le pasa algo a C:, la copia esta
     en otro lado. Guardo una copia profunda de la carpeta tal como esta en
     ese momento, asi lo que cambie despues en el disco no la toca. */

  function backupPartition() {
    var parts = st().partitions;
    for (var i = 0; i < parts.length; i++) if (parts[i].kind === 'datos') return parts[i];
    return null;
  }

  function backupUsed() {
    var total = 0;
    st().backups.forEach(function (b) { total += b.size; });
    return total;
  }

  function countFiles(node) {
    var n = 0;
    GT.fs.walk(node, [], function (child) { if (child.type !== 'dir') n++; });
    return n;
  }

  function hasSystemFiles(node) {
    var found = !!node.system;
    GT.fs.walk(node, [], function (child) { if (child.system) found = true; });
    return found;
  }

  /** Crea una copia de la carpeta indicada. Devuelve { ok, backup } o { error }. */
  sys.backupCreate = function (path) {
    var part = backupPartition();
    if (!part) return { error: 'sin-unidad' };

    var node = GT.fs.getNode(root(), path);
    if (!path.length || !node || node.type !== 'dir') return { error: 'no-carpeta' };
    if (node.locked) return { error: 'bloqueada' };
    /* Los archivos del sistema no son cosa del backup: de eso se ocupa el
       punto de restauracion. Son dos herramientas para dos cosas distintas. */
    if (hasSystemFiles(node)) return { error: 'sistema' };

    var size = GT.fs.sizeOf(node);
    if (size > part.size - backupUsed()) return { error: 'sin-espacio' };

    var b = {
      id: st().nextBackupId++,
      path: path.slice(),
      files: countFiles(node),
      size: size,
      at: GT.state.elapsed,
      snapshot: clone(node)
    };
    st().backups.push(b);
    GT.emit('backup', { op: 'create', backup: b });
    return { ok: true, backup: b };
  };

  function findBackup(id) {
    var list = st().backups;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* Version cifrada de un archivo dentro de una carpeta (la deja el
     ransomware): el mismo archivo con otro nombre. Al restaurar el original
     desde el backup, la cifrada sobra. */
  function encryptedTwin(dir, name) {
    var keys = Object.keys(dir.children || {});
    for (var i = 0; i < keys.length; i++) {
      var c = dir.children[keys[i]];
      if (c.encrypted && String(c.origName).toLowerCase() === name.toLowerCase()) return keys[i];
    }
    return null;
  }

  /* Recorre la copia y va dejando cada archivo en su lugar. Se llama dos
     veces con el mismo recorrido: primero "en seco" para saber cuanto lugar
     hace falta (apply = false) y despues de verdad. Asi no puede pasar que se
     quede sin espacio por la mitad y deje la carpeta restaurada a medias. */
  function walkRestore(snapshot, dest, apply, acc) {
    Object.keys(snapshot.children || {}).forEach(function (k) {
      var item = snapshot.children[k];
      if (item.type === 'dir') {
        if (apply) GT.fs.ensureDir(dest.concat(k));
        walkRestore(item, dest.concat(k), apply, acc);
        return;
      }
      var dir = GT.fs.getNode(root(), dest);
      var twin = dir ? encryptedTwin(dir, k) : null;
      var prev = dir ? (dir.children[GT.fs.findChildName(dir, k)] || (twin && dir.children[twin])) : null;
      acc.need += item.size - (prev ? prev.size : 0);
      if (!apply) return;

      if (twin) delete dir.children[twin];
      var real = GT.fs.findChildName(dir, k) || k;
      dir.children[real] = clone(item);
      acc.files.push({ path: dest.slice(), name: real });
    });
  }

  /** Vuelve a poner en el disco los archivos de una copia. */
  sys.backupRestore = function (id) {
    var b = findBackup(id);
    if (!b) return { error: 'no-existe' };
    /* Con el cifrador del ransomware todavia vivo, restaurar es regalarle
       archivos sanos para que los vuelva a cifrar. */
    if (GT.ransom && GT.ransom.cipherAlive()) return { error: 'cifrador-vivo' };

    var dry = { need: 0, files: [] };
    GT.fs.ensureDir(b.path);
    walkRestore(b.snapshot, b.path, false, dry);
    if (dry.need > GT.fs.free()) return { error: 'sin-espacio' };

    var acc = { need: 0, files: [] };
    walkRestore(b.snapshot, b.path, true, acc);
    GT.emit('fs', { op: 'write', path: b.path.slice(), name: '' });
    GT.emit('backup', { op: 'restore', backup: b, files: acc.files });
    return { ok: true, backup: b, files: acc.files };
  };

  sys.backupDelete = function (id) {
    var list = st().backups;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list.splice(i, 1); return { ok: true }; }
    }
    return { error: 'no-existe' };
  };

  sys.backups = function () { return st().backups.slice(); };

  var BACKUP_ERRORS = {
    'sin-unidad':    'No hay ninguna unidad de respaldo: la particion D: ya no existe.',
    'no-carpeta':    'Indica una carpeta que exista. Ejemplo:  backup create \\Documentos',
    'bloqueada':     'Esa carpeta esta protegida por clave.',
    'sistema':       'Esa carpeta tiene archivos del sistema: eso se resguarda con un punto de restauracion (restore), no con un backup.',
    'sin-espacio':   'No hay espacio suficiente para completar la operacion.',
    'no-existe':     'No existe una copia con ese numero. Mira la lista con:  backup list',
    'cifrador-vivo': 'El proceso que cifra los archivos sigue corriendo: lo que restaures lo vuelve a cifrar. Terminalo primero (ps / kill).'
  };

  function cmdBackup(args) {
    var sub = (args[0] || '').toLowerCase();

    if (sub === 'create' || sub === 'crear') {
      if (!args[1]) { print('Uso: backup create <carpeta>     Ejemplo: backup create \\Documentos', 'warn'); return; }
      var res = GT.fs.resolvePath(root(), GT.terminal.getCwd(), args.slice(1).join(' '));
      if (res.error) { print(BACKUP_ERRORS[res.error === 'bloqueado' ? 'bloqueada' : 'no-carpeta'], 'err'); GT.audio.error(); return; }

      var out = sys.backupCreate(res.path);
      if (out.error) { print(BACKUP_ERRORS[out.error], 'err'); GT.audio.error(); return; }

      var b = out.backup;
      print('');
      print('  Copiando ' + GT.fs.pathString(b.path) + '  ->  D:\\Respaldo\\copia_' + b.id, 'info');
      print('  ' + b.files + ' archivo(s), ' + GT.fs.humanSize(b.size) + '.  COPIA ' + b.id + ' COMPLETA.', 'ok');
      print('  La copia quedo en D:, otra particion: si le pasa algo a C:, sigue ahi.', 'dim');
      print('');
      GT.audio.ok();

      if (b.path.join('\\').toLowerCase() === 'documentos') {
        GT.levels.complete('l1_backup');
        GT.learn('Backup: una copia de tus archivos en OTRA partición o disco. Se hace antes del problema, no después.');
      }
      return;
    }

    if (sub === 'list' || sub === 'lista' || sub === '') {
      var part = backupPartition();
      print('');
      print(' COPIAS DE SEGURIDAD  (unidad D: RESPALDO)', 'title');
      if (!part) { print('  La particion de respaldo no existe.', 'err'); print(''); return; }
      if (!st().backups.length) print('  Todavia no hay ninguna copia.', 'dim');
      st().backups.forEach(function (b) {
        print('  ' + pad(b.id, 4) + pad(GT.fs.pathString(b.path), 26) + pad(b.files + ' arch.', 10) +
              pad(GT.fs.humanSize(b.size), 11) + 'minuto ' + GT.formatTime(b.at));
      });
      print('  Libre en D: ' + GT.fs.humanSize(part.size - backupUsed()), 'dim');
      print('');
      print('  backup create <carpeta> | backup restore <n> | backup delete <n>', 'dim');
      print('');
      return;
    }

    if (sub === 'restore' || sub === 'restaurar') {
      var out2 = sys.backupRestore(parseInt(args[1], 10));
      if (out2.error) { print(BACKUP_ERRORS[out2.error], 'err'); GT.audio.error(); return; }
      print('');
      print('  Restaurando la copia ' + out2.backup.id + ' en ' + GT.fs.pathString(out2.backup.path), 'info');
      out2.files.forEach(function (f) { print('    ' + f.name, 'ok'); });
      print('  ' + out2.files.length + ' archivo(s) restaurados tal como estaban al hacer la copia.', 'ok');
      print('');
      GT.audio.ok();
      return;
    }

    if (sub === 'delete' || sub === 'borrar') {
      var out3 = sys.backupDelete(parseInt(args[1], 10));
      if (out3.error) { print(BACKUP_ERRORS[out3.error], 'err'); GT.audio.error(); return; }
      print('Copia eliminada.', 'ok');
      return;
    }

    print('Uso: backup create <carpeta> | backup list | backup restore <n> | backup delete <n>', 'warn');
  }

  /* ============================================================
     Puntos de restauracion (restore)
     ============================================================ */
  /* Un punto de restauracion guarda la CONFIGURACION del sistema (que se
     ejecuta al arrancar, que servicios hay), no los documentos del usuario.
     Volver a un punto deshace los cambios del sistema posteriores a esa
     fecha. La trampa que el nivel quiere que el jugador vea: un punto creado
     DESPUES de la infeccion guarda tambien la infeccion. */

  function findPoint(id) {
    var list = st().restorePoints;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  sys.restoreCreate = function (label) {
    var s = st();
    if (s.restorePoints.length >= GT.CONFIG.RESTORE_MAX) return { error: 'tope' };
    if (GT.CONFIG.RESTORE_POINT_SIZE > GT.fs.free()) return { error: 'sin-espacio' };

    /* El punto se saca la foto del sistema COMO ESTA: si la persistencia del
       malware sigue en el arranque, queda guardada adentro. */
    var rp = { id: s.nextRestoreId++, when: 'hoy', label: label || 'Punto manual', clean: !s.persist, manual: true };
    s.restorePoints.push(rp);
    GT.fs.ensureDir(RESTORE_DIR).children[rpFileName(rp.id)] = rpFile(rp.id);
    GT.emit('fs', { op: 'write', path: RESTORE_DIR.slice(), name: rpFileName(rp.id) });
    return { ok: true, point: rp };
  };

  sys.restoreDelete = function (id) {
    var list = st().restorePoints;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        list.splice(i, 1);
        delete GT.fs.ensureDir(RESTORE_DIR).children[rpFileName(id)];
        GT.emit('fs', { op: 'remove', path: RESTORE_DIR.slice(), name: rpFileName(id) });
        return { ok: true };
      }
    }
    return { error: 'no-existe' };
  };

  /** Vuelve la configuracion del sistema al punto indicado.
      result: 'limpio' | 'infectado' | 'reinfectado' */
  sys.restoreApply = function (id) {
    var rp = findPoint(id);
    if (!rp) return { error: 'no-existe' };
    if (st().frozen) return { error: 'tildado' };

    if (!rp.clean) return { ok: true, point: rp, result: 'infectado' };
    if (malwareInMemory()) return { ok: true, point: rp, result: 'reinfectado' };

    st().persist = false;
    var ini = GT.fs.getNode(root(), ['Sistema', 'arranque.ini']);
    if (ini) ini.content = bootIni(false);
    GT.emit('sys', { op: 'restore', point: rp });
    return { ok: true, point: rp, result: 'limpio' };
  };

  sys.restorePoints = function () { return st().restorePoints.slice(); };

  function cmdRestore(args) {
    var sub = (args[0] || '').toLowerCase();
    var s = st();

    if (sub === 'list' || sub === 'lista' || sub === '') {
      print('');
      print(' PUNTOS DE RESTAURACION DEL SISTEMA', 'title');
      print('  ' + pad('N', 4) + pad('FECHA', 20) + 'DESCRIPCION', 'dim');
      s.restorePoints.forEach(function (rp) {
        print('  ' + pad(rp.id, 4) + pad(rp.when, 20) + rp.label);
      });
      print('');
      print('  Un punto guarda la configuracion del sistema TAL COMO ESTABA ese dia.', 'dim');
      print('  No toca tus documentos: para eso esta backup.', 'dim');
      print('  restore apply <n> | restore create <nombre> | restore delete <n>', 'dim');
      print('');
      return;
    }

    if (sub === 'create' || sub === 'crear') {
      var out = sys.restoreCreate(args.slice(1).join(' ').slice(0, 40));
      if (out.error === 'tope') { print('Ya hay ' + GT.CONFIG.RESTORE_MAX + ' puntos. Borra alguno con:  restore delete <n>', 'err'); GT.audio.error(); return; }
      if (out.error) { print('No hay espacio en disco para guardar el punto (' + GT.fs.humanSize(GT.CONFIG.RESTORE_POINT_SIZE) + ').', 'err'); GT.audio.error(); return; }
      print('Punto de restauracion ' + out.point.id + ' creado: "' + out.point.label + '"', 'ok');
      print('Ojo: guarda el sistema como esta AHORA, con lo bueno y con lo malo.', 'dim');
      GT.audio.ok();

      /* Buena practica premiada una sola vez: dejar un punto limpio despues
         de haber saneado el sistema. */
      if (out.point.clean && !s.rewardedCleanPoint) {
        s.rewardedCleanPoint = true;
        GT.addScore(60, 'punto de restauración limpio');
        GT.learn('Después de limpiar un equipo conviene crear un punto de restauración nuevo: es el primero confiable.');
      }
      return;
    }

    if (sub === 'delete' || sub === 'borrar') {
      var out2 = sys.restoreDelete(parseInt(args[1], 10));
      if (out2.error) { print('No existe un punto con ese numero.', 'err'); GT.audio.error(); return; }
      print('Punto eliminado. Se liberaron ' + GT.fs.humanSize(GT.CONFIG.RESTORE_POINT_SIZE) + '.', 'ok');
      return;
    }

    if (sub === 'apply' || sub === 'aplicar') {
      var id = parseInt(args[1], 10);
      var res = sys.restoreApply(id);
      if (res.error === 'tildado') { print('El sistema no responde: primero hay que destrabarlo (diag).', 'err'); GT.audio.error(); return; }
      if (res.error) { print('No existe un punto con ese numero. Mira la lista con:  restore list', 'err'); GT.audio.error(); return; }

      print('');
      print('  Restaurando el sistema al punto ' + res.point.id + ' (' + res.point.when + ')...', 'info');

      if (res.result === 'infectado') {
        print('  Restauracion completa... y el malware sigue en el arranque.', 'err');
        print('  Ese punto se guardo con el sistema YA infectado: restauraste la infeccion.', 'warn');
        print('  Compara la fecha de cada punto con la hora de la infeccion (registro.log).', 'dim');
        print('');
        GT.audio.error();
        GT.wrong(60, 'punto de restauración infectado');
        GT.damage(6, 'restauraste un estado ya infectado');
        return;
      }

      if (res.result === 'reinfectado') {
        print('  Restauracion completa. La entrada del malware desaparecio del arranque...', 'ok');
        print('  ...y volvio a aparecer. El malware sigue en memoria y la reescribio.', 'err');
        print('  Restaurar sirve DESPUES de sacarlo de la memoria, no antes.', 'dim');
        print('');
        GT.audio.error();
        return;
      }

      print('  Restauracion completa. La entrada del malware ya no esta en el arranque.', 'ok');
      print('  Comprobalo:  type \\Sistema\\arranque.ini', 'dim');
      print('');
      GT.audio.ok();
      /* El punto 2 es el ideal: el ultimo ANTES de la infeccion. El 1
         tambien limpia, pero se lleva puestos cambios que estaban bien. */
      if (res.point.id === 1) {
        print('  (Ese punto era mas viejo de lo necesario: tambien se deshizo la instalacion de Java.)', 'dim');
        GT.addScore(80, 'sistema restaurado');
      } else {
        GT.correct(160, 'sistema restaurado');
      }
      GT.levels.complete('purge_restore');
      GT.learn('Restaurar sistema: se elige el último punto ANTERIOR a la infección. Uno posterior restaura también el malware.');
      return;
    }

    print('Uso: restore list | restore apply <n> | restore create <nombre> | restore delete <n>', 'warn');
  }

  /* ============================================================
     Particiones (part)
     ============================================================ */
  function findPartition(n) {
    var list = st().partitions;
    for (var i = 0; i < list.length; i++) if (list[i].n === n) return list[i];
    return null;
  }

  sys.partitions = function () { return st().partitions.slice(); };

  /** Borra una particion. result: 'ok' | 'recreada'  o  error. */
  sys.partitionDelete = function (n) {
    var p = findPartition(n);
    if (!p) return { error: 'no-existe' };
    /* La particion desde la que esta corriendo el sistema no se puede borrar
       con el sistema andando: lo frena el propio sistema operativo. */
    if (p.kind === 'sistema') return { error: 'en-uso', part: p };
    if (p.kind === 'oculta' && malwareInMemory()) return { ok: true, part: p, result: 'recreada' };

    var lost = 0;
    if (p.kind === 'datos') {
      lost = st().backups.length;
      st().backups = [];
    }
    st().partitions.splice(st().partitions.indexOf(p), 1);
    GT.emit('sys', { op: 'part-delete', part: p });
    return { ok: true, part: p, result: 'ok', lostBackups: lost };
  };

  sys.hiddenPartition = function () {
    var list = st().partitions;
    for (var i = 0; i < list.length; i++) if (list[i].kind === 'oculta') return list[i];
    return null;
  };

  function cmdPart(args) {
    var sub = (args[0] || '').toLowerCase();
    var s = st();

    if (sub === 'list' || sub === 'lista' || sub === '') {
      var used = 0;
      print('');
      print(' DISCO 0  —  WDC-TEC-40GB', 'title');
      print('  ' + pad('N', 4) + pad('LETRA', 7) + pad('ETIQUETA', 13) + pad('FORMATO', 9) + pad('TAMANIO', 11) + 'TIPO', 'dim');
      s.partitions.forEach(function (p) {
        used += p.size;
        print('  ' + pad(p.n, 4) + pad(p.letter || '--', 7) + pad(p.label || '(ninguna)', 13) + pad(p.fs, 9) +
              pad(GT.fs.humanSize(p.size), 11) + p.kind.toUpperCase(),
              p.kind === 'oculta' ? 'warn' : '');
      });
      print('  ' + pad('', 24) + pad('', 9) + pad(GT.fs.humanSize(40 * 1024 * MB - used), 11) + 'sin asignar', 'dim');
      print('');
      print('  part info <n> | part delete <n>', 'dim');
      print('');
      return;
    }

    var n = parseInt(args[1], 10);
    var p = findPartition(n);

    if (sub === 'info') {
      if (!p) { print('No existe la particion ' + args[1] + '. Mira la tabla con:  part list', 'err'); GT.audio.error(); return; }
      print('');
      print(' PARTICION ' + p.n + '  ' + (p.letter || '(sin letra)') + '  ' + (p.label || '(sin etiqueta)'), 'title');
      print('  Formato ...... ' + p.fs);
      print('  Tamanio ...... ' + GT.fs.humanSize(p.size));
      print('  Tipo ......... ' + p.kind.toUpperCase());
      print('  ' + p.note, p.kind === 'oculta' ? 'warn' : 'dim');
      if (p.kind === 'datos') print('  Copias de seguridad guardadas: ' + s.backups.length, 'dim');
      print('');
      return;
    }

    if (sub === 'delete' || sub === 'borrar') {
      if (!p) { print('No existe la particion ' + args[1] + '. Mira la tabla con:  part list', 'err'); GT.audio.error(); return; }

      /* Borrar una particion no tiene vuelta atras, asi que pide una
         confirmacion explicita: hay que escribir el comando otra vez con /si.
         Es el "¿esta seguro?" de la consola. */
      var confirmed = args.some(function (a) { return a.toLowerCase() === '/si'; });
      if (!confirmed && p.kind !== 'sistema') {
        print('Borrar una particion elimina TODO lo que tiene adentro y no se puede deshacer.', 'warn');
        if (p.kind === 'datos') print('La particion ' + p.n + ' (D: RESPALDO) guarda ' + s.backups.length + ' copia(s) de seguridad.', 'warn');
        print('Si estas seguro, repetilo con /si:   part delete ' + p.n + ' /si', 'dim');
        return;
      }

      var res = sys.partitionDelete(n);
      if (res.error === 'en-uso') {
        print('Acceso denegado: la particion 1 (C:) es la de arranque y el sistema esta corriendo desde ahi.', 'err');
        GT.audio.error();
        return;
      }

      if (res.result === 'recreada') {
        print('Particion ' + n + ' eliminada.', 'ok');
        print('...y creada de nuevo. El malware sigue en memoria y la volvio a armar.', 'err');
        print('Primero hay que sacarlo de la memoria y cortarle la entrada.', 'dim');
        GT.audio.error();
        return;
      }

      if (res.part.kind === 'datos') {
        print('Particion ' + n + ' (D: RESPALDO) eliminada. Se perdieron ' + res.lostBackups + ' copia(s) de seguridad.', 'err');
        print('Esa era una particion tuya, no del malware.', 'warn');
        GT.audio.hurt();
        GT.wrong(150, 'partición de respaldo eliminada');
        GT.damage(10, 'borraste la partición de respaldo');
        GT.ui.shake();
        return;
      }

      print('Particion ' + n + ' eliminada. El espacio quedo sin asignar.', 'ok');
      print('El nucleo ya no tiene desde donde reinstalarse.', 'ok');
      GT.audio.ok();
      GT.correct(160, 'partición oculta eliminada');
      GT.levels.complete('purge_part');
      GT.learn('Una partición sin letra ni etiqueta que nadie creó es una señal de alarma: ahí se puede esconder un malware.');
      return;
    }

    print('Uso: part list | part info <n> | part delete <n>', 'warn');
  }

  /** Lo que todavia protege al nucleo. Lo consulta el comando purge. */
  sys.purgeBlockers = function () {
    var out = [];
    if (st().persist) out.push('sigue en la configuracion de arranque (restore)');
    if (sys.hiddenPartition()) out.push('tiene una copia en una particion oculta (part)');
    return out;
  };

  /* ============================================================
     Congelamientos (diag)
     ============================================================ */
  /* "PC tildada": un proceso acapara el disco y deja al escritorio esperando
     una respuesta que no llega. El error tipico es apagar de prepo o matar al
     programa que SE COLGO (la victima). Lo que hay que hacer es encontrar al
     que lo BLOQUEA y terminar ese. La interfaz grafica deja de responder,
     pero la Terminal sigue viva: es la consola de rescate. */

  sys.isFrozen = function () { return !!(GT.state.sys && GT.state.sys.frozen); };

  function setFrozenClass(on) {
    var desk = document.getElementById('desktop');
    if (desk) desk.classList.toggle('is-frozen', !!on);
  }

  function startFreeze() {
    var s = st();
    s.hadFreeze = true;

    var hostile = GT.procs.list().filter(function (p) { return p.malicious; });
    /* Si el jugador ya limpio todo antes de que el sistema llegara a tildarse,
       no hay nada que diagnosticar: doy el objetivo por cumplido para que el
       nivel no quede trabado esperando algo que no va a pasar. */
    if (!hostile.length) { GT.levels.complete('l2_freeze'); return; }

    hostile.sort(function (a, b) { return b.cpu - a.cpu; });
    var victim = GT.procs.list().filter(function (p) { return p.name === 'explorer.exe'; })[0];
    s.frozen = {
      pid: hostile[0].pid,
      name: hostile[0].name,
      victim: victim ? { pid: victim.pid, name: victim.name } : null,
      since: GT.state.elapsed,
      diagnosed: false
    };
    frozenFor = 0;
    setFrozenClass(true);

    GT.audio.alarm();
    GT.ui.shake();
    GT.ui.toast('EL SISTEMA NO RESPONDE', 'bad');
    GT.terminal.open();
    GT.terminal.notify('[!] El escritorio dejo de responder. La Terminal sigue viva.', 'err');
    GT.terminal.notify('    Escribi  diag  para ver que proceso lo esta trabando.', 'warn');
    GT.emit('sys', { op: 'freeze', frozen: s.frozen });
  }

  function endFreeze() {
    var s = st();
    var f = s.frozen;
    s.frozen = null;
    setFrozenClass(false);

    GT.ui.toast('El sistema volvió a responder', 'info');
    GT.terminal.notify('[OK] El escritorio volvio a responder.', 'ok');
    if (f.diagnosed) {
      GT.correct(140, 'congelamiento resuelto');
    } else {
      GT.addScore(40, 'congelamiento resuelto a ciegas');
      GT.terminal.notify('     Lo destrabaste sin diagnosticar: salio bien, pero fue suerte.', 'dim');
    }
    GT.levels.complete('l2_freeze');
    GT.learn('PC tildada: se termina el proceso que BLOQUEA (diag lo señala), no el programa que quedó colgado.');
    GT.emit('sys', { op: 'unfreeze' });
  }

  GT.on('proc-killed', function (p) {
    var s = GT.state.sys;
    if (!s) return;
    if (s.frozen && p.pid === s.frozen.pid) { endFreeze(); return; }
    /* Cuando al malware le queda UN solo proceso, ese se atrinchera y cuelga
       el sistema. Espero a que sea el ultimo a proposito: con varios hostiles
       vivos la CPU ya esta saturada y sumarle una tildada seria castigar dos
       veces por lo mismo. */
    if (p.malicious && GT.state.level === 2 && !s.hadFreeze && freezeIn < 0 &&
        GT.procs.remainingHostile() === 1) {
      freezeIn = GT.CONFIG.FREEZE_DELAY;
    }
  });

  /** Lo llama el loop de game.js. */
  sys.tick = function (dt) {
    var s = GT.state.sys;
    if (!s) return;

    if (freezeIn >= 0) {
      freezeIn -= dt;
      if (freezeIn < 0) { freezeIn = -1; if (GT.state.level === 2) startFreeze(); }
    }

    if (s.frozen) {
      frozenFor += dt;
      if (frozenFor >= 1) {
        frozenFor = 0;
        GT.damage(GT.CONFIG.FREEZE_DRAIN, 'sistema congelado');
      }
    }
  };

  function cmdDiag() {
    var s = st();
    var list = GT.procs.list();
    var u = GT.fs.usage();
    var cpu = GT.procs.getCpu();
    var ramPct = Math.round(GT.procs.getRam() / GT.procs.RAM_TOTAL * 100);

    print('');
    print(' DIAGNOSTICO DEL SISTEMA', 'title');

    if (!list.length) {
      print('  Disco C: ....... ' + u.percent + '% usado', u.free <= 0 ? 'err' : '');
      print('  El monitor de procesos todavia no esta habilitado.', 'dim');
      print('');
      return;
    }

    print('  CPU ............ ' + cpu + '%', cpu >= 92 ? 'err' : cpu >= 70 ? 'warn' : '');
    print('  Memoria ........ ' + ramPct + '%', ramPct >= 85 ? 'err' : '');
    print('  Disco C: ....... ' + u.percent + '% usado', u.free <= 0 ? 'err' : u.percent >= 90 ? 'warn' : '');

    if (!s.frozen) {
      var top = list.slice().sort(function (a, b) { return b.cpu - a.cpu; })[0];
      print('  Estado ......... respondiendo', 'ok');
      print('');
      print('  El que mas CPU consume: ' + top.name + ' (PID ' + top.pid + ', ' + top.cpu + '%)' +
            (top.signed ? '' : '  [SIN FIRMA]'), top.signed ? 'dim' : 'warn');
      print('');
      return;
    }

    var f = s.frozen;
    f.diagnosed = true;
    print('  Estado ......... NO RESPONDE hace ' + Math.max(1, Math.round(GT.state.elapsed - f.since)) + ' s', 'err');
    print('');
    if (f.victim && GT.procs.get(f.victim.pid)) {
      print('  Colgado ........ ' + f.victim.name + ' (PID ' + f.victim.pid + ')  esperando al disco', 'warn');
    }
    print('  Lo bloquea ..... ' + f.name + ' (PID ' + f.pid + ')  [SIN FIRMA]  acapara el disco', 'err');
    print('');
    print('  El que se colgo es la VICTIMA. Hay que terminar al que lo BLOQUEA:', 'info');
    print('      kill ' + f.pid, 'info');
    print('');
    GT.audio.click();
  }

  /* ============================================================
     Comandos de la Terminal
     ============================================================ */
  var SECTION = 'MANTENIMIENTO';

  GT.terminal.register('backup', {
    desc: 'Copias de seguridad.', run: cmdBackup,
    help: { section: SECTION, usage: 'backup', text: 'copias de seguridad de una carpeta (create / list / restore)' }
  }, ['respaldo']);

  GT.terminal.register('restore', {
    desc: 'Puntos de restauracion del sistema.', run: cmdRestore,
    help: { section: SECTION, usage: 'restore', text: 'puntos de restauracion del sistema (list / apply / create)' }
  }, ['restaurar', 'rstrui']);

  GT.terminal.register('part', {
    desc: 'Particiones del disco.', run: cmdPart,
    help: { section: SECTION, usage: 'part', text: 'particiones del disco (list / info / delete)' }
  }, ['diskpart', 'particiones']);

  GT.terminal.register('diag', {
    desc: 'Diagnostico del sistema.', run: cmdDiag,
    help: { section: SECTION, usage: 'diag', text: 'por que el sistema esta lento o no responde' }
  }, ['diagnostico']);

})(window, document);
