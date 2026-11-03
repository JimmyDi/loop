import { expect, it } from "vitest";

import { normalizeRoute } from "../content-routes";
import { blogLanguage, blogPath } from "./blog-location";

it("distinguishes explicit blog locales under deployment prefixes", () => {
  expect(blogLanguage("/loop/en/blog/post/")).toBe("en");
  expect(blogLanguage("/loop/blog/post/")).toBe("zh");
  expect(blogLanguage("/loop/docs/")).toBeUndefined();
  expect(normalizeRoute("/loop/en/blog/post/")).toBe("blog/post/");
  expect(blogPath("blog/post/", "en")).toBe("en/blog/post/");
});
