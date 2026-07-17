/*
 * VELMA dashboard state store.
 *
 * The dashboard is a UI only: it renders snapshots pushed to it and never
 * invents telemetry. Hardware values stay null (rendered as "--" / NO DATA)
 * until a real snapshot arrives via VELMA.state.ingestSnapshot().
 * The built-in demo feed is clearly labeled SIMULATED and exists only to
 * preview animation behavior.
 */
(function () {
  "use strict";

  var STATES = [
    "idle", "listening", "thinking", "model_active", "tool_active",
    "awaiting_approval", "warning", "failure", "offline", "verifying",
  ];

  var MODES = ["game", "work", "teaching"];

  var TRUST_LEVELS = ["verified", "uncertain", "conflicting", "failed", "unknown"];

  var DEFAULT_CAPABILITIES = [
    { id: "core",      label: "CORE",  color: "#39ff8e", status: "available" },
    { id: "model_30b", label: "30B",   color: "#2f9bff", status: "available" },
    { id: "voice",     label: "VOICE", color: "#ff3df0", status: "available" },
    { id: "tools",     label: "TOOLS", color: "#35e0ff", status: "available" },
    { id: "agents",    label: "AGNT",  color: "#ffb02e", status: "available" },
    { id: "builder",   label: "BLDR",  color: "#b06bff", status: "available" },
    { id: "memory",    label: "MEM",   color: "#39ff8e", status: "available" },
    { id: "vision",    label: "VIS",   color: "#2f9bff", status: "available" },
  ];

  function initialSnapshot() {
    return {
      timestamp: null,
      source: "none", // "none" | "live" | "demo"
      state: "offline",
      mode: "work",
      trust: { level: "unknown", reason: "No verification data received yet." },
      weights: { green: 0.34, pink: 0.33, blue: 0.33, purple: 0.3 },
      activity: {
        intensity: 0.0,
        flow_speed: 1.0,
        turbulence: 0.4,
        energy: 0.2,
        audio_level: 0.0, // voice/TTS envelope pushed by Core (0..1)
      },
      // Telemetry rule: all null until real data arrives. Never fabricated.
      telemetry: {
        cpu: null, ram: null, gpu: null, vram: null,
        temp: null, workload: null,
      },
      capabilities: DEFAULT_CAPABILITIES.map(function (c) {
        return { id: c.id, label: c.label, color: c.color, status: c.status };
      }),
      approvals: [],
      project: null,
      modeBlend: {},
    };
  }

  function clamp01(v) {
    v = Number(v);
    if (!isFinite(v)) { return 0; }
    return Math.min(1, Math.max(0, v));
  }

  var store = {
    snapshot: initialSnapshot(),
    listeners: [],

    onChange: function (fn) { this.listeners.push(fn); },

    emit: function () {
      var snap = this.snapshot;
      this.listeners.forEach(function (fn) { fn(snap); });
    },

    /* Accept a strict snapshot from VELMA Core (or the demo feed).
       Unknown fields are ignored; invalid enums are rejected so the UI
       never displays a state it does not understand. */
    ingestSnapshot: function (raw, source) {
      if (!raw || typeof raw !== "object") { return; }
      var s = this.snapshot;

      if (typeof raw.state === "string" && STATES.indexOf(raw.state) !== -1) {
        s.state = raw.state;
      }
      if (typeof raw.mode === "string" && MODES.indexOf(raw.mode) !== -1) {
        s.mode = raw.mode;
      }
      if (raw.trust && typeof raw.trust === "object") {
        if (TRUST_LEVELS.indexOf(raw.trust.level) !== -1) {
          s.trust.level = raw.trust.level;
        }
        if (typeof raw.trust.reason === "string") {
          s.trust.reason = raw.trust.reason;
        }
      }
      if (raw.weights && typeof raw.weights === "object") {
        // Base-color rule: weights modulate, never remove, an identity color.
        s.weights.green = 0.15 + 0.85 * clamp01(raw.weights.green);
        s.weights.pink  = 0.15 + 0.85 * clamp01(raw.weights.pink);
        s.weights.blue  = 0.15 + 0.85 * clamp01(raw.weights.blue);
        if (raw.weights.purple != null) {
          s.weights.purple = 0.15 + 0.85 * clamp01(raw.weights.purple);
        }
      }
      if (raw.activity && typeof raw.activity === "object") {
        var a = raw.activity;
        if (a.intensity  != null) { s.activity.intensity  = clamp01(a.intensity); }
        if (a.energy     != null) { s.activity.energy     = clamp01(a.energy); }
        if (a.turbulence != null) { s.activity.turbulence = clamp01(a.turbulence); }
        if (a.audio_level != null) { s.activity.audio_level = clamp01(a.audio_level); }
        if (a.flow_speed != null) {
          var f = Number(a.flow_speed);
          if (isFinite(f)) { s.activity.flow_speed = Math.min(4, Math.max(0, f)); }
        }
      }
      if (raw.telemetry && typeof raw.telemetry === "object") {
        Object.keys(s.telemetry).forEach(function (k) {
          var v = raw.telemetry[k];
          if (v == null) { return; }
          v = Number(v);
          if (isFinite(v)) { s.telemetry[k] = v; }
        });
      }
      if (Array.isArray(raw.capabilities)) {
        raw.capabilities.forEach(function (rc) {
          if (!rc || typeof rc.id !== "string") { return; }
          var cap = null;
          for (var i = 0; i < s.capabilities.length; i++) {
            if (s.capabilities[i].id === rc.id) { cap = s.capabilities[i]; break; }
          }
          if (cap && typeof rc.status === "string") { cap.status = rc.status; }
        });
      }
      if (Array.isArray(raw.approvals)) {
        s.approvals = raw.approvals.filter(function (a) {
          return a && typeof a.title === "string";
        }).map(function (a) {
          return {
            title: a.title,
            risk: typeof a.risk === "string" ? a.risk : "unknown",
            changes: typeof a.changes === "string" ? a.changes : "",
            scope: typeof a.scope === "string" ? a.scope : "single-use",
          };
        });
      }
      if (raw.project && typeof raw.project === "object") {
        s.project = {
          name: String(raw.project.name || ""),
          stage: String(raw.project.stage || ""),
          operation: String(raw.project.operation || ""),
          progress: raw.project.progress != null ? clamp01(raw.project.progress) : null,
          blockers: String(raw.project.blockers || ""),
        };
      }
      if (raw.modeBlend && typeof raw.modeBlend === "object") {
        s.modeBlend = {};
        Object.keys(raw.modeBlend).forEach(function (k) {
          s.modeBlend[k] = clamp01(raw.modeBlend[k]);
        });
      }

      s.timestamp = Date.now();
      s.source = source === "demo" ? "demo" : "live";
      this.emit();
    },

    setState: function (state) {
      if (STATES.indexOf(state) === -1) { return; }
      this.snapshot.state = state;
      this.emit();
    },

    setMode: function (mode) {
      if (MODES.indexOf(mode) === -1) { return; }
      this.snapshot.mode = mode;
      this.emit();
    },
  };

  /* ---- Demo feed (SIMULATED, opt-in, clearly labeled) ---- */

  var demo = {
    timer: null,
    t: 0,
    running: false,

    start: function () {
      if (this.running) { return; }
      this.running = true;
      var self = this;
      this.timer = setInterval(function () { self.tick(); }, 900);
      this.tick();
    },

    stop: function () {
      this.running = false;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      var fresh = initialSnapshot();
      fresh.state = store.snapshot.state;
      fresh.mode = store.snapshot.mode;
      store.snapshot = fresh;
      store.emit();
    },

    tick: function () {
      this.t += 0.9;
      var t = this.t;
      var wave = function (period, phase) {
        return 0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2 + phase);
      };
      store.ingestSnapshot({
        weights: {
          green: 0.35 + 0.3 * wave(37, 0),
          pink: 0.4 + 0.35 * wave(23, 2),
          blue: 0.45 + 0.4 * wave(31, 4),
          purple: 0.3 + 0.3 * wave(43, 1),
        },
        activity: {
          intensity: 0.45 + 0.35 * wave(17, 1),
          energy: 0.5 + 0.35 * wave(13, 3),
          turbulence: 0.35 + 0.3 * wave(29, 5),
          flow_speed: 0.8 + 0.9 * wave(19, 0.5),
        },
        telemetry: {
          cpu: 35 + 30 * wave(11, 0),
          ram: 48 + 12 * wave(41, 1),
          gpu: 40 + 35 * wave(7, 2),
          vram: 52 + 10 * wave(53, 3),
          temp: 47 + 14 * wave(61, 4),
          workload: 30 + 45 * wave(9, 5),
        },
        capabilities: [
          { id: "core", status: "active" },
          { id: "model_30b", status: wave(15, 0) > 0.5 ? "active" : "available" },
          { id: "tools", status: wave(21, 2) > 0.6 ? "active" : "available" },
          { id: "voice", status: "available" },
          { id: "agents", status: wave(27, 1) > 0.7 ? "awaiting" : "available" },
          { id: "builder", status: "disabled" },
        ],
        trust: {
          level: "verified",
          reason: "SIMULATED demo feed: values generated locally for preview, not real telemetry.",
        },
        approvals: wave(43, 0) > 0.55 ? [{
          title: "Write config to ~/.velma/settings.json",
          risk: "low",
          changes: "1 file modified",
          scope: "single-use",
        }] : [],
        project: {
          name: "VELMA Dashboard Prototype",
          stage: "Phase 13 — snapshot rendering",
          operation: "demo feed active",
          progress: wave(97, 0),
          blockers: "",
        },
        modeBlend: { coding: 0.6, reasoning: 0.7, cad_design: 0.3 },
      }, "demo");
    },
  };

  window.VELMA = window.VELMA || {};
  window.VELMA.STATES = STATES;
  window.VELMA.MODES = MODES;
  window.VELMA.TRUST_LEVELS = TRUST_LEVELS;
  window.VELMA.state = store;
  window.VELMA.demo = demo;
})();
