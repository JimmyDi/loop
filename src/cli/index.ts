#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { AgentRuntime } from "../core/runtime";
import { createProvider } from "../providers";
import { ScheduleStore } from "../schedule/store";

const args = process.argv.slice(2);

const command = args[0] ?? "doctor";

const json = args.includes("--json");

const flag = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const output = (value: unknown) =>
  console.log(
    json
      ? JSON.stringify(value)
      : typeof value === "string"
        ? value
        : JSON.stringify(value, null, 2),
  );

const positionals = () => {
  const flags = new Set([
    "--json",
    "--file",
    "--provider",
    "--model",
    "--tools-path",
    "--skills-path",
    "--name",
    "--cron",
    "--prompt",
  ]);
  const values: string[] = [];
  for (let i = 1; i < args.length; i += 1) {
    if (flags.has(args[i])) {
      if (args[i] !== "--json") i += 1;
      continue;
    }
    if (!args[i].startsWith("--")) values.push(args[i]);
  }
  return values;
};
if (command === "run") {
  const file = flag("--file");
  const prompt = file ? await readFile(file, "utf8") : positionals().join(" ");
  if (!prompt.trim()) throw new Error("Usage: loop run [--file task.md] prompt");
  const events: unknown[] = [];
  const result = await new AgentRuntime().run(prompt, {
    provider: createProvider(flag("--provider")),
    model: flag("--model") ?? process.env.LOOP_MODEL ?? "mock-echo",
    onEvent: (event) => events.push(event),
  });
  output(json ? { ...result, events } : result.output);
} else if (["tools", "skills", "mcp"].includes(command)) {
  output({ command, items: [] });
} else if (command === "schedule") {
  const store = new ScheduleStore();
  const action = args[1];
  if (action === "list") output(await store.list());
  else if (action === "create")
    output(
      await store.create(
        flag("--name") ?? "Unnamed",
        flag("--cron") ?? "",
        flag("--prompt") ?? "",
        { provider: flag("--provider"), model: flag("--model") },
      ),
    );
  else if (action === "pause" || action === "resume")
    output(await store.setEnabled(args[2] ?? "", action === "resume"));
  else if (action === "delete") {
    output({
      deleted: args[2] ?? "",
      removed: await store.remove(args[2] ?? ""),
    });
  } else throw new Error("Usage: loop schedule list|create|pause|resume|delete");
} else if (command === "doctor")
  output({
    bun: Bun.version,
    provider: process.env.LOOP_PROVIDER ?? "mock",
    storage: process.env.LOOP_DATA_DIR ?? ".loop",
    status: "ok",
  });
else throw new Error("Commands: run, tools, skills, mcp, schedule, doctor");
