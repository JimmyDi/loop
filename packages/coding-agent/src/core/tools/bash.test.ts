import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as sleep } from "node:timers/promises";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";

import { createBashTool } from "./bash";

test("bash uses cwd, reports failure, truncates output and cancels child processes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-bash-test-"));
  const tool = createBashTool(dir, { permissionPreset: "workspace-write" });
  const signal = new AbortController().signal;

  try {
    expect(tool.parameters).not.toHaveProperty("properties.description");
    expect(JSON.stringify(await tool.execute({ command: "printf hello" }, signal))).toContain(
      "hello",
    );
    await expect(tool.execute({ command: "exit 4" }, signal)).rejects.toThrow("code 4");
    await expect(tool.execute({ command: "sleep 20", timeout: 0.02 }, signal)).rejects.toThrow(
      "timed out",
    );

    const large = await tool.execute({ command: "printf '%060000d' 1" }, signal);
    const text = large[0].type === "text" ? large[0].text : "";
    const outputPath = text.split("Full output: ")[1]?.slice(0, -1);

    expect(outputPath).toBeDefined();
    expect((await readFile(outputPath!, "utf8")).length).toBe(60000);
    await rm(dirname(outputPath!), { recursive: true, force: true });

    const controller = new AbortController();
    const result = tool.execute(
      { command: "echo $$ > process-id; sleep 20 & wait" },
      controller.signal,
    );
    const rejected = Promise.resolve(result).catch((error: Error) => error);

    for (let i = 0; i < 100 && !(await existsSync(join(dir, "process-id"))); i++) await sleep(5);

    const pid = Number(await readFile(join(dir, "process-id"), "utf8"));

    controller.abort(new Error("cancel test"));
    expect(((await rejected) as Error).message).toBe("cancel test");
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
