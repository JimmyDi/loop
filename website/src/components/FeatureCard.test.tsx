import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FeatureCard } from "./FeatureCard";

afterEach(cleanup);

it("accepts independent content and an illustrative child", () => {
  render(
    <FeatureCard title="Queue" description="Pause and resume.">
      <span>Preview</span>
    </FeatureCard>,
  );
  expect(screen.getByRole("heading", { name: "Queue", level: 3 })).toBeTruthy();
  expect(screen.getByText("Pause and resume.")).toBeTruthy();
  expect(screen.getByText("Preview")).toBeTruthy();
});
