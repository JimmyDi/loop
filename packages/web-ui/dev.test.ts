import { readFile } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { afterEach, expect, test, vi } from "vitest";

import { main } from "./src/main";
import { startDevelopmentGateway } from "./src/backend/startup/development-gateway";
import { watchFrontend } from "./watch-frontend";

vi.mock("node:process", () => ({ loadEnvFile: vi.fn() }));
vi.mock("./src/main", () => ({ main: vi.fn() }));
vi.mock("./src/backend/startup/development-gateway", () => ({
  startDevelopmentGateway: vi.fn(),
}));
vi.mock("./watch-frontend", () => ({ watchFrontend: vi.fn() }));

afterEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

const loadStartup = async () => {
  await import("./dev");
  expect(main).toHaveBeenCalledWith(
    process.argv.slice(2),
    { development: true },
    expect.any(Function),
  );
  return vi.mocked(main).mock.calls[0]![2]!;
};

test("development command launches the gateway entry with source exports", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../../package.json", import.meta.url), "utf8"),
  );
  expect(manifest.scripts.dev.split(/\s+/)).toEqual([
    "tsx",
    "--conditions=loop-source",
    "packages/web-ui/dev.ts",
  ]);
});

test.each([false, true])(
  "shutdown closes the gateway after the frontend build (failure: %s)",
  async (fail) => {
    const order: string[] = [];
    const frontendClose = vi.fn(async () => {
      order.push("frontend");
      if (fail) throw new Error("Build failed");
    });
    const gatewayClose = vi.fn(async () => {
      order.push("gateway");
    });
    vi.mocked(watchFrontend).mockReturnValue({ close: frontendClose });
    vi.mocked(startDevelopmentGateway).mockResolvedValue({
      url: "http://localhost/",
      close: gatewayClose,
    });
    const start = await loadStartup();
    const server = await start(0, { development: true });
    expect(loadEnvFile).toHaveBeenCalledOnce();
    expect(watchFrontend).toHaveBeenCalledOnce();
    expect(startDevelopmentGateway).toHaveBeenCalledWith(0);
    expect(server.url).toBe("http://localhost/");
    expect(order).toEqual([]);
    const closing = server.close();
    if (fail) await expect(closing).rejects.toThrow("Build failed");
    else await closing;
    expect(order).toEqual(["frontend", "gateway"]);
  },
);

test("gateway startup failure stops the frontend watcher", async () => {
  const close = vi.fn(async () => {});
  vi.mocked(watchFrontend).mockReturnValue({ close });
  vi.mocked(startDevelopmentGateway).mockRejectedValue(new Error("Gateway failed"));
  const start = await loadStartup();
  await expect(start(0, { development: true })).rejects.toThrow("Gateway failed");
  expect(close).toHaveBeenCalledOnce();
});
