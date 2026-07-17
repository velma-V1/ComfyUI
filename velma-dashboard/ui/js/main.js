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
    var msg = document.createElement("div");
    msg.textContent = "WebGL unavailable: " + err.message;
    msg.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ff4d5e;z-index:1;";
    document.body.appendChild(msg);
  }

  V.palette.restore();

  var topStats = P.buildTopStats(document.getElementById("top-stats"));
  P.buildVisualConfig(document.getElementById("visual-config-list"));
  P.buildBlendLegend(document.getElementById("blend-legend"));
  var modeListNodes = P.buildModeList(document.getElementById("mode-list"));

  var pal0 = V.paletteColors;
  var weightBars = P.buildBarRows(document.getElementById("weight-rows"), [
    { key: "green", label: "BASE", color: pal0.dye.green },
    { key: "pink", label: "CREATIVE", color: pal0.dye.pink },
    { key: "blue", label: "LOGIC", color: pal0.dye.blue },
    { key: "purple", label: "DEPTH", color: pal0.dye.purple },
  ]);

  var driverBars = P.buildBarRows(document.getElementById("driver-rows"), [
    { key: "cpu", label: "CPU LOAD", color: pal0.dye.green },
    { key: "gpu", label: "GPU LOAD", color: pal0.cyan },
    { key: "workload", label: "WORKLOAD", color: "#b06bff" },
    { key: "intensity", label: "COMBINED", color: pal0.dye.pink },
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
    if (V.neuralLayer) { V.neuralLayer.reducedMotion = reducedMotion; }
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

  /* ---------- voice sync (opt-in local microphone analyser) ---------- */

  var btnVoice = document.getElementById("btn-voice");
  btnVoice.addEventListener("click", function () {
    if (V.audio.running) {
      V.audio.stop();
      btnVoice.classList.remove("active");
      btnVoice.textContent = "Voice Sync";
      return;
    }
    btnVoice.textContent = "Voice: asking";
    V.audio.start().then(function () {
      btnVoice.classList.add("active");
      btnVoice.textContent = "Voice Synced";
    }).catch(function () {
      btnVoice.textContent = "Voice: denied";
    });
  });

  /* ---------- core link (Tauri events or loopback WebSocket) ---------- */

  var btnCore = document.getElementById("btn-core");
  var params = new URLSearchParams(window.location.search);
  var coreParam = params.get("core");
  var coreUrl = "ws://127.0.0.1:8765/state";
  if (coreParam) {
    coreUrl = /^\d+$/.test(coreParam)
      ? "ws://127.0.0.1:" + coreParam + "/state"
      : coreParam;
  }

  V.bridge.onStatus(function (connected, wanted) {
    btnCore.classList.toggle("active", connected);
    btnCore.textContent = connected ? "Core Linked"
      : wanted ? "Core: retrying" : "Core Link";
  });

  btnCore.addEventListener("click", function () {
    if (V.bridge.wanted) {
      V.bridge.disconnect();
      btnCore.classList.remove("active");
      btnCore.textContent = "Core Link";
      return;
    }
    try {
      V.bridge.connect(coreUrl);
      btnCore.textContent = "Core: retrying";
    } catch (err) {
      btnCore.textContent = "Core: refused";
    }
  });

  var usingTauri = V.bridge.initTauri();
  if (!usingTauri && coreParam) { btnCore.click(); }

  /* Desktop-shell-only controls (Tauri exposes window.__TAURI__) */
  if (usingTauri && window.__TAURI__.core &&
      typeof window.__TAURI__.core.invoke === "function") {
    var pinned = false;
    var btnPin = document.createElement("button");
    btnPin.textContent = "Always On Top";
    btnPin.addEventListener("click", function () {
      pinned = !pinned;
      window.__TAURI__.core.invoke("set_always_on_top", { on: pinned })
        .then(function () { btnPin.classList.toggle("active", pinned); })
        .catch(function () { pinned = !pinned; });
    });
    btnCore.parentNode.appendChild(btnPin);
  }

  /* ---------- color vision palettes ---------- */

  var paletteControls = document.getElementById("palette-controls");
  Object.keys(V.palette.PALETTES).forEach(function (name) {
    var b = document.createElement("button");
    b.textContent = V.palette.PALETTES[name].label;
    b.dataset.palette = name;
    b.addEventListener("click", function () { V.palette.apply(name); });
    paletteControls.appendChild(b);
  });

  function syncPalette(pal, name) {
    if (orb) {
      orb.setDyePalette([
        V.palette.hexToRgb01(pal.dye.green),
        V.palette.hexToRgb01(pal.dye.pink),
        V.palette.hexToRgb01(pal.dye.blue),
        V.palette.hexToRgb01(pal.dye.purple),
      ]);
    }
    [[weightBars.green, pal.dye.green], [weightBars.pink, pal.dye.pink],
      [weightBars.blue, pal.dye.blue], [weightBars.purple, pal.dye.purple],
      [driverBars.cpu, pal.dye.green],
      [driverBars.gpu, pal.cyan], [driverBars.intensity, pal.dye.pink]]
      .forEach(function (pair) {
        pair[0].fill.style.background = pair[1];
        pair[0].fill.style.boxShadow = "0 0 6px " + pair[1];
      });
    P.buildBlendLegend(document.getElementById("blend-legend"));
    paletteControls.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.palette === name);
    });
    render(V.state.snapshot);
  }
  V.palette.onChange(syncPalette);

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
    P.setBar(weightBars.purple, snap.weights.purple);

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
  syncPalette(V.paletteColors, V.palette.currentName());
  V.windows.init();

  /* ---------- panel chooser: pick what the dashboard shows ---------- */

  var btnPanelMenu = document.getElementById("btn-panel-menu");
  var panelMenu = document.getElementById("panel-menu");

  function buildPanelMenu() {
    while (panelMenu.firstChild) { panelMenu.removeChild(panelMenu.firstChild); }
    var title = document.createElement("div");
    title.className = "pm-title";
    title.textContent = "Visible Panels";
    panelMenu.appendChild(title);
    V.windows.listPanels().forEach(function (p) {
      var label = document.createElement("label");
      var box = document.createElement("input");
      box.type = "checkbox";
      box.checked = !p.hidden;
      box.addEventListener("change", function () {
        V.windows.setHidden(p.id, !box.checked);
      });
      label.appendChild(box);
      label.appendChild(document.createTextNode(p.title));
      panelMenu.appendChild(label);
    });
  }

  btnPanelMenu.addEventListener("click", function (ev) {
    ev.stopPropagation();
    if (panelMenu.hidden) {
      buildPanelMenu();
      panelMenu.hidden = false;
      btnPanelMenu.classList.add("active");
    } else {
      panelMenu.hidden = true;
      btnPanelMenu.classList.remove("active");
    }
  });
  document.addEventListener("click", function (ev) {
    if (!panelMenu.hidden && !panelMenu.contains(ev.target)) {
      panelMenu.hidden = true;
      btnPanelMenu.classList.remove("active");
    }
  });

  /* ---------- animation loop ---------- */

  var bootTime = performance.now();
  var fpsNode = document.getElementById("fps-value");
  var lastGaugeDraw = performance.now();
  var lastHud = 0;

  /* Capability orbs orbit the main orb like a small solar system: each
     one rides its own tilted elliptical plane at its own rate, and gets
     depth — it grows, brightens, and sharpens swinging in front, then
     shrinks, dims, and blurs passing behind. Reduced motion freezes the
     orbits at their base positions. */
  var capCount = V.state.snapshot.capabilities.length;
  function orbitCapabilities(now) {
    var w = window.innerWidth, h = window.innerHeight;
    var cx = w / 2, cy = h / 2;
    var base = Math.min(w, h);
    var t = reducedMotion ? 0 : now / 1000;
    Object.keys(capNodes).forEach(function (id) {
      var c = capNodes[id];
      var i = c.index;
      var Rx = base * (0.30 + 0.05 * (i % 3));
      var Ry = Rx * (0.28 + 0.07 * (i % 2));
      var tilt = i * 0.85;
      var speed = 0.12 + 0.035 * (i % 4);
      var a = (i / capCount) * Math.PI * 2 + t * speed;
      var lx = Math.cos(a) * Rx, ly = Math.sin(a) * Ry;
      var x = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
      var y = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
      var depth = Math.sin(a);           // -1 behind .. +1 in front
      var df = 0.5 + 0.5 * depth;
      var scale = 0.65 + 0.5 * df;
      var vis = c.vis == null ? 0.55 : c.vis;
      c.node.style.left = x + "px";
      c.node.style.top = y + "px";
      c.node.style.transform =
        "translate(-50%, -50%) scale(" + scale.toFixed(3) + ")";
      c.node.style.opacity = (vis * (0.45 + 0.55 * df)).toFixed(3);
      c.node.style.zIndex = depth > 0 ? "6" : "3";
      c.node.style.filter = depth > 0 ? "" : "blur(0.7px) saturate(0.75)";
      // published for the neural link layer
      c.x = x; c.y = y; c.scale = scale; c.depthFactor = df;
    });
  }

  var neural = new V.Neural(document.getElementById("neural-canvas"));
  V.neuralLayer = neural;
  neural.reducedMotion = reducedMotion;
  function neuralCaps() {
    return Object.keys(capNodes).map(function (id) {
      var c = capNodes[id];
      return {
        id: id, index: c.index, color: c.color,
        status: c.status || "available",
        x: c.x, y: c.y, scale: c.scale, depthFactor: c.depthFactor,
      };
    });
  }

  function loop(now) {
    if (orb) {
      // audio channel: whichever is louder, Core's envelope or the mic
      orb.audioLevel = Math.max(
        V.state.snapshot.activity.audio_level, V.audio.level);
      orb.frame(now);
    }
    orbitCapabilities(now);

    var dt = Math.min((now - lastGaugeDraw) / 1000, 0.1);
    lastGaugeDraw = now;
    neural.draw(neuralCaps(), now, dt);
    Object.keys(gauges).forEach(function (k) { gauges[k].draw(dt); });

    if (now - lastHud > 500) {
      lastHud = now;
      fpsNode.textContent = orb ? String(orb.fps) : "--";
      P.updateTopStats(topStats, V.state.snapshot, orb ? orb.fps : 0,
        (now - bootTime) / 1000);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
