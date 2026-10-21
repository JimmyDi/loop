import { randomUUID } from "node:crypto";

import type { RemoteDevice, RemoteDevicesStatus } from "../../shared/remote-devices";
import { HttpError } from "../http/errors";
import {
  credentialHash,
  csrfCredential,
  deviceLifetime,
  newCredential,
} from "./device-credentials";
import type { DeviceRecord } from "./device-store";
import type { DeviceStore } from "./device-store";
import { PairingRequests } from "./pairing-requests";

const publicDevice = ({ id, name, createdAt, expiresAt }: DeviceRecord): RemoteDevice => ({
  id,
  name,
  createdAt,
  expiresAt,
});

export class RemoteDevices {
  readonly pairing = new PairingRequests();
  origin?: string;
  private devices: DeviceRecord[] = [];
  private tail: Promise<void> = Promise.resolve();
  private readonly csrfKey = newCredential();
  private readonly connections = new Map<string, Set<AbortController>>();

  constructor(private readonly store: DeviceStore) {}

  async load(): Promise<void> {
    this.devices = await this.store.read();
  }

  connect(origin?: string): void {
    this.origin = origin;
    this.pairing.clear();
    for (const group of this.connections.values()) for (const abort of group) abort.abort();
    this.connections.clear();
  }

  status(): RemoteDevicesStatus {
    return {
      connected: !!this.origin,
      devices: this.devices.filter((item) => item.expiresAt > Date.now()).map(publicDevice),
      pending: this.pairing.list(),
    };
  }

  invite() {
    if (!this.origin) throw new HttpError(409, "tunnel_not_connected");
    return this.pairing.issue(this.origin);
  }

  csrf(credential: string): string {
    return csrfCredential(this.csrfKey, credential);
  }

  authenticate(credential: string): RemoteDevice {
    if (!this.origin || !credential) throw new HttpError(401, "device_unauthorized");
    const hash = credentialHash(credential);
    const device = this.devices.find(
      (item) => item.credentialHash === hash && item.expiresAt > Date.now(),
    );
    if (!device) throw new HttpError(401, "device_unauthorized");
    return publicDevice(device);
  }

  decide(id: string, approve: boolean): Promise<void> {
    return this.serialize(async () => {
      const pending = this.pairing.get(id);
      if (!approve) {
        pending.state = "rejected";
        return;
      }
      const records = this.devices.filter((item) => item.expiresAt > Date.now());
      if (records.length >= 32) throw new HttpError(409, "device_limit");
      const next = [
        ...records,
        {
          id: randomUUID(),
          name: pending.name,
          credentialHash: pending.credentialHash,
          createdAt: Date.now(),
          expiresAt: Date.now() + deviceLifetime,
        },
      ];
      // Desktop approval remains durable if the tunnel disconnects during the disk write.
      await this.store.save(next);
      this.devices = next;
      pending.state = "approved";
    });
  }

  revoke(id: string): Promise<void> {
    return this.serialize(async () => {
      if (!this.devices.some((item) => item.id === id))
        throw new HttpError(404, "device_not_found");
      const next = this.devices.filter((item) => item.id !== id);
      await this.store.save(next);
      this.devices = next;
      for (const abort of this.connections.get(id) ?? []) abort.abort();
      this.connections.delete(id);
    });
  }

  track(device: RemoteDevice, abort: AbortController): () => void {
    const group = this.connections.get(device.id) ?? new Set<AbortController>();
    if (group.size >= 16) throw new HttpError(429, "device_connection_limit");
    group.add(abort);
    this.connections.set(device.id, group);
    const timer = setTimeout(() => abort.abort(), Math.max(0, device.expiresAt - Date.now()));
    timer.unref();
    return () => {
      clearTimeout(timer);
      group.delete(abort);
      if (!group.size && this.connections.get(device.id) === group)
        this.connections.delete(device.id);
    };
  }

  private serialize(action: () => Promise<void>): Promise<void> {
    const operation = this.tail.then(action);
    this.tail = operation.catch(() => {});
    return operation;
  }
}
