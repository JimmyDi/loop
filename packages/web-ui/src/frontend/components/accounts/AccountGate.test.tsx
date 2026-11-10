import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test } from "vitest";

import { AccountGate } from "./AccountGate";
import { i18n } from "../../i18n/setup";
import { useAccount } from "../../state/account-store";
import { setPreferenceUser } from "../../lib/preferences";

test("registration gates private UI and login activates the authenticated data space", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
    FormData: globalThis.FormData,
    localStorage: globalThis.localStorage,
  };
  Object.assign(globalThis, {
    window,
    document: window.document,
    FormData: window.FormData,
    localStorage: window.localStorage,
  });
  const { render, fireEvent, waitFor, cleanup } = await import("@testing-library/react/pure");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let authenticated = false;
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    username: "owner",
  };
  const calls: unknown[] = [];
  globalThis.fetch = (async (_url, init) => {
    if (init?.method === "POST") {
      authenticated = true;
      calls.push(JSON.parse(String(init.body)));
      return Response.json({ user });
    }
    return Response.json({ user: authenticated ? user : null });
  }) as typeof fetch;
  const language = i18n.language;
  try {
    await i18n.changeLanguage("en");
    const ui = render(
      <QueryClientProvider client={client}>
        <AccountGate>
          <p>Private workspace</p>
        </AccountGate>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(ui.getByRole("button", { name: "Create account" })).toBeTruthy());
    fireEvent.click(ui.getByRole("button", { name: "Create account" }));
    expect(ui.queryByText("Private workspace")).toBeNull();
    fireEvent.change(ui.getByLabelText("Username"), { target: { value: "owner" } });
    fireEvent.change(ui.getByLabelText("Password"), {
      target: { value: "synthetic-password" },
    });
    fireEvent.click(ui.getByRole("button", { name: "Show password" }));
    expect(ui.getByLabelText("Password").getAttribute("type")).toBe("text");
    fireEvent.click(ui.getByRole("button", { name: "Hide password" }));
    expect(ui.getByLabelText("Password").getAttribute("type")).toBe("password");
    fireEvent.submit(ui.container.querySelector("form")!);
    await waitFor(() => expect(ui.getByText("Private workspace")).toBeTruthy());
    expect(calls).toEqual([{ username: "owner", password: "synthetic-password" }]);
    expect(useAccount.getState().user?.id).toBe(user.id);
  } finally {
    cleanup();
    client.clear();
    useAccount.setState({ user: null });
    setPreferenceUser();
    await i18n.changeLanguage(language);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
