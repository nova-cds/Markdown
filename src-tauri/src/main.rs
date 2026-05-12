#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;

use tauri::Manager;
use tauri::Emitter;

fn handle_file_open(app: &tauri::AppHandle, path: String) {
    let _ = app.emit("file-open", path);
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let initial_file = if args.len() > 1 && !args[1].starts_with('-') {
        Some(args[1].clone())
    } else {
        None
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if args.len() > 1 && !args[1].starts_with('-') {
                handle_file_open(app, args[1].clone());
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            commands::read_directory,
            commands::get_file_info,
        ])
        .setup(move |app| {
            if let Some(path) = initial_file {
                handle_file_open(app.handle(), path);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
