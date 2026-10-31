import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { contentPlugin } from "./scripts/content-plugin";

export default defineConfig({
  plugins: [react(), contentPlugin()],
  server: {
    fs: {
      strict: true,
      allow: [import.meta.dirname],
    },
  },
});
