import "./client.css";
import "./titlebar";

const chinese = navigator.language.startsWith("zh");
const label = (zh: string, en: string) => (chinese ? zh : en);
const preview = import.meta.env.DEV;
const button = document.createElement("button");
button.type = "button";
button.className = "desktop-update action-button icon ghost";
button.hidden = true;
button.innerHTML =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/></svg>';
const messages: Record<string, string> = {
  downloading: label("正在下载更新", "Downloading update"),
  waiting: label("停止任务并更新", "Stop tasks and update"),
  stopping: label("正在停止任务", "Stopping tasks"),
  installing: label("正在更新，即将重启", "Installing update and restarting"),
  error: label("更新失败", "Update failed"),
};
let phase = "";
let pending = false;
let disposed = false;
const setDescription = (description: string) => {
  button.title = description;
  button.setAttribute("aria-label", description);
};
const mount = () => {
  const navigation = document.querySelector(".navigation-bar");
  if (navigation && button.parentElement !== navigation) navigation.append(button);
};
const observer = new MutationObserver(mount);
observer.observe(document.body, { childList: true, subtree: true });
mount();
const stopTasks = async () => {
  pending = true;
  button.setAttribute("aria-disabled", "true");
  setDescription(messages.stopping);
  try {
    const response = await fetch("/__desktop/stop", { method: "POST" });
    if (!response.ok) throw new Error();
    phase = "stopping";
  } catch {
    phase = "error";
    setDescription(label("更新服务连接失败", "Update service unavailable"));
  } finally {
    pending = false;
    button.setAttribute("aria-disabled", String(phase === "stopping"));
  }
};
button.onclick = () => {
  if (preview) {
    window.alert(label("更新按钮样式预览", "Update button style preview"));
    return;
  }
  if (pending) return;
  if (phase === "error") {
    window.alert(button.title);
    return;
  }
  if (
    phase === "waiting" &&
    window.confirm(
      label(
        "更新已就绪。停止正在运行的任务并更新重启？",
        "Update ready. Stop running tasks, install the update and restart?",
      ),
    )
  ) {
    void stopTasks();
  }
};
const refresh = async () => {
  if (preview) {
    button.hidden = false;
    setDescription([messages.waiting, label("样式预览", "Style preview")].join(" · "));
    return;
  }
  if (pending) return;
  try {
    const response = await fetch("/__desktop/state");
    if (!response.ok) throw new Error();
    const value = await response.json();
    if (disposed || pending) return;
    phase = value.phase;
    button.hidden = !messages[phase];
    button.setAttribute("aria-disabled", String(phase !== "waiting" && phase !== "error"));
    setDescription(
      [
        messages[phase] ?? "",
        value.version,
        typeof value.progress !== "number" ? "" : Math.round(value.progress) + "%",
        value.message,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  } catch {
    if (disposed || pending) return;
    phase = "error";
    button.hidden = false;
    button.setAttribute("aria-disabled", "false");
    setDescription(label("更新服务连接失败", "Update service unavailable"));
  }
};
void refresh();
const refreshTimer = setInterval(() => {
  void refresh();
}, 2000);
if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    disposed = true;
    clearInterval(refreshTimer);
    observer.disconnect();
    button.remove();
  });
}
