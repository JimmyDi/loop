import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ApiError } from "../../lib/api";
import { ErrorNotice } from "./ErrorNotice";
import { i18n } from "../../i18n/setup";

test("ErrorNotice exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ErrorNotice error={new Error("Disk full")} />
    </QueryClientProvider>,
  );

  expect(html).toContain('role="alert"');
  expect(html).toContain("Disk full");
  expect(html).not.toContain("<button");
  client.clear();
});

test("short-context notices localize both HTTP failures and settled session state", async () => {
  const language = i18n.language;
  try {
    await i18n.changeLanguage("zh");
    for (const error of [
      new ApiError("nothing_to_compact", "Nothing to compact", 400),
      "Nothing to compact",
    ]) {
      const html = renderToStaticMarkup(<ErrorNotice error={error} />);
      expect(html).toContain("暂无需要压缩的内容。");
      expect(html).toContain('role="status"');
      expect(html).not.toContain("<strong>");
    }
  } finally {
    await i18n.changeLanguage(language);
  }
});

test("generic API failures retain server details while known errors stay translated", () => {
  const detailed = renderToStaticMarkup(
    <ErrorNotice
      error={new ApiError("operation_failed", "Unsupported session format or version", 500)}
    />,
  );
  expect(detailed).toContain("Unsupported session format or version");
  expect(detailed).not.toContain("Operation failed.");
  const known = renderToStaticMarkup(
    <ErrorNotice error={new ApiError("session_not_found", "session_not_found", 404)} />,
  );
  expect(known).toContain("Conversation not found.");
  const fallback = renderToStaticMarkup(
    <ErrorNotice error={new ApiError("operation_failed", "", 500)} />,
  );
  expect(fallback).toContain("Operation failed.");
});

test("closing an error hides that occurrence while repeated failures remain visible", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  const error = new ApiError("invalid_text_encoding", "", 400);
  try {
    const ui = render(<ErrorNotice error={error} dismissible />);
    expect(ui.getByRole("alert").textContent).toContain("UTF-8");
    expect((ui.getByRole("button", { name: "Close" }) as HTMLButtonElement).type).toBe("button");
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    expect(ui.queryByRole("alert")).toBeNull();
    ui.rerender(<ErrorNotice error={error} dismissible />);
    expect(ui.queryByRole("alert")).toBeNull();
    ui.rerender(<ErrorNotice error={new ApiError("invalid_text_encoding", "", 400)} dismissible />);
    expect(ui.getByRole("alert").textContent).toContain("UTF-8");
    fireEvent.click(ui.getByRole("button", { name: "Close" }));
    ui.rerender(<ErrorNotice dismissible />);
    ui.rerender(<ErrorNotice error={error} dismissible />);
    expect(ui.getByRole("alert")).toBeTruthy();
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("no-work notices expire once and do not reappear on ordinary rerenders", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { vi } = await import("vitest");
  let expire = () => {};
  const timer = vi.spyOn(window, "setTimeout").mockImplementation(((callback: () => void) => {
    expire = callback;
    return 1;
  }) as unknown as typeof window.setTimeout);
  const clear = vi.spyOn(window, "clearTimeout");
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const error = new ApiError("nothing_to_compact", "Nothing to compact", 400);
  try {
    const view = render(<ErrorNotice error={error} dismissible />);
    expect(view.getByRole("status")).toBeTruthy();
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 5000);
    act(() => expire());
    expect(view.queryByRole("status")).toBeNull();
    view.rerender(<ErrorNotice error={error} dismissible />);
    expect(view.queryByRole("status")).toBeNull();
    view.rerender(<ErrorNotice error={new ApiError("nothing_to_compact", "", 400)} dismissible />);
    expect(view.getByRole("status")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Close" }));
    expect(view.queryByRole("status")).toBeNull();
    view.rerender(<ErrorNotice error={new Error("Disk full")} dismissible />);
    expect(clear).toHaveBeenCalledWith(1);
    act(() => expire());
    expect(view.getByRole("alert")).toBeTruthy();
  } finally {
    cleanup();
    timer.mockRestore();
    clear.mockRestore();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
