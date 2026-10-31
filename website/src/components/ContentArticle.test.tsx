import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ContentArticle } from "./ContentArticle";
import { setPrerenderAssetBase } from "../assets";

afterEach(() => {
  cleanup();
  setPrerenderAssetBase("/");
});

test("fragment links stay on their document with a site base", () => {
  setPrerenderAssetBase("/loop/");
  const view = render(
    <ContentArticle html={'<a href="#usage">Usage</a>'} route="docs/web/voice/" />,
  );
  expect(view.getByRole("link").getAttribute("href")).toBe("/loop/docs/web/voice/#usage");
});

test("document links keep the site base", () => {
  setPrerenderAssetBase("/loop/");
  const view = render(<ContentArticle html={'<p><a href="docs/web/voice/">Voice</a></p>'} />);
  expect(view.getByRole("link").getAttribute("href")).toBe("/loop/docs/web/voice/");
});
