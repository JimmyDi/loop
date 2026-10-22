import { createHash, createHmac, randomBytes } from "node:crypto";

export const deviceCookie = "__Host-loop_device";

export const pairingCookie = "__Host-loop_pair";

export const deviceLifetime = 14 * 24 * 60 * 60 * 1000;

export const newCredential = (): string => randomBytes(32).toString("base64url");

export const credentialHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export const csrfCredential = (key: string, credential: string): string =>
  createHmac("sha256", key).update(credential).digest("base64url");

export const readCredential = (request: Request, name: string): string => {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.startsWith(name + "="));
  if (values.length !== 1) return "";
  const value = values[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : "";
};

export const credentialCookie = (name: string, value: string, maxAge: number): string =>
  name + "=" + value + "; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=" + maxAge;
