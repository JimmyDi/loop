import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { App } from "./App";

test("application starts with projects and a welcome screen", () => {
  const html = renderToStaticMarkup(<App />);

  expect(html).toContain("Projects");
  expect(html).toContain("What would you like to build?");
  expect(html).not.toContain("TracePanel");
});
