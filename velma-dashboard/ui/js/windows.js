/*
 * Floating panel windows: drag by the title bar, minimize to the title
 * bar, positions and minimized state persist in localStorage. The orb
 * canvas lives behind everything; panels float over it.
 */
(function () {
  "use strict";

  var STORE_KEY = "velma-windows";
  var zTop = 20;

  function loadSaved() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  var saved = loadSaved();

  function persist(id, entry) {
    saved[id] = entry;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(saved)); } catch (e) { /* private mode */ }
  }

  function clampPos(x, y, w) {
    return {
      x: Math.min(Math.max(x, -w + 60), window.innerWidth - 60),
      y: Math.min(Math.max(y, 48), window.innerHeight - 32),
    };
  }

  function makeWindow(panel) {
    var id = panel.id;
    var title = panel.querySelector("h2");
    if (!title) { return; }

    panel.classList.add("win");

    var btn = document.createElement("button");
    btn.className = "win-min";
    btn.type = "button";
    btn.textContent = "–";
    btn.title = "Minimize";
    btn.setAttribute("aria-label", "Minimize " + title.textContent);
    title.appendChild(btn);

    function setMin(min) {
      panel.classList.toggle("minimized", min);
      btn.textContent = min ? "+" : "–";
      btn.title = min ? "Restore" : "Minimize";
    }

    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var min = !panel.classList.contains("minimized");
      setMin(min);
      var s = saved[id] || {};
      s.min = min;
      persist(id, s);
    });

    panel.addEventListener("pointerdown", function () {
      panel.style.zIndex = String(++zTop);
    });

    var drag = null;
    title.addEventListener("pointerdown", function (ev) {
      if (ev.target === btn) { return; }
      drag = {
        dx: ev.clientX - panel.offsetLeft,
        dy: ev.clientY - panel.offsetTop,
      };
      title.setPointerCapture(ev.pointerId);
      panel.classList.add("dragging");
      ev.preventDefault();
    });
    title.addEventListener("pointermove", function (ev) {
      if (!drag) { return; }
      var p = clampPos(ev.clientX - drag.dx, ev.clientY - drag.dy, panel.offsetWidth);
      panel.style.left = p.x + "px";
      panel.style.top = p.y + "px";
    });
    title.addEventListener("pointerup", function (ev) {
      if (!drag) { return; }
      drag = null;
      title.releasePointerCapture(ev.pointerId);
      panel.classList.remove("dragging");
      var s = saved[id] || {};
      s.x = panel.offsetLeft;
      s.y = panel.offsetTop;
      persist(id, s);
    });

    // restore
    var st = saved[id];
    if (st && st.x != null) {
      var p = clampPos(st.x, st.y, 300);
      panel.style.left = p.x + "px";
      panel.style.top = p.y + "px";
      panel.dataset.placed = "1";
    }
    if (st && st.min) { setMin(true); }
  }

  /* Stack panels that have no saved position into default columns. */
  function defaultLayout() {
    var top = 52, gap = 8, vw = window.innerWidth, vh = window.innerHeight;

    function stack(ids, x) {
      var y = top + 8;
      ids.forEach(function (id) {
        var p = document.getElementById(id);
        if (!p) { return; }
        if (!p.dataset.placed) {
          p.style.left = x + "px";
          p.style.top = y + "px";
        }
        y = p.offsetTop + p.offsetHeight + gap;
      });
    }

    stack(["panel-visual-config", "panel-modes", "panel-blend", "panel-approvals"], 10);
    stack(["panel-weights", "panel-drivers", "panel-trust", "panel-capabilities",
      "panel-packet"], vw - 350);

    var bottomIds = ["panel-sysmode", "panel-perf", "panel-project",
      "panel-states", "panel-controls"];
    var x = 10;
    bottomIds.forEach(function (id) {
      var p = document.getElementById(id);
      if (!p) { return; }
      if (!p.dataset.placed) {
        p.style.left = x + "px";
        p.style.top = (vh - p.offsetHeight - 10) + "px";
      }
      x = p.offsetLeft + p.offsetWidth + gap;
    });

    var g = document.getElementById("panel-gauges");
    if (g && !g.dataset.placed) {
      g.style.left = Math.max(320, (vw - g.offsetWidth) / 2) + "px";
      g.style.top = (vh - g.offsetHeight - 140) + "px";
    }
  }

  function init() {
    var panels = document.querySelectorAll("#desk .panel");
    panels.forEach(makeWindow);
    defaultLayout();
  }

  window.VELMA = window.VELMA || {};
  window.VELMA.windows = { init: init };
})();
