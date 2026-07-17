# VELMA Visual System — Orb Dashboard Prototype

Dependency-free HTML/CSS/JS + WebGL prototype of the VELMA control dashboard.
The central Orb represents VELMA's real operating state; panels around it show
telemetry, trust, capabilities, approvals, and project status.

## Run (browser)

No build step, no dependencies. Serve the `ui/` folder and open it:

```bash
cd velma-dashboard/ui
python3 -m http.server 8410
# open http://localhost:8410
```

(Opening `ui/index.html` directly from disk also works in most browsers
since all scripts are classic scripts, not modules.)

## Run (desktop shell, Tauri v2)

`src-tauri/` contains the thin Rust shell: it relays snapshots from the
local Core WebSocket (`VELMA_CORE_URL`, default `ws://127.0.0.1:8765/state`,
loopback-only) to the webview as `velma://snapshot` events, provides a
system tray (show/hide/quit), and a `set_always_on_top` command surfaced
as an "Always On Top" button when the UI detects the shell.

On a host with the Rust toolchain and the platform WebView dependencies
(see the Tauri v2 prerequisites docs; on Linux: `webkit2gtk-4.1`, `gtk3`,
etc.):

```bash
cargo install tauri-cli --version '^2'
cd velma-dashboard/src-tauri
cargo tauri dev      # or: cargo tauri build
```

Icons: `icons/icon.png` is checked in; run `cargo tauri icon icons/icon.png`
on the host to generate the full platform set (`.ico`, `.icns`, sizes).

**Validation status:** `src/core_link.rs` (the loopback guard and WS relay
loop) is compile-checked and unit-tested. The GUI layer (`lib.rs`,
`main.rs`, tray, window config) compiles only where the WebView toolchain
exists and has NOT been built in this environment — treat it as
host-validation work, per the project's "not yet proven" list.

## Design rules implemented

- **Orb identity** — the Orb always blends neon green / blue / pink in a
  fluid tie-dye pattern (domain-warped fbm noise in a fragment shader).
  State accents only tint the rim, halo, and particles; weights are floored
  at 0.15 so no identity color can ever be driven to zero.
- **Idle** — slow breathing pulse, gentle internal flow, ambient inward
  particle drift.
- **Energy direction** — external particles flow inward toward the Orb.
- **Activity** — pulse speed, edge glow, particle density, and energy scale
  with the snapshot's activity values and the displayed state.
- **States** — idle, listening, thinking, model active, tool active,
  awaiting approval, warning, failure, offline, verifying. Selectable from
  the bottom panel for preview; in production they come from Core snapshots.
- **Modes** — Game / Work / Teaching. Game Mode halves render resolution,
  caps the Orb at 30 fps, and cuts noise octaves so it never competes with a
  running game. Modes never change the Orb's identity.
- **Capability orbs** — neurons in a nervous system around the Orb
  (design C4 "Loose Council" from review). Each soma rides a slowly
  rotating, breathing ring and connects to the core by a curved axon
  with dendrite stubs. Energy moves as a conversation: the core sends a
  near-white call pulse out, the neuron flashes and dwells while it
  thinks, then answers back in its own color, and the core flashes on
  receipt. Status drives the dialogue — active neurons are called often,
  available ones occasionally, awaiting-approval neurons hold their
  answer until the approval clears, and blocked/disabled ones stay
  silent. Neurons also exchange occasional side chatter.
- **Trust display** — verified / uncertain / conflicting / failed / unknown,
  each with a plain-language reason string. No fake confidence percentages.
- **Telemetry rule** — every hardware gauge starts at `--` / NO TELEMETRY.
  Values render only when a snapshot supplies them. The built-in demo feed
  is opt-in and labeled **SIMULATED** in the UI.
- **Accessibility** — honors `prefers-reduced-motion` and has a manual
  Reduced Motion toggle (near-static orb, particles off). Color vision
  palettes: DEFAULT, DEUTAN (blue-yellow status axis for red-green CVD),
  and TRITAN (red-green status axis for blue-yellow CVD). The selection
  persists in `localStorage` and remaps the orb dyes, gauges, bars, legend,
  and status colors together. Every status also has a text label, so color
  is never the only channel. Palette values are initial and should be
  validated with CVD simulators.
