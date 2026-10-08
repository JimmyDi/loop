import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

test("development watcher restarts backend sources without breaking Codemode or watching frontend", async () => {
  const root = join(import.meta.dirname, "..");
  const directory = await mkdtemp(join(import.meta.dirname, "dev-watch-fixture-"));
  const frontend = join(root, "packages/web-ui/src/frontend", basename(directory) + ".ts");
  const backend = join(directory, "backend.ts");
  const entry = join(directory, "entry.ts");
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const command = [...manifest.scripts.dev.matchAll(/"([^"]*)"|(\S+)/g)].map(
    (match) => match[1] ?? match[2],
  );
  const entryIndex = command.indexOf("bin.ts");
  expect(command[0]).toBe("tsx");
  expect(command[1]).toBe("watch");
  expect(entryIndex).toBeGreaterThan(1);
  await writeFile(backend, 'export const value = "first";\n');
  await writeFile(frontend, 'export const frontend = "first";\n');
  await writeFile(
    entry,
    [
      'import { CodemodeSandbox } from "@earendil-works/pi-codemode";',
      'import { value } from "./backend.ts";',
      "import { frontend } from " + JSON.stringify(frontend) + ";",
      'const sandbox = new CodemodeSandbox({ tools: [{ name: "read", execute: () => ({ value, frontend }) }] });',
      'const result = await sandbox.execute("text(await tools.read({}));");',
      "await sandbox.close();",
      'console.log(JSON.stringify({ event: "started", pid: process.pid, value, execArgv: process.execArgv, watchReporting: process.env.WATCH_REPORT_DEPENDENCIES ?? null, result }));',
      "setInterval(() => {}, 1000);",
      'const close = () => setTimeout(() => { console.log(JSON.stringify({ event: "stopped", pid: process.pid })); process.exit(0); }, 100);',
      'process.on("SIGINT", close);',
      'process.on("SIGTERM", close);',
    ].join("\n"),
  );
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.resolve("tsx/cli")), ...command.slice(1, entryIndex), entry],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  const exited = once(child, "exit");
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (errors += chunk));
  type Event = {
    event: string;
    pid: number;
    value?: string;
    execArgv?: string[];
    watchReporting?: string | null;
    result?: { ok: boolean; output: { text: string }[]; calls: { status: string }[] };
  };
  const events = (): Event[] =>
    output
      .split("\n")
      .filter((line) => line.startsWith('{"event":'))
      .map((line) => JSON.parse(line));
  const starts = () => events().filter((event) => event.event === "started");
  const expectStarted = async (count: number) => {
    await expect.poll(() => starts().length, { timeout: 10000 }).toBe(count);
    const event = starts().at(-1)!;
    expect(event.execArgv).not.toContain("--watch");
    expect(event.watchReporting).toBeNull();
    expect(event.result?.ok, errors + output).toBe(true);
    expect(event.result?.calls).toMatchObject([{ status: "ok" }]);
    expect(event.result?.output[0]?.text).toContain(event.value);
    return event;
  };

  try {
    const first = await expectStarted(1);
    await writeFile(backend, 'export const value = "second";\n');
    const second = await expectStarted(2);
    expect(second.pid).not.toBe(first.pid);
    expect(second.value).toBe("second");
    if (process.platform !== "win32") {
      const stopped = events().findIndex(
        (event) => event.event === "stopped" && event.pid === first.pid,
      );
      expect(stopped).toBeGreaterThan(-1);
      expect(stopped).toBeLessThan(events().findIndex((event) => event.pid === second.pid));
    }
    await writeFile(frontend, 'export const frontend = "second";\n');
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(starts()).toHaveLength(2);
    child.kill("SIGINT");
    await exited;
    if (process.platform !== "win32") {
      expect(events()).toContainEqual({ event: "stopped", pid: second.pid });
      expect(() => process.kill(second.pid, 0)).toThrow();
    }
    expect(errors).not.toContain("Sandbox bridge broken");
  } finally {
    child.kill("SIGKILL");
    for (const event of starts()) {
      try {
        process.kill(event.pid, "SIGKILL");
      } catch {
        // The watcher already stopped this backend.
      }
    }
    await exited;
    await rm(directory, { recursive: true, force: true });
    await rm(frontend, { force: true });
  }
});
