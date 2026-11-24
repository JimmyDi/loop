use crate::backend::Backend;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::{
    sync::{mpsc, watch},
    task::JoinHandle,
    time::{interval, Duration, MissedTickBehavior},
};

type Download = Result<Option<(Update, Vec<u8>)>, String>;

pub async fn report(backend: &Backend, phase: &str, version: Option<&str>, message: Option<&str>) {
    let _ = backend
        .request(
            "state",
            json!({ "state": { "phase": phase, "version": version, "message": message } }),
        )
        .await;
}

pub async fn run(app: tauri::AppHandle, backend: Arc<Backend>, mut events: mpsc::Receiver<String>) {
    let mut checks = interval(Duration::from_secs(4 * 60 * 60));
    checks.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let mut retry = interval(Duration::from_secs(3));
    retry.set_missed_tick_behavior(MissedTickBehavior::Skip);
    let (progress, mut progress_receiver) = watch::channel::<Value>(Value::Null);
    let mut download_job: Option<JoinHandle<Download>> = None;
    let mut pending: Option<(Update, Vec<u8>)> = None;
    let mut stopped = false;
    let mut requested_stop = false;
    if app
        .path()
        .app_data_dir()
        .ok()
        .is_some_and(|path| path.join("update-error.txt").exists())
    {
        // Preserve the failure until the next periodic check.
        checks.tick().await;
    }
    loop {
        let action = tokio::select! {
            _ = checks.tick() => "check".to_string(),
            _ = retry.tick(), if pending.is_some() && !stopped => "retry".to_string(),
            _ = progress_receiver.changed() => {
                let state = progress_receiver.borrow_and_update().clone();
                let _ = backend.request("state", json!({"state": state})).await;
                continue;
            },
            result = async { download_job.as_mut().unwrap().await }, if download_job.is_some() => {
                download_job = None;
                // Completion supersedes any buffered download progress.
                progress_receiver.borrow_and_update();
                match result {
                    Ok(Ok(Some(update))) => { pending = Some(update); stopped = false; requested_stop = false; "retry".to_string() }
                    Ok(Ok(None)) => { report(&backend, "latest", None, None).await; continue; }
                    result => {
                        let error = match result { Ok(Err(error)) => error, Err(error) => error.to_string(), _ => unreachable!() };
                        report(&backend, "error", None, Some(&error)).await; continue;
                    }
                }
            },
            event = events.recv() => match event { Some(value) => value, None => return },
        };
        if action == "disconnected" {
            if let Some(job) = download_job.take() {
                job.abort();
            }
            // A restart restores the backend without replaying a running task.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.eval("document.body.textContent='Loop service stopped. Close and reopen the application.'");
            }
            while let Some(event) = events.recv().await {
                if event == "quit" {
                    app.exit(1);
                    return;
                }
            }
            return;
        }
        if action == "quit" {
            if let Some(job) = download_job.take() {
                job.abort();
            }
            if let Err(error) = backend.shutdown().await {
                report(&backend, "error", None, Some(&error)).await;
                continue;
            }
            app.exit(0);
            return;
        }
        if action == "check" && pending.is_none() && download_job.is_none() {
            if let Ok(path) = app.path().app_data_dir() {
                let _ = std::fs::remove_file(path.join("update-error.txt"));
            }
            let config = app.config().plugins.0.get("updater");
            if config
                .and_then(|value| value.get("pubkey"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .is_empty()
            {
                report(&backend, "disabled", None, None).await;
                continue;
            }
            report(&backend, "checking", None, None).await;
            download_job = Some(tokio::spawn(download(app.clone(), progress.clone())));
            continue;
        }
        let Some((update, bytes)) = pending.as_ref() else {
            continue;
        };
        if stopped && action != "check" && action != "stop" {
            continue;
        }
        if action == "stop" {
            requested_stop = true;
        }
        let stop = requested_stop;
        if stop {
            report(&backend, "stopping", Some(&update.version), None).await;
        }
        match backend.request("prepare", json!({ "stop": stop })).await {
            Ok(value) if value == true => {
                report(&backend, "installing", Some(&update.version), None).await;
                if let Err(error) = backend.shutdown().await {
                    report(&backend, "error", Some(&update.version), Some(&error)).await;
                    stopped = true;
                    continue;
                }
                if let Err(error) = update.install(bytes) {
                    if let Ok(path) = app.path().app_data_dir() {
                        let _ = std::fs::write(path.join("update-error.txt"), error.to_string());
                    }
                }
                app.restart();
            }
            Ok(_) => {
                report(
                    &backend,
                    if requested_stop {
                        "stopping"
                    } else {
                        "waiting"
                    },
                    Some(&update.version),
                    None,
                )
                .await
            }
            Err(error) => {
                let _ = backend.request("resume", json!({})).await;
                report(&backend, "error", Some(&update.version), Some(&error)).await;
                stopped = true;
                requested_stop = false;
            }
        }
    }
}

async fn download(app: tauri::AppHandle, progress: watch::Sender<Value>) -> Download {
    let update = app
        .updater_builder()
        .timeout(Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let Some(update) = update else {
        return Ok(None);
    };
    let update = update.restart_after_install(true);
    let version = update.version.clone();
    let mut downloaded = 0_u64;
    let _ = progress.send(json!({"phase": "downloading", "version": version}));
    let bytes = update
        .download(
            |count, total| {
                downloaded += count as u64;
                let percentage = total
                    .filter(|total| *total > 0)
                    .map(|total| (downloaded as f64 / total as f64 * 100.0).min(100.0));
                let _ = progress.send(
                    json!({"phase": "downloading", "version": version, "progress": percentage}),
                );
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(Some((update, bytes)))
}
