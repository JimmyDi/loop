import { afterEach, expect, test, vi } from "vitest";

import { PairingRequests } from "./pairing-requests";
import { credentialHash } from "./device-credentials";

const origin = "https://example.test";

const token = (url: string) => new URLSearchParams(new URL(url).hash.slice(1)).get("pair")!;

afterEach(() => vi.useRealTimers());

test("invitations are single use, origin bound, replaceable and separate from device credentials", () => {
  const pairing = new PairingRequests();
  const old = pairing.issue(origin);
  const invite = pairing.issue(origin);
  expect(() => pairing.request(origin, token(old.url), "Phone")).toThrow();
  expect(() => pairing.request("https://other.test", token(invite.url), "Phone")).toThrow();
  expect(() => pairing.request(origin, token(invite.url), "\nPhone")).toThrow();
  const { credential, pending } = pairing.request(origin, token(invite.url), " Phone ");
  expect(credential).not.toBe(token(invite.url));
  expect(pending.credentialHash).toBe(credentialHash(credential));
  expect(pending.confirmation).toMatch(/^\d{6}$/);
  expect(pairing.find(credential)).toBe(pending);
  expect(pairing.find(token(invite.url))).toBeUndefined();
  expect(pairing.list()).toEqual([
    {
      id: pending.id,
      name: "Phone",
      confirmation: pending.confirmation,
      expiresAt: pending.expiresAt,
    },
  ]);
  expect(() => pairing.request(origin, token(invite.url), "Replay")).toThrow();
  pending.state = "rejected";
  expect(pairing.list()).toEqual([]);
  expect(() => pairing.get(pending.id)).toThrow();
  pairing.clear();
  expect(pairing.find(credential)).toBeUndefined();
});

test("invitations and pending requests expire after five minutes and pending memory is bounded", () => {
  vi.useFakeTimers();
  const pairing = new PairingRequests();
  const invite = pairing.issue(origin);
  vi.advanceTimersByTime(300_000);
  expect(() => pairing.request(origin, token(invite.url), "Phone")).toThrow();
  for (let i = 0; i < 16; i++) {
    pairing.request(origin, token(pairing.issue(origin).url), "Phone");
  }
  expect(() => pairing.request(origin, token(pairing.issue(origin).url), "Phone")).toThrow();
  vi.advanceTimersByTime(300_000);
  expect(pairing.list()).toEqual([]);
});
