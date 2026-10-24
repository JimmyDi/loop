import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "vite";

import { buildFrontend } from "./publish-frontend";

const staging = fileURLToPath(new URL("./.tools/web-build-" + randomUUID(), import.meta.url));
const target = fileURLToPath(new URL("./dist/web/", import.meta.url));

await buildFrontend(staging, target, (outDir) =>
  build({
    configFile: fileURLToPath(new URL("./vite.config.ts", import.meta.url)),
    configLoader: "runner",
    build: { outDir, emptyOutDir: true },
  }),
);
