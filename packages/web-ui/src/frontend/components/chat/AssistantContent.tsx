import { lazy, Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

import type { Message, ToolView } from "../../../shared/protocol";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MarkdownText } from "./MarkdownText";
import { groupAssistantContent } from "./assistant-content";
import { ToolGroup } from "./ToolGroup";
import { splitOpenUiBlocks } from "./openui-blocks";

const OpenUiCard = lazy(() => import("./OpenUiCard"));

export const AssistantContent = ({
  message,
  tools,
  streaming = false,
  generating = false,
  hideError = false,
}: {
  message: Extract<Message, { role: "assistant" }>;
  tools: Record<string, ToolView>;
  streaming?: boolean;
  generating?: boolean;
  hideError?: boolean;
}) => (
  <>
    {groupAssistantContent(message.content).map((part, index, blocks) => {
      if (part.type === "text") {
        const canRenderOpenUi =
          generating || message.stopReason === "stop" || message.stopReason === "toolUse";
        return splitOpenUiBlocks(
          part.text,
          generating && index === blocks.length - 1,
          canRenderOpenUi,
        ).map((block) => {
          const key = part.key + ":" + block.offset;
          if (block.type === "markdown") {
            return <MarkdownText key={key} text={block.raw} streaming={streaming} />;
          }
          const fallback = <MarkdownText text={block.raw} streaming={streaming} />;
          return (
            <ErrorBoundary key={key} fallback={fallback} resetKeys={[block.response]}>
              <Suspense fallback={fallback}>
                <OpenUiCard
                  response={block.response}
                  streaming={block.streaming}
                  fallback={fallback}
                />
              </Suspense>
            </ErrorBoundary>
          );
        });
      }

      return (
        <ToolGroup
          key={part.key}
          generating={generating && index === blocks.length - 1}
          tools={part.calls.map(
            (call) =>
              tools[call.id] ?? {
                id: call.id,
                name: call.name,
                args: call.arguments,
                status: "waiting",
              },
          )}
        />
      );
    })}
    {!streaming && !hideError && <ErrorNotice error={message.errorMessage} />}
  </>
);
