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
