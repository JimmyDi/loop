import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Window } from "happy-dom";

import "../../i18n/setup";
import { ApiError } from "../../lib/api";
import { ErrorNotice } from "./ErrorNotice";

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
