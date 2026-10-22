import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Plugin } from "vite";

import { installWorker } from "./src/frontend/pwa/service-worker";

export const pwaPlugin = (): Plugin => ({
  name: "loop-pwa",
  apply: "build",
  async generateBundle(_options, bundle) {
    const offline = await readFile(new URL("./src/frontend/pwa/offline.html", import.meta.url));
    const manifest = JSON.stringify({
      id: "/",
      name: "Loop",
      short_name: "Loop",
      description: "Connect to your Loop workspace.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#f6f7f9",
      theme_color: "#18191c",
      icons: [
        { src: "/loop-pwa-192.png", sizes: "192x192", type: "image/png" },
        { src: "/loop-pwa-512.png", sizes: "512x512", type: "image/png" },
      ],
    });
    const icons = ["/loop-pwa-192.png", "/loop-pwa-512.png"];
    const workerSource = installWorker.toString();
    const version = createHash("sha256").update(manifest).update(offline).update(workerSource);
    const assets = [...icons, "/manifest.webmanifest"];
    for (const [name, file] of Object.entries(bundle).sort(([a], [b]) => a.localeCompare(b))) {
      version.update(name).update(file.type === "chunk" ? file.code : file.source);
      if (/^assets\/[^/]+\.(?:js|css|png|svg|ico|woff2?|ttf)$/.test(name)) assets.push("/" + name);
    }
    for (const path of icons) {
      version.update(await readFile(new URL("./src/frontend/assets" + path, import.meta.url)));
    }
    const config = {
      version: version.digest("hex").slice(0, 20),
      assets,
      precache: ["/manifest.webmanifest", ...icons],
      offline: offline.toString(),
    };
    this.emitFile({ type: "asset", fileName: "manifest.webmanifest", source: manifest });
    this.emitFile({ type: "asset", fileName: "offline.html", source: offline });
    this.emitFile({
      type: "asset",
      fileName: "sw.js",
      source: "(" + workerSource + ")(self," + JSON.stringify(config) + ");",
    });
  },
});
