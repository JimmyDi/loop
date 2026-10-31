import type { TranslationKey } from "../translations";

export type InterfaceOption = {
  id: "web" | "cli" | "sdk";
  name: string;
  comment: TranslationKey;
  command: string;
  docs?: { href: string; label: TranslationKey };
};

export const interfaceOptions: readonly InterfaceOption[] = [
  {
    id: "web",
    name: "Web",
    comment: "webComment",
    command: "npx @loop-harness/loop web",
  },
  {
    id: "cli",
    name: "CLI",
    comment: "cliComment",
    command: [
      'export LOOP_AI_API_KEY="your-deepseek-api-key"',
      "npx @loop-harness/loop --provider deepseek --model deepseek-v4-pro",
    ].join("\n"),
    docs: {
      href: "https://github.com/JimmyDi/loop/blob/main/packages/coding-agent/src/docs/cli.md",
      label: "cliDocs",
    },
  },
  {
    id: "sdk",
    name: "SDK",
    comment: "sdkComment",
    command: [
      "import {",
      "  createAgentSession, createModelRuntime,",
      "  messageText, SessionManager,",
      '} from "@loop-harness/loop";',
      "",
      "const modelRuntime = createModelRuntime({",
      '  provider: "deepseek",',
      '  modelId: "deepseek-v4-pro",',
      "  apiKey: process.env.DEEPSEEK_API_KEY,",
      "});",
      'const model = modelRuntime.getModel("deepseek", "deepseek-v4-pro");',
      'if (!model) throw new Error("Model not found");',
      "",
      "const { session } = await createAgentSession({",
      "  modelRuntime, model,",
      "  sessionManager: SessionManager.inMemory(),",
      "  tools: [],",
      "});",
      "try {",
      '  await session.prompt("Hello!");',
      "  console.log(messageText(session.state.messages.at(-1)));",
      "} finally {",
      "  await session.abort();",
      "  session.dispose();",
      "}",
    ].join("\n"),
    docs: {
      href: "https://github.com/JimmyDi/loop/blob/main/packages/coding-agent/src/docs/sdk.md",
      label: "sdkDocs",
    },
  },
];
