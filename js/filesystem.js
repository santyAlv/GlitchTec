/* ============================================================
   Glitch.TEC — sistema de archivos virtual
   Arbol en memoria que comparten la Terminal y el Explorador.
   Aca vive el contenido educativo del Nivel 1 (doble extension,
   lectura de logs y conversion binaria).
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec;
  var fs = GT.fs = {};

  /* COMO ESTA ARMADO EL ARBOL (me lo anoto porque toda la terminal depende
     de entender esta forma):

       nodo carpeta = { type:'dir',  name, children: { 'nombre': nodo, ... } }
       nodo archivo = { type:'file', name, size, content, ... }

     Es un objeto dentro de otro objeto dentro de otro: la misma estructura
     recursiva de un disco real. Una RUTA la represento como un array de
     nombres: ['Sistema','cuarentena'] es C:\Sistema\cuarentena. Elegi array
     y no string porque asi "subir un nivel" es un pop() y "entrar" es un
     push(), sin andar cortando strings con split cada dos lineas.

     Las banderas que le cuelgo a los nodos son las que mueven el juego:
       locked/password -> carpeta con clave (nivel 1)
       malicious/threat -> lo que encuentra el comando scan
       signed           -> firma digital, la pista educativa real
       scanned          -> ya lo analice (cambia el icono en el explorador)
       system           -> archivo del sistema: no se borra ni se renombra
       objective        -> lo necesita un objetivo: no se toca hasta cumplirlo
       lockedBy         -> pid del proceso que lo tiene abierto ("en uso")
       junk             -> basura que escribio el malware para llenar el disco */
  fs.ROOT_NAME = 'C:';

  /* Clave del directorio en cuarentena: 101101 binario = 45 decimal */
  fs.QUARANTINE_PASSWORD = '45';

  /** Construye un arbol NUEVO en cada partida.
      Es una funcion y no una constante a proposito: el juego MODIFICA el arbol
      mientras se juega (desbloquea la cuarentena, marca archivos escaneados).
      Si fuera un objeto fijo compartido, la segunda partida arrancaria con la
      carpeta ya desbloqueada de la partida anterior. Devolviendo un objeto
      recien creado cada vez, cada partida empieza realmente de cero. */
  fs.create = function () {
    return {
      type: 'dir', name: 'C:',
      children: {

        /* El sistema operativo. No tiene nada para leer: esta para que el
           disco arranque ocupado como uno de verdad (ver la cuota mas abajo)
           y para que haya algo que el sistema NO deja borrar. */
        'WINTEC': {
          type: 'dir', name: 'WINTEC', system: true, children: {
            'kernel.sys': {
              type: 'file', name: 'kernel.sys', kind: 'sys', size: 100663296, system: true,
              info: 'Nucleo de WinTEC 95. Archivo del sistema.',
              content: '[Binario del sistema]\r\n'
            },
            'sistema.cab': {
              type: 'file', name: 'sistema.cab', kind: 'sys', size: 1268776960, system: true,
              info: 'Archivos de instalacion de WinTEC 95.',
              content: '[Archivo comprimido del sistema]\r\n'
            },
            'memoria.swp': {
              type: 'file', name: 'memoria.swp', kind: 'sys', size: 268435456, system: true,
              info: 'Memoria virtual: lo que no entra en la RAM se guarda aca.',
              content: '[Archivo de intercambio]\r\n'
            }
          }
        },

        'Documentos': {
          type: 'dir', name: 'Documentos', children: {

            'leeme.txt': {
              type: 'file', name: 'leeme.txt', kind: 'txt', size: 1204, objective: 'l1_note',
              info: 'Notas personales del usuario.',
              content:
                'notas rapidas - NO BORRAR\r\n' +
                '=========================\r\n\r\n' +
                '- jueves: entregar el TP de Redes.\r\n' +
                '- ANOTAR: me pasaron una foto por chat "de un companiero".\r\n' +
                '  Pesaba 4 MB. Le hice doble click y no se abrio ninguna imagen:\r\n' +
                '  solo parpadeo una ventanita negra un segundo y listo.\r\n' +
                '- Desde ese dia la maquina anda lentisima y se abren ventanas solas.\r\n' +
                '- El profe explico que Windows OCULTA la extension real de los\r\n' +
                '  archivos. Un archivo que se llama "algo.jpg" en realidad puede\r\n' +
                '  ser "algo.jpg.exe", o sea un PROGRAMA disfrazado de imagen.\r\n\r\n' +
                '>> Buscar en la carpeta Descargas si quedo algo raro. <<\r\n'
            },

            'tp_redes.docx': {
              type: 'file', name: 'tp_redes.docx', kind: 'doc', size: 48120,
              info: 'Documento de texto. Sin riesgo.',
              content: '[Este formato no se puede mostrar en la terminal]\r\n' +
                       'Use el Explorador para abrir documentos .docx.\r\n'
            },

            'contrasenias.txt': {
              type: 'file', name: 'contrasenias.txt', kind: 'txt', size: 340,
              info: 'ATENCION: guardar claves en texto plano es una mala practica.',
              content:
                'campus: estudiante2024\r\n' +
                'mail:   estudiante2024\r\n' +
                'banco:  estudiante2024\r\n\r\n' +
                '(guardar contrasenias en un .txt sin cifrar es exactamente\r\n' +
                ' lo que un infostealer busca al entrar a tu equipo)\r\n'
            }
          }
        },

        'Descargas': {
          type: 'dir', name: 'Descargas', children: {

            'apuntes_seguridad.pdf': {
              type: 'file', name: 'apuntes_seguridad.pdf', kind: 'doc', size: 903456,
              info: 'PDF de la catedra. Firma verificada.',
              content: '[PDF] Unidad 3: Malware y vectores de ataque.\r\n'
            },

            'instalador_java.exe': {
              type: 'file', name: 'instalador_java.exe', kind: 'exe', size: 62881792,
              info: 'Ejecutable con firma digital valida (Oracle).',
              signed: true,
              content: '[Binario ejecutable]\r\n'
            },

            'foto_carnet.jpg': {
              type: 'file', name: 'foto_carnet.jpg', kind: 'img', size: 184320,
              info: 'Imagen JPEG legitima.',
              content: '[Imagen JPEG 640x480]\r\n'
            },

            'foto_vacaciones.jpg.exe': {
              type: 'file', name: 'foto_vacaciones.jpg.exe', kind: 'exe', size: 4194304, objective: 'l1_scan',
              info: 'Doble extension: dice .jpg pero termina en .exe.',
              signed: false,
              malicious: true,
              threat: {
                name: 'Trojan.Dropper.GLTC',
                type: 'Troyano (dropper)',
                lesson: 'DOBLE EXTENSION',
                detail:
                  'El nombre visible termina en .jpg pero la extension REAL es .exe.\r\n' +
                  'Windows oculta las extensiones conocidas, asi que el usuario ve\r\n' +
                  '"foto_vacaciones.jpg" y cree estar abriendo una imagen.\r\n' +
                  'En realidad ejecuta un programa que instala el resto del malware.'
              },
              content: '[Binario ejecutable disfrazado de imagen]\r\n'
            }
          }
        },

        'Sistema': {
          type: 'dir', name: 'Sistema', children: {

            'registro.log': {
              type: 'file', name: 'registro.log', kind: 'log', size: 2210, system: true,
              info: 'Registro de eventos del sistema. Contiene la clave de cuarentena.',
              content:
                '[12:04:11] INFO  Servicio de cuarentena iniciado.\r\n' +
                '[12:04:12] INFO  Politica: acceso restringido por clave numerica.\r\n' +
                '[12:06:40] INFO  Usuario "estudiante" abrio \\Descargas\\foto_vacaciones.jpg.exe\r\n' +
                '[12:06:41] WARN  Proceso hijo sin firma digital creado desde \\Descargas\r\n' +
                '[12:07:55] WARN  Escritura no autorizada en \\Sistema\\cuarentena\r\n' +
                '[12:08:02] ERROR 1 objeto movido a cuarentena: payload.bin\r\n' +
                '[12:08:03] DEBUG clave_cuarentena = bin2dec(101101)\r\n' +
                '[12:08:04] DEBUG (recordatorio: convertir ese binario a decimal)\r\n' +
                '[12:09:17] ERROR El servicio de cuarentena dejo de responder.\r\n' +
                '[12:09:18] ????  h o l a   e s t u d i a n t e\r\n'
            },

            'config.sys': {
              type: 'file', name: 'config.sys', kind: 'sys', size: 512, system: true,
              info: 'Archivo de configuracion del sistema.',
              content: 'FILES=64\r\nBUFFERS=32\r\nSHELL=C:\\WINTEC\\command.com\r\n'
            },

            'cuarentena': {
              type: 'dir', name: 'cuarentena',
              locked: true,
              password: '45',
              hint: 'La clave esta en \\Sistema\\registro.log (linea DEBUG).',
              children: {
                'payload.bin': {
                  type: 'file', name: 'payload.bin', kind: 'bin', size: 1048576, objective: 'l1_payload',
                  info: 'Carga util aislada por el antivirus.',
                  malicious: true,
                  threat: {
                    name: 'Glitch.Core',
                    type: 'Nucleo del malware',
                    lesson: 'PERSISTENCIA',
                    detail:
                      'Este es el nucleo que el troyano descargo e instalo.\r\n' +
                      'Se copia al sistema y crea tareas programadas para volver\r\n' +
                      'a ejecutarse en cada arranque: eso se llama PERSISTENCIA.\r\n' +
                      'Borrar el archivo original no alcanza; hay que matar los\r\n' +
                      'procesos que ya estan corriendo en memoria.'
                  },
                  content: '[Binario cifrado - contenido ilegible]\r\n'
                }
              }
            }
          }
        },

        'Usuarios': {
          type: 'dir', name: 'Usuarios', children: {
            'estudiante': {
              type: 'dir', name: 'estudiante', children: {
                'historial.txt': {
                  type: 'file', name: 'historial.txt', kind: 'txt', size: 690,
                  info: 'Historial de descargas del navegador.',
                  content:
                    'HISTORIAL DE DESCARGAS\r\n' +
                    '----------------------\r\n' +
                    '10:12  apuntes_seguridad.pdf   campus.tec.edu.ar        OK\r\n' +
                    '11:48  instalador_java.exe     java.com                 OK\r\n' +
                    '12:05  foto_vacaciones.jpg.exe cdn-free-fotos.top       ???\r\n' +
                    '                              ^ dominio desconocido\r\n'
                }
              }
            }
          }
        }
      }
    };
  };

  /* ============================================================
     Navegacion
     ============================================================ */

  /** ['Documentos'] -> "C:\Documentos" */
  fs.pathString = function (pathArr) {
    return fs.ROOT_NAME + (pathArr.length ? '\\' + pathArr.join('\\') : '\\');
  };

  /** Devuelve el nodo en la ruta indicada (o null).
      Camina el arbol de a un escalon: arranco en la raiz y en cada vuelta me
      "meto" un nivel mas adentro reasignando node. Si en el camino falta un
      hijo, corto y devuelvo null (ruta invalida). Es la version iterativa de
      lo que uno escribiria como recursion. */
  fs.getNode = function (root, pathArr) {
    var node = root;
    for (var i = 0; i < pathArr.length; i++) {
      if (!node.children || !node.children[pathArr[i]]) return null;
      node = node.children[pathArr[i]];
    }
    return node;
  };

  /** Busca un hijo sin distinguir mayusculas. Devuelve el nombre real o null.
      ¿Por que existe esta funcion pudiendo hacer children[name] directo?
      Porque las claves de un objeto JS SI distinguen mayusculas, pero la
      consola de Windows NO: el jugador escribe "type LEEME.TXT" y tiene que
      andar igual. Entonces recorro las claves comparando todo en minuscula y
      devuelvo el nombre REAL (con sus mayusculas originales), que es el que
      despues uso para indexar el objeto y para mostrar en pantalla. */
  fs.findChildName = function (dirNode, name) {
    if (!dirNode || !dirNode.children) return null;
    var target = String(name).toLowerCase();
    var keys = Object.keys(dirNode.children);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === target) return keys[i];
    }
    return null;
  };

  /**
   * Resuelve un argumento de `cd`. Soporta ".", "..", "\", rutas con "\"
   * y nombres sueltos. Devuelve { path } o { error }.
   */
  /* EL ALGORITMO MAS FINO DEL ARCHIVO: interpretar lo que el jugador escribe
     despues de "cd". Tiene que bancar   cd Documentos  /  cd ..  /  cd .  /
     cd \Sistema\cuarentena  /  cd C:\Descargas  /  cd Sistema/cuarentena.

     La idea: no valido el string entero de una, lo parto en pedazos y proceso
     un pedazo por vez sobre una copia de la ruta actual. Si algo falla, no
     toco nada y devuelvo el error; la ruta real del jugador solo cambia si
     TODO el recorrido salio bien (o sea: la operacion es atomica).

     Devuelve  { path: [...] }  si anduvo, o  { error: '...', name: '...' }
     con el motivo. Es el patron "en vez de tirar excepcion, devuelvo un objeto
     que dice que paso": la terminal despues traduce cada error a su mensaje. */
  fs.resolvePath = function (root, current, arg) {
    /* Normalizo las barras: acepto / como \ para que no sea una trampa boba,
       y parto en segmentos. "Sistema\cuarentena" -> ['Sistema','cuarentena'] */
    var parts = String(arg).replace(/\//g, '\\').split('\\');
    /* .slice() = COPIA del array. Trabajo sobre la copia justamente para poder
       abandonar sin haber roto nada si aparece un error a mitad de camino. */
    var path = current.slice();

    /* ¿Es ruta absoluta? Dos casos: empieza con \ (y entonces el primer
       segmento queda vacio) o empieza con "C:" (el /i del regex hace que
       tambien valga "c:"). En los dos casos vuelvo a la raiz y descarto ese
       primer pedazo con shift(). Si no, es relativa y sigo desde donde estoy. */
    if (parts[0] === '' || /^c:$/i.test(parts[0])) {   // ruta absoluta
      path = [];
      parts.shift();
    }

    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '' || p === '.') continue;     // "." o barras dobles: no mueven

      if (p === '..') {                        // subir un nivel...
        if (path.length) path.pop();           // ...salvo que ya este en C:\
        continue;
      }

      /* Bajar un nivel: releo el nodo donde estoy parado AHORA (ojo: "path"
         cambio en las vueltas anteriores del for, por eso lo recalculo cada
         vez en lugar de guardarlo afuera). */
      var node = fs.getNode(root, path);
      var real = fs.findChildName(node, p);
      if (!real) return { error: 'no-existe', name: p };

      var child = node.children[real];
      if (child.type !== 'dir') return { error: 'no-es-dir', name: real };
      /* La carpeta con clave: devuelvo tambien el nodo para que la terminal
         pueda mostrar su pista sin tener que ir a buscarlo de nuevo. */
      if (child.locked) return { error: 'bloqueado', name: real, node: child };

      path.push(real);                         // recien aca "entro" de verdad
    }

    return { path: path };
  };

  /** Tamanio legible para humanos. */
  fs.humanSize = function (bytes) {
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / (1024 * 1048576)).toFixed(2) + ' GB';
  };

  /** Busca recursivamente todos los archivos maliciosos (para verificaciones).
      Recorrido en profundidad clasico sobre el arbol:
        - CASO BASE: si el nodo es un archivo, lo evaluo y corto.
        - CASO RECURSIVO: si es carpeta, me llamo a mi mismo por cada hijo.
      "acc" es el acumulador: el mismo array viaja por toda la recursion y cada
      llamada le agrega lo que encuentra. El  acc = acc || []  del principio
      permite invocarla de afuera sin pasarle nada (la primera llamada lo crea,
      las internas lo reciben ya hecho). */
  fs.findMalicious = function (node, path, acc) {
    acc = acc || [];
    path = path || [];
    if (node.type === 'file') {
      if (node.malicious) acc.push({ node: node, path: path });
      return acc;
    }
    Object.keys(node.children || {}).forEach(function (k) {
      fs.findMalicious(node.children[k], path.concat(k), acc);
    });
    return acc;
  };

  /** Detecta doble extension: nombre con dos puntos y final ejecutable.
      Esta es LA funcion educativa del nivel 1, asi que desarmo el regex:

        /\.([a-z0-9]+)\.([a-z0-9]+)$/
          \.          un punto literal (con \ porque el punto pelado significa
                      "cualquier caracter")
          ([a-z0-9]+) grupo 1: la extension FALSA, la que ve el usuario (jpg)
          \.          otro punto
          ([a-z0-9]+) grupo 2: la extension REAL, la que ejecuta Windows (exe)
          $           anclado al final del nombre

      En "foto_vacaciones.jpg.exe" -> m[1]='jpg', m[2]='exe'.
      Pero no alcanza con tener dos puntos ("apuntes.v2.pdf" es inofensivo):
      lo peligroso es que la extension REAL sea ejecutable, por eso despues
      pregunto si m[2] esta en la lista negra. indexOf devuelve -1 cuando no
      encontro nada, de ahi el "!== -1" para leerlo como booleano. */
  fs.hasDoubleExtension = function (name) {
    var m = name.toLowerCase().match(/\.([a-z0-9]+)\.([a-z0-9]+)$/);
    if (!m) return false;
    return ['exe', 'bat', 'cmd', 'scr', 'com', 'vbs', 'js'].indexOf(m[2]) !== -1;
  };

  /* ============================================================
     Almacenamiento: cuota de disco
     ============================================================ */
  /* La unidad C: tiene un tamanio fijo (GT.CONFIG.DISK_CAPACITY) y cada
     archivo ocupa lo que dice su "size". El espacio usado NO se guarda en
     ningun lado: se calcula sumando el arbol cada vez que hace falta. Un
     contador aparte habria que mantenerlo al dia en cada alta, cada baja y
     cada cambio de tamanio, y el dia que me olvide de uno el disco mentiria.
     Sumar un arbol de treinta nodos no cuesta nada. */

  function rootNode() { return GT.state.fsRoot; }

  var fullFor = 0;        // segundos acumulados con el disco lleno
  var sinceReport = 0;    // segundos desde el ultimo aviso 'disk'

  /** Deja la unidad montada en el estado de la partida (GT.state.fsRoot y
      GT.state.disk). Lo llama game.js al empezar. */
  fs.mount = function () {
    GT.state.fsRoot = fs.create();
    GT.state.disk = { capacity: GT.CONFIG.DISK_CAPACITY, level: 'ok' };
    fullFor = 0;
    sinceReport = 0;
  };

  /** Bytes que ocupa un nodo: su tamanio si es un archivo, o la suma de todo
      lo que tiene adentro si es una carpeta (recursivo). */
  fs.sizeOf = function (node) {
    if (!node) return 0;
    if (node.type !== 'dir') return node.size || 0;
    var total = 0;
    Object.keys(node.children || {}).forEach(function (k) { total += fs.sizeOf(node.children[k]); });
    return total;
  };

  fs.capacity = function () { return GT.state.disk ? GT.state.disk.capacity : 0; };
  fs.used = function () { return fs.sizeOf(rootNode()); };
  fs.free = function () { return Math.max(0, fs.capacity() - fs.used()); };

  /** Todo junto, para el comando "espacio" y la barra del Explorador. */
  fs.usage = function () {
    var cap = fs.capacity();
    var used = fs.used();
    return {
      capacity: cap,
      used: used,
      free: Math.max(0, cap - used),
      percent: cap ? Math.min(100, Math.round(used / cap * 100)) : 0
    };
  };

  /** Recorre el arbol entero llamando a fn(nodo, ruta, nombre) por cada uno. */
  fs.walk = function (node, path, fn) {
    Object.keys(node.children || {}).forEach(function (k) {
      var child = node.children[k];
      fn(child, path, k);
      if (child.type === 'dir') fs.walk(child, path.concat(k), fn);
    });
  };

  /* ============================================================
     Almacenamiento: manipulacion de archivos
     ============================================================ */
  /* Todas las operaciones siguen el mismo contrato que resolvePath: no tiran
     excepciones, devuelven  { ok: true, ... }  o  { error: 'codigo', name }.
     La Terminal y el Explorador llaman a ESTAS funciones y cada uno muestra
     el resultado a su manera, asi las reglas (que se puede borrar, cuando no
     hay lugar) estan en un solo lado y las dos interfaces no pueden opinar
     distinto. Cada cambio se avisa por el bus con el evento 'fs'. */

  /** Los caracteres que Windows no acepta en un nombre de archivo. */
  fs.isValidName = function (name) {
    name = String(name === undefined ? '' : name);
    return name.length > 0 && name.length <= 64 && name.trim() === name &&
           name !== '.' && name !== '..' && !/[\\\/:*?"<>|]/.test(name);
  };

  var KINDS = {
    txt: 'txt', ini: 'txt', cfg: 'txt', log: 'log', dmp: 'log',
    doc: 'doc', docx: 'doc', pdf: 'doc',
    jpg: 'img', png: 'img', gif: 'img', bmp: 'img',
    exe: 'exe', com: 'exe', bat: 'exe', bin: 'bin', sys: 'sys',
    zip: 'zip', rar: 'rar', mp3: 'mp3', wav: 'wav', tmp: 'tmp'
  };

  /** Tipo de archivo segun su extension REAL (la ultima). */
  fs.kindOf = function (name) {
    var m = String(name).toLowerCase().match(/\.([a-z0-9]+)$/);
    return (m && KINDS[m[1]]) || 'doc';
  };

  function objectivePending(id) {
    var o = GT.levels && GT.levels.find(id);
    return !!o && !o.done;
  }

  /* ¿Se puede sacar este nodo de donde esta (borrarlo, moverlo, renombrarlo)?
     Devuelve null si se puede, o el motivo por el que no. El orden va de lo
     mas grave a lo mas circunstancial. */
  function blocked(node, name) {
    if (node.system) return { error: 'protegido', name: name };
    if (node.type === 'dir' && node.locked) return { error: 'bloqueado', name: name, node: node };
    if (node.objective && objectivePending(node.objective)) return { error: 'necesario', name: name };
    /* "En uso": igual que en Windows, un archivo que un proceso tiene abierto
       no se puede borrar. Es lo que obliga a matar primero el proceso que
       escribe la basura y recien despues limpiar. */
    var owner = node.lockedBy && GT.procs && GT.procs.get(node.lockedBy);
    if (owner) return { error: 'en-uso', name: name, by: owner };
    return null;
  }

  /* Lo mismo, pero mirando tambien todo lo que hay adentro de una carpeta:
     no se puede borrar una carpeta que contiene un archivo intocable. */
  function blockedDeep(node, name) {
    var b = blocked(node, name);
    if (b || node.type !== 'dir') return b;
    var keys = Object.keys(node.children || {});
    for (var i = 0; i < keys.length; i++) {
      b = blockedDeep(node.children[keys[i]], keys[i]);
      if (b) return b;
    }
    return null;
  }

  function dirAt(path) {
    var node = fs.getNode(rootNode(), path);
    return (node && node.type === 'dir') ? node : null;
  }

  function noDir(path) {
    return { error: 'no-existe', name: path.length ? path[path.length - 1] : fs.ROOT_NAME };
  }

  /** Crea un archivo, o lo pisa si ya existe. props: { size, content, ... }.
      Si no viene size, pesa lo que mide su contenido. */
  fs.writeFile = function (path, name, props) {
    var dir = dirAt(path);
    if (!dir) return noDir(path);
    if (!fs.isValidName(name)) return { error: 'nombre-invalido', name: name };
    props = props || {};

    var real = fs.findChildName(dir, name);
    var prev = real ? dir.children[real] : null;
    if (prev && prev.type === 'dir') return { error: 'es-dir', name: real };
    if (prev) {
      var b = blocked(prev, real);
      if (b) return b;
    }

    var size = (typeof props.size === 'number') ? props.size : String(props.content || '').length;
    /* Al pisar un archivo solo hace falta lugar para la DIFERENCIA: lo que
       ocupaba el viejo se libera en el mismo acto. */
    if (size - (prev ? prev.size : 0) > fs.free()) return { error: 'sin-espacio', name: name, need: size };

    var node = { type: 'file', name: real || name, kind: fs.kindOf(name), size: size, content: '', info: '' };
    Object.keys(props).forEach(function (k) { node[k] = props[k]; });
    node.size = size;
    dir.children[node.name] = node;

    GT.emit('fs', { op: 'write', path: path.slice(), name: node.name });
    return { ok: true, name: node.name, node: node };
  };

  fs.makeDir = function (path, name) {
    var dir = dirAt(path);
    if (!dir) return noDir(path);
    if (!fs.isValidName(name)) return { error: 'nombre-invalido', name: name };
    if (fs.findChildName(dir, name)) return { error: 'ya-existe', name: name };

    dir.children[name] = { type: 'dir', name: name, children: {} };
    GT.emit('fs', { op: 'mkdir', path: path.slice(), name: name });
    return { ok: true, name: name, node: dir.children[name] };
  };

  /** Borra un archivo o una carpeta. opts.recursive permite carpetas con
      contenido; opts.force es para el propio juego (el ransomware destruyendo
      archivos), que no pide permiso. */
  fs.remove = function (path, name, opts) {
    opts = opts || {};
    var dir = dirAt(path);
    if (!dir) return noDir(path);
    var real = fs.findChildName(dir, name);
    if (!real) return { error: 'no-existe', name: name };

    var node = dir.children[real];
    if (!opts.force) {
      var b = blockedDeep(node, real);
      if (b) return b;
    }
    if (node.type === 'dir' && !opts.recursive && Object.keys(node.children || {}).length) {
      return { error: 'no-vacio', name: real };
    }

    var freed = fs.sizeOf(node);
    delete dir.children[real];
    GT.emit('fs', { op: 'remove', path: path.slice(), name: real, node: node, freed: freed });
    return { ok: true, name: real, node: node, freed: freed };
  };

  fs.rename = function (path, name, newName) {
    var dir = dirAt(path);
    if (!dir) return noDir(path);
    var real = fs.findChildName(dir, name);
    if (!real) return { error: 'no-existe', name: name };
    if (!fs.isValidName(newName)) return { error: 'nombre-invalido', name: newName };

    var node = dir.children[real];
    var b = blocked(node, real);
    if (b) return b;
    /* Cambiar solo las mayusculas ("leeme.txt" -> "LEEME.TXT") no choca con
       nadie: el que ya existe con ese nombre soy yo mismo. */
    var clash = fs.findChildName(dir, newName);
    if (clash && clash !== real) return { error: 'ya-existe', name: clash };

    delete dir.children[real];
    node.name = newName;
    if (node.type !== 'dir' && !node.encrypted) node.kind = fs.kindOf(newName);
    dir.children[newName] = node;

    GT.emit('fs', { op: 'rename', path: path.slice(), name: newName, from: real });
    return { ok: true, name: newName, from: real, node: node };
  };

  /** Copia un archivo. La copia ocupa lugar: es la operacion que puede
      fallar por falta de espacio. */
  fs.copy = function (path, name, destPath, newName) {
    var dir = dirAt(path);
    var dest = dirAt(destPath);
    if (!dir) return noDir(path);
    if (!dest) return noDir(destPath);
    var real = fs.findChildName(dir, name);
    if (!real) return { error: 'no-existe', name: name };

    var node = dir.children[real];
    if (node.type === 'dir') return { error: 'es-dir', name: real };
    newName = newName || real;
    if (!fs.isValidName(newName)) return { error: 'nombre-invalido', name: newName };
    if (fs.findChildName(dest, newName)) return { error: 'ya-existe', name: newName };
    if (node.size > fs.free()) return { error: 'sin-espacio', name: real, need: node.size };

    /* JSON.parse(JSON.stringify(x)) = copia PROFUNDA de un objeto de datos:
       la copia no comparte nada con el original. Le saco las marcas que son
       de ESE archivo y no de su contenido (un duplicado del log no pasa a ser
       un archivo del sistema), pero si era malware, la copia tambien lo es. */
    var copy = JSON.parse(JSON.stringify(node));
    copy.name = newName;
    delete copy.system;
    delete copy.objective;
    delete copy.lockedBy;
    dest.children[newName] = copy;

    GT.emit('fs', { op: 'copy', path: destPath.slice(), name: newName });
    return { ok: true, name: newName, node: copy };
  };

  /** Mueve un archivo o una carpeta. Dentro del mismo disco no ocupa lugar
      nuevo: solo cambia de que carpeta cuelga. */
  fs.move = function (path, name, destPath, newName) {
    var dir = dirAt(path);
    var dest = dirAt(destPath);
    if (!dir) return noDir(path);
    if (!dest) return noDir(destPath);
    var real = fs.findChildName(dir, name);
    if (!real) return { error: 'no-existe', name: name };

    var node = dir.children[real];
    var b = blockedDeep(node, real);
    if (b) return b;
    newName = newName || real;
    if (!fs.isValidName(newName)) return { error: 'nombre-invalido', name: newName };
    if (fs.findChildName(dest, newName)) return { error: 'ya-existe', name: newName };
    /* Una carpeta no se puede mover adentro de si misma: quedaria colgando
       de un nodo que ya no cuelga de nadie y desapareceria del arbol. */
    var self = path.concat(real).join('\\').toLowerCase();
    var into = destPath.join('\\').toLowerCase();
    if (node.type === 'dir' && (into === self || into.indexOf(self + '\\') === 0)) {
      return { error: 'invalido', name: real };
    }

    delete dir.children[real];
    node.name = newName;
    dest.children[newName] = node;

    GT.emit('fs', { op: 'move', path: destPath.slice(), name: newName, from: real });
    return { ok: true, name: newName, node: node };
  };

  /** Mensaje para el jugador a partir de un resultado con error. */
  fs.explain = function (res) {
    var n = '"' + res.name + '"';
    switch (res.error) {
      case 'no-existe':       return 'No se encuentra ' + n + '.';
      case 'no-es-dir':       return n + ' no es un directorio.';
      case 'es-dir':          return n + ' es un directorio, no un archivo.';
      case 'protegido':       return 'Acceso denegado: ' + n + ' es un archivo del sistema.';
      case 'bloqueado':       return 'Acceso denegado: la carpeta ' + n + ' está protegida por clave.';
      case 'necesario':       return 'Todavía necesitás ' + n + ' para un objetivo pendiente: no lo toques.';
      case 'en-uso':          return 'No se puede: ' + n + ' está en uso por ' + res.by.name +
                                     ' (PID ' + res.by.pid + '). Terminá ese proceso primero.';
      case 'no-vacio':        return 'La carpeta ' + n + ' no está vacía.';
      case 'ya-existe':       return 'Ya existe ' + n + ' en esa carpeta.';
      case 'sin-espacio':     return 'No hay espacio suficiente en el disco. Liberá espacio borrando archivos.';
      case 'nombre-invalido': return 'El nombre ' + n + ' no es válido: no puede llevar \\ / : * ? " < > |';
      case 'invalido':        return 'No se puede mover ' + n + ' adentro de sí misma.';
      default:                return 'No se pudo completar la operación.';
    }
  };

  /* ============================================================
     Almacenamiento: la cuota y el malware
     ============================================================ */
  /* Cada proceso hostil vivo escribe basura en C:\Sistema\Temp, en un archivo
     propio que crece con el tiempo (lo llama processes.js en cada tick). No
     creo miles de archivos: uno por proceso, cada vez mas pesado. Mientras el
     proceso viva el archivo esta "en uso" y no se puede borrar; al matarlo,
     el archivo queda huerfano y ocupando lugar hasta que alguien lo borre. */
  fs.JUNK_DIR = ['Sistema', 'Temp'];

  /* Crea las carpetas que falten en el camino. Es para uso interno del juego
     (el malware y las herramientas del sistema), por eso no pide permiso. */
  fs.ensureDir = function (path) {
    var node = rootNode();
    path.forEach(function (name) {
      if (!node.children[name]) node.children[name] = { type: 'dir', name: name, children: {} };
      node = node.children[name];
    });
    return node;
  };

  /** Un proceso hostil escribe "bytes" de basura. Devuelve cuanto entro: con
      el disco lleno no entra nada. */
  fs.growJunk = function (proc, bytes) {
    bytes = Math.min(bytes, fs.free());
    if (bytes <= 0) return 0;

    var dir = fs.ensureDir(fs.JUNK_DIR);
    var name = '~' + String(proc.name).split('.')[0] + '_' + proc.pid + '.tmp';
    var node = dir.children[name];
    if (!node) {
      node = dir.children[name] = {
        type: 'file', name: name, kind: 'tmp', size: 0, junk: true, lockedBy: proc.pid,
        info: 'Archivo temporal sin datos útiles: basura escrita para llenar el disco.',
        content: '[datos basura generados por ' + proc.name + ']\r\n'
      };
      GT.emit('fs', { op: 'write', path: fs.JUNK_DIR.slice(), name: name });
    }
    node.size += bytes;
    return bytes;
  };

  /** Bytes de basura del malware que quedan en el disco. */
  fs.junkBytes = function () {
    var total = 0;
    fs.walk(rootNode(), [], function (node) { if (node.junk) total += node.size || 0; });
    return total;
  };

  /** Vigila la cuota. Lo llama el loop de game.js. */
  fs.tick = function (dt) {
    var d = GT.state.disk;
    if (!d) return;

    var u = fs.usage();
    var level = (u.free <= 0) ? 'full'
              : (u.used / u.capacity >= GT.CONFIG.DISK_WARN) ? 'warn' : 'ok';

    /* Aviso solo cuando CAMBIA el nivel (ok -> warn -> full), no en cada
       cuadro: si no, el toast taparia la pantalla sesenta veces por segundo. */
    if (level !== d.level) {
      d.level = level;
      if (level === 'warn') {
        GT.ui.toast('Queda poco espacio en disco: C: al ' + u.percent + '%', 'warn');
      }
      if (level === 'full') {
        GT.audio.alarm();
        GT.ui.toast('DISCO LLENO: el sistema se degrada. Liberá espacio.', 'bad');
        GT.terminal.notify('[!] Unidad C: sin espacio libre. Usa "espacio" y "del".', 'err');
      }
    }

    /* Con el disco lleno el sistema no puede escribir ni su memoria virtual:
       se degrada. Igual que con la CPU saturada, castigo una vez por segundo. */
    if (level === 'full') {
      fullFor += dt;
      if (fullFor >= 1) {
        fullFor = 0;
        GT.damage(GT.CONFIG.DISK_FULL_DAMAGE, 'disco lleno');
      }
    } else {
      fullFor = 0;
    }

    /* Una vez por segundo aviso el estado del disco, para que el que lo este
       mostrando (la barra del Explorador) actualice el numero sin tener que
       redibujarse entero. */
    sinceReport += dt;
    if (sinceReport >= 1) {
      sinceReport = 0;
      GT.emit('disk', u);
    }
  };

})(window);
