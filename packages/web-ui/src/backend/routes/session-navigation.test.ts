import { expect, test, vi } from "vitest";

import { navigationRoute } from "./session-navigation";
import type { SessionController } from "../session-controller";
import { allowsRemoteBusiness } from "../remote-access/remote-policy";

test("navigation reads summaries, persists bookmark states and rejects invalid writes", async () => {
  const messages = [{ role: "user", content: "Request", timestamp: 0 }];
  const setBookmark = vi.fn(async () => [0]);
  const controller = {
    snapshot: { streamId: "stream", state: { messages } },
    session: { sessionManager: { messages, setBookmark, getHeader: () => ({ bookmarks: [0] }) } },
  } as unknown as SessionController;
  const request = (body: unknown) =>
    new Request("http://localhost/api/sessions/test/navigation", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  expect(
    await (
      await navigationRoute(
        new Request("http://localhost/api/sessions/test/navigation"),
        controller,
      )
    ).json(),
  ).toEqual({ previews: [{ index: 0, user: "Request", reply: "" }], bookmarks: [0] });
  expect(
    await (
      await navigationRoute(
        request({ streamId: "stream", messageIndex: 0, bookmarked: true }),
        controller,
      )
    ).json(),
  ).toEqual({ bookmarks: [0] });
  expect(setBookmark).toHaveBeenCalledWith(0, true);
  for (const index of [-1, 0.5, 1, "0"])
    await expect(
      navigationRoute(
        request({ streamId: "stream", messageIndex: index, bookmarked: true }),
        controller,
      ),
    ).rejects.toThrow("invalid_bookmark");
  await expect(
    navigationRoute(request({ streamId: "old", messageIndex: 0, bookmarked: true }), controller),
  ).rejects.toThrow("history_changed");
  expect(allowsRemoteBusiness("/api/sessions/test/navigation", "GET")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/test/navigation", "PUT")).toBe(true);
  expect(allowsRemoteBusiness("/api/sessions/test/navigation", "POST")).toBe(false);
});
