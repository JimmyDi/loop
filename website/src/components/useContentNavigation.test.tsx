import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { useContentNavigation } from "./useContentNavigation";

vi.mock("virtual:release-content", () => ({
  default: [
    {
      version: "1.0.0",
      pages: [
        { slug: "getting-started", html: "" },
        { slug: "web/voice", html: "" },
        { slug: "web/chat", html: "" },
      ],
    },
  ],
}));

const Harness = ({ route = "docs/" }: { route?: string }) => {
  const navigation = useContentNavigation(route);
  return (
    <div ref={navigation.ref} aria-busy={navigation.pending}>
      <a href="/docs/web/voice/">Voice</a>
      <a href="/docs/web/chat/">Chat</a>
      <a href="/changelog/1.0.0/">Read full release notes</a>
      <a href="/changelog/">All releases</a>
      <p>{navigation.route}</p>
      <div
        data-testid="article"
        dangerouslySetInnerHTML={{ __html: navigation.html || "Initial article" }}
      />
    </div>
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  history.replaceState(null, "", "/");
});

test("loads full release notes without clearing the list and returns without fetching an article", async () => {
  history.replaceState(null, "", "/changelog/");
  let complete: (response: Response) => void = () => {};
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = render(<Harness route="changelog/" />);
  const container = view.container.firstElementChild;
  fireEvent.click(screen.getByRole("link", { name: "Read full release notes" }));
  expect(screen.getByTestId("article").textContent).toBe("Initial article");
  await act(async () => complete(new Response("<div data-content-article>Release notes</div>")));
  expect(screen.getByTestId("article").textContent).toBe("Release notes");
  expect(location.pathname).toBe("/changelog/1.0.0/");
  fireEvent.click(screen.getByRole("link", { name: "All releases" }));
  await waitFor(() => expect(location.pathname).toBe("/changelog/"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(view.container.firstElementChild).toBe(container);
});

test("keeps the article and navigation mounted until static content arrives, and handles Back", async () => {
  history.replaceState(null, "", "/docs/");
  let complete: (response: Response) => void = () => {};
  const fetch = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetch);
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const view = render(<Harness />);
  const navigation = view.container.firstElementChild;
  fireEvent.click(screen.getByRole("link", { name: "Voice" }));
  expect(screen.getByTestId("article").textContent).toBe("Initial article");
  expect(location.pathname).toBe("/docs/");
  await act(async () =>
    complete(new Response("<div data-content-article><h1>Voice article</h1></div>")),
  );
  expect(screen.getByTestId("article").textContent).toBe("Voice article");
  expect(location.pathname).toBe("/docs/web/voice/");
  expect(view.container.firstElementChild).toBe(navigation);
  history.replaceState(null, "", "/docs/");
  act(() => window.dispatchEvent(new PopStateEvent("popstate")));
  await act(async () =>
    complete(new Response("<div data-content-article><h1>Start article</h1></div>")),
  );
  expect(screen.getByTestId("article").textContent).toBe("Start article");
});

test("ignores modified clicks and aborts superseded requests", async () => {
  history.replaceState(null, "", "/docs/");
  const pending: { resolve: (response: Response) => void; signal: AbortSignal }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options) =>
        new Promise<Response>((resolve) => {
          pending.push({ resolve, signal: options.signal });
        }),
    ),
  );
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  render(<Harness />);
  const modified = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
  let intercepted = true;
  const link = screen.getByRole("link", { name: "Voice" });
  link.parentElement!.addEventListener(
    "click",
    (event) => {
      intercepted = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  link.dispatchEvent(modified);
  expect(intercepted).toBe(false);
  expect(pending).toHaveLength(0);
  fireEvent.click(screen.getByRole("link", { name: "Voice" }));
  fireEvent.click(screen.getByRole("link", { name: "Chat" }));
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () =>
    pending[1].resolve(new Response("<div data-content-article>Chat article</div>")),
  );
  await act(async () =>
    pending[0].resolve(new Response("<div data-content-article>Stale article</div>")),
  );
  await waitFor(() => expect(screen.getByTestId("article").textContent).toBe("Chat article"));
});
