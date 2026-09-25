import { expect, test } from "bun:test";

import { readBody, requiredString } from "./input";

test("JSON input is bounded and string fields retain prompt whitespace", async () => {
  const request = (text: string) =>
    new Request("http://localhost/", {
      method: "POST",
      body: text,
      headers: { "content-type": "application/json" },
    });

  expect(requiredString(await readBody(request('{"text":" hello "}')), "text")).toBe(" hello ");
  await expect(readBody(request("[]"))).rejects.toThrow("invalid_body");
  await expect(readBody(request("x".repeat(1_048_577)))).rejects.toThrow("body_too_large");
  expect(() => requiredString({ text: " " }, "text")).toThrow();
});
