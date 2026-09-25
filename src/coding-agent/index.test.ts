import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dir, "..");
const configFile = resolve(root, "../tsconfig.json");
const config = ts.readConfigFile(configFile, ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configFile));
const layers = ["agent", "coding-agent", "web-ui"];

function isTerminalModule(path: string): boolean {
  return (
    path === "coding-agent/cli.ts" ||
    path === "coding-agent/main.ts" ||
    path.startsWith("coding-agent/cli/") ||
    path.startsWith("coding-agent/modes/")
  );
}

function violations(file: string, text: string): string[] {
  const from = relative(root, file);
  const layer = from.split("/")[0];
  const browser = from.startsWith("web-ui/frontend/") || from.startsWith("web-ui/shared/");
  const failures: string[] = [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const check = (specifier: ts.Node | undefined, typeOnly = false) => {
    if (!specifier || !ts.isStringLiteralLike(specifier)) {
      failures.push(from + ": module specifiers must be static");
      return;
    }

    const name = specifier.text;
    const reject = () => failures.push(from + " -> " + name);

    if (browser && /^(node:|bun(?::|$))/.test(name)) {
      reject();
      return;
    }

    if (name.startsWith("@earendil-works/pi-ai")) {
      if (layer === "web-ui") reject();

      if (layer === "coding-agent" && !typeOnly && from !== "coding-agent/core/model-runtime.ts")
        reject();

      return;
    }

    if (layer === "web-ui" && name.startsWith(".") && /\.(css|html)$/.test(name)) {
      const asset = resolve(dirname(file), name);

      if (!asset.startsWith(resolve(root, "web-ui") + "/") || !existsSync(asset)) reject();

      return;
    }

    if (layer === "web-ui" && name.endsWith(".css") && !name.startsWith(".")) {
      try {
        Bun.resolveSync(name, dirname(file));
      } catch {
        reject();
      }

      return;
    }

    const resolved = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule;

    if (!resolved) {
      if (!name.startsWith("node:") && name !== "bun" && !name.startsWith("bun:")) reject();

      return;
    }

    if (resolved.isExternalLibraryImport) return;

    const target = relative(root, resolved.resolvedFileName);
    const to = target.split("/")[0];

    if (!layers.includes(to) || target.includes(".test.")) reject();
    else if (to !== layer) {
      const lower =
        layer === "web-ui" ? "coding-agent" : layer === "coding-agent" ? "agent" : undefined;

      if (to !== lower || target !== lower + "/index.ts" || (browser && !typeOnly)) reject();
    } else if (layer === "coding-agent" && !isTerminalModule(from) && isTerminalModule(target))
      reject();
    else if (browser && target.startsWith("web-ui/backend/")) reject();
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const names = clause?.namedBindings;
      const typeOnly =
        !!clause?.isTypeOnly ||
        !!(
          !clause?.name &&
          names &&
          ts.isNamedImports(names) &&
          names.elements.length &&
          names.elements.every((item) => item.isTypeOnly)
        );

      check(node.moduleSpecifier, typeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const names = node.exportClause;

      check(
        node.moduleSpecifier,
        node.isTypeOnly ||
          !!(
            names &&
            ts.isNamedExports(names) &&
            names.elements.length &&
            names.elements.every((item) => item.isTypeOnly)
          ),
      );
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      check(node.moduleReference.expression, node.isTypeOnly);
    else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      check(node.argument.literal, true);
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    )
      check(node.arguments[0]);

    ts.forEachChild(node, visit);
  };

  visit(source);

  return failures;
}

test("production dependencies use downward public boundaries", async () => {
  expect(
    (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort(),
  ).toEqual([...layers].sort());

  const failures: string[] = [];

  for await (const file of new Bun.Glob("**/*.{ts,tsx,js}").scan({ cwd: root, absolute: true })) {
    if (/\/(?:node_modules|dist)\//.test(file)) continue;

    if (!file.includes(".test.")) failures.push(...violations(file, await Bun.file(file).text()));
  }

  expect(failures).toEqual([]);
});

test.each([
  ["agent/agent.ts", 'import type { SessionEvent } from "../coding-agent";'],
  ["agent/agent.ts", 'export { AgentSession } from "../coding-agent";'],
  ["agent/agent.ts", "import(upperPath);"],
  ["agent/agent.ts", 'require("./agent.test");'],
  ["coding-agent/index.ts", 'import { Agent } from "../agent/agent";'],
  ["coding-agent/index.ts", 'import { streamSimple } from "@earendil-works/pi-ai/compat";'],
  ["coding-agent/core/sdk.ts", 'import "../main";'],
  ["coding-agent/index.ts", 'export { main } from "./main";'],
  ["coding-agent/core/sdk.ts", 'import "../modes/print-mode";'],
  ["coding-agent/core/sdk.ts", 'import "../cli/args";'],
  ["coding-agent/sdk.sample.ts", 'import "./modes/save-recovery";'],
  ["agent/agent.ts", 'import type { Frame } from "../web-ui/shared/protocol";'],
  ["coding-agent/index.ts", 'import "../web-ui/main";'],
  ["web-ui/backend/loop.ts", 'import { Agent } from "../../agent/index";'],
  ["web-ui/backend/loop.ts", 'import "../../coding-agent/core/sdk";'],
  ["web-ui/frontend/main.tsx", 'import "../backend/loop";'],
  ["web-ui/frontend/main.tsx", 'import "../../coding-agent/index";'],
  ["web-ui/shared/protocol.ts", 'import "node:fs";'],
  ["web-ui/backend/loop.ts", 'import "@earendil-works/pi-ai";'],
])("rejects forbidden dependency from %s", (file, source) => {
  expect(violations(resolve(root, file), source).length).toBeGreaterThan(0);
});

test.each([
  ["web-ui/backend/loop.ts", 'import { createAgentSession } from "../../coding-agent/index";'],
  ["web-ui/shared/protocol.ts", 'import type { SessionEvent } from "../../coding-agent/index";'],
  ["web-ui/frontend/App.tsx", 'import "./App.css";'],
  ["web-ui/backend/server.ts", 'import page from "../frontend/index.html";'],
])("allows public Web dependencies from %s", (file, source) => {
  expect(violations(resolve(root, file), source)).toEqual([]);
});

test("SDK import has no terminal, stdout or file creation side effects", async () => {
  const child = Bun.spawn(
    [process.execPath, "-e", "await import(process.argv[1]);", import.meta.dir + "/index.ts"],
    { stdout: "pipe", stderr: "pipe" },
  );

  expect(await new Response(child.stdout).text()).toBe("");
  expect(await new Response(child.stderr).text()).toBe("");
  expect(await child.exited).toBe(0);
});
