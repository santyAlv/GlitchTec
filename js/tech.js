/* ============================================================
   Glitch.TEC — MODO TÉCNICO: "Servicio Técnico TEC"
   ------------------------------------------------------------
   El otro modo de juego. Acá no hay malware: sos el técnico del
   taller y te entran equipos con una falla. El jugador tiene que
   DIAGNOSTICAR razonando, no adivinando:

     1. Lee la orden de trabajo (lo que dice el cliente).
     2. INSPECCIONA (cada revisión cuesta minutos, no plata).
     3. ACTÚA sobre lo que encontró (algunas acciones cuestan plata).
     4. PRUEBA el equipo: si quedan fallas, cambia el síntoma.
     5. Cierra la orden diciendo CUÁL era la falla.

   Reglas del oficio que el modo castiga de verdad:
     · cambiar piezas sin diagnosticar cuesta plata y reputación
     · hay que abrir el gabinete antes de tocar nada adentro
     · antes de cambiar un disco moribundo, se hace el respaldo

   La "integridad" del estado global se reusa como REPUTACIÓN
   del taller: si llega a 0, se pierde la partida.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var tech = GT.tech = {};

  /* ============================================================
     Catálogo de pasos
     g        grupo: 'inspeccion' | 'accion'
     min      minutos de taller que consume
     parte    pieza del esquema que se resalta
     req      paso previo obligatorio
     detecta  id de falla que revela (inspección)
     arregla  id de falla que repara (acción)
     costo    pesos que le cuesta al taller (repuestos)
     exige    falla que DEBE estar resuelta antes de ejecutar el paso
     ============================================================ */
  /* EL CATALOGO DE PASOS ES UN DICCIONARIO COMPARTIDO POR TODOS LOS CASOS.
     Esto es lo mas importante del diseno de este modo: los pasos se definen
     UNA vez y cada orden de trabajo elige cuales ofrece (su array "pasos").
     Por eso "abrir el gabinete" o "cambiar la fuente" aparecen en varios casos
     sin estar duplicados, y por eso puedo ofrecer acciones INUTILES para el
     caso actual: son las que hacen que el jugador tenga que pensar en vez de
     apretar el unico boton disponible.

     La relacion entre los tres campos clave es la que arma todo el juego:
       detecta  (inspeccion) -> pone la falla en "encontrada"
       arregla  (accion)     -> pone la falla en "reparada"
       fallas   (del caso)   -> que fallas tiene ESTE equipo
     Un paso resuelve algo solo si su "arregla" esta en las "fallas" del caso.
     Si no, es una pieza sana que cambiaste al pedo: plata y reputacion. */
  var STEPS = {

    /* ---------------- Inspección: alimentación ---------------- */
    ver_cable: {
      g: 'inspeccion', label: 'Revisar el cable de alimentación', min: 2, parte: 'cable',
      detecta: 'cable',
      ok: 'El cable está firme en los dos extremos, sin cortes ni marcas de calor.',
      mal: 'El conector está flojo en la parte de atrás del gabinete: se sale con sólo rozarlo.'
    },
    ver_toma: {
      g: 'inspeccion', label: 'Probar el tomacorriente con otro equipo', min: 3, parte: 'cable',
      detecta: 'toma',
      ok: 'El toma da corriente: la lámpara de prueba enciende.',
      mal: 'El toma no da tensión. El problema no está en la PC, está en la instalación.'
    },
    ver_switch: {
      g: 'inspeccion', label: 'Mirar el interruptor trasero de la fuente', min: 1, parte: 'fuente',
      detecta: 'switch',
      ok: 'El interruptor de la fuente está en I (encendido).',
      mal: 'El interruptor de la fuente está en 0. Alguien lo movió al limpiar.'
    },
    ver_fuente: {
      g: 'inspeccion', label: 'Probar la fuente (puente del conector 24 pines)', min: 8, parte: 'fuente',
      req: 'abrir', detecta: 'fuente',
      ok: 'Puenteada, la fuente arranca y el ventilador gira: entrega tensión.',
      mal: 'Puenteada no arranca: el ventilador no gira y huele a componente quemado. Fuente muerta.'
    },
    ver_boton: {
      g: 'inspeccion', label: 'Revisar el cable del botón de encendido', min: 4, parte: 'boton',
      req: 'abrir', detecta: 'boton',
      ok: 'El conector POWER SW está bien calzado en los pines de la placa.',
      mal: 'El conector POWER SW está desconectado del panel frontal.'
    },

    /* ---------------- Inspección: video / POST ---------------- */
    ver_cable_video: {
      g: 'inspeccion', label: 'Revisar el cable de video y el monitor', min: 3, parte: 'monitor',
      detecta: 'video',
      ok: 'El cable HDMI está bien puesto y el monitor enciende con su cartel de "sin señal".',
      mal: 'El cable de video está enchufado al puerto de la placa madre y no al de la placa de video.'
    },
    escuchar_post: {
      g: 'inspeccion', label: 'Escuchar los pitidos del POST', min: 2, parte: 'placa',
      detecta: 'ram',
      ok: 'Un solo pitido corto: el POST pasó bien. El problema no es de arranque.',
      mal: 'Un pitido largo y dos cortos, repetidos. Ese código apunta a memoria RAM.'
    },
    ver_ram: {
      g: 'inspeccion', label: 'Revisar los módulos de memoria RAM', min: 4, parte: 'ram',
      req: 'abrir', detecta: 'ram',
      ok: 'Los dos módulos están calzados a fondo y las trabas laterales cerradas.',
      mal: 'Un módulo está levantado de un lado: la traba nunca cerró. Está flojo en el zócalo.'
    },
    ver_gpu: {
      g: 'inspeccion', label: 'Revisar la placa de video en su zócalo', min: 4, parte: 'gpu',
      req: 'abrir', detecta: 'gpu',
      ok: 'La placa de video está firme y con su alimentación PCIe conectada.',
      mal: 'La placa de video está a medio calzar en el zócalo PCIe.'
    },

    /* ---------------- Inspección: térmica ---------------- */
    preguntar: {
      g: 'inspeccion', label: 'Preguntarle al cliente cuándo y cómo falla', min: 2, parte: 'monitor',
      ok: 'Aporta el dato clave: falla cuando lleva un rato usándola, nunca al principio.'
    },
    medir_temp: {
      g: 'inspeccion', label: 'Medir temperaturas con carga', min: 6, parte: 'cooler',
      detecta: 'pasta',
      ok: 'El CPU se estabiliza en 58 °C bajo carga. Temperatura normal.',
      mal: 'El CPU trepa a 97 °C en menos de dos minutos y el sistema se apaga solo.'
    },
    ver_disipador: {
      g: 'inspeccion', label: 'Revisar el disipador y los ventiladores', min: 4, parte: 'cooler',
      req: 'abrir', detecta: 'polvo',
      ok: 'El disipador está limpio y el ventilador gira sin ruido.',
      mal: 'El disipador es una alfombra de polvo: el aire directamente no pasa.'
    },

    /* ---------------- Inspección: disco ---------------- */
    ver_carga: {
      g: 'inspeccion', label: 'Ver el uso de recursos en el sistema', min: 4, parte: 'disco',
      detecta: 'disco',
      ok: 'CPU, memoria y disco en valores normales.',
      mal: 'El disco está al 100% de uso todo el tiempo con el equipo en reposo.'
    },
    test_smart: {
      g: 'inspeccion', label: 'Correr un test SMART al disco', min: 7, parte: 'disco',
      detecta: 'disco',
      ok: 'SMART sin errores: 0 sectores reasignados, disco sano.',
      mal: 'SMART en rojo: 1.482 sectores reasignados y 96 pendientes. El disco se está muriendo.'
    },
    escuchar_disco: {
      g: 'inspeccion', label: 'Escuchar el disco de cerca', min: 2, parte: 'disco',
      detecta: 'disco',
      ok: 'Sólo se oye el zumbido normal del plato girando.',
      mal: 'Hace un clic seco cada pocos segundos: el cabezal está reintentando lecturas.'
    },
    ver_malware: {
      g: 'inspeccion', label: 'Escanear el equipo en busca de malware', min: 9, parte: 'placa',
      ok: 'El análisis termina limpio: no hay malware. La lentitud es de hardware.'
    },

    /* ---------------- Acciones: gratis ---------------- */
    abrir: {
      g: 'accion', label: 'Abrir el gabinete', min: 3, parte: 'placa', costo: 0,
      hecho: 'Sacás la tapa lateral. Ahora podés revisar el interior del equipo.',
      nada: 'El gabinete ya está abierto.'
    },
    reconectar_cable: {
      g: 'accion', label: 'Reconectar y asegurar el cable de alimentación', min: 1, parte: 'cable',
      costo: 0, arregla: 'cable',
      hecho: 'Calzás el conector a fondo hasta el tope. Ahora no se mueve.',
      nada: 'El cable ya estaba bien puesto: no cambió nada.'
    },
    prender_switch: {
      g: 'accion', label: 'Poner el interruptor de la fuente en I', min: 1, parte: 'fuente',
      costo: 0, arregla: 'switch',
      hecho: 'Pasás el interruptor trasero de 0 a I.',
      nada: 'El interruptor ya estaba en I.'
    },
    conectar_boton: {
      g: 'accion', label: 'Reconectar el cable POWER SW a la placa', min: 3, parte: 'boton',
      req: 'abrir', costo: 0, arregla: 'boton',
      hecho: 'Calzás el conector POWER SW en su par de pines, respetando el manual de la placa.',
      nada: 'El botón ya estaba conectado.'
    },
    reasentar_ram: {
      g: 'accion', label: 'Reasentar la memoria RAM', min: 5, parte: 'ram',
      req: 'abrir', costo: 0, arregla: 'ram',
      hecho: 'Sacás el módulo, limpiás los contactos y lo calzás hasta que cierran las dos trabas. Clic.',
      nada: 'La memoria ya estaba bien puesta: no cambió nada.'
    },
    reasentar_gpu: {
      g: 'accion', label: 'Reasentar la placa de video', min: 4, parte: 'gpu',
      req: 'abrir', costo: 0, arregla: 'gpu',
      hecho: 'Calzás la placa hasta el fondo del zócalo y cerrás la traba.',
      nada: 'La placa de video ya estaba bien puesta.'
    },
    pasar_video: {
      g: 'accion', label: 'Pasar el cable de video a la placa de video', min: 1, parte: 'monitor',
      costo: 0, arregla: 'video',
      hecho: 'Movés el cable del puerto de la placa madre al de la placa de video.',
      nada: 'El cable de video ya estaba en el puerto correcto.'
    },
    limpiar_polvo: {
      g: 'accion', label: 'Limpiar el polvo del disipador y los ventiladores', min: 12, parte: 'cooler',
      req: 'abrir', costo: 0, arregla: 'polvo',
      hecho: 'Aire comprimido y pincel: el disipador vuelve a dejar pasar el aire.',
      nada: 'Estaba limpio: perdiste el tiempo.'
    },
    cambiar_pasta: {
      g: 'accion', label: 'Cambiar la pasta térmica del procesador', min: 15, parte: 'cooler',
      req: 'abrir', costo: 1500, arregla: 'pasta',
      hecho: 'Retirás el disipador, limpiás con alcohol isopropílico y ponés pasta nueva.',
      nada: 'La pasta estaba en buen estado: gastaste sin necesidad.'
    },
    respaldar: {
      g: 'accion', label: 'Respaldar los datos del cliente', min: 20, parte: 'disco',
      costo: 0, arregla: 'respaldo',
      hecho: 'Clonás lo que se puede leer a un disco externo antes de tocar nada más.',
      nada: 'Ya tenías el respaldo hecho.'
    },

    /* ---------------- Acciones: repuestos (cuestan plata) ---------------- */
    cambiar_cable: {
      g: 'accion', label: 'Cambiar el cable de alimentación', min: 2, parte: 'cable',
      costo: 2500, arregla: 'cable',
      hecho: 'Ponés un cable nuevo.',
      nada: 'El cable viejo estaba perfecto: cambiaste una pieza sana.'
    },
    cambiar_fuente: {
      g: 'accion', label: 'Cambiar la fuente de alimentación', min: 20, parte: 'fuente',
      req: 'abrir', costo: 42000, arregla: 'fuente',
      hecho: 'Montás una fuente nueva y recableás el equipo.',
      nada: 'La fuente vieja andaba bien: cambiaste una pieza sana y cara.'
    },
    cambiar_ram: {
      g: 'accion', label: 'Cambiar el módulo de memoria RAM', min: 8, parte: 'ram',
      req: 'abrir', costo: 38000, arregla: 'ram_rota',
      hecho: 'Ponés un módulo nuevo.',
      nada: 'La memoria estaba sana, sólo mal puesta: cambiaste una pieza que funcionaba.'
    },
    cambiar_gpu: {
      g: 'accion', label: 'Cambiar la placa de video', min: 15, parte: 'gpu',
      req: 'abrir', costo: 120000, arregla: 'gpu_rota',
      hecho: 'Montás otra placa de video.',
      nada: 'La placa de video andaba bien: tiraste el presupuesto del cliente a la basura.'
    },
    cambiar_monitor: {
      g: 'accion', label: 'Cambiar el monitor', min: 6, parte: 'monitor',
      costo: 95000, arregla: 'monitor',
      hecho: 'Traés otro monitor del depósito.',
      nada: 'El monitor andaba: el problema nunca estuvo ahí.'
    },
    /* El unico paso con "exige": es LA leccion del caso 4. Cambiar el disco
       antes de respaldar deja el equipo andando pero le borra diez anos de
       datos al cliente. Tecnicamente lo "arreglaste"; profesionalmente lo
       arruinaste. Por eso el castigo de ese camino es el mas grande de todo
       el modo (-300 puntos y -30 de reputacion). */
    cambiar_disco: {
      g: 'accion', label: 'Cambiar el disco por un SSD', min: 25, parte: 'disco',
      req: 'abrir', costo: 55000, arregla: 'disco', exige: 'respaldo',
      exigeTexto: 'Cambiaste el disco SIN respaldar. Los datos del cliente se fueron con el disco viejo: ' +
                  'diez años de fotos y la contabilidad del negocio. El equipo anda; el cliente no vuelve nunca más.',
      hecho: 'Montás un SSD, restaurás el respaldo y el equipo vuela.',
      nada: 'El disco estaba sano: cambiaste una pieza que funcionaba.'
    },
    reinstalar_so: {
      g: 'accion', label: 'Formatear y reinstalar el sistema operativo', min: 40, parte: 'placa',
      costo: 0, arregla: 'so',
      hecho: 'Reinstalás el sistema desde cero.',
      nada: 'Formateaste sin diagnosticar: perdiste 40 minutos y la falla sigue igual, porque era de hardware.'
    }
  };

  /* ============================================================
     Casos (órdenes de trabajo)
     ============================================================ */
  /* LAS ORDENES DE TRABAJO. Cada una es puro dato:
       fallas     -> que esta roto de verdad (puede ser mas de una cosa; el
                     caso 3 tiene polvo Y pasta termica: arreglar una sola no
                     alcanza, el equipo sigue fallando pero con otro sintoma)
       sintomas   -> que muestra el equipo segun la falla PENDIENTE. Este es el
                     detalle lindo del modo: el sintoma cambia a medida que vas
                     resolviendo, igual que en el taller de verdad.
       pasos      -> que botones ofrezco (mezclo los utiles con los inutiles)
       diagnostico-> la pregunta de cierre: no alcanza con que ande, hay que
                     saber POR QUE andaba mal.
     El orden de "fallas" importa: define en que secuencia se van revelando
     los sintomas (ver currentSymptom). */
  var CASES = [

    /* ---------------- CASO 1 ---------------- */
    {
      id: 'c1',
      titulo: 'No enciende',
      cliente: 'Marta — Secretaría del instituto',
      equipo: 'WinTEC Tower 3000',
      relato: '"Ayer andaba perfecta. Hoy llego, aprieto el botón y no pasa nada. ' +
              'Ni una lucecita. Ni ruido. Nada de nada."',
      presupuesto: 20,
      fallas: ['cable'],
      sintomas: {
        cable: 'Apretás el botón: sin luces, sin ventiladores, sin pitidos. El equipo está muerto.'
      },
      exito: 'La luz de encendido prende, los ventiladores arrancan y el POST pasa de largo. Arranca Windows.',
      pasos: ['ver_cable', 'ver_toma', 'ver_switch', 'abrir', 'ver_fuente', 'ver_boton', 'ver_ram',
              'reconectar_cable', 'prender_switch', 'conectar_boton', 'cambiar_cable',
              'cambiar_fuente', 'reasentar_ram'],
      diagnostico: {
        pregunta: '¿Cuál era la falla real del equipo de Marta?',
        opciones: [
          'La fuente de alimentación estaba quemada',
          'El cable de alimentación estaba flojo en el gabinete',
          'La memoria RAM estaba dañada',
          'La placa madre no daba señal de encendido'
        ],
        correcta: 1,
        porque: 'Era lo más simple y lo más común. En un equipo que "no da señales de vida", el orden ' +
                'de revisión es siempre <b>de afuera hacia adentro y de lo barato a lo caro</b>: ' +
                'cable, toma, interruptor de la fuente, botón de encendido, y recién después el interior.'
      },
      leccion: 'Diagnóstico de "no enciende": empezá por la alimentación externa antes de abrir nada.'
    },

    /* ---------------- CASO 2 ---------------- */
    {
      id: 'c2',
      titulo: 'Enciende pero no da imagen',
      cliente: 'Damián — Estudiante de 3.º año',
      equipo: 'PC armada, gabinete con luces',
      relato: '"Prende, se escuchan los ventiladores, pero la pantalla queda negra. ' +
              'Y hace unos pitidos raros cuando arranca. El monitor dice sin señal."',
      presupuesto: 25,
      fallas: ['ram'],
      sintomas: {
        ram: 'El equipo enciende, los ventiladores giran, pero la pantalla sigue negra y suena ' +
             'un pitido largo y dos cortos, en loop.'
      },
      exito: 'Un solo pitido corto y limpio: el POST pasa. Aparece el logo del BIOS y arranca el sistema.',
      pasos: ['ver_cable_video', 'escuchar_post', 'abrir', 'ver_ram', 'ver_gpu', 'ver_fuente',
              'pasar_video', 'reasentar_ram', 'reasentar_gpu', 'cambiar_ram', 'cambiar_gpu',
              'cambiar_monitor', 'reinstalar_so'],
      diagnostico: {
        pregunta: 'El equipo encendía pero no daba imagen. ¿Qué lo explicaba?',
        opciones: [
          'El monitor estaba quemado',
          'Faltaba reinstalar el sistema operativo',
          'Un módulo de RAM estaba mal asentado en el zócalo',
          'La fuente no alcanzaba a alimentar la placa de video'
        ],
        correcta: 2,
        porque: '"Enciende pero no da imagen" no es lo mismo que "no enciende": el equipo tiene corriente, ' +
                'lo que falla es el <b>POST</b>. Los pitidos son un código de error del BIOS, y ' +
                '<b>un largo + dos cortos</b> apunta a memoria. La RAM mal asentada es la causa número uno, ' +
                'y se arregla sin gastar un peso.'
      },
      leccion: 'Los pitidos del POST son un código de diagnóstico: escuchalos antes de comprar repuestos.'
    },

    /* ---------------- CASO 3 ---------------- */
    {
      id: 'c3',
      titulo: 'Se apaga sola',
      cliente: 'Kiosco "El Cruce" — PC de facturación',
      equipo: 'WinTEC Slim, 6 años de uso',
      relato: '"Anda bien un rato y de golpe se apaga sola, como si le cortaran la luz. ' +
              'Después prende de nuevo y hace lo mismo. Cada vez aguanta menos."',
      presupuesto: 45,
      fallas: ['polvo', 'pasta'],
      sintomas: {
        polvo: 'A los cuatro minutos de uso se apaga de golpe, sin pantalla azul ni aviso.',
        pasta: 'Ahora aguanta unos quince minutos, pero al exigirla se apaga igual. El CPU llega a 97 °C.'
      },
      exito: 'Media hora de prueba con carga: el CPU se estabiliza en 61 °C y el equipo no se apaga más.',
      pasos: ['preguntar', 'medir_temp', 'ver_carga', 'abrir', 'ver_disipador', 'ver_fuente', 'ver_ram',
              'limpiar_polvo', 'cambiar_pasta', 'cambiar_fuente', 'reasentar_ram', 'reinstalar_so'],
      diagnostico: {
        pregunta: 'La PC del kiosco se apagaba sola después de unos minutos. ¿Por qué?',
        opciones: [
          'Sobrecalentamiento: el disipador estaba tapado de polvo y la pasta térmica seca',
          'Un virus la apagaba a propósito',
          'La memoria RAM tenía errores',
          'El sistema operativo estaba corrupto'
        ],
        correcta: 0,
        porque: 'Un apagado <b>seco, sin pantalla azul y después de un rato de uso</b> es la firma ' +
                'clásica de la <b>protección térmica</b>: el procesador se corta solo antes de dañarse. ' +
                'No es software. Y no alcanzaba con soplar el polvo: después de años, la pasta térmica ' +
                'se seca y deja de transmitir el calor al disipador.'
      },
      leccion: 'Apagado abrupto bajo uso = temperatura. Limpieza y pasta térmica son mantenimiento, no lujo.'
    },

    /* ---------------- CASO 4 ---------------- */
    {
      id: 'c4',
      titulo: 'Lentísima y se cuelga',
      cliente: 'Estudio contable Ríos — equipo con 10 años de archivos',
      equipo: 'WinTEC Tower 1500, disco mecánico',
      relato: '"Tarda cinco minutos en abrir una carpeta y a veces se queda colgada. ' +
              'Hace un ruidito como un clic. Ojo que ahí está TODA la contabilidad del estudio."',
      presupuesto: 60,
      fallas: ['respaldo', 'disco'],
      sintomas: {
        respaldo: 'El equipo arranca, pero tarda una eternidad y se congela. Y hay datos irremplazables adentro.',
        disco: 'Con el respaldo ya hecho, el equipo sigue lentísimo y clickeando: el disco no da más.'
      },
      exito: 'Con el SSD y los datos restaurados, el equipo arranca en 12 segundos y no vuelve a colgarse.',
      pasos: ['preguntar', 'ver_carga', 'escuchar_disco', 'test_smart', 'ver_malware', 'abrir', 'ver_ram',
              'respaldar', 'cambiar_disco', 'reinstalar_so', 'cambiar_ram', 'limpiar_polvo'],
      diagnostico: {
        pregunta: 'Además de cambiar el disco, ¿qué era lo primero que había que hacer?',
        opciones: [
          'Formatear para que quede limpio',
          'Cambiar la memoria RAM por más capacidad',
          'Respaldar los datos antes de tocar el disco moribundo',
          'Reinstalar el sistema operativo'
        ],
        correcta: 2,
        porque: 'Un disco con sectores reasignados y clics <b>puede morir en cualquier momento</b>. ' +
                'Los datos del cliente no tienen repuesto: el <b>respaldo va primero</b>, siempre, ' +
                'antes de cualquier maniobra. El hardware se compra; diez años de contabilidad, no.'
      },
      leccion: 'Ante un disco moribundo: respaldo primero, reparación después. Los datos no tienen repuesto.'
    }
  ];

  tech.CASES = CASES;

  /* ============================================================
     Esquema del equipo (SVG) — se ilumina según lo revisado
     ============================================================ */
  var PC_SVG =
    '<svg viewBox="0 0 340 210" class="pc-svg">' +
      /* monitor */
      '<g class="pc-part" data-part="monitor">' +
        '<rect x="196" y="26" width="122" height="82" rx="4" fill="#1a2530" stroke="#4a5f70" stroke-width="2"/>' +
        '<rect x="203" y="33" width="108" height="68" rx="2" class="pc-screen" fill="#08120e"/>' +
        '<rect x="243" y="108" width="28" height="16" fill="#2b3a47"/>' +
        '<rect x="224" y="124" width="66" height="6" rx="3" fill="#2b3a47"/>' +
      '</g>' +

      /* gabinete */
      '<rect x="22" y="18" width="150" height="176" rx="5" fill="#131c24" stroke="#3d4f5e" stroke-width="2"/>' +
      '<rect class="pc-inner" x="30" y="26" width="134" height="160" rx="3" fill="#0b1219"/>' +

      /* fuente */
      '<g class="pc-part" data-part="fuente">' +
        '<rect x="36" y="32" width="58" height="34" rx="2" fill="#22303c" stroke="#4a5f70" stroke-width="1.6"/>' +
        '<circle cx="65" cy="49" r="11" fill="none" stroke="#5d7387" stroke-width="1.4"/>' +
        '<path d="M65 40v18M56 49h18" stroke="#5d7387" stroke-width="1.4"/>' +
        '<text x="38" y="76" class="pc-lbl">FUENTE</text>' +
      '</g>' +

      /* interruptor + cable */
      '<g class="pc-part" data-part="cable">' +
        '<rect x="100" y="38" width="16" height="12" rx="2" fill="#2b3a47" stroke="#4a5f70" stroke-width="1.4"/>' +
        '<path d="M116 44h14c8 0 8 22 16 22h30" fill="none" stroke="#6d8194" stroke-width="3" stroke-linecap="round"/>' +
        '<circle cx="176" cy="66" r="4" fill="#6d8194"/>' +
        '<text x="98" y="34" class="pc-lbl">CABLE</text>' +
      '</g>' +

      /* placa madre */
      '<g class="pc-part" data-part="placa">' +
        '<rect x="36" y="82" width="120" height="98" rx="2" fill="#123024" stroke="#2f6b4c" stroke-width="1.6"/>' +
        '<rect x="60" y="120" width="30" height="30" rx="2" fill="#1d4736" stroke="#2f6b4c"/>' +
        '<text x="63" y="139" class="pc-lbl">CPU</text>' +
      '</g>' +

      /* cooler */
      '<g class="pc-part" data-part="cooler">' +
        '<rect x="56" y="116" width="38" height="38" rx="3" fill="#24485c" stroke="#4e8aa8" stroke-width="1.6"/>' +
        '<path d="M62 122v26M70 122v26M78 122v26M86 122v26" stroke="#4e8aa8" stroke-width="1.2"/>' +
        '<circle class="pc-fan" cx="75" cy="135" r="12" fill="none" stroke="#7fc3e0" stroke-width="1.6"/>' +
        '<path class="pc-fan-blades" d="M75 125v20M65 135h20" stroke="#7fc3e0" stroke-width="1.6"/>' +
      '</g>' +

      /* RAM */
      '<g class="pc-part" data-part="ram">' +
        '<rect x="104" y="88" width="10" height="56" rx="1.5" fill="#3b2a52" stroke="#8a6bd0" stroke-width="1.4"/>' +
        '<rect x="118" y="88" width="10" height="56" rx="1.5" fill="#3b2a52" stroke="#8a6bd0" stroke-width="1.4"/>' +
        '<text x="102" y="84" class="pc-lbl">RAM</text>' +
      '</g>' +

      /* GPU */
      '<g class="pc-part" data-part="gpu">' +
        '<rect x="40" y="158" width="86" height="16" rx="2" fill="#3a2230" stroke="#c06a90" stroke-width="1.4"/>' +
        '<text x="43" y="170" class="pc-lbl">GPU</text>' +
      '</g>' +

      /* disco */
      '<g class="pc-part" data-part="disco">' +
        '<rect x="132" y="152" width="30" height="26" rx="2" fill="#2c2a1c" stroke="#b39b3f" stroke-width="1.4"/>' +
        '<circle cx="147" cy="165" r="8" fill="none" stroke="#b39b3f" stroke-width="1.2"/>' +
        '<circle cx="147" cy="165" r="2" fill="#b39b3f"/>' +
        '<text x="130" y="188" class="pc-lbl">DISCO</text>' +
      '</g>' +

      /* boton de encendido */
      '<g class="pc-part" data-part="boton">' +
        '<circle class="pc-power" cx="167" cy="30" r="6" fill="#1b2b22" stroke="#4a5f70" stroke-width="1.6"/>' +
      '</g>' +
    '</svg>';

  /* ============================================================
     Estado del modo
     ============================================================ */
  /* ESTADO DE LA ORDEN EN CURSO. Uso objetos como "conjuntos": en vez de
     arrays con indexOf, hago  fixed['cable'] = true  y despues pregunto
     if (fixed['cable']). Es mas rapido de leer y de escribir.

     Fijate que "found" (detectada) y "fixed" (reparada) son cosas DISTINTAS, y
     esa distincion es justamente lo que el modo quiere ensenar: se puede
     arreglar algo sin haberlo diagnosticado —sale bien, pero fue suerte y da
     menos puntos— y se puede diagnosticar sin arreglar. */
  var caseIdx = 0;
  var cur = null;              // caso actual
  var fixed = {};              // fallas ya reparadas
  var found = {};              // fallas ya detectadas
  var doneSteps = {};          // pasos ejecutados (para no cobrarlos dos veces)
  var wasted = 0;              // acciones inútiles del caso
  /* La fase es una maquina de estados chiquita y evita todo tipo de trampas:
     trabajo -> se puede tocar el equipo; diagnostico -> ya anda, falta
     explicar que era; cerrado -> terminado, no se toca mas nada. */
  var phase = 'trabajo';
  var running = false;
  var caseMinutes = 0;         // minutos gastados en ESTA orden
  var dataLost = false;        // ¿se perdieron los datos del cliente?

  /* ============================================================
     Arranque
     ============================================================ */
  tech.reset = function () {
    caseIdx = 0;
    cur = null;
    running = false;
    GT.state.techMinutes = 0;
    GT.state.techCost = 0;
    GT.state.techSolved = 0;
  };

  tech.start = function () {
    tech.reset();
    running = true;
    GT.ui.setScreen('screen-tech');
    loadCase(0);
  };

  tech.stop = function () { running = false; };
  tech.isRunning = function () { return running; };

  tech.tick = function () { renderHud(); };

  function loadCase(i) {
    caseIdx = i;
    cur = CASES[i];
    fixed = {};
    found = {};
    doneSteps = {};
    wasted = 0;
    caseMinutes = 0;
    dataLost = false;
    phase = 'trabajo';

    GT.state.level = i + 1;
    GT.startPuzzle();

    renderCase();
    renderHud();

    GT.audio.open();
    logLine('── ORDEN ' + pad3(i + 1) + ' · ' + cur.titulo.toUpperCase() + ' ──', 'head');
    logLine('Cliente: ' + cur.cliente, 'dim');
    logLine('Síntoma declarado: ' + currentSymptom(), 'sym');
    logLine('Empezá inspeccionando. Cada revisión consume minutos de taller.', 'dim');
  }

  function pad3(n) { return (n < 100 ? '0' : '') + (n < 10 ? '0' : '') + n; }

  /** Síntoma que muestra el equipo según la primera falla pendiente.
      Recorro las fallas EN ORDEN y devuelvo el sintoma de la primera que
      todavia no este reparada. Si no queda ninguna, devuelvo el texto de
      exito. Con esas tres lineas consigo el efecto de "capas": en el caso 3,
      mientras haya polvo el equipo se apaga a los 4 minutos; cuando lo limpias
      el sintoma cambia (ahora aguanta 15 minutos, pero sigue fallando por la
      pasta termica). El jugador siente que avanzo sin haber terminado. */
  function currentSymptom() {
    for (var i = 0; i < cur.fallas.length; i++) {
      if (!fixed[cur.fallas[i]]) return cur.sintomas[cur.fallas[i]];
    }
    return cur.exito;
  }

  function pendingFaults() {
    return cur.fallas.filter(function (f) { return !fixed[f]; }).length;
  }

  /* ============================================================
     Render
     ============================================================ */
  function renderCase() {
    document.getElementById('tech-case-title').textContent =
      'ORDEN ' + pad3(caseIdx + 1) + ' / ' + pad3(CASES.length) + ' — ' + cur.titulo;

    document.getElementById('tech-ticket').innerHTML =
      '<h3>ORDEN DE TRABAJO</h3>' +
      '<dl class="tk">' +
        '<dt>Cliente</dt><dd>' + GT.escapeHtml(cur.cliente) + '</dd>' +
        '<dt>Equipo</dt><dd>' + GT.escapeHtml(cur.equipo) + '</dd>' +
        '<dt>Presupuesto</dt><dd>' + cur.presupuesto + ' min de taller</dd>' +
      '</dl>' +
      '<p class="tk-relato">' + GT.escapeHtml(cur.relato) + '</p>' +
      '<h4>ESTADO ACTUAL DEL EQUIPO</h4>' +
      '<p class="tk-sintoma" id="tech-sintoma">' + GT.escapeHtml(currentSymptom()) + '</p>' +
      '<p class="tk-tip">Regla del taller: <b>diagnosticar antes de cambiar</b>. ' +
         'Cada repuesto que ponés sin motivo sale del bolsillo del cliente.</p>';

    document.getElementById('tech-pc').innerHTML = PC_SVG;
    document.getElementById('tech-log').innerHTML = '';

    renderActions();
  }

  function renderActions() {
    var box = document.getElementById('tech-actions');
    box.innerHTML =
      '<div class="tech-group" id="grp-inspeccion"><h4>INSPECCIÓN <small>(mirar no cuesta plata)</small></h4><div class="tech-btns"></div></div>' +
      '<div class="tech-group" id="grp-accion"><h4>ACCIONES <small>(algunas cuestan repuestos)</small></h4><div class="tech-btns"></div></div>' +
      '<button class="tech-test" id="tech-test">▶ PROBAR EL EQUIPO</button>';

    cur.pasos.forEach(function (id) {
      var st = STEPS[id];
      if (!st) return;

      var b = document.createElement('button');
      b.className = 'tech-btn' + (doneSteps[id] ? ' is-done' : '');
      b.dataset.step = id;
      b.innerHTML =
        '<span class="tb-label">' + GT.escapeHtml(st.label) + '</span>' +
        '<span class="tb-meta">' + st.min + ' min' +
          (st.costo ? ' · $' + money(st.costo) : '') + '</span>';
      b.addEventListener('click', function () { doStep(id, b); });

      box.querySelector('#grp-' + st.g + ' .tech-btns').appendChild(b);
    });

    document.getElementById('tech-test').addEventListener('click', testEquipment);
  }

  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function renderHud() {
    var rep = Math.max(0, Math.round(GT.state.integrity));
    var bar = document.getElementById('tech-bar-rep');
    if (!bar) return;

    bar.style.width = rep + '%';
    bar.parentNode.classList.toggle('crit', rep <= 25);
    bar.parentNode.classList.toggle('warn', rep > 25 && rep <= 55);
    document.getElementById('tech-val-rep').textContent = rep + '%';

    var over = Math.max(0, caseMinutes - (cur ? cur.presupuesto : 0));
    var mins = document.getElementById('tech-val-min');
    mins.textContent = caseMinutes + ' min';
    mins.className = 'val' + (over > 0 ? ' over' : '');

    document.getElementById('tech-val-cost').textContent = '$' + money(GT.state.techCost || 0);
    document.getElementById('tech-val-score').textContent = GT.state.score;
    document.getElementById('tech-val-streak').textContent =
      GT.state.streak + ' · x' + GT.getMultiplier() + (GT.state.shieldLeft > 0 ? ' · ESCUDO' : '');
    document.getElementById('tech-val-solved').textContent = (GT.state.techSolved || 0) + ' / ' + CASES.length;
  }

  function logLine(text, cls) {
    var log = document.getElementById('tech-log');
    if (!log) return;
    var p = document.createElement('p');
    p.className = 'tl' + (cls ? ' tl-' + cls : '');
    p.innerHTML = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function markPart(part, cls) {
    if (!part) return;
    var g = document.querySelector('#tech-pc .pc-part[data-part="' + part + '"]');
    if (!g) return;
    g.classList.remove('is-checked', 'is-bad', 'is-fixed');
    g.classList.add(cls);
    g.classList.add('is-hit');
    setTimeout(function () { g.classList.remove('is-hit'); }, 700);
  }

  function refreshSymptom() {
    var el = document.getElementById('tech-sintoma');
    if (el) el.textContent = currentSymptom();
  }

  /* ============================================================
     Ejecutar un paso
     ============================================================ */
  /* PUNTO DE ENTRADA de cualquier boton del taller. El orden de los chequeos
     es el importante:
       1. ¿estoy en fase de trabajo?        (si ya cerre, no se toca nada)
       2. ¿cumplo el requisito previo?      (no puedo tocar la RAM con el
                                             gabinete cerrado: eso es realismo,
                                             no burocracia)
       3. ¿ya lo hice?                      (revisar dos veces no cobra tiempo)
       4. cobro los minutos y despacho a inspect() o act() segun el grupo.
     Los minutos se cobran ANTES de saber el resultado, como en la vida real:
     el tiempo se gasta aunque no encuentres nada. */
  function doStep(id, btn) {
    if (phase !== 'trabajo' || GT.state.finished) return;
    var st = STEPS[id];

    /* Requisito previo (abrir el gabinete, por ejemplo) */
    if (st.req && !doneSteps[st.req]) {
      GT.audio.error();
      logLine('✋ Primero tenés que "' + STEPS[st.req].label.toLowerCase() + '".', 'warn');
      GT.ui.toast('Paso bloqueado: ' + STEPS[st.req].label, 'warn');
      return;
    }

    /* Repetir un paso ya hecho no cuesta ni sirve */
    if (doneSteps[id] && st.g === 'inspeccion') {
      logLine('Ya revisaste eso.', 'dim');
      GT.audio.click();
      return;
    }

    doneSteps[id] = true;
    caseMinutes += st.min;
    GT.state.techMinutes = (GT.state.techMinutes || 0) + st.min;
    if (btn) btn.classList.add('is-done');

    if (st.g === 'inspeccion') inspect(id, st);
    else act(id, st);

    renderHud();
  }

  /* ---------------- Inspección ---------------- */
  /* INSPECCIONAR: mirar sin tocar. Nunca cuesta plata, siempre cuesta tiempo,
     y hasta descartar suma un poquito de puntaje (+4): descartar tambien es
     diagnosticar, no quiero premiar solo al que acierta de una.

     La condicion de tres partes se lee asi:
       st.detecta                        -> este paso revisa algo concreto
       cur.fallas.indexOf(...) !== -1    -> ese algo esta roto EN ESTE equipo
       !fixed[st.detecta]                -> y todavia no lo arregle
     Las tres tienen que dar true para que la inspeccion encuentre la falla. */
  function inspect(id, st) {
    var esFalla = st.detecta && cur.fallas.indexOf(st.detecta) !== -1 && !fixed[st.detecta];

    logLine('<b>› ' + st.label + '</b> <i>(' + st.min + ' min)</i>', 'step');

    if (esFalla) {
      found[st.detecta] = true;
      markPart(st.parte, 'is-bad');
      logLine('⚠ ' + st.mal, 'bad');
      logLine('Encontraste algo. Ahora hay que resolverlo, no cambiarlo por las dudas.', 'dim');
      GT.audio.alarm();
      GT.addScore(60, 'falla detectada');
      GT.ui.flash('gain');
    } else {
      markPart(st.parte, 'is-checked');
      logLine('✓ ' + (st.ok || 'Sin novedades.'), 'ok');
      GT.audio.click();
      GT.addScore(4, 'descarte correcto');
    }
  }

  /* ---------------- Acción ---------------- */
  /* ACTUAR: meter mano. Aca esta el nucleo del modo, con cuatro finales
     posibles para un mismo click:
       a) arregla una falla que YA habias diagnosticado  -> +180, el ideal
       b) arregla una falla que NO habias diagnosticado  -> +60, "fue suerte"
       c) no arregla nada y era un repuesto caro         -> -120 y reputacion
       d) no arregla nada y era gratis                   -> -25, solo tiempo
     Esa diferencia entre (a) y (b) es todo el mensaje del modo: el trabajo del
     tecnico es el DIAGNOSTICO; el destornillador viene despues. */
  function act(id, st) {
    logLine('<b>› ' + st.label + '</b> <i>(' + st.min + ' min' +
            (st.costo ? ' · $' + money(st.costo) : '') + ')</i>', 'step');

    if (st.costo) {
      GT.state.techCost = (GT.state.techCost || 0) + st.costo;
    }

    var arregla = st.arregla && cur.fallas.indexOf(st.arregla) !== -1 && !fixed[st.arregla];

    /* Maniobra peligrosa: hacerla antes de otro paso obligatorio.
       Ojo con el detalle del final: marco  fixed[st.exige] = true  aunque el
       respaldo NUNCA se hizo. Es la unica forma de representar lo que pasa de
       verdad: ya no queda nada que respaldar, los datos se fueron con el disco
       viejo. El equipo va a quedar andando y la orden se va a poder cerrar,
       pero el castigo ya esta aplicado y queda escrito en el resumen final. */
    if (arregla && st.exige && cur.fallas.indexOf(st.exige) !== -1 && !fixed[st.exige]) {
      dataLost = true;
      logLine('☠ ' + st.exigeTexto, 'bad');
      GT.wrong(300, 'datos del cliente perdidos');
      GT.damage(30, 'perdiste los datos del cliente');
      GT.audio.hurt();
      GT.ui.shake();
      GT.ui.flash('hit');
      GT.ui.toast('✘ Perdiste los datos del cliente', 'bad');
      fixed[st.exige] = true;                 // ya no hay nada que respaldar
    }

    if (arregla) {
      fixed[st.arregla] = true;
      markPart(st.parte, 'is-fixed');
      logLine('✔ ' + st.hecho, 'ok');
      GT.audio.ok();

      if (!found[st.arregla]) {
        logLine('Lo arreglaste sin haberlo diagnosticado. Salió bien, pero fue suerte.', 'warn');
        GT.addScore(60, 'reparación a ciegas');
      } else {
        GT.correct(180, 'reparación correcta');
        GT.ui.flash('gain');
      }
      refreshSymptom();
      return;
    }

    /* La acción no resolvió nada */
    /* Distingo la chapuza CARA de la barata: formatear sin diagnosticar
       (arregla === 'so') o cambiar una pieza de mas de $30.000 le cuesta plata
       real al cliente y reputacion al taller. Cambiar un cable de $2.500 al
       pedo es solo tiempo perdido y un tironcito de orejas. */
    if (st.arregla === 'so' || st.costo >= 30000) {
      wasted++;
      logLine('✘ ' + (st.nada || 'No cambió nada.'), 'bad');
      GT.wrong(120, 'repuesto innecesario');
      GT.damage(st.costo >= 90000 ? 14 : 9, 'cambiaste una pieza sana');
      GT.audio.hurt();
      GT.ui.toast('✘ Cambiaste una pieza que funcionaba', 'bad');
    } else {
      wasted++;
      logLine('· ' + (st.nada || 'No cambió nada.'), 'dim');
      GT.addScore(-25, 'acción innecesaria');
      GT.audio.error();
    }
    refreshSymptom();
  }

  /* ============================================================
     Probar el equipo
     ============================================================ */
  /* PROBAR EL EQUIPO: el momento de la verdad. No le digo al jugador cuantas
     fallas faltan; simplemente le muestro el sintoma que queda. Si quedan
     fallas pendientes, el equipo sigue roto (y el sintoma puede haber CAMBIADO,
     que es lo que lo obliga a volver a inspeccionar en vez de adivinar).
     Cuando no queda ninguna, paso a la fase de diagnostico. */
  function testEquipment() {
    if (phase !== 'trabajo' || GT.state.finished) return;

    caseMinutes += 2;
    GT.state.techMinutes = (GT.state.techMinutes || 0) + 2;
    logLine('<b>› Probar el equipo</b> <i>(2 min)</i>', 'step');

    if (pendingFaults() > 0) {
      logLine('✘ ' + currentSymptom(), 'bad');
      logLine('Todavía falla. Seguí buscando.', 'dim');
      GT.audio.error();
      GT.ui.shake();
      renderHud();
      return;
    }

    logLine('✔ ' + cur.exito, 'ok');
    GT.audio.levelUp();
    GT.ui.flash('gain');
    markPart(null);
    phase = 'diagnostico';
    renderDiagnosis();
    renderHud();
  }

  /* ============================================================
     Cierre de la orden: explicar la falla
     ============================================================ */
  function renderDiagnosis() {
    var d = cur.diagnostico;
    var box = document.getElementById('tech-actions');

    var html =
      '<div class="tech-diag">' +
        '<h4>CERRAR LA ORDEN</h4>' +
        '<p class="td-lead">El equipo anda. Antes de entregarlo, dejá asentado en la ficha ' +
          'qué era lo que fallaba.</p>' +
        '<p class="td-q">' + d.pregunta + '</p>' +
        '<div class="td-opts">';
    d.opciones.forEach(function (o, i) {
      html += '<button class="td-opt" data-i="' + i + '"><b>' +
              String.fromCharCode(65 + i) + ')</b> ' + GT.escapeHtml(o) + '</button>';
    });
    html += '</div><div class="td-fb hidden" id="td-fb"></div></div>';

    box.innerHTML = html;

    var btns = box.querySelectorAll('.td-opt');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        answerDiagnosis(parseInt(this.dataset.i, 10), btns);
      });
    }
  }

  function answerDiagnosis(choice, btns) {
    if (phase !== 'diagnostico') return;
    phase = 'cerrado';

    var d = cur.diagnostico;
    var right = (choice === d.correcta);

    for (var i = 0; i < btns.length; i++) {
      btns[i].disabled = true;
      if (i === d.correcta) btns[i].classList.add('right');
      else if (i === choice) btns[i].classList.add('wrong');
    }

    var fb = document.getElementById('td-fb');
    fb.className = 'td-fb ' + (right ? 'ok' : 'bad');

    if (right) {
      GT.correct(250, 'diagnóstico correcto');
      GT.audio.ok();
      GT.learn(cur.leccion);
      fb.innerHTML = '<b>✔ DIAGNÓSTICO CORRECTO.</b><br>' + d.porque;
    } else {
      GT.wrong(120, 'diagnóstico incorrecto');
      GT.damage(6, 'diagnóstico mal asentado en la ficha');
      GT.audio.hurt();
      fb.innerHTML = '<b>✘ NO ERA ESO.</b><br>' + d.porque;
    }

    /* BALANCE DEL CASO. El diagnostico es solo una parte de la nota: tambien
       cuentan el tiempo y la prolijidad, porque un taller que tarda el triple
       o cambia piezas sanas pierde clientes aunque acierte.

         extra   = minutos por encima del presupuesto de la orden
         castigo = 1 de reputacion cada 6 minutos de exceso (Math.ceil para que
                   pasarse 1 solo minuto ya cueste algo), topeado en 18 con
                   Math.min para que un descuido no te funda de una. */
    var extra = Math.max(0, caseMinutes - cur.presupuesto);
    var resumen = [];

    if (extra > 0) {
      var castigo = Math.min(18, Math.ceil(extra / 6));
      GT.damage(castigo, 'te pasaste del presupuesto de tiempo');
      resumen.push('Te pasaste ' + extra + ' min del presupuesto (−' + castigo + ' reputación).');
    } else {
      GT.heal(5, 'orden resuelta dentro del presupuesto');
      GT.addScore(150, 'trabajo eficiente');
      resumen.push('Cerraste dentro del presupuesto de tiempo (+150 y +5 reputación).');
    }

    if (wasted === 0) {
      GT.addScore(120, 'sin pasos inútiles');
      resumen.push('Ni una acción de más: trabajo limpio (+120).');
    } else {
      resumen.push(wasted + ' acción(es) que no resolvían nada.');
    }

    if (dataLost) resumen.push('Los datos del cliente se perdieron. Eso no se recupera con un descuento.');

    fb.innerHTML += '<ul class="td-sum"><li>' + resumen.join('</li><li>') + '</li></ul>' +
      '<p class="td-lesson"><b>PARA LLEVARSE:</b> ' + GT.escapeHtml(cur.leccion) + '</p>' +
      '<button class="tech-test" id="tech-next">' +
      (caseIdx >= CASES.length - 1 ? '✓ CERRAR EL TALLER' : 'ENTREGAR Y LLAMAR AL SIGUIENTE ▸') +
      '</button>';

    GT.state.techSolved = (GT.state.techSolved || 0) + 1;
    logLine('Orden ' + pad3(caseIdx + 1) + ' cerrada.', 'head');
    renderHud();

    document.getElementById('tech-next').addEventListener('click', nextCase);
  }

  function nextCase() {
    if (GT.state.finished) return;

    if (caseIdx >= CASES.length - 1) {
      GT.emit('victory');
      return;
    }
    GT.audio.levelUp();
    loadCase(caseIdx + 1);
  }

  /* Utilidades para el resumen final */
  tech.totalCases = CASES.length;
  tech.solved = function () { return GT.state.techSolved || 0; };
  tech.minutes = function () { return GT.state.techMinutes || 0; };
  tech.cost = function () { return GT.state.techCost || 0; };

})(window, document);
