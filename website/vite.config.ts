import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { blogPlugin } from "./scripts/blog-plugin.ts";
import { contentPlugin } from "./scripts/content-plugin.ts";

export default defineConfig({
  plugins: [react(), contentPlugin(), blogPlugin()],
  server: {
    fs: {
      strict: true,
      allow: [import.meta.dirname],
    },
  },
});
