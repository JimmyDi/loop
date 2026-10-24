import { Window } from "happy-dom";
import { afterEach, expect, test, vi } from "vitest";

import { capturePairingInvitation, clearPairingInvitation } from "./pairing-invitation";

const previous = globalThis.window;
let page: Window;

afterEach(async () => {
  vi.restoreAllMocks();
  Object.assign(globalThis, { window: previous });
  await page.happyDOM.close();
});

const setup = () => {
  page = new Window({ url: "https://example.test/?theme=dark#pair=synthetic-invite" });
  Object.assign(globalThis, { window: page });
};

test("unsubmitted invitations survive same-tab refresh and clear after submission", () => {
  setup();
  expect(capturePairingInvitation()).toBe("synthetic-invite");
  expect(page.location.href).toBe("https://example.test/?theme=dark");
  expect(capturePairingInvitation()).toBe("synthetic-invite");
  clearPairingInvitation();
  expect(capturePairingInvitation()).toBe("");
});

test("restoring an invitation does not extend its five-minute deadline", () => {
  setup();
  const now = vi.spyOn(Date, "now").mockReturnValue(1000);
  capturePairingInvitation();
  now.mockReturnValue(300_999);
  expect(capturePairingInvitation()).toBe("synthetic-invite");
  now.mockReturnValue(301_000);
  expect(capturePairingInvitation()).toBe("");
  expect(page.sessionStorage.length).toBe(0);
});

test("a fresh scan replaces the saved invitation and another origin cannot restore it", () => {
  setup();
  capturePairingInvitation();
  page.location.hash = "pair=synthetic-replacement";
  expect(capturePairingInvitation()).toBe("synthetic-replacement");
  expect(capturePairingInvitation()).toBe("synthetic-replacement");
  page.location.href = "https://other.test/";
  expect(capturePairingInvitation()).toBe("");
});

test("unavailable session storage still permits the initial scan", () => {
  setup();
  vi.spyOn(page, "sessionStorage", "get").mockImplementation(() => {
    throw new Error("Synthetic storage failure");
  });
  expect(capturePairingInvitation()).toBe("synthetic-invite");
  expect(page.location.hash).toBe("");
  expect(capturePairingInvitation()).toBe("");
});

test.each(["invalid-json", '{"token":"synthetic","expiresAt":"never"}'])(
  "invalid saved invitations are removed: %s",
  (value) => {
    setup();
    page.location.hash = "";
    page.sessionStorage.setItem("loop.pending-pairing", value);
    expect(capturePairingInvitation()).toBe("");
    expect(page.sessionStorage.length).toBe(0);
  },
);
