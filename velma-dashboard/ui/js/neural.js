/*
 * Neural link layer — production port of concept C4 "Loose Council"
 * (N3 ring movement + N5 drift, conversation-style energy).
 *
 * The capability orbs are neurons around the core. Energy moves as a
 * CONVERSATION: the core sends a bright near-white call pulse out along
 * a curved axon; the neuron flashes and dwells while it thinks (rapid
 * flicker), then answers back in its own color; the core flashes on
 * receipt. Neurons also whisper to each other in occasional side chatter.
 *
 * Status drives the dialogue:
 *   active    — called often
 *   available — occasional check-ins
 *   awaiting  — receives the call but HOLDS its answer (keeps thinking)
 *               until the approval state clears, then finally responds
 *   blocked / disabled — silent, dim line only
 *
 * Reduced motion: static faint axons, no pulses. Canvas 2D, no network,
 * no DOM injection.
 */
(function () {
  "use strict";

  var CALL_RGB = [240, 225, 255];

  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    var n = m ? parseInt(m[1], 16) : 0xa854ff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) {
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  }
  function ctrlFor(p0, p1, bend) {
    var mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    var len = Math.max(Math.hypot(dx, dy), 1);
    return [mx - dy / len * bend, my + dx / len * bend];
  }
  function bez(p0, c, p1, u) {
    var v = 1 - u;
    return [v * v * p0[0] + 2 * v * u * c[0] + u * u * p1[0],
            v * v * p0[1] + 2 * v * u * c[1] + u * u * p1[1]];
  }

  var SILENT = { blocked: true, disabled: true };
  var CALL_WEIGHT = { active: 4, awaiting: 2, available: 1 };

  function Neural(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.links = {};        // capId -> per-neuron state
    this.pulses = [];       // dynamic-endpoint pulses
    this.convoTimer = 1.0;
    this.chatterTimer = 2.0;
    this.coreFlash = 0;
    this.reducedMotion = false;
  }

  Neural.prototype._link = function (cap) {
    var l = this.links[cap.id];
    if (!l) {
      l = this.links[cap.id] = {
        rgb: hexToRgb(cap.color),
        bend: (cap.index % 2 === 0 ? 1 : -1) * (34 + (cap.index * 13) % 30),
        charge: 0,
        thinking: false,
        holding: false,   // awaiting-approval: answer withheld
        dwell: 0,
      };
    }
    return l;
  };

  /* pulse endpoints are cap ids (or "core") so they track moving somas */
  Neural.prototype._spawn = function (fromId, toId, rgb, speed, size, cb) {
    this.pulses.push({ from: fromId, to: toId, rgb: rgb, u: 0,
      speed: speed, size: size, cb: cb });
  };

  Neural.prototype._point = function (id, capById, core) {
    if (id === "core") { return core; }
    var c = capById[id];
    return c && c.x != null ? [c.x, c.y] : core;
  };

  Neural.prototype.draw = function (caps, now, dt) {
    var c = this.canvas, ctx = this.ctx;
    var w = window.innerWidth, h = window.innerHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    ctx.clearRect(0, 0, w, h);

    var core = [w / 2, h / 2];
    var self = this;
    var t = now / 1000;
    var capById = {};
    caps.forEach(function (cap) { capById[cap.id] = cap; });

    /* ---------- axons + dendrites + neuron state ---------- */
    caps.forEach(function (cap) {
      if (cap.x == null) { return; }
      var l = self._link(cap);
      var silent = SILENT[cap.status];
      var df = cap.depthFactor == null ? 1 : cap.depthFactor;
      var p = [cap.x, cap.y];
      var ctrl = ctrlFor(p, core, l.bend);

      var lineA = (silent ? 0.04 : 0.08 + 0.16 * l.charge) * (0.55 + 0.45 * df);
      ctx.strokeStyle = rgba(l.rgb, lineA);
      ctx.lineWidth = 1 + l.charge * 0.8;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.quadraticCurveTo(ctrl[0], ctrl[1], core[0], core[1]);
      ctx.stroke();

      // dendrite stubs
      ctx.strokeStyle = rgba(l.rgb, lineA * 1.4);
      ctx.lineWidth = 1;
      for (var d = 0; d < 4; d++) {
        var da = cap.index * 1.7 + d * (Math.PI / 2) + 0.4;
        var baseR = (cap.baseSize || 45) / 2;
        var r0 = baseR * (cap.scale || 1), r1 = r0 + 9 + (d % 2) * 5;
        ctx.beginPath();
        ctx.moveTo(p[0] + Math.cos(da) * r0, p[1] + Math.sin(da) * r0);
        ctx.lineTo(p[0] + Math.cos(da + 0.25) * r1, p[1] + Math.sin(da + 0.25) * r1);
        ctx.stroke();
      }

      // charge / thinking glow beneath the DOM soma
      var think = l.thinking ? 0.22 * (0.5 + 0.5 * Math.sin(t * 18 + cap.index)) : 0;
      var glow = Math.min(1, l.charge + think);
      if (glow > 0.02) {
        var gr = (cap.baseSize || 45) * 0.58 * (cap.scale || 1) * (1 + glow);
        var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], gr);
        g.addColorStop(0, rgba(l.rgb, 0.30 * glow * df + 0.05));
        g.addColorStop(1, rgba(l.rgb, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p[0], p[1], gr, 0, Math.PI * 2); ctx.fill();
      }

      l.charge = Math.max(0, l.charge - dt * 0.8);

      // dwell management: think, then answer — unless holding for approval
      if (l.thinking && !l.holding) {
        l.dwell -= dt;
        if (l.dwell <= 0) {
          l.thinking = false;
          l.charge = 1;
          self._spawn(cap.id, "core", l.rgb, 0.5, 1, function () {
            self.coreFlash = 1;
          });
        }
      }
      // approval cleared -> release the held answer
      if (l.holding && cap.status !== "awaiting") {
        l.holding = false;
        l.thinking = false;
        l.charge = 1;
        self._spawn(cap.id, "core", l.rgb, 0.5, 1, function () {
          self.coreFlash = 1;
        });
      }
    });

    if (!this.reducedMotion) {
      /* ---------- conversation scheduler ---------- */
      this.convoTimer -= dt;
      if (this.convoTimer <= 0) {
        var pool = [];
        caps.forEach(function (cap) {
          var l = self._link(cap);
          if (SILENT[cap.status] || l.thinking || l.holding) { return; }
          var wgt = CALL_WEIGHT[cap.status] || 1;
          for (var k = 0; k < wgt; k++) { pool.push(cap); }
        });
        if (pool.length) {
          var target = pool[Math.floor(Math.random() * pool.length)];
          var tl = self._link(target);
          self._spawn("core", target.id, CALL_RGB, 0.8, 1.2, function () {
            tl.charge = 1;
            tl.thinking = true;
            if (target.status === "awaiting" ||
                (capById[target.id] && capById[target.id].status === "awaiting")) {
              tl.holding = true;   // waits for approval before answering
            } else {
              tl.dwell = 0.5 + Math.random() * 0.7;
            }
          });
        }
        this.convoTimer = 2.0 * (0.7 + Math.random() * 0.6);
      }

      /* ---------- side chatter between neighboring neurons ---------- */
      this.chatterTimer -= dt;
      if (this.chatterTimer <= 0) {
        var talkers = caps.filter(function (cap) { return !SILENT[cap.status]; });
        if (talkers.length > 1) {
          var a = talkers[Math.floor(Math.random() * talkers.length)];
          var b = talkers[(talkers.indexOf(a) + 1) % talkers.length];
          this._spawn(a.id, b.id, this._link(a).rgb, 0.7, 0.8, null);
        }
        this.chatterTimer = 2.5 + Math.random() * 2.5;
      }

      /* ---------- pulses (dynamic endpoints track moving somas) ---------- */
      var alive = [];
      for (var i = 0; i < this.pulses.length; i++) {
        var pu = this.pulses[i];
        pu.u += dt * pu.speed;
        if (pu.u >= 1) { if (pu.cb) { pu.cb(); } continue; }
        var p0 = this._point(pu.from, capById, core);
        var p1 = this._point(pu.to, capById, core);
        var bendRef = pu.from === "core" ? pu.to : pu.from;
        var bl = this.links[bendRef];
        var ct = ctrlFor(p0, p1, bl ? bl.bend * 0.6 : 20);
        var pt = bez(p0, ct, p1, pu.u);
        var pr = 6 * pu.size;
        var pg = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], pr);
        pg.addColorStop(0, rgba(pu.rgb, 0.95));
        pg.addColorStop(0.4, rgba(pu.rgb, 0.5));
        pg.addColorStop(1, rgba(pu.rgb, 0));
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(pt[0], pt[1], pr, 0, Math.PI * 2); ctx.fill();
        alive.push(pu);
      }
      this.pulses = alive;
    }

    /* ---------- core receipt flash (over the WebGL orb's center) ---------- */
    if (this.coreFlash > 0.01) {
      var fr = 60 * this.coreFlash;
      var fg = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], fr);
      fg.addColorStop(0, "rgba(255,235,255," + (0.35 * this.coreFlash) + ")");
      fg.addColorStop(0.5, "rgba(255,61,240," + (0.12 * this.coreFlash) + ")");
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(core[0], core[1], fr, 0, Math.PI * 2); ctx.fill();
    }
    this.coreFlash = Math.max(0, this.coreFlash - dt * 1.4);
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.Neural = Neural;
})();
