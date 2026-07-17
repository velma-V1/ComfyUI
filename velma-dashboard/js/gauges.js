/*
 * Automotive-style round gauges (canvas 2D, dependency-free).
 * A gauge with value === null renders its needle parked and "--" text:
 * hardware numbers are only ever shown when real telemetry provides them.
 */
(function () {
  "use strict";

  function Gauge(opts) {
    this.name = opts.name;
    this.unit = opts.unit || "%";
    this.max = opts.max || 100;
    this.redline = opts.redline != null ? opts.redline : 0.85; // fraction of max
    this.size = opts.size || 110;
    this.value = null;
    this.displayValue = 0;

    this.cell = document.createElement("div");
    this.cell.className = "gauge-cell";
    this.canvas = document.createElement("canvas");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.size * dpr;
    this.canvas.height = this.size * dpr;
    this.canvas.style.width = this.size + "px";
    this.canvas.style.height = this.size + "px";
    this.ctx = this.canvas.getContext("2d");
    this.ctx.scale(dpr, dpr);

    var label = document.createElement("span");
    label.className = "gauge-name";
    label.textContent = this.name;
    this.cell.appendChild(this.canvas);
    this.cell.appendChild(label);
  }

  var START = Math.PI * 0.75;       // 135deg
  var SWEEP = Math.PI * 1.5;        // 270deg sweep

  Gauge.prototype.set = function (value) {
    this.value = value == null ? null : Math.min(this.max, Math.max(0, value));
  };

  Gauge.prototype.draw = function (dt) {
    var target = this.value == null ? 0 : this.value;
    this.displayValue += (target - this.displayValue) * Math.min(1, dt * 5);

    var ctx = this.ctx;
    var s = this.size, cx = s / 2, cy = s / 2, R = s / 2 - 6;
    ctx.clearRect(0, 0, s, s);

    var noData = this.value == null;
    var frac = this.displayValue / this.max;
    var redFrac = this.redline;

    // outer ring
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,255,170,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // track
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.arc(cx, cy, R - 8, START, START + SWEEP);
    ctx.stroke();

    // redline zone
    ctx.strokeStyle = "rgba(255,77,94,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, R - 8, START + SWEEP * redFrac, START + SWEEP);
    ctx.stroke();

    // value arc
    if (!noData) {
      var col;
      if (frac >= redFrac) { col = "#ff4d5e"; }
      else if (frac >= redFrac * 0.8) { col = "#ffb02e"; }
      else { col = "#39ff8e"; }
      ctx.strokeStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 8, START, START + SWEEP * Math.max(0.002, frac));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // ticks
    ctx.strokeStyle = "rgba(207,232,221,0.45)";
    ctx.lineWidth = 1;
    for (var i = 0; i <= 10; i++) {
      var a = START + SWEEP * (i / 10);
      var r1 = R - 16, r2 = i % 5 === 0 ? R - 22 : R - 19;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }

    // needle
    var na = START + SWEEP * (noData ? 0 : frac);
    ctx.strokeStyle = noData ? "rgba(122,135,148,0.6)" : "#ff3df0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(na) * (R - 20), cy + Math.sin(na) * (R - 20));
    ctx.stroke();
    ctx.fillStyle = noData ? "#7a8794" : "#ff3df0";
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    // value text
    ctx.fillStyle = noData ? "#7a8794" : "#cfe8dd";
    ctx.font = "10px ui-monospace, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    var text = noData ? "--" : Math.round(this.displayValue) + this.unit;
    ctx.fillText(text, cx, cy + R - 14);
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.Gauge = Gauge;
})();
