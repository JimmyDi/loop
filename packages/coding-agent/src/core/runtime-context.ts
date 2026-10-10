import type { Message } from "@earendil-works/pi-ai";
import type { LoadedSkill } from "./skills/types";

/** Host-owned context anchored after a zero-based user turn, separate from chat messages. */
export type RuntimeContextSnapshot = {
  userTurn: number;
  content: string;
  timestamp: number;
  skills?: LoadedSkill[];
  /** Absent for legacy snapshots, which remain separate user messages. */
  placement?: "user";
};

const CLEARED_CONTEXT =
  "Loop runtime context (host-provided): no managed permission policy is active. Earlier runtime-context snapshots no longer apply.";

export const prepareRuntimeContexts = (
  retained: readonly RuntimeContextSnapshot[],
  content: string,
  userTurn: number,
  skills?: LoadedSkill[],
  placement?: "user",
): RuntimeContextSnapshot[] => {
  const snapshots = structuredClone([...retained]);
  if (!content && !snapshots.length) return snapshots;

  const current = content || CLEARED_CONTEXT;
  if (!skills?.length && snapshots.at(-1)?.content === current) return snapshots;

  snapshots.push({
    userTurn,
    content: current,
    timestamp: Date.now(),
    ...(placement ? { placement } : {}),
    ...(skills?.length ? { skills: structuredClone(skills) } : {}),
  });
  return snapshots;
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
      (snapshot.placement !== undefined && snapshot.placement !== "user") ||
      !Number.isSafeInteger(snapshot.timestamp) ||
      snapshot.timestamp < 0
    )
      throw new Error("Invalid session runtime context");

    previous = snapshot.userTurn;
    if (
      snapshot.skills !== undefined &&
      (!Array.isArray(snapshot.skills) ||
        snapshot.skills.some(
          (skill: LoadedSkill) =>
            !skill ||
            (skill.description !== undefined && typeof skill.description !== "string") ||
            [skill.id, skill.name, skill.path, skill.content, skill.revision].some(
              (value) => typeof value !== "string",
            ),
        ))
    )
      throw new Error("Invalid session skill context");
  }
};
