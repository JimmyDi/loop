import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { HttpError } from "../http/errors";

export type PasswordRecord = { salt: string; hash: string; algorithm: "scrypt-v1" };

const derive = (password: string, salt: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(salt, "hex"),
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, value) => (error ? reject(error) : resolve(value)),
    );
  });

export const validatePassword: (password: unknown) => asserts password is string = (password) => {
  if (
    typeof password !== "string" ||
    !password.trim() ||
    password.length < 8 ||
    password.length > 1024
  )
    throw new HttpError(400, "invalid_password");
};

export const makePassword = async (password: unknown): Promise<PasswordRecord> => {
  validatePassword(password);
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: (await derive(password, salt)).toString("hex"), algorithm: "scrypt-v1" };
};

export const verifyPassword = async (password: string, record: PasswordRecord): Promise<boolean> =>
  timingSafeEqual(await derive(password, record.salt), Buffer.from(record.hash, "hex"));
