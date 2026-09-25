import { realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function getAgentDir(): string {
  return resolve(process.env.LOOP_DATA_DIR ?? join(homedir(), ".loop"));
}

export function getSessionDir(cwd: string, agentDir = getAgentDir()): string {
  const project = createHash("sha256").update(realpathSync(cwd)).digest("hex").slice(0, 24);

  return join(agentDir, "sessions", project);
}

export const VERSION = "0.1.0";

export const DEFAULT_PROVIDER = "openai";

export const DEFAULT_MODEL = "gpt-5.5";
