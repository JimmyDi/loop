import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { contentPlugin } from "./scripts/content-plugin";

export default defineConfig({
  plugins: [react(), contentPlugin()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
