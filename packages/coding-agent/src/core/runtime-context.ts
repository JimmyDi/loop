import type { Message } from "@earendil-works/pi-ai";

/** Host-owned context anchored after a zero-based user turn, separate from chat messages. */
export type RuntimeContextSnapshot = {
  userTurn: number;
  content: string;
  timestamp: number;
};

const CLEARED_CONTEXT =
  "Loop runtime context (host-provided): no managed permission policy is active. Earlier runtime-context snapshots no longer apply.";

export const prepareRuntimeContexts = (
  retained: readonly RuntimeContextSnapshot[],
  content: string,
  userTurn: number,
): RuntimeContextSnapshot[] => {
  const snapshots = structuredClone([...retained]);
  if (!content && !snapshots.length) return snapshots;

  const current = content || CLEARED_CONTEXT;
  if (snapshots.at(-1)?.content === current) return snapshots;

  snapshots.push({ userTurn, content: current, timestamp: Date.now() });
  return snapshots;
};

/** User-turn ordinals survive failed-assistant filtering and model changes. */
export const projectRuntimeContexts = (
  messages: readonly Message[],
  snapshots: readonly RuntimeContextSnapshot[],
): Message[] => {
  const contexts = new Map(snapshots.map((snapshot) => [snapshot.userTurn, snapshot]));
  const projected: Message[] = [];
  let userTurn = 0;

  for (const message of messages) {
    projected.push(message);
    if (message.role !== "user") continue;

    const snapshot = contexts.get(userTurn++);
    if (snapshot) {
      projected.push({
        role: "user",
        content: snapshot.content,
        timestamp: snapshot.timestamp,
      });
    }
  }

  return projected;
};

export const validateRuntimeContexts = (value: unknown, messages: readonly Message[]): void => {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error("Invalid session runtime context");

  const userTurns = messages.filter((message) => message.role === "user").length;
  let previous = -1;
  for (const snapshot of value) {
    if (
      !snapshot ||
      !Number.isSafeInteger(snapshot.userTurn) ||
      snapshot.userTurn <= previous ||
      snapshot.userTurn >= userTurns ||
      typeof snapshot.content !== "string" ||
      !snapshot.content.trim() ||
      !Number.isSafeInteger(snapshot.timestamp) ||
      snapshot.timestamp < 0
    )
      throw new Error("Invalid session runtime context");

    previous = snapshot.userTurn;
  }
};
