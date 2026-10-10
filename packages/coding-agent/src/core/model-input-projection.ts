import type { Message } from "@earendil-works/pi-ai";

import type { ModelInputMetadata, ModelMessageSource } from "@loop/agent";
import type { RuntimeContextSnapshot } from "./runtime-context";
import { validateRuntimeContexts } from "./runtime-context";
import type { CompactionCheckpoint } from "./context/compaction-checkpoint";

export type ModelInputSource =
  | ModelMessageSource
  | {
      type: "compaction";
      checkpointId: string;
      messageIndex: number;
      summarizedBefore: number;
    }
  | {
      type: "runtime-context";
      snapshotIndex: number;
      userTurn: number;
      messageIndex: number;
      skills: Array<{ id: string; revision: string }>;
    };

/** sources[i] identifies messages[i] in the assembled main model request. */
export type ModelInputProjection = {
  historyMessageCount: number;
  sources: ModelInputSource[];
  skillExpansions?: Array<{
    messageIndex: number;
    snapshotIndex: number;
    skills: Array<{ id: string; revision: string }>;
  }>;
};

export const projectModelInput = (
  messages: readonly Message[],
  snapshots: readonly RuntimeContextSnapshot[],
  metadata: ModelInputMetadata,
  checkpoint?: CompactionCheckpoint,
): { messages: Message[]; projection: ModelInputProjection } => {
  if (
    metadata.sources.length !== messages.length ||
    !Number.isSafeInteger(metadata.historyMessageCount) ||
    metadata.historyMessageCount < 0 ||
    metadata.sources.some(
      (source) =>
        !Number.isSafeInteger(source.messageIndex) ||
        source.messageIndex < 0 ||
        source.messageIndex >= metadata.historyMessageCount,
    )
  )
    throw new Error("Invalid model input origins");
  validateRuntimeContexts(snapshots, messages);

  const contexts = new Map(
    snapshots.map((snapshot, snapshotIndex) => [snapshot.userTurn, { snapshot, snapshotIndex }]),
  );
  const projected: Message[] = [];
  const sources: ModelInputSource[] = [];
  const skillExpansions: NonNullable<ModelInputProjection["skillExpansions"]> = [];
  let userTurn = 0;

  messages.forEach((message, index) => {
    const source = metadata.sources[index]!;
    projected.push(message);
    sources.push(source);
    if (message.role !== "user") return;
    const turn = userTurn++;
    const context = contexts.get(turn);
    if (!context) return;
    const { snapshot, snapshotIndex } = context;
    if (snapshot.placement === "user") {
      const content =
        typeof message.content === "string"
          ? snapshot.content + "\n\n" + message.content
          : [{ type: "text" as const, text: snapshot.content }, ...message.content];
      projected[projected.length - 1] = { ...message, content };
      skillExpansions.push({
        messageIndex: source.messageIndex,
        snapshotIndex,
        skills: (snapshot.skills ?? []).map(({ id, revision }) => ({ id, revision })),
      });
      return;
    }
    projected.push({ role: "user", content: snapshot.content, timestamp: snapshot.timestamp });
    sources.push({
      type: "runtime-context",
      snapshotIndex,
      userTurn: turn,
      messageIndex: source.messageIndex,
      skills: (snapshot.skills ?? []).map(({ id, revision }) => ({ id, revision })),
    });
  });

  if (checkpoint) {
    const boundary = checkpoint.firstKeptMessageIndex;
    const kept = projected.flatMap((message, index) =>
      sources[index]!.messageIndex >= boundary ? [{ message, source: sources[index]! }] : [],
    );
    projected.splice(
      0,
      projected.length,
      {
        role: "user",
        content:
          "The conversation history before this point was compacted into the following summary:\n\n<summary>\n" +
          checkpoint.summary +
          "\n</summary>",
        timestamp: checkpoint.timestamp,
      },
      ...kept.map((row) => row.message),
    );
    sources.splice(
      0,
      sources.length,
      {
        type: "compaction",
        checkpointId: checkpoint.id,
        messageIndex: boundary,
        summarizedBefore: boundary,
      },
      ...kept.map((row) => row.source),
    );
  }

  const retainedExpansions = checkpoint
    ? skillExpansions.filter((entry) => entry.messageIndex >= checkpoint.firstKeptMessageIndex)
    : skillExpansions;
  return structuredClone({
    messages: projected,
    projection: {
      historyMessageCount: metadata.historyMessageCount,
      sources,
      ...(retainedExpansions.length ? { skillExpansions: retainedExpansions } : {}),
    },
  });
};
