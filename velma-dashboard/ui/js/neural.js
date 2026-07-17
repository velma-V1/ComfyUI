/*
 * Neural link layer: the capability orbs are neurons. Each soma connects
 * to the main orb's core by a curved axon highway, and energy transfer is
 * shown as small bright pulses traveling along the axon. Pulse rate
 * follows capability status (active fires fast, available occasionally,
 * blocked/disabled stays silent). Canvas 2D, drawn under the orbs.
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

  var RATE = { active: 0.7, awaiting: 1.6, available: 3.5 };

  function Neural(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.links = {};   // capId -> { rgb, pulses:[progress], nextAt, bend }
    this.reducedMotion = false;
  }

  Neural.prototype.ensureLink = function (id, color, index) {
    if (!this.links[id]) {
      this.links[id] = {
        rgb: hexToRgb(color),
        pulses: [],
        nextAt: Math.random() * 2,
        bend: (index % 2 === 0 ? 1 : -1) * (36 + (index * 13) % 40),
      };
    }
    return this.links[id];
  };

  /* Quadratic bezier point */
  function bez(p0x, p0y, cx, cy, p1x, p1y, u) {
    var v = 1 - u;
    return [
      v * v * p0x + 2 * v * u * cx + u * u * p1x,
      v * v * p0y + 2 * v * u * cy + u * u * p1y,
    ];
  }

  /*
   * caps: [{ id, color, status, x, y, scale, depthFactor }]
   * Positions come from the orbit animator each frame.
   */
  Neural.prototype.draw = function (caps, now, dt) {
    var c = this.canvas, ctx = this.ctx;
    var w = window.innerWidth, h = window.innerHeight;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    ctx.clearRect(0, 0, w, h);

    var cx0 = w / 2, cy0 = h / 2;
    var self = this;

    caps.forEach(function (cap) {
      if (cap.x == null) { return; }
      var link = self.ensureLink(cap.id, cap.color, cap.index);
      var silent = cap.status === "blocked" || cap.status === "disabled";
      var df = cap.depthFactor == null ? 1 : cap.depthFactor;

      // control point: bowed midpoint -> organic axon curve
      var mx = (cx0 + cap.x) / 2, my = (cy0 + cap.y) / 2;
      var dx = cap.x - cx0, dy = cap.y - cy0;
      var len = Math.max(Math.hypot(dx, dy), 1);
      var px = -dy / len, py = dx / len;
      var bcx = mx + px * link.bend, bcy = my + py * link.bend;

      // axon: faint line, slightly brighter when the neuron is active
      var lineA = (silent ? 0.04 : cap.status === "active" ? 0.22 : 0.10)
        * (0.5 + 0.5 * df);
      ctx.strokeStyle = rgba(link.rgb, lineA);
      ctx.lineWidth = cap.status === "active" ? 1.4 : 1;
      ctx.beginPath();
      ctx.moveTo(cap.x, cap.y);
      ctx.quadraticCurveTo(bcx, bcy, cx0, cy0);
      ctx.stroke();

      // dendrite stubs radiating from the soma
      ctx.strokeStyle = rgba(link.rgb, lineA * 1.4);
      ctx.lineWidth = 1;
      for (var d = 0; d < 4; d++) {
        var da = cap.index * 1.7 + d * (Math.PI / 2) + 0.4;
        var r0 = 15 * (cap.scale || 1), r1 = r0 + 9 + (d % 2) * 5;
        ctx.beginPath();
        ctx.moveTo(cap.x + Math.cos(da) * r0, cap.y + Math.sin(da) * r0);
        ctx.lineTo(cap.x + Math.cos(da + 0.25) * r1, cap.y + Math.sin(da + 0.25) * r1);
        ctx.stroke();
      }

      if (self.reducedMotion) { return; }

      // spawn pulses by status
      if (!silent) {
        link.nextAt -= dt;
        if (link.nextAt <= 0) {
          link.pulses.push(0);
          var rate = RATE[cap.status] || 4;
          link.nextAt = rate * (0.7 + Math.random() * 0.6);
        }
      }

      // advance + draw pulses traveling soma -> core
      var speed = cap.status === "active" ? 0.55 : 0.4;
      var alive = [];
      for (var i = 0; i < link.pulses.length; i++) {
        var u = link.pulses[i] + dt * speed;
        if (u <= 1) {
          alive.push(u);
          var pt = bez(cap.x, cap.y, bcx, bcy, cx0, cy0, u);
          var glowR = 5 + 3 * df;
          var g = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], glowR);
          g.addColorStop(0, rgba(link.rgb, 0.9 * df + 0.1));
          g.addColorStop(1, rgba(link.rgb, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], glowR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      link.pulses = alive;
    });
    void now;
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.Neural = Neural;
})();
