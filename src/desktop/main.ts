import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.LOOP_PORT ?? 3210);

let apiProcess: ChildProcess | null = null;

const apiUrl = `http://127.0.0.1:${port}`;

const startApi = () => {
  const serverEntry = resolve(process.cwd(), "src/server/main.ts");
  if (!existsSync(serverEntry)) throw new Error(`Loop server entry not found: ${serverEntry}`);
  const bun = process.env.BUN_EXECUTABLE_PATH ?? "bun";
  apiProcess = spawn(bun, ["run", serverEntry], {
    cwd: process.cwd(),
    env: { ...process.env, LOOP_PORT: String(port) },
    stdio: "inherit",
  });
  apiProcess.on("exit", (code) => {
    if (code && !isQuitting)
      void dialog.showErrorBox("Loop API stopped", `The local API exited with code ${code}.`);
  });
};

const waitForApi = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${apiUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
    }
  }
  throw new Error(`Loop API did not start on ${apiUrl}`);
};

const registerIpc = () => {
  ipcMain.handle("loop:health", async () => (await fetch(`${apiUrl}/api/health`)).json());
  ipcMain.handle("loop:history", async () => (await fetch(`${apiUrl}/api/history`)).json());
  ipcMain.handle(
    "loop:run",
    async (_event, request: { prompt: string; provider?: string; model?: string }) => {
      const response = await fetch(`${apiUrl}/api/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Loop run failed");
      return payload;
    },
  );
};

const createWindow = async () => {
  const window = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 760,
    minHeight: 560,
    webPreferences: {
      preload: fileURLToPath(new URL("./preload.cjs", import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await window.loadFile(resolve(process.cwd(), "dist/desktop/renderer/index.html"));
};

let isQuitting = false;
app.whenReady().then(async () => {
  try {
    registerIpc();
    startApi();
    await waitForApi();
    await createWindow();
  } catch (error) {
    await dialog.showMessageBox({
      type: "error",
      title: "Loop startup failed",
      message: error instanceof Error ? error.message : String(error),
    });
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  isQuitting = true;
  apiProcess?.kill();
  apiProcess = null;
});
