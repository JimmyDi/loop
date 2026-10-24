import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const compress = promisify(gzip);

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export const staticResponse = async (request: Request, directory: string): Promise<Response> => {
  if (!["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 405 });
  try {
    const root = await realpath(directory);
    const pathname = decodeURIComponent(new URL(request.url).pathname);
    const aliases: Record<string, string> = {
      "/": "index.html",
      "/favicon.ico": "loop-icon.ico",
      "/apple-touch-icon.png": "loop-apple-touch-icon.png",
      "/assets/loop-mask-icon.svg": "loop-mask-icon.svg",
    };
    const file = await realpath(resolve(root, aliases[pathname] ?? "." + pathname));
    const path = relative(root, file);
    if (path === ".." || path.startsWith(".." + sep) || isAbsolute(path))
      return new Response(null, { status: 403 });
    if (!(await stat(file)).isFile()) return new Response(null, { status: 404 });
    const type = types[extname(file)] ?? "application/octet-stream";
    const headers = new Headers({ "Content-Type": type, "Cache-Control": "no-cache" });
    const text = /^(?:text\/(?:css|javascript)|application\/json)/.test(type);
    if (text) headers.set("Vary", "Accept-Encoding");
    let bytes = new Uint8Array(await readFile(file));
    const accepted = request.headers
      .get("Accept-Encoding")
      ?.split(",")
      .some((value) => {
        const [name, ...parameters] = value.trim().split(";");
        const quality = parameters.find((value) => value.trim().startsWith("q="))?.split("=")[1];
        return name === "gzip" && (quality === undefined || Number(quality) > 0);
      });
    if (text && bytes.byteLength >= 1024 && accepted) {
      bytes = new Uint8Array(await compress(bytes));
      headers.set("Content-Encoding", "gzip");
    }
    return new Response(request.method === "HEAD" ? null : bytes, { headers });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return new Response(null, { status: 404 });
    if (error instanceof URIError) return new Response(null, { status: 400 });
    throw error;
  }
};
