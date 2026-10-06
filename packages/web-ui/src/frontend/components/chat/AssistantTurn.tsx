import type { ToolView, PromptTiming } from "../../../shared/protocol";
import { assistantTextPhase } from "../../../shared/assistant-text-phase";
import { AssistantMessage } from "./AssistantMessage";
import { projectAssistantTurn } from "./timeline-turns";
import type { TurnMessage } from "./timeline-turns";
import { ToolCard } from "./ToolCard";
import { PromptDuration } from "./PromptDuration";

export const AssistantTurn = ({
  messages,
  tools,
  draftIndex,
  running,
  timing,
}: {
  messages: TurnMessage[];
  tools: Record<string, ToolView>;
  draftIndex?: number;
  running: boolean;
  timing?: PromptTiming;
}) => {
  const entries = projectAssistantTurn(messages);
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

  return (
    <>
      {entries.map((entry) => {
        const { index, message } = entry;
        if (message.role === "toolResult")
          return tools[message.toolCallId] ? (
            <ToolCard key={index} tool={tools[message.toolCallId]!} />
          ) : null;

        return (
          <AssistantMessage
            key={index}
            message={message}
            timing={entry === final ? completed : undefined}
            tools={tools}
            streaming={index === draftIndex || (running && entry === entries.at(-1))}
            generating={index === draftIndex}
            showFooter={entry === final}
          />
        );
      })}
      {completed && !final && <PromptDuration timing={completed} />}
    </>
  );
};
