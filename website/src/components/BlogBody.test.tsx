import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import posts from "virtual:blog-content";

import { LanguageProvider } from "../i18n/LanguageProvider";
import { BlogBody } from "./BlogBody";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("copies the code associated with the selected block", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(
    <LanguageProvider initialLanguage="en">
      <BlogBody
        post={posts[0]}
        bodies={{
          en: "<pre><button data-copy-code>Copy code</button><code>const value = 42;</code></pre>",
        }}
      />
    </LanguageProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("const value = 42;"));
  expect(screen.getByRole("status").textContent).toBe("Code copied");
});

it("keeps static and fetched section IDs stable across rendering", () => {
  const { container } = render(
    <LanguageProvider initialLanguage="en">
      <BlogBody post={posts[0]} bodies={{ en: '<h2 id="en-section">Section</h2>' }} />
    </LanguageProvider>,
  );
  expect(container.querySelector('[data-blog-body="en"] h2')?.id).toBe("en-section");
  expect(container.querySelectorAll("#en-section")).toHaveLength(1);
});

it("opens an article image and returns focus to its control on close", () => {
  render(
    <LanguageProvider initialLanguage="en">
      <BlogBody
        post={posts[0]}
        bodies={{
          en: '<button type="button" data-enlarge-image aria-label="Enlarge diagram"><img src="/diagram.png" alt="Diagram"></button>',
        }}
      />
    </LanguageProvider>,
  );
  const opener = screen.getByRole("button", { name: "Enlarge diagram" });
  opener.focus();
  fireEvent.click(opener);
  const dialog = screen.getByRole("dialog");
  expect(dialog.hasAttribute("open")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Close image" }));
  expect(document.activeElement).toBe(opener);
});
