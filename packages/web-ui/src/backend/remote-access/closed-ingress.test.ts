import { expect, test } from "vitest";

import { startClosedIngress } from "./closed-ingress";

test("remote ingress rejects all assets, APIs and verbs without forwarding to Loop", async () => {
  const ingress = await startClosedIngress(0);
  const url = "http://127.0.0.1:" + ingress.port;
  try {
    for (const path of [
      "/",
      "/api/sessions",
      "/api/remote-access",
      "/@vite/client",
      "/src/main.tsx",
    ]) {
      for (const method of ["GET", "POST"]) {
        const response = await fetch(url + path, { method });
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.text()).not.toContain("<script");
      }
    }
    await expect(startClosedIngress(ingress.port)).rejects.toMatchObject({ code: "EADDRINUSE" });
  } finally {
    await ingress.close();
  }
  await ingress.close();
  await expect(fetch(url)).rejects.toThrow();
});
