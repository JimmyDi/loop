import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import { blogPlugin } from "./scripts/blog-plugin.ts";
import { contentPlugin } from "./scripts/content-plugin.ts";

export default defineConfig({
  plugins: [react(), contentPlugin(), blogPlugin()],
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
