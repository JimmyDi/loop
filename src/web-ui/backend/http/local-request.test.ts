import { expect, test } from "bun:test";

import { assertLocalRequest } from "./local-request";

test("local API rejects foreign origins and rebinding hosts", () => {
  expect(() => assertLocalRequest(new Request("http://127.0.0.1:3080/api"))).not.toThrow();
  expect(() => assertLocalRequest(new Request("http://example.test/api"))).toThrow("invalid_host");
  expect(() =>
    assertLocalRequest(
      new Request("http://127.0.0.1:3080/api", { headers: { origin: "https://example.test" } }),
    ),
  ).toThrow("invalid_origin");
});
