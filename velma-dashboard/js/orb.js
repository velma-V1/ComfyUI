/*
 * VELMA Orb — dependency-free WebGL renderer.
 *
 * Identity rule: the orb always blends neon green / blue / pink. State and
 * capability accents modulate rim glow, pulse, particles, and brightness,
 * but never replace the base tie-dye identity.
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
    "uniform vec3  u_weights;",      // green / pink / blue emphasis (each >= 0.15)
    "uniform float u_intensity;",    // overall activity 0..1
    "uniform float u_energy;",       // core brightness 0..1
    "uniform float u_turbulence;",   // noise churn 0..1
    "uniform float u_flowSpeed;",    // internal flow multiplier
    "uniform float u_pulseSpeed;",   // breathing rate
    "uniform vec3  u_accent;",       // state accent color (rim/particles only)
    "uniform float u_accentAmt;",    // how strongly accent tints rim 0..1
    "uniform float u_particleAmt;",  // inward particle density 0..1
    "uniform float u_dim;",          // global dimmer (offline/failure)
    "uniform float u_octaves;",      // fbm octave budget (perf scaling)",
    "",
    "const vec3 GREEN = vec3(0.22, 1.00, 0.55);",
    "const vec3 PINK  = vec3(1.00, 0.24, 0.94);",
    "const vec3 BLUE  = vec3(0.18, 0.61, 1.00);",
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
    "void main() {",
    "  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / min(u_res.x, u_res.y);",
    "  float r = length(uv);",
    "  float ang = atan(uv.y, uv.x);",
    "  float t = u_time;",
    "",
    "  float breath = 0.5 + 0.5 * sin(t * u_pulseSpeed);",
    "  float orbR = 0.58 + 0.025 * breath + 0.02 * u_intensity;",
    "",
    "  // ---- internal tie-dye field ----",
    "  float swirl = (1.0 - smoothstep(0.0, orbR, r)) * (2.2 + 3.5 * u_turbulence);",
    "  float a2 = ang + swirl * sin(r * 5.0 - t * 0.35 * u_flowSpeed);",
    "  vec2 q = vec2(cos(a2), sin(a2)) * r;",
    "  vec2 warp = vec2(fbm(q * 2.4 + t * 0.13 * u_flowSpeed),",
    "                   fbm(q * 2.4 - t * 0.11 * u_flowSpeed + 5.2));",
    "  vec2 p2 = q * 3.0 + (warp - 0.5) * (1.6 + 2.2 * u_turbulence);",
    "",
    "  float fg = fbm(p2 + vec2(t * 0.05, 0.0));",
    "  float fp = fbm(p2 * 1.13 + vec2(4.7, t * 0.06));",
    "  float fb = fbm(p2 * 0.91 + vec2(t * 0.04, 9.1));",
    "",
    "  // sharpen the fields so color regions separate into tie-dye bands",
    "  float wg = pow(fg, 2.6) * u_weights.x;",
    "  float wp = pow(fp, 2.6) * u_weights.y;",
    "  float wb = pow(fb, 2.6) * u_weights.z;",
    "  float wsum = wg + wp + wb + 1e-4;",
    "  vec3 dye = (GREEN * wg + PINK * wp + BLUE * wb) / wsum;",
    "",
    "  float filaments = pow(fbm(p2 * 2.1 - t * 0.18 * u_flowSpeed), 3.0);",
    "  vec3 inner = dye * (0.55 + 2.4 * filaments) * (0.8 + 0.5 * breath);",
    "",
    "  // ---- energy core (small, tinted, never bleaching the dye) ----",
    "  float core = exp(-r * r * 42.0) * (0.7 + 1.3 * u_energy) * (0.85 + 0.3 * breath);",
    "  inner += mix(dye, vec3(1.0, 0.9, 1.0), 0.6) * core;",
    "",
    "  // ---- orb mask + rim ----",
    "  float body = 1.0 - smoothstep(orbR - 0.05, orbR, r);",
    "  float rim = smoothstep(orbR - 0.09, orbR, r) * (1.0 - smoothstep(orbR, orbR + 0.09, r));",
    "  vec3 rimBase = mix(dye, u_accent, u_accentAmt);",
    "  vec3 rimCol = rimBase * rim * (1.6 + 2.4 * u_intensity) * (0.7 + 0.45 * breath);",
    "",
    "  // ---- outer halo ----",
    "  float halo = exp(-max(r - orbR, 0.0) * 5.5) * (0.16 + 0.30 * u_intensity);",
    "  vec3 haloCol = mix(dye, u_accent, u_accentAmt * 0.6) * halo;",
    "",
    "  // ---- inward-flowing particles (outside the orb, moving toward it) ----",
    "  vec3 partCol = vec3(0.0);",
    "  if (u_particleAmt > 0.01 && r > orbR * 0.9) {",
    "    float lanes = 34.0;",
    "    float lane = floor((ang / 6.2831853 + 0.5) * lanes);",
    "    float lh = hash(vec2(lane, 3.7));",
    "    float speed = (0.25 + 0.55 * lh) * (0.6 + 1.4 * u_flowSpeed * 0.5);",
    "    float cell = fract((r + t * speed * 0.22 + lh * 7.0) * 3.2);",
    "    float dot_ = smoothstep(0.16, 0.0, abs(cell - 0.5) * 2.0 - 0.02);",
    "    float laneJitter = noise(vec2(lane * 1.7, t * 0.2));",
    "    float laneCenter = fract((ang / 6.2831853 + 0.5) * lanes) - 0.5;",
    "    float across = smoothstep(0.30, 0.0, abs(laneCenter + (laneJitter - 0.5) * 0.3));",
    "    float fade = smoothstep(1.6, orbR, r) * smoothstep(orbR * 0.9, orbR * 1.05, r);",
    "    float streak = dot_ * across * fade * step(0.35, lh);",
    "    vec3 pc = mix(dye, u_accent, u_accentAmt * 0.5);",
    "    partCol = pc * streak * 1.6 * u_particleAmt;",
    "  }",
    "",
    "  vec3 col = inner * body + rimCol + haloCol + partCol;",
    "  col *= u_dim;",
    "",
    "  // tone map: keep highlights colored instead of clipping to white",
    "  col = col / (1.0 + col * 0.6);",
    "  col = pow(col, vec3(0.9));",
    "",
    "  // subtle vignette",
    "  col *= 1.0 - 0.35 * smoothstep(0.9, 1.7, r);",
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
    var names = ["u_res", "u_time", "u_weights", "u_intensity", "u_energy",
      "u_turbulence", "u_flowSpeed", "u_pulseSpeed", "u_accent", "u_accentAmt",
      "u_particleAmt", "u_dim", "u_octaves"];
    for (var i = 0; i < names.length; i++) {
      this.u[names[i]] = gl.getUniformLocation(prog, names[i]);
    }

    // Render targets (smoothed toward these each frame for gentle transitions)
    this.target = {
      weights: [0.34, 0.33, 0.33],
      intensity: 0.1, energy: 0.2, turbulence: 0.4, flowSpeed: 1.0,
      pulseSpeed: 0.9, accent: [0.2, 0.9, 1.0], accentAmt: 0.0,
      particleAmt: 0.3, dim: 1.0,
    };
    this.current = JSON.parse(JSON.stringify(this.target));

    // Performance profile
    this.resScale = 1.0;
    this.fpsCap = 60;
    this.octaves = 5;
    this.paused = false;
    this.reducedMotion = false;
    this.timeScale = 1.0;

    this._t = 0;
    this._last = performance.now();
    this._acc = 0;
    this._frames = 0;
    this._fpsWindow = performance.now();
    this.fps = 0;
  }

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
    ["intensity", "energy", "turbulence", "flowSpeed", "pulseSpeed",
      "accentAmt", "particleAmt", "dim"].forEach(function (key) {
      c[key] += (t[key] - c[key]) * k;
    });

    this.resize();
    var gl = this.gl, u = this.u;
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_time, this._t);
    gl.uniform3f(u.u_weights, c.weights[0], c.weights[1], c.weights[2]);
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
