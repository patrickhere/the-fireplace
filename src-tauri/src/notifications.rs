// ---------------------------------------------------------------------------
// Native Notification Bridge
// ---------------------------------------------------------------------------
// Tauri commands that the frontend can invoke to send OS-level notifications.
// macOS: uses tauri-plugin-notification (UNUserNotificationCenter).
// iOS: push notification support (requires entitlements).

use tauri_plugin_notification::NotificationExt;

/// Send a native notification from the frontend.
///
/// # Arguments
/// - `title` — notification title (e.g. "Exec Approval Required")
/// - `body` — notification body text
/// - `urgency` — "low" | "normal" | "critical" — maps to notification sound
#[tauri::command]
pub fn send_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    urgency: Option<String>,
) -> Result<(), String> {
    let mut builder = app.notification().builder();
    builder = builder.title(&title).body(&body);

    // Add sound for critical notifications
    if urgency.as_deref() == Some("critical") {
        builder = builder.sound("default");
    }

    builder.show().map_err(|e| e.to_string())
}
