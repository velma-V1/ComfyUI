# VELMA Visual System — Orb Dashboard Prototype

Dependency-free HTML/CSS/JS + WebGL prototype of the VELMA control dashboard.
The central Orb represents VELMA's real operating state; panels around it show
telemetry, trust, capabilities, approvals, and project status.

## Run

No build step, no dependencies. Serve the folder and open it:

```bash
cd velma-dashboard
python3 -m http.server 8410
# open http://localhost:8410
```

(Opening `index.html` directly from disk also works in most browsers since
all scripts are classic scripts, not modules.)

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
- **Capability orbs** — small color-coded orbs ring the main Orb. Inactive
  = dim, active = bright + glow, blocked = dashed, disabled = nearly
  invisible. Orbiting/docking behavior is intentionally not frozen yet.
- **Trust display** — verified / uncertain / conflicting / failed / unknown,
  each with a plain-language reason string. No fake confidence percentages.
- **Telemetry rule** — every hardware gauge starts at `--` / NO TELEMETRY.
  Values render only when a snapshot supplies them. The built-in demo feed
  is opt-in and labeled **SIMULATED** in the UI.
- **Accessibility** — honors `prefers-reduced-motion` and has a manual
  Reduced Motion toggle (near-static orb, particles off). Color-blind
  alternative palettes are planned, not yet implemented.
- **Security** — no network fetches, no `innerHTML`; all DOM built with
  `createElement`/`textContent`. Snapshot ingestion validates enums and
  clamps numbers.

## Feeding real data

The dashboard is a UI only. VELMA Core (or the Tauri IPC bridge) pushes
strict snapshots:

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
| `index.html` | Layout: header, left/right panels, orb stage, bottom bar |
| `css/dashboard.css` | Dark neon theme, panels, grid |
| `js/state.js` | Snapshot store, validation, opt-in SIMULATED demo feed |
| `js/orb.js` | WebGL orb renderer (tie-dye shader, particles, perf scaling) |
| `js/gauges.js` | Canvas 2D automotive-style gauges |
| `js/panels.js` | DOM panel builders (no innerHTML) |
| `js/main.js` | Wiring, state styles, mode profiles, controls, RAF loop |

## Not yet proven (host-validation work)

Native Tauri packaging, final animation timings, exact state-color mapping,
sound reaction, voice synchronization, and target-PC GPU/Game Mode budgets.
