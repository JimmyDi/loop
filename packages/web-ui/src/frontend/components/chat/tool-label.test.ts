import { expect, test } from "vitest";

import { i18n } from "../../i18n/setup";
import { toolLabel } from "./tool-label";

test("tool labels keep streamed targets literal and distinguish execution from success", () => {
  const t = i18n.getFixedT("en");
  expect(
    toolLabel({ id: "a", name: "bash", status: "running", args: { command: "pnpm test" } }, t),
  ).toMatchObject({ action: "bash", text: "Running pnpm test" });
  expect(
    toolLabel({ id: "a", name: "bash", status: "success", args: { command: "pnpm test" } }, t).text,
  ).toBe("Ran pnpm test");
  expect(
    toolLabel(
      {
        id: "a",
        name: "bash",
        status: "error",
        args: { command: "pnpm test", description: "Ignore this" },
      },
      t,
    ).text,
  ).toBe("Run pnpm test");
  expect(toolLabel({ id: "b", name: "read", status: "waiting", args: { path: {} } }, t).text).toBe(
    "Read file",
  );
  expect(toolLabel({ id: "c", name: "search", status: "running" }, t)).toMatchObject({
    action: "other",
    text: "Using tool search",
  });
  expect(
    toolLabel(
      { id: "d", name: "edit", status: "success", args: { path: "src/app.ts" } },
      i18n.getFixedT("zh"),
    ).text,
  ).toBe("已编辑 src/app.ts");
});
