import type { SessionEvent } from "../../core/types/session";

export class InteractiveOutput {
  private status?: string;
  private lineOpen = false;
  private streamed = new Map<number, string>();

  constructor(private readonly write: (text: string) => void) {}

  start(): void {
    this.finish();
    this.showStatus("Waiting for model… (/abort to cancel)");
  }

  handle(event: SessionEvent): void {
    if (event.type === "message_start" && event.message.role === "assistant") {
      this.streamed.clear();
      this.showStatus("Waiting for model… (/abort to cancel)");
    } else if (event.type === "message_update") {
      const update = event.assistantMessageEvent;

      if (update.type === "text_delta") {
        const previous = this.streamed.get(update.contentIndex) ?? "";

        this.streamed.set(update.contentIndex, previous + update.delta);
        this.writeText(update.delta);
      } else if (update.type === "thinking_start" || update.type === "thinking_delta") {
        this.showStatus("Thinking… (/abort to cancel)");
      } else if (update.type === "toolcall_start") {
        this.showStatus("Preparing tool call…");
      }
    } else if (event.type === "message_end" && event.message.role === "assistant") {
      // Some streams return complete text without deltas. Render only the missing suffix.
      for (const [index, part] of event.message.content.entries()) {
        if (part.type !== "text") continue;

        const previous = this.streamed.get(index) ?? "";

        if (part.text.startsWith(previous)) this.writeText(part.text.slice(previous.length));
      }

      this.endLine();
      this.streamed.clear();
    } else if (event.type === "tool_execution_start") {
      this.showStatus("Executing " + event.toolName + "… (/abort to cancel)");
    } else if (event.type === "tool_execution_end") {
      this.showStatus(event.toolName + (event.isError ? " failed" : " completed"));
    } else if (event.type === "agent_settled") {
      this.finish();
    }
  }

  finish(): void {
    this.endLine();
    this.status = undefined;
    this.streamed.clear();
  }

  private showStatus(status: string): void {
    if (this.status === status) return;

    this.endLine();
    this.write("[" + status + "]\n");
    this.status = status;
  }

  private writeText(text: string): void {
    if (!text) return;

    this.write(text);
    this.lineOpen = !text.endsWith("\n");
    this.status = undefined;
  }

  private endLine(): void {
    if (this.lineOpen) this.write("\n");

    this.lineOpen = false;
  }
}
