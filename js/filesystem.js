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
       scanned          -> ya lo analice (cambia el icono en el explorador)   */
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

        'Documentos': {
          type: 'dir', name: 'Documentos', children: {

            'leeme.txt': {
              type: 'file', name: 'leeme.txt', kind: 'txt', size: 1204,
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
              type: 'file', name: 'foto_vacaciones.jpg.exe', kind: 'exe', size: 4194304,
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
              type: 'file', name: 'registro.log', kind: 'log', size: 2210,
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
              type: 'file', name: 'config.sys', kind: 'sys', size: 512,
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
                  type: 'file', name: 'payload.bin', kind: 'bin', size: 1048576,
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
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
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

})(window);
