import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

import { feedbackIssueUrl } from "./feedback-issue";

test("Feedback opens a new repository issue with a static report template", () => {
  const url = new URL(feedbackIssueUrl);
  const report = readFileSync(
    new URL("../../../../../.github/ISSUE_TEMPLATE/bug_report.md", import.meta.url),
    "utf8",
  );
  const packageJson = JSON.parse(
    readFileSync(new URL("../../../../../package.json", import.meta.url), "utf8"),
  );
  const repository = packageJson.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");

  expect(url.origin + url.pathname).toBe(repository + "/issues/new");
  expect(url.searchParams.get("template")).toBe("bug_report.md");
  expect(url.searchParams.get("title")).toBe("[Bug]: ");
  expect([...url.searchParams.keys()]).toEqual(["template", "title", "body"]);
  expect(url.searchParams.get("body")).toBe(report.replace(/^---\n[\s\S]*?\n---\n\n/, ""));
  for (const heading of [
    "Problem",
    "Steps to reproduce",
    "Expected behavior",
    "Actual behavior",
    "Environment",
    "Additional context",
  ]) {
    expect(url.searchParams.get("body")).toContain("## " + heading);
  }
});
