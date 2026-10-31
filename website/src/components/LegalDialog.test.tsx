import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { translations } from "../translations";
import { LegalDialog } from "./LegalDialog";

afterEach(cleanup);

it.each(["privacy", "terms"] as const)("opens the %s notice with accessible dismissal", (kind) => {
  const onClose = vi.fn();
  render(<LegalDialog kind={kind} onClose={onClose} />);
  const dialog = screen.getByRole("dialog", {
    name: translations.zh[kind === "privacy" ? "privacyPolicy" : "termsOfUse"],
  });
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(dialog.querySelectorAll("p")).toHaveLength(3);
  fireEvent.click(screen.getByRole("button", { name: "关闭" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(onClose).toHaveBeenCalledTimes(2);
});
