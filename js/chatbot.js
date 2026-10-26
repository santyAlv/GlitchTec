/* ============================================================
   Glitch.TEC — TEC-Bot, el asistente de soporte
   Responde dudas sobre comandos y conceptos de hardware y
   software, y da pistas del nivel sin costo pero con cupo.

   Tiene tres partes y estan separadas a proposito:
     1. la base de conocimiento  (datos: temas y palabras clave)
     2. el buscador              (GT.bot.ask: texto -> respuesta)
     3. la ventana de chat       (GT.bot.open)
   El buscador no sabe nada de la ventana: devuelve un objeto y lo
   puede usar cualquier interfaz (la ventana, el comando "bot" de
   la Terminal o lo que arme el front despues).
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var bot = GT.bot = {};

  var WIN_ID = 'bot';

  /* ============================================================
     1. Base de conocimiento
     ============================================================ */
  /* Cada tema es un objeto:
       title   como se llama (se muestra y tambien suma al buscar)
       keys    palabras o frases que lo disparan. Van como las escribiria
               un alumno, con sinonimos y errores comunes; el buscador las
               normaliza (sin acentos, sin plurales) antes de comparar.
       text    la respuesta
     Para sumar un tema alcanza con agregar un objeto: el buscador de abajo
     no se toca. */
  var TOPICS = [

    /* ---------------- Software: amenazas ---------------- */
    { title: 'Doble extensión',
      keys: ['doble extension', 'extension', 'jpg.exe', 'extensiones ocultas', 'archivo disfrazado'],
      text: 'La extensión que manda es SIEMPRE la última. "foto.jpg.exe" no es una imagen: es un programa (.exe) ' +
            'con ".jpg" en el nombre. Windows oculta las extensiones conocidas, así que se ve "foto.jpg" y uno ' +
            'cree que abre una foto. En la Terminal,  dir  te marca esos archivos y  scan <archivo>  los analiza.' },

    { title: 'Malware',
      keys: ['malware', 'virus', 'infeccion', 'infectado', 'software malicioso', 'amenaza'],
      text: 'Malware es cualquier programa hecho para dañar o aprovecharse del equipo. "Virus" es sólo un tipo. ' +
            'Otros: troyano (se disfraza de algo útil), ransomware (secuestra archivos), spyware y keylogger ' +
            '(espían), cryptominer (usa tu CPU) y botnet (suma tu PC a una red de equipos zombis).' },

    { title: 'Troyano',
      keys: ['troyano', 'trojan', 'dropper', 'caballo de troya'],
      text: 'Un troyano se presenta como algo inofensivo (una foto, un instalador) para que lo ejecutes vos. ' +
            'Un "dropper" es el troyano que, una vez adentro, descarga e instala el resto del malware.' },

    { title: 'Ransomware',
      keys: ['ransomware', 'secuestro', 'rescate', 'locked', 'cifrado', 'cifrar', 'encriptado', 'encriptar', 'pagar'],
      text: 'El ransomware cifra tus archivos y pide un pago para devolverlos. No se paga: nada obliga al atacante ' +
            'a cumplir. Se actúa en orden: 1) contener, terminando el proceso que cifra; 2) conseguir la clave si ' +
            'quedó en algún lado; 3) recuperar, y lo que no se pueda descifrar sale del backup. La única defensa ' +
            'segura es haber hecho la copia ANTES.' },

    { title: 'Spyware y keylogger',
      keys: ['spyware', 'keylogger', 'espia', 'espiar', 'teclas', 'registra el teclado'],
      text: 'El spyware espía lo que hacés y lo manda afuera. Un keylogger es el que registra cada tecla que ' +
            'apretás: así se roban contraseñas aunque el sitio sea seguro.' },

    { title: 'Phishing',
      keys: ['phishing', 'correo falso', 'mail falso', 'suplantacion', 'remitente', 'enlace', 'link', 'dominio', 'correo'],
      text: 'Phishing es un mensaje que se hace pasar por alguien de confianza para robarte datos. Tres cosas para ' +
            'mirar: el dominio real del remitente (lo que está justo antes del .com, .ar…: en ' +
            '"tec-edu.verificacion-cuenta.com" el dominio es verificacion-cuenta.com), a dónde apunta de verdad ' +
            'el enlace, y la urgencia ("tu cuenta se cierra hoy"). Ningún servicio serio te pide la clave por correo.' },

    { title: 'Persistencia',
      keys: ['persistencia', 'arranque', 'inicio automatico', 'se vuelve a instalar', 'reinicio', 'arranque.ini'],
      text: 'Persistencia es lo que hace el malware para sobrevivir a un reinicio: se anota en el arranque del ' +
            'sistema, crea tareas programadas o se guarda en un lugar escondido. Por eso borrar el archivo ' +
            'original no alcanza. Lo podés ver con  type \\Sistema\\arranque.ini .' },

    { title: 'Firma digital',
      keys: ['firma digital', 'firma', 'firmado', 'sin firma', 'certificado', 'editor'],
      text: 'La firma digital dice quién publicó un programa y garantiza que nadie lo modificó después. El nombre ' +
            'de un proceso lo elige quien lo hizo (y el malware elige nombres parecidos a los legítimos), pero la ' +
            'firma no se puede falsificar así nomás. Un ejecutable "sin firma" no es malware por definición, pero ' +
            'es el primero que hay que mirar.' },

    { title: 'Contraseñas',
      keys: ['contrasena', 'clave', 'password', 'hash', 'texto plano', 'contrasenia'],
      text: 'Una buena contraseña es larga y distinta en cada sitio. No se guardan en un .txt: es lo primero que ' +
            'busca un infostealer. Y un sistema bien hecho tampoco guarda tu contraseña: guarda su hash, un ' +
            'resultado de un solo sentido que sirve para comprobarla pero no para recuperarla.' },

    /* ---------------- Software: sistema operativo ---------------- */
    { title: 'Procesos',
      keys: ['proceso', 'pid', 'administrador de tareas', 'ps', 'kill', 'matar proceso', 'terminar proceso', 'tasklist'],
      text: 'Un proceso es un programa en ejecución. Cada uno tiene un número, el PID. En la Terminal  ps  los ' +
            'lista y  kill <pid>  termina uno. Un archivo borrado del disco puede seguir corriendo en memoria: ' +
            'por eso al malware hay que terminarle el proceso, no sólo borrarle el archivo.' },

    { title: 'CPU y memoria RAM',
      keys: ['cpu', 'procesador', 'ram', 'memoria', 'lento', 'lenta', 'consumo', 'saturada', 'recursos'],
      text: 'La CPU ejecuta las instrucciones y la RAM guarda lo que los programas están usando en este momento. ' +
            'Si un proceso acapara la CPU o llena la RAM, todo lo demás espera: el equipo se pone lento. ' +
            'diag  te muestra el estado y cuál es el proceso que más consume.' },

    { title: 'PC tildada (congelamientos)',
      keys: ['tildada', 'tildo', 'congelada', 'congelamiento', 'colgada', 'no responde', 'se cuelga', 'diag', 'trabada'],
      text: 'Cuando el sistema "se tilda", casi siempre hay un programa esperando algo que otro no le suelta. El ' +
            'que quedó colgado es la víctima; hay que encontrar al que lo BLOQUEA. La interfaz gráfica deja de ' +
            'responder pero la Terminal no:  diag  te dice quién bloquea y  kill <pid>  lo termina.' },

    { title: 'Copia de seguridad (backup)',
      keys: ['backup', 'copia de seguridad', 'respaldo', 'respaldar', 'copia', 'recuperar archivos'],
      text: 'Un backup es una copia de TUS archivos guardada en otra partición o en otro disco. Si le pasa algo al ' +
            'original, la copia sigue ahí. Se hace antes del problema, no después.  backup create <carpeta>  la ' +
            'crea,  backup list  las muestra y  backup restore <n>  devuelve los archivos.' },

    { title: 'Punto de restauración',
      keys: ['punto de restauracion', 'restaurar sistema', 'restore', 'restauracion', 'volver atras', 'rstrui'],
      text: 'Un punto de restauración guarda la CONFIGURACIÓN del sistema en una fecha. Volver a él deshace los ' +
            'cambios del sistema posteriores, sin tocar tus documentos (para eso está el backup). Ojo con la ' +
            'fecha: un punto creado DESPUÉS de una infección la guarda adentro, y restaurarlo la trae de vuelta. ' +
            'restore list  los muestra y  restore apply <n>  aplica uno.' },

    { title: 'Particiones',
      keys: ['particion', 'particiones', 'part', 'diskpart', 'unidad', 'disco d', 'formato', 'fat32', 'sin asignar'],
      text: 'Una partición es una división del disco que el sistema ve como una unidad aparte (C:, D:). Sirve, por ' +
            'ejemplo, para tener el sistema en una y los datos o las copias en otra. Borrar una partición elimina ' +
            'todo lo que tiene.  part list  muestra la tabla: una partición sin letra ni etiqueta que nadie creó ' +
            'es para desconfiar.' },

    { title: 'Espacio en disco',
      keys: ['espacio', 'disco lleno', 'sin espacio', 'cuota', 'temp', 'temporales', 'basura', 'liberar espacio', 'capacidad'],
      text: 'Cada archivo ocupa lugar y la unidad tiene un tamaño fijo. Con el disco lleno el sistema no puede ni ' +
            'usar su memoria virtual y se degrada.  espacio  muestra cuánto hay usado y qué carpeta ocupa más;  ' +
            'del <archivo>  (o  del *.tmp ) libera. Un archivo "en uso" por un proceso no se deja borrar: primero ' +
            'hay que terminar el proceso.' },

    { title: 'Comandos de archivos',
      keys: ['comando', 'comandos', 'dir', 'cd', 'type', 'del', 'copy', 'move', 'ren', 'md', 'rd', 'carpeta', 'directorio', 'ruta'],
      text: 'dir  lista la carpeta ·  cd <carpeta>  entra ( cd ..  vuelve,  cd \\  va a la raíz) ·  type <archivo>  ' +
            'lo muestra ·  copy / move <origen> <destino>  ·  ren <viejo> <nuevo>  ·  del <archivo>  ·  ' +
            'md / rd <carpeta> . Todos aceptan rutas:  type \\Sistema\\registro.log . Escribí  help  en la Terminal ' +
            'para la lista completa.' },

    { title: 'Logs del sistema',
      keys: ['log', 'logs', 'registro', 'registro.log', 'eventos', 'bitacora'],
      text: 'Un log es el registro de lo que fue pasando en el sistema, con fecha y hora. Es lo primero que se lee ' +
            'en un incidente: dice qué proceso tocó qué archivo y cuándo. Con esa hora se puede decidir, por ' +
            'ejemplo, qué punto de restauración es anterior a una infección.' },

    /* ---------------- Software: numeros ---------------- */
    { title: 'Binario a decimal',
      keys: ['binario', 'decimal', 'bin2dec', 'bit', 'bits', 'base 2', 'convertir', 'conversion'],
      text: 'En binario cada posición vale el doble que la de su derecha: 1, 2, 4, 8, 16, 32, 64, 128. Para pasar ' +
            'a decimal sumás los valores donde hay un 1. Ejemplo: 1011 = 8 + 0 + 2 + 1 = 11.' },

    { title: 'Hexadecimal',
      keys: ['hexadecimal', 'hexa', 'hex', '0x', 'base 16'],
      text: 'El hexadecimal usa 16 símbolos: 0 al 9 y después A=10, B=11, C=12, D=13, E=14, F=15. Cada dígito hexa ' +
            'son exactamente 4 bits, por eso se usa para escribir bytes: 0x3C = 0011 1100. Para pasar a decimal: ' +
            'primer dígito × 16 + segundo dígito (0x3C = 3×16 + 12 = 60).' },

    { title: 'XOR',
      keys: ['xor', 'o exclusivo', 'clave de descifrado', 'descifrar', 'decrypt', 'volcado'],
      text: 'XOR compara dos números bit a bit: si los dos bits son IGUALES da 0, si son DISTINTOS da 1. Ejemplo: ' +
            '1100 XOR 1010 = 0110. Tiene una propiedad que lo hace ideal para cifrar: aplicar dos veces la misma ' +
            'clave devuelve el dato original. Escribí los dos números uno arriba del otro y resolvé columna por columna.' },

    /* ---------------- Hardware ---------------- */
    { title: 'El equipo no enciende',
      keys: ['no enciende', 'no prende', 'no arranca', 'muerta', 'muerto', 'alimentacion', 'cable de alimentacion', 'tomacorriente'],
      text: 'Si no hay ni luces ni ventiladores, el problema es de alimentación. Se revisa de afuera hacia adentro ' +
            'y de lo barato a lo caro: cable, tomacorriente, interruptor trasero de la fuente, botón de encendido ' +
            'y recién después la fuente. La mayoría de las veces es un cable flojo.' },

    { title: 'Fuente de alimentación',
      keys: ['fuente', 'psu', 'fuente de alimentacion', 'voltaje', 'tension', 'puente', '24 pines'],
      text: 'La fuente convierte la corriente de la pared en las tensiones que usa el equipo (12 V, 5 V, 3,3 V). ' +
            'Para probarla sola se puentea el conector de 24 pines: si el ventilador gira, entrega tensión. Es una ' +
            'pieza cara: se cambia sólo después de descartar cable, toma e interruptor.' },

    { title: 'POST y pitidos',
      keys: ['post', 'pitido', 'pitidos', 'beep', 'bios', 'no da imagen', 'pantalla negra', 'sin senal'],
      text: 'El POST es el chequeo que hace el equipo al encender, antes de cargar el sistema. Si algo falla lo ' +
            'avisa con pitidos, que son un código: un pitido corto es "todo bien"; un largo y dos cortos apunta a ' +
            'memoria. "Enciende pero no da imagen" no es lo mismo que "no enciende": hay corriente, falla el POST.' },

    { title: 'Memoria RAM (hardware)',
      keys: ['modulo de memoria', 'ram mal puesta', 'zocalo', 'reasentar', 'contactos', 'memoria floja'],
      text: 'La causa número uno de un equipo que enciende sin dar imagen es un módulo de RAM mal asentado. Se saca, ' +
            'se limpian los contactos y se calza hasta que cierran las dos trabas. No cuesta nada: antes de ' +
            'comprar un módulo nuevo, se reasienta el que está.' },

    { title: 'Temperatura y pasta térmica',
      keys: ['temperatura', 'calor', 'se apaga sola', 'se apaga', 'sobrecalentamiento', 'pasta termica', 'pasta', 'disipador', 'recalienta'],
      text: 'Un apagado seco, sin pantalla azul y después de un rato de uso, es la protección térmica: el ' +
            'procesador se corta antes de dañarse. Causas, en orden: polvo tapando el disipador, ventilador que no ' +
            'gira y pasta térmica seca. La pasta va entre el procesador y el disipador y se cambia cada 2 o 3 años.' },

    { title: 'Polvo y ventilación',
      keys: ['polvo', 'ventilador', 'ventilacion', 'filtro', 'cooler', 'aire comprimido', 'ruido', 'rpm'],
      text: 'La refrigeración es un circuito: el aire entra por el frente, pasa por el disipador y sale por atrás. ' +
            'Si los filtros están tapados no entra; si el ventilador está trabado, el calor no sale. El polvo se ' +
            'saca con aire comprimido; un ventilador con el rodamiento trabado se cambia.' },

    { title: 'Disco rígido y SMART',
      keys: ['disco', 'disco rigido', 'smart', 'sectores', 'clic', 'ssd', 'hdd', 'disco moribundo'],
      text: 'SMART es el autodiagnóstico del disco. Sectores reasignados y un clic repetido significan que se está ' +
            'muriendo y puede fallar en cualquier momento. Regla de oro: primero se respaldan los datos y después ' +
            'se cambia el disco. El hardware se compra; los datos del cliente no.' },

    { title: 'Humedad y sulfato',
      keys: ['humedad', 'sulfato', 'sulfatacion', 'oxido', 'verdin', 'mojado', 'alcohol isopropilico', 'isopropilico'],
      text: 'La humedad no suele quemar de entrada: oxida los contactos. Ese verdín es sulfato, y por ahí deja de ' +
            'pasar la señal. Primero se SECA el equipo (encenderlo mojado sí lo quema) y después se limpia con ' +
            'alcohol isopropílico, que se evapora sin dejar agua. La pieza no se cambia.' },

    { title: 'Cable de red y fichas RJ45',
      keys: ['rj45', 'ficha', 'utp', 'cable de red', 'crimpear', 'crimpeadora', 'patch', 't568b', 't568a', 'par trenzado', 'conector'],
      text: 'El cable UTP tiene 8 hilos en 4 pares trenzados y termina en fichas RJ45. El orden T568B es: ' +
            'blanco-naranja, naranja, blanco-verde, azul, blanco-azul, verde, blanco-marrón, marrón. Una ficha mal ' +
            'crimpada (un hilo que no llega al fondo, pines desparejos) corta el enlace. Se comprueba con el ' +
            'probador de cables, que enciende las 8 luces en orden; si saltea alguna, ese hilo no hace contacto.' },

    { title: 'Switch',
      keys: ['switch', 'puerto', 'puerto quemado', 'led', 'link', 'red caida', 'se cae la red', 'concentrador'],
      text: 'El switch conecta los equipos de una red: cada puerto tiene una luz de enlace que prende cuando hay ' +
            'cable y equipo del otro lado. Un puerto que no prende con un cable que sí funciona está quemado: se ' +
            'pasa el cable a otro puerto libre. Un switch en un armario cerrado y con la ventilación tapada se ' +
            'recalienta y se reinicia solo: la red "se cae" cada tanto.' },

    { title: 'Placa de red',
      keys: ['placa de red', 'nic', 'adaptador de red', 'tarjeta de red', 'sin red', 'ethernet', 'internet'],
      text: 'La placa de red (NIC) es la que conecta el equipo al cable. Si el sistema ni la muestra en la lista de ' +
            'adaptadores, la placa está muerta; si la muestra pero dice "cable desconectado", el problema está en ' +
            'el cable o en el switch. Una descarga eléctrica que entra por el cable suele quemar los dos extremos: ' +
            'el puerto del switch y la placa.' },

    { title: 'Método de diagnóstico',
      keys: ['diagnostico', 'diagnosticar', 'como empiezo', 'por donde empiezo', 'metodo', 'taller', 'reparar', 'cambiar pieza'],
      text: 'Diagnosticar antes de cambiar. Se escucha al cliente, se observa el síntoma, se inspecciona de afuera ' +
            'hacia adentro y de lo barato a lo caro, se actúa sobre lo que se encontró y se vuelve a probar. ' +
            'Cambiar piezas "por las dudas" cuesta plata y no enseña cuál era la falla.' }
  ];

  bot.TOPICS = TOPICS;

  /* ============================================================
     2. Buscador por palabras clave
     ============================================================ */
  /* Palabras que no dicen nada sobre el tema de la pregunta. Si no las
     sacara, "que es la ram" y "que es la fuente" se parecerian un monton
     entre si solo por compartir "que es la". */
  var STOP = ('a al algo como con cual cuando de del donde el ella en es eso esta este esto hace hacer hago ' +
              'hay la las le lo los me mi no o para pero por porque puedo que quiero se ser si sirve son su ' +
              'un una uno y ya yo tengo tiene significa funciona usa uso').split(' ');

  /* Deja el texto comparable: minuscula, sin acentos y sin signos. Despues
     de normalize('NFD') cada letra acentuada queda como letra + acento
     suelto, y el primer replace borra esos acentos (la ñ queda como n). */
  function normalize(text) {
    return String(text || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9.\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  /* Recorte de plurales, a lo bruto: "procesos" y "proceso" tienen que ser
     la misma palabra. El castellano arma el plural con "s" o con "es" y sin
     diccionario no se puede saber cual fue, asi que saco la "s" y despues la
     "e" final que quede detras de una consonante: "cables" y "cable" terminan
     los dos en "cabl", "particiones" y "particion" en "particion". No hace
     falta que el resultado sea una palabra real: alcanza con que la pregunta
     y la clave pasen por el MISMO recorte, porque solo las comparo entre si. */
  function stem(word) {
    if (word.length > 3 && /s$/.test(word)) word = word.slice(0, -1);              // claves -> clave
    if (word.length > 3 && /[^aeiou]e$/.test(word)) word = word.slice(0, -1);      // clave -> clav, particione -> particion
    return word;
  }

  function tokens(text) {
    return normalize(text).split(' ').filter(function (w) {
      return w && STOP.indexOf(w) === -1;
    }).map(stem);
  }

  /* Preparo los temas UNA vez al cargar: cada clave ya normalizada y partida
     en palabras, para no rehacer ese trabajo en cada pregunta. */
  var INDEX = TOPICS.map(function (t) {
    return {
      topic: t,
      keys: t.keys.map(function (k) { return tokens(k); }).filter(function (k) { return k.length; }),
      title: tokens(t.title)
    };
  });

  /* Puntaje de un tema para una pregunta:
       +5 por cada clave de VARIAS palabras que aparezca entera y en orden
          ("punto de restauracion"): es la coincidencia mas especifica
       +3 por cada clave de una palabra que aparezca tal cual
       +1.5 si coincide solo el comienzo ("particion" / "particionar")
       +1 por cada palabra del titulo
     Gana el tema con mas puntos. Los pesos estan para que una frase exacta
     le gane siempre a varias palabras sueltas. */
  function score(entry, words) {
    var total = 0;
    var joined = ' ' + words.join(' ') + ' ';

    entry.keys.forEach(function (key) {
      if (key.length > 1) {
        if (joined.indexOf(' ' + key.join(' ') + ' ') !== -1) total += 5;
        return;
      }
      var k = key[0];
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w === k) { total += 3; return; }
        if (w.length >= 4 && k.length >= 4 && (k.indexOf(w) === 0 || w.indexOf(k) === 0)) { total += 1.5; return; }
      }
    });

    entry.title.forEach(function (tw) { if (words.indexOf(tw) !== -1) total += 1; });
    return total;
  }

  var MIN_SCORE = 3;      // por debajo de esto, mejor decir "no se" que inventar

  /** Los temas que mejor responden a un texto, de mayor a menor puntaje. */
  bot.search = function (text) {
    var words = tokens(text);
    if (!words.length) return [];
    return INDEX.map(function (e) { return { topic: e.topic, score: score(e, words) }; })
      .filter(function (r) { return r.score >= MIN_SCORE; })
      .sort(function (a, b) { return b.score - a.score; });
  };

  /* ---------------- Pistas ---------------- */
  /* Las pistas del bot salen del mismo lugar que el comando "pista" de la
     Terminal (GT.levels.getHint, o GT.tech.getHint en el taller), pero no
     descuentan puntos ni cuentan como pista usada. A cambio tienen cupo:
     GT.CONFIG.BOT_HINTS_PER_LEVEL por nivel. El cupo vive en el estado de la
     partida y se renueva al cambiar de nivel. */
  function hintState() {
    var s = GT.state.bot || (GT.state.bot = { level: -1, used: 0, total: 0 });
    if (s.level !== GT.state.level) { s.level = GT.state.level; s.used = 0; }
    return s;
  }

  bot.hintsLeft = function () {
    return Math.max(0, GT.CONFIG.BOT_HINTS_PER_LEVEL - hintState().used);
  };

  function currentHint() {
    if (!GT.state.running || GT.state.finished) return null;
    return (GT.state.mode === 'tecnico') ? GT.tech.getHint() : GT.levels.getHint();
  }

  function giveHint() {
    var hint = currentHint();
    if (!hint) {
      return { type: 'hint', ok: false, title: 'Pista',
               text: 'Ahora no tengo ninguna pista: empezá una partida y preguntame de nuevo.', left: bot.hintsLeft() };
    }
    if (bot.hintsLeft() <= 0) {
      return { type: 'hint', ok: false, title: 'Sin pistas gratis',
               text: 'Ya te di las ' + GT.CONFIG.BOT_HINTS_PER_LEVEL + ' pistas gratis de este nivel. ' +
                     (GT.state.mode === 'tecnico'
                       ? 'Preguntame por el síntoma o por la pieza: de conceptos puedo hablar todo lo que quieras.'
                       : 'Queda el comando  pista  de la Terminal, que cuesta ' + GT.CONFIG.HINT_COST + ' puntos. ' +
                         'De conceptos puedo hablar todo lo que quieras.'),
               left: 0 };
    }
    var s = hintState();
    s.used++;
    s.total++;
    if (GT.api) GT.api.logEvent('bot_hint', { level: GT.state.level, mode: GT.state.mode });
    return { type: 'hint', ok: true, title: 'Pista (sin costo)', text: hint, left: bot.hintsLeft() };
  }

  /* ---------------- Preguntar ---------------- */
  var RX_HINT = /\b(pista|pistas|ayudame|trabad[oa]|perdid[oa]|atascad[oa]|no se que hacer|que hago|que tengo que hacer|como sigo|como paso)\b/;
  var RX_TOPICS = /^(temas?|ayuda|help|menu|que sabes|de que sabes|opciones)$/;
  var RX_HELLO = /^(hola|buenas|buen dia|buenos dias|hey|que tal)\b/;
  var RX_THANKS = /\b(gracias|genial|joya|buenisimo)\b/;

  /** Punto de entrada del asistente: recibe lo que escribio el jugador y
      devuelve  { type, title, text, related, left }.
        type: 'answer' | 'hint' | 'topics' | 'hello' | 'unknown'
      No toca el DOM: dibujar la respuesta es problema del que llama. */
  bot.ask = function (text) {
    var q = normalize(text);
    if (!q) return { type: 'unknown', title: 'TEC-Bot', text: 'Escribime una pregunta, o  temas  para ver de qué sé.' };

    /* Las intenciones van ANTES que la busqueda: "dame una pista del
       ransomware" es un pedido de pista, no una pregunta sobre ransomware. */
    if (RX_HINT.test(q)) return giveHint();
    if (RX_TOPICS.test(q)) return { type: 'topics', title: 'Temas', text: topicList() };

    var results = bot.search(text);
    if (!results.length) {
      /* El saludo se mira recien aca: "hola, que es el phishing" es una
         pregunta sobre phishing y la tiene que responder la busqueda. */
      if (RX_HELLO.test(q)) {
        return { type: 'hello', title: 'TEC-Bot',
                 text: 'Hola. Soy TEC-Bot, el asistente de soporte. Preguntame por un comando o un concepto ' +
                       '("qué es el phishing", "para qué sirve kill", "por qué se apaga sola"). Si estás trabado, ' +
                       'escribí  pista : tengo ' + GT.CONFIG.BOT_HINTS_PER_LEVEL + ' gratis por nivel.' };
      }
      if (RX_THANKS.test(q)) return { type: 'hello', title: 'TEC-Bot', text: 'De nada. Cualquier cosa, acá estoy.' };
      return { type: 'unknown', title: 'No lo tengo',
               text: 'De eso no tengo nada cargado. Probá con otras palabras, o escribí  temas  para ver la lista. ' +
                     'Si lo que necesitás es saber cómo seguir, escribí  pista .' };
    }

    var best = results[0].topic;
    return {
      type: 'answer',
      title: best.title,
      text: best.text,
      /* Hasta dos temas mas que tambien coincidieron: por si la pregunta
         iba para otro lado. */
      related: results.slice(1, 3).map(function (r) { return r.topic.title; })
    };
  };

  function topicList() {
    return 'Sé de: ' + TOPICS.map(function (t) { return t.title; }).join(' · ') +
           '. Preguntame con tus palabras. Y con  pista  te doy una ayuda del nivel sin costo.';
  }

  /* ============================================================
     3. Ventana de chat
     ============================================================ */
  /* Una app de mensajeria del escritorio: globos del bot a la izquierda y
     del jugador a la derecha, atajos para lo mas comun y el cupo de pistas
     gratis siempre a la vista. El diseño esta en css/chat.css.
     Todo el texto entra con textContent: lo que escribe el jugador vuelve
     a la pantalla y no tiene que poder meter HTML. */
  var log = null;
  var input = null;
  var counter = null;

  /* Atajos de abajo: lo que se manda al tocarlos. */
  var CHIPS = [
    { label: 'Dame una pista', ask: 'pista' },
    { label: '¿De qué sabés?', ask: 'temas' },
    { label: '¿Qué es el phishing?', ask: 'qué es el phishing' },
    { label: '¿Para qué sirve kill?', ask: 'para qué sirve kill' }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function scrollDown() { if (log) log.scrollTop = log.scrollHeight; }

  function userMsg(text) {
    if (!log) return;
    var row = el('div', 'bot-msg is-user');
    row.appendChild(el('p', 'bot-bubble', text));
    log.appendChild(row);
    scrollDown();
  }

  /** Dibuja una respuesta del bot como un globo. */
  function show(res) {
    if (!log) return;
    var row = el('div', 'bot-msg is-bot is-' + res.type);
    row.appendChild(el('span', 'bot-avatar'));
    row.lastChild.innerHTML = GT.assets.html('app.asistente', { size: 'lg', alt: '' });

    var bubble = el('div', 'bot-bubble');
    bubble.appendChild(el('strong', 'bot-title', res.title));
    bubble.appendChild(el('p', 'bot-text', res.text));

    /* Los temas parecidos se pueden tocar: preguntan por ese tema. */
    if (res.related && res.related.length) {
      var rel = el('div', 'bot-related');
      rel.appendChild(el('span', '', 'También puede servirte:'));
      res.related.forEach(function (t) {
        var b = el('button', 'bot-rel', t);
        b.type = 'button';
        b.addEventListener('click', function () { send(t); });
        rel.appendChild(b);
      });
      bubble.appendChild(rel);
    }
    row.appendChild(bubble);
    log.appendChild(row);
    updateCounter();
    scrollDown();
  }

  function updateCounter() {
    if (!counter) return;
    var left = bot.hintsLeft();
    counter.textContent = 'Pistas gratis en este nivel: ' + left;
    counter.classList.toggle('is-empty', left === 0);
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text) return;
    userMsg(text);
    show(bot.ask(text));
    GT.audio.click();
    if (input) input.focus();
  }

  bot.open = function () {
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); if (input) input.focus(); return; }

    var body = el('div', 'bot');
    body.innerHTML =
      '<div class="bot-head">' +
        GT.assets.html('app.asistente', { size: 'xl', alt: '' }) +
        '<div><strong>TEC-Bot</strong><span class="bot-status">en línea · soporte técnico</span></div>' +
        '<span class="bot-counter" aria-live="polite"></span>' +
      '</div>' +
      '<div class="bot-log" role="log" aria-live="polite" aria-label="Conversación con TEC-Bot"></div>' +
      '<div class="bot-chips" role="group" aria-label="Preguntas rápidas"></div>' +
      '<form class="bot-form">' +
        '<input class="bot-input" spellcheck="false" autocomplete="off" maxlength="160" ' +
               'placeholder="Escribí tu pregunta..." aria-label="Pregunta para TEC-Bot">' +
        '<button type="submit" class="bot-send">ENVIAR</button>' +
      '</form>';

    GT.ui.openWindow({
      id: WIN_ID, title: 'TEC-Bot — Asistente de soporte',
      icon: ICON, asset: 'app.asistente', className: 'win-bot',
      width: 460, height: 500,
      body: body,
      onFocus: function () { if (input) input.focus(); },
      onClose: function () { log = null; input = null; counter = null; }
    });

    log = body.querySelector('.bot-log');
    input = body.querySelector('.bot-input');
    counter = body.querySelector('.bot-counter');

    var chips = body.querySelector('.bot-chips');
    CHIPS.forEach(function (c) {
      var b = el('button', 'bot-chip', c.label);
      b.type = 'button';
      b.addEventListener('click', function () { send(c.ask); });
      chips.appendChild(b);
    });

    /* submit del form: entra con Enter y con el boton, y el preventDefault
       evita que se recargue la pagina y se pierda la partida. */
    body.querySelector('.bot-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value;
      input.value = '';
      send(text);
    });
    input.addEventListener('keydown', function (e) { if (e.key !== 'Enter') GT.audio.key(); });

    show(bot.ask('hola'));
    input.focus();
  };

  /* Glifo de respaldo, en la misma rejilla de 16x16 que los de ui.js. Se ve
     solo si no carga el arte del set (app.asistente). */
  var ICON =
    '<svg viewBox="0 0 16 16" shape-rendering="crispEdges">' +
      '<path d="M7 0h2v2H7z" fill="#8e9398"/>' +
      '<path d="M2 2h12v9H2z" fill="#2f3433"/>' +
      '<path d="M3 3h10v7H3z" fill="#c3c7c3"/>' +
      '<path d="M5 5h2v2H5zM9 5h2v2H9z" fill="#0a2a86"/>' +
      '<path d="M5 8h6v1H5z" fill="#2f3433"/>' +
      '<path d="M4 11h3v3H4zM6 14h1v1H6z" fill="#2f3433"/>' +
    '</svg>';
  bot.ICON = ICON;

  /* El mismo asistente desde la Terminal:  bot <pregunta> */
  GT.terminal.register('bot', {
    desc: 'Pregunta al asistente TEC-Bot.',
    run: function (args) {
      var res = bot.ask(args.length ? args.join(' ') : 'hola');
      var plain = GT.terminal.plain;        // la consola no usa acentos
      GT.terminal.print('');
      GT.terminal.print(' [TEC-Bot] ' + plain(res.title), res.type === 'hint' ? 'warn' : 'title');
      GT.terminal.print(' ' + plain(res.text), 'info');
      if (res.related && res.related.length) GT.terminal.print(' Tambien: ' + plain(res.related.join(' · ')), 'dim');
      if (res.type === 'hint') GT.terminal.print(' Pistas gratis restantes en este nivel: ' + res.left, 'dim');
      GT.terminal.print('');
    },
    help: { section: 'AYUDA', usage: 'bot <pregunta>', text: 'le pregunta al asistente  (bot pista: ayuda del nivel, sin costo)' }
  }, ['tecbot', 'asistente']);

})(window, document);
