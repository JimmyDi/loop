use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::{Child, ChildStdin, Command},
    sync::{mpsc, oneshot, Mutex},
    time::{timeout, Duration},
};

type Reply = oneshot::Sender<Result<Value, String>>;

pub struct Backend {
    child: Mutex<Child>,
    input: Mutex<ChildStdin>,
    pending: Arc<Mutex<HashMap<u64, Reply>>>,
    sequence: AtomicU64,
    pub url: String,
    pub token: String,
}

impl Backend {
    pub async fn start(
        resources: PathBuf,
        data: PathBuf,
        loop_data: Option<PathBuf>,
        events: mpsc::Sender<String>,
    ) -> Result<Arc<Self>, String> {
        std::fs::create_dir_all(&data).map_err(|e| e.to_string())?;
        let token = uuid::Uuid::new_v4().to_string() + &uuid::Uuid::new_v4().to_string();
        let executable =
            resources
                .join("runtime")
                .join(if cfg!(windows) { "node.exe" } else { "node" });
        let mut command = Command::new(executable);
        let development = cfg!(debug_assertions) && std::env::var_os("LOOP_DESKTOP_DEV").is_some();
        if development {
            let package = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
            command
                .arg("--import")
                .arg(package.join("node_modules/tsx/dist/loader.mjs"))
                .arg("--conditions=loop-source")
                .arg(package.join("scripts/development.ts"));
        } else {
            command.arg(resources.join("backend.js"));
        }
        command
            .env("LOOP_DESKTOP_STATE_DIR", &data)
            .env("LOOP_DESKTOP_TOKEN", &token)
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .env_remove("LOOP_UPDATER_PUBLIC_KEY")
            .env_remove("TAURI_SIGNING_PRIVATE_KEY")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true);
        if development {
            command.stderr(std::process::Stdio::inherit());
        }
        if let Some(directory) = loop_data {
            command.env("LOOP_DATA_DIR", directory);
        }
        #[cfg(windows)]
        command.creation_flags(0x08000000);
        let mut child = command.spawn().map_err(|e| e.to_string())?;
        let input = child.stdin.take().ok_or("Backend stdin unavailable")?;
        let output = child.stdout.take().ok_or("Backend stdout unavailable")?;
        let pending: Arc<Mutex<HashMap<u64, Reply>>> = Arc::new(Mutex::new(HashMap::new()));
        let reader_pending = pending.clone();
        let (ready, receive_ready) = oneshot::channel();
        tokio::spawn(async move {
            let mut ready = Some(ready);
            let mut lines = BufReader::new(output).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let Ok(value) = serde_json::from_str::<Value>(&line) else {
                    continue;
                };
                if value["event"] == "ready" {
                    if let Some(sender) = ready.take() {
                        let _ = sender.send(value["url"].as_str().unwrap_or_default().to_string());
                    }
                } else if let Some(id) = value["id"].as_u64() {
                    if let Some(sender) = reader_pending.lock().await.remove(&id) {
                        let result = if value["ok"] == true {
                            Ok(value["value"].clone())
                        } else {
                            Err(value["error"]
                                .as_str()
                                .unwrap_or("Backend command failed")
                                .to_string())
                        };
                        let _ = sender.send(result);
                    }
                } else if let Some(event) = value["event"].as_str() {
                    let _ = events.send(event.to_string()).await;
                }
            }
            for (_, sender) in reader_pending.lock().await.drain() {
                let _ = sender.send(Err("Backend disconnected".into()));
            }
            let _ = events.send("disconnected".into()).await;
        });
        let url = timeout(Duration::from_secs(45), receive_ready)
            .await
            .map_err(|_| "Backend startup timed out")?
            .map_err(|_| "Backend exited during startup")?;
        let parsed: tauri::Url = url.parse().map_err(|_| "Invalid backend address")?;
        if parsed.scheme() != "http" || parsed.host_str() != Some("127.0.0.1") {
            return Err("Invalid backend address".into());
        }
        Ok(Arc::new(Self {
            child: Mutex::new(child),
            input: Mutex::new(input),
            pending,
            sequence: AtomicU64::new(0),
            url,
            token,
        }))
    }

    pub async fn request(&self, action: &str, mut fields: Value) -> Result<Value, String> {
        let id = self.sequence.fetch_add(1, Ordering::Relaxed);
        fields["id"] = json!(id);
        fields["action"] = json!(action);
        let (send, receive) = oneshot::channel();
        self.pending.lock().await.insert(id, send);
        let bytes = serde_json::to_vec(&fields).map_err(|e| e.to_string())?;
        let write = async {
            let mut input = self.input.lock().await;
            input.write_all(&bytes).await?;
            input.write_all(b"\n").await?;
            input.flush().await
        }
        .await;
        if let Err(error) = write {
            self.pending.lock().await.remove(&id);
            return Err(error.to_string());
        }
        let result = timeout(Duration::from_secs(60), receive).await;
        self.pending.lock().await.remove(&id);
        result
            .map_err(|_| "Backend operation timed out".to_string())?
            .map_err(|_| "Backend disconnected".to_string())?
    }

    pub async fn shutdown(&self) -> Result<(), String> {
        self.request("shutdown", json!({})).await?;
        timeout(Duration::from_secs(10), self.child.lock().await.wait())
            .await
            .map_err(|_| "Backend did not exit")?
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn packaged_backend_prepares_and_closes() {
        let resources = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../dist");
        let data = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../.tools")
            .join(uuid::Uuid::new_v4().to_string());
        let (events, _receiver) = mpsc::channel(8);
        let backend = Backend::start(resources, data.clone(), Some(data.join("data")), events)
            .await
            .unwrap();
        let status = backend.request("status", json!({})).await.unwrap();
        assert_eq!(status["tasks"], 0);
        assert_eq!(
            backend
                .request("prepare", json!({"stop": false}))
                .await
                .unwrap(),
            true
        );
        backend.request("resume", json!({})).await.unwrap();
        backend.shutdown().await.unwrap();
        std::fs::remove_dir_all(data).unwrap();
    }
}
