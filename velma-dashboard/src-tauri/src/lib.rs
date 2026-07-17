//! VELMA desktop shell: thin Tauri v2 layer around the dashboard UI.
//!
//! Responsibilities are deliberately narrow (spec: the dashboard is a UI
//! only — it never becomes the brain or executes actions):
//!  - relay snapshots from the local Core WebSocket to the webview as
//!    `velma://snapshot` events (consumed by `ui/js/bridge.js`),
//!  - system tray with show/hide/quit,
//!  - `set_always_on_top` command for the planned pinned-window mode.
//!
//! NOTE: compiled and validated on a host with the platform WebView
//! toolchain; only `core_link` is compile-checked in CI-less environments.

mod core_link;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

const DEFAULT_CORE_URL: &str = "ws://127.0.0.1:8765/state";

#[tauri::command]
fn set_always_on_top(window: tauri::WebviewWindow, on: bool) -> Result<(), String> {
    window.set_always_on_top(on).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_always_on_top])
        .setup(|app| {
            // ---- Core link: forward local Core snapshots to the webview ----
            let url = std::env::var("VELMA_CORE_URL")
                .unwrap_or_else(|_| DEFAULT_CORE_URL.to_string());
            if core_link::is_loopback_ws_url(&url) {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    core_link::run(url, move |snapshot| {
                        let _ = handle.emit("velma://snapshot", snapshot);
                    })
                    .await;
                });
            } else {
                eprintln!(
                    "VELMA_CORE_URL is not a loopback ws:// URL; core link disabled"
                );
            }

            // ---- system tray ----
            let show = MenuItem::with_id(app, "show", "Show VELMA", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide VELMA", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;
            let mut tray = TrayIconBuilder::new().menu(&menu);
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, event| {
                let window = app.get_webview_window("main");
                match event.id.as_ref() {
                    "show" => {
                        if let Some(w) = window {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(w) = window {
                            let _ = w.hide();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                }
            })
            .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VELMA dashboard");
}
