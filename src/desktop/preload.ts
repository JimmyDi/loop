import { contextBridge, ipcRenderer } from "electron";

type RunRequest = { prompt: string; provider?: string; model?: string };

contextBridge.exposeInMainWorld("loop", {
  run: (request: RunRequest) => ipcRenderer.invoke("loop:run", request),
  history: () => ipcRenderer.invoke("loop:history"),
  health: () => ipcRenderer.invoke("loop:health"),
});
