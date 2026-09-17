/* ============================================================
   Glitch.TEC — Administrador de tareas (Nivel 2: Contencion)
   El jugador tiene que distinguir procesos legitimos de procesos
   del malware. La pista real no es el nombre: es la FIRMA DIGITAL
   y el consumo de recursos. Si la CPU colapsa, pierde integridad.
   ============================================================ */
(function (window, document) {
  'use strict';

  var GT = window.GlitchTec;
  var procs = GT.procs = {};

  var WIN_ID = 'taskmgr';

  var list = [];              // TODOS los procesos vivos (legitimos + hostiles)
  var selectedPid = null;     // fila seleccionada en la tabla
  var cpu = 0, ram = 0;       // totales recalculados en cada tick
  var overloadFor = 0;        // segundos que lleva la CPU en rojo
  var respawnTimer = 0;       // cuenta para que el malware reinyecte procesos
  var active = false;         // ¿esta corriendo la simulacion? (solo nivel 2)

  var RAM_TOTAL = 2048;       // MB simulados
  var CPU_CRITICAL = 92;
  var RESPAWN_EVERY = 26;     // segundos

  /* ============================================================
     Definiciones
     ============================================================ */
  /* SEPARO LOS DATOS DE LA LOGICA: estas tres listas son "contenido" puro.
     Si manana quiero agregar un proceso hostil nuevo, agrego un objeto aca y
     no toco ni una linea del motor de abajo.

     El dato educativo esta escondido en el diseno de los nombres: svch0st.exe
     (con CERO), winupdate32.tmp.exe (un .tmp que se ejecuta), crypt0_lock.exe.
     La pista CONFIABLE no es el nombre —que el malware elige para enganarte—
     sino la firma digital, que es la que se agrega mas abajo en init(). */
  var LEGIT = [
    { pid: 4,    name: 'wintec_kernel.exe', cpu: 2,  ram: 38,  desc: 'Núcleo del sistema operativo', protected: true },
    { pid: 512,  name: 'explorer.exe',      cpu: 3,  ram: 82,  desc: 'Explorador de WinTEC (escritorio y barra de tareas)' },
    { pid: 728,  name: 'svchost.exe',       cpu: 3,  ram: 45,  desc: 'Host genérico de servicios de Windows' },
    { pid: 940,  name: 'defender_rt.exe',   cpu: 6,  ram: 120, desc: 'Antivirus en tiempo real', protected: true },
    { pid: 1180, name: 'chrome.exe',        cpu: 9,  ram: 340, desc: 'Navegador web' },
    { pid: 1322, name: 'audiodg.exe',       cpu: 1,  ram: 22,  desc: 'Aislamiento de gráficos de audio' }
  ];

  var HOSTILE = [
    {
      pid: 6666, name: 'svch0st.exe', cpu: 22, ram: 210,
      desc: 'Host de servicios de Windows',
      family: 'Troyano · Typosquatting',
      lesson: 'Se llama svch0st con un CERO en lugar de la "o". Imita a svchost.exe, ' +
              'un proceso real del sistema, para pasar desapercibido en la lista.'
    },
    {
      pid: 4823, name: 'keylog_svc.exe', cpu: 11, ram: 64,
      desc: 'Servicio de dispositivo de entrada',
      family: 'Keylogger',
      lesson: 'Un keylogger registra cada tecla que presionás y envía el historial ' +
              'a un servidor externo: así roban usuarios, contraseñas y tarjetas.'
    },
    {
      pid: 7311, name: 'crypt0_lock.exe', cpu: 28, ram: 402,
      desc: 'Optimizador de disco',
      family: 'Ransomware',
      lesson: 'El ransomware cifra tus archivos y pide un rescate para devolverlos. ' +
              'Su consumo de CPU es altísimo porque está cifrando el disco ahora mismo.'
    },
    {
      pid: 9042, name: 'winupdate32.tmp.exe', cpu: 16, ram: 156,
      desc: 'Actualización de Windows',
      family: 'Spyware · Dropper',
      lesson: 'Los archivos .tmp que se ejecutan no son actualizaciones. Este descarga ' +
              'módulos nuevos del atacante y espía tu actividad.'
    }
  ];

  var RESPAWN_POOL = [
    { name: 'svhost32.exe',    cpu: 18, ram: 130, desc: 'Host de servicios',
      family: 'Troyano', lesson: 'Otra variante con el nombre mal escrito.' },
    { name: 'miner_x64.exe',   cpu: 26, ram: 180, desc: 'Servicio de gráficos',
      family: 'Cryptominer', lesson: 'Usa tu CPU para minar criptomonedas para el atacante.' },
    { name: 'netscan_bot.exe', cpu: 14, ram: 96,  desc: 'Diagnóstico de red',
      family: 'Botnet', lesson: 'Convierte tu PC en parte de una red de equipos zombis.' }
  ];

  var nextPid = 10000;

  /* ============================================================
     Ciclo de vida
     ============================================================ */
  procs.init = function () {
    list = [];
    /* Armo la lista de la partida clonando las definiciones y agregandoles las
       banderas. Clonar es CLAVE: si metiera los objetos originales, el jitter
       del tick les iria modificando el cpu a las constantes y la segunda
       partida arrancaria con los valores desvirtuados de la primera. */
    LEGIT.forEach(function (p) {
      list.push(clone(p, { signed: true, malicious: false }));
    });
    HOSTILE.forEach(function (p) {
      list.push(clone(p, { signed: false, malicious: true }));
    });
    /* Mezclo para que los hostiles no queden siempre al final de la lista:
       si no, el jugador aprende la posicion en vez de leer la firma. */
    shuffle(list);
    selectedPid = null;
    overloadFor = 0;
    respawnTimer = 0;
    nextPid = 10000;
    active = true;
    recalc();
  };

  procs.stop = function () { active = false; };

  procs.reset = function () {
    list = [];
    active = false;
    cpu = 0; ram = 0;
    selectedPid = null;
  };

  /* Copia superficial de un objeto + campos extra (a mano, sin Object.assign
     ni spread, para no depender de ES6). Ademas guardo baseCpu: el consumo
     "de base" del proceso, sobre el que despues aplico la variacion aleatoria.
     Necesito los dos valores por separado porque si le sumara el ruido
     directamente a p.cpu, el error se iria acumulando tick tras tick y en un
     minuto cualquier proceso estaria al 100%. */
  function clone(p, extra) {
    var o = {};
    Object.keys(p).forEach(function (k) { o[k] = p[k]; });
    Object.keys(extra || {}).forEach(function (k) { o[k] = extra[k]; });
    o.baseCpu = p.cpu;
    return o;
  }

  /* Mezcla de Fisher-Yates: recorro el array de atras para adelante y cambio
     cada elemento por otro elegido al azar ENTRE LOS QUE QUEDAN (de 0 a i).
     Es el algoritmo correcto para mezclar: todas las combinaciones tienen la
     misma probabilidad. El tipico  arr.sort(() => Math.random() - 0.5)  que se
     ve por ahi parece lo mismo pero da resultados sesgados. */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;   // intercambio clasico
    }
  }

  procs.list = function () { return list.slice(); };

  procs.remainingHostile = function () {
    return list.filter(function (p) { return p.malicious; }).length;
  };

  /* ============================================================
     Simulacion
     ============================================================ */
  function recalc() {
    var c = 0, r = 0;
    list.forEach(function (p) { c += p.cpu; r += p.ram; });
    cpu = Math.min(100, Math.round(c));
    ram = Math.min(RAM_TOTAL, Math.round(r));
  }

  /** Se llama desde el loop principal. dt en segundos.
      Aca esta la "simulacion" del administrador de tareas: ruido, escalada del
      malware, castigo por CPU saturada y reinyeccion de procesos. */
  procs.tick = function (dt) {
    if (!active) return;

    list.forEach(function (p) {
      /* jitter = ruido para que los numeros no queden congelados y parezca un
         monitor de verdad. (Math.random() - 0.5) da un valor entre -0.5 y 0.5
         (o sea, tanto para arriba como para abajo); lo multiplico por 4 en los
         hostiles y por 1.5 en los legitimos: el malware ademas de consumir
         mas, consume de forma mas erratica.
         El  Math.round(x * 10) / 10  es el truco para redondear a UN decimal:
         multiplico, redondeo entero, divido. */
      var jitter = (Math.random() - 0.5) * (p.malicious ? 4 : 1.5);
      p.cpu = Math.max(0, Math.round((p.baseCpu + jitter) * 10) / 10);
      /* Presion de tiempo: el malware sube su base 0.35 por segundo, o sea que
         si el jugador se queda mirando, la CPU se satura sola y empieza a
         perder integridad. El Math.min lo topea para que no llegue al infinito. */
      if (p.malicious) p.baseCpu = Math.min(p.baseCpu + dt * 0.35, p.baseCpu + 12);
    });
    recalc();

    /* Castigo por CPU saturada. Acumulo dt y castigo UNA vez por segundo
       (no en cada frame: a 60fps seria 60 veces mas dano del que quiero). */
    if (cpu >= CPU_CRITICAL) {
      overloadFor += dt;
      if (overloadFor >= 1) {
        overloadFor = 0;
        GT.damage(1.8, 'CPU al 100%');
        GT.ui.toast('CPU saturada: el sistema se degrada', 'bad');
      }
    } else {
      overloadFor = 0;        // bajo del umbral: el contador se reinicia
    }

    // El malware reinyecta procesos si tardas demasiado
    if (procs.remainingHostile() > 0) {
      respawnTimer += dt;
      if (respawnTimer >= RESPAWN_EVERY && list.length < 12) {
        respawnTimer = 0;
        spawnHostile();
      }
    }

    render();
  };

  function spawnHostile() {
    var def = GT.pick(RESPAWN_POOL);
    var p = clone(def, { signed: false, malicious: true, pid: nextPid++, isNew: true });
    list.push(p);
    recalc();
    GT.audio.alarm();
    GT.ui.toast('Nuevo proceso hostil detectado: ' + p.name, 'bad');
    GT.terminal.notify('[GLITCH] Puedo generar procesos más rápido de lo que los matás.', 'evil');
    render();
    setTimeout(function () { p.isNew = false; }, 3000);
  }

  /* ============================================================
     Matar procesos
     ============================================================ */
  /* MATAR UN PROCESO — la decision central del nivel 2. La escribi como una
     sola funcion que devuelve un objeto { status, ... } porque la llaman DOS
     interfaces distintas: el boton de la ventana y el comando "kill <pid>" de
     la terminal. Cada una traduce ese status a su propio mensaje; la logica y
     el puntaje viven en un solo lugar y no se pueden desincronizar.

     Los cuatro finales posibles: not-found / protected / malicious / legit. */
  procs.kill = function (pid) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].pid === pid) { idx = i; break; }
    }
    if (idx === -1) { GT.audio.error(); return { status: 'not-found' }; }

    var p = list[idx];

    /* Procesos criticos (el kernel, el antivirus): no se dejan matar. Esto no
       es para joder al jugador, es parte de la leccion: el sistema operativo
       real tambien te frena, y matar a ciegas romperia la maquina. */
    if (p.protected) {
      GT.audio.error();
      GT.ui.toast('Acceso denegado: ' + p.name + ' es crítico para el sistema', 'warn');
      return { status: 'protected', name: p.name };
    }

    list.splice(idx, 1);
    recalc();
    render();

    if (p.malicious) {
      GT.audio.kill();
      GT.addScore(120, 'proceso hostil eliminado');
      GT.ui.flash('gain');
      GT.ui.toast('✔ ' + p.name + ' terminado — ' + p.family, 'info');
      GT.learn(p.family + ': ' + p.lesson);
      GT.terminal.notify('[OK] ' + p.name + ' terminado. ' + p.family, 'ok');
      GT.levels.progress('l2_kill', 1);
      return { status: 'malicious', name: p.name, family: p.family };
    }

    // Error: era legitimo
    GT.audio.hurt();
    GT.state.mistakes++;
    GT.damage(9, 'mataste un proceso legítimo');
    GT.addScore(-60, 'proceso legítimo eliminado');
    GT.ui.shake();
    GT.ui.flash('hit');
    GT.ui.toast('✘ ' + p.name + ' era legítimo. Revisá la firma digital.', 'bad');
    return { status: 'legit', name: p.name };
  };

  /* ============================================================
     Ventana
     ============================================================ */
  procs.open = function () {
    if (GT.ui.isOpen(WIN_ID)) { GT.ui.focusWindow(WIN_ID); return; }

    var body = document.createElement('div');
    body.className = 'tm';
    body.innerHTML =
      '<div class="tm-meters">' +
        '<div class="tm-meter">' +
          '<label>Uso de CPU <b id="tm-cpu-val">0%</b></label>' +
          '<div class="tm-gauge" id="tm-cpu-g"><i style="width:0%"></i></div>' +
        '</div>' +
        '<div class="tm-meter">' +
          '<label>Memoria física <b id="tm-ram-val">0 MB</b></label>' +
          '<div class="tm-gauge" id="tm-ram-g"><i style="width:0%"></i></div>' +
        '</div>' +
      '</div>' +
      '<div id="tm-p5" style="height:74px;background:#0b1610;border-bottom:1px solid #a9a48f;"></div>' +
      '<div class="tm-alert" id="tm-alert"></div>' +
      '<div class="tm-table-wrap">' +
        '<table class="tm-table">' +
          '<thead><tr>' +
            '<th>PID</th><th>Nombre de imagen</th><th>CPU</th><th>Memoria</th>' +
            '<th>Firma digital</th><th>Descripción</th>' +
          '</tr></thead>' +
          '<tbody id="tm-rows"></tbody>' +
        '</table>' +
      '</div>' +
      '<div class="tm-foot">' +
        '<span class="hintline" id="tm-hint">Seleccioná un proceso y terminalo. También podés usar <b>kill &lt;pid&gt;</b> en la Terminal.</span>' +
        '<button class="xp-btn danger" id="tm-kill" disabled>Terminar proceso</button>' +
      '</div>';

    GT.ui.openWindow({
      id: WIN_ID,
      title: 'Administrador de tareas de WinTEC',
      icon: GT.ui.icons.taskmgr,
      width: 700, height: 510,
      x: 90, y: 20,
      body: body,
      onClose: function () {
        if (GT.engine && GT.engine.stopMeters) GT.engine.stopMeters();
      }
    });

    document.getElementById('tm-kill').addEventListener('click', function () {
      if (selectedPid === null) return;
      procs.kill(selectedPid);
      selectedPid = null;
      document.getElementById('tm-kill').disabled = true;
      render();
    });

    GT.levels.complete('l2_open');
    render();
    // Gráficos en vivo dibujados por el motor p5.js
    setTimeout(function () {
      if (GT.engine && GT.engine.startMeters) GT.engine.startMeters('tm-p5');
    }, 50);
  };

  /* ============================================================
     Render
     ============================================================ */
  function render() {
    if (!GT.ui.isOpen(WIN_ID)) return;

    var cpuVal = document.getElementById('tm-cpu-val');
    if (!cpuVal) return;

    cpuVal.textContent = cpu + '%';
    document.getElementById('tm-ram-val').textContent = ram + ' MB / ' + RAM_TOTAL + ' MB';

    var cg = document.getElementById('tm-cpu-g');
    cg.querySelector('i').style.width = cpu + '%';
    cg.className = 'tm-gauge' + (cpu >= CPU_CRITICAL ? ' crit' : cpu >= 70 ? ' warn' : '');

    var rgPct = Math.round(ram / RAM_TOTAL * 100);
    var rg = document.getElementById('tm-ram-g');
    rg.querySelector('i').style.width = rgPct + '%';
    rg.className = 'tm-gauge' + (rgPct >= 85 ? ' crit' : rgPct >= 65 ? ' warn' : '');

    var hostile = procs.remainingHostile();
    var alert = document.getElementById('tm-alert');
    if (hostile > 0) {
      alert.className = 'tm-alert';
      alert.textContent = '⚠ ' + hostile + ' proceso(s) sin firma digital consumiendo recursos. ' +
                          'Los procesos legítimos están firmados por "WinTEC Corp.".';
    } else {
      alert.className = 'tm-alert safe';
      alert.textContent = '✔ No se detectan procesos sin firma. Sistema estable.';
    }

    var tbody = document.getElementById('tm-rows');
    tbody.innerHTML = '';

    /* Ordeno por CPU descendente para que el que mas consume quede primero
       (como el administrador real). Dos detalles:
         - .slice() primero porque sort() MODIFICA el array original, y no
           quiero reordenar mi lista de verdad, solo la vista;
         - el comparador  b.cpu - a.cpu  da positivo cuando b es mayor, y eso
           en sort() significa "b va antes" => descendente. */
    list.slice().sort(function (a, b) { return b.cpu - a.cpu; }).forEach(function (p) {
      var tr = document.createElement('tr');
      if (p.pid === selectedPid) tr.className = 'selected';
      if (p.isNew) tr.className += ' new-proc';

      tr.innerHTML =
        '<td class="num">' + p.pid + '</td>' +
        '<td>' + GT.escapeHtml(p.name) + (p.protected ? ' <small>(crítico)</small>' : '') + '</td>' +
        '<td class="num' + (p.cpu >= 15 ? ' hot' : '') + '">' + p.cpu.toFixed(0) + '%</td>' +
        '<td class="num">' + p.ram + ' MB</td>' +
        '<td class="' + (p.signed ? 'sig-good' : 'sig-bad') + '">' +
          (p.signed ? 'WinTEC Corp. ✔' : 'Sin firma ✘') + '</td>' +
        '<td>' + GT.escapeHtml(p.desc) + '</td>';

      tr.addEventListener('click', function () {
        selectedPid = p.pid;
        document.getElementById('tm-kill').disabled = false;
        document.getElementById('tm-hint').innerHTML =
          'Seleccionado: <b>' + GT.escapeHtml(p.name) + '</b> (PID ' + p.pid + ') — ' +
          (p.signed ? 'firmado por WinTEC Corp.' : '<b style="color:#b5121b">sin firma digital</b>');
        render();
      });

      tr.addEventListener('dblclick', function () {
        procs.kill(p.pid);
        selectedPid = null;
        render();
      });

      tbody.appendChild(tr);
    });
  }

  procs.render = render;
  procs.getCpu = function () { return cpu; };

})(window, document);
