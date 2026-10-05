import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

export const root = resolve(import.meta.dirname, "..");
const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const names = ["agent", "coding-agent", "web-ui"];
const owner = (file: string) => relative(root, file).split("/")[1];
const terminal = (file: string) =>
  /coding-agent\/src\/(cli(?:\/|\.ts)|main\.ts|modes\/)/.test(file);
const browser = (file: string) => /web-ui\/src\/(frontend|shared)\//.test(file);
const manifest = (name: string) =>
  JSON.parse(readFileSync(resolve(root, "packages", name, "package.json"), "utf8"));

export const inspectImports = (file: string, source: string) => {
  const failures: string[] = [];
  const edges: string[] = [];
  const from = owner(file);
  const entry = relative(root, file);
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const reject = (name: string) => failures.push(entry + " -> " + name);
  const check = (literal: ts.Node | undefined, typeOnly: boolean) => {
    if (!literal || !ts.isStringLiteralLike(literal)) {
      reject("computed module");
      return;
    }
    const name = literal.text;
    if (/^(bun:|bun$)/.test(name)) {
      reject(name);
      return;
    }
    if (browser(file) && /^(node:|@earendil-works)/.test(name)) {
      reject(name);
      return;
    }
    if (name.startsWith("@earendil-works/pi-ai")) {
      if (
        from === "web-ui" ||
        (from === "coding-agent" &&
          !typeOnly &&
          entry !== "packages/coding-agent/src/core/model-runtime.ts")
      )
        reject(name);
    }
    const workspace = name.match(/^@loop\/([^/]+)(.*)$/);
    if (workspace) {
      const [, to, subpath] = workspace;
      const allowed =
        from === "web-ui" ? "coding-agent" : from === "coding-agent" ? "agent" : undefined;
      const shell = entry === "bin.ts" && ["@loop/web-ui", "@loop/coding-agent/cli"].includes(name);
      const sdk = entry === "sdk.ts" && name === "@loop/coding-agent";
      if (!shell && !sdk && (to !== allowed || subpath || (browser(file) && !typeOnly)))
        reject(name);
    }
    const resolved = ts.resolveModuleName(name, file, options, ts.sys).resolvedModule;
    if (!name.startsWith(".") && !name.startsWith("node:") && names.includes(from)) {
      const dependency = name.startsWith("@")
        ? name.split("/").slice(0, 2).join("/")
        : name.split("/")[0];
      const declared = manifest(from);
      if (!declared.dependencies?.[dependency] && !(from === "web-ui" && dependency === "vite"))
        reject("undeclared " + dependency);
    }
    if (!resolved) {
      if (name.startsWith("node:")) return;
      if (/\.(css|html|svg|png|ico)$/.test(name)) {
        try {
          const asset = name.startsWith(".")
            ? resolve(dirname(file), name)
            : createRequire(file).resolve(name);
          if (!existsSync(asset)) reject(name);
        } catch {
          reject(name);
        }
        return;
      }
      reject(name);
      return;
    }
    if (resolved.isExternalLibraryImport && !workspace) return;
    const target = resolve(resolved.resolvedFileName);
    const to = owner(target);
    if (workspace) {
      const expected =
        entry === "bin.ts" && name === "@loop/coding-agent/cli"
          ? resolve(root, "packages/coding-agent/src/main.ts")
          : resolve(root, "packages", workspace[1]!, "src/index.ts");
      if (target !== expected) reject("public export redirected " + name);
    }

    if (!target.startsWith(resolve(root, "packages") + "/") || target.includes(".test.")) {
      reject(name);
      return;
    }
    if (from !== to && !workspace) reject("cross-package relative/alias " + name);
    if (from === "coding-agent" && !terminal(file) && terminal(target)) reject(name);
    if (browser(file) && target.includes("/backend/")) reject(name);
    if (!typeOnly) edges.push(target);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const binding = clause?.namedBindings;
      const typeOnly =
        !!clause?.isTypeOnly ||
        !!(
          !clause?.name &&
          binding &&
          ts.isNamedImports(binding) &&
          binding.elements.length &&
          binding.elements.every((item) => item.isTypeOnly)
        );
      check(node.moduleSpecifier, typeOnly);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const binding = node.exportClause;
      check(
        node.moduleSpecifier,
        node.isTypeOnly ||
          !!(
            binding &&
            ts.isNamedExports(binding) &&
            binding.elements.length &&
            binding.elements.every((item) => item.isTypeOnly)
          ),
      );
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      check(node.argument.literal, true);
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      check(node.moduleReference.expression, node.isTypeOnly);
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    )
      check(node.arguments[0], false);
    if (ts.isIdentifier(node) && node.text === "Bun") reject("Bun runtime global");
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return { failures, edges };
};

export const cycles = (graph: Map<string, string[]>) => {
  const visited = new Set<string>();
  const active = new Set<string>();
  const failures: string[] = [];
  const visit = (file: string, path: string[]) => {
    if (active.has(file)) {
      failures.push([...path, file].map((p) => relative(root, p)).join(" -> "));
      return;
    }
    if (visited.has(file)) return;
    active.add(file);
    for (const target of graph.get(file) ?? []) visit(target, [...path, file]);
    active.delete(file);
    visited.add(file);
  };
  for (const file of graph.keys()) visit(file, []);
  return failures;
};
