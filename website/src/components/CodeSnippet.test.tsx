import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { CodeSnippet } from "./CodeSnippet";

afterEach(cleanup);

it("renders highlighted source as selectable text without interpreting markup", () => {
  const source = 'const message = "<img src=x>";';
  const { container } = render(<CodeSnippet source={source} language="typescript" />);
  expect(container.querySelector("code")?.textContent).toBe(source);
  expect(container.querySelector(".keyword")?.textContent).toBe("const");
  expect(container.querySelector(".string")?.textContent).toBe('"<img src=x>"');
  expect(container.querySelector("img")).toBeNull();
});
