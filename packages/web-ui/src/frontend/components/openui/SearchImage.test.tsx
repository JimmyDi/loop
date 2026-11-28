// @vitest-environment happy-dom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import "../../i18n/setup";
import SearchImage from "./SearchImage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("fetches image previews only after a click and filters untrusted domains", async () => {
  const fetchImages = vi.fn(async () =>
    Response.json({
      query: {
        pages: [
          {
            title: "File:Blue fabric",
            imageinfo: [
              {
                thumburl: "https://upload.wikimedia.org/blue.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Blue_fabric",
              },
            ],
          },
          {
            title: "File:Stone garden",
            imageinfo: [
              {
                thumburl: "https://thumb.wikimedia.org/stone.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Stone_garden",
              },
            ],
          },
          {
            title: "File:Other",
            imageinfo: [
              {
                thumburl: "https://example.com/other.jpg",
                descriptionurl: "https://commons.wikimedia.org/wiki/File:Other",
              },
            ],
          },
        ],
      },
    }),
  );
  vi.stubGlobal("fetch", fetchImages);
  const ui = render(<SearchImage title="Fabric" query="blue fabric" />);
  expect(fetchImages).not.toHaveBeenCalled();
  fireEvent.click(ui.getByRole("button"));
  const source = await ui.findByRole("link", { name: "Blue fabric" });
  expect(source.getAttribute("href")).toBe("https://commons.wikimedia.org/wiki/File:Blue_fabric");
  const stone = ui.getByRole("link", { name: "Stone garden" });
  expect(stone.querySelector("img")?.getAttribute("src")).toBe(
    "https://thumb.wikimedia.org/stone.jpg",
  );
  expect(ui.queryByText("Other")).toBeNull();
});
