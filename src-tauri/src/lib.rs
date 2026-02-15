// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod keychain;
mod notifications;
#[cfg(target_os = "macos")]
mod tray;

use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to The Fireplace.", name)
}

/// Returns the current platform as a string: "macos", "ios", or "unknown".
#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    {
        "macos".to_string()
    }
    #[cfg(target_os = "ios")]
    {
        "ios".to_string()
    }
    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        "unknown".to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_platform,
            notifications::send_notification,
            keychain::keychain_store_token,
            keychain::keychain_retrieve_token,
            keychain::keychain_delete_token,
            keychain::keychain_has_token,
        ])
        .setup(|app| {
            // System tray — macOS only
            #[cfg(target_os = "macos")]
            {
                tray::setup_tray(app.handle())?;
            }

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
