/* ============================================================
   Glitch.TEC — ÓRDENES 10 A 39 DEL SERVICIO TÉCNICO
   ------------------------------------------------------------
   Treinta órdenes más para el taller. Usan el mismo sistema que las
   de tech.js (fallas, pasos, minutos, repuestos, reputación) y se
   suman al mismo catálogo: acá sólo están los pasos y las pantallas
   NUEVAS; los pasos que ya existían se reusan por su id.

   Diez de ellas son de la PILA CMOS (la CR2032 de la placa madre):
   cuando se gasta, el equipo pierde la fecha y la hora cada vez que
   se apaga, vuelve a 2023 y el BIOS se queja. Se resuelve cambiando la
   pila, que se compra en la tienda (js/tienda.js).
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec;
  var tech = GT.tech;
  var STEPS = tech.STEPS;
  var CASES = tech.CASES;

  /* ---------------- Pasos nuevos ---------------- */
  var NUEVOS = {

    /* ----- Pila CMOS ----- */
    preguntar_reloj: {
      g: 'inspeccion', label: 'Preguntar si pierde la hora al desenchufarla', min: 2, parte: 'cliente',
      ok: 'Aporta el dato clave: la hora se pierde sólo cuando el equipo estuvo apagado o desenchufado. ' +
          'Mientras está prendido, el reloj anda bien.'
    },
    ver_fecha_bios: {
      g: 'inspeccion', label: 'Entrar al BIOS y mirar la fecha y la hora', min: 3, parte: 'software',
      detecta: 'pila',
      ok: 'La fecha y la hora del BIOS son las de hoy y no hay avisos de CMOS.',
      mal: 'El BIOS marca 01/01/2023 y avisa "CMOS checksum error": la configuración se borra cada vez que se apaga.'
    },
    medir_pila: {
      tool: 'tester', g: 'inspeccion', label: 'Medir la tensión de la pila CMOS', min: 4, parte: 'pila',
      req: 'abrir', detecta: 'pila',
      ok: 'La pila marca 3,1 V: está sana (una CR2032 nueva da 3 V).',
      mal: 'La pila marca 1,4 V. Por debajo de 2,5 V ya no sostiene el reloj: está gastada.'
    },
    ver_pila: {
      g: 'inspeccion', label: 'Mirar cómo está calzada la pila en su portapila', min: 3, parte: 'pila',
      req: 'abrir', detecta: 'pila_floja',
      ok: 'La pila está firme en el portapila, bien apoyada contra los dos contactos.',
      mal: 'La pila está bien, pero la lengüeta del portapila quedó abierta y la pila baila: hace contacto a ratos.'
    },
    ver_derrame: {
      g: 'inspeccion', label: 'Mirar si la pila perdió líquido sobre la placa', min: 4, parte: 'pila',
      req: 'abrir', detecta: 'pila_derramada',
      ok: 'No hay costra ni manchas alrededor del portapila: la pila no derramó.',
      mal: 'La pila vieja se hinchó y derramó: hay una costra blanca y verdosa sobre los contactos y las pistas cercanas.'
    },
    ver_clave_bios: {
      g: 'inspeccion', label: 'Ver qué pide el BIOS al encender', min: 2, parte: 'software',
      detecta: 'bios_clave',
      ok: 'El BIOS entra directo, sin pedir ninguna contraseña.',
      mal: 'El BIOS pide una contraseña de administrador que nadie recuerda y no deja cambiar nada.'
    },
    cambiar_pila: {
      tool: 'pila', g: 'accion', label: 'Cambiar la pila CMOS (CR2032)', min: 6, parte: 'pila',
      req: 'abrir', costo: 1800, arregla: 'pila',
      hecho: 'Sacás la pila vieja con la traba del portapila, ponés una CR2032 nueva con el + hacia arriba y ' +
             'cargás la fecha en el BIOS. Ahora la conserva aunque desenchufes el equipo.',
      nada: 'La pila ya estaba bien: gastaste una pila y seis minutos. El problema era otro.'
    },
    reasentar_pila: {
      tool: 'pinza', g: 'accion', label: 'Cerrar la lengüeta del portapila con la pinza', min: 5, parte: 'pila',
      req: 'abrir', costo: 0, arregla: 'pila_floja',
      hecho: 'Con la pinza de punta cerrás un poco la lengüeta y calzás la pila hasta que no se mueve. ' +
             'No hizo falta comprar nada.',
      nada: 'El portapila estaba firme: no había nada que ajustar.'
    },
    resetear_bios: {
      tool: 'pinza', g: 'accion', label: 'Sacar la pila 5 minutos para borrar el BIOS', min: 9, parte: 'pila',
      req: 'abrir', costo: 0, arregla: 'bios_clave',
      hecho: 'Con el equipo desenchufado sacás la pila con la pinza, esperás cinco minutos y la ponés de nuevo. ' +
             'La memoria CMOS se borra y la contraseña desaparece.',
      nada: 'El BIOS no tenía contraseña: perdiste nueve minutos y la configuración.'
    },
    limpiar_derrame: {
      tool: 'alcohol', g: 'accion', label: 'Limpiar el derrame de la pila con alcohol', min: 12, parte: 'pila',
      req: 'abrir', costo: 0, arregla: 'pila_derramada',
      hecho: 'Con pincel y alcohol isopropílico levantás la costra de los contactos y las pistas hasta que ' +
             'vuelve a verse el cobre. Después sí, pila nueva.',
      nada: 'No había derrame que limpiar.'
    },
    poner_hora: {
      g: 'accion', label: 'Poner la hora a mano y seguir', min: 2, parte: 'software',
      costo: 0, arregla: 'hora',
      hecho: '',
      nada: 'Dejás la hora bien... hasta que se apague el equipo: vuelve a 2023. Es un parche, no una reparación.'
    },
    cargar_defaults: {
      g: 'accion', label: 'Cargar los valores por defecto del BIOS', min: 4, parte: 'software',
      costo: 0, arregla: 'bios_cfg',
      hecho: '',
      nada: 'Cargaste los valores de fábrica y el problema sigue: la configuración no era la causa.'
    },

    usar_otro_toma: {
      lado: 'atras', g: 'accion', label: 'Enchufar el equipo en otro tomacorriente', min: 3, parte: 'cable',
      costo: 0, arregla: 'toma',
      hecho: 'Pasás la ficha a un tomacorriente que sí da tensión y avisás que hay que llamar al electricista.',
      nada: 'El tomacorriente daba tensión: el problema no estaba ahí.'
    },

    /* ----- Monitor, imagen y video ----- */
    probar_otro_monitor: {
      g: 'inspeccion', label: 'Probar el monitor con otro equipo', min: 4, parte: 'monitor',
      detecta: 'monitor',
      ok: 'El monitor enciende y muestra imagen con otra PC: está sano.',
      mal: 'El monitor no enciende ni conectado a otra PC: la luz de encendido no prende. Fuente interna muerta.'
    },
    probar_gpu_otro: {
      g: 'inspeccion', label: 'Probar la placa de video en otro equipo', min: 8, parte: 'gpu',
      req: 'abrir', detecta: 'gpu_rota',
      ok: 'En otro equipo la placa da imagen limpia y aguanta una prueba de carga.',
      mal: 'En otro equipo también aparecen rayas verdes y artefactos: la memoria de la placa está dañada.'
    },
    ver_hdmi: {
      lado: 'atras', g: 'inspeccion', label: 'Mover el cable HDMI y ver qué hace la imagen', min: 2, parte: 'monitor',
      detecta: 'hdmi_flojo',
      ok: 'Movés el cable en todos los sentidos y la imagen no cambia: la conexión es firme.',
      mal: 'Al mover el cable la imagen se limpia y vuelve a rayarse: el conector está flojo en el monitor.'
    },
    ajustar_hdmi: {
      lado: 'atras', g: 'accion', label: 'Reconectar el HDMI a fondo y sujetarlo', min: 2, parte: 'monitor',
      costo: 0, arregla: 'hdmi_flojo',
      hecho: 'Limpiás la ficha, la calzás hasta el tope en el monitor y la fijás con un precinto para que no tire.',
      nada: 'El cable ya estaba firme: no cambió nada.'
    },
    ver_cpu_power: {
      g: 'inspeccion', label: 'Revisar los cables de alimentación de la placa madre', min: 4, parte: 'placa',
      req: 'abrir', detecta: 'cable_cpu',
      ok: 'El conector de 24 pines y el de 8 pines del procesador están bien enchufados.',
      mal: 'El conector de 8 pines del procesador está sin enchufar, colgando atrás de la fuente.'
    },
    conectar_cpu: {
      g: 'accion', label: 'Enchufar el conector de 8 pines del procesador', min: 4, parte: 'placa',
      req: 'abrir', costo: 0, arregla: 'cable_cpu',
      hecho: 'Calzás el conector de 8 pines en la placa hasta que la traba hace clic.',
      nada: 'El conector ya estaba enchufado.'
    },

    /* ----- Memoria y sistema ----- */
    correr_memtest: {
      g: 'inspeccion', label: 'Correr una prueba de memoria (MemTest)', min: 20, parte: 'software',
      detecta: 'ram_rota',
      ok: 'Dos pasadas completas de MemTest sin ningún error.',
      mal: 'MemTest marca 3.412 errores en el módulo 2: las celdas de memoria están dañadas, no es un problema de asiento.'
    },
    ver_ram_cant: {
      g: 'inspeccion', label: 'Ver cuánta memoria hay y cuánta se usa', min: 3, parte: 'software',
      detecta: 'ram_poca',
      ok: 'Hay memoria de sobra: se usa menos de la mitad.',
      mal: 'Tiene sólo 4 GB y con el navegador abierto usa el 97%: pasa todo el tiempo trabajando con el disco.'
    },
    ampliar_ram: {
      g: 'accion', label: 'Agregar un módulo de memoria RAM', min: 8, parte: 'ram',
      req: 'abrir', costo: 38000, arregla: 'ram_poca',
      hecho: 'Ponés un módulo de 8 GB en la ranura libre: la máquina pasa a tener 12 GB.',
      nada: 'Memoria había de sobra: agregaste un módulo que no hacía falta.'
    },
    ver_arranque: {
      g: 'inspeccion', label: 'Probar el modo seguro y la reparación de inicio', min: 6, parte: 'software',
      detecta: 'so',
      ok: 'El modo seguro arranca bien: el sistema está sano.',
      mal: 'Ni el modo seguro ni la reparación de inicio levantan: los archivos del sistema están dañados.'
    },
    escanear_virus: {
      g: 'inspeccion', label: 'Escanear el equipo con un antivirus de rescate', min: 9, parte: 'software',
      detecta: 'malware',
      ok: 'El análisis termina limpio, sin amenazas.',
      mal: 'El análisis encuentra 14 amenazas: un adware instalado junto con un programa gratuito.'
    },
    limpiar_malware: {
      g: 'accion', label: 'Eliminar las amenazas y limpiar el navegador', min: 25, parte: 'software',
      costo: 0, arregla: 'malware',
      hecho: 'Cuarentena y eliminación de las 14 amenazas, extensiones sacadas y la página de inicio restaurada.',
      nada: 'No había nada que limpiar: perdiste 25 minutos.'
    },

    /* ----- Periféricos, disco y puertos ----- */
    probar_usb_trasero: {
      g: 'inspeccion', label: 'Probar el teclado en los USB de atrás', min: 2, parte: 'periferico',
      detecta: 'usb_frontal',
      ok: 'El teclado anda igual en los puertos de adelante y en los de atrás.',
      mal: 'En los puertos de atrás todo anda; en los de adelante, nada. El problema es el cable del panel frontal.'
    },
    ver_usb_frontal: {
      g: 'inspeccion', label: 'Revisar el cable USB del panel frontal', min: 4, parte: 'periferico',
      req: 'abrir', detecta: 'usb_frontal',
      ok: 'El cable USB del frente está calzado en los pines de la placa.',
      mal: 'El conector USB del panel frontal está desenchufado de la placa madre.'
    },
    conectar_usb_frontal: {
      g: 'accion', label: 'Enchufar el cable USB del panel frontal', min: 4, parte: 'periferico',
      req: 'abrir', costo: 0, arregla: 'usb_frontal',
      hecho: 'Calzás el conector en su par de pines USB, respetando la muesca.',
      nada: 'Los puertos de adelante ya estaban bien conectados.'
    },
    ver_audio: {
      g: 'inspeccion', label: 'Revisar el volumen y el dispositivo de salida de audio', min: 3, parte: 'periferico',
      detecta: 'audio_salida',
      ok: 'El volumen está al nivel correcto y la salida es la de los parlantes.',
      mal: 'El volumen está al máximo, pero la salida de audio está en "monitor HDMI" y el monitor no tiene parlantes.'
    },
    elegir_salida_audio: {
      g: 'accion', label: 'Elegir los parlantes como salida de audio', min: 2, parte: 'periferico',
      costo: 0, arregla: 'audio_salida',
      hecho: 'Elegís "Altavoces" como dispositivo predeterminado: vuelve el sonido.',
      nada: 'La salida de audio ya estaba bien elegida.'
    },
    ver_teclado: {
      g: 'inspeccion', label: 'Revisar el teclado de cerca', min: 3, parte: 'periferico',
      detecta: 'teclado_pegajoso',
      ok: 'Las teclas suben y bajan bien y no hay restos entre ellas.',
      mal: 'Hay restos de café seco entre las teclas: varias quedan hundidas y se repiten.'
    },
    limpiar_teclado: {
      tool: 'alcohol', g: 'accion', label: 'Desarmar y limpiar el teclado con alcohol', min: 20, parte: 'periferico',
      costo: 0, arregla: 'teclado_pegajoso',
      hecho: 'Sacás las teclas, limpiás la membrana con alcohol isopropílico y dejás secar. Vuelve a escribir bien.',
      nada: 'El teclado estaba limpio.'
    },
    cambiar_teclado: {
      g: 'accion', label: 'Cambiar el teclado', min: 3, parte: 'periferico',
      costo: 8500, arregla: 'teclado_roto',
      hecho: 'Conectás un teclado nuevo.',
      nada: 'Al teclado le alcanzaba con una limpieza: cambiaste uno entero.'
    },
    ver_sata: {
      g: 'inspeccion', label: 'Revisar los cables SATA del disco', min: 4, parte: 'disco',
      req: 'abrir', detecta: 'sata_flojo',
      ok: 'Los cables SATA de datos y de alimentación están calzados en los dos extremos.',
      mal: 'El cable SATA de datos está medio salido de la placa: el disco prende pero la placa no lo ve.'
    },
    reconectar_sata: {
      g: 'accion', label: 'Reconectar el cable SATA del disco', min: 3, parte: 'disco',
      req: 'abrir', costo: 0, arregla: 'sata_flojo',
      hecho: 'Calzás el cable SATA hasta el fondo en los dos extremos: el disco vuelve a aparecer.',
      nada: 'El cable ya estaba firme.'
    },

    /* ----- Fuente, reinicios y ruidos ----- */
    medir_consumo: {
      tool: 'tester', g: 'inspeccion', label: 'Medir los 12 V con la placa de video exigida', min: 6, parte: 'fuente',
      req: 'abrir', detecta: 'fuente_debil',
      ok: 'Los 12 V se mantienen en 12,1 V aun con carga: la fuente alcanza.',
      mal: 'Con la placa de video exigida los 12 V caen a 10,9 V y el equipo se reinicia: la fuente no da abasto.'
    },
    cambiar_fuente_potente: {
      tool: 'destornillador', g: 'accion', label: 'Cambiar por una fuente de 750 W', min: 22, parte: 'fuente',
      req: 'abrir', costo: 58000, arregla: 'fuente_debil',
      hecho: 'Montás una fuente de 750 W y recableás: ahora aguanta la placa de video a pleno.',
      nada: 'La fuente alcanzaba: cambiaste una pieza sana y cara.'
    },
    ver_separador: {
      g: 'inspeccion', label: 'Mirar la placa por atrás y los separadores', min: 5, parte: 'placa',
      req: 'abrir', detecta: 'corto_separador',
      ok: 'Cada separador de la chapa corresponde a un agujero de la placa: no sobra ninguno.',
      mal: 'Hay un separador metálico que sobra, justo donde la placa no tiene agujero: toca la parte de atrás y hace cortocircuito.'
    },
    quitar_separador: {
      tool: 'destornillador', g: 'accion', label: 'Sacar el separador que sobra', min: 10, parte: 'placa',
      req: 'abrir', costo: 0, arregla: 'corto_separador',
      hecho: 'Aflojás la placa, sacás el separador que sobra y la volvés a atornillar sólo en los agujeros que corresponden.',
      nada: 'No sobraba ningún separador: desarmaste la placa para nada.'
    },
    ver_boton_trabado: {
      g: 'inspeccion', label: 'Apretar el botón de encendido y ver cómo vuelve', min: 3, parte: 'boton',
      detecta: 'boton_trabado',
      ok: 'El botón se hunde y vuelve de una, con su clic de siempre.',
      mal: 'El botón queda medio hundido y vuelve lento: tiene restos pegajosos de gaseosa adentro.'
    },
    limpiar_boton: {
      tool: 'alcohol', g: 'accion', label: 'Limpiar el pulsador con alcohol', min: 6, parte: 'boton',
      costo: 0, arregla: 'boton_trabado',
      hecho: 'Con alcohol y un hisopo sacás la gaseosa seca: el botón vuelve a salir solo.',
      nada: 'El pulsador estaba limpio.'
    },
    ver_cableado: {
      g: 'inspeccion', label: 'Mirar los cables dentro del gabinete con la PC en marcha', min: 4, parte: 'cooler',
      req: 'abrir', detecta: 'cable_aspa',
      ok: 'Los cables están sujetos y lejos de los ventiladores.',
      mal: 'Un cable de la fuente quedó suelto y roza el aspa del ventilador a cada vuelta: ese es el golpeteo.'
    },
    acomodar_cables: {
      g: 'accion', label: 'Acomodar y atar los cables lejos del ventilador', min: 6, parte: 'cooler',
      req: 'abrir', costo: 0, arregla: 'cable_aspa',
      hecho: 'Juntás los cables con precintos y los pasás por detrás de la chapa: el ventilador gira libre.',
      nada: 'Los cables ya estaban ordenados.'
    }
  };
  Object.keys(NUEVOS).forEach(function (k) { STEPS[k] = NUEVOS[k]; });

  /* Qué pantalla muestra cada falla nueva al probar el equipo */
  var PANTALLA = {
    pila: 'cmos', pila_floja: 'cmos', pila_derramada: 'cmos', bios_clave: 'clave_bios',
    monitor: 'monitor_negro', gpu_rota: 'imagen_rota', hdmi_flojo: 'imagen_rota',
    ram_rota: 'pantallazo', so: 'so_roto', malware: 'virus', ram_poca: 'memoria_llena',
    usb_frontal: 'usb_sin', audio_salida: 'sin_sonido', teclado_pegajoso: 'teclado_mal',
    cable_aspa: 'ruido', sata_flojo: 'sin_arranque', cable_cpu: 'sin_senal',
    fuente_debil: 'reinicia', corto_separador: 'reinicia', boton_trabado: 'reinicia'
  };
  Object.keys(PANTALLA).forEach(function (k) { tech.FAULT_SCREEN[k] = PANTALLA[k]; });

  /* ---------------- Pantallas nuevas del monitor ---------------- */
  var POST = { at: 1200, beep: 'short', line: 'POST OK — 1 pitido corto', cls: 'ok' };
  var bench = GT.bench;
  bench.addSeq('so_roto', [POST,
    { at: 1800, line: 'Iniciando WinTEC . . .', cls: 'dim' },
    { at: 2600, mode: 'desktop' },
    { at: 3100, line: 'STOP 0xC000021A: falló un proceso crítico del sistema', cls: 'bad' },
    { at: 3900, line: 'Reparación de inicio: no se pudo reparar el equipo', cls: 'bad' },
    { at: 4600, line: 'Se reinicia y vuelve a fallar en el mismo lugar', cls: 'warn' }]);
  bench.addSeq('virus', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2400, line: '¡FELICITACIONES! GANASTE UN PREMIO — hacé clic acá', cls: 'warn' },
    { at: 3100, line: 'La página de inicio cambió a un buscador desconocido', cls: 'bad' },
    { at: 3800, line: 'Proceso desconocido usando el 90% del procesador', cls: 'bad' }]);
  bench.addSeq('monitor_negro', [
    { at: 0, led: true, fans: true, mode: 'black' },
    { at: 700, line: '· el equipo arrancó: ventiladores y luz de encendido OK', cls: 'dim' },
    { at: 1500, line: '· el monitor no muestra nada y su luz está apagada', cls: 'bad' },
    { at: 2300, line: '· el cable de video está bien puesto', cls: 'dim' }], true);
  bench.addSeq('imagen_rota', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2400, line: 'La imagen tiene rayas verdes y parpadeos', cls: 'bad' },
    { at: 3200, line: 'A veces se corta y vuelve sola', cls: 'warn' }]);
  bench.addSeq('pantallazo', [POST,
    { at: 1800, line: 'Iniciando WinTEC . . .', cls: 'dim' },
    { at: 2500, mode: 'desktop' },
    { at: 3200, line: 'STOP 0x0000001A: ERROR DE ADMINISTRACIÓN DE MEMORIA', cls: 'bad' },
    { at: 4000, line: 'El sistema se reinicia en 3 . . . 2 . . . 1', cls: 'warn' }]);
  bench.addSeq('memoria_llena', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2400, line: 'Memoria en uso: 97% (4 GB)', cls: 'bad' },
    { at: 3100, line: 'El sistema usa el disco como memoria: todo va a los tirones', cls: 'warn' },
    { at: 3800, line: 'Abrir una pestaña nueva congela la PC unos segundos', cls: 'bad' }]);
  bench.addSeq('usb_sin', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2400, line: 'USB del frente: dispositivo no reconocido', cls: 'bad' },
    { at: 3100, line: 'USB de atrás: teclado y mouse OK', cls: 'ok' },
    { at: 3800, line: 'Los cuatro puertos de adelante no entregan nada', cls: 'warn' }]);
  bench.addSeq('sin_sonido', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2400, line: 'Volumen al 100%: el medidor se mueve pero no sale sonido', cls: 'warn' },
    { at: 3200, line: 'Dispositivo de salida: Monitor (HDMI)', cls: 'bad' }]);
  bench.addSeq('ruido', [POST,
    { at: 1800, mode: 'desktop', temp: 55 },
    { at: 2500, line: 'tac-tac-tac . . . golpeteo desde el gabinete', cls: 'bad' },
    { at: 3200, line: 'Temperatura normal: 55 °C', cls: 'ok' },
    { at: 3900, line: 'El ruido sube y baja con las vueltas del ventilador', cls: 'warn' }]);
  bench.addSeq('reinicia', [POST,
    { at: 1800, mode: 'desktop', temp: 48 },
    { at: 2500, line: 'Todo normal por unos segundos . . .', cls: 'dim' },
    { at: 3300, mode: 'black', led: false, fans: false, temp: null,
      line: '— el equipo se reinició solo, sin pantalla azul —', cls: 'bad' },
    { at: 4200, line: 'Temperatura: 48 °C — no es por calor', cls: 'warn' }]);
  bench.addSeq('teclado_mal', [POST,
    { at: 1800, mode: 'desktop' },
    { at: 2500, line: 'Escribís "hola" y sale "hhhoooolllaaa"', cls: 'bad' },
    { at: 3200, line: 'Algunas teclas quedan hundidas y se repiten', cls: 'warn' }]);
  bench.addSeq('clave_bios', [
    { at: 1200, line: 'Ingrese la contraseña del BIOS:', cls: 'warn' },
    { at: 2000, line: '* * * * * *', cls: 'dim' },
    { at: 2800, line: 'Contraseña incorrecta. Intentos restantes: 1', cls: 'bad' },
    { at: 3600, line: 'Fecha del sistema: 01/01/2023', cls: 'dim' }]);

  /* ---------------- Órdenes ---------------- */
  /* Pasos que comparten las órdenes de la pila CMOS */
  var PILA = ['preguntar_reloj', 'ver_fecha_bios', 'abrir', 'medir_pila', 'ver_pila', 'cambiar_pila',
              'reasentar_pila', 'poner_hora', 'cargar_defaults'];
  function con(base, extra) { return base.concat(extra); }

  var NUEVAS = [

    /* ===== PILA CMOS ===== */
    {
      id: 'c10', titulo: 'La fecha vuelve a 2023',
      cliente: 'Carla — Recepción del consultorio', equipo: 'WinTEC Tower 2000, 6 años de uso',
      relato: '"Todas las mañanas la PC dice que estamos en 2023 y me pide apretar F1. Pongo la fecha ' +
              'bien y anda todo el día, pero al otro día otra vez."',
      presupuesto: 30, fallas: ['pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila: 'Al encender dice "CMOS checksum error", marca 01/01/2023 y pide F1 para continuar.' },
      exito: 'Se apaga, se desenchufa media hora y al volver a encender la fecha y la hora siguen bien.',
      pasos: con(PILA, ['ver_fuente', 'reinstalar_so']),
      diagnostico: {
        pregunta: '¿Por qué la PC volvía a 2023 cada mañana?',
        opciones: ['Un virus cambiaba la fecha del sistema', 'Se gastó la pila CMOS de la placa madre y el BIOS perdía la hora',
                   'La fuente de alimentación entregaba poca tensión', 'El sistema operativo estaba dañado'],
        correcta: 1,
        porque: 'La <b>pila CMOS</b> (una CR2032) alimenta el reloj y la configuración del BIOS cuando el equipo está ' +
                'apagado. Gastada, el BIOS vuelve a su fecha de fábrica (2023 en este modelo) y avisa con un ' +
                '<b>checksum error</b>. Ponerla a mano sólo dura hasta el próximo apagado: se cambia la pila.'
      },
      leccion: 'Si el equipo pierde la hora al apagarse, es la pila CMOS: se mide y se cambia, no se pone la hora a mano.'
    },
    {
      id: 'c11', titulo: 'Internet dice que el certificado venció',
      cliente: 'Ramiro — Estudiante de ingeniería', equipo: 'WinTEC Slim, comprada usada',
      relato: '"En todas las páginas me sale \'su conexión no es privada\' y no puedo entrar al campus. ' +
              'Mi amigo dice que no es internet, que mire la hora."',
      presupuesto: 30, fallas: ['pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila: 'El reloj marca 2023 y el navegador rechaza todos los certificados porque "todavía no empezaron a valer".' },
      exito: 'Con la hora correcta y que se conserva apagada, el navegador acepta los certificados y entra a todas las páginas.',
      pasos: con(PILA, ['ver_malware', 'reinstalar_so']),
      diagnostico: {
        pregunta: '¿Qué causaba los avisos de seguridad en todas las páginas?',
        opciones: ['El navegador estaba desactualizado', 'La red del cliente bloqueaba las páginas',
                   'La pila CMOS gastada dejaba la fecha en 2023 y los certificados parecían inválidos',
                   'Había un virus en el sistema'],
        correcta: 2,
        porque: 'Los certificados HTTPS tienen fecha de inicio y de vencimiento. Con el reloj atrasado a <b>2023</b>, ' +
                'todos parecen no válidos. Cuando "internet falla en todas las páginas con un aviso de seguridad", ' +
                'lo primero es <b>mirar la fecha</b>. Y si no la conserva apagado, el culpable es la pila.'
      },
      leccion: 'Avisos de certificado en todas las páginas: revisá la fecha y la hora antes de sospechar de la red.'
    },
    {
      id: 'c12', titulo: 'Pide F1 en cada arranque',
      cliente: 'Mauro — Taller mecánico', equipo: 'PC del mostrador, 8 años, llena de grasa',
      relato: '"Cada vez que la prendo aparece un cartel en inglés y tengo que apretar F1. Antes no pasaba. ' +
              'Lo cierro y anda, pero es una molestia."',
      presupuesto: 35, fallas: ['pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila: 'Aparece "CMOS battery low — Defaults loaded", la fecha vuelve a 2023 y espera que apretes F1.' },
      exito: 'Arranca de una, sin carteles, y la fecha queda guardada tras desenchufar el equipo.',
      pasos: con(PILA, ['escuchar_post', 'ver_ram', 'reasentar_ram', 'ver_disipador']),
      diagnostico: {
        pregunta: '¿Qué quería decir el cartel "CMOS battery low"?',
        opciones: ['Que la batería del equipo estaba por explotar', 'Que la memoria RAM estaba suelta',
                   'Que la pila de la placa madre estaba por agotarse y había que cambiarla',
                   'Que el disco estaba por fallar'],
        correcta: 2,
        porque: '<b>CMOS battery low</b> es el aviso literal del BIOS: la pila que mantiene la configuración está por ' +
                'agotarse. No es un error de arranque ni de memoria. Es un cambio de pila de pocos pesos, y se ' +
                'hace antes de que el equipo empiece a perder la fecha cada día.'
      },
      leccion: 'Los avisos del BIOS hay que leerlos: "CMOS battery low" ya dice qué cambiar.'
    },
    {
      id: 'c13', titulo: 'Se corta la luz y pierde todo',
      cliente: 'Sofía — Biblioteca popular', equipo: 'WinTEC Tower 1500, sin UPS',
      relato: '"Cuando hay un corte de luz en el barrio, al volver la PC está en 2023 y a veces no sabe ' +
              'ni de dónde arrancar. Ya la configuramos tres veces este mes."',
      presupuesto: 35, fallas: ['pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila: 'Tras un corte vuelve a 2023, el BIOS pierde su configuración y cuesta que arranque.' },
      exito: 'Se corta la energía a propósito y al volver el equipo conserva la fecha y su configuración.',
      pasos: con(PILA, ['ver_fuente', 'ver_toma', 'ver_cable']),
      diagnostico: {
        pregunta: '¿Qué hacía que el equipo "olvidara" todo con cada corte?',
        opciones: ['El tomacorriente de la biblioteca estaba dañado', 'Una pila CMOS agotada que no sostenía el BIOS sin corriente',
                   'La fuente se quemaba con cada corte', 'El disco perdía el sistema'],
        correcta: 1,
        porque: 'Con corriente, la placa se alimenta de la fuente. Cuando se corta la luz, el reloj y el BIOS ' +
                'dependen <b>sólo de la pila CMOS</b>. Si está agotada, se borran y el equipo vuelve a la fecha de ' +
                'fábrica. Esa pila es lo que diferencia "perder la luz un rato" de "perder la configuración".'
      },
      leccion: 'La pila CMOS es lo único que mantiene al BIOS cuando no hay corriente: sin ella, cada corte lo borra.'
    },
    {
      id: 'c14', titulo: 'El reloj atrasa en el aula',
      cliente: 'Escuela N.º 14 — PC del aula de tercero', equipo: 'WinTEC Tower 2000, compartida por tres cursos',
      relato: '"La profe pasa lista con esa máquina y la fecha sale cualquiera. Un día dice 2023, otro día ' +
              'otra cosa. La dejan apagada los fines de semana."',
      presupuesto: 30, fallas: ['pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila: 'Después de cada fin de semana apagada, la PC arranca con 01/01/2023 y el BIOS avisa de un error de CMOS.' },
      exito: 'Pasa el fin de semana desenchufada y el lunes arranca con la fecha y la hora correctas.',
      pasos: con(PILA, ['ver_malware', 'ver_carga']),
      diagnostico: {
        pregunta: '¿Por qué el problema aparecía sobre todo después del fin de semana?',
        opciones: ['El sistema se actualizaba solo y cambiaba la hora', 'La profesora configuraba mal la fecha',
                   'Apagada tantos días, la pila CMOS casi sin carga no llegaba a sostener el reloj',
                   'El disco se enfriaba y perdía datos'],
        correcta: 2,
        porque: 'Una pila a medio gastar aguanta unas horas, pero no <b>dos días de equipo apagado</b>. Por eso ' +
                'el síntoma es "después de un rato sin corriente". Medida con el tester da 1,5 V cuando debería ' +
                'dar 3 V. Cambiarla es lo único que lo arregla.'
      },
      leccion: 'Un síntoma que aparece "después de estar apagada un tiempo" apunta a la pila CMOS.'
    },
    {
      id: 'c15', titulo: 'Facturas con fecha de 2023',
      cliente: 'Almacén Don Pepe', equipo: 'WinTEC Slim, con el disipador cubierto de harina',
      relato: '"Me salieron cuatro facturas con fecha de 2023 y el contador me quiere matar. Además la ' +
              'máquina se apaga sola a la tarde."',
      antecedente: 'Antecedente: dos cosas distintas pueden estar rotas a la vez. Arreglá la primera y volvé a probar.',
      presupuesto: 55, fallas: ['pila', 'polvo'], piezas: ['pila', 'cooler'], pantallaOk: 'cmos_ok',
      sintomas: {
        pila: 'Cada mañana arranca en 2023 y pide F1; las facturas salen con la fecha equivocada.',
        polvo: 'La fecha ya se conserva, pero a los pocos minutos de uso se apaga de golpe.'
      },
      exito: 'Fecha correcta tras desenchufarla y media hora de carga sin apagados.',
      pasos: con(PILA, ['preguntar', 'medir_temp', 'ver_disipador', 'limpiar_polvo', 'cambiar_pasta']),
      diagnostico: {
        pregunta: 'La PC del almacén tenía dos fallas independientes. ¿Cuáles?',
        opciones: ['Virus y disco dañado', 'Pila CMOS agotada y disipador tapado de polvo',
                   'Fuente débil y RAM suelta', 'Sólo la pasta térmica seca'],
        correcta: 1,
        porque: 'La fecha de 2023 es de la <b>pila CMOS</b>; el apagado a la tarde, del <b>polvo</b> en el disipador. ' +
                'Son fallas sin relación, y por eso conviene probar el equipo entre una reparación y otra: al ' +
                'resolver la primera cambia el síntoma y aparece la segunda.'
      },
      leccion: 'Un equipo puede tener dos fallas sin relación: reparás una, probás, y mirás qué síntoma queda.'
    },
    {
      id: 'c16', titulo: 'La pila vieja derramó',
      cliente: 'Beto — Taller de electrónica', equipo: 'WinTEC Tower 1000, guardada 3 años',
      relato: '"La tenía guardada sin usar. La prendo y el reloj dice 2023, no guarda nada, y cuando miré ' +
              'adentro la pila estaba hinchada con una mancha blanca alrededor."',
      antecedente: 'Antecedente: una pila vieja puede derramar y comerse el cobre. Limpiá antes de poner una nueva.',
      presupuesto: 50, fallas: ['pila_derramada', 'pila'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: {
        pila_derramada: 'Arranca en 2023 con error de CMOS; alrededor de la pila hay una costra blanca y verdosa.',
        pila: 'Con los contactos limpios, la pila vieja sigue sin retener nada: la fecha vuelve a 2023.'
      },
      exito: 'Contactos limpios, pila nueva y fecha conservada apagado.',
      pasos: con(PILA, ['ver_derrame', 'limpiar_derrame', 'ver_sulfato', 'limpiar_sulfato', 'cambiar_placa']),
      diagnostico: {
        pregunta: 'Antes de poner la pila nueva, ¿qué había que hacer?',
        opciones: ['Cambiar la placa madre entera', 'Limpiar con alcohol isopropílico el derrame de la pila vieja',
                   'Reinstalar el sistema operativo', 'Nada: poner la pila nueva alcanzaba'],
        correcta: 1,
        porque: 'Una pila agotada puede <b>hincharse y derramar</b>. El líquido corroe los contactos y las pistas ' +
                'vecinas. Si ponés la pila nueva sobre esa costra, el contacto sigue fallando. Se limpia con ' +
                '<b>alcohol isopropílico</b> hasta ver el cobre brillante, y recién después se cambia la pila. La placa ' +
                'no se tira.'
      },
      leccion: 'Pila hinchada o con costra: limpiá el derrame con alcohol antes de poner la nueva; la placa no se cambia.'
    },
    {
      id: 'c17', titulo: 'Pila nueva y sigue en 2023',
      cliente: 'Gonzalo — Local de computación vecino', equipo: 'WinTEC Slim, ya "reparada" por otro',
      relato: '"Me la devolvieron con pila nueva y sigue perdiendo la hora. Me cobraron la pila y el trabajo. ' +
              'No sé si me estafaron o si la placa está mal."',
      antecedente: 'Antecedente: la pila es nueva. Antes de comprar nada, medila y mirá cómo está calzada.',
      presupuesto: 30, fallas: ['pila_floja'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { pila_floja: 'Pierde la fecha, marca 2023 y avisa de CMOS aunque la pila sea nueva: a veces conserva la hora y a veces no.' },
      exito: 'Se mueve el gabinete, se apaga y se desenchufa: la fecha se conserva siempre.',
      pasos: con(PILA, ['ver_placa_lupa', 'ver_fuente']),
      diagnostico: {
        pregunta: 'La pila era nueva y sana. ¿Entonces por qué perdía la hora?',
        opciones: ['La placa madre tenía el reloj dañado', 'La pila estaba floja en el portapila y hacía contacto a ratos',
                   'La pila nueva venía de fábrica descargada', 'El BIOS estaba desactualizado'],
        correcta: 1,
        porque: 'El tester daba <b>3,1 V</b>: la pila estaba sana. Lo que fallaba era el <b>contacto mecánico</b>: la ' +
                'lengüeta del portapila abierta dejaba bailar la pila. Se arregla con una pinza, gratis. Comprar ' +
                'otra pila hubiera sido tirar plata: <b>medir antes de cambiar</b>.'
      },
      leccion: 'Antes de cambiar la pila, medila: si da 3 V, el problema es el contacto y no la pila.'
    },
    {
      id: 'c18', titulo: 'No da imagen y la fecha está en 2023',
      cliente: 'Valeria — Estudio contable', equipo: 'WinTEC Tower 3000, armada en 2023',
      relato: '"Anoche se me quedó sin luz el edificio. Hoy no da imagen y, cuando lo hace, me dice que ' +
              'es 2023. Una cosa y la otra, no sé."',
      antecedente: 'Antecedente: fallas encadenadas: la que se ve primero es la que tapa a las otras.',
      presupuesto: 50, fallas: ['ram', 'pila'], piezas: ['ram', 'pila'], pantallaOk: 'cmos_ok',
      sintomas: {
        ram: 'Enciende, los ventiladores giran y la pantalla queda negra con un pitido largo y dos cortos.',
        pila: 'Ya arranca, pero muestra "CMOS battery low", marca 2023 y pide F1.'
      },
      exito: 'POST limpio, fecha y hora correctas incluso después de desenchufarla.',
      pasos: con(PILA, ['escuchar_post', 'ver_ram', 'reasentar_ram', 'cambiar_ram', 'ver_gpu']),
      diagnostico: {
        pregunta: '¿Qué dos fallas tenía este equipo?',
        opciones: ['Fuente y placa de video', 'RAM mal asentada y pila CMOS agotada',
                   'Disco dañado y sistema corrupto', 'Sólo la pila CMOS'],
        correcta: 1,
        porque: 'La <b>RAM suelta</b> frenaba el POST con pitidos y tapaba todo lo demás. Al resolverla, ' +
                'apareció lo segundo: el aviso de <b>CMOS battery low</b> y la fecha en 2023. Un síntoma fuerte ' +
                'esconde los débiles: hay que volver a probar después de cada arreglo.'
      },
      leccion: 'Una falla grave puede esconder otra chica: después de cada arreglo, volvé a probar.'
    },
    {
      id: 'c19', titulo: 'Comprada en 2023 y ya pierde la hora',
      cliente: 'Facundo — Cliente de una tienda online', equipo: 'WinTEC Tower 2000, comprada en 2023',
      relato: '"La compré en 2023 y hace un mes que arranca con una fecha rara, y además se calienta y se ' +
              'apaga cuando juego. Tiene que estar todo en garantía, ¿no?"',
      antecedente: 'Antecedente: la garantía no cubre desgaste de insumos como la pila o la pasta térmica.',
      presupuesto: 55, fallas: ['pila', 'pasta'], piezas: ['pila', 'cooler'], pantallaOk: 'cmos_ok',
      sintomas: {
        pila: 'Arranca con la fecha de 2023, pide F1 y marca error de CMOS.',
        pasta: 'La fecha ya está bien, pero con carga el CPU trepa a 97 °C y se apaga.'
      },
      exito: 'Fecha correcta tras apagarla y una hora de juego sin apagados: CPU estable en 63 °C.',
      pasos: con(PILA, ['medir_temp', 'ver_disipador', 'ver_pasta', 'cambiar_pasta', 'limpiar_polvo', 'cambiar_vent']),
      diagnostico: {
        pregunta: '¿Qué dos fallas de desgaste tenía el equipo?',
        opciones: ['Placa de video y fuente', 'Pila CMOS agotada y pasta térmica seca',
                   'Disco y memoria RAM', 'Sólo ventilador trabado'],
        correcta: 1,
        porque: 'Son los dos insumos que se gastan: la <b>pila CMOS</b> (fecha perdida y error de CMOS) y la ' +
                '<b>pasta térmica</b> (apagados con carga a 97 °C). Ninguna es un defecto de fábrica: se cambian ' +
                'en un mantenimiento y cuestan muy poco al lado de cualquier otra pieza.'
      },
      leccion: 'Pila CMOS y pasta térmica son insumos de mantenimiento: se gastan y se reponen.'
    },

    /* ===== OTRAS FALLAS ===== */
    {
      id: 'c20', titulo: 'Todo prende menos la pantalla',
      cliente: 'Hernán — Estudio de diseño', equipo: 'WinTEC Tower 3000 con monitor de 22"',
      relato: '"Se escuchan los ventiladores y la torre prende, pero el monitor está completamente negro, ' +
              'ni una luz. Ya probé cambiarle el cable."',
      presupuesto: 30, fallas: ['monitor'], pieza: 'monitor',
      sintomas: { monitor: 'La torre arranca bien, pero el monitor no muestra nada y ni siquiera enciende su luz.' },
      exito: 'Con otro monitor aparece el BIOS y arranca el sistema normalmente.',
      pasos: ['ver_cable_video', 'probar_otro_monitor', 'abrir', 'ver_gpu', 'ver_ram', 'pasar_video',
              'cambiar_monitor', 'reasentar_gpu', 'cambiar_gpu'],
      diagnostico: {
        pregunta: '¿Dónde estaba la falla?',
        opciones: ['En la placa de video', 'En el cable de video', 'En el monitor, que no encendía ni en otro equipo', 'En la fuente de la PC'],
        correcta: 2,
        porque: 'Los ventiladores girando y la luz de encendido OK dicen que la <b>PC está bien</b>. La prueba ' +
                'definitiva es llevar el monitor a <b>otro equipo</b>: si tampoco enciende, el problema es el monitor, ' +
                'no la placa de video ni el cable. Cambiar piezas de la torre hubiera sido tirar plata.'
      },
      leccion: 'Aislá el componente: probá el monitor en otro equipo antes de tocar la torre.'
    },
    {
      id: 'c21', titulo: 'Chasquido y olor a quemado',
      cliente: 'Panadería La Espiga', equipo: 'WinTEC Tower 1500 al lado del horno',
      relato: '"Se escuchó un chasquido, salió olor a quemado y se apagó. Ahora no hay manera de prenderla."',
      presupuesto: 35, fallas: ['fuente'], pieza: 'fuente',
      sintomas: { fuente: 'Sin luces, sin ventiladores, y la torre huele a componente quemado.' },
      exito: 'Con la fuente nueva prende la luz, giran los ventiladores y arranca el sistema.',
      pasos: ['ver_cable', 'ver_toma', 'ver_switch', 'abrir', 'ver_fuente', 'ver_boton', 'cambiar_fuente',
              'cambiar_cable', 'conectar_boton', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Cómo se confirmó que la fuente era la culpable?',
        opciones: ['La PC no encendía y listo', 'Puenteada, la fuente no arrancaba ni el ventilador giraba',
                   'El cable de alimentación estaba cortado', 'La placa madre estaba quemada'],
        correcta: 1,
        porque: 'Primero se descartó lo barato: cable, toma e interruptor. Después, la prueba clásica: ' +
                '<b>puentear el conector de 24 pines</b> y ver si arranca. Si no arranca, la fuente está muerta. ' +
                'Y el olor a quemado es lo que suele acompañar a un capacitor reventado.'
      },
      leccion: 'Para confirmar una fuente: cable, toma y interruptor primero, y después puentear los 24 pines.'
    },
    {
      id: 'c22', titulo: 'Un toma sin tensión',
      cliente: 'Consultorio Dr. Paz', equipo: 'WinTEC Slim conectada a una zapatilla',
      relato: '"Cambié de lugar el escritorio, enchufé la compu en la pared de al lado y ahora no prende. ' +
              'Yo digo que se rompió al moverla."',
      presupuesto: 20, fallas: ['toma'], pieza: 'cable',
      sintomas: { toma: 'No tiene luces ni ventiladores. La zapatilla tampoco enciende su luz.' },
      exito: 'Enchufada en otro tomacorriente enciende de una y arranca.',
      pasos: ['ver_cable', 'ver_toma', 'ver_switch', 'abrir', 'ver_fuente', 'usar_otro_toma',
              'cambiar_cable', 'cambiar_fuente'],
      diagnostico: {
        pregunta: '¿Por qué no prendía la PC?',
        opciones: ['Se rompió la fuente con el traslado', 'El cable de alimentación estaba cortado',
                   'El tomacorriente de la pared no daba tensión', 'La placa madre se dañó al moverla'],
        correcta: 2,
        porque: 'Antes de abrir la PC, se prueba el <b>tomacorriente con otro equipo</b> o con una lámpara. Si no ' +
                'hay tensión, el equipo está sano: se enchufa en otro toma. Es gratis y toma tres minutos; abrir ' +
                'el gabinete y cambiar la fuente no lo hubiera resuelto.'
      },
      leccion: 'Si el equipo no da señales, probá el toma con otro aparato antes de abrir nada.'
    },
    {
      id: 'c23', titulo: 'Rayas verdes al jugar',
      cliente: 'Tomás — Estudiante gamer', equipo: 'WinTEC Tower 4000 con placa de video dedicada',
      relato: '"Al abrir un juego aparecen rayas verdes y se cuelga la imagen. En el escritorio a veces ' +
              'también. Hasta ayer andaba perfecta."',
      presupuesto: 55, fallas: ['gpu_rota'], pieza: 'gpu',
      sintomas: { gpu_rota: 'Imagen con rayas verdes y parpadeos que se cortan solos.' },
      exito: 'Con la placa nueva la imagen es limpia y soporta media hora de juego sin artefactos.',
      pasos: ['ver_gpu', 'abrir', 'probar_gpu_otro', 'medir_temp', 'ver_disipador', 'reasentar_gpu',
              'cambiar_gpu', 'limpiar_polvo', 'cambiar_monitor', 'reinstalar_so'],
      diagnostico: {
        pregunta: '¿Cómo se supo que la placa de video estaba dañada y no sólo mal asentada?',
        opciones: ['Porque estaba floja en el zócalo', 'Porque el monitor se veía mal',
                   'Porque en otro equipo también aparecían los artefactos', 'Porque se calentaba el procesador'],
        correcta: 2,
        porque: 'Reasentarla no cambió nada, y en <b>otro equipo se repetían las rayas</b>: el defecto viaja con la ' +
                'placa, así que está en la placa (memoria dañada). Es la pieza más cara del taller, por eso ' +
                'conviene probarla antes de comprar otra.'
      },
      leccion: 'Los artefactos que viajan con la pieza a otro equipo confirman que está dañada.'
    },
    {
      id: 'c24', titulo: 'Pantallazos azules',
      cliente: 'Inés — Diseñadora gráfica', equipo: 'WinTEC Tower 3000, 2 módulos de RAM',
      relato: '"Aparece una pantalla azul con letras blancas y se reinicia sola, siempre en distintos ' +
              'programas. Reinstalé el sistema y sigue igual."',
      presupuesto: 55, fallas: ['ram_rota'], pieza: 'ram',
      sintomas: { ram_rota: 'Arranca, pero a los minutos aparece una pantalla azul de error de memoria y se reinicia.' },
      exito: 'Con el módulo nuevo, dos horas de prueba sin una sola pantalla azul.',
      pasos: ['escuchar_post', 'abrir', 'ver_ram', 'correr_memtest', 'ver_malware', 'reasentar_ram',
              'cambiar_ram', 'reinstalar_so', 'cambiar_disco', 'ver_carga'],
      diagnostico: {
        pregunta: 'Reinstalar el sistema no resolvió nada. ¿Por qué?',
        opciones: ['Porque faltaba un driver', 'Porque la falla era de hardware: un módulo de RAM con celdas dañadas',
                   'Porque el disco estaba lleno', 'Porque el antivirus bloqueaba la instalación'],
        correcta: 1,
        porque: 'Pantallas azules distintas en programas distintos son la firma de <b>memoria defectuosa</b>. ' +
                '<b>MemTest</b> lo confirma con miles de errores, y volver a asentar el módulo no ayuda: las celdas ' +
                'están dañadas. El software se reinstala todas las veces que quieras; la RAM mala hay que cambiarla.'
      },
      leccion: 'Pantallas azules variadas: probá la memoria con MemTest antes de reinstalar el sistema.'
    },
    {
      id: 'c25', titulo: 'Windows no arranca tras una actualización',
      cliente: 'Municipalidad — Mesa de entradas', equipo: 'WinTEC Tower 2000, sin datos locales importantes',
      relato: '"Se cortó la luz mientras se actualizaba y desde entonces da un error y se reinicia. Todos ' +
              'los archivos están en el servidor, así que no hay drama."',
      presupuesto: 60, fallas: ['so'], pieza: 'software',
      sintomas: { so: 'Pasa el POST y falla al cargar el sistema: pantalla azul de error crítico y reinicio.' },
      exito: 'Con el sistema reinstalado arranca en 40 segundos y queda listo para entregar.',
      pasos: ['escuchar_post', 'ver_arranque', 'test_smart', 'abrir', 'ver_ram', 'reinstalar_so', 'cambiar_disco',
              'cambiar_ram', 'ver_carga'],
      diagnostico: {
        pregunta: '¿Cuándo corresponde reinstalar el sistema operativo?',
        opciones: ['Siempre que la PC anda mal', 'Cuando el hardware está sano y el sistema está dañado de verdad',
                   'Cuando se calienta el procesador', 'Cuando hay pitidos en el POST'],
        correcta: 1,
        porque: 'Acá el POST pasaba, el disco estaba sano (SMART limpio) y la RAM bien: <b>el hardware andaba</b>. ' +
                'Ni el modo seguro ni la reparación de inicio levantaban, así que los archivos del sistema estaban ' +
                'dañados por el corte durante la actualización. En ese caso sí se reinstala, y los datos estaban a ' +
                'salvo en el servidor.'
      },
      leccion: 'Reinstalar es el último paso y sólo cuando se descartó el hardware.'
    },
    {
      id: 'c26', titulo: 'Se abren páginas solas',
      cliente: 'Doña Rosa — Jubilada', equipo: 'WinTEC Slim, la usa para videollamadas',
      relato: '"Se me abren ventanas con premios, la página de inicio cambió y está lentísima. Mi nieto ' +
              'me instaló un programa gratis para bajar música."',
      presupuesto: 40, fallas: ['malware'], pieza: 'software',
      sintomas: { malware: 'Aparecen ventanas con publicidad, la página de inicio cambió y un proceso desconocido usa el 90% del procesador.' },
      exito: 'Sin ventanas emergentes, con la página de inicio restaurada y el procesador en reposo.',
      pasos: ['preguntar', 'escanear_virus', 'ver_carga', 'abrir', 'ver_disipador', 'limpiar_malware',
              'reinstalar_so', 'cambiar_disco', 'limpiar_polvo'],
      diagnostico: {
        pregunta: '¿Qué convenía hacer antes de pensar en reinstalar?',
        opciones: ['Cambiar el disco duro', 'Escanear y eliminar el adware con un antivirus de rescate',
                   'Cambiar el procesador', 'Formatear de entrada para estar seguros'],
        correcta: 1,
        porque: 'Los síntomas (ventanas, página de inicio cambiada, un proceso que consume el CPU) son de ' +
                '<b>adware</b>, y se limpia con un análisis y una limpieza del navegador. Formatear funciona pero ' +
                'cuesta 40 minutos y los datos de la clienta; el análisis tarda nueve y no pierde nada.'
      },
      leccion: 'Ventanas y páginas raras: escaneá antes de formatear.'
    },
    {
      id: 'c27', titulo: 'Los USB de adelante no andan',
      cliente: 'Estudio de arquitectura Funes', equipo: 'WinTEC Tower 2000, gabinete nuevo',
      relato: '"Cambiamos el gabinete la semana pasada y desde entonces el pendrive y el mouse no andan en ' +
              'los puertos de adelante. Atrás sí."',
      presupuesto: 25, fallas: ['usb_frontal'], pieza: 'periferico',
      sintomas: { usb_frontal: 'Los puertos USB del frente no reconocen nada; los de atrás funcionan.' },
      exito: 'Pendrive y mouse reconocidos en los cuatro puertos del frente.',
      pasos: ['probar_usb_trasero', 'abrir', 'ver_usb_frontal', 'conectar_usb_frontal', 'ver_boton', 'ver_fuente',
              'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Por qué no andaban los USB del frente?',
        opciones: ['La placa madre tenía los puertos quemados', 'El sistema operativo no tenía los drivers',
                   'El cable USB del panel frontal quedó desenchufado al cambiar el gabinete', 'La fuente no daba energía'],
        correcta: 2,
        porque: 'Si los puertos de <b>atrás funcionan</b>, la placa y el sistema están bien. Los de adelante dependen ' +
                'de un cable que va del panel a los pines de la placa, y al cambiar el gabinete se soltó. Cambiar ' +
                'la placa no hacía falta: era un conector.'
      },
      leccion: 'Si andan unos puertos y otros no, seguí el cable de los que fallan hasta la placa.'
    },
    {
      id: 'c28', titulo: 'No se escucha nada',
      cliente: 'Patricia — Docente de música', equipo: 'WinTEC Slim con parlantes externos',
      relato: '"Puse una canción y no se escucha. El volumen está al máximo y los parlantes están prendidos. ' +
              'Ayer andaban."',
      presupuesto: 20, fallas: ['audio_salida'], pieza: 'periferico',
      sintomas: { audio_salida: 'El medidor de volumen se mueve pero no sale sonido por los parlantes.' },
      exito: 'Suena la canción de prueba por los parlantes.',
      pasos: ['preguntar', 'ver_audio', 'abrir', 'ver_fuente', 'elegir_salida_audio', 'reinstalar_so', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Cuál era el problema?',
        opciones: ['Los parlantes estaban rotos', 'La placa de sonido se quemó',
                   'El sistema mandaba el audio al monitor HDMI en lugar de a los parlantes', 'Faltaba reinstalar el sistema'],
        correcta: 2,
        porque: 'Al conectar el monitor por HDMI, el sistema cambió la <b>salida de audio</b> a ese dispositivo, que ' +
                'no tiene parlantes. Con el medidor moviéndose, la PC genera sonido: falla el destino. Se elige ' +
                'la salida correcta en dos minutos y no hace falta tocar nada del equipo.'
      },
      leccion: 'Sin sonido: revisá primero qué dispositivo de salida está elegido.'
    },
    {
      id: 'c29', titulo: 'Un golpeteo adentro del gabinete',
      cliente: 'Federico — Programador', equipo: 'WinTEC Tower 3000, armada por él',
      relato: '"Hace un tac-tac-tac constante, como una tarjeta de cartón en una bicicleta. No se calienta ' +
              'ni se apaga. Sólo ese ruido, que me enloquece."',
      presupuesto: 30, fallas: ['cable_aspa'], pieza: 'cooler',
      sintomas: { cable_aspa: 'Golpeteo constante que sube y baja con las vueltas del ventilador; la temperatura es normal.' },
      exito: 'El ventilador gira libre y en silencio.',
      pasos: ['preguntar', 'ver_filtros', 'abrir', 'ver_cableado', 'medir_rpm', 'ver_disipador',
              'acomodar_cables', 'cambiar_vent', 'limpiar_polvo'],
      diagnostico: {
        pregunta: '¿Qué causaba el golpeteo?',
        opciones: ['Un ventilador con el rodamiento gastado', 'Un cable suelto que rozaba el aspa del ventilador',
                   'El disco duro por fallar', 'La fuente'],
        correcta: 1,
        porque: 'El ventilador giraba bien (vueltas normales) y la temperatura también: <b>no estaba roto</b>. El ruido ' +
                'subía y bajaba con las vueltas porque algo golpeaba cada aspa. Era un cable suelto. Ordenarlo con ' +
                'precintos no cuesta nada; cambiar el ventilador hubiera sido plata tirada.'
      },
      leccion: 'Un ruido que sigue las vueltas del ventilador: buscá qué lo roza antes de cambiarlo.'
    },
    {
      id: 'c30', titulo: 'Muy lenta con pocas pestañas',
      cliente: 'Lucía — Estudiante de diseño', equipo: 'WinTEC Slim con 4 GB de RAM',
      relato: '"Con tres pestañas abiertas se traba todo. Antes no pasaba tanto, pero ahora uso programas ' +
              'más pesados. ¿Tendré un virus?"',
      presupuesto: 30, fallas: ['ram_poca'], pieza: 'ram',
      sintomas: { ram_poca: 'Todo va a los tirones: usa el 97% de la memoria y trabaja con el disco todo el tiempo.' },
      exito: 'Con 12 GB, el sistema usa la mitad de la memoria y las pestañas abren al instante.',
      pasos: ['ver_ram_cant', 'test_smart', 'abrir', 'ampliar_ram', 'cambiar_disco', 'reinstalar_so', 'limpiar_polvo'],
      diagnostico: {
        pregunta: '¿Por qué estaba lenta?',
        opciones: ['Tenía un virus', 'El disco estaba por fallar',
                   'Tenía poca memoria RAM para los programas que usa', 'El procesador estaba lento'],
        correcta: 2,
        porque: 'Un equipo con <b>4 GB</b> que usa el 97% de la memoria empieza a usar el disco como RAM, y todo se ' +
                'vuelve lento. No hay virus ni disco dañado (SMART sano): faltaba memoria. Se agrega un módulo y ' +
                'se resuelve sin reinstalar ni cambiar el disco.'
      },
      leccion: 'Lentitud con la memoria al límite: más RAM resuelve lo que un formateo no.'
    },
    {
      id: 'c31', titulo: 'Disco de arranque no encontrado',
      cliente: 'Club de barrio — Secretaría', equipo: 'WinTEC Tower 1500, disco mecánico',
      relato: '"Anoche andaba. Hoy dice que no encuentra el disco de arranque. Mi hijo dice que se rompió ' +
              'el disco y hay que comprar uno nuevo."',
      presupuesto: 30, fallas: ['sata_flojo'], pieza: 'disco',
      sintomas: { sata_flojo: 'Pasa el POST pero dice "disco de arranque no encontrado" y no carga el sistema.' },
      exito: 'El disco aparece y el sistema arranca con todos sus datos.',
      pasos: ['escuchar_disco', 'test_smart', 'abrir', 'ver_sata', 'reconectar_sata', 'cambiar_disco', 'reinstalar_so', 'ver_ram'],
      diagnostico: {
        pregunta: '¿Qué pasaba con el disco?',
        opciones: ['Estaba roto y había que cambiarlo', 'El cable SATA estaba flojo y la placa no lo veía',
                   'El sistema se había borrado', 'La fuente no lo alimentaba'],
        correcta: 1,
        porque: 'El disco <b>giraba</b> (se lo oía) pero la placa no lo veía: fallaba el <b>cable de datos</b>, ' +
                'medio salido. Un cable flojo se resuelve en tres minutos y sin gastar nada. Cambiar el disco habría ' +
                'costado plata y, de paso, los datos del club.'
      },
      leccion: 'Disco que gira pero no aparece: revisá los cables antes de culpar al disco.'
    },
    {
      id: 'c32', titulo: 'Se reinicia al abrir juegos',
      cliente: 'Dylan — Jugador de fines de semana', equipo: 'WinTEC Tower 4000, fuente de 500 W',
      relato: '"Anda perfecta en el escritorio, pero cuando abro un juego pesado se reinicia sola. Compré ' +
              'una placa de video mejor hace un mes."',
      presupuesto: 55, fallas: ['fuente_debil'], pieza: 'fuente',
      sintomas: { fuente_debil: 'En reposo anda bien; al exigir la placa de video se reinicia sola, sin pantalla azul.' },
      exito: 'Una hora de juego a pleno sin un solo reinicio: los 12 V se mantienen firmes.',
      pasos: ['medir_temp', 'abrir', 'ver_gpu', 'medir_consumo', 'ver_fuente', 'cambiar_fuente',
              'cambiar_fuente_potente', 'cambiar_gpu', 'limpiar_polvo'],
      diagnostico: {
        pregunta: '¿Por qué se reiniciaba solo al jugar?',
        opciones: ['La placa de video nueva estaba dañada', 'El procesador se recalentaba',
                   'La fuente de 500 W no alcanzaba para la placa de video nueva', 'Había un virus'],
        correcta: 2,
        porque: 'La temperatura era normal y la placa de video, buena. Al <b>medir los 12 V con carga</b> caían a ' +
                '10,9 V. Una fuente chica anda en reposo y se rinde cuando la placa de video pide más. ' +
                'Cambiar una fuente igual de chica no sirve: hay que subir la potencia.'
      },
      leccion: 'Si falla sólo con carga, medí la tensión bajo carga: la fuente puede ser chica.'
    },
    {
      id: 'c33', titulo: 'Se reinicia si la tocás',
      cliente: 'Julián — Armó la PC él mismo', equipo: 'WinTEC Tower 3000, recién armada',
      relato: '"La armé el finde. Anda, pero si apoyo la mano en el gabinete o cierro la puerta fuerte, se ' +
              'reinicia sola. Probé tres fuentes distintas."',
      presupuesto: 40, fallas: ['corto_separador'], pieza: 'placa',
      sintomas: { corto_separador: 'Se reinicia sola al moverla o golpearla, aunque la temperatura sea normal.' },
      exito: 'La golpeás suave con los nudillos y sigue andando, sin reinicios.',
      pasos: ['abrir', 'ver_separador', 'ver_placa_lupa', 'medir_continuidad', 'quitar_separador', 'reasentar_ram',
              'cambiar_fuente', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Qué le pasaba a la placa?',
        opciones: ['Tenía la pista cortada de fábrica', 'Un separador metálico de más hacía cortocircuito con la placa',
                   'La fuente era chica', 'La RAM estaba suelta'],
        correcta: 1,
        porque: 'Un reinicio al <b>tocar el gabinete</b> es un contacto que hace y deshace. Al armar la PC, quedó un ' +
                '<b>separador de más</b> apoyado donde la placa no tiene agujero, y con cada movimiento cortocircuita. ' +
                'Se encuentra mirando la placa por atrás, y se resuelve sacando el separador: ni fuente ni placa nueva.'
      },
      leccion: 'En una PC recién armada, los reinicios al moverla suelen ser separadores sobrantes.'
    },
    {
      id: 'c34', titulo: 'Prende y se apaga a los dos segundos',
      cliente: 'Cantina del colegio', equipo: 'WinTEC Tower 1000, al lado de la máquina de gaseosas',
      relato: '"Aprieto el botón, prende, y a los dos segundos se apaga, y prende otra vez. En loop. ' +
              'Alguien tiró gaseosa arriba del gabinete hace unos días."',
      presupuesto: 30, fallas: ['boton_trabado'], pieza: 'boton',
      sintomas: { boton_trabado: 'Prende y se reinicia en bucle cada pocos segundos, sin llegar a arrancar.' },
      exito: 'Un solo clic limpio, el equipo arranca y queda estable.',
      pasos: ['ver_boton_trabado', 'ver_boton', 'abrir', 'ver_fuente', 'conectar_boton', 'limpiar_boton',
              'cambiar_fuente', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Por qué se reiniciaba en bucle?',
        opciones: ['La fuente estaba por fallar', 'El pulsador quedó pegajoso y mandaba señales de encendido repetidas',
                   'La placa madre estaba húmeda', 'El cable del botón estaba desconectado'],
        correcta: 1,
        porque: 'La gaseosa seca dejó el <b>pulsador medio hundido</b>: la placa lo lee como si alguien lo apretara ' +
                'otra vez y apaga y prende. El cable estaba conectado (si no, no hubiera arrancado). Se limpia con ' +
                'alcohol, sin cambiar nada.'
      },
      leccion: 'Reinicios en bucle tras un derrame: revisá si el pulsador quedó trabado.'
    },
    {
      id: 'c35', titulo: 'Imagen con rayas que se arregla moviendo el cable',
      cliente: 'Estudio fotográfico Luz', equipo: 'WinTEC Tower 3000 con monitor grande',
      relato: '"Tengo que sostener el cable HDMI para que se vea bien: lo suelto y aparecen rayas. Cuando lo ' +
              'toco, se arregla un rato."',
      presupuesto: 25, fallas: ['hdmi_flojo'], pieza: 'monitor',
      sintomas: { hdmi_flojo: 'La imagen tiene rayas y parpadeos que mejoran si movés el cable HDMI.' },
      exito: 'Imagen estable aunque muevas el cable: sin rayas ni parpadeos.',
      pasos: ['ver_hdmi', 'abrir', 'ver_gpu', 'ajustar_hdmi', 'cambiar_monitor', 'cambiar_gpu', 'pasar_video'],
      diagnostico: {
        pregunta: '¿Qué conviene probar primero ante rayas que cambian al mover el cable?',
        opciones: ['Cambiar la placa de video', 'Cambiar el monitor', 'Reconectar y asegurar el cable HDMI', 'Reinstalar los drivers'],
        correcta: 2,
        porque: 'Una falla que <b>cambia al tocar el cable</b> es un contacto flojo: el conector del cable o del ' +
                'monitor. Se reconecta a fondo y se fija con un precinto. Cambiar el monitor o la placa de video ' +
                'costaría un dineral para resolver una ficha floja.'
      },
      leccion: 'Si el síntoma cambia al mover el cable, el problema es el cable o su conector.'
    },
    {
      id: 'c36', titulo: 'Armada y no da imagen',
      cliente: 'Lautaro — Armó su primera PC', equipo: 'PC nueva, fuente y placa de marca',
      relato: '"Armé todo siguiendo un video. Prende, giran los ventiladores, pero no da imagen. ' +
              'Ya cambié el cable del monitor y probé la RAM en otra ranura."',
      presupuesto: 40, fallas: ['cable_cpu'], pieza: 'placa',
      sintomas: { cable_cpu: 'Los ventiladores giran y las luces prenden, pero la pantalla no recibe señal.' },
      exito: 'El BIOS aparece, la RAM se detecta y arranca el instalador.',
      pasos: ['escuchar_post', 'ver_cable_video', 'abrir', 'ver_ram', 'ver_gpu', 'ver_cpu_power', 'conectar_cpu',
              'reasentar_ram', 'cambiar_fuente', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Qué se le olvidó al armar la PC?',
        opciones: ['Conectar el cable de video', 'Poner pasta térmica', 'Enchufar el conector de 8 pines del procesador', 'Instalar la RAM'],
        correcta: 2,
        porque: 'Sin el conector de <b>8 pines del procesador</b> la placa recibe corriente y gira los ventiladores, ' +
                'pero el procesador no arranca y no hay imagen. No hay pitidos porque el POST ni siquiera empieza. ' +
                'Es un olvido típico de un primer armado: se revisa que estén los dos cables de la placa.'
      },
      leccion: 'Armado nuevo sin imagen ni pitidos: revisá que estén los dos cables de corriente de la placa.'
    },
    {
      id: 'c37', titulo: 'Café sobre el teclado',
      cliente: 'Redacción del diario', equipo: 'WinTEC Tower 2000, teclado de la redacción',
      relato: '"Se me cayó el café sobre el teclado. Algunas teclas se quedan pegadas y escribe repetido. ' +
              'El resto de la PC anda perfecto."',
      presupuesto: 30, fallas: ['teclado_pegajoso'], pieza: 'periferico',
      sintomas: { teclado_pegajoso: 'Las teclas se quedan hundidas y se repiten las letras al escribir.' },
      exito: 'El teclado escribe bien: ninguna tecla se repite.',
      pasos: ['preguntar', 'ver_teclado', 'ver_humedad', 'limpiar_teclado', 'cambiar_teclado', 'reinstalar_so', 'abrir'],
      diagnostico: {
        pregunta: '¿Cuál era la solución más económica y correcta?',
        opciones: ['Cambiar el teclado', 'Limpiar la membrana con alcohol isopropílico', 'Reinstalar el sistema', 'Cambiar la placa madre'],
        correcta: 1,
        porque: 'El café dejó azúcar entre las teclas. Con <b>alcohol isopropílico</b> se saca y se seca sin dejar ' +
                'residuo. El teclado no estaba roto, estaba sucio: cambiarlo era gastar plata de más. Y se ' +
                'verificó con el cliente que el resto del equipo no se mojó.'
      },
      leccion: 'Un teclado con líquido seco se limpia con alcohol antes de cambiarlo.'
    },
    {
      id: 'c38', titulo: 'Chasquido en la imprenta',
      cliente: 'Imprenta Gómez', equipo: 'WinTEC Tower 3000, conectada sin estabilizador',
      relato: '"Hubo una tormenta fuerte, saltaron las térmicas y la máquina no prendió más. Cuando la ' +
              'conectamos a otra línea, prende pero se cuelga y tira pantallazos."',
      antecedente: 'Antecedente: un pico de tensión puede dañar más de una pieza.',
      presupuesto: 75, fallas: ['fuente', 'ram_rota'], piezas: ['fuente', 'ram'],
      sintomas: {
        fuente: 'Sin luces, sin ventiladores. Huele a quemado en el gabinete.',
        ram_rota: 'Con la fuente nueva arranca, pero se reinicia con pantallazos azules de error de memoria.'
      },
      exito: 'Arranca estable, sin pantallazos, y pasa dos horas de prueba.',
      pasos: ['ver_cable', 'ver_toma', 'abrir', 'ver_fuente', 'correr_memtest', 'ver_ram', 'escuchar_post',
              'cambiar_fuente', 'cambiar_ram', 'reasentar_ram', 'cambiar_placa'],
      diagnostico: {
        pregunta: '¿Qué piezas había dañado el pico de tensión?',
        opciones: ['Sólo la fuente', 'La fuente y un módulo de RAM', 'La placa madre y el disco', 'El procesador'],
        correcta: 1,
        porque: 'Primero cayó la <b>fuente</b> y tapó todo. Con la fuente nueva apareció la segunda falla: ' +
                '<b>MemTest</b> marcó miles de errores en un módulo. Por eso se prueba el equipo después de cada ' +
                'arreglo: una falla grave puede ocultar otra.'
      },
      leccion: 'Tras un pico de tensión, revisá todo: la fuente cae primero pero rara vez es la única.'
    },
    {
      id: 'c39', titulo: 'Contraseña del BIOS olvidada',
      cliente: 'Prof. Aguirre — PC heredada del laboratorio', equipo: 'WinTEC Tower 2000, de la sala de física',
      relato: '"Nos donaron esta PC. Al encender pide una contraseña del BIOS que nadie sabe y no nos ' +
              'deja arrancar desde el pendrive. Además la fecha dice 2023."',
      presupuesto: 30, fallas: ['bios_clave'], pieza: 'pila', pantallaOk: 'cmos_ok',
      sintomas: { bios_clave: 'Pide la contraseña del BIOS antes de arrancar y no deja cambiar nada de la configuración.' },
      exito: 'El BIOS entra sin contraseña y la configuración vuelve a los valores de fábrica.',
      pasos: ['ver_clave_bios', 'abrir', 'ver_pila', 'medir_pila', 'resetear_bios', 'cambiar_pila', 'cargar_defaults',
              'reinstalar_so', 'poner_hora'],
      diagnostico: {
        pregunta: '¿Cómo se borra una contraseña de BIOS olvidada?',
        opciones: ['Reinstalando el sistema operativo', 'Cambiando la placa madre',
                   'Sacando unos minutos la pila CMOS para borrar la memoria del BIOS', 'No se puede borrar'],
        correcta: 2,
        porque: 'La contraseña y la configuración del BIOS viven en la <b>memoria CMOS</b>, que se mantiene con la ' +
                'pila. Con el equipo <b>desenchufado</b>, si se saca la pila unos <b>cinco minutos</b>, la memoria ' +
                'se borra y el BIOS vuelve a sus valores de fábrica, sin contraseña. Es la maniobra clásica, ' +
                'gratis con una pinza.'
      },
      leccion: 'La contraseña del BIOS se borra sacando la pila CMOS con el equipo desenchufado.'
    }
  ];

  NUEVAS.forEach(function (c) { CASES.push(c); });
  tech.totalCases = CASES.length;

})(window);
