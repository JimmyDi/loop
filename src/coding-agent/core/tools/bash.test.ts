import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { createBashTool } from "./bash";

test("bash uses cwd, reports failure, truncates output and cancels child processes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "loop-bash-test-"));
  const tool = createBashTool(dir);
  const signal = new AbortController().signal;

  try {
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
    expect((await Bun.file(outputPath!).text()).length).toBe(60000);
    await rm(dirname(outputPath!), { recursive: true, force: true });

    const controller = new AbortController();
    const result = tool.execute(
      { command: "echo $$ > process-id; sleep 20 & wait" },
      controller.signal,
    );
    const rejected = Promise.resolve(result).catch((error: Error) => error);

    for (let i = 0; i < 100 && !(await Bun.file(join(dir, "process-id")).exists()); i++)
      await Bun.sleep(5);

    const pid = Number(await Bun.file(join(dir, "process-id")).text());

    controller.abort(new Error("cancel test"));
    expect(((await rejected) as Error).message).toBe("cancel test");
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
