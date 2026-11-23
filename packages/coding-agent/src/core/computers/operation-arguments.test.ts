import { expect, test } from "vitest";

import { computerOperationArguments } from "./operation-arguments";

test("desktop key actions use the sandbox keypress contract and require a screenshot", () => {
  expect(
    computerOperationArguments("desktop", {
      action: "key",
      key: " ",
      screenshot_id: "fresh",
    }),
  ).toEqual({ action: "keypress", key: "space", screenshot_id: "fresh" });
  expect(
    computerOperationArguments("desktop", {
      action: "key",
      key: "Space",
      screenshot_id: "fresh",
    }),
  ).toEqual({ action: "keypress", key: "space", screenshot_id: "fresh" });
  expect(
    computerOperationArguments("desktop", {
      action: "keypress",
      key: "Return",
      screenshot_id: "fresh",
    }),
  ).toEqual({ action: "keypress", key: "Return", screenshot_id: "fresh" });
  expect(() => computerOperationArguments("desktop", { action: "key", key: "space" })).toThrow(
    "fresh desktop screenshot",
  );
  expect(() =>
    computerOperationArguments("desktop", {
      action: "keypress",
      key: "bad key",
      screenshot_id: "fresh",
    }),
  ).toThrow("X11 key name");
  expect(() =>
    computerOperationArguments("desktop", {
      action: "keypress",
      key: "space",
      screenshot_id: "fresh",
      code: "Space",
    }),
  ).toThrow("unsupported field");
});

test("unsupported browser keyboard actions fail before dispatch", () => {
  for (const action of ["press", "type", "evaluate", "reload"])
    expect(() => computerOperationArguments("browser", { action, key: "space" })).toThrow(
      "Unsupported browser action",
    );
  expect(
    computerOperationArguments("browser", { action: "fill", selector: "input", text: "x" }),
  ).toEqual({ action: "fill", selector: "input", text: "x" });
  expect(() =>
    computerOperationArguments("browser", { action: "fill", selector: "input", key: "a" }),
  ).toThrow("accepts only");
});
