import { expect, test } from "bun:test";

import { parseArguments } from "./arguments";

test("startup flags preserve explicit port zero and reject invalid ports/options", () => {
  expect(parseArguments([])).toEqual({ port: 3080, open: true, help: false });
  expect(parseArguments(["--port", "0", "--no-open"])).toEqual({
    port: 0,
    open: false,
    help: false,
  });
  expect(parseArguments(["--help"]).help).toBe(true);

  for (const value of ["-1", "65536", "12.5", "", "word"]) {
    expect(() => parseArguments(["--port", value])).toThrow();
  }

  expect(() => parseArguments(["--host", "0.0.0.0"])).toThrow();
});
