import { expect, test } from "vitest";

import { validateMcpConfig } from "./validate-config";

const http = {
  id: "example",
  name: "Example",
  enabled: false,
  transport: "http",
  url: "https://example.com/mcp",
  bearerTokenEnv: "",
  headers: [],
  envHeaders: [],
};

test("configuration validates transports, headers and environment references without exposing inputs", () => {
  expect(validateMcpConfig(http)).toEqual(http);
  for (const input of [
    null,
    { ...http, enabled: "true" },
    { ...http, url: "file:///tmp/example" },
    { ...http, url: "https://synthetic:synthetic@example.com" },
    { ...http, headers: [{ key: "X-Test", value: "a\r\nb" }] },
    { ...http, bearerTokenEnv: "invalid-name" },
    {
      ...http,
      headers: [{ key: "X-Test", value: "a" }],
      envHeaders: [{ key: "x-test", value: "EXAMPLE" }],
    },
    { ...http, bearerTokenEnv: "EXAMPLE", headers: [{ key: "authorization", value: "a" }] },
  ]) {
    expect(() => validateMcpConfig(input)).toThrow("invalid_mcp_config");
  }
  const stdio = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "stdio",
    command: "node",
    args: ["--version"],
    cwd: "",
    env: [],
    envVars: ["EXAMPLE"],
  };
  expect(validateMcpConfig(stdio)).toEqual(stdio);
  expect(() => validateMcpConfig({ ...stdio, cwd: "relative" })).toThrow();
  expect(() => validateMcpConfig({ ...stdio, envVars: ["EXAMPLE", "EXAMPLE"] })).toThrow();
});

test("legacy server permission fields are ignored and omitted from normalized configuration", () => {
  expect(
    validateMcpConfig({
      ...http,
      approvalMode: "allow",
      toolPolicies: { read_file: "disabled" },
    }),
  ).toEqual(http);
});
