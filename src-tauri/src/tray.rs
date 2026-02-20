// ---------------------------------------------------------------------------
// System Tray (macOS only)
// ---------------------------------------------------------------------------
// Persistent menu bar icon with quick status, pending approvals, and nav.

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

/// Tray icon ID used for lookups when rebuilding the menu.
const TRAY_ID: &str = "main-tray";

/// Build and register the system tray icon with its context menu.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_menu(app, "Disconnected", 0)?;
    let tray_icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("The Fireplace — Mission Control for OpenClaw")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "show_window" | "nav_chat" | "nav_health" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Navigate to the target route
                        let route = match id {
                            "nav_chat" => "/demon-chat",
                            "nav_health" => "/demon-health",
                            _ => "/",
                        };
                        let _ = window.eval(&format!("window.location.hash='#{}';window.__trayNav?.('{}');", route, route));
                    }
                }
                "nav_approvals" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.eval("window.location.hash='#/approvals';window.__trayNav?.('/approvals');");
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Build the tray menu with current status info.
fn build_menu(
    app: &AppHandle,
    connection_status: &str,
    pending_approvals: u32,
) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
    let status_dot = match connection_status {
        "Connected" => "●",
        "Connecting" | "Reconnecting" => "◐",
        _ => "○",
    };
    let status_label = format!("{} {}", status_dot, connection_status);

    let status_item = MenuItemBuilder::with_id("status", &status_label)
        .enabled(false)
        .build(app)?;

    let approvals_label = if pending_approvals > 0 {
        format!("Pending Approvals ({})", pending_approvals)
    } else {
        "No Pending Approvals".to_string()
    };
    let approvals_item = MenuItemBuilder::with_id("nav_approvals", &approvals_label)
        .enabled(pending_approvals > 0)
        .build(app)?;

    let sep1 = PredefinedMenuItem::separator(app)?;

    let show_window = MenuItemBuilder::with_id("show_window", "Show Window")
        .build(app)?;
    let chat_room = MenuItemBuilder::with_id("nav_chat", "Chat Room")
        .build(app)?;
    let health = MenuItemBuilder::with_id("nav_health", "Demon Health")
        .build(app)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Quit The Fireplace")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&status_item)
        .item(&approvals_item)
        .item(&sep1)
        .item(&show_window)
        .item(&chat_room)
        .item(&health)
        .item(&sep2)
        .item(&quit)
        .build()?;

    Ok(menu)
}

/// Tauri command called from the frontend to update tray menu dynamically.
#[tauri::command]
pub fn update_tray_status(
    app: AppHandle,
    connection_status: String,
    pending_approvals: u32,
) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let menu = build_menu(&app, &connection_status, pending_approvals)
            .map_err(|e| e.to_string())?;
        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;

        // Update tooltip with status
        let tooltip = if pending_approvals > 0 {
            format!(
                "The Fireplace — {} · {} pending",
                connection_status, pending_approvals
            )
        } else {
            format!("The Fireplace — {}", connection_status)
        };
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
