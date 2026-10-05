import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  dts: true,
  fixedExtension: false,
  deps: { neverBundle: ["vite"] },
  clean: true,
});
