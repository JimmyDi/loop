import type { CodemodeResult } from "@earendil-works/pi-codemode";
import type { AgentTool } from "@loop/agent";

import { estimateTextTokens } from "../context-budget";

const MAX_TEXT_BYTES = 20 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** Keep partial output and explicit failures; nested results stay inside the script. */
export const renderCodemodeOutput = (
  result: CodemodeResult,
  maxOutputTokens = 5000,
): Awaited<ReturnType<AgentTool["execute"]>> => {
  maxOutputTokens = Math.min(5000, maxOutputTokens);
  const texts: string[] = [result.ok ? "Script completed." : "Script failed."];
  const images: Awaited<ReturnType<AgentTool["execute"]>> = [];
  let imageBytes = 0;
  for (const item of result.output) {
    if (item.type === "text") {
      texts.push(item.text);
    } else {
      imageBytes += Buffer.byteLength(item.data, "base64");
      if (imageBytes <= MAX_IMAGE_BYTES) images.push(item);
    }
  }
  if (result.ok && result.value !== undefined) {
    texts.push(typeof result.value === "string" ? result.value : JSON.stringify(result.value));
  }
  if (imageBytes > MAX_IMAGE_BYTES)
    texts.push("Some images omitted because the image output limit was exceeded.");
  let text = texts.join("\n");
  if (Buffer.byteLength(text) > MAX_TEXT_BYTES || estimateTextTokens(text) > maxOutputTokens) {
    let bytes = 0;
    let tokens = 0;
    let retained = "";
    for (const character of text) {
      bytes += Buffer.byteLength(character);
      tokens +=
        character.codePointAt(0)! <= 0x7f ? 0.25 : Math.ceil(Buffer.byteLength(character) / 2);
      if (bytes > MAX_TEXT_BYTES - 512 || tokens > Math.max(0, maxOutputTokens - 32)) break;
      retained += character;
    }
    text = retained + "\n[Output truncated; emit a smaller summary or selected fields.]";
  }
  const content: Awaited<ReturnType<AgentTool["execute"]>> = [{ type: "text", text }, ...images];
  if (!result.ok) {
    content.push({
      type: "text",
      text:
        "Script error (" +
        result.error.kind +
        "): " +
        result.error.message.slice(0, 1000) +
        "\nCompleted or dispatched tool calls are not rolled back. No automatic retry was performed.",
    });
  }
  if (result.calls.length) {
    content.push({
      type: "text",
      text:
        "Nested calls: " +
        result.calls
          .slice(0, 64)
          .map((call) => call.name + " (" + call.status + ")")
          .join(", ") +
        (result.calls.length > 64 ? "; additional calls omitted." : ""),
    });
  }
  return content;
};
