import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

import { DeviceStore } from "./device-store";
import { RemoteDevices } from "./remote-devices";
import { deviceLifetime } from "./device-credentials";

const origin = "https://example.test";

const requestPairing = (devices: RemoteDevices) => {
  const token = new URL(devices.invite().url).hash.slice(6);
  return devices.pairing.request(origin, token, "Example phone");
};

afterEach(() => vi.useRealTimers());

test("approval persists across restart, revocation ends active requests and expiry rejects access", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-devices-"));
  try {
    const store = new DeviceStore(join(root, "devices.json"));
    const devices = new RemoteDevices(store);
    await devices.load();
    expect(() => devices.invite()).toThrow();
    devices.connect(origin);
    const { credential, pending } = requestPairing(devices);
    expect(() => devices.authenticate(credential)).toThrow();
    await devices.decide(pending.id, true);
    const device = devices.authenticate(credential);
    expect(devices.status().devices).toEqual([device]);
    expect(devices.status().expiredDevices).toEqual([]);
    expect(JSON.stringify(devices.status())).not.toContain("credentialHash");
    const restarted = new RemoteDevices(store);
    await restarted.load();
    restarted.connect(origin);
    expect(restarted.authenticate(credential)).toEqual(device);
    expect(restarted.csrf(credential)).not.toBe(devices.csrf(credential));
    const abort = new AbortController();
    const release = restarted.track(device, abort);
    const invalidated: string[] = [];
    restarted.subscribeInvalidation(async (id) => {
      invalidated.push(id);
    });
    await restarted.revoke(device.id);
    expect(invalidated).toEqual([device.id]);
    expect(abort.signal.aborted).toBe(true);
    release();
    expect(() => restarted.authenticate(credential)).toThrow();
    expect(await store.read()).toEqual([]);
    vi.useFakeTimers();
    const expiring = new AbortController();
    const stop = devices.track(device, expiring);
    vi.advanceTimersByTime(deviceLifetime);
    expect(expiring.signal.aborted).toBe(true);
    expect(() => devices.authenticate(credential)).toThrow();
    expect(devices.status().devices).toEqual([]);
    expect(devices.status().expiredDevices).toEqual([device]);
    expect(JSON.stringify(devices.status())).not.toContain("credentialHash");
    await devices.revoke(device.id);
    expect(devices.status().expiredDevices).toEqual([]);
    stop();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("expired device metadata survives restart, can be removed and is pruned on new approval", async () => {
  const root = await mkdtemp(join(import.meta.dirname, ".remote-devices-"));
  try {
    const store = new DeviceStore(join(root, "devices.json"));
    const devices = new RemoteDevices(store);
    await devices.load();
    devices.connect(origin);
    const first = requestPairing(devices);
    await devices.decide(first.pending.id, true);
    const device = devices.authenticate(first.credential);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(device.expiresAt);
    const restarted = new RemoteDevices(store);
    await restarted.load();
    restarted.connect(origin);
    expect(restarted.status().devices).toEqual([]);
    expect(restarted.status().expiredDevices).toEqual([device]);
    expect(() => restarted.authenticate(first.credential)).toThrow();
    const next = requestPairing(restarted);
    await restarted.decide(next.pending.id, true);
    expect(restarted.status().devices).toHaveLength(1);
    expect(restarted.status().expiredDevices).toEqual([]);
    expect(await store.read()).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("storage failures cannot grant access, and disconnect clears pairing and all connections", async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  const save = vi.spyOn(store, "save").mockRejectedValue(new Error("synthetic failure"));
  const devices = new RemoteDevices(store);
  await devices.load();
  devices.connect(origin);
  const request = requestPairing(devices);
  await expect(devices.decide(request.pending.id, true)).rejects.toThrow();
  expect(() => devices.authenticate(request.credential)).toThrow();
  expect(request.pending.state).toBe("pending");
  save.mockResolvedValue();
  await devices.decide(request.pending.id, true);
  const aborts = Array.from({ length: 16 }, () => new AbortController());
  const device = devices.authenticate(request.credential);
  const releases = aborts.map((abort) => devices.track(device, abort));
  expect(() => devices.track(device, new AbortController())).toThrow();
  const pending = requestPairing(devices);
  devices.connect();
  expect(aborts.every((abort) => abort.signal.aborted)).toBe(true);
  expect(devices.pairing.find(pending.credential)).toBeUndefined();
  expect(() => devices.authenticate(request.credential)).toThrow();
  releases.forEach((release) => release());
});

test("serialized duplicate approvals cannot create duplicate devices", async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  vi.spyOn(store, "save").mockResolvedValue();
  const devices = new RemoteDevices(store);
  await devices.load();
  devices.connect(origin);
  const { pending } = requestPairing(devices);
  const result = await Promise.allSettled([
    devices.decide(pending.id, true),
    devices.decide(pending.id, true),
  ]);
  expect(result.map((item) => item.status)).toEqual(["fulfilled", "rejected"]);
  expect(devices.status().devices).toHaveLength(1);
});

test("failed revocation preserves access for retry and a save crossing disconnect stays manageable", async () => {
  const store = new DeviceStore("unused");
  vi.spyOn(store, "read").mockResolvedValue([]);
  const save = vi.spyOn(store, "save");
  let finish: (() => void) | undefined;
  save.mockImplementation(
    async () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const devices = new RemoteDevices(store);
  await devices.load();
  devices.connect(origin);
  const pairing = requestPairing(devices);
  const approval = devices.decide(pairing.pending.id, true);
  await vi.waitFor(() => expect(finish).toBeDefined());
  devices.connect();
  finish!();
  await approval;
  expect(devices.pairing.find(pairing.credential)).toBeUndefined();
  expect(devices.status().devices).toHaveLength(1);
  devices.connect(origin);
  const device = devices.authenticate(pairing.credential);
  const abort = new AbortController();
  const release = devices.track(device, abort);
  try {
    save.mockRejectedValueOnce(new Error("Synthetic write failure"));
    await expect(devices.revoke(device.id)).rejects.toThrow();
    expect(abort.signal.aborted).toBe(false);
    expect(devices.authenticate(pairing.credential)).toEqual(device);
    save.mockResolvedValue();
    await devices.revoke(device.id);
    expect(abort.signal.aborted).toBe(true);
  } finally {
    release();
  }
});

test("connection identity is stable for polling and changes on every reconnect", () => {
  const devices = new RemoteDevices(new DeviceStore("unused"));
  devices.connect(origin);
  const first = devices.status().connectionId;
  expect(first).toBeTruthy();
  expect(devices.status().connectionId).toBe(first);
  const invitation = devices.invite();
  expect(new URL(invitation.url).origin).toBe(origin);
  expect(new URL(invitation.url).hash).toMatch(/^#pair=.+/);
  devices.connect(origin);
  expect(devices.status().connectionId).not.toBe(first);
  devices.connect();
  expect(devices.status().connectionId).toBeUndefined();
});
