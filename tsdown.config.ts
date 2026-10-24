import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["bin.ts", "sdk.ts"],
  format: "esm",
  platform: "node",
  target: "node24",
  dts: { sourcemap: false, compilerOptions: { declarationMap: false, removeComments: true } },
  sourcemap: false,
  minify: true,
  outputOptions: { comments: { legal: true, annotation: false, jsdoc: false } },
  fixedExtension: false,
  clean: ["dist/*.js", "dist/*.d.ts"],
  deps: {
    alwaysBundle: [/^@loop\//],
    neverBundle: ["vite", "@hono/node-server", "which", "@earendil-works/pi-codemode"],
  },
});
