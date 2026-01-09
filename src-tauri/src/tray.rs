use lazy_static::lazy_static;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    App, Emitter, Manager, Wry,
};

// global storage for the last sync menu item updater function
lazy_static! {
    static ref MENU_UPDATER: Mutex<Option<Box<dyn Fn(String) + Send>>> = Mutex::new(None);
    static ref SYNC_ITEM: Mutex<Option<MenuItem<Wry>>> = Mutex::new(None);
}

#[tauri::command]
pub async fn update_tray_sync_time(
    _app_handle: tauri::AppHandle,
    time_str: String,
) -> Result<(), String> {
    if let Some(updater) = MENU_UPDATER
        .lock()
        .expect("Failed to lock MENU_UPDATER")
        .as_ref()
    {
        updater(time_str);
    }
    Ok(())
}

/// enable/disable the tray sync button based on account availability
#[tauri::command]
pub async fn update_tray_sync_enabled(
    _app_handle: tauri::AppHandle,
    enabled: bool,
) -> Result<(), String> {
    if let Some(sync_item) = SYNC_ITEM.lock().expect("Failed to lock SYNC_ITEM").as_ref() {
        sync_item.set_enabled(enabled).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;

    let separator_item1 = PredefinedMenuItem::separator(app)?;

    let last_sync_item =
        MenuItem::with_id(app, "last_sync", "Last sync: Never", false, None::<&str>)?;
    let sync_item = MenuItem::with_id(app, "sync", "Sync Now", true, None::<&str>)?;

    // Store a closure that can update the last sync item text
    let item_clone = last_sync_item.clone();
    *MENU_UPDATER.lock().expect("Failed to lock MENU_UPDATER") =
        Some(Box::new(move |text: String| {
            let _ = item_clone.set_text(&text);
        }));

    // Store the sync item for enable/disable updates
    *SYNC_ITEM.lock().expect("Failed to lock SYNC_ITEM") = Some(sync_item.clone());

    let separator_item2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &show_item,
            &separator_item1,
            &last_sync_item,
            &sync_item,
            &separator_item2,
            &quit_item,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("No default window icon found")
                .clone(),
        )
        .menu(&menu)
        .tooltip("caldav-tasks")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();

                    // On macOS, restore the dock icon when showing the window
                    #[cfg(target_os = "macos")]
                    {
                        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
            }
            "sync" => {
                // emit event to frontend to trigger sync
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("tray-sync", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|_tray, event| {
            // on macOS, clicking the tray icon shows the menu (handled automatically)
            // on other platforms, we could add custom behavior here if needed... hm
            if let TrayIconEvent::Click { .. } = event {
                // menu is shown automatically on click for macOS
            }
        })
        .build(app)?;

    Ok(())
}
