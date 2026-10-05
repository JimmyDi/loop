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
  expect(
    parseArgs(["--permission-preset", "workspace-write"]).flags.get("--permission-preset"),
  ).toBe("workspace-write");
  expect(() => parseArgs(["--permission-preset", "full"])).toThrow("Invalid permission preset");
  expect(() => parseArgs(["--permission-preset"])).toThrow("Missing");
});
