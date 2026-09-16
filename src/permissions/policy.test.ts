import { describe, expect, test } from "bun:test";
import { requiresApproval, validateCapabilities } from "./policy";
import type { Tool } from "../extensions/types";

const tool: Tool = {
  name: "write_file",
  description: "example",
  capabilities: ["write"],
  execute: async () => "ok",
};
describe("capability policy", () => {
  test("requires approval for write by default", () => expect(requiresApproval(tool)).toBe(true));
  test("allows explicitly approved capability", () =>
    expect(requiresApproval(tool, { allowed: ["write"] })).toBe(false));
  test("denies capabilities outside allow list", () =>
    expect(() => validateCapabilities(tool, { allowed: ["read"] })).toThrow());
});
