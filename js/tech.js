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
      lado: 'atras', g: 'inspeccion', label: 'Revisar el cable de alimentación', min: 2, parte: 'cable',
      detecta: 'cable',
      ok: 'El cable está firme en los dos extremos, sin cortes ni marcas de calor.',
      mal: 'El conector está flojo en la parte de atrás del gabinete: se sale con sólo rozarlo.'
    },
    ver_toma: {
      lado: 'atras', tool: 'tester', g: 'inspeccion', label: 'Probar el tomacorriente con otro equipo', min: 3, parte: 'cable',
      detecta: 'toma',
      ok: 'El toma da corriente: la lámpara de prueba enciende.',
      mal: 'El toma no da tensión. El problema no está en la PC, está en la instalación.'
    },
    ver_switch: {
      lado: 'atras', g: 'inspeccion', label: 'Mirar el interruptor trasero de la fuente', min: 1, parte: 'fuente',
      detecta: 'switch',
      ok: 'El interruptor de la fuente está en I (encendido).',
      mal: 'El interruptor de la fuente está en 0. Alguien lo movió al limpiar.'
    },
    ver_fuente: {
      tool: 'tester', g: 'inspeccion', label: 'Probar la fuente (puente del conector 24 pines)', min: 8, parte: 'fuente',
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
      lado: 'atras', g: 'inspeccion', label: 'Revisar el cable de video y el monitor', min: 3, parte: 'monitor',
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
      g: 'inspeccion', label: 'Preguntarle al cliente cuándo y cómo falla', min: 2, parte: 'cliente',
      ok: 'Aporta el dato clave: falla cuando lleva un rato usándola, nunca al principio.'
    },
    medir_temp: {
      tool: 'tester', g: 'inspeccion', label: 'Medir temperaturas con carga', min: 6, parte: 'cooler',
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
    /* ---------------- Inspección: humedad y sulfatación ---------------- */
    ver_humedad: {
      g: 'inspeccion', label: 'Revisar si el equipo entró con humedad', min: 3, parte: 'placa',
      detecta: 'humedad',
      ok: 'El interior está seco: ni marcas de agua ni condensación en el fondo.',
      mal: 'El fondo del gabinete tiene marcas de agua secas y el interior está húmedo al tacto. ' +
           'Este equipo estuvo mojado: no se enciende así.'
    },
    ver_sulfato: {
      g: 'inspeccion', label: 'Revisar la placa buscando sulfato y óxido', min: 6, parte: 'placa',
      req: 'abrir', detecta: 'sulfato',
      ok: 'La placa está limpia: el cobre de las pistas se ve brillante, sin verdín.',
      mal: 'Hay una costra verdosa sobre las pistas y los tornillos están oxidados. Eso es sulfato.'
    },
    ver_contactos_ram: {
      g: 'inspeccion', label: 'Sacar la memoria y mirarle los contactos', min: 4, parte: 'ram',
      req: 'abrir', detecta: 'sulfato_ram',
      ok: 'Los contactos dorados del módulo están limpios y parejos.',
      mal: 'Los contactos del módulo están cubiertos de verdín: por ahí no pasa la señal.'
    },
    medir_continuidad: {
      tool: 'tester', g: 'inspeccion', label: 'Medir continuidad en las líneas de alimentación',
      min: 7, parte: 'placa', req: 'abrir',
      ok: 'Las líneas de 12 V y 5 V están limpias: no hay cortocircuito en la placa.'
    },

    /* ---------------- Inspección: ventilación ---------------- */
    ver_filtros: {
      g: 'inspeccion', label: 'Revisar los filtros y las entradas de aire', min: 3, parte: 'boton',
      detecta: 'filtro',
      ok: 'Los filtros del frente están limpios y el aire entra sin problema.',
      mal: 'Los filtros del frente son una manta de pelusa. Apoyada contra la pared y sobre ' +
           'alfombra, la máquina no tiene de dónde tomar aire.'
    },
    medir_rpm: {
      tool: 'tester', g: 'inspeccion', label: 'Medir las vueltas del ventilador del disipador',
      min: 4, parte: 'cooler', req: 'abrir', detecta: 'vent_trabado',
      ok: 'El ventilador gira a 1.800 vueltas, parejo y sin ruido.',
      mal: 'El ventilador arranca a los tirones y no pasa de 400 vueltas: el rodamiento está trabado.'
    },
    ver_pasta: {
      tool: 'destornillador', g: 'inspeccion', label: 'Sacar el disipador y mirar la pasta térmica',
      min: 5, parte: 'cooler', req: 'abrir', detecta: 'pasta',
      ok: 'La pasta está fresca y bien distribuida sobre el procesador.',
      mal: 'La pasta está seca y cuarteada, como barro viejo: se despega sola y ya no transmite ' +
           'el calor al disipador.'
    },

    ver_malware: {
      g: 'inspeccion', label: 'Escanear el equipo en busca de malware', min: 9, parte: 'software',
      ok: 'El análisis termina limpio: no hay malware. La lentitud es de hardware.'
    },

    /* ---------------- Acciones: gratis ---------------- */
    abrir: {
      tool: 'destornillador', g: 'accion', label: 'Abrir el gabinete', min: 3, parte: 'placa', costo: 0,
      hecho: 'Sacás la tapa lateral. Ahora podés revisar el interior del equipo.',
      nada: 'El gabinete ya está abierto.'
    },
    reconectar_cable: {
      lado: 'atras', g: 'accion', label: 'Reconectar y asegurar el cable de alimentación', min: 1, parte: 'cable',
      costo: 0, arregla: 'cable',
      hecho: 'Calzás el conector a fondo hasta el tope. Ahora no se mueve.',
      nada: 'El cable ya estaba bien puesto: no cambió nada.'
    },
    prender_switch: {
      lado: 'atras', g: 'accion', label: 'Poner el interruptor de la fuente en I', min: 1, parte: 'fuente',
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
      lado: 'atras', g: 'accion', label: 'Pasar el cable de video a la placa de video', min: 1, parte: 'monitor',
      costo: 0, arregla: 'video',
      hecho: 'Movés el cable del puerto de la placa madre al de la placa de video.',
      nada: 'El cable de video ya estaba en el puerto correcto.'
    },
    limpiar_polvo: {
      tool: 'aire', g: 'accion', label: 'Limpiar el polvo del disipador y los ventiladores', min: 12, parte: 'cooler',
      req: 'abrir', costo: 0, arregla: 'polvo',
      hecho: 'Aire comprimido y pincel: el disipador vuelve a dejar pasar el aire.',
      nada: 'Estaba limpio: perdiste el tiempo.'
    },
    cambiar_pasta: {
      tool: 'pasta', g: 'accion', label: 'Cambiar la pasta térmica del procesador', min: 15, parte: 'cooler',
      req: 'abrir', costo: 1500, arregla: 'pasta',
      hecho: 'Retirás el disipador, limpiás con alcohol isopropílico y ponés pasta nueva.',
      nada: 'La pasta estaba en buen estado: gastaste sin necesidad.'
    },
    /* ---------------- Acciones: mantenimiento correctivo ---------------- */
    secar_equipo: {
      tool: 'aire', g: 'accion', label: 'Secar el equipo y dejarlo ventilar', min: 45, parte: 'placa',
      req: 'abrir', costo: 0, arregla: 'humedad',
      hecho: 'Soplás la humedad, dejás el equipo abierto ventilando y recién después lo tocás. ' +
             'Encenderlo mojado lo hubiera quemado.',
      nada: 'El equipo ya estaba seco: perdiste tres cuartos de hora.'
    },
    limpiar_sulfato: {
      tool: 'alcohol', g: 'accion', label: 'Limpiar el sulfato de la placa con alcohol isopropílico',
      min: 18, parte: 'placa', req: 'abrir', costo: 0, arregla: 'sulfato',
      hecho: 'Pincel y alcohol isopropílico: levanta el verdín y se evapora sin dejar agua.',
      nada: 'No había sulfato que limpiar.'
    },
    limpiar_contactos_ram: {
      tool: 'alcohol', g: 'accion', label: 'Limpiar los contactos de la memoria con alcohol',
      min: 8, parte: 'ram', req: 'abrir', costo: 0, arregla: 'sulfato_ram',
      hecho: 'Frotás los contactos con alcohol isopropílico hasta que vuelve a verse el dorado, ' +
             'y recién ahí la calzás de nuevo.',
      nada: 'Los contactos ya estaban limpios.'
    },
    limpiar_filtros: {
      tool: 'aire', g: 'accion', label: 'Limpiar los filtros y las entradas de aire', min: 8,
      parte: 'boton', costo: 0, arregla: 'filtro',
      hecho: 'Sacás los filtros, les das aire y los volvés a poner. El frente vuelve a respirar.',
      nada: 'Los filtros ya estaban limpios.'
    },
    cambiar_vent: {
      tool: 'destornillador', g: 'accion', label: 'Cambiar el ventilador del disipador', min: 12,
      parte: 'cooler', req: 'abrir', costo: 9000, arregla: 'vent_trabado',
      hecho: 'Montás un ventilador nuevo en el disipador: vuelve a girar parejo.',
      nada: 'El ventilador andaba bien: cambiaste una pieza sana.'
    },

    respaldar: {
      tool: 'respaldo', g: 'accion', label: 'Respaldar los datos del cliente', min: 20, parte: 'disco',
      costo: 0, arregla: 'respaldo',
      hecho: 'Clonás lo que se puede leer a un disco externo antes de tocar nada más.',
      nada: 'Ya tenías el respaldo hecho.'
    },

    /* ---------------- Acciones: repuestos (cuestan plata) ---------------- */
    cambiar_cable: {
      lado: 'atras', g: 'accion', label: 'Cambiar el cable de alimentación', min: 2, parte: 'cable',
      costo: 2500, arregla: 'cable',
      hecho: 'Ponés un cable nuevo.',
      nada: 'El cable viejo estaba perfecto: cambiaste una pieza sana.'
    },
    cambiar_fuente: {
      tool: 'destornillador', g: 'accion', label: 'Cambiar la fuente de alimentación', min: 20, parte: 'fuente',
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
      tool: 'destornillador', g: 'accion', label: 'Cambiar la placa de video', min: 15, parte: 'gpu',
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
      tool: 'destornillador', g: 'accion', label: 'Cambiar el disco por un SSD', min: 25, parte: 'disco',
      req: 'abrir', costo: 55000, arregla: 'disco', exige: 'respaldo',
      exigeTexto: 'Cambiaste el disco SIN respaldar. Los datos del cliente se fueron con el disco viejo: ' +
                  'diez años de fotos y la contabilidad del negocio. El equipo anda; el cliente no vuelve nunca más.',
      hecho: 'Montás un SSD, restaurás el respaldo y el equipo vuela.',
      nada: 'El disco estaba sano: cambiaste una pieza que funcionaba.'
    },
    reinstalar_so: {
      g: 'accion', label: 'Formatear y reinstalar el sistema operativo', min: 40, parte: 'software',
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
      pieza: 'cable',
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
      pieza: 'ram',
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
      pieza: 'cooler',
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
      pieza: 'disco',
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
    },

    /* ---------------- CASO 5 ---------------- */
    {
      id: 'c5',
      titulo: 'Estuvo guardada en un depósito húmedo',
      cliente: 'Cooperativa del barrio — PC del depósito',
      equipo: 'WinTEC Tower 2000, guardada todo el invierno',
      relato: '"La bajamos del depósito después del invierno. Ahí abajo entra agua cuando llueve ' +
              'fuerte. La enchufamos y no hace absolutamente nada."',
      antecedente: 'Antecedente: el equipo estuvo meses en un depósito que se llueve. ' +
                   'Ojo: encender un equipo húmedo lo termina de arruinar.',
      presupuesto: 85,
      fallas: ['humedad', 'sulfato_ram'],
      pieza: 'ram',
      sintomas: {
        humedad: 'No da señales de vida. El interior está húmedo al tacto y el fondo tiene ' +
                 'marcas de agua secas.',
        sulfato_ram: 'Ya seco, enciende y los ventiladores giran, pero la pantalla queda negra ' +
                     'y suena un pitido largo y dos cortos.'
      },
      exito: 'Con los contactos limpios el POST pasa de una, sin pitidos de error, y arranca el sistema.',
      pasos: ['ver_humedad', 'ver_cable', 'abrir', 'ver_sulfato', 'ver_contactos_ram',
              'medir_continuidad', 'ver_fuente', 'secar_equipo', 'limpiar_sulfato',
              'limpiar_contactos_ram', 'reasentar_ram', 'cambiar_ram', 'cambiar_fuente'],
      diagnostico: {
        pregunta: '¿Por qué no arrancaba el equipo de la cooperativa?',
        opciones: [
          'La fuente se quemó por la humedad',
          'La humedad dejó sulfato en los contactos de la memoria y cortó el contacto',
          'La memoria se quemó y había que cambiarla',
          'El cable de alimentación estaba flojo'
        ],
        correcta: 1,
        porque: 'La humedad rara vez quema algo de entrada: lo que hace es <b>oxidar los contactos</b>. ' +
                'Ese verdín es <b>sulfato</b>, y donde se forma deja de pasar la señal, por eso el ' +
                'POST frenaba en memoria. El orden del trabajo tampoco es libre: primero se <b>seca</b> ' +
                'el equipo (encenderlo mojado sí lo quema), después se limpia el sulfato con ' +
                '<b>alcohol isopropílico</b>, que se evapora sin dejar agua ni residuo. La memoria ' +
                'estaba sana: no había nada que comprar.'
      },
      leccion: 'Equipo con humedad: secar primero y nunca encenderlo mojado. El sulfato se limpia ' +
               'con alcohol isopropílico; la pieza no se cambia.'
    },

    /* ---------------- CASO 6 ---------------- */
    {
      id: 'c6',
      titulo: 'Hace ruido y se apaga',
      cliente: 'Lucas — PC de la sala de estudio',
      equipo: 'WinTEC Tower 3000, en el piso contra la pared y sobre alfombra',
      relato: '"Hace un ruido como de aspiradora y después de un rato se apaga sola. ' +
              'La tengo en el piso, pegada a la pared, abajo del escritorio."',
      antecedente: 'Antecedente: nunca se le hizo mantenimiento y está apoyada sobre alfombra, ' +
                   'contra la pared. Mirá por dónde entra y por dónde sale el aire.',
      presupuesto: 50,
      fallas: ['filtro', 'vent_trabado'],
      pieza: 'cooler',
      sintomas: {
        filtro: 'Arranca, se escucha un zumbido fuerte y a los diez minutos se apaga sola.',
        vent_trabado: 'Con los filtros limpios aguanta más, pero el ventilador del disipador ' +
                      'apenas gira y el equipo se vuelve a apagar.'
      },
      exito: 'Media hora de prueba con carga: el ventilador gira parejo a 1.800 vueltas, el CPU se ' +
             'queda en 58 °C y no se apaga más.',
      pasos: ['preguntar', 'medir_temp', 'ver_filtros', 'abrir', 'ver_disipador', 'medir_rpm',
              'ver_pasta', 'limpiar_filtros', 'limpiar_polvo', 'cambiar_vent', 'cambiar_pasta',
              'cambiar_fuente'],
      diagnostico: {
        pregunta: '¿Por qué se apagaba sola la PC de la sala de estudio?',
        opciones: [
          'El sistema operativo estaba corrupto',
          'La fuente no daba abasto',
          'No entraba aire: filtros tapados y el ventilador del disipador trabado',
          'La memoria tenía errores'
        ],
        correcta: 2,
        porque: 'Se apagaba por <b>protección térmica</b>, y la refrigeración es un <b>circuito ' +
                'completo</b>: entra aire por el frente, pasa por el disipador y sale por atrás. ' +
                'Con los filtros tapados no entra nada, y con el ventilador del disipador trabado ' +
                'el calor del procesador no se va a ningún lado. Soplarle aire a un ventilador ' +
                'trabado no lo arregla: el rodamiento ya se fue y hay que cambiarlo. Y el lugar ' +
                'también cuenta: contra la pared y sobre alfombra, el equipo respira su propio aire caliente.'
      },
      leccion: 'La ventilación es un circuito: entrada, disipador y salida. Filtro tapado o ' +
               'ventilador trabado terminan igual, en apagado por temperatura.'
    },

    /* ---------------- CASO 7 ---------------- */
    {
      id: 'c7',
      titulo: 'Se apaga cuando la exigen',
      cliente: 'Belén — edición de video',
      equipo: 'WinTEC Tower 4000, 5 años de uso, impecable por fuera',
      relato: '"La mandé a limpiar hace dos semanas y sigue igual: abro el programa de video, ' +
              'laburo diez minutos y se apaga. Si navego nomás, anda bárbaro."',
      antecedente: 'Antecedente: limpieza hecha hace dos semanas, sin polvo. Cinco años de uso ' +
                   'y nunca se le tocó la pasta térmica.',
      presupuesto: 40,
      fallas: ['pasta'],
      pieza: 'cooler',
      sintomas: {
        pasta: 'En reposo anda bien. Con carga el CPU trepa a 97 °C en dos minutos y el equipo se apaga.'
      },
      exito: 'Con pasta nueva el CPU se estabiliza en 62 °C exportando video media hora. No se apaga más.',
      pasos: ['preguntar', 'medir_temp', 'ver_disipador', 'abrir', 'ver_pasta', 'medir_rpm',
              'ver_carga', 'limpiar_polvo', 'cambiar_pasta', 'cambiar_vent', 'cambiar_fuente',
              'reinstalar_so'],
      diagnostico: {
        pregunta: 'El equipo estaba limpio y el ventilador giraba bien. ¿Por qué se apagaba con carga?',
        opciones: [
          'La pasta térmica estaba seca y ya no llevaba el calor al disipador',
          'Le faltaba memoria RAM para editar video',
          'La fuente estaba débil',
          'El programa de video tenía un virus'
        ],
        correcta: 0,
        porque: 'Un equipo <b>limpio</b> y con el ventilador girando igual se apaga por temperatura: ' +
                'entre el procesador y el disipador va una capa de <b>pasta térmica</b> que con los ' +
                'años se seca y se cuartea. Seca no transmite: el disipador puede estar impecable y ' +
                'frío mientras el procesador se cocina. Por eso falla <b>sólo con carga</b>, cuando ' +
                'el CPU genera calor de verdad. Se saca el disipador, se limpia con alcohol ' +
                'isopropílico y se pone pasta nueva: es mantenimiento preventivo, cada dos o tres años.'
      },
      leccion: 'Limpiar el polvo no alcanza: la pasta térmica se seca y cambiarla es mantenimiento ' +
               'preventivo, cada dos o tres años, no cuando el equipo ya se apaga.'
    }
  ];

  tech.CASES = CASES;

  /* ============================================================
     Zonas de trabajo
     Cada paso del catálogo pertenece a una zona. Las zonas físicas
     son las piezas que dibuja el banco 3D (js/bench3d.js) y se tocan
     directamente sobre el equipo; las otras dos no están en el
     gabinete: el cliente y el software del equipo.
     ============================================================ */
  var ZONE_ORDER = ['cliente', 'cable', 'fuente', 'boton', 'monitor',
                    'placa', 'ram', 'cooler', 'gpu', 'disco', 'software'];

  var ZONE_LABEL = {
    cliente:  'CLIENTE',
    cable:    'ALIMENTACIÓN',
    fuente:   'FUENTE',
    boton:    'PANEL FRONTAL',
    monitor:  'MONITOR Y VIDEO',
    placa:    'PLACA MADRE',
    ram:      'MEMORIA RAM',
    cooler:   'CPU Y DISIPADOR',
    gpu:      'PLACA DE VIDEO',
    disco:    'DISCO',
    software: 'SISTEMA'
  };

  /* ============================================================
     Qué muestra la pantalla con cada falla pendiente
     Esto es el corazón del modo: el síntoma no se lee en un cartel,
     se lee en el monitor cuando se enciende el equipo. Dos fallas
     distintas pueden dar la MISMA pantalla ("sin señal"), y ahí
     está el trabajo del técnico.
     ============================================================ */
  var FAULT_SCREEN = {
    cable:    'muerta',
    toma:     'muerta',
    'switch': 'muerta',
    fuente:   'muerta',
    boton:    'muerta',
    video:    'sin_senal',
    gpu:      'sin_senal',
    ram:      'post_ram',
    polvo:    'apagon',
    pasta:    'apagon',
    respaldo: 'lenta',
    disco:    'lenta',
    so:       'lenta',

    /* Mantenimiento: humedad, sulfatación y ventilación */
    humedad:     'muerta',
    sulfato:     'lenta',
    sulfato_ram: 'post_ram',
    filtro:      'apagon',
    vent_trabado: 'apagon'
  };

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
  var zone = null;             // zona del equipo seleccionada
  var zones = [];              // zonas con pasos en este caso
  var zoneState = {};          // zona -> 'ok' | 'bad' | 'fixed'
  var testing = false;         // hay una prueba corriendo en el monitor
  var pickedPart = null;       // pieza que el jugador señaló al cerrar
  var pickOk = false;

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

    /* El banco se monta una sola vez y queda escuchando: tocar una
       pieza del dibujo es lo mismo que elegirla en la lista. */
    GT.bench.mount('tech-rig');
    GT.bench.onSelect = selectZone;
    GT.bench.onPower = testEquipment;
    GT.bench.onTool = function () { renderTools(); renderTray(); };

    bindOnce('tech-power', testEquipment);
    bindOnce('tech-turn', function () {
      var atras = GT.bench.turn();
      GT.audio.open();
      setHint(atras
        ? 'Gabinete girado: tenés los conectores de atrás.'
        : 'Gabinete de frente otra vez.');
      renderTray();
    });

    /* Vistas de la cámara: el jugador no camina, se acerca. */
    ['general', 'gabinete', 'interior', 'monitor'].forEach(function (v) {
      bindOnce('tech-view-' + v, function () { GT.bench.look(v); renderViews(v); });
    });

    renderTools();

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
    testing = false;
    pickedPart = null;
    pickOk = false;
    zoneState = {};

    /* Equipo nuevo sobre el banco: cerrado, apagado y sin marcas. */
    GT.bench.reset();

    /* Cada orden trae su suciedad: lo que se ve adentro del gabinete
       depende de las fallas que tenga este equipo. */
    GT.bench.setDust(tiene('polvo') || tiene('filtro'));
    GT.bench.setSulfato(tiene('sulfato') || tiene('sulfato_ram'));
    GT.bench.setWet(tiene('humedad'));

    /* Zonas que esta orden pone en juego, en orden de recorrido */
    zones = ZONE_ORDER.filter(function (z) {
      return cur.pasos.some(function (id) { return STEPS[id] && STEPS[id].parte === z; });
    });
    zone = zones[0] || null;
    GT.bench.select(zone);
    GT.bench.look('general');
    renderViews('general');
    renderTools();

    GT.state.level = i + 1;
    GT.startPuzzle();

    renderCase();
    renderHud();

    GT.audio.open();
    logLine('── ORDEN ' + pad3(i + 1) + ' · ' + cur.titulo.toUpperCase() + ' ──', 'head');
    logLine('Cliente: ' + cur.cliente, 'dim');
    logLine('Síntoma declarado: ' + currentSymptom(), 'sym');
    if (cur.antecedente) logLine(cur.antecedente, 'warn');
    logLine('Empezá inspeccionando. Cada revisión consume minutos de taller.', 'dim');
  }

  function pad3(n) { return (n < 100 ? '0' : '') + (n < 10 ? '0' : '') + n; }

  /** ¿Esta orden tiene tal falla? */
  function tiene(falla) { return cur && cur.fallas.indexOf(falla) !== -1; }

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
      '<h4>LO QUE SE VE EN EL EQUIPO</h4>' +
      '<p class="tk-sintoma" id="tech-sintoma">' + GT.escapeHtml(currentSymptom()) + '</p>' +
      '<p class="tk-tip">Regla del taller: <b>diagnosticar antes de cambiar</b>. ' +
         'Cada repuesto que ponés sin motivo sale del bolsillo del cliente.</p>';

    document.getElementById('tech-log').innerHTML = '';
    document.getElementById('tech-actions').innerHTML = '';

    renderZones();
    renderTray();
  }

  /* ============================================================
     Zonas del equipo
     La misma lista de piezas que el dibujo, en botones: el equipo se
     puede recorrer con el mouse sobre el gabinete o desde acá.
     ============================================================ */
  function renderZones() {
    var nav = document.getElementById('tech-zones');
    if (!nav) return;
    nav.innerHTML = '';

    zones.forEach(function (z) {
      var b = document.createElement('button');
      var st = zoneState[z];
      b.className = 'zone-tab' +
        (z === zone ? ' is-sel' : '') +
        (st ? ' is-' + st : '');
      b.dataset.zone = z;
      b.innerHTML =
        '<i class="zt-dot"></i>' +
        '<span class="zt-name">' + ZONE_LABEL[z] + '</span>' +
        '<span class="zt-n">' + doneInZone(z) + '/' + stepsOf(z).length + '</span>';
      b.addEventListener('click', function () { selectZone(z); });
      nav.appendChild(b);
    });
  }

  /** Pasos de esta orden que corresponden a una zona. */
  function stepsOf(z) {
    return cur.pasos.filter(function (id) { return STEPS[id] && STEPS[id].parte === z; });
  }

  function doneInZone(z) {
    return stepsOf(z).filter(function (id) { return doneSteps[id]; }).length;
  }

  /** Selecciona una zona, venga del dibujo o de la lista. */
  function selectZone(z) {
    /* Durante el cierre de la orden, tocar una pieza es señalarla. */
    if (phase === 'diagnostico' && pickedPart === null) { answerPart(z); return; }
    if (phase !== 'trabajo' || testing) return;
    if (!z || zones.indexOf(z) === -1) return;

    zone = z;
    GT.bench.select(GT.bench.has(z) ? z : null);
    GT.audio.click();
    renderZones();
    renderTray();
  }

  /* ============================================================
     Bandeja de herramientas de la pieza elegida
     ============================================================ */
  function renderTray() {
    var box = document.getElementById('tech-tray');
    if (!box) return;

    if (!zone) { box.innerHTML = ''; return; }

    var list = stepsOf(zone);
    var insp = list.filter(function (id) { return STEPS[id].g === 'inspeccion'; });
    var acts = list.filter(function (id) { return STEPS[id].g === 'accion'; });

    var html =
      '<div class="tray-head">' +
        '<b>' + ZONE_LABEL[zone] + '</b>' +
        '<span>' + trayNote() + '</span>' +
      '</div>';

    html += group('INSPECCIÓN', '(mirar no cuesta plata)', insp);
    html += group('ACCIONES', '(algunas cuestan repuestos)', acts);
    box.innerHTML = html;

    var btns = box.querySelectorAll('.tech-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { doStep(b.dataset.step, b); });
      })(btns[i]);
    }
  }

  function group(title, sub, ids) {
    if (!ids.length) return '';
    var html = '<div class="tech-group"><h4>' + title + ' <small>' + sub + '</small></h4><div class="tech-btns">';
    ids.forEach(function (id) {
      var st = STEPS[id];
      var tool = st.tool || 'mano';
      var faltaTool = (tool !== 'mano' && GT.bench.held() !== tool);
      var faltaLado = (st.lado === 'atras' && !GT.bench.facingBack());
      var locked = (st.req && !doneSteps[st.req]) || faltaTool || faltaLado;

      var pide = '';
      if (faltaTool) pide = ' · necesita ' + GT.bench.toolName(tool).toLowerCase();
      else if (faltaLado) pide = ' · girá el gabinete';
      else if (st.req && !doneSteps[st.req]) pide = ' · requiere: ' + STEPS[st.req].label.toLowerCase();
      else if (tool !== 'mano') pide = ' · con ' + GT.bench.toolName(tool).toLowerCase();

      html +=
        '<button class="tech-btn' + (doneSteps[id] ? ' is-done' : '') + (locked ? ' is-locked' : '') +
          '" data-step="' + id + '">' +
          '<span class="tb-label">' + GT.escapeHtml(st.label) + '</span>' +
          '<span class="tb-meta">' + st.min + ' min' +
            (st.costo ? ' · $' + money(st.costo) : '') + GT.escapeHtml(pide) +
          '</span>' +
        '</button>';
    });
    return html + '</div></div>';
  }

  /** Aviso corto arriba de la bandeja, según en qué está el equipo. */
  function trayNote() {
    if (zone === 'cliente') return 'preguntas al cliente, antes de tocar el equipo';
    if (zone === 'software') return 'el equipo prendido, del lado del sistema';
    if (!GT.bench.isOpen() && insideZone(zone)) return 'hay que abrir el gabinete para llegar acá';
    var st = zoneState[zone];
    if (st === 'bad') return 'falla detectada en esta pieza';
    if (st === 'fixed') return 'pieza reparada';
    if (st === 'ok') return 'revisada, sin novedad';
    return 'sin revisar';
  }

  function insideZone(z) {
    return ['fuente', 'placa', 'ram', 'cooler', 'gpu', 'disco'].indexOf(z) !== -1;
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

  /** Marca el estado de una pieza: queda pintado en el dibujo y en la lista. */
  function markPart(part, st) {
    if (!part) return;
    zoneState[part] = st;
    GT.bench.setStatus(part, st);
    renderZones();
    renderTray();
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
    if (testing) { GT.ui.toast('Esperá que termine la prueba', 'warn'); return; }
    var st = STEPS[id];
    if (!st) return;

    /* La herramienta que hace falta tiene que estar en la mano:
       la tapa no sale sin destornillador y el polvo no se va soplando. */
    var tool = st.tool || 'mano';
    if (tool !== 'mano' && GT.bench.held() !== tool) {
      GT.audio.error();
      logLine('✋ Para eso necesitás: ' + GT.bench.toolName(tool) + '. Está sobre la mesa.', 'warn');
      GT.ui.toast('Agarrá ' + GT.bench.toolName(tool).toLowerCase(), 'warn');
      return;
    }

    /* Lo que está atrás del gabinete se trabaja desde atrás: hay que
       girar el equipo, igual que en el banco. */
    if (st.lado === 'atras' && !GT.bench.facingBack()) {
      GT.audio.error();
      logLine('✋ Eso está en la parte de atrás. Girá el gabinete.', 'warn');
      GT.ui.toast('Girá el gabinete para llegar atrás', 'warn');
      return;
    }

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

    /* Sacar el disipador para mirarle la pasta también se ve en el equipo */
    if (id === 'ver_pasta') GT.bench.pullPart('cooler');

    if (st.g === 'inspeccion') inspect(id, st);
    else act(id, st);

    renderZones();
    renderTray();
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
      markPart(st.parte, 'bad');
      logLine('⚠ ' + st.mal, 'bad');
      logLine('Encontraste algo. Ahora hay que resolverlo, no cambiarlo por las dudas.', 'dim');
      GT.audio.alarm();
      GT.addScore(60, 'falla detectada');
      GT.ui.flash('gain');
    } else {
      markPart(st.parte, 'ok');
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

    /* Abrir el gabinete no repara nada, pero destapa el equipo:
       hasta que no pasa esto, el interior no se puede tocar. */
    if (id === 'abrir') {
      GT.bench.setOpen(true);
      logLine('✔ ' + st.hecho, 'ok');
      GT.audio.open();
      renderViews('interior');
      if (insideZone(zone)) GT.bench.select(zone);
      return;
    }

    /* Lo que se hace con las manos se ve en el equipo */
    sceneEffect(id, st);

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
      markPart(st.parte, 'fixed');
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

  /** Efecto de la acción sobre la escena 3D: la pieza sale del zócalo,
      el polvo se va, la ficha del monitor cambia de puerto. */
  function sceneEffect(id, st) {
    if (id === 'limpiar_polvo' || id === 'limpiar_filtros') GT.bench.cleanDust();
    if (id === 'limpiar_sulfato' || id === 'limpiar_contactos_ram') GT.bench.cleanSulfato();
    if (id === 'secar_equipo') GT.bench.dryOut();
    if (id === 'pasar_video') GT.bench.plugVideoToGpu();

    var sale = {
      reasentar_ram: 'ram', cambiar_ram: 'ram', limpiar_contactos_ram: 'ram',
      reasentar_gpu: 'gpu', cambiar_gpu: 'gpu',
      cambiar_disco: 'disco', cambiar_fuente: 'fuente',
      cambiar_pasta: 'cooler', cambiar_vent: 'cooler'
    };
    if (sale[id]) GT.bench.pullPart(sale[id]);
  }

  /* ============================================================
     Probar el equipo
     ============================================================ */
  /* PROBAR EL EQUIPO: el momento de la verdad. No le digo al jugador cuantas
     fallas faltan; simplemente le muestro el sintoma que queda. Si quedan
     fallas pendientes, el equipo sigue roto (y el sintoma puede haber CAMBIADO,
     que es lo que lo obliga a volver a inspeccionar en vez de adivinar).
     Cuando no queda ninguna, paso a la fase de diagnostico.
     Acá eso se ve en el monitor del banco: se aprieta el botón, el equipo
     intenta arrancar y la pantalla muestra lo que mostraría en el taller.
     Mientras la prueba corre no se puede tocar nada, igual que en la vida
     real: primero se mira qué hace el equipo, después se decide. */
  function testEquipment() {
    if (phase !== 'trabajo' || GT.state.finished || testing) return;

    caseMinutes += 2;
    GT.state.techMinutes = (GT.state.techMinutes || 0) + 2;
    logLine('<b>› Encender y probar el equipo</b> <i>(2 min)</i>', 'step');

    var falla = firstPending();
    var kind = falla ? (FAULT_SCREEN[falla] || 'sin_senal') : 'ok';

    testing = true;
    setHint('Prueba en curso: mirá el monitor.');
    renderTray();
    renderHud();

    GT.bench.screenTest(kind, function () {
      testing = false;

      if (falla) {
        logLine('✘ ' + currentSymptom(), 'bad');
        logLine('La pantalla te lo está diciendo. Seguí buscando por ahí.', 'dim');
        GT.audio.error();
        GT.ui.shake();
        setHint('El equipo sigue fallando. Mirá lo que quedó en el monitor.');
        renderTray();
        renderHud();
        return;
      }

      logLine('✔ ' + cur.exito, 'ok');
      GT.audio.levelUp();
      GT.ui.flash('gain');
      setHint('El equipo arrancó. Ahora hay que cerrar la orden.');
      phase = 'diagnostico';
      renderDiagnosis();
      renderHud();
    });
  }

  /** Primera falla sin resolver: es la que manda en la pantalla. */
  function firstPending() {
    for (var i = 0; i < cur.fallas.length; i++) {
      if (!fixed[cur.fallas[i]]) return cur.fallas[i];
    }
    return null;
  }

  function setHint(txt) {
    var el = document.getElementById('tech-rig-hint');
    if (el) el.textContent = txt;
  }

  function bindOnce(id, fn) {
    var el = document.getElementById(id);
    if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', fn);
  }

  /* ============================================================
     Herramientas de la mesa
     Son las mismas que están sobre el escritorio en 3D: esto es la
     otra forma de agarrarlas, para teclado y pantallas chicas.
     ============================================================ */
  function renderTools() {
    var box = document.getElementById('tech-tools');
    if (!box) return;

    var held = GT.bench.held();
    var html = '<span class="tool-lead">HERRAMIENTAS</span>';

    html += '<button class="tool-btn' + (held === 'mano' ? ' is-held' : '') +
            '" data-tool="mano">MANO</button>';
    GT.bench.tools().forEach(function (t) {
      html += '<button class="tool-btn' + (held === t.id ? ' is-held' : '') +
              '" data-tool="' + t.id + '">' + t.label + '</button>';
    });
    box.innerHTML = html;

    var btns = box.querySelectorAll('.tool-btn');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () { GT.bench.hold(b.dataset.tool); GT.audio.click(); });
      })(btns[i]);
    }
  }

  function renderViews(active) {
    ['general', 'gabinete', 'interior', 'monitor'].forEach(function (v) {
      var el = document.getElementById('tech-view-' + v);
      if (el) el.className = 'view-btn' + (v === active ? ' is-sel' : '');
    });
  }

  /* ============================================================
     Cierre de la orden: explicar la falla
     ============================================================ */
  /* El cierre tiene dos pasos y el primero se hace SOBRE EL EQUIPO:
     el técnico tiene que poder señalar la pieza que falló, no sólo
     elegir una opción de una lista. */
  function renderDiagnosis() {
    document.getElementById('tech-tray').innerHTML = '';
    GT.bench.setPickMode(true);

    document.getElementById('tech-actions').innerHTML =
      '<div class="tech-diag">' +
        '<h4>CERRAR LA ORDEN · PASO 1</h4>' +
        '<p class="td-lead">El equipo anda. Antes de asentar nada en la ficha, ' +
          '<b>señalá en el equipo la pieza que falló</b>: tocala en el gabinete ' +
          'o elegila en la lista de piezas.</p>' +
        '<p class="td-q">¿Dónde estaba la falla?</p>' +
      '</div>';

    setHint('Señalá la pieza que falló.');
  }

  /** Respuesta al paso 1: la pieza señalada sobre el equipo. */
  function answerPart(z) {
    if (phase !== 'diagnostico' || pickedPart !== null) return;

    pickedPart = z;
    pickOk = (z === cur.pieza);
    GT.bench.setPickMode(false);
    GT.bench.select(z);

    if (pickOk) {
      GT.addScore(120, 'pieza señalada correctamente');
      GT.audio.ok();
      logLine('✔ Señalaste ' + ZONE_LABEL[z] + ': era esa.', 'ok');
    } else {
      GT.addScore(-60, 'pieza mal señalada');
      GT.audio.error();
      logLine('✘ Señalaste ' + ZONE_LABEL[z] + ', y la falla no estaba ahí.', 'bad');
    }

    renderZones();
    renderCause();
  }

  /** Paso 2: la causa, como se asienta en la ficha de servicio. */
  function renderCause() {
    var d = cur.diagnostico;
    var box = document.getElementById('tech-actions');

    var html =
      '<div class="tech-diag">' +
        '<h4>CERRAR LA ORDEN · PASO 2</h4>' +
        '<p class="td-lead">' +
          (pickOk
            ? 'Bien señalada: <b>' + ZONE_LABEL[pickedPart] + '</b>. '
            : 'Señalaste <b>' + ZONE_LABEL[pickedPart] + '</b>, que no era. ') +
          'Ahora dejá asentado en la ficha qué era lo que fallaba.</p>' +
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

    resumen.push(pickOk
      ? 'Señalaste bien la pieza sobre el equipo (+120).'
      : 'Señalaste mal la pieza sobre el equipo (−60).');

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
