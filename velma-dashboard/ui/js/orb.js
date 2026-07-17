/*
 * VELMA Orb — dependency-free WebGL renderer.
 *
 * Visual reference: dark space inside the orb, thin electric filaments in
 * green / pink / blue / purple flowing along curved streamlines from a
 * small intense core toward a bright rim, with faint elliptical orbit
 * rings outside. Identity rule: the four dyes always blend; state and
 * capability accents modulate rim glow, pulse, particles, and brightness,
 * but never replace the tie-dye identity.
 * No network fetches, no dynamic HTML: everything renders to one canvas.
 */
(function () {
  "use strict";

  var VERT = [
    "attribute vec2 a_pos;",
    "void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }",
  ].join("\n");

  var FRAG = [
    "precision highp float;",
    "uniform vec2  u_res;",
    "uniform float u_time;",
    "uniform vec3  u_weights;",      // green / pink / blue emphasis
    "uniform float u_weightV;",      // purple emphasis
    "uniform float u_intensity;",    // overall activity 0..1
    "uniform float u_energy;",       // core brightness 0..1
    "uniform float u_turbulence;",   // filament churn 0..1
    "uniform float u_flowSpeed;",    // streamline flow multiplier
    "uniform float u_pulseSpeed;",   // breathing rate
    "uniform vec3  u_accent;",       // state accent (rim/particles only)
    "uniform float u_accentAmt;",
    "uniform float u_particleAmt;",
    "uniform float u_dim;",          // global dimmer (offline/failure)
    "uniform float u_octaves;",      // fbm octave budget (perf scaling)
    "uniform float u_audio;",        // live voice/TTS envelope 0..1
    "uniform vec3  u_dyeG;",
    "uniform vec3  u_dyeP;",
    "uniform vec3  u_dyeB;",
    "uniform vec3  u_dyeV;",
    "",
    "float hash(vec2 p) {",
    "  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);",
    "}",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p); vec2 f = fract(p);",
    "  vec2 u = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),",
    "             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
    "}",
    "float fbm(vec2 p) {",
    "  float v = 0.0; float a = 0.55;",
    "  for (int i = 0; i < 5; i++) {",
    "    if (float(i) >= u_octaves) { break; }",
    "    v += a * noise(p);",
    "    p = p * 2.03 + vec2(11.3, 7.7);",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "",
    "// thin bright ridge from a noise field",
    "float ridge(float n, float sharp) {",
    "  return pow(max(0.0, 1.0 - abs(2.0 * n - 1.0) * sharp), 6.0);",
    "}",
    "",
    "// faint elliptical orbit ring (rotated, squashed circle)",
    "float orbitRing(vec2 uv, float c, float s, float ell, float R) {",
    "  vec2 q = vec2(c * uv.x + s * uv.y, (-s * uv.x + c * uv.y) / ell);",
    "  return exp(-abs(length(q) - R) * 55.0);",
    "}",
    "",
    "void main() {",
    "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / min(u_res.x, u_res.y);",
    "  float r = length(uv);",
    "  float ang = atan(uv.y, uv.x);",
    "  float t = u_time;",
    "",
    "  float breath = 0.5 + 0.5 * sin(t * u_pulseSpeed);",
    "  float orbR = 0.60 + 0.02 * breath + 0.015 * u_intensity + 0.025 * u_audio;",
    "",
    "  // ---- streamline coordinates: filaments FLOW inward, curving ----",
    "  // Position-based (periodic in angle by construction): no seam at",
    "  // the atan discontinuity. Time shifts the radial argument, so",
    "  // features drift inward along their curved rays.",
    "  float twist = 1.1 + 1.3 * u_turbulence;",
    "  float aa = ang + twist * (1.0 - r) * 0.8;",
    "  vec2 dir = vec2(cos(aa), sin(aa));",
    "  vec2 q = dir * (r * 3.4 + 2.2);",
    "  vec2 w = vec2(fbm(q * 0.8 + 3.1), fbm(q * 0.8 + 7.7));",
    "  vec2 fc = q + (w - 0.5) * (1.0 + 1.4 * u_turbulence)",
    "          + dir * (t * 0.32 * u_flowSpeed);",
    "",
    "  // ---- electric fibers: two ridged layers, dark space between ----",
    "  float fib = ridge(fbm(fc * 1.5), 2.6) * 1.05",
    "            + ridge(fbm(fc * 3.0 + 11.3), 3.0) * 0.6;",
    "",
    "  // ---- dye regions (four dyes, sharply separated, all present) ----",
    "  vec2 rc = vec2(cos(ang), sin(ang)) * 2.1 + vec2(0.0, r * 1.4);",
    "  float wg = pow(fbm(rc + vec2(t * 0.015, 0.0)), 4.0) * u_weights.x;",
    "  float wp = pow(fbm(rc * 1.07 + vec2(5.2, t * 0.02)), 4.0) * u_weights.y;",
    "  float wb = pow(fbm(rc * 0.93 + vec2(t * 0.018, 9.4)), 4.0) * u_weights.z;",
    "  float wv = pow(fbm(rc * 1.13 + vec2(3.3, 6.6)), 4.0) * u_weightV;",
    "  float wsum = wg + wp + wb + wv + 1e-4;",
    "  vec3 dye = (u_dyeG * wg + u_dyeP * wp + u_dyeB * wb + u_dyeV * wv) / wsum;",
    "  // deepen color separation without shifting hue",
    "  dye = pow(dye, vec3(1.5)) * 1.8;",
    "",
    "  // ---- interior: near-black with bright filaments ----",
    "  float body = 1.0 - smoothstep(orbR - 0.03, orbR, r);",
    "  float coreFade = smoothstep(0.03, 0.24, r);",
    "  vec3 inner = dye * fib * (0.85 + 1.5 * u_energy)",
    "             * (0.75 + 0.35 * breath) * coreFade;",
    "  inner += dye * 0.045;",
    "",
    "  // ---- small intense core ----",
    "  float core = exp(-r * r * 70.0) * (1.5 + 1.4 * u_energy)",
    "             * (0.85 + 0.3 * breath) + exp(-r * r * 16.0) * 0.22;",
    "  inner += mix(vec3(1.0, 0.88, 1.0), u_dyeP, 0.3) * core;",
    "",
    "  // ---- rim ----",
    "  float ring = exp(-abs(r - orbR) * 34.0);",
    "  vec3 rimBase = mix(dye, u_accent, u_accentAmt);",
    "  vec3 rimCol = rimBase * ring",
    "              * (0.7 + 1.0 * u_intensity + 1.6 * u_audio)",
    "              * (0.75 + 0.35 * breath);",
    "  float halo = exp(-max(r - orbR, 0.0) * 5.0) * (0.06 + 0.14 * u_intensity);",
    "  vec3 haloCol = mix(dye, u_accent, u_accentAmt * 0.6) * halo;",
    "",
    "  // ---- elliptical orbit rings, broken into flickering arcs ----",
    "  float outside = smoothstep(orbR * 0.55, orbR * 0.95, r);",
    "  vec2 av = vec2(cos(ang), sin(ang)) * 1.8;",
    "  float arc1 = orbitRing(uv, 0.88, 0.48, 0.36, 0.80)",
    "             * (0.2 + 0.8 * noise(av + vec2(t * 0.10, 3.0)));",
    "  float arc2 = orbitRing(uv, -0.42, 0.91, 0.46, 0.94)",
    "             * (0.2 + 0.8 * noise(av + vec2(-t * 0.07, 11.0)));",
    "  float arc3 = orbitRing(uv, -0.95, -0.31, 0.30, 0.72)",
    "             * (0.2 + 0.8 * noise(av + vec2(t * 0.05, 23.0)));",
    "  vec3 ringsCol = mix(u_dyeV, dye, 0.35)",
    "                * (arc1 + arc2 + arc3) * 0.22 * outside;",
    "",
    "  // ---- inward-flowing particles outside the orb ----",
    "  vec3 partCol = vec3(0.0);",
    "  if (u_particleAmt > 0.01 && r > orbR * 0.9) {",
    "    float lanes = 34.0;",
    "    float lane = floor((ang / 6.2831853 + 0.5) * lanes);",
    "    float lh = hash(vec2(lane, 3.7));",
    "    float speed = (0.25 + 0.55 * lh) * (0.6 + 1.4 * u_flowSpeed * 0.5);",
    "    float cell = fract((r + t * speed * 0.22 + lh * 7.0) * 3.2);",
    "    float dot_ = smoothstep(0.14, 0.0, abs(cell - 0.5) * 2.0 - 0.02);",
    "    float laneJitter = noise(vec2(lane * 1.7, t * 0.2));",
    "    float laneCenter = fract((ang / 6.2831853 + 0.5) * lanes) - 0.5;",
    "    float across = smoothstep(0.26, 0.0, abs(laneCenter + (laneJitter - 0.5) * 0.3));",
    "    float fade = smoothstep(1.6, orbR, r) * smoothstep(orbR * 0.9, orbR * 1.05, r);",
    "    float streak = dot_ * across * fade * step(0.35, lh);",
    "    vec3 pc = mix(dye, u_accent, u_accentAmt * 0.5);",
    "    partCol = pc * streak * 1.1 * u_particleAmt;",
    "  }",
    "",
    "  vec3 col = inner * body + rimCol + haloCol + ringsCol + partCol;",
    "  col *= u_dim;",
    "",
    "  // tone map hard: highlights stay colored, never bleach to white",
    "  col = col / (1.0 + col * 1.1);",
    "  col = pow(col, vec3(0.95));",
    "",
    "  col *= 1.0 - 0.30 * smoothstep(0.95, 1.9, r);",
    "  gl_FragColor = vec4(col, 1.0);",
    "}",
  ].join("\n");

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error("Shader compile failed: " + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  function Orb(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: false, alpha: false })
      || canvas.getContext("experimental-webgl");
    if (!this.gl) { throw new Error("WebGL unavailable"); }

    var gl = this.gl;
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error("Program link failed: " + gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);
    this.prog = prog;

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    var names = ["u_res", "u_time", "u_weights", "u_weightV", "u_intensity",
      "u_energy", "u_turbulence", "u_flowSpeed", "u_pulseSpeed", "u_accent",
      "u_accentAmt", "u_particleAmt", "u_dim", "u_octaves", "u_audio",
      "u_dyeG", "u_dyeP", "u_dyeB", "u_dyeV"];
    for (var i = 0; i < names.length; i++) {
      this.u[names[i]] = gl.getUniformLocation(prog, names[i]);
    }

    // Render targets (smoothed toward these each frame for gentle transitions)
    this.target = {
      weights: [0.34, 0.33, 0.33],
      weightV: 0.4,
      intensity: 0.1, energy: 0.2, turbulence: 0.4, flowSpeed: 1.0,
      pulseSpeed: 0.9, accent: [0.2, 0.9, 1.0], accentAmt: 0.0,
      particleAmt: 0.3, dim: 1.0,
    };
    this.current = JSON.parse(JSON.stringify(this.target));

    // Dye palette (base / creative / logic / purple roles), rgb 0..1
    this.dye = [
      [0.22, 1.00, 0.55],
      [1.00, 0.24, 0.94],
      [0.18, 0.61, 1.00],
      [0.66, 0.33, 1.00],
    ];

    // Performance profile
    this.resScale = 1.0;
    this.fpsCap = 60;
    this.octaves = 5;
    this.paused = false;
    this.reducedMotion = false;
    this.timeScale = 1.0;

    // Live voice/TTS envelope, set each frame by the main loop. Bypasses
    // the slow target smoothing so the orb tracks speech in real time.
    this.audioLevel = 0;

    this._t = 0;
    this._last = performance.now();
    this._acc = 0;
    this._frames = 0;
    this._fpsWindow = performance.now();
    this.fps = 0;
  }

  Orb.prototype.setDyePalette = function (colors) {
    this.dye = colors;
  };

  Orb.prototype.setPerformanceProfile = function (p) {
    this.resScale = p.resScale;
    this.fpsCap = p.fpsCap;
    this.octaves = p.octaves;
  };

  Orb.prototype.setReducedMotion = function (on) {
    this.reducedMotion = on;
    this.timeScale = on ? 0.12 : 1.0;
  };

  Orb.prototype.resize = function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 2) * this.resScale;
    var w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    var h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  };

  Orb.prototype.applySnapshot = function (snap, stateStyle) {
    var t = this.target;
    t.weights = [snap.weights.green, snap.weights.pink, snap.weights.blue];
    t.weightV = snap.weights.purple;
    t.intensity = snap.activity.intensity * stateStyle.intensityScale;
    t.energy = snap.activity.energy * stateStyle.energyScale;
    t.turbulence = snap.activity.turbulence;
    t.flowSpeed = snap.activity.flow_speed * stateStyle.flowScale;
    t.pulseSpeed = stateStyle.pulseSpeed;
    t.accent = stateStyle.accent;
    t.accentAmt = stateStyle.accentAmt;
    t.particleAmt = stateStyle.particleAmt;
    t.dim = stateStyle.dim;
  };

  Orb.prototype.frame = function (now) {
    var dtMs = now - this._last;
    var minFrame = 1000 / this.fpsCap - 1;
    if (dtMs < minFrame) { return false; }
    this._last = now;

    if (this.paused) { return false; }

    var dt = Math.min(dtMs / 1000, 0.1);
    this._t += dt * this.timeScale;

    // smooth current -> target
    var k = Math.min(1, dt * 2.5);
    var c = this.current, t = this.target;
    for (var i = 0; i < 3; i++) {
      c.weights[i] += (t.weights[i] - c.weights[i]) * k;
      c.accent[i] += (t.accent[i] - c.accent[i]) * k;
    }
    ["weightV", "intensity", "energy", "turbulence", "flowSpeed",
      "pulseSpeed", "accentAmt", "particleAmt", "dim"].forEach(function (key) {
      c[key] += (t[key] - c[key]) * k;
    });

    this.resize();
    var gl = this.gl, u = this.u;
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_time, this._t);
    gl.uniform3f(u.u_weights, c.weights[0], c.weights[1], c.weights[2]);
    gl.uniform1f(u.u_weightV, c.weightV);
    gl.uniform1f(u.u_intensity, c.intensity);
    gl.uniform1f(u.u_energy, c.energy);
    gl.uniform1f(u.u_turbulence, c.turbulence);
    gl.uniform1f(u.u_flowSpeed, c.flowSpeed);
    gl.uniform1f(u.u_pulseSpeed, c.pulseSpeed);
    gl.uniform3f(u.u_accent, c.accent[0], c.accent[1], c.accent[2]);
    gl.uniform1f(u.u_accentAmt, c.accentAmt);
    gl.uniform1f(u.u_particleAmt, this.reducedMotion ? 0.0 : c.particleAmt);
    gl.uniform1f(u.u_dim, c.dim);
    gl.uniform1f(u.u_octaves, this.octaves);
    gl.uniform1f(u.u_audio, this.reducedMotion ? 0.0 : this.audioLevel);
    gl.uniform3f(u.u_dyeG, this.dye[0][0], this.dye[0][1], this.dye[0][2]);
    gl.uniform3f(u.u_dyeP, this.dye[1][0], this.dye[1][1], this.dye[1][2]);
    gl.uniform3f(u.u_dyeB, this.dye[2][0], this.dye[2][1], this.dye[2][2]);
    gl.uniform3f(u.u_dyeV, this.dye[3][0], this.dye[3][1], this.dye[3][2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this._frames++;
    if (now - this._fpsWindow >= 1000) {
      this.fps = Math.round(this._frames * 1000 / (now - this._fpsWindow));
      this._frames = 0;
      this._fpsWindow = now;
    }
    return true;
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.Orb = Orb;
})();
