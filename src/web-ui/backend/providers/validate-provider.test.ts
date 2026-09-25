import { expect, test } from "bun:test";

import { validateProvider } from "./validate-provider";

const input = {
  name: "Gateway",
  baseUrl: "http://localhost:8080/v1/",
  modelId: "gpt-5.5",
  authentication: "none",
};

test("custom provider normalizes base URLs and rejects invalid endpoints without exposing secrets", () => {
  expect(validateProvider(input).baseUrl).toBe("http://localhost:8080/v1");

  for (const baseUrl of [
    "file:///tmp",
    "not a url",
    "http://user:secret@localhost/v1",
    "https://example.test/v1?key=secret",
    "http://localhost/v1/chat/completions",
  ]) {
    expect(() => validateProvider({ ...input, baseUrl })).toThrow("invalid_provider_url");
  }

  expect(() => validateProvider({ ...input, name: " " })).toThrow("invalid_provider");
  expect(() => validateProvider({ ...input, authentication: "oauth" })).toThrow("invalid_provider");
  expect(() => validateProvider({ ...input, apiKey: 42 })).toThrow("invalid_provider");
});
