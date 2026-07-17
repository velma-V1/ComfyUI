/*
 * Color palettes, including color-blind-friendly alternatives.
 *
 * The default identity is neon green / pink / blue. Accessibility palettes
 * remap the three dye roles (base / creative / logic) and the status colors
 * onto axes that remain distinguishable for the targeted vision type.
 * Every status in the UI also carries a text label, so color is never the
 * only channel. Initial values — to be validated with CVD simulators.
 */
(function () {
  "use strict";

  var PALETTES = {
    default: {
      label: "DEFAULT",
      dye: { green: "#39ff8e", pink: "#ff3df0", blue: "#2f9bff", purple: "#a854ff" },
      ok: "#39ff8e", warn: "#ffb02e", bad: "#ff4d5e",
      cyan: "#35e0ff", needle: "#ff3df0",
    },
    // Deuteranopia/protanopia-friendly: blue-yellow axis carries meaning.
    deutan: {
      label: "DEUTAN",
      dye: { green: "#ffd23e", pink: "#ff3df0", blue: "#2f9bff", purple: "#c78bff" },
      ok: "#4da6ff", warn: "#ffd23e", bad: "#ffffff",
      cyan: "#9ecbff", needle: "#ffd23e",
    },
    // Tritanopia-friendly: red-green axis carries meaning.
    tritan: {
      label: "TRITAN",
      dye: { green: "#2bef7c", pink: "#ff5a6e", blue: "#e8f6ff", purple: "#d98cff" },
      ok: "#2bef7c", warn: "#ff9d6e", bad: "#ff3347",
      cyan: "#bfe9d9", needle: "#ff5a6e",
    },
  };

  function hexToRgb01(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex);
    var n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  var current = "default";
  var listeners = [];

  function apply(name) {
    if (!PALETTES[name]) { return; }
    current = name;
    var p = PALETTES[name];
    var root = document.documentElement.style;
    root.setProperty("--green", p.dye.green);
    root.setProperty("--pink", p.dye.pink);
    root.setProperty("--blue", p.dye.blue);
    root.setProperty("--purple", p.dye.purple);
    root.setProperty("--amber", p.warn);
    root.setProperty("--red", p.bad);
    root.setProperty("--cyan", p.cyan);
    window.VELMA.paletteColors = p;
    try { localStorage.setItem("velma-palette", name); } catch (e) { /* private mode */ }
    listeners.forEach(function (fn) { fn(p, name); });
  }

  window.VELMA = window.VELMA || {};
  window.VELMA.palette = {
    PALETTES: PALETTES,
    hexToRgb01: hexToRgb01,
    apply: apply,
    onChange: function (fn) { listeners.push(fn); },
    currentName: function () { return current; },
    restore: function () {
      var saved = null;
      try { saved = localStorage.getItem("velma-palette"); } catch (e) { /* ignore */ }
      apply(saved && PALETTES[saved] ? saved : "default");
    },
  };
  window.VELMA.paletteColors = PALETTES.default;
})();
