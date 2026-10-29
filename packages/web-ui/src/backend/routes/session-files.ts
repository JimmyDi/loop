import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { Marked } from "marked";

import { localFilePath } from "../../shared/message-files";
import type { Message } from "../../shared/protocol";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";

const parser = new Marked();
const previewTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogv: "video/ogg",
  pdf: "application/pdf",
};

const referenced = (messages: Message[], path: string): boolean => {
  let found = false;
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.content) {
      if (part.type !== "text") continue;
      parser.walkTokens(parser.lexer(part.text), (token) => {
        if (token.type === "link" && localFilePath(token.href) === path) found = true;
      });
    }
  }
  return found;
};

const inside = (root: string, target: string): boolean => {
  const path = relative(root, target);
  return path !== ".." && !path.startsWith("../") && !path.startsWith("..\\") && !isAbsolute(path);
};

const byteRange = (header: string, size: number): [number, number] | undefined => {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !size) return;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size)
    return;
  return [start, end];
};

export const sessionFileRoutes =
  (registry: SessionRegistry) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    const match = url.pathname.match(/^[/]api[/]sessions[/]([^/]+)[/]files$/);
    if (!match) return;
    if (!["GET", "HEAD"].includes(request.method)) throw new HttpError(405, "method_not_allowed");
    const controller = await registry.get(match[1]!);
    registry.assertAvailable(controller.workspaceId);
    const path = url.searchParams.get("path") ?? "";
    const messages = [...controller.snapshot.state.messages];
    if (controller.snapshot.state.draft) messages.push(controller.snapshot.state.draft);
    if (!referenced(messages, path)) throw new HttpError(404, "file_not_found");
    const project =
      controller.workspaceId === null
        ? { cwd: controller.session.sessionManager.getCwd() }
        : await registry.projects.get(controller.workspaceId);
    let file: Awaited<ReturnType<typeof open>>;
    try {
      const target = await realpath(resolve(project.cwd, path));
      const roots = await Promise.all(
        [project.cwd, tmpdir(), ...(process.platform === "win32" ? [] : ["/tmp"])].map((root) =>
          realpath(root),
        ),
      );
      if (!roots.some((root) => inside(root, target))) throw new Error("Outside file roots");
      file = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    } catch {
      throw new HttpError(404, "file_not_found");
    }
    let streaming = false;
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > 512 * 1024 * 1024)
        throw new HttpError(404, "file_not_found");
      const type = previewTypes[path.split(".").at(-1)?.toLowerCase() ?? ""];
      const preview = url.searchParams.get("preview") === "1" && !!type;
      if (preview && type === "application/pdf") {
        const signature = Buffer.alloc(5);
        await file.read(signature, 0, 5, 0);
        if (signature.toString() !== "%PDF-") throw new HttpError(404, "file_not_found");
      }
      const headers = new Headers({
        "Content-Type": preview ? type! : "application/octet-stream",
        "Content-Disposition":
          (preview ? "inline" : "attachment") +
          "; filename=\"download\"; filename*=UTF-8''" +
          encodeURIComponent(basename(path.replaceAll("\\", "/"))).replaceAll("'", "%27"),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          preview && type === "application/pdf"
            ? "script-src 'none'; base-uri 'none'; form-action 'none'"
            : "default-src 'none'; sandbox",
        "Accept-Ranges": "bytes",
      });
      const range = request.method === "GET" ? request.headers.get("range") : null;
      const bounds = range ? byteRange(range, stat.size) : undefined;
      if (range && !bounds) {
        headers.set("Content-Range", "bytes */" + stat.size);
        return new Response(null, { status: 416, headers });
      }
      const [start, end] = bounds ?? [0, stat.size - 1];
      headers.set("Content-Length", String(Math.max(0, end - start + 1)));
      if (bounds) headers.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);
      if (request.method === "HEAD" || !stat.size) return new Response(null, { headers });
      const body = Readable.toWeb(file.createReadStream({ start, end, autoClose: true }));
      const response = new Response(body as ReadableStream<Uint8Array>, {
        status: bounds ? 206 : 200,
        headers,
      });
      streaming = true;
      return response;
    } finally {
      if (!streaming) await file.close();
    }
  };
