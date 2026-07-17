/*
 * VELMA Orb — dependency-free WebGL renderer.
 *
 * Design: ION STORM (concept B1, chosen in review). A dim storm cloud
 * rolls inside the orb; four colored currents (green / pink / blue /
 * purple) writhe across it like living filaments — time runs inside the
 * domain warp, so the lines snake, split, and reconnect. Each current
 * periodically STRIKES like lightning: the line flashes bright and the
 * cloud lights up around it. Crossings between two colors flash hot.
 * The core waxes, bursts, and fades with activity instead of holding
 * constant. State accents modulate rim, particles, and brightness only —
 * the four-dye identity is permanent.
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
    "uniform float u_energy;",       // strike rate/brightness 0..1
    "uniform float u_turbulence;",   // filament writhe 0..1
    "uniform float u_drift;",        // integrated flow phase (JS accumulates, no jerk)
    "uniform float u_phase;",        // integrated breath phase (JS accumulates)
    "uniform float u_corePhase;",    // integrated core-envelope phase (floored rate)
    "uniform float u_particlePhase;",// integrated particle radial phase
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
    "vec2 rot2(vec2 p, float a) {",
    "  float c = cos(a); float s = sin(a);",
    "  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);",
    "}",
    "",
    "// Living filament: time inside the warp makes lines writhe and",
    "// reconnect. Returns (sharp bolt line, wide halo around the line).",
    "vec2 filpair(vec2 q, float t, float seed, float writhe) {",
    "  vec2 w = vec2(fbm(q * 0.85 + vec2(t * 0.14, seed)),",
    "                fbm(q * 0.85 + vec2(seed + 4.7, -t * 0.11)));",
    "  float n = fbm(q + (w - 0.5) * writhe);",
    "  float sharp = pow(max(0.0, 1.0 - abs(2.0 * n - 1.0) * 1.9), 5.0);",
    "  float wide  = pow(max(0.0, 1.0 - abs(2.0 * n - 1.0) * 1.15), 2.0);",
    "  return vec2(sharp, wide);",
    "}",
    "",
    "// Rare surge per current: most of the time near zero, occasionally",
    "// spikes hard — the lightning strike.",
    "float strikeGate(float t, float seed) {",
    "  return pow(noise(vec2(t * 0.8, seed * 3.7)), 5.0) * 6.0;",
    "}",
    "",
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
    "  float breath = 1.0 + 0.08 * sin(u_phase);",
    "  float orbR = 0.62 + 0.015 * u_intensity + 0.03 * u_audio;",
    "  float body = 1.0 - smoothstep(orbR - 0.04, orbR, r);",
    "",
    "  // ---- rolling storm cloud (dim backdrop) ----",
    "  vec2 qc = rot2(uv, t * 0.03) * 2.0 + vec2(t * 0.07, 0.0);",
    "  float cloudN = pow(fbm(qc + fbm(qc + t * 0.04) * 1.4), 2.2);",
    "  float selc = fbm(qc * 0.5 + 3.0);",
    "  vec3 cloudDye = mix(mix(u_dyeV, u_dyeB, smoothstep(0.3, 0.5, selc)),",
    "                      mix(u_dyeP, u_dyeG, smoothstep(0.55, 0.75, selc)),",
    "                      smoothstep(0.45, 0.6, selc));",
    "  vec3 inner = cloudDye * cloudN * 0.20;",
    "",
    "  // ---- four writhing currents, four drift directions ----",
    "  // u_drift is JS-integrated (drift += dt * flowSpeed), never raw",
    "  // speed * absolute time, so a state change smoothly changes the",
    "  // RATE of drift instead of snapping the current phase/position.",
    "  float dr = u_drift;",
    "  float wr = 1.8 + 1.2 * u_turbulence;",
    "  vec2 fG = filpair(rot2(uv,  dr * 0.05) * 2.6 + vec2( dr * 0.12, 0.0),          t, 1.3, wr);",
    "  vec2 fP = filpair(rot2(uv, -dr * 0.06) * 2.7 + vec2(0.0,  dr * 0.11),          t, 4.2, wr);",
    "  vec2 fB = filpair(rot2(uv,  dr * 0.04) * 2.5 + vec2(-dr * 0.10,  dr * 0.05),   t, 7.9, wr);",
    "  vec2 fV = filpair(rot2(uv, -dr * 0.05) * 2.8 + vec2( dr * 0.06, -dr * 0.09),   t, 11.6, wr);",
    "",
    "  // ---- lightning strikes: smolder between, flash on surge, and",
    "  // light the cloud around the bolt; voice adds surge ----",
    "  float eb = 0.4 + 1.3 * u_energy;",
    "  float gG = strikeGate(t, 1.3)  * eb + u_audio * 1.2;",
    "  float gP = strikeGate(t, 4.2)  * eb + u_audio * 1.2;",
    "  float gB = strikeGate(t, 7.9)  * eb + u_audio * 1.2;",
    "  float gV = strikeGate(t, 11.6) * eb + u_audio * 1.2;",
    "  inner += (u_dyeG * u_weights.x * (fG.x * (0.30 + 0.9 * gG) + fG.y * gG * 0.30)",
    "          + u_dyeP * u_weights.y * (fP.x * (0.30 + 0.9 * gP) + fP.y * gP * 0.30)",
    "          + u_dyeB * u_weights.z * (fB.x * (0.30 + 0.9 * gB) + fB.y * gB * 0.30)",
    "          + u_dyeV * u_weightV  * (fV.x * (0.30 + 0.9 * gV) + fV.y * gV * 0.30)) * breath;",
    "",
    "  // ---- crossings between two colors flash hot ----",
    "  float inter = fG.x * fP.x + fG.x * fB.x + fG.x * fV.x",
    "              + fP.x * fB.x + fP.x * fV.x + fB.x * fV.x;",
    "  inner += vec3(1.0, 0.95, 1.0) * inter * (0.45 + 0.35 * (gG + gP + gB + gV));",
    "",
    "  float wsum = u_weights.x + u_weights.y + u_weights.z + u_weightV + 1e-4;",
    "  vec3 dyeMix = (u_dyeG * u_weights.x + u_dyeP * u_weights.y",
    "               + u_dyeB * u_weights.z + u_dyeV * u_weightV) / wsum;",
    "",
    "  // ---- core: waxes, bursts, and fades with activity ----",
    "  float slow = 0.5 + 0.5 * sin(u_corePhase * 0.31);",
    "  float burst = pow(noise(vec2(t * 0.28, 7.3)), 3.0);",
    "  float fl = (0.10 + 0.30 * slow + 1.6 * burst)",
    "           * (0.35 + 1.1 * u_energy) + u_audio * 0.8;",
    "  float strobe = 0.7 + 0.3 * noise(vec2(t * 2.2, 3.7));",
    "  float core = exp(-r * r * (95.0 - 55.0 * clamp(fl, 0.0, 1.0))) * fl * strobe;",
    "  inner += mix(vec3(1.0), u_dyeB, 0.25) * core;",
    "",
    "  // ---- rim + halo (state accent lives here) ----",
    "  float ring = exp(-abs(r - orbR) * 46.0);",
    "  vec3 rimCol = mix(dyeMix, u_accent, u_accentAmt) * ring",
    "              * (0.35 + 0.45 * u_intensity + 0.25 * clamp(fl, 0.0, 1.0) + 1.0 * u_audio);",
    "  float halo = exp(-max(r - orbR, 0.0) * 6.5) * (0.025 + 0.05 * u_intensity);",
    "  vec3 haloCol = mix(dyeMix, u_accent, u_accentAmt * 0.6) * halo;",
    "",
    "  // ---- faint elliptical orbit arcs ----",
    "  float outside = smoothstep(orbR * 0.55, orbR * 0.95, r);",
    "  vec2 av = vec2(cos(ang - t * 0.04), sin(ang - t * 0.04)) * 1.8;",
    "  float arc1 = orbitRing(uv, 0.88, 0.48, 0.36, 0.80)",
    "             * (0.2 + 0.8 * noise(av + vec2(3.0, 3.0)));",
    "  float arc2 = orbitRing(uv, -0.42, 0.91, 0.46, 0.94)",
    "             * (0.2 + 0.8 * noise(av + vec2(11.0, 11.0)));",
    "  float arc3 = orbitRing(uv, -0.95, -0.31, 0.30, 0.72)",
    "             * (0.2 + 0.8 * noise(av + vec2(23.0, 23.0)));",
    "  vec3 ringsCol = mix(u_dyeV, dyeMix, 0.35)",
    "                * (arc1 + arc2 + arc3) * 0.16 * outside;",
    "",
    "  // ---- inward-flowing particles outside the orb ----",
    "  vec3 partCol = vec3(0.0);",
    "  if (u_particleAmt > 0.01 && r > orbR * 0.9) {",
    "    float lanes = 34.0;",
    "    float lane = floor((ang / 6.2831853 + 0.5) * lanes);",
    "    float lh = hash(vec2(lane, 3.7));",
    "    float laneSpeed = 0.25 + 0.55 * lh;",
    "    float cell = fract((r + u_particlePhase * laneSpeed * 0.22 + lh * 7.0) * 3.2);",
    "    float dot_ = smoothstep(0.14, 0.0, abs(cell - 0.5) * 2.0 - 0.02);",
    "    float laneJitter = noise(vec2(lane * 1.7, t * 0.2));",
    "    float laneCenter = fract((ang / 6.2831853 + 0.5) * lanes) - 0.5;",
    "    float across = smoothstep(0.26, 0.0, abs(laneCenter + (laneJitter - 0.5) * 0.3));",
    "    float fade = smoothstep(1.6, orbR, r) * smoothstep(orbR * 0.9, orbR * 1.05, r);",
    "    float streak = dot_ * across * fade * step(0.35, lh);",
    "    vec3 pc = mix(dyeMix, u_accent, u_accentAmt * 0.5);",
    "    partCol = pc * streak * 0.9 * u_particleAmt;",
    "  }",
    "",
    "  vec3 col = inner * body + rimCol + haloCol + ringsCol + partCol;",
    "  col *= u_dim;",
    "",
    "  // tone map, then push saturation: intense color, restrained light",
    "  col = col / (1.0 + col * 0.9);",
    "  float luma = dot(col, vec3(0.299, 0.587, 0.114));",
    "  col = clamp(mix(vec3(luma), col, 1.42), 0.0, 1.0);",
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
      "u_energy", "u_turbulence", "u_drift", "u_phase", "u_corePhase",
      "u_particlePhase", "u_accent",
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
    // Integrated phase accumulators. State/mode changes smooth the
    // *rate* (flowSpeed, pulseSpeed) via the existing current->target
    // lerp below; these accumulate that rate over dt each frame instead
    // of multiplying it against the absolute elapsed time in the shader.
    // Multiplying a speed uniform by absolute time is what caused the
    // orb to visibly jerk/snap whenever a state change nudged the speed:
    // at large t, even a tiny speed delta is a huge phase jump. Elapsed
    // real time never appears in the drift/pulse/particle math anymore.
    this._drift = 0;
    this._phase = 0;
    this._corePhase = 0;
    this._particlePhase = 0;
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

    // Integrate phase from the smoothed (never-jumping) current speeds.
    // Scaled by timeScale like _t itself, so Reduced Motion slows this
    // in step with everything else instead of leaving it at full rate.
    var dtScaled = dt * this.timeScale;
    this._drift += dtScaled * c.flowSpeed;
    this._phase += dtScaled * c.pulseSpeed;
    this._corePhase += dtScaled * Math.max(c.pulseSpeed, 0.2);
    this._particlePhase += dtScaled * (0.6 + 0.7 * c.flowSpeed);

    this.resize();
    var gl = this.gl, u = this.u;
    gl.uniform2f(u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.u_time, this._t);
    gl.uniform3f(u.u_weights, c.weights[0], c.weights[1], c.weights[2]);
    gl.uniform1f(u.u_weightV, c.weightV);
    gl.uniform1f(u.u_intensity, c.intensity);
    gl.uniform1f(u.u_energy, c.energy);
    gl.uniform1f(u.u_turbulence, c.turbulence);
    gl.uniform1f(u.u_drift, this._drift);
    gl.uniform1f(u.u_phase, this._phase);
    gl.uniform1f(u.u_corePhase, this._corePhase);
    gl.uniform1f(u.u_particlePhase, this._particlePhase);
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
