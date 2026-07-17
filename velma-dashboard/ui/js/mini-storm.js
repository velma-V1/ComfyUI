/*
 * Mini lightning-storm renderer for capability orbs.
 *
 * Each capability orb gets its own small canvas "planet": a dark cloudy
 * body tinted in the capability's color, with rolling cloud drift and a
 * couple of jagged, independently flickering lightning bolts — a tiny
 * cousin of the main Ion Storm orb, not a static lit sphere. Canvas 2D
 * (not WebGL) so a dozen of these stay cheap alongside the neural link
 * canvas and the single WebGL context used by the main orb.
 */
(function () {
  "use strict";

  function hexToRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    var n = m ? parseInt(m[1], 16) : 0xa854ff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(rgb, a) {
    return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
  }
  function hash(x) {
    var s = Math.sin(x * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  }

  /* baseSize: fixed CSS px the canvas backing store is sized to once.
     Depth scaling afterward is a pure CSS transform, not a resize, so
     drawing stays cheap even while the orbit loop scales/dims the node. */
  function MiniOrb(canvas, colorHex, seed, baseSize) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.rgb = hexToRgb(colorHex);
    this.seed = seed * 7.31 + 1.7;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var px = Math.max(1, Math.round(baseSize * dpr));
    canvas.width = px;
    canvas.height = px;
  }

  MiniOrb.prototype.draw = function (t, charge) {
    var ctx = this.ctx, canvas = this.canvas;
    var w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2, R = w / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // dark storm body, tinted with the capability color
    var base = ctx.createRadialGradient(
      cx - R * 0.25, cy - R * 0.3, R * 0.05, cx, cy, R * 1.05);
    base.addColorStop(0, rgba(this.rgb, 0.30 + 0.18 * charge));
    base.addColorStop(0.55, rgba(this.rgb, 0.12));
    base.addColorStop(1, "rgba(3,1,8,0.95)");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // rolling cloud: two soft drifting blobs
    for (var k = 0; k < 2; k++) {
      var a = t * (0.35 + 0.1 * k) + this.seed * (k + 1);
      var bx = cx + Math.cos(a) * R * 0.4, by = cy + Math.sin(a) * R * 0.35;
      var bg = ctx.createRadialGradient(bx, by, 0, bx, by, R * 0.6);
      bg.addColorStop(0, rgba(this.rgb, 0.16));
      bg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(bx, by, R * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // two jagged lightning bolts, each with its own flicker/strike cycle
    ctx.lineWidth = Math.max(1, R * 0.10);
    ctx.shadowColor = rgba(this.rgb, 1);
    ctx.shadowBlur = R * 0.35;
    var bolts = 2;
    for (var b = 0; b < bolts; b++) {
      var flick = 0.5 + 0.5 * Math.sin(t * (3 + b) + this.seed * (b + 3) * 5.0);
      var strike = Math.pow(
        Math.max(0, Math.sin(t * 0.55 + this.seed * (b + 1) * 3.0)), 10.0);
      var bright = 0.30 + 0.45 * flick + 1.1 * strike + 0.55 * charge;
      ctx.globalAlpha = Math.min(1, bright);
      ctx.strokeStyle = rgba(this.rgb, 1);
      var ang0 = this.seed * (b + 2) + t * 0.15 * (b ? -1 : 1);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      var steps = 4;
      for (var s = 1; s <= steps; s++) {
        var frac = s / steps;
        var ang = ang0 + (hash(this.seed * 3 + b * 11 + s) - 0.5) * 1.6;
        var rr = R * frac * 0.95;
        ctx.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // small bright core
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.3);
    core.addColorStop(0, "rgba(255,255,255," + (0.30 + 0.35 * charge) + ")");
    core.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // rim shading for a spherical, planet-like read
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
    var rim = ctx.createRadialGradient(cx, cy, R * 0.68, cx, cy, R);
    rim.addColorStop(0, "rgba(0,0,0,0)");
    rim.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = rim;
    ctx.fill();
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.MiniOrb = MiniOrb;
})();
