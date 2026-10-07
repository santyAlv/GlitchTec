/* ============================================================
   Glitch.TEC — audio sintetizado con WebAudio
   No usa archivos externos: todo el sonido se genera en runtime,
   asi el prototipo funciona sin conexion y sin assets.
   ============================================================ */
(function (window) {
  'use strict';

  var GT = window.GlitchTec;
  var ctx = null;
  var muted = false;

  function ac() {
    if (!ctx) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* Un tono simple con envolvente para evitar clicks */
  function tone(freq, duration, type, volume, delay) {
    if (muted) return;
    var a = ac();
    if (!a) return;

    var t0 = a.currentTime + (delay || 0);
    var osc = a.createOscillator();
    var gain = a.createGain();

    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);

    var v = (volume === undefined ? 0.08 : volume);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /* Barrido de frecuencia, para alarmas y glitches */
  function sweep(from, to, duration, type, volume) {
    if (muted) return;
    var a = ac();
    if (!a) return;

    var t0 = a.currentTime;
    var osc = a.createOscillator();
    var gain = a.createGain();

    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);

    gain.gain.setValueAtTime(volume || 0.07, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /* Ruido blanco corto: estatica / corrupcion */
  function noise(duration, volume) {
    if (muted) return;
    var a = ac();
    if (!a) return;

    var frames = Math.floor(a.sampleRate * duration);
    var buffer = a.createBuffer(1, frames, a.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

    var src = a.createBufferSource();
    var gain = a.createGain();
    src.buffer = buffer;
    gain.gain.value = volume || 0.05;
    src.connect(gain).connect(a.destination);
    src.start();
  }

  GT.audio = {
    isMuted: function () { return muted; },

    toggleMute: function () {
      muted = !muted;
      if (!muted) tone(660, 0.06, 'square', 0.05);
      return muted;
    },

    key:      function () { tone(1500 + GT.rand(-140, 140), 0.018, 'square', 0.022); },
    click:    function () { tone(880, 0.035, 'square', 0.05); },
    open:     function () { tone(520, 0.05, 'triangle', 0.06); tone(780, 0.06, 'triangle', 0.05, 0.05); },
    close:    function () { tone(420, 0.05, 'triangle', 0.05); tone(280, 0.06, 'triangle', 0.04, 0.045); },

    ok:       function () { tone(660, 0.07, 'square', 0.06); tone(880, 0.09, 'square', 0.06, 0.07); tone(1174, 0.14, 'square', 0.06, 0.15); },
    error:    function () { tone(200, 0.13, 'sawtooth', 0.07); tone(150, 0.18, 'sawtooth', 0.06, 0.1); },
    hurt:     function () { sweep(420, 90, 0.3, 'sawtooth', 0.09); noise(0.14, 0.05); },

    popup:    function () { tone(1046, 0.05, 'square', 0.06); tone(784, 0.09, 'square', 0.05, 0.05); },
    alarm:    function () { tone(880, 0.1, 'square', 0.07); tone(660, 0.1, 'square', 0.07, 0.12); },
    glitch:   function () { noise(0.22, 0.07); sweep(1200, 180, 0.22, 'square', 0.05); },

    kill:     function () { sweep(700, 120, 0.16, 'square', 0.07); },
    levelUp:  function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.13, 'triangle', 0.07, i * 0.1); });
    },
    boot:     function () { tone(1046, 0.28, 'square', 0.05); },
    /* Pitido del parlante de la placa: el codigo de error del POST.
       Largo o corto, porque la combinacion es la que dice que falla. */
    beep:     function (long) { tone(900, long ? 0.42 : 0.1, 'square', 0.075); },
    victory:  function () {
      [523, 659, 784, 1046, 1318].forEach(function (f, i) { tone(f, 0.2, 'triangle', 0.07, i * 0.14); });
    },
    defeat:   function () { sweep(320, 40, 1.1, 'sawtooth', 0.1); noise(0.6, 0.06); }
  };

})(window);
