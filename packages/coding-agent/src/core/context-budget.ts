import type { Api, Context, Message, Model } from "@earendil-works/pi-ai";

/** Local estimates, not provider token counts. All values are in tokens. */
export type ContextBudget = {
  provider: string;
  model: string;
  contextWindow: number;
  systemTokens: number;
  messageTokens: number;
  toolTokens: number;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
  safetyTokens: number;
  inputLimit: number;
  remainingInputTokens: number;
  fits: boolean;
};

const MESSAGE_OVERHEAD = 16;
const IMAGE_TOKENS = 1200;

// ASCII averages four characters per token. Other Unicode characters receive a
// larger allowance, including CJK and supplementary-plane characters.
export const estimateTextTokens = (text: string): number => {
  let tokens = 0;
  for (const character of text) {
    tokens +=
      character.codePointAt(0)! <= 0x7f ? 0.25 : Math.ceil(Buffer.byteLength(character) / 2);
  }
  return Math.ceil(tokens);
};

const estimateMessageTokens = (message: Message): number => {
  let tokens = MESSAGE_OVERHEAD;
  if (typeof message.content === "string") return tokens + estimateTextTokens(message.content);

  if (message.role === "toolResult") {
    tokens += estimateTextTokens(message.toolName) + estimateTextTokens(message.toolCallId);
  }
  for (const block of message.content) {
    if (block.type === "image") {
      // Base64 byte length does not describe a model's image-token encoding.
      tokens += IMAGE_TOKENS;
    } else {
      // Includes call arguments and replayed text/thinking signatures; excludes
      // message timestamps, billing usage and local tool-result details.
      tokens += estimateTextTokens(JSON.stringify(block));
    }
  }
  return tokens;
};

export const measureContextBudget = (model: Model<Api>, context: Context): ContextBudget => {
  if (
    !Number.isSafeInteger(model.contextWindow) ||
    model.contextWindow <= 0 ||
    !Number.isSafeInteger(model.maxTokens) ||
    model.maxTokens <= 0
  )
    throw new Error("Model contextWindow and maxTokens must be positive integers");

  const systemTokens = context.systemPrompt ? estimateTextTokens(context.systemPrompt) + 16 : 0;
  const messageTokens = context.messages.reduce(
    (sum, message) => sum + estimateMessageTokens(message),
    0,
  );
  const toolTokens = context.tools?.length
    ? estimateTextTokens(JSON.stringify(context.tools)) + 16
    : 0;
  const estimatedInputTokens = systemTokens + messageTokens + toolTokens;
  // Reserve the full response ceiling, including thinking tokens. Native model
  // adapters can increase a smaller caller cap when reasoning is enabled.
  const reservedOutputTokens = model.maxTokens;
  const safetyTokens = Math.min(4096, Math.ceil(model.contextWindow * 0.05));
  const inputLimit = Math.max(0, model.contextWindow - reservedOutputTokens - safetyTokens);
  const remainingInputTokens =
    model.contextWindow - reservedOutputTokens - safetyTokens - estimatedInputTokens;
  return {
    provider: model.provider,
    model: model.id,
    contextWindow: model.contextWindow,
    systemTokens,
    messageTokens,
    toolTokens,
    estimatedInputTokens,
    reservedOutputTokens,
    safetyTokens,
    inputLimit,
    remainingInputTokens,
    fits: remainingInputTokens >= 0,
  };
};

export class ContextBudgetExceededError extends Error {
  readonly budget: ContextBudget;

  constructor(budget: ContextBudget) {
    super(
      "Context budget exceeded: estimated input " +
        budget.estimatedInputTokens +
        " tokens + reserved output " +
        budget.reservedOutputTokens +
        " + safety " +
        budget.safetyTokens +
        " exceeds context window " +
        budget.contextWindow +
        ". History is preserved. Select a model with a larger context window or start a new session with a shorter prompt.",
    );
    this.name = "ContextBudgetExceededError";
    this.budget = structuredClone(budget);
  }
}
