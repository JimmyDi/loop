import { expect, it } from "vitest";

import { tokenizeCode } from "./code-tokens";

it("preserves shell whitespace and quoted values while recognizing commands and options", () => {
  const source = '# Start CLI\nexport LOOP_AI_API_KEY="placeholder"\nnpx loop --provider deepseek';
  const tokens = tokenizeCode(source, "bash");
  expect(tokens.map((token) => token.text).join("")).toBe(source);
  expect(tokens.find((token) => token.text === "npx")?.kind).toBe("function");
  expect(tokens.find((token) => token.text === "--provider")?.kind).toBe("property");
  expect(tokens.find((token) => token.text === "LOOP_AI_API_KEY")?.kind).toBe("type");
  expect(tokens.find((token) => token.text === '"placeholder"')?.kind).toBe("string");
});

it("keeps keyword-like strings intact and distinguishes TypeScript calls, types and numbers", () => {
  const source =
    '// Sample\nconst result = await SessionManager.inMemory();\nconsole.log("await <tag>", 1);';
  const tokens = tokenizeCode(source, "typescript");
  expect(tokens.map((token) => token.text).join("")).toBe(source);
  expect(tokens.find((token) => token.text === "await")?.kind).toBe("keyword");
  expect(tokens.find((token) => token.text === "SessionManager")?.kind).toBe("type");
  expect(tokens.find((token) => token.text === "inMemory")?.kind).toBe("function");
  expect(tokens.find((token) => token.text === '"await <tag>"')?.kind).toBe("string");
  expect(tokens.find((token) => token.text === "1")?.kind).toBe("number");
});
