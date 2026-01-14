#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod migrations;
mod tray;

use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_sql::Builder;

fn main() {
    let db_migrations = migrations::get_migrations();

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir {
                        file_name: Some("caldav-tasks".to_string()),
                    }),
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Debug)
                .max_file_size(50_000)
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            Builder::default()
                .add_migrations("sqlite:caldav-tasks.db", db_migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            tray::update_tray_sync_time,
            tray::update_tray_sync_enabled,
            tray::set_tray_visible,
            tray::get_tray_enabled,
            tray::initialize_tray
        ])
        .setup(|_app| {
            // tray will be initialized from frontend after reading settings
            Ok(())
        })
        .on_window_event(|window, event| {
            // hide window instead of closing when X is clicked, but only if tray is enabled
            if let WindowEvent::CloseRequested { api, .. } = event {
                // check if tray is enabled
                if tray::is_tray_enabled() {
                    let _ = window.hide();
                    api.prevent_close();

                    // on macOS, hide the dock icon when the window is hidden
                    #[cfg(target_os = "macos")]
                    {
                        let _ = window
                            .app_handle()
                            .set_activation_policy(tauri::ActivationPolicy::Accessory);
                    }
                }
                // if tray is disabled, let the window close normally
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            // handle app reactivation (e.g., from Spotlight, Dock, Cmd+Tab)
            #[cfg(target_os = "macos")]
            {
                if let RunEvent::Reopen { .. } = event {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();

                        // restore the dock icon
                        let _ = app_handle.set_activation_policy(tauri::ActivationPolicy::Regular);
                    }
                }
            }
        });
}
