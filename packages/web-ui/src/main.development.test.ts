import { expect, test, vi } from "vitest";

import { main } from "./main";
import { startServer } from "./backend/server";

vi.mock("./backend/server", () => ({ startServer: vi.fn() }));

test.each([false, true])(
  "frontend unavailability only stops production startup (development: %s)",
  async (development) => {
    const close = vi.fn(async () => {});
    vi.mocked(startServer).mockResolvedValue({ url: "http://localhost/", close });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Frontend unavailable", { status: 503 })),
    );
    const output = vi.spyOn(console, "log").mockImplementation(() => {});
    const signals = new Map<NodeJS.Signals, NodeJS.SignalsListener[]>();
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      signals.set(signal, process.listeners(signal));
    }
    try {
      const startup = main(["--no-open"], { development });
      if (development) {
        await startup;
        expect(close).not.toHaveBeenCalled();
        expect(output).toHaveBeenCalledWith("Loop Web: http://localhost/");
        for (const listener of process.listeners("SIGTERM")) {
          if (!signals.get("SIGTERM")!.includes(listener)) listener("SIGTERM");
        }
        await vi.waitFor(() => expect(close).toHaveBeenCalledOnce());
      } else {
        await expect(startup).rejects.toThrow("Frontend could not be built");
        expect(close).toHaveBeenCalledOnce();
      }
    } finally {
      for (const [signal, previous] of signals) {
        for (const listener of process.listeners(signal)) {
          if (!previous.includes(listener)) process.off(signal, listener);
        }
      }
      vi.unstubAllGlobals();
      output.mockRestore();
      vi.mocked(startServer).mockReset();
    }
  },
);
