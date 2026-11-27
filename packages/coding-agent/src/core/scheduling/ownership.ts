import { createHash } from "node:crypto";
import { mkdir, realpath, stat } from "node:fs/promises";
import { createServer } from "node:net";

// A kernel-owned loopback bind releases on process death, including SIGKILL.
// Hash collisions conservatively report another owner. No protocol is served.
export const acquireScheduleOwner = async (directory: string) => {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = await realpath(directory);
  const info = await stat(path, { bigint: true });
  const identity = info.ino ? String(info.dev) + "/" + String(info.ino) : path.toLowerCase();
  const hash = createHash("sha256").update(identity).digest();
  const server = createServer((socket) => socket.destroy());
  const port = 32768 + (hash.readUInt16BE(0) % 28000);
  const owned = await new Promise<boolean>((resolve, reject) => {
    server.once("error", (error: NodeJS.ErrnoException) =>
      error.code === "EADDRINUSE" ? resolve(false) : reject(error),
    );
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => resolve(true));
  });
  if (!owned) return undefined;
  server.unref();
  return () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
};
