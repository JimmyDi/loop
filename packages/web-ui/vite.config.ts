import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

import { pwaPlugin } from "./pwa-plugin";

// Only prune selectors owned by the upstream chat shell. Keep bundled component rules
// in their original cascade order, including styles without a standalone export.
const openUiShellSelector =
  /^\.openui-(?:agent-|shell-|tool-(?:call|result|glyph|code)|behind-the-scenes|model-switcher|genui-user-message|detailed-view)/;
const openUiShellAnimation =
  /^openui-(?:agent-|tool-|behind-the-scenes|model-switcher|detailed-view)/;

export default defineConfig(({ command }) => ({
  root: fileURLToPath(new URL("./src/frontend", import.meta.url)),
  publicDir: "assets",
  define: {
    "import.meta.env.LOOP_ENVIRONMENT": JSON.stringify(
      command === "serve" ? "local-dev" : "production",
    ),
    ...(command === "build" && { "process.env.NODE_ENV": JSON.stringify("production") }),
  },
  plugins: [
    react(),
    pwaPlugin(),
    {
      name: "loop-openui-devtools",
      apply: "serve",
      transformIndexHtml: () => [
        {
          tag: "script",
          injectTo: "head-prepend",
          // Loop mounts the inspector itself so the preference controls its full lifecycle.
          children: 'globalThis[Symbol.for("openui.devtools.autoMount")] = true;',
        },
      ],
    },
  ],
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: "loop-openui-card-styles",
          Once(root) {
            if (
              !root.source?.input.file
                ?.replaceAll("\\", "/")
                .endsWith("/@openuidev/react-ui/dist/layered/styles/index.css")
            ) {
              return;
            }
            root.walkRules((rule) => {
              if (rule.selectors.every((selector) => openUiShellSelector.test(selector)))
                rule.remove();
            });
            root.walkAtRules("keyframes", (rule) => {
              if (openUiShellAnimation.test(rule.params)) rule.remove();
            });
          },
        },
      ],
    },
  },
  build: {
    sourcemap: false,
    minify: true,
    cssMinify: true,
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL("./src/frontend/index.html", import.meta.url)),
        remote: fileURLToPath(new URL("./src/frontend/remote.html", import.meta.url)),
      },
      output: { comments: { legal: true, annotation: false, jsdoc: false } },
    },
    outDir: "../../dist/web",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    license: { fileName: "THIRD_PARTY_LICENSES.md" },
  },
}));
