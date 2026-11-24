#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;
mod updater;
#[cfg(target_os = "macos")]
mod window_frame;

use serde_json::json;
use tauri::Manager;
use tokio::sync::mpsc;

fn main() {
    let smoke = std::env::args().any(|argument| argument == "--smoke-test");
    let (events, receiver) = mpsc::channel::<String>(32);
    let close_events = events.clone();
    let quit_events = events.clone();
    let mut builder = tauri::Builder::default();
    if !smoke {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }));
    }
    builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            let data = if smoke {
                std::path::PathBuf::from(std::env::var("LOOP_DESKTOP_SMOKE_DIR")?)
            } else {
                app.path().app_data_dir()?
            };
            std::fs::create_dir_all(&data)?;
            let resources = if cfg!(debug_assertions) {
                std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist")
            } else {
                app.path().resource_dir()?.join("runtime")
            };
            let backend = tauri::async_runtime::block_on(backend::Backend::start(
                resources,
                data.clone(),
                smoke.then(|| data.join("data")),
                events,
            ))
            .map_err(std::io::Error::other)?;
            if smoke {
                tauri::async_runtime::block_on(async {
                    let prepared = backend.request("prepare", json!({"stop": false})).await?;
                    if prepared != true {
                        return Err("Smoke test backend was busy".to_string());
                    }
                    backend.shutdown().await
                })
                .map_err(std::io::Error::other)?;
                std::fs::write(data.join("passed"), "desktop-ready")?;
                app.handle().exit(0);
                return Ok(());
            }
            let address: tauri::Url = backend.url.parse()?;
            let origin = address.origin();
            #[cfg(target_os = "macos")]
            app.add_capability(
                json!({
                    "identifier": "desktop-titlebar",
                    "windows": ["main"],
                    "local": false,
                    "remote": { "urls": [format!("{}/*", origin.ascii_serialization())] },
                    "permissions": ["core:window:allow-start-dragging"]
                })
                .to_string(),
            )?;
            let mut bootstrap = address;
            bootstrap.set_path("/__desktop/bootstrap");
            bootstrap
                .query_pairs_mut()
                .append_pair("token", &backend.token);
            let initial_script = r#"
                document.addEventListener('click', (event) => {
                    const anchor = event.target.closest?.('a[target="_blank"]');
                    if (anchor && anchor.protocol === 'https:') {
                        event.preventDefault(); location.href = anchor.href;
                    }
                });
            "#;
            let window = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External(bootstrap),
            );
            #[cfg(target_os = "macos")]
            let window = window
                .transparent(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(20.0, 24.0))
                .initialization_script("window.__LOOP_MACOS_TITLEBAR__ = true;");
            let _window = window
                .initialization_script(initial_script)
                .title("Loop")
                .inner_size(1200.0, 800.0)
                .min_inner_size(800.0, 540.0)
                .on_navigation(move |url| {
                    if url.origin() == origin {
                        return true;
                    }
                    if url.scheme() == "https" {
                        #[cfg(target_os = "macos")]
                        let _ = std::process::Command::new("open").arg(url.as_str()).spawn();
                        #[cfg(windows)]
                        let _ = std::process::Command::new("explorer.exe")
                            .arg(url.as_str())
                            .spawn();
                    }
                    false
                })
                .build()?;
            #[cfg(target_os = "macos")]
            window_frame::apply(&_window)?;
            if let Ok(message) = std::fs::read_to_string(data.join("update-error.txt")) {
                tauri::async_runtime::block_on(backend.request(
                    "state",
                    json!({"state": {"phase":"error", "message":message}}),
                ))
                .ok();
            }
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(updater::run(handle, backend, receiver));
            Ok(())
        })
        .on_window_event(move |window, event| {
            #[cfg(target_os = "macos")]
            if matches!(event, tauri::WindowEvent::Resized(_)) {
                if let Some(webview) = window.get_webview_window("main") {
                    if let Err(error) = window_frame::apply(&webview) {
                        eprintln!("Unable to update window corners: {error}");
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = window;
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = close_events.try_send("quit".into());
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("Unable to start Loop")
        .run(move |_, event| {
            if let tauri::RunEvent::ExitRequested {
                code: None, api, ..
            } = event
            {
                api.prevent_exit();
                let _ = quit_events.try_send("quit".into());
            }
        });
}
