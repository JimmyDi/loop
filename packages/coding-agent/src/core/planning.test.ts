import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "vitest";

import { SessionManager } from "./session-manager";
import { SessionPlanner } from "./planning";
import { validatePlanning } from "./planning-types";

test("persists versions, invalidates revisions and confirms only the latest ready plan", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-plan-test-"));
  try {
    const manager = await SessionManager.create(root, join(root, "sessions"));
    const planner = new SessionPlanner(manager, () => {});
    await planner.setMode("plan");
    const submit = planner.tools().find((tool) => tool.name === "submit_plan")!;
    await submit.execute(
      { title: "First", markdown: "Read the implementation." },
      new AbortController().signal,
    );
    const first = planner.state.plans[0]!;
    await planner.invalidate();
    await expect(planner.accept(first.id, first.version)).rejects.toThrow("no longer ready");
    await submit.execute(
      { title: "Second", markdown: "Implement and verify." },
      new AbortController().signal,
    );
    const restored = await SessionManager.open(manager.sessionFile!);
    expect(restored.getHeader().planning).toEqual(planner.state);
    const latest = planner.state.plans.at(-1)!;
    expect(latest.version).toBe(2);
    expect(await planner.accept(latest.id, latest.version)).toContain("Implement and verify.");
    expect(planner.state.mode).toBe("execute");
    await expect(planner.accept(latest.id, latest.version)).rejects.toThrow("no longer ready");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Plan shell cannot escalate and cannot modify project files", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-plan-shell-"));
  try {
    const target = join(root, "example.txt");
    await writeFile(target, "original");
    const planner = new SessionPlanner(SessionManager.inMemory(root), () => {});
    await planner.setMode("plan");
    const tools = planner.tools();
    expect(tools.map((tool) => tool.name)).toEqual(["read", "bash", "submit_plan"]);
    const bash = tools.find((tool) => tool.name === "bash")!;
    await expect(
      Promise.resolve().then(() =>
        bash.execute(
          { command: "true", sandbox_permissions: "require_escalated", justification: "Request" },
          new AbortController().signal,
        ),
      ),
    ).rejects.toThrow("does not allow");
    // Sandbox-unavailable failures are also safe: no host fallback is allowed.
    await Promise.resolve(
      bash.execute({ command: "printf changed > example.txt" }, new AbortController().signal),
    ).catch(() => {});
    expect(await readFile(target, "utf8")).toBe("original");
    expect(() =>
      validatePlanning({
        mode: "plan",
        plans: [{ id: "p", version: 1, title: " ", markdown: "x", status: "ready" }],
      }),
    ).toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed acceptance save leaves the plan ready without starting execution", async () => {
  const manager = SessionManager.inMemory();
  const planner = new SessionPlanner(manager, () => {});
  await planner.setMode("plan");
  await planner
    .tools()
    .find((tool) => tool.name === "submit_plan")!
    .execute({ title: "Plan", markdown: "Implement." }, new AbortController().signal);
  const plan = planner.state.plans[0]!;
  manager.setPlanning = async () => {
    throw new Error("Storage unavailable");
  };
  await expect(planner.accept(plan.id, plan.version)).rejects.toThrow("Storage unavailable");
  expect(planner.state.mode).toBe("plan");
  expect(planner.state.plans[0]!.status).toBe("ready");
});

test("skipping persists completion without acceptance and rejects stale or repeated decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "loop-plan-skip-"));
  try {
    const manager = await SessionManager.create(root, join(root, "sessions"));
    const planner = new SessionPlanner(manager, () => {});
    await planner.setMode("plan");
    await planner
      .tools()
      .find((tool) => tool.name === "submit_plan")!
      .execute({ title: "Plan", markdown: "Steps" }, new AbortController().signal);
    const plan = planner.state.plans[0]!;
    await expect(planner.skip(plan.id, plan.version + 1)).rejects.toThrow("no longer ready");
    const save = manager.setPlanning.bind(manager);
    manager.setPlanning = async () => {
      throw new Error("Storage unavailable");
    };
    await expect(planner.skip(plan.id, plan.version)).rejects.toThrow("Storage unavailable");
    expect(planner.state.plans[0]!.status).toBe("ready");
    manager.setPlanning = save;
    await planner.skip(plan.id, plan.version);
    expect(planner.state).toEqual({ mode: "execute", plans: [{ ...plan, status: "skipped" }] });
    expect((await SessionManager.open(manager.sessionFile!)).getHeader().planning).toEqual(
      planner.state,
    );
    await expect(planner.accept(plan.id, plan.version)).rejects.toThrow("no longer ready");
    await expect(planner.skip(plan.id, plan.version)).rejects.toThrow("no longer ready");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
