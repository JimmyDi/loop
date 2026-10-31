import { defineConfig } from "vitest/config";
import { releaseContentPlugin } from "./packages/web-ui/release-content-plugin";

export default defineConfig({
  plugins: [releaseContentPlugin()],
  root: import.meta.dirname,
  resolve: { conditions: ["loop-source"] },
  ssr: { resolve: { conditions: ["loop-source", "node"] } },
  test: {
    include: ["packages/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 4,
    environment: "node",
  },
});
