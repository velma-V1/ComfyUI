/*
 * Wiring: orb + gauges + panels + controls.
 * State accents modulate the orb (rim, pulse, particles, brightness) but the
 * green/blue/pink tie-dye identity is preserved in every state.
 */
(function () {
  "use strict";

  var V = window.VELMA;
  var P = V.panels;

  /* Per-state orb styling. accentAmt only tints rim/particles — never the body. */
  var STATE_STYLES = {
    idle:              { label: "IDLE",              accent: [0.22, 1.00, 0.55], accentAmt: 0.0, pulseSpeed: 0.7,  particleAmt: 0.35, intensityScale: 0.6, energyScale: 0.7, flowScale: 0.7, dim: 1.0 },
    listening:         { label: "LISTENING",         accent: [0.21, 0.88, 1.00], accentAmt: 0.5, pulseSpeed: 1.6,  particleAmt: 0.7,  intensityScale: 0.9, energyScale: 0.9, flowScale: 1.0, dim: 1.0 },
    thinking:          { label: "THINKING",          accent: [0.18, 0.61, 1.00], accentAmt: 0.55, pulseSpeed: 2.4, particleAmt: 0.8,  intensityScale: 1.1, energyScale: 1.0, flowScale: 1.4, dim: 1.0 },
    model_active:      { label: "MODEL ACTIVE",      accent: [1.00, 0.24, 0.94], accentAmt: 0.5, pulseSpeed: 2.0,  particleAmt: 1.0,  intensityScale: 1.2, energyScale: 1.2, flowScale: 1.3, dim: 1.0 },
    tool_active:       { label: "TOOL ACTIVE",       accent: [0.21, 0.88, 1.00], accentAmt: 0.6, pulseSpeed: 2.8,  particleAmt: 1.0,  intensityScale: 1.2, energyScale: 1.1, flowScale: 1.5, dim: 1.0 },
    awaiting_approval: { label: "AWAITING APPROVAL", accent: [1.00, 0.69, 0.18], accentAmt: 0.8, pulseSpeed: 1.1,  particleAmt: 0.3,  intensityScale: 0.8, energyScale: 0.8, flowScale: 0.6, dim: 1.0 },
    warning:           { label: "WARNING",           accent: [1.00, 0.69, 0.18], accentAmt: 0.9, pulseSpeed: 3.4,  particleAmt: 0.5,  intensityScale: 1.1, energyScale: 0.9, flowScale: 1.0, dim: 1.0 },
    failure:           { label: "FAILURE",           accent: [1.00, 0.30, 0.37], accentAmt: 1.0, pulseSpeed: 4.2,  particleAmt: 0.2,  intensityScale: 1.0, energyScale: 0.6, flowScale: 0.8, dim: 0.75 },
    offline:           { label: "OFFLINE",           accent: [0.48, 0.53, 0.58], accentAmt: 0.7, pulseSpeed: 0.35, particleAmt: 0.0,  intensityScale: 0.2, energyScale: 0.25, flowScale: 0.25, dim: 0.4 },
    verifying:         { label: "VERIFYING",         accent: [0.22, 1.00, 0.55], accentAmt: 0.7, pulseSpeed: 2.2,  particleAmt: 0.6,  intensityScale: 1.0, energyScale: 1.0, flowScale: 1.1, dim: 1.0 },
  };
  V.STATE_STYLES = STATE_STYLES;

  /* Performance rule: Game Mode scales the orb down hard. */
  var MODE_PROFILES = {
    game:     { label: "GAME MODE",     note: "orb throttled · target 30", resScale: 0.5,  fpsCap: 30, octaves: 3 },
    work:     { label: "WORK MODE",     note: "full capabilities · target 60", resScale: 1.0, fpsCap: 60, octaves: 5 },
    teaching: { label: "TEACHING MODE", note: "explanations on · target 60", resScale: 1.0, fpsCap: 60, octaves: 5 },
  };

  /* ---------- boot ---------- */

  var canvas = document.getElementById("orb-canvas");
  var orb = null;
  try {
    orb = new V.Orb(canvas);
  } catch (err) {
    var stage = document.getElementById("orb-stage");
    var msg = document.createElement("div");
    msg.textContent = "WebGL unavailable: " + err.message;
    msg.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#ff4d5e;";
    stage.appendChild(msg);
  }

  var topStats = P.buildTopStats(document.getElementById("top-stats"));
  P.buildVisualConfig(document.getElementById("visual-config-list"));
  P.buildBlendLegend(document.getElementById("blend-legend"));
  var modeListNodes = P.buildModeList(document.getElementById("mode-list"));

  var weightBars = P.buildBarRows(document.getElementById("weight-rows"), [
    { key: "green", label: "GREEN (BASE)", color: "#39ff8e" },
    { key: "pink", label: "PINK (CREATIVE)", color: "#ff3df0" },
    { key: "blue", label: "BLUE (LOGIC)", color: "#2f9bff" },
  ]);

  var driverBars = P.buildBarRows(document.getElementById("driver-rows"), [
    { key: "cpu", label: "CPU LOAD", color: "#39ff8e" },
    { key: "gpu", label: "GPU LOAD", color: "#35e0ff" },
    { key: "workload", label: "WORKLOAD", color: "#b06bff" },
    { key: "intensity", label: "COMBINED", color: "#ff3df0" },
  ]);

  var ring = document.getElementById("capability-ring");
  var capNodes = P.buildCapabilityRing(ring, V.state.snapshot.capabilities);

  var gaugeRow = document.getElementById("gauge-row");
  var gauges = {
    cpu: new V.Gauge({ name: "CPU", unit: "%" }),
    ram: new V.Gauge({ name: "RAM", unit: "%" }),
    gpu: new V.Gauge({ name: "GPU", unit: "%" }),
    vram: new V.Gauge({ name: "VRAM", unit: "%" }),
    temp: new V.Gauge({ name: "TEMP", unit: "°", max: 110, redline: 0.77 }),
    workload: new V.Gauge({ name: "ACTIVITY", unit: "%" }),
  };
  Object.keys(gauges).forEach(function (k) { gaugeRow.appendChild(gauges[k].cell); });

  /* state buttons */
  var stateButtons = document.getElementById("state-buttons");
  V.STATES.forEach(function (s) {
    var b = document.createElement("button");
    b.textContent = STATE_STYLES[s].label;
    b.dataset.state = s;
    b.addEventListener("click", function () { V.state.setState(s); });
    stateButtons.appendChild(b);
  });

  /* mode buttons */
  var modeButtons = document.querySelectorAll("[data-set-mode]");
  modeButtons.forEach(function (b) {
    b.addEventListener("click", function () { V.state.setMode(b.dataset.setMode); });
  });

  /* quick controls */
  var btnPause = document.getElementById("btn-pause");
  var btnReduced = document.getElementById("btn-reduced");
  var btnDemo = document.getElementById("btn-demo");

  btnPause.addEventListener("click", function () {
    if (!orb) { return; }
    orb.paused = !orb.paused;
    btnPause.classList.toggle("active", orb.paused);
    btnPause.textContent = orb.paused ? "Resume Orb" : "Pause Orb";
  });

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function applyReducedMotion() {
    if (orb) { orb.setReducedMotion(reducedMotion); }
    btnReduced.classList.toggle("active", reducedMotion);
  }
  btnReduced.addEventListener("click", function () {
    reducedMotion = !reducedMotion;
    applyReducedMotion();
  });
  applyReducedMotion();

  btnDemo.addEventListener("click", function () {
    if (V.demo.running) {
      V.demo.stop();
      btnDemo.classList.remove("active");
    } else {
      V.demo.start();
      btnDemo.classList.add("active");
      if (V.state.snapshot.state === "offline") { V.state.setState("idle"); }
    }
  });

  /* ---------- render on snapshot change ---------- */

  var stateLabel = document.getElementById("state-label");
  var trustChip = document.getElementById("trust-chip");
  var trustDetail = document.getElementById("trust-detail");
  var sysmodeValue = document.getElementById("sysmode-value");
  var perfNote = document.getElementById("perf-note");
  var srcTag = document.getElementById("telemetry-src");
  var packetNode = document.getElementById("state-packet");

  function render(snap) {
    document.body.dataset.state = snap.state;
    document.body.dataset.mode = snap.mode;

    var style = STATE_STYLES[snap.state];
    stateLabel.textContent = style.label;
    if (orb) {
      orb.applySnapshot(snap, style);
      orb.setPerformanceProfile(MODE_PROFILES[snap.mode]);
    }

    sysmodeValue.textContent = MODE_PROFILES[snap.mode].label;
    perfNote.textContent = MODE_PROFILES[snap.mode].note;
    modeButtons.forEach(function (b) {
      b.classList.toggle("active", b.dataset.setMode === snap.mode);
    });
    stateButtons.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.state === snap.state);
    });

    P.setBar(weightBars.green, snap.weights.green);
    P.setBar(weightBars.pink, snap.weights.pink);
    P.setBar(weightBars.blue, snap.weights.blue);

    var tel = snap.telemetry;
    P.setBar(driverBars.cpu, tel.cpu == null ? null : tel.cpu / 100,
      tel.cpu == null ? null : Math.round(tel.cpu) + "%");
    P.setBar(driverBars.gpu, tel.gpu == null ? null : tel.gpu / 100,
      tel.gpu == null ? null : Math.round(tel.gpu) + "%");
    P.setBar(driverBars.workload, tel.workload == null ? null : tel.workload / 100,
      tel.workload == null ? null : Math.round(tel.workload) + "%");
    P.setBar(driverBars.intensity, snap.activity.intensity);

    Object.keys(gauges).forEach(function (k) { gauges[k].set(tel[k]); });

    srcTag.textContent = snap.source === "demo" ? "SIMULATED"
      : snap.source === "live" ? "LIVE" : "NO TELEMETRY";
    srcTag.className = "src-tag" + (snap.source === "demo" ? " demo"
      : snap.source === "live" ? " live" : "");

    P.updateTrust(trustChip, trustDetail, snap.trust);
    P.updateCapabilityRing(capNodes, snap.capabilities);
    P.updateCapabilityList(document.getElementById("capability-list"), snap.capabilities);
    P.updateApprovals(document.getElementById("approval-list"), snap.approvals);
    P.updateProject(document.getElementById("project-detail"), snap.project);
    P.updateModeList(modeListNodes, snap.modeBlend);
    P.updatePacket(packetNode, snap);
  }

  V.state.onChange(render);
  render(V.state.snapshot);

  /* ---------- animation loop ---------- */

  var bootTime = performance.now();
  var fpsNode = document.getElementById("fps-value");
  var lastGaugeDraw = performance.now();
  var lastHud = 0;

  function loop(now) {
    if (orb) { orb.frame(now); }

    var dt = Math.min((now - lastGaugeDraw) / 1000, 0.1);
    lastGaugeDraw = now;
    Object.keys(gauges).forEach(function (k) { gauges[k].draw(dt); });

    if (now - lastHud > 500) {
      lastHud = now;
      fpsNode.textContent = orb ? String(orb.fps) : "--";
      P.updateTopStats(topStats, V.state.snapshot, orb ? orb.fps : 0,
        (now - bootTime) / 1000);
      P.layoutCapabilityRing(capNodes, ring, V.state.snapshot.capabilities.length);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener("resize", function () {
    P.layoutCapabilityRing(capNodes, ring, V.state.snapshot.capabilities.length);
  });
})();
