/*
 * Voice sync: local, opt-in audio reactivity.
 *
 * Two inputs feed the orb's audio channel; it uses whichever is louder:
 *  - snapshot `activity.audio_level` pushed by Core (e.g. TTS envelope),
 *  - an optional microphone analyser started from the Voice Sync button.
 *
 * Privacy rules: the microphone is off by default, started only by an
 * explicit user click, analysed in-page for a single RMS loudness number,
 * and never recorded, stored, or transmitted. Stopping releases the track.
 */
(function () {
  "use strict";

  var audio = {
    ctx: null,
    analyser: null,
    stream: null,
    buf: null,
    running: false,
    level: 0,       // smoothed 0..1 mic loudness, read by the orb loop
    _raf: null,

    start: function () {
      var self = this;
      if (this.running) { return Promise.resolve(); }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return Promise.reject(new Error("Microphone API unavailable"));
      }
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(function (stream) {
          self.stream = stream;
          self.ctx = new (window.AudioContext || window.webkitAudioContext)();
          var source = self.ctx.createMediaStreamSource(stream);
          self.analyser = self.ctx.createAnalyser();
          self.analyser.fftSize = 512;
          self.analyser.smoothingTimeConstant = 0.6;
          source.connect(self.analyser);
          // analyser is a dead end: nothing is connected to the output,
          // so the mic is never audible or recorded.
          self.buf = new Uint8Array(self.analyser.fftSize);
          self.running = true;
          self._tick();
        });
    },

    stop: function () {
      this.running = false;
      if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
      if (this.stream) {
        this.stream.getTracks().forEach(function (t) { t.stop(); });
        this.stream = null;
      }
      if (this.ctx) { this.ctx.close(); this.ctx = null; }
      this.analyser = null;
      this.level = 0;
    },

    _tick: function () {
      if (!this.running || !this.analyser) { return; }
      this.analyser.getByteTimeDomainData(this.buf);
      var sum = 0;
      for (var i = 0; i < this.buf.length; i++) {
        var v = (this.buf[i] - 128) / 128;
        sum += v * v;
      }
      var rms = Math.sqrt(sum / this.buf.length);
      // map typical speech RMS (~0.02..0.3) onto 0..1 with fast attack,
      // slower release so the orb "breathes with" the voice
      var target = Math.min(1, rms * 4);
      this.level += (target - this.level) * (target > this.level ? 0.5 : 0.08);
      var self = this;
      this._raf = requestAnimationFrame(function () { self._tick(); });
    },
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.audio = audio;
})();
