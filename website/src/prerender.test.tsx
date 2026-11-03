import { expect, it } from "vitest";

import { render } from "./prerender";

it.each(["./", "/loop/"])("renders complete static content with asset base %s", (base) => {
  const html = render(base);
  expect(html).toContain("npx @loop-harness/loop web");
  expect(html).toContain("35 个 provider");
  expect(html).toContain("从想法，");
  expect(html).toContain('id="main"');
  expect(html).toContain('aria-live="polite"');
  expect(html).not.toContain("undefined");
  expect(html).toContain('src="' + base + 'brand/loop-mark-dark.svg"');
  expect(html).toContain('srcSet="' + base + 'brand/loop-mark-white.svg"');
  expect(html).toContain('media="(prefers-color-scheme: dark)"');
});

it("renders both complete blog translations without depending on client article bodies", () => {
  const html = render("/loop/", "en", "blog/a-clear-agent-loop/");
  expect(html).toContain("Start with one complete interaction");
  expect(html).toContain("从一次完整的交互开始");
  expect(html).toContain('id="en-start-with-one-complete-interaction"');
  expect(html).toContain('href="/loop/en/blog/"');
  expect(render("/", "en", "blog/missing/")).toContain("Article not found");
});
