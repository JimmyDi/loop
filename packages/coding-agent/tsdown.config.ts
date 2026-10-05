import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/main.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  dts: true,
  fixedExtension: false,
  clean: true,
});
