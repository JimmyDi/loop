import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { Marked } from "marked";

import type { Message } from "../../shared/protocol";
import { localImagePath } from "../../shared/message-images";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";

const parser = new Marked();
const maxBytes = 32 * 1024 * 1024;

const inside = (root: string, path: string): boolean => {
  const child = relative(root, path);
  return (
    child !== ".." && !child.startsWith("../") && !child.startsWith("..\\") && !isAbsolute(child)
  );
};

const referenced = (messages: Message[], path: string): boolean => {
  let found = false;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type !== "text") continue;
      parser.walkTokens(parser.lexer(part.text), (token) => {
        if (token.type === "image" && localImagePath(token.href) === path) found = true;
      });
    }
  }
  return found;
};

const imageType = (bytes: Buffer): string | undefined => {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (/^GIF8[79]a$/.test(bytes.toString("ascii", 0, 6))) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
};

export const sessionImageRoutes =
  (registry: SessionRegistry) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    const match = url.pathname.match(/^[/]api[/]sessions[/]([^/]+)[/]images$/);
    if (!match) return;
    if (!["GET", "HEAD"].includes(request.method)) throw new HttpError(405, "method_not_allowed");
    const controller = await registry.get(match[1]!);
    registry.assertAvailable(controller.workspaceId);
    const path = url.searchParams.get("path") ?? "";
    const messages = [...controller.snapshot.state.messages];
    if (controller.snapshot.state.draft) messages.push(controller.snapshot.state.draft);
    if (!referenced(messages, path)) throw new HttpError(404, "image_not_found");
    const project =
      controller.workspaceId === null
        ? { cwd: controller.session.sessionManager.getCwd() }
        : await registry.projects.get(controller.workspaceId);
    try {
      const target = await realpath(resolve(project.cwd, path));
      const roots = await Promise.all(
        [project.cwd, tmpdir(), ...(process.platform === "win32" ? [] : ["/tmp"])].map((root) =>
          realpath(root),
        ),
      );
      if (!roots.some((root) => inside(root, target))) throw new Error("Outside image roots");
      const file = await open(
        target,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > maxBytes) throw new Error("Invalid image size");
        const bytes = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < bytes.length) {
          const read = await file.read(bytes, offset, bytes.length - offset, offset);
          if (!read.bytesRead) throw new Error("Incomplete image");
          offset += read.bytesRead;
        }
        const type = imageType(bytes);
        if (!type) throw new Error("Invalid image type");
        return new Response(request.method === "HEAD" ? null : bytes, {
          headers: {
            "Content-Type": type,
            "Content-Length": String(bytes.length),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      } finally {
        await file.close();
      }
    } catch {
      throw new HttpError(404, "image_not_found");
    }
  };
