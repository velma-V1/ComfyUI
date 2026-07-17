/*
 * DOM panel builders and updaters.
 * Security rule: no innerHTML anywhere — only createElement / textContent.
 */
(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) { node.className = className; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function clear(node) {
    while (node.firstChild) { node.removeChild(node.firstChild); }
  }

  /* ---------- top bar ---------- */

  var TOP_STATS = [
    { key: "status",  label: "STATUS" },
    { key: "uptime",  label: "UPTIME" },
    { key: "fps",     label: "FPS" },
    { key: "temp",    label: "CORE TEMP" },
    { key: "vram",    label: "GPU MEM" },
  ];

  function buildTopStats(container) {
    var nodes = {};
    TOP_STATS.forEach(function (s) {
      var wrap = el("span", "top-stat");
      wrap.appendChild(el("span", "k", s.label + ":"));
      var v = el("span", "v na", "--");
      wrap.appendChild(v);
      container.appendChild(wrap);
      nodes[s.key] = v;
    });
    return nodes;
  }

  function setStat(node, text, cls) {
    node.textContent = text;
    node.className = "v" + (cls ? " " + cls : "");
  }

  function updateTopStats(nodes, snap, fps, uptimeSec) {
    var stateNames = window.VELMA.STATE_STYLES;
    var offline = snap.state === "offline";
    setStat(nodes.status, offline ? "OFFLINE" : "ONLINE", offline ? "bad" : "");
    var h = Math.floor(uptimeSec / 3600);
    var m = Math.floor((uptimeSec % 3600) / 60);
    var s = Math.floor(uptimeSec % 60);
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    setStat(nodes.uptime, pad(h) + ":" + pad(m) + ":" + pad(s), "");
    setStat(nodes.fps, String(fps), fps < 30 ? "warn" : "");
    if (snap.telemetry.temp == null) {
      setStat(nodes.temp, "--", "na");
    } else {
      var t = Math.round(snap.telemetry.temp);
      setStat(nodes.temp, t + "°C", t >= 85 ? "bad" : t >= 75 ? "warn" : "");
    }
    if (snap.telemetry.vram == null) {
      setStat(nodes.vram, "--", "na");
    } else {
      setStat(nodes.vram, Math.round(snap.telemetry.vram) + "%", "");
    }
    void stateNames;
  }

  /* ---------- static config panel ---------- */

  function buildVisualConfig(listNode) {
    [
      ["A. STYLE PRIORITY", "FLUID INK / LIQUID ENERGY"],
      ["B. CAMERA STYLE", "3D FLOATING SPHERE"],
      ["C. MOTION INTENSITY", "MEDIUM REACTIVE"],
      ["D. GLOW STYLE", "HEAVY ENERGY CORE"],
    ].forEach(function (pair) {
      var li = el("li");
      li.appendChild(el("span", "k", pair[0]));
      li.appendChild(el("span", "v", pair[1]));
      listNode.appendChild(li);
    });
  }

  function buildBlendLegend(listNode) {
    [
      ["#39ff8e", "GREEN = BASE INTELLIGENCE"],
      ["#ff3df0", "PINK = CREATIVE / GENERATION"],
      ["#2f9bff", "BLUE = LOGIC / REASONING"],
    ].forEach(function (pair) {
      var li = el("li");
      var sw = el("span", "swatch");
      sw.style.background = pair[0];
      sw.style.boxShadow = "0 0 6px " + pair[0];
      li.appendChild(sw);
      li.appendChild(el("span", null, pair[1]));
      listNode.appendChild(li);
    });
  }

  /* ---------- workflow mode list ---------- */

  var WORKFLOWS = [
    { id: "idle", label: "IDLE", color: "#39ff8e" },
    { id: "gaming", label: "GAMING", color: "#ff3df0" },
    { id: "coding", label: "CODING", color: "#35e0ff" },
    { id: "cad_design", label: "CAD / DESIGN", color: "#b06bff" },
    { id: "reasoning", label: "REASONING", color: "#2f9bff" },
    { id: "system_check", label: "SYSTEM CHECK", color: "#ffb02e" },
    { id: "self_improve", label: "SELF-IMPROVE", color: "#ffb02e" },
    { id: "voice_chat", label: "VOICE / CHAT ONLY", color: "#39ff8e" },
  ];

  function buildModeList(listNode) {
    var nodes = {};
    WORKFLOWS.forEach(function (w) {
      var li = el("li");
      li.style.color = w.color;
      var dot = el("span", "dot");
      li.appendChild(dot);
      li.appendChild(el("span", null, w.label));
      listNode.appendChild(li);
      nodes[w.id] = li;
    });
    return nodes;
  }

  function updateModeList(nodes, blend) {
    Object.keys(nodes).forEach(function (id) {
      var on = blend[id] != null && blend[id] > 0.05;
      nodes[id].classList.toggle("on", on);
    });
  }

  /* ---------- bar rows (weights / drivers) ---------- */

  function buildBarRows(container, rows) {
    var out = {};
    rows.forEach(function (r) {
      var row = el("div", "bar-row");
      row.appendChild(el("span", "bar-label", r.label));
      var track = el("div", "bar-track");
      var fill = el("div", "bar-fill");
      fill.style.background = r.color;
      fill.style.boxShadow = "0 0 6px " + r.color;
      fill.style.width = "0%";
      track.appendChild(fill);
      row.appendChild(track);
      var val = el("span", "bar-value", "--");
      row.appendChild(val);
      container.appendChild(row);
      out[r.key] = { fill: fill, val: val };
    });
    return out;
  }

  function setBar(node, frac, text) {
    if (frac == null) {
      node.fill.style.width = "0%";
      node.val.textContent = "--";
    } else {
      node.fill.style.width = Math.round(frac * 100) + "%";
      node.val.textContent = text != null ? text : frac.toFixed(2);
    }
  }

  /* ---------- trust ---------- */

  var TRUST_COLORS = {
    verified: "#39ff8e",
    uncertain: "#ffb02e",
    conflicting: "#ffb02e",
    failed: "#ff4d5e",
    unknown: "#7a8794",
  };

  function updateTrust(chipNode, detailNode, trust) {
    chipNode.dataset.trust = trust.level;
    chipNode.textContent = "TRUST: " + trust.level.toUpperCase();
    clear(detailNode);
    var state = el("div", "trust-state", trust.level.toUpperCase());
    state.style.color = TRUST_COLORS[trust.level] || TRUST_COLORS.unknown;
    detailNode.appendChild(state);
    detailNode.appendChild(el("div", "trust-reason", trust.reason));
  }

  /* ---------- capability ring + list ---------- */

  function buildCapabilityRing(ringNode, caps) {
    var nodes = {};
    caps.forEach(function (cap, i) {
      var orb = el("div", "cap-orb", cap.label);
      orb.style.borderColor = cap.color;
      orb.title = cap.id;
      ringNode.appendChild(orb);
      nodes[cap.id] = { node: orb, index: i, color: cap.color };
    });
    return nodes;
  }

  function layoutCapabilityRing(nodes, ringNode, count) {
    var w = ringNode.clientWidth, h = ringNode.clientHeight;
    var R = Math.min(w, h) * 0.44;
    Object.keys(nodes).forEach(function (id) {
      var c = nodes[id];
      var a = (c.index / count) * Math.PI * 2 - Math.PI / 2;
      c.node.style.left = (w / 2 + Math.cos(a) * R) + "px";
      c.node.style.top = (h / 2 + Math.sin(a) * R) + "px";
    });
  }

  function updateCapabilityRing(nodes, caps) {
    caps.forEach(function (cap) {
      var c = nodes[cap.id];
      if (!c) { return; }
      var active = cap.status === "active";
      c.node.classList.toggle("active", active);
      c.node.classList.toggle("blocked", cap.status === "blocked");
      c.node.style.boxShadow = active ? "0 0 16px " + c.color : "none";
      c.node.style.opacity = "";
      if (cap.status === "disabled") { c.node.style.opacity = "0.18"; }
    });
  }

  function updateCapabilityList(listNode, caps) {
    clear(listNode);
    caps.forEach(function (cap) {
      var li = el("li");
      li.appendChild(el("span", null, cap.id));
      var st = el("span", "cap-status", cap.status);
      st.dataset.s = cap.status;
      li.appendChild(st);
      listNode.appendChild(li);
    });
  }

  /* ---------- approvals ---------- */

  function updateApprovals(container, approvals) {
    clear(container);
    if (!approvals.length) {
      container.appendChild(el("div", "approval-empty", "No actions awaiting approval."));
      return;
    }
    approvals.forEach(function (a) {
      var item = el("div", "approval-item");
      item.appendChild(el("div", "a-title", a.title));
      item.appendChild(el("div", "a-meta",
        "risk: " + a.risk + " · " + a.changes + " · " + a.scope));
      container.appendChild(item);
    });
  }

  /* ---------- project ---------- */

  function updateProject(container, project) {
    clear(container);
    if (!project) {
      container.appendChild(el("div", "p-dim", "No active project."));
      return;
    }
    container.appendChild(el("div", "p-name", project.name));
    container.appendChild(el("div", "p-dim", "stage: " + project.stage));
    if (project.operation) {
      container.appendChild(el("div", "p-dim", "op: " + project.operation));
    }
    if (project.progress != null) {
      container.appendChild(el("div", null,
        "progress: " + Math.round(project.progress * 100) + "%"));
    }
    if (project.blockers) {
      var b = el("div", null, "blockers: " + project.blockers);
      b.style.color = "#ff4d5e";
      container.appendChild(b);
    }
  }

  /* ---------- packet ---------- */

  function updatePacket(node, snap) {
    var packet = {
      timestamp: snap.timestamp,
      source: snap.source,
      state: snap.state,
      mode: snap.mode,
      trust: snap.trust.level,
      weights: {
        green: +snap.weights.green.toFixed(2),
        pink: +snap.weights.pink.toFixed(2),
        blue: +snap.weights.blue.toFixed(2),
      },
      intensity: +snap.activity.intensity.toFixed(2),
      flow_speed: +snap.activity.flow_speed.toFixed(2),
      turbulence: +snap.activity.turbulence.toFixed(2),
      energy: +snap.activity.energy.toFixed(2),
    };
    node.textContent = JSON.stringify(packet, null, 2);
  }

  window.VELMA = window.VELMA || {};
  window.VELMA.panels = {
    el: el,
    clear: clear,
    buildTopStats: buildTopStats,
    updateTopStats: updateTopStats,
    buildVisualConfig: buildVisualConfig,
    buildBlendLegend: buildBlendLegend,
    buildModeList: buildModeList,
    updateModeList: updateModeList,
    buildBarRows: buildBarRows,
    setBar: setBar,
    updateTrust: updateTrust,
    buildCapabilityRing: buildCapabilityRing,
    layoutCapabilityRing: layoutCapabilityRing,
    updateCapabilityRing: updateCapabilityRing,
    updateCapabilityList: updateCapabilityList,
    updateApprovals: updateApprovals,
    updateProject: updateProject,
    updatePacket: updatePacket,
  };
})();
