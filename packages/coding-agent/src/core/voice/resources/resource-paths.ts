import { createHash } from "node:crypto";
import { join } from "node:path";

import type { VoiceComponent } from "./resource-types";

export const safeResourcePath = (path: unknown): path is string =>
  typeof path === "string" &&
  /^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) &&
  path.split("/").every((part) => part !== "." && part !== ".." && !part.startsWith("."));

export const componentHash = (component: VoiceComponent): string =>
  createHash("sha256")
    .update(
      JSON.stringify(component.files.map(({ path, sha256, bytes }) => ({ path, sha256, bytes }))),
    )
    .digest("hex");

export const componentDirectory = (root: string, component: VoiceComponent): string =>
  join(
    root,
    component.kind === "engine" ? "engines" : "models",
    component.id,
    component.version,
    componentHash(component),
  );
