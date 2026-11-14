export type SessionMode = "execute" | "plan";

export type SessionPlan = {
  id: string;
  version: number;
  title: string;
  markdown: string;
  status: "ready" | "superseded" | "accepted" | "skipped";
};

export type SessionPlanning = {
  mode: SessionMode;
  plans: SessionPlan[];
};

export const isSessionMode = (value: unknown): value is SessionMode =>
  value === "execute" || value === "plan";

export const validatePlanning: (value: unknown) => asserts value is SessionPlanning = (value) => {
  if (!value || typeof value !== "object") throw new Error("Invalid session planning state");
  const state = value as SessionPlanning;
  if (!isSessionMode(state.mode) || !Array.isArray(state.plans))
    throw new Error("Invalid session planning state");
  const ids = new Set<string>();
  for (const [index, plan] of state.plans.entries()) {
    if (
      !plan ||
      typeof plan.id !== "string" ||
      !plan.id ||
      ids.has(plan.id) ||
      plan.version !== index + 1 ||
      typeof plan.title !== "string" ||
      !plan.title.trim() ||
      plan.title.length > 300 ||
      typeof plan.markdown !== "string" ||
      !plan.markdown.trim() ||
      plan.markdown.length > 100_000 ||
      !["ready", "superseded", "accepted", "skipped"].includes(plan.status) ||
      (plan.status === "ready" && index !== state.plans.length - 1)
    )
      throw new Error("Invalid session plan");
    ids.add(plan.id);
  }
};
