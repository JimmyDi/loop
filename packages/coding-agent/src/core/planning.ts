import type { AgentTool } from "@loop/agent";

import type { SessionManager } from "./session-manager";
import type { SessionEvent } from "./types/session";
import type { SessionMode, SessionPlanning } from "./planning-types";
import { isSessionMode } from "./planning-types";
import { PermissionPolicy } from "./permissions/policy";
import { createReadTool } from "./tools/read";
import { createBashTool } from "./tools/bash";

export class SessionPlanner {
  constructor(
    private readonly manager: SessionManager,
    private readonly notify: (event: SessionEvent) => void,
  ) {}

  get state(): SessionPlanning {
    return this.manager.getHeader().planning ?? { mode: "execute", plans: [] };
  }

  async setMode(mode: SessionMode): Promise<void> {
    if (!isSessionMode(mode)) throw new Error("Invalid session mode");
    const state = this.state;
    if (state.mode === mode) return;
    await this.save({
      mode,
      plans: state.plans.map((plan) =>
        plan.status === "ready" ? { ...plan, status: "superseded" } : plan,
      ),
    });
  }

  async invalidate(preserveAccepted = false): Promise<void> {
    const state = this.state;
    if (
      !state.plans.some(
        (plan) => plan.status === "ready" || (!preserveAccepted && plan.status === "accepted"),
      )
    )
      return;
    await this.save({
      ...state,
      plans: state.plans.map((plan) =>
        plan.status === "ready" || (!preserveAccepted && plan.status === "accepted")
          ? { ...plan, status: "superseded" }
          : plan,
      ),
    });
  }

  async accept(id: string, version: number): Promise<string> {
    const state = this.state;
    const plan = state.plans.at(-1);
    if (
      state.mode !== "plan" ||
      !plan ||
      plan.id !== id ||
      plan.version !== version ||
      plan.status !== "ready"
    )
      throw new Error("Plan is no longer ready for execution");
    await this.save({
      mode: "execute",
      plans: state.plans.map((item) => (item.id === id ? { ...item, status: "accepted" } : item)),
    });
    return (
      "Implement the confirmed plan below. Follow existing permission policies.\n\n" +
      plan.title +
      "\n\n" +
      plan.markdown
    );
  }

  async skip(id: string, version: number): Promise<void> {
    const state = this.state;
    const plan = state.plans.at(-1);
    if (
      state.mode !== "plan" ||
      plan?.status !== "ready" ||
      plan.id !== id ||
      plan.version !== version
    )
      throw new Error("Plan is no longer ready for review");
    await this.save({
      mode: "execute",
      plans: state.plans.map((item) => (item.id === id ? { ...item, status: "skipped" } : item)),
    });
  }

  tools(): AgentTool[] {
    const cwd = this.manager.getCwd();
    const bash = createBashTool(cwd, new PermissionPolicy(cwd, { permissionPreset: "read-only" }));
    return [
      {
        ...createReadTool(cwd),
        execute: (args, signal) => {
          if (this.state.mode !== "plan") throw new Error("Plan mode is inactive");
          return createReadTool(cwd).execute(args, signal);
        },
      },
      {
        ...bash,
        description:
          "Investigate the workspace using a read-only sandbox. Network and host escalation are unavailable in Plan mode.",
        execute: (args, signal) => {
          if (this.state.mode !== "plan") throw new Error("Plan mode is inactive");
          if (args.sandbox_permissions === "require_escalated" || args.justification !== undefined)
            throw new Error("Plan mode does not allow shell escalation");
          return bash.execute(args, signal);
        },
      },
      {
        name: "submit_plan",
        description:
          "Submit a decision-complete implementation plan requested by the user and finish this planning run. Do not use this tool for explanation or research answers. Provide a clear title and self-contained Markdown covering the goal, concrete steps, relevant interfaces and edge cases, validation with expected outcomes, and assumptions. Match detail to task complexity and resolve consequential choices first. Revisions must replace the full plan, not just list amendments. Submission saves a version for review; it does not switch modes or grant execution permissions. Call this tool alone, without other tool calls in the same response.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", minLength: 1, maxLength: 300 },
            markdown: { type: "string", minLength: 1, maxLength: 100000 },
          },
          required: ["title", "markdown"],
          additionalProperties: false,
        },
        endTurn: true,
        execute: async (args, signal) => {
          signal.throwIfAborted();
          if (
            typeof args.title !== "string" ||
            !args.title.trim() ||
            typeof args.markdown !== "string" ||
            !args.markdown.trim()
          )
            throw new Error("Plan title and content are required");
          const state = this.state;
          if (state.mode !== "plan") throw new Error("Plan mode is inactive");
          const plan = {
            id: crypto.randomUUID(),
            version: state.plans.length + 1,
            title: args.title.trim(),
            markdown: args.markdown.trim(),
            status: "ready" as const,
          };
          await this.save({
            ...state,
            plans: [
              ...state.plans.map((item) =>
                item.status === "ready" ? { ...item, status: "superseded" as const } : item,
              ),
              plan,
            ],
          });
          return [{ type: "text", text: JSON.stringify(plan) }];
        },
      },
    ];
  }

  private async save(state: SessionPlanning): Promise<void> {
    await this.manager.setPlanning(state);
    this.notify({ type: "planning_changed", planning: state });
  }
}
