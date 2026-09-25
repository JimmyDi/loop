import { expect, test } from "bun:test";

import { parseArgs } from "./args";

test("parses print, session paths and literal prompt arguments without silently accepting options", () => {
  const result = parseArgs(["-p", "--session", "session.jsonl", "hello", "--", "--literal"]);

  expect(result.prompt).toBe("hello --literal");
  expect(result.flags.get("--session")).toBe("session.jsonl");
  expect(result.flags.has("--print")).toBe(true);
  expect(() => parseArgs(["--session"])).toThrow("Missing");
  expect(() => parseArgs(["--no-session", "-c"])).toThrow("Choose");
  expect(() => parseArgs(["--mode", "rpc"])).toThrow("Unsupported");
});
