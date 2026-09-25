import { expect, test } from "bun:test";

import { useRequests } from "./request-store";

test("unconfirmed request identity survives view switching until acknowledged", () => {
  const request = { requestId: "request", streamId: "stream", text: "hello" };

  useRequests.getState().put("session", request);
  expect(useRequests.getState().pending.session).toEqual(request);
  useRequests.getState().put("session");
  expect(useRequests.getState().pending.session).toBeUndefined();
});