- **Voice sync** — the orb has a live audio channel (radius, rim glow)
  fed by whichever is louder: Core's `activity.audio_level` envelope
  (e.g. for TTS lip-sync) or an opt-in local microphone analyser behind
  the "Voice Sync" button. The mic is off by default, started only by an
  explicit click, reduced in-page to a single RMS loudness number, never
  recorded or transmitted, and fully released on stop. Reduced Motion
  zeroes the audio channel. Final tuning against VELMA's real voice
  output remains host work.
- **Security** — the page itself performs no network fetches; the only
  network path is the opt-in Core link below, which is restricted to
  loopback (`127.0.0.1` / `localhost` / `[::1]`) WebSocket URLs and
  rejects anything else. No `innerHTML`; all DOM built with
  `createElement`/`textContent`. Snapshot ingestion validates enums and
  clamps numbers.

## Feeding real data

The dashboard is a UI only. Three ways snapshots arrive, all local:

1. **Tauri v2 events** — when running inside the Tauri shell, the Rust
   layer relays Core's IPC as `velma://snapshot` webview events; the
   bridge subscribes automatically at boot.
2. **Loopback WebSocket** — the "Core Link" button connects to
   `ws://127.0.0.1:8765/state` (override with `?core=<port>` or
   `?core=ws://127.0.0.1:PORT/path`). Each WS message is one JSON
   snapshot. Reconnects with exponential backoff; on link loss the UI
   drops to OFFLINE and nulls all telemetry so stale numbers never
   render as live. Non-loopback URLs are refused.
3. **Direct call** — `VELMA.state.ingestSnapshot(snapshot, "live")`:

```js
VELMA.state.ingestSnapshot({
  state: "model_active",          // see VELMA.STATES
  mode: "work",                   // game | work | teaching
  trust: { level: "verified", reason: "Output matched validation run." },
  weights: { green: 0.42, pink: 0.68, blue: 0.81 },
  activity: { intensity: 0.73, energy: 0.85, turbulence: 0.78, flow_speed: 1.38 },
  telemetry: { cpu: 72, ram: 61, gpu: 68, vram: 52, temp: 58, workload: 65 },
  capabilities: [{ id: "model_30b", status: "active" }],
  approvals: [{ title: "...", risk: "low", changes: "...", scope: "single-use" }],
  project: { name: "...", stage: "...", operation: "...", progress: 0.4, blockers: "" },
  modeBlend: { coding: 0.6, reasoning: 0.7 },
}, "live");
```

Invalid states/enums are rejected; unknown fields ignored; numbers clamped.

## Files

| File | Purpose |
| --- | --- |
| `ui/index.html` | Layout: header, left/right panels, orb stage, bottom bar |
| `ui/css/dashboard.css` | Dark neon theme, panels, grid |
| `ui/js/palette.js` | Color vision palettes (default / deutan / tritan) |
| `ui/js/state.js` | Snapshot store, validation, opt-in SIMULATED demo feed |
| `ui/js/bridge.js` | Core link: Tauri v2 events + loopback-only WebSocket |
| `ui/js/audio.js` | Voice sync: opt-in mic analyser (RMS only, never recorded) |
| `ui/js/orb.js` | WebGL orb renderer (tie-dye shader, particles, perf scaling) |
| `ui/js/gauges.js` | Canvas 2D automotive-style gauges |
| `ui/js/panels.js` | DOM panel builders (no innerHTML) |
| `ui/js/main.js` | Wiring, state styles, mode profiles, controls, RAF loop |
| `src-tauri/src/core_link.rs` | Loopback-only WS relay (compile-checked + tested) |
| `src-tauri/src/lib.rs` | Tauri glue: snapshot events, tray, always-on-top |
| `src-tauri/tauri.conf.json` | Window, CSP, `frontendDist: ../ui`, bundle config |

## Not yet proven (host-validation work)

Native Tauri packaging/build of the GUI layer, final animation timings,
exact state-color mapping, voice-sync tuning against VELMA's real speech
output, and target-PC GPU/Game Mode budgets.
