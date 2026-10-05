import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  resolve: { conditions: ["loop-source"] },
  test: {
    include: ["packages/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    maxWorkers: 4,
    environment: "node",
  },
});
