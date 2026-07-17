//! Core link: relays snapshots from the local VELMA Core WebSocket service.
//!
//! Mirrors the rules of `ui/js/bridge.js`: loopback URLs only, JSON object
//! messages only, reconnect with exponential backoff. This module has no
//! Tauri dependencies so it can be compile-checked and unit-tested without
//! the platform WebView toolchain.

use std::time::Duration;

use futures_util::StreamExt;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

const INITIAL_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(15);

/// The dashboard may only talk to a Core instance on this machine.
/// Anything that is not a loopback `ws://` URL is refused.
pub fn is_loopback_ws_url(url: &str) -> bool {
    let Some(rest) = url.strip_prefix("ws://") else {
        return false;
    };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    let host = if let Some(v6) = authority.strip_prefix('[') {
        // "[::1]:8765" -> "::1"
        match v6.split_once(']') {
            Some((h, _)) => h,
            None => return false,
        }
    } else {
        authority.rsplit_once(':').map_or(authority, |(h, _)| h)
    };
    matches!(host, "127.0.0.1" | "localhost" | "::1")
}

/// Connect to Core and forward every JSON object message to `on_snapshot`.
/// Reconnects forever with exponential backoff; never returns under normal
/// operation. The caller is responsible for validating `url` with
/// `is_loopback_ws_url` first (this function re-checks and bails as a
/// defense in depth).
pub async fn run<F>(url: String, mut on_snapshot: F)
where
    F: FnMut(serde_json::Value) + Send,
{
    if !is_loopback_ws_url(&url) {
        eprintln!("core_link: refusing non-loopback URL");
        return;
    }

    let mut backoff = INITIAL_BACKOFF;
    loop {
        match connect_async(&url).await {
            Ok((mut stream, _response)) => {
                backoff = INITIAL_BACKOFF;
                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(value) =
                                serde_json::from_str::<serde_json::Value>(&text)
                            {
                                if value.is_object() {
                                    on_snapshot(value);
                                }
                            }
                        }
                        Ok(_) => {}
                        Err(_) => break,
                    }
                }
            }
            Err(_) => {}
        }
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(MAX_BACKOFF);
    }
}

#[cfg(test)]
mod tests {
    use super::is_loopback_ws_url;

    #[test]
    fn accepts_loopback_urls() {
        assert!(is_loopback_ws_url("ws://127.0.0.1:8765/state"));
        assert!(is_loopback_ws_url("ws://localhost:8765/state"));
        assert!(is_loopback_ws_url("ws://[::1]:8765/state"));
        assert!(is_loopback_ws_url("ws://127.0.0.1/state"));
        assert!(is_loopback_ws_url("ws://localhost"));
    }

    #[test]
    fn rejects_everything_else() {
        assert!(!is_loopback_ws_url("ws://evil.example.com:8765/state"));
        assert!(!is_loopback_ws_url("wss://127.0.0.1:8765/state"));
        assert!(!is_loopback_ws_url("http://127.0.0.1:8765/state"));
        assert!(!is_loopback_ws_url("ws://127.0.0.1.evil.com/state"));
        assert!(!is_loopback_ws_url("ws://localhost.evil.com/state"));
        assert!(!is_loopback_ws_url(""));
    }
}
