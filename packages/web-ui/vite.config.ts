import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("./src/frontend", import.meta.url)),
  publicDir: "assets",
  plugins: [react()],
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true,
    rolldownOptions: {
      output: { comments: { legal: true, annotation: false, jsdoc: false } },
    },
    outDir: "../../dist/web",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
  },
});
