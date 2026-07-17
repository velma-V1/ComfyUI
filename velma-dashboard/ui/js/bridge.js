/*
 * Core link: transports snapshots from VELMA Core into the state store.
 *
 * Two paths, both local-only:
 *  - Tauri v2 events: listens for "velma://snapshot" when running inside
 *    the Tauri shell (the Rust layer relays Core's IPC to the webview).
 *  - WebSocket to the local Core service. Loopback addresses only —
 *    any other host is rejected. Nothing else on the page touches the
 *    network, and the link is opt-in (button or ?core= query param).
 */
(function () {
  "use strict";

  var V = window.VELMA;

  var LOOPBACK = /^ws:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?(\/|$)/;

  var bridge = {
    ws: null,
    wanted: false,
    connected: false,
    url: null,
    backoff: 1000,
    timer: null,
    listeners: [],

    onStatus: function (fn) { this.listeners.push(fn); },

    _status: function () {
      var self = this;
      this.listeners.forEach(function (fn) { fn(self.connected, self.wanted); });
    },

    connect: function (url) {
      if (!LOOPBACK.test(url)) {
        throw new Error("Core link refused: only loopback ws:// URLs are allowed.");
      }
      this.url = url;
      this.wanted = true;
      this.backoff = 1000;
      this._open();
    },

    disconnect: function () {
      this.wanted = false;
      this.connected = false;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (this.ws) { this.ws.close(); this.ws = null; }
      this._dropped("Core link closed by user.");
      this._status();
    },

    _open: function () {
      var self = this;
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      var ws;
      try {
        ws = new WebSocket(this.url);
      } catch (e) {
        this._retry();
        return;
      }
      this.ws = ws;
      ws.onopen = function () {
        self.connected = true;
        self.backoff = 1000;
        self._status();
      };
      ws.onmessage = function (ev) {
        var data;
        try { data = JSON.parse(ev.data); } catch (e) { return; }
        V.state.ingestSnapshot(data, "live");
      };
      ws.onclose = function () {
        var wasConnected = self.connected;
        self.connected = false;
        self.ws = null;
        if (wasConnected && self.wanted) {
          self._dropped("Core link lost; attempting to reconnect.");
        }
        self._status();
        if (self.wanted) { self._retry(); }
      };
      ws.onerror = function () { /* onclose follows */ };
    },

    _retry: function () {
      var self = this;
      this.timer = setTimeout(function () { self._open(); }, this.backoff);
      this.backoff = Math.min(this.backoff * 2, 15000);
    },

    /* Telemetry rule: when the link drops, stale numbers must not keep
       rendering as live. Reset to the no-data snapshot. */
    _dropped: function (reason) {
      var snap = V.state.snapshot;
      snap.source = "none";
      Object.keys(snap.telemetry).forEach(function (k) { snap.telemetry[k] = null; });
      snap.state = "offline";
      snap.trust = { level: "unknown", reason: reason };
      V.state.emit();
    },

    /* Tauri v2: the Rust shell forwards Core snapshots as webview events. */
    initTauri: function () {
      var t = window.__TAURI__;
      if (!t || !t.event || typeof t.event.listen !== "function") { return false; }
      t.event.listen("velma://snapshot", function (ev) {
        if (ev && ev.payload && typeof ev.payload === "object") {
          V.state.ingestSnapshot(ev.payload, "live");
        }
      });
      return true;
    },
  };

  V.bridge = bridge;
})();
