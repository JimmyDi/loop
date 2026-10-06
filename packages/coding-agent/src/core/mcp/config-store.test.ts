import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { expect, test } from "vitest";

import { mergeMcpSecrets, readMcpConfigs, redactMcpConfig, writeMcpConfigs } from "./config-store";
import type { McpServerConfig } from "./types";

test("MCP storage is atomic, private and preserves write-only values only at the same target", async () => {
  const directory = await mkdtemp(join(tmpdir(), "loop-mcp-store-"));
  const file = join(directory, "settings", "mcp.json");
  const config: McpServerConfig = {
    id: "example",
    name: "Example",
    enabled: false,
    transport: "http",
    url: "https://example.com/mcp",
    bearerTokenEnv: "",
    headers: [{ key: "X-Example", value: "synthetic-value" }],
    envHeaders: [],
  };
  try {
    expect(await readMcpConfigs(file)).toEqual([]);
    await writeMcpConfigs(file, [config]);
    expect(await readMcpConfigs(file)).toEqual([config]);
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        servers: [{ ...config, approvalMode: "allow", toolPolicies: { example: "disabled" } }],
      }),
    );
    const restored = await readMcpConfigs(file);
    expect(restored).toEqual([config]);
    await writeMcpConfigs(file, restored);
    const normalized = await readFile(file, "utf8");
    expect(normalized).not.toContain("approvalMode");
    expect(normalized).not.toContain("toolPolicies");
    if (process.platform !== "win32") expect((await stat(file)).mode & 0o777).toBe(0o600);
    const view = redactMcpConfig(config);
    if (view.transport !== "http") throw new Error();
    expect(JSON.stringify(view)).not.toContain("synthetic-value");
    expect(mergeMcpSecrets(view, config)).toEqual(config);
    expect(() => mergeMcpSecrets({ ...view, url: "https://example.org/mcp" }, config)).toThrow(
      "mcp_secret_required",
    );
    const cleared = mergeMcpSecrets({ ...view, headers: [] }, config);
    expect(cleared).toMatchObject({ headers: [] });
    await writeFile(file, "invalid synthetic content");
    await expect(readMcpConfigs(file)).rejects.toThrow("mcp_config_invalid");
    expect(await readFile(file, "utf8")).toBe("invalid synthetic content");
    const blocked = join(directory, "not-a-directory");
    await writeFile(blocked, "synthetic fixture");
    await expect(writeMcpConfigs(join(blocked, "mcp.json"), [config])).rejects.toThrow(
      "mcp_config_write_failed",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
