import { randomInt, randomUUID } from "node:crypto";

import type { PairingRequest, PairingStatus } from "../../shared/remote-devices";
import { HttpError } from "../http/errors";
import { credentialHash, newCredential } from "./device-credentials";

export type PendingDevice = PairingRequest & {
  credentialHash: string;
  state: PairingStatus["state"];
};

export class PairingRequests {
  private invite?: { hash: string; origin: string; expiresAt: number };
  private pending = new Map<string, PendingDevice>();

  clear(): void {
    this.invite = undefined;
    this.pending.clear();
  }

  issue(origin: string) {
    const token = newCredential();
    const expiresAt = Date.now() + 5 * 60_000;
    this.invite = { hash: credentialHash(token), origin, expiresAt };
    return { url: origin + "/#pair=" + token, expiresAt };
  }

  request(origin: string, token: string, name: string) {
    this.prune();
    if (
      !this.invite ||
      this.invite.expiresAt <= Date.now() ||
      this.invite.origin !== origin ||
      this.invite.hash !== credentialHash(token)
    )
      throw new HttpError(403, "pairing_expired");
    if (this.pending.size >= 16) throw new HttpError(429, "pairing_limit");
    if (!name.trim() || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))
      throw new HttpError(400, "invalid_device_name");
    this.invite = undefined;
    const credential = newCredential();
    const pending: PendingDevice = {
      id: randomUUID(),
      name: name.trim(),
      credentialHash: credentialHash(credential),
      confirmation: String(randomInt(0, 1_000_000)).padStart(6, "0"),
      expiresAt: Date.now() + 5 * 60_000,
      state: "pending",
    };
    this.pending.set(pending.id, pending);
    return { credential, pending };
  }

  list(): PairingRequest[] {
    this.prune();
    return [...this.pending.values()]
      .filter((item) => item.state === "pending")
      .map(({ id, name, confirmation, expiresAt }) => ({ id, name, confirmation, expiresAt }));
  }

  find(credential: string): PendingDevice | undefined {
    this.prune();
    return [...this.pending.values()].find(
      (item) => item.credentialHash === credentialHash(credential),
    );
  }

  get(id: string): PendingDevice {
    this.prune();
    const item = this.pending.get(id);
    if (!item || item.state !== "pending") throw new HttpError(409, "pairing_expired");
    return item;
  }

  private prune(): void {
    for (const [id, item] of this.pending) {
      if (item.expiresAt <= Date.now()) this.pending.delete(id);
    }
  }
}
