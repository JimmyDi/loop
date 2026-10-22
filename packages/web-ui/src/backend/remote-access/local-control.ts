import { randomBytes, timingSafeEqual } from "node:crypto";

import { HttpError } from "../http/errors";

const cookieName = "loop_remote_control";

export const createLocalControl = () => {
  const capability = randomBytes(32).toString("hex");
  return {
    cookie: cookieName + "=" + capability + "; HttpOnly; SameSite=Strict; Path=/api/remote-access",
    assert(request: Request): void {
      if (request.headers.get("origin") !== new URL(request.url).origin)
        throw new HttpError(403, "invalid_origin");
      const values = (request.headers.get("cookie") ?? "")
        .split(";")
        .map((item) => item.trim())
        .filter((item) => item.startsWith(cookieName + "="));
      const credential = values.length === 1 ? values[0]!.slice(cookieName.length + 1) : "";
      const bytes = Buffer.from(credential);
      if (bytes.length !== capability.length || !timingSafeEqual(bytes, Buffer.from(capability)))
        throw new HttpError(403, "invalid_control_credential");
    },
  };
};
