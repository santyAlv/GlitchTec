/* ============================================================
   Glitch.TEC — Terminal (CLI)
   Mecanica principal: el jugador escribe comandos reales para
   inspeccionar el sistema. Cada comando valida argumentos,
   produce salida y puede disparar objetivos del nivel.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var term = GT.terminal = {};

  var WIN_ID = 'terminal';
  var out = null;
  var input = null;
  var promptEl = null;

  /* cwd = "current working directory", el mismo nombre que usa el sistema
     operativo de verdad. Lo guardo como array de segmentos (['Sistema']) y no
     como string, porque asi entrar es push y salir es pop. Ver filesystem.js. */
  var cwd = [];
  /* history guarda los comandos escritos y histIdx es el "cursor" con el que
     me muevo entre ellos con las flechas. histIdx = -1 significa "no estoy
     navegando el historial, estoy escribiendo un comando nuevo". */
  var history = [];
  var histIdx = -1;

  /* ============================================================
     Salida
     ============================================================ */
  /* Escribe UNA linea en la salida. Todo lo que muestra la terminal pasa por
     aca, asi el estilo es siempre consistente y el autoscroll esta en un solo
     lugar. La clase opcional ('err', 'ok', 'warn'...) la convierto en 'l-err',
     'l-ok', etc., y el color lo pone el CSS. */
  function print(text, cls) {
    if (!out) return;                       // la ventana esta cerrada
    var line = document.createElement('span');
    line.className = 'term-line ' + (cls ? 'l-' + cls : '');
    /* textContent, nunca innerHTML: el jugador escribe lo que quiere y yo se
       lo devuelvo en pantalla. Si usara innerHTML, escribir <b>hola</b> en la
       terminal inyectaria HTML de verdad. */
    line.textContent = (text === undefined ? '' : text);
    out.appendChild(line);
    /* Autoscroll al fondo: scrollHeight es el alto TOTAL del contenido (con lo
       que no se ve), scrollTop es cuanto scrollee. Igualarlos = ir al final. */
    out.scrollTop = out.scrollHeight;
  }
  term.print = print;

  function printBlock(text, cls) {
    String(text).split(/\r?\n/).forEach(function (l) { print(l, cls); });
  }

  function updatePrompt() {
    if (promptEl) promptEl.textContent = GT.fs.pathString(cwd) + '>';
  }

  term.getCwd = function () { return cwd.slice(); };

  /* ============================================================
     Comandos
     ============================================================ */
  /* TABLA DE DESPACHO: en vez de un switch gigante con 20 casos, cada comando
     es una propiedad de este objeto:

        COMMANDS['dir'] = { desc: '...', run: function (args) { ... } }

     Ejecutar un comando es entonces buscar COMMANDS[loQueEscribio] y llamar a
     su .run(). Ventajas: agregar un comando nuevo no toca NADA del motor (solo
     agrego una propiedad mas), y los alias salen gratis haciendo que dos
     claves apunten al mismo objeto (ver COMMANDS.ls = COMMANDS.dir).
     Que un objeto guarde funciones no tiene nada de raro en JS: las funciones
     son valores como cualquier otro. */
  var COMMANDS = {};

  /* Los comandos de este archivo son los de siempre. Los modulos que traen
     los suyos (mantenimiento, ransomware, asistente) se enchufan por aca en
     vez de venir a editar esta tabla:

        GT.terminal.register('backup', { desc, run, help }, ['respaldo']);

     help es opcional: { section, usage, text } suma una linea al comando
     "help" bajo esa seccion. Los alias apuntan al mismo objeto. */
  var extraHelp = {};         // seccion -> [ { usage, text } ]

  term.register = function (name, def, aliases) {
    COMMANDS[name] = def;
    (aliases || []).forEach(function (a) { COMMANDS[a] = def; });
    if (def.help) {
      (extraHelp[def.help.section] || (extraHelp[def.help.section] = [])).push(def.help);
    }
  };

  /* GUARDIAS: funciones que pueden frenar un comando antes de que corra.
     Reciben (nombre, argumentos) y devuelven el mensaje con el que se frena,
     o nada para dejarlo pasar. Asi un modulo puede deshabilitar comandos
     ajenos por un rato (el ransomware apagando el antivirus) sin que esos
     comandos tengan que saber que el ransomware existe. */
  var guards = [];
  term.guard = function (fn) { guards.push(fn); };

  /* Atajo: la raiz del sistema de archivos vive en el estado de la partida, y
     cambia en cada partida nueva. Por eso es una funcion y no una variable
     guardada: si la cacheara, despues de reiniciar seguiria apuntando al arbol
     viejo. */
  function root() { return GT.state.fsRoot; }

  /* ---------- help ---------- */
  COMMANDS.help = {
    desc: 'Muestra esta lista de comandos.',
    run: function () {
      print('COMANDOS DISPONIBLES', 'title');
      /* La lista va por secciones: con mas de veinte comandos, una sola
         columna larga no se puede leer. Una fila de un solo elemento es un
         titulo de seccion. */
      var rows = [
        ['ARCHIVOS'],
        ['dir',                 'muestra el contenido de la carpeta actual'],
        ['cd <carpeta>',        'entra a una carpeta  ("cd .." vuelve atras)'],
        ['type <archivo>',      'muestra el contenido de un archivo de texto'],
        ['del <archivo>',       'borra un archivo  (acepta comodines: del *.tmp)'],
        ['copy <orig> <dest>',  'copia un archivo'],
        ['move <orig> <dest>',  'mueve un archivo o una carpeta'],
        ['ren <viejo> <nuevo>', 'cambia el nombre'],
        ['md / rd <carpeta>',   'crea / borra una carpeta'],
        ['espacio',             'espacio usado y libre en el disco'],
        ['SEGURIDAD'],
        ['scan <archivo>',      'analiza un archivo en busca de amenazas'],
        ['unlock <clave>',      'desbloquea una carpeta protegida'],
        ['ps',                  'lista los procesos en ejecucion'],
        ['kill <pid>',          'termina un proceso por su identificador'],
        ['purge',               'intenta purgar el malware (solo al final)']
      ];
      /* Lo que sumaron otros modulos con term.register. Los comandos que
         declararon la seccion SEGURIDAD van pegados a ella (es la ultima de
         arriba); el resto arma su propia seccion. */
      (extraHelp.SEGURIDAD || []).forEach(function (h) { rows.push([h.usage, h.text]); });
      Object.keys(extraHelp).forEach(function (section) {
        if (section === 'SEGURIDAD') return;
        rows.push([section]);
        extraHelp[section].forEach(function (h) { rows.push([h.usage, h.text]); });
      });
      rows = rows.concat([
        ['PARTIDA'],
        ['objetivos',           'muestra los objetivos del nivel actual'],
        ['pista',               'pide una pista (cuesta ' + GT.CONFIG.HINT_COST + ' puntos)'],
        ['cls',                 'limpia la pantalla'],
        ['whoami / ver',        'informacion del usuario y del sistema']
      ]);
      rows.forEach(function (r) {
        if (r.length === 1) { print(''); print(' ' + r[0], 'dim'); return; }
        print('  ' + pad(r[0], 22) + r[1]);
      });
      print('');
      print('Tip: usa las flechas ARRIBA/ABAJO para repetir comandos.', 'dim');
      GT.levels.complete('l1_help');
    }
  };
  /* ALIAS: las tres claves apuntan al MISMO objeto en memoria, no a copias.
     Es solo una referencia mas, no gasta nada, y el jugador puede escribir en
     castellano o en ingles. Uso COMMANDS['?'] con corchetes porque "?" no es
     un nombre valido para la notacion con punto. */
  COMMANDS.ayuda = COMMANDS.help;
  COMMANDS['?'] = COMMANDS.help;

  /* Rellena con espacios a la derecha hasta llegar a n caracteres. Es mi
     "columna" para alinear las tablas de texto: como la terminal usa fuente
     monoespaciada, todos los caracteres miden lo mismo y alcanza con contar
     letras para que las columnas queden derechas. */
  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  /* ---------- dir ---------- */
  COMMANDS.dir = {
    desc: 'Lista el contenido del directorio.',
    run: function () {
      var node = GT.fs.getNode(root(), cwd);
      if (!node) { print('Ruta invalida.', 'err'); return; }

      print(' El volumen de la unidad C es WINTEC');
      print(' Directorio de ' + GT.fs.pathString(cwd));
      print('');

      /* Object.keys() me devuelve los nombres de los hijos como array.
         El "|| {}" es por si el nodo no tuviera children: Object.keys(undefined)
         tira error, Object.keys({}) devuelve [] y sigue todo tranquilo. */
      var names = Object.keys(node.children || {});
      // El ".." solo tiene sentido si NO estoy parado en la raiz
      if (cwd.length) print(' ' + pad('<DIR>', 14) + '..', 'dim');

      /* Dos recorridas sobre el mismo array (primero carpetas, despues
         archivos) en lugar de una sola con un if adentro: asi la salida sale
         ordenada como en la consola de Windows, sin tener que ordenar nada. */
      var dirs = 0, files = 0;
      names.forEach(function (n) {
        var c = node.children[n];
        if (c.type === 'dir') {
          dirs++;
          var tag = c.locked ? '<DIR> [BLOQUEADO]' : '<DIR>';
          print(' ' + pad(tag, 20 - (c.locked ? 6 : 0)) + n, c.locked ? 'warn' : '');
        }
      });
      names.forEach(function (n) {
        var c = node.children[n];
        if (c.type !== 'dir') {
          files++;
          var flag = GT.fs.hasDoubleExtension(n) ? '  <- ?' : '';
          print(' ' + pad(GT.fs.humanSize(c.size), 14) + n + flag,
                GT.fs.hasDoubleExtension(n) ? 'warn' : '');
        }
      });

      print('');
      print('   ' + files + ' archivo(s)   ' + dirs + ' directorio(s)', 'dim');
      /* Como el dir de verdad: abajo de todo, cuanto lugar queda en la unidad */
      print('   ' + GT.fs.humanSize(GT.fs.free()) + ' libres en la unidad',
            GT.fs.free() <= 0 ? 'err' : 'dim');

      if (cwd.length === 1 && cwd[0] === 'Descargas') {
        GT.levels.complete('l1_dir');
      }
    }
  };
  COMMANDS.ls = COMMANDS.dir;

  /* ---------- cd ---------- */
  COMMANDS.cd = {
    desc: 'Cambia de directorio.',
    run: function (args) {
      if (!args.length) { print(GT.fs.pathString(cwd)); return; }

      var res = GT.fs.resolvePath(root(), cwd, args.join(' '));

      if (res.error === 'no-existe') {
        print('El sistema no puede encontrar la ruta especificada: ' + res.name, 'err');
        GT.audio.error();
        return;
      }
      if (res.error === 'no-es-dir') {
        print('"' + res.name + '" no es un directorio.', 'err');
        GT.audio.error();
        return;
      }
      if (res.error === 'bloqueado') {
        print('ACCESO DENEGADO: la carpeta "' + res.name + '" esta protegida por clave.', 'err');
        print('Usa:  unlock <clave>', 'warn');
        if (res.node && res.node.hint) print('Pista: ' + res.node.hint, 'dim');
        GT.audio.error();
        GT.state.flags.sawLockedFolder = true;
        return;
      }

      cwd = res.path;
      updatePrompt();
      GT.audio.click();
    }
  };

  /* ---------- type ---------- */
  COMMANDS.type = {
    desc: 'Muestra el contenido de un archivo.',
    run: function (args) {
      if (!args.length) { print('Uso: type <archivo>', 'warn'); return; }

      var found = locateFile(args.join(' '));
      if (!found) return;

      print('');
      printBlock(found.node.content || '[archivo vacio]');
      print('');

      if (found.name.toLowerCase() === 'leeme.txt') {
        GT.levels.complete('l1_note');
        GT.learn('Windows oculta las extensiones conocidas: un .jpg puede ser un .exe.');
      }
      if (found.name.toLowerCase() === 'registro.log') {
        GT.levels.complete('l1_log');
        GT.learn('Los logs del sistema registran qué proceso tocó cada archivo.');
      }
      if (found.name.toLowerCase() === 'contrasenias.txt') {
        print('[!] Guardar contrasenias en texto plano es justo lo que busca un infostealer.', 'warn');
        GT.learn('Nunca guardes contraseñas en un .txt sin cifrar.');
      }
    }
  };
  COMMANDS.cat = COMMANDS.type;

  /* ---------- scan ---------- */
  COMMANDS.scan = {
    desc: 'Analiza un archivo en busca de amenazas.',
    run: function (args) {
      if (!args.length) { print('Uso: scan <archivo>', 'warn'); return; }

      var found = locateFile(args.join(' '));
      if (!found) return;

      var node = found.node;
      print('');
      print('  ANALIZANDO: ' + found.name, 'info');
      print('  ' + '.'.repeat(34), 'dim');
      print('  Tamanio ............ ' + GT.fs.humanSize(node.size));
      print('  Extension real ..... ' + realExtension(found.name));
      print('  Firma digital ...... ' + (node.signed === false ? 'AUSENTE' :
              node.signed ? 'VALIDA' : 'no aplica'),
            node.signed === false ? 'err' : '');

      if (!node.malicious) {
        print('  VEREDICTO .......... SIN AMENAZAS', 'ok');
        print('');
        print('  Analizar archivos sanos consume tiempo de CPU (-5 pts).', 'dim');
        GT.addScore(-5, 'análisis innecesario');
        GT.audio.click();
        return;
      }

      var t = node.threat;
      print('  VEREDICTO .......... AMENAZA DETECTADA', 'err');
      print('');
      print('  >> ' + t.name + ' — ' + t.type, 'evil');
      print('  >> LECCION: ' + t.lesson, 'warn');
      print('');
      printBlock('  ' + t.detail.split('\r\n').join('\r\n  '), 'info');
      print('');

      GT.audio.alarm();
      node.scanned = true;

      if (found.name.toLowerCase() === 'foto_vacaciones.jpg.exe') {
        GT.levels.complete('l1_scan');
        GT.learn('Doble extensión (.jpg.exe): un ejecutable disfrazado de imagen.');
        print('  El dropper movio su carga util a C:\\Sistema\\cuarentena', 'warn');
        print('  (esa carpeta esta protegida por clave)', 'dim');
      }
      if (found.name.toLowerCase() === 'payload.bin') {
        GT.levels.complete('l1_payload');
        GT.learn('Persistencia: el malware sobrevive al reinicio ejecutándose desde memoria.');
      }
    }
  };
  COMMANDS.analizar = COMMANDS.scan;

  /* Devuelve la extension REAL, y si detecta doble extension lo dice.
     La regla que quiero ensenar: la extension que manda es SIEMPRE la ultima,
     lo de antes es parte del nombre. Primero saco la ultima ($ = final del
     string) y despues pruebo el patron de dos extensiones para poder mostrar
     el "aparenta ser". */
  function realExtension(name) {
    var m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    if (!m) return 'sin extension';
    var declared = name.toLowerCase().match(/\.([a-z0-9]+)\.([a-z0-9]+)$/);
    if (declared) return '.' + declared[2] + '  (aparenta ser .' + declared[1] + ')';
    return '.' + m[1];
  }

  /** Busca un archivo por nombre en el directorio actual e informa el error.
      La escribi una vez y la usan type y scan: las dos necesitan exactamente
      lo mismo (encontrar el archivo, avisar si no existe, avisar si en realidad
      es una carpeta). Devuelve null cuando algo fallo —y YA imprimio el error—
      asi el que la llama solo tiene que hacer  if (!found) return;  */
  function locateFile(arg) {
    var t = splitTarget(arg);
    if (t.error) { fail(t); return null; }

    var node = GT.fs.getNode(root(), t.dir);
    var real = GT.fs.findChildName(node, t.name);

    if (!real) {
      print('No se encuentra el archivo "' + t.name + '" en ' + GT.fs.pathString(t.dir), 'err');
      print('Usa "dir" para ver que hay en esta carpeta.', 'dim');
      GT.audio.error();
      return null;
    }
    var child = node.children[real];
    if (child.type === 'dir') {
      print('"' + real + '" es un directorio, no un archivo.', 'err');
      GT.audio.error();
      return null;
    }
    return { name: real, node: child, dir: t.dir };
  }

  /* Separa lo que escribio el jugador en CARPETA + NOMBRE, para que los
     comandos acepten rutas y no solo nombres de la carpeta actual:
       "leeme.txt"              -> carpeta actual      + leeme.txt
       "Sistema\Temp\x.tmp"     -> C:\Sistema\Temp     + x.tmp
       "\Documentos\leeme.txt"  -> C:\Documentos       + leeme.txt
     Corto en la ULTIMA barra: todo lo de antes es la carpeta (y la resuelve
     resolvePath, con sus ".." y sus carpetas bloqueadas) y lo de despues es
     el nombre. Si la carpeta no existe devuelvo ese mismo error. */
  function splitTarget(arg) {
    var norm = String(arg).replace(/\//g, '\\');
    var cut = norm.lastIndexOf('\\');
    if (cut === -1) return { dir: cwd.slice(), name: norm };

    var res = GT.fs.resolvePath(root(), cwd, norm.slice(0, cut) || '\\');
    if (res.error) return res;
    return { dir: res.path, name: norm.slice(cut + 1) };
  }

  /* Las operaciones de archivos devuelven sus mensajes con acentos, porque
     tambien los muestra el Explorador. La consola no los usa (ni la ñ), asi
     que se los saco antes de imprimir: normalize('NFD') separa cada letra de
     su acento y el regex borra los acentos sueltos. */
  function plain(text) {
    return String(text).replace(/ñ/g, 'ni').replace(/Ñ/g, 'NI')
                       .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Imprime el error de una operacion de archivos y hace el sonido. */
  term.plain = plain;

  function fail(res) {
    print(plain(GT.fs.explain(res)), 'err');
    if (res.error === 'bloqueado') print('Usa:  unlock <clave>', 'warn');
    if (res.error === 'no-vacio') print('Para borrarla con todo lo que tiene adentro:  rd ' + res.name + ' /s', 'dim');
    if (res.error === 'sin-espacio') print('Mira que ocupa lugar con:  espacio', 'dim');
    GT.audio.error();
  }

  /* ---------- del ---------- */
  COMMANDS.del = {
    desc: 'Borra un archivo.',
    run: function (args) {
      if (!args.length) { print('Uso: del <archivo>     (acepta comodines: del *.tmp)', 'warn'); return; }

      var t = splitTarget(args.join(' '));
      if (t.error) { fail(t); return; }
      var dirNode = GT.fs.getNode(root(), t.dir);

      /* Comodines: armo la lista de nombres que coinciden y los borro de a
         uno. Sin comodin la lista tiene un solo elemento, asi que el camino
         es el mismo para los dos casos. */
      var names = /[*?]/.test(t.name) ? matchNames(dirNode, t.name) : [t.name];
      if (!names.length) { print('Ningun archivo coincide con "' + t.name + '".', 'warn'); return; }

      var done = 0, freed = 0;
      names.forEach(function (n) {
        var real = GT.fs.findChildName(dirNode, n);
        if (real && dirNode.children[real].type === 'dir') {
          print('"' + real + '" es una carpeta: se borra con rd.', 'err');
          return;
        }
        var res = GT.fs.remove(t.dir, n);
        if (res.error) { fail(res); return; }
        done++;
        freed += res.freed;
        print('Eliminado: ' + res.name + '  (' + GT.fs.humanSize(res.freed) + ')', 'ok');
      });

      if (done) {
        if (done > 1) print(done + ' archivos eliminados, ' + GT.fs.humanSize(freed) + ' liberados.', 'dim');
        GT.audio.click();
      }
    }
  };
  COMMANDS.erase = COMMANDS.del;
  COMMANDS.rm = COMMANDS.del;

  /* "*.tmp" -> /^.*\.tmp$/i . Primero escapo todo lo que en un regex tiene
     significado propio (el punto, sobre todo: sin escapar, "*.tmp" tambien
     engancharia "xtmp") y despues convierto los dos comodines: * es
     "cualquier cantidad de caracteres" y ? es "uno solo". */
  function matchNames(dirNode, pattern) {
    var rx = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
                                     .replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return Object.keys(dirNode.children || {}).filter(function (k) {
      return dirNode.children[k].type !== 'dir' && rx.test(k);
    });
  }

  /* ---------- md / rd ---------- */
  COMMANDS.md = {
    desc: 'Crea una carpeta.',
    run: function (args) {
      if (!args.length) { print('Uso: md <carpeta>', 'warn'); return; }
      var t = splitTarget(args.join(' '));
      if (t.error) { fail(t); return; }
      var res = GT.fs.makeDir(t.dir, t.name);
      if (res.error) { fail(res); return; }
      print('Carpeta creada: ' + GT.fs.pathString(t.dir.concat(res.name)), 'ok');
      GT.audio.click();
    }
  };
  COMMANDS.mkdir = COMMANDS.md;

  COMMANDS.rd = {
    desc: 'Borra una carpeta.',
    run: function (args) {
      /* El /s se puede escribir antes o despues del nombre: lo saco de la
         lista de argumentos y me quedo con lo demas como ruta. */
      var recursive = args.some(function (a) { return a.toLowerCase() === '/s'; });
      var rest = args.filter(function (a) { return a.toLowerCase() !== '/s'; });
      if (!rest.length) { print('Uso: rd <carpeta>     (rd <carpeta> /s la borra con su contenido)', 'warn'); return; }

      var t = splitTarget(rest.join(' '));
      if (t.error) { fail(t); return; }
      var dirNode = GT.fs.getNode(root(), t.dir);
      var real = GT.fs.findChildName(dirNode, t.name);
      if (real && dirNode.children[real].type !== 'dir') {
        print('"' + real + '" es un archivo: se borra con del.', 'err');
        GT.audio.error();
        return;
      }
      /* No dejo borrar la carpeta donde estoy parado (ni una que la contiene):
         el prompt quedaria apuntando a un lugar que ya no existe. */
      var target = t.dir.concat(real || t.name).join('\\').toLowerCase();
      var here = cwd.join('\\').toLowerCase();
      if (here === target || here.indexOf(target + '\\') === 0) {
        print('No se puede borrar la carpeta en la que estas parado. Sali con "cd .." primero.', 'err');
        GT.audio.error();
        return;
      }

      var res = GT.fs.remove(t.dir, t.name, { recursive: recursive });
      if (res.error) { fail(res); return; }
      print('Carpeta eliminada: ' + res.name + '  (' + GT.fs.humanSize(res.freed) + ' liberados)', 'ok');
      GT.audio.click();
    }
  };
  COMMANDS.rmdir = COMMANDS.rd;

  /* ---------- ren ---------- */
  COMMANDS.ren = {
    desc: 'Cambia el nombre de un archivo o carpeta.',
    run: function (args) {
      if (args.length < 2) { print('Uso: ren <nombre actual> <nombre nuevo>', 'warn'); return; }
      var t = splitTarget(args[0]);
      if (t.error) { fail(t); return; }
      var res = GT.fs.rename(t.dir, t.name, args[1]);
      if (res.error) { fail(res); return; }
      print(res.from + '  ->  ' + res.name, 'ok');
      /* Cambiarle la extension a un archivo NO cambia lo que es: es la misma
         leccion de la doble extension, vista desde el otro lado. */
      if (res.node.type !== 'dir' && extOf(res.from) !== extOf(res.name)) {
        print('Ojo: cambiar la extension no convierte el archivo, solo cambia con que se intenta abrir.', 'dim');
      }
      GT.audio.click();
    }
  };
  COMMANDS.rename = COMMANDS.ren;

  function extOf(name) {
    var m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  /* ---------- copy / move ---------- */
  /* Las dos reciben  <origen> <destino>  y el destino puede ser una carpeta
     (el archivo conserva su nombre) o una ruta con nombre nuevo. Esta funcion
     resuelve esa ambiguedad para las dos:
       copy leeme.txt \Descargas          -> a C:\Descargas, se llama leeme.txt
       copy leeme.txt \Descargas\nota.txt -> a C:\Descargas, se llama nota.txt
       copy leeme.txt copia.txt           -> a la carpeta actual, copia.txt   */
  function resolveDest(arg) {
    var asDir = GT.fs.resolvePath(root(), cwd, arg);
    if (!asDir.error) return { dir: asDir.path, name: null };     // es una carpeta que existe
    if (asDir.error === 'bloqueado') return asDir;
    return splitTarget(arg);                                      // es carpeta + nombre nuevo
  }

  function transfer(op, args, verb) {
    if (args.length < 2) { print('Uso: ' + verb + ' <origen> <destino>', 'warn'); return; }
    var src = splitTarget(args[0]);
    if (src.error) { fail(src); return; }
    var dst = resolveDest(args[1]);
    if (dst.error) { fail(dst); return; }

    var res = op(src.dir, src.name, dst.dir, dst.name);
    if (res.error) { fail(res); return; }
    print('  ' + GT.fs.pathString(src.dir.concat(src.name)) + '  ->  ' +
          GT.fs.pathString(dst.dir.concat(res.name)), 'ok');
    GT.audio.click();
    return res;
  }

  COMMANDS.copy = {
    desc: 'Copia un archivo.',
    run: function (args) {
      var res = transfer(GT.fs.copy, args, 'copy');
      if (res) print('  1 archivo copiado (' + GT.fs.humanSize(res.node.size) + '). Quedan ' +
                     GT.fs.humanSize(GT.fs.free()) + ' libres.', 'dim');
    }
  };
  COMMANDS.cp = COMMANDS.copy;

  COMMANDS.move = {
    desc: 'Mueve un archivo o una carpeta.',
    run: function (args) { transfer(GT.fs.move, args, 'move'); }
  };
  COMMANDS.mv = COMMANDS.move;

  /* ---------- espacio ---------- */
  COMMANDS.espacio = {
    desc: 'Espacio usado y libre en el disco.',
    run: function () {
      var u = GT.fs.usage();
      /* Barra de 30 casilleros: los llenos son la parte proporcional al uso */
      var cells = 30;
      var full = Math.round(u.percent / 100 * cells);
      var cls = u.free <= 0 ? 'err' : (u.percent >= GT.CONFIG.DISK_WARN * 100 ? 'warn' : 'ok');

      print('');
      print(' Unidad C:  [WINTEC]', 'title');
      print('  Capacidad ....... ' + GT.fs.humanSize(u.capacity));
      print('  Usado ........... ' + GT.fs.humanSize(u.used) + '  (' + u.percent + '%)', cls);
      print('  Libre ........... ' + GT.fs.humanSize(u.free), cls);
      print('  [' + '#'.repeat(full) + '.'.repeat(cells - full) + ']', cls);
      print('');

      /* Lo que mas ocupa: el tamanio de cada carpeta de la raiz, de mayor a
         menor. Es por donde se empieza a buscar cuando falta lugar. */
      print(' Lo que mas ocupa:', 'dim');
      var rootNode = root();
      Object.keys(rootNode.children).map(function (k) {
        return { name: k, size: GT.fs.sizeOf(rootNode.children[k]) };
      }).sort(function (a, b) { return b.size - a.size; }).forEach(function (e) {
        print('  ' + pad(GT.fs.humanSize(e.size), 12) + '\\' + e.name);
      });

      var junk = GT.fs.junkBytes();
      if (junk > 0) {
        print('');
        print(' [!] ' + GT.fs.humanSize(junk) + ' de archivos temporales en ' +
              GT.fs.pathString(GT.fs.JUNK_DIR), 'warn');
        print('     No tienen datos utiles. Se borran con:  del *.tmp', 'dim');
      }
      print('');
    }
  };
  COMMANDS.df = COMMANDS.espacio;
  COMMANDS.chkdsk = COMMANDS.espacio;

  /* ---------- unlock ---------- */
  COMMANDS.unlock = {
    desc: 'Desbloquea una carpeta protegida.',
    run: function (args) {
      var node = GT.fs.getNode(root(), cwd);
      var lockedName = null;

      Object.keys(node.children || {}).forEach(function (k) {
        if (node.children[k].type === 'dir' && node.children[k].locked) lockedName = k;
      });

      if (!lockedName) {
        print('No hay ninguna carpeta bloqueada en ' + GT.fs.pathString(cwd), 'warn');
        return;
      }
      if (!args.length) {
        print('Uso: unlock <clave>', 'warn');
        print('Pista: ' + node.children[lockedName].hint, 'dim');
        return;
      }

      /* Comparo como STRING y no como numero a proposito: si el jugador
         escribe "45" entra, pero si escribe "101101" (el binario sin convertir)
         no, que es justo el error que el ejercicio quiere provocar. */
      var attempt = args[0].trim();
      if (attempt === node.children[lockedName].password) {
        node.children[lockedName].locked = false;
        print('');
        print('  CLAVE CORRECTA — 101101 (binario) = 45 (decimal)', 'ok');
        print('  Carpeta "' + lockedName + '" desbloqueada.', 'ok');
        print('');
        GT.audio.ok();
        GT.correct(60, 'clave correcta');
        GT.levels.complete('l1_unlock');
        GT.learn('Conversión binario → decimal: 101101₂ = 45₁₀.');
        if (GT.explorer) GT.explorer.refresh();
      } else {
        print('Clave incorrecta: "' + attempt + '"', 'err');
        print('Cada intento fallido activa el bloqueo del sistema (-3 integridad).', 'warn');
        GT.audio.error();
        GT.wrong(0, 'clave incorrecta');
        GT.damage(3, 'clave incorrecta');
      }
    }
  };

  /* ---------- ps ---------- */
  COMMANDS.ps = {
    desc: 'Lista los procesos activos.',
    run: function () {
      if (GT.state.level < 2) {
        print('El monitor de procesos todavia no esta habilitado.', 'warn');
        return;
      }
      var list = GT.procs.list();
      print('');
      print(' ' + pad('PID', 8) + pad('NOMBRE', 24) + pad('CPU', 7) + pad('RAM', 10) + 'FIRMA', 'title');
      print(' ' + '-'.repeat(62), 'dim');
      /* Con el sistema tildado, ps marca al programa que quedo colgado. A
         proposito NO dice quien lo bloquea: eso lo averigua diag. */
      var frozen = GT.sys && GT.sys.isFrozen() ? GT.state.sys.frozen : null;
      list.forEach(function (p) {
        var hung = frozen && frozen.victim && frozen.victim.pid === p.pid;
        print(' ' + pad(p.pid, 8) + pad(p.name, 24) + pad(p.cpu + '%', 7) +
              pad(p.ram + ' MB', 10) + (p.signed ? 'WinTEC Corp.' : 'SIN FIRMA') +
              (hung ? '   << NO RESPONDE' : ''),
              hung ? 'err' : p.signed ? '' : 'warn');
      });
      print('');
      print(' Usa "kill <pid>" para terminar un proceso.', 'dim');
    }
  };
  COMMANDS.tasklist = COMMANDS.ps;

  /* ---------- kill ---------- */
  COMMANDS.kill = {
    desc: 'Termina un proceso.',
    run: function (args) {
      if (GT.state.level < 2) {
        print('No tenes permisos para terminar procesos todavia.', 'warn');
        return;
      }
      if (!args.length) { print('Uso: kill <pid>', 'warn'); return; }

      var pid = parseInt(args[0], 10);
      if (isNaN(pid)) { print('El PID debe ser un numero.', 'err'); GT.audio.error(); return; }

      var res = GT.procs.kill(pid);
      if (res.status === 'not-found') print('No existe un proceso con PID ' + pid + '.', 'err');
      else if (res.status === 'protected') print('Acceso denegado: proceso critico del sistema.', 'err');
      else if (res.status === 'malicious') print('Proceso ' + res.name + ' (PID ' + pid + ') terminado.', 'ok');
      else print('Proceso ' + res.name + ' (PID ' + pid + ') terminado. Era legitimo...', 'err');
    }
  };

  /* ---------- purge ---------- */
  COMMANDS.purge = {
    desc: 'Purga final del malware.',
    run: function () {
      if (GT.state.level < GT.levels.PURGE_LEVEL) {
        print('purge: el nucleo del malware todavia esta protegido.', 'err');
        print('Primero hay que contener los procesos y cortar la via de entrada.', 'dim');
        GT.audio.error();
        return;
      }
      /* El nucleo se reinstala solo mientras le quede de donde: la purga
         recien arranca cuando el jugador le corto esas vias con las
         herramientas de mantenimiento (ver js/sysutils.js). */
      var blockers = GT.sys.purgeBlockers();
      if (blockers.length) {
        print('purge: el nucleo se vuelve a instalar solo. Todavia:', 'err');
        blockers.forEach(function (b) { print('   - ' + b, 'warn'); });
        print('Cortale esas vias y volve a intentar.', 'dim');
        GT.audio.error();
        return;
      }
      print('Iniciando secuencia de purga...', 'ok');
      GT.boss.open();
    }
  };

  /* ---------- objetivos ---------- */
  COMMANDS.objetivos = {
    desc: 'Muestra los objetivos del nivel.',
    run: function () {
      print('');
      print('OBJETIVOS DEL NIVEL ' + GT.state.level, 'title');
      GT.state.objectives.forEach(function (o) {
        var mark = o.done ? '[X]' : '[ ]';
        var extra = (o.total ? '  (' + o.count + '/' + o.total + ')' : '');
        print('  ' + mark + ' ' + o.text + extra, o.done ? 'ok' : '');
      });
      print('');
    }
  };
  COMMANDS.obj = COMMANDS.objetivos;

  /* ---------- pista ---------- */
  COMMANDS.pista = {
    desc: 'Pide una pista.',
    run: function () {
      var hint = GT.levels.getHint();
      if (!hint) { print('No hay pistas para este momento.', 'dim'); return; }
      GT.state.hintsUsed++;
      GT.addScore(-GT.CONFIG.HINT_COST, 'pista usada');
      print('');
      print('  PISTA (-' + GT.CONFIG.HINT_COST + ' pts): ' + hint, 'warn');
      print('');
      GT.audio.click();
    }
  };
  COMMANDS.hint = COMMANDS.pista;

  /* ---------- utilidades ---------- */
  COMMANDS.cls = { desc: 'Limpia la pantalla.', run: function () { out.innerHTML = ''; } };
  COMMANDS.clear = COMMANDS.cls;

  COMMANDS.whoami = {
    desc: 'Usuario actual.',
    run: function () {
      print('wintec\\estudiante');
      print('Grupo: Usuarios (sin privilegios de administrador)', 'dim');
    }
  };

  COMMANDS.ver = {
    desc: 'Version del sistema.',
    run: function () {
      print('');
      print('WinTEC 95  [Version 4.02.TEC]', 'info');
      print('Integridad del sistema: ' + Math.round(GT.state.integrity) + '%',
            GT.state.integrity < 40 ? 'err' : '');
      print('Nivel de infeccion: ' + GT.getInfection() + '%', 'warn');
      print('');
    }
  };

  COMMANDS.ping = {
    desc: 'Prueba de red.',
    run: function (args) {
      var host = args[0] || 'campus.tec.edu.ar';
      print('Haciendo ping a ' + host + ' con 32 bytes de datos:');
      for (var i = 0; i < 3; i++) {
        print('Respuesta desde 10.0.0.' + GT.rand(2, 250) + ': bytes=32 tiempo=' + GT.rand(4, 90) + 'ms TTL=64');
      }
      if (GT.state.level >= 1) {
        print('Respuesta desde 0.0.0.0: t e   e s t o y   m i r a n d o', 'evil');
      }
    }
  };

  COMMANDS.exit = {
    desc: 'Cierra la terminal.',
    run: function () { GT.ui.closeWindow(WIN_ID); }
  };

  /* Huevos de pascua del malware */
  COMMANDS.glitch = {
    desc: '',
    run: function () {
      print('¿Me buscabas?', 'evil');
      GT.audio.glitch();
      GT.ui.shake();
    }
  };

  /* ============================================================
     Ejecucion
     ============================================================ */
  /* EL INTERPRETE. Toda linea que el jugador escribe entra por aca.
     Pasos: 1) hago eco de lo escrito, 2) lo guardo en el historial,
            3) lo parseo en comando + argumentos, 4) lo busco y lo ejecuto. */
  term.run = function (raw) {
    /* Si la carpeta donde estaba parado dejo de existir (la movieron o la
       borraron desde el Explorador), vuelvo a la raiz antes de hacer nada:
       todos los comandos dan por hecho que cwd apunta a una carpeta real. */
    if (!GT.fs.getNode(root(), cwd)) { cwd = []; updatePrompt(); }

    var line = String(raw).trim();
    print(GT.fs.pathString(cwd) + '>' + line, 'cmd');   // eco, como la consola real
    if (!line) return;                                  // Enter en vacio: nada

    /* unshift mete al PRINCIPIO del array: asi history[0] siempre es el
       comando mas reciente y la flecha ARRIBA es simplemente avanzar el
       indice. El pop() de la punta mantiene el historial en 40 y evita que
       crezca para siempre. */
    history.unshift(line);
    if (history.length > 40) history.pop();
    histIdx = -1;                                        // reseteo el cursor

    /* Parseo minimo: corto por espacios (el regex \s+ agrupa varios espacios
       seguidos como uno, asi "dir     algo" no genera argumentos vacios).
         parts[0]        -> el comando, siempre en minuscula
         parts.slice(1)  -> el resto, los argumentos
       No implemento comillas ni escapes: para el alcance del juego, los
       argumentos que necesitan espacios los vuelvo a unir con args.join(' '). */
    var parts = line.split(/\s+/);
    var name = parts[0].toLowerCase();
    var args = parts.slice(1);

    var cmd = COMMANDS[name];
    if (!cmd) {
      print("'" + parts[0] + "' no se reconoce como un comando interno o externo.", 'err');
      print('Escribi "help" para ver la lista de comandos.', 'dim');
      GT.audio.error();
      return;
    }

    for (var g = 0; g < guards.length; g++) {
      var veto = guards[g](name, args);
      if (veto) {
        print(veto, 'err');
        GT.audio.error();
        return;
      }
    }

    cmd.run(args);
  };

  /* ============================================================
     Ventana
     ============================================================ */
  term.open = function () {
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); focusInput(); return; }

    var body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;height:100%;';
    body.innerHTML =
      '<div class="term-out" id="term-out"></div>' +
      '<div class="term-input-row">' +
        '<span class="term-prompt" id="term-prompt">C:\\&gt;</span>' +
        '<input class="term-input" id="term-input" spellcheck="false" autocomplete="off">' +
      '</div>';

    GT.ui.openWindow({
      id: WIN_ID,
      title: 'C:\\WINTEC\\system32\\cmd.exe',
      icon: GT.ui.icons.terminal, asset: 'app.terminal',
      className: 'win-terminal',
      width: 660, height: 400,
      x: 120, y: 60,
      body: body,
      onFocus: focusInput,
      onClose: function () {
        out = null; input = null; promptEl = null;
      }
    });

    /* Recien DESPUES de que openWindow inserto el body en el DOM puedo pedir
       los elementos por id: antes de eso todavia no existen en el documento y
       getElementById devolveria null. */
    out = document.getElementById('term-out');
    input = document.getElementById('term-input');
    promptEl = document.getElementById('term-prompt');

    updatePrompt();
    banner();

    input.addEventListener('keydown', onKey);
    /* Click en cualquier parte de la ventana = foco al input, como en una
       consola de verdad. Dos detalles finos:
         - si hay texto seleccionado me abstengo, porque robar el foco le
           cancelaria la seleccion al que esta copiando;
         - el setTimeout(...,0) posterga el focus al final de la cola de
           eventos: si lo hiciera ya mismo, el mousedown todavia en curso me
           sacaria el foco inmediatamente despues. */
    body.addEventListener('mousedown', function (e) {
      if (window.getSelection().toString()) return;   // no robar el foco al copiar
      setTimeout(focusInput, 0);
    });

    focusInput();
  };

  function focusInput() { if (input) input.focus(); }

  /* Teclado del input. Enter ejecuta; las flechas navegan el historial.
     Recordar: history[0] es lo MAS reciente, entonces
       ARRIBA  = histIdx++ (voy hacia comandos mas viejos)
       ABAJO   = histIdx-- (vuelvo hacia los mas nuevos, hasta -1 = input vacio)
     El preventDefault en las flechas evita el comportamiento por defecto del
     input, que es mandar el cursor al principio/final del texto. */
  function onKey(e) {
    if (e.key === 'Enter') {
      var v = input.value;
      input.value = '';
      term.run(v);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < history.length - 1) histIdx++;
      input.value = history[histIdx] || '';
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) { histIdx--; input.value = history[histIdx]; }
      else { histIdx = -1; input.value = ''; }
      return;
    }
    GT.audio.key();
  }

  function banner() {
    print('WinTEC 95  [Version 4.02.TEC]', 'dim');
    print('(c) Corporacion WinTEC. Todos los derechos reservados.', 'dim');
    print('');
    print('Escribi  help  para ver los comandos disponibles.', 'info');
    print('');
  }

  term.reset = function () {
    cwd = [];
    history = [];
    histIdx = -1;
    out = null; input = null; promptEl = null;
  };

  /** Permite que otros modulos escriban en la terminal si esta abierta.
      Lo usan el hacker y el malware para "hablar" desde adentro de la consola.
      Si la ventana esta cerrada, out es null y el mensaje se descarta en
      silencio: prefiero perder una linea de ambientacion antes que romper el
      juego con un error de null. */
  term.notify = function (text, cls) {
    if (out) print(text, cls || 'evil');
  };

})(window, document);
