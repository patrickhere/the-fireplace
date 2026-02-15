// ---------------------------------------------------------------------------
// System Tray (macOS only)
// ---------------------------------------------------------------------------
// Persistent menu bar icon with quick status and window controls.

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

/// Build and register the system tray icon with its context menu.
///
/// The tray provides:
/// - "Show Window" — brings the main window to front
/// - A separator
/// - "Quit" — exits the application
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_window = MenuItemBuilder::with_id("show_window", "Show Window")
        .build(app)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit The Fireplace")
        .build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_window)
        .item(&separator)
        .item(&quit)
        .build()?;

    let tray_icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;

    let _tray = TrayIconBuilder::new()
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("The Fireplace — Mission Control for OpenClaw")
        .menu(&menu)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "show_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
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
