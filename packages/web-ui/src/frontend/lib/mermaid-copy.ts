type CopyLabels = { copy: string; copied: string; failed: string };

const copyIcon = `<rect x="8" y="8" width="12" height="12" rx="2" />
  <path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4" />`;

const checkIcon = '<path d="m5 12 4 4L19 6" />';

export const createMermaidCopyButton = (source: string, labels: CopyLabels) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "markdown-code-copy markdown-mermaid-copy";
  // Only static icon markup; source is passed directly to the clipboard.
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>`;
  const svg = button.querySelector("svg")!;
  const notice = document.createElement("span");
  notice.className = "sr-only";
  notice.setAttribute("role", "status");
  button.append(notice);
  let timer: number | undefined;
  let revision = 0;
  let disposed = false;

  const update = (status: "copy" | "copied" | "failed") => {
    const label = labels[status];
    button.dataset.copyStatus = status;
    button.title = label;
    button.setAttribute("aria-label", label);
    svg.innerHTML = status === "copied" ? checkIcon : copyIcon;
    notice.textContent = status === "copy" ? "" : label;
  };

  const copy = async () => {
    const current = ++revision;
    window.clearTimeout(timer);
    update("copy");
    try {
      await navigator.clipboard.writeText(source);
      if (disposed || current !== revision) return;
      update("copied");
    } catch {
      if (disposed || current !== revision) return;
      update("failed");
    }
    timer = window.setTimeout(() => update("copy"), 3000);
  };

  update("copy");
  button.onclick = (event) => {
    // This button owns its feedback; skip MarkdownText's delegated code-copy handler.
    event.stopPropagation();
    void copy();
  };

  return {
    button,
    dispose: () => {
      disposed = true;
      window.clearTimeout(timer);
      button.onclick = null;
    },
  };
};
