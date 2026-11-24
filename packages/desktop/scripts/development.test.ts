import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { WebSocket } from "ws";
import { expect, test } from "vitest";

test("desktop development proxies authenticated Vite updates and reloads after backend edits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-desktop-dev-"));
  const desktop = resolve(import.meta.dirname, "..");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--conditions=loop-source", join(import.meta.dirname, "development.ts")],
    {
      cwd: desktop,
      env: {
        ...process.env,
        LOOP_DATA_DIR: join(directory, "data"),
        LOOP_DESKTOP_STATE_DIR: directory,
        LOOP_DESKTOP_TOKEN: "synthetic-development",
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  let diagnostic = "";
  child.stderr.on("data", (chunk) => {
    diagnostic += chunk;
  });
  const lines = createInterface({ input: child.stdout });
  let socket: WebSocket | undefined;
  const timer = setTimeout(() => child.kill(), 55_000);
  try {
    let url = "";
    for await (const line of lines) {
      if (!line.startsWith("{")) continue;
      const message = JSON.parse(line);
      if (message.event === "ready") {
        url = message.url;
        break;
      }
    }
    expect(url, diagnostic).toBeTruthy();
    expect((await fetch(url)).status).toBe(401);
    const login = await fetch(url + "/__desktop/bootstrap?token=synthetic-development", {
      redirect: "manual",
    });
    const headers = { cookie: login.headers.get("set-cookie")!.split(";")[0]! };
    const html = await (await fetch(url, { headers })).text();
    expect(html).toContain("/@vite/client");
    expect(html).toContain("src/client.ts");
    expect(html).toContain("/@react-refresh");
    const source = await (await fetch(url + "/main.tsx", { headers })).text();
    expect(source).not.toContain("startPwa();");
    const client = await (await fetch(url + "/@vite/client", { headers })).text();
    const token = /const wsToken = "([^"]+)"/.exec(client)?.[1];
    expect(token).toBeTruthy();
    socket = new WebSocket(url.replace("http:", "ws:") + "/?token=" + token, "vite-hmr", {
      headers: { ...headers, origin: url },
    });
    const messages: { type: string; updates?: { path: string }[] }[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(String(data))));
    await once(socket, "open");
    const css = "/components/settings/GeneralSettings.css";
    expect((await fetch(url + css, { headers })).status).toBe(200);
    await utimes(resolve(desktop, "../web-ui/src/frontend" + css), new Date(), new Date());
    await expect
      .poll(() =>
        messages.some((message) => message.updates?.some((update) => update.path === css)),
      )
      .toBe(true);
    await utimes(resolve(desktop, "../web-ui/src/backend/server.ts"), new Date(), new Date());
    await expect
      .poll(() => messages.some((message) => message.type === "full-reload"), { timeout: 20_000 })
      .toBe(true);
    expect((await fetch(url + "/api/workspaces", { headers })).status).toBe(200);
    socket.close();
    child.stdin.write(JSON.stringify({ id: 1, action: "shutdown" }) + "\n");
    expect((await exited)[0], diagnostic).toBe(0);
  } finally {
    clearTimeout(timer);
    socket?.terminate();
    child.kill();
    lines.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 60_000);
