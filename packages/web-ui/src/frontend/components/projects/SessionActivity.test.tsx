import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { SessionActivity } from "./SessionActivity";
import type { SessionSummary } from "../../../shared/protocol";
import "../../i18n/setup";

test("waiting suppresses running indicators", () => {
  expect(
    renderToStaticMarkup(
      <SessionActivity session={{ id: "s" } as SessionSummary} waiting generating />,
    ),
  ).toBe("");
});
