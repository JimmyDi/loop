import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import { feedbackIssueUrl } from "./feedback-issue";

test("Feedback opens a blank repository issue without prefilled content", () => {
  const url = new URL(feedbackIssueUrl);
  const packageJson = JSON.parse(
    readFileSync(new URL("../../../../../package.json", import.meta.url), "utf8"),
  );
  const repository = packageJson.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

  expect(url.origin + url.pathname).toBe(repository + "/issues/new");
  expect([...url.searchParams.entries()]).toEqual([["template", "blank"]]);
});
