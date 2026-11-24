import "./titlebar.css";

const native = window as Window & {
  __LOOP_MACOS_TITLEBAR__?: boolean;
  __TAURI_INTERNALS__?: { invoke(command: string): Promise<unknown> };
};

const drag = (event: MouseEvent) => {
  if (event.button !== 0 || event.detail !== 1 || !(event.target instanceof Element)) return;
  if (!event.target.closest(".session-header, .desktop-titlebar-drag")) return;
  if (
    event.target.closest("button, input, a, select, textarea, [role=tab], [contenteditable=true]")
  )
    return;
  event.preventDefault();
  void native.__TAURI_INTERNALS__?.invoke("plugin:window|start_dragging").catch(() => {});
};

if (native.__LOOP_MACOS_TITLEBAR__) {
  document.documentElement.classList.add("desktop-macos-titlebar");
  const region = document.createElement("div");
  region.className = "desktop-titlebar-drag";
  region.setAttribute("aria-hidden", "true");
  document.body.append(region);
  const toggle = document.createElement("button");
  toggle.className = "desktop-sidebar-toggle";
  toggle.type = "button";
  toggle.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/></svg>';
  const sync = () => {
    const shell = document.querySelector(".app-shell");
    if (shell && region.parentElement !== shell) shell.append(region);
    if (shell && toggle.parentElement !== shell) shell.append(toggle);
    const expanded = shell?.getAttribute("data-sidebar-collapsed") !== "true";
    toggle.hidden = !shell || !!document.querySelector(".settings-panel");
    toggle.setAttribute("aria-expanded", String(expanded));
    const chinese = document.documentElement.lang.startsWith("zh");
    const label = expanded
      ? chinese
        ? "隐藏会话列表"
        : "Hide session list"
      : chinese
        ? "显示会话列表"
        : "Show session list";
    if (toggle.title !== label) {
      toggle.title = label;
      toggle.setAttribute("aria-label", label);
    }
  };
  toggle.onclick = () => window.dispatchEvent(new Event("loop:toggle-desktop-sidebar"));
  document.body.append(toggle);
  const observer = new MutationObserver(sync);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-sidebar-collapsed"],
  });
  sync();
  document.addEventListener("mousedown", drag);
  if (import.meta.hot) {
    import.meta.hot.accept();
    import.meta.hot.dispose(() => {
      document.removeEventListener("mousedown", drag);
      document.documentElement.classList.remove("desktop-macos-titlebar");
      region.remove();
      observer.disconnect();
      toggle.remove();
    });
  }
}
