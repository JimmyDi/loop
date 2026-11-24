import { memo } from "react";

import type { ToolView, PromptTiming } from "../../../shared/protocol";
import { assistantTextPhase } from "../../../shared/assistant-text-phase";
import { AssistantMessage } from "./AssistantMessage";
import { onlyToolCalls, projectAssistantTurn } from "./timeline-turns";
import type { TurnMessage } from "./timeline-turns";
import { ToolCard } from "./ToolCard";
import { ToolGroup } from "./ToolGroup";
import { PromptDuration } from "./PromptDuration";

const AssistantTurnView = ({
  messages,
  offset = 0,
  tools,
  draftIndex,
  running,
  timing,
  selectedIndex,
  projectedEntries,
}: {
  messages: TurnMessage[];
  offset?: number;
  tools: Record<string, ToolView>;
  draftIndex?: number;
  running: boolean;
  timing?: PromptTiming;
  selectedIndex?: number;
  projectedEntries?: TurnMessage[];
}) => {
  const entries = projectedEntries ?? projectAssistantTurn(messages);
  const last = entries.at(-1);
  const final =
    last?.message.role === "assistant" &&
    last.message.stopReason !== "toolUse" &&
    !last.message.content.some((part) => part.type === "toolCall") &&
    last.message.content.some(
      (part) =>
        part.type === "text" &&
        part.text.trim() &&
        assistantTextPhase(part.textSignature) !== "commentary",
    )
      ? last
      : undefined;
  const completed = timing?.finishedAt !== undefined ? timing : undefined;
  let lastVisible = entries.length - 1;
  while (
    lastVisible > 0 &&
    onlyToolCalls(entries[lastVisible]!) &&
    onlyToolCalls(entries[lastVisible - 1]!)
  ) {
    lastVisible--;
  }

  return (
    <>
      {(selectedIndex === undefined || selectedIndex === entries[0]?.index) &&
        completed?.stopped && <PromptDuration timing={completed} />}
      {entries
        .filter((entry) => selectedIndex === undefined || entry.index === selectedIndex)
        .map((entry) => {
          const { index, message } = entry;
          const position = entries.indexOf(entry);
          if (onlyToolCalls(entry)) {
            if (position > 0 && onlyToolCalls(entries[position - 1]!)) return null;
            const batch: TurnMessage[] = [];
            for (const candidate of entries.slice(position)) {
              if (!onlyToolCalls(candidate)) break;
              batch.push(candidate);
            }
            const calls = batch.flatMap(({ message }) =>
              message.role === "assistant"
                ? message.content.flatMap((part) =>
                    part.type === "toolCall"
                      ? [
                          tools[part.id] ?? {
                            id: part.id,
                            name: part.name,
                            args: part.arguments,
                            status: "waiting" as const,
                          },
                        ]
                      : [],
                  )
                : [],
            );
            return (
              <ToolGroup
                key={index + offset}
                tools={calls}
                generating={batch.some((item) => item.index === draftIndex)}
              />
            );
          }
          if (message.role === "toolResult")
            return tools[message.toolCallId] ? (
              <ToolCard key={index + offset} tool={tools[message.toolCallId]!} />
            ) : null;

          return (
            <AssistantMessage
              key={index + offset}
              message={message}
              timing={!completed?.stopped && entry === final ? completed : undefined}
              hideError={!!completed?.stopped}
              tools={tools}
              streaming={index === draftIndex || (running && entry === entries.at(-1))}
              generating={index === draftIndex}
              showFooter={entry === final}
            />
          );
        })}
      {(selectedIndex === undefined || selectedIndex === entries[lastVisible]?.index) &&
        completed &&
        !completed.stopped &&
        !final && <PromptDuration timing={completed} />}
    </>
  );
};

export const AssistantTurn = memo(AssistantTurnView, (previous, next) => {
  if (
    previous.selectedIndex !== next.selectedIndex ||
    previous.offset !== next.offset ||
    previous.running !== next.running ||
    previous.timing !== next.timing ||
    previous.messages.length !== next.messages.length
  )
    return false;
  return previous.messages.every(({ index, message }, position) => {
    if (
      index !== next.messages[position]?.index ||
      message !== next.messages[position]?.message ||
      (index === previous.draftIndex) !== (index === next.draftIndex)
    )
      return false;
    if (message.role === "toolResult")
      return previous.tools[message.toolCallId] === next.tools[message.toolCallId];
    return message.content.every(
      (part) => part.type !== "toolCall" || previous.tools[part.id] === next.tools[part.id],
    );
  });
});
