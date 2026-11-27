import type { PermissionPreset } from "../permissions/types";

export type ScheduleTrigger =
  | { kind: "rrule"; rule: string; timezone: string; anchorAt: number }
  | { kind: "once"; at: number }
  | { kind: "interval"; unit?: "hours" | "minutes"; everyMs: number; anchorAt: number }
  | { kind: "cron"; expression: string; timezone: string };

export type ScheduleInput = {
  name: string;
  projectId: string;
  prompt: string;
  trigger: ScheduleTrigger;
  permission: PermissionPreset;
  missed: "run-once" | "skip" | "ask";
};

export type Schedule = ScheduleInput & {
  id: string;
  revision: number;
  status: "active" | "paused" | "completed" | "missed" | "deleted";
  next: number | null;
  activeRun?: ScheduleRun;
};

export type ScheduleRun = {
  id: string;
  scheduleId: string;
  revision: number;
  input: ScheduleInput;
  scheduledFor: number;
  source: "timer" | "manual";
  startedAt?: number;
  finishedAt?: number;
  sessionId?: string;
  status:
    | "queued"
    | "running"
    | "interrupted"
    | "failed"
    | "completed"
    | "skipped"
    | "cancelled"
    | "save-pending";
  error?: string;
  archived?: boolean;
};

export type ScheduleRunCursor = Pick<ScheduleRun, "scheduledFor" | "scheduleId" | "id">;

export type ScheduleRunPage = {
  runs: Array<Omit<ScheduleRun, "input"> & { input: Pick<ScheduleInput, "name" | "projectId"> }>;
  nextCursor: ScheduleRunCursor | null;
};

export type ScheduleHost = {
  onOwner?(): Promise<() => Promise<void>>;
  available(projectId: string): boolean;
  execute(
    run: ScheduleRun,
    attach: (sessionId: string) => Promise<void>,
    signal: AbortSignal,
  ): Promise<"completed" | "cancelled" | "save-pending">;
};
