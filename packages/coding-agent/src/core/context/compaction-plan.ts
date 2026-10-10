import type { Message } from "@earendil-works/pi-ai";

import { estimateMessageTokens } from "../context-budget";
import type { projectModelInput } from "../model-input-projection";
import type { CompactionCheckpoint } from "./compaction-checkpoint";
import { NothingToCompactError } from "./compaction-error";

/** Keep complete recent turns; never cut between a tool call and its result. */
export const planCompaction = (
  messages: readonly Message[],
  projected: ReturnType<typeof projectModelInput>,
  previous?: CompactionCheckpoint,
  keepRecentTokens = 20000,
): { firstKeptMessageIndex: number; messages: Message[] } => {
  const start = previous?.firstKeptMessageIndex ?? 0;
  const turns = messages.flatMap((message, index) =>
    message.role === "user" && index >= start ? [index] : [],
  );
  if (turns.length < 2) throw new NothingToCompactError();
  const sizes = Array<number>(messages.length).fill(0);
  projected.messages.forEach((message, index) => {
    const origin = projected.projection.sources[index]!.messageIndex;
    sizes[origin] = sizes[origin]! + estimateMessageTokens(message);
  });
  let firstKeptMessageIndex = turns.at(-1)!;
  let tokens = 0;
  for (let turn = turns.length - 1; turn >= 0; turn--) {
    const index = turns[turn]!;
    const end = turns[turn + 1] ?? messages.length;
    const size = sizes.slice(index, end).reduce((sum, tokens) => sum + tokens, 0);
    if (turn < turns.length - 1 && tokens + size > keepRecentTokens) break;
    tokens += size;
    firstKeptMessageIndex = index;
  }
  if (firstKeptMessageIndex === turns[0]) throw new NothingToCompactError();
  return {
    firstKeptMessageIndex,
    messages: structuredClone(
      projected.messages.filter((_, index) => {
        const origin = projected.projection.sources[index]!.messageIndex;
        return origin >= start && origin < firstKeptMessageIndex;
      }),
    ),
  };
};
