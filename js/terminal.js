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
      print('');
      var rows = [
        ['help',            'lista de comandos'],
        ['dir',             'muestra el contenido de la carpeta actual'],
        ['cd <carpeta>',    'entra a una carpeta  ("cd .." vuelve atras)'],
        ['type <archivo>',  'muestra el contenido de un archivo de texto'],
        ['scan <archivo>',  'analiza un archivo en busca de amenazas'],
        ['unlock <clave>',  'desbloquea una carpeta protegida'],
        ['ps',              'lista los procesos en ejecucion'],
        ['kill <pid>',      'termina un proceso por su identificador'],
        ['purge',           'intenta purgar el malware (solo al final)'],
        ['objetivos',       'muestra los objetivos del nivel actual'],
        ['pista',           'pide una pista (cuesta ' + GT.CONFIG.HINT_COST + ' puntos)'],
        ['cls',             'limpia la pantalla'],
        ['whoami / ver',    'informacion del usuario y del sistema']
      ];
      rows.forEach(function (r) {
        print('  ' + pad(r[0], 18) + r[1]);
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
  function locateFile(name) {
    var node = GT.fs.getNode(root(), cwd);
    var real = GT.fs.findChildName(node, name);

    if (!real) {
      print('No se encuentra el archivo "' + name + '" en ' + GT.fs.pathString(cwd), 'err');
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
    return { name: real, node: child };
  }

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
      list.forEach(function (p) {
        print(' ' + pad(p.pid, 8) + pad(p.name, 24) + pad(p.cpu + '%', 7) +
              pad(p.ram + ' MB', 10) + (p.signed ? 'WinTEC Corp.' : 'SIN FIRMA'),
              p.signed ? '' : 'warn');
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
      if (GT.state.level < 4) {
        print('purge: el nucleo del malware todavia esta protegido.', 'err');
        print('Primero hay que contener los procesos y cortar la via de entrada.', 'dim');
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
      print('WinTEC XP  [Version 5.1.2600]', 'info');
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
      icon: GT.ui.icons.terminal,
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
    print('WinTEC XP  [Version 5.1.2600]', 'dim');
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
