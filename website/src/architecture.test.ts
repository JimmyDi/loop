import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

const files = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });

it("keeps components small, styled and tested alongside their implementation", () => {
  const components = files("src/components").filter(
    (file) => file.endsWith(".tsx") && !file.includes(".test."),
  );
  for (const file of components) {
    expect(existsSync(file.replace(/\.tsx$/, ".module.css")), file).toBe(true);
    expect(existsSync(file.replace(/\.tsx$/, ".test.tsx")), file).toBe(true);
    expect(readFileSync(file, "utf8").split("\n").length, file).toBeLessThanOrEqual(150);
  }
});

it("keeps website imports isolated, statically resolvable and free of cycles", () => {
  const graph = new Map<string, string[]>();
  const sources = files("src").filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  for (const file of sources) {
    const tree = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const edges: string[] = [];
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) || (ts.isExportDeclaration(node) && node.moduleSpecifier)) {
        const literal = node.moduleSpecifier;
        expect(literal && ts.isStringLiteral(literal)).toBe(true);
        if (!literal || !ts.isStringLiteral(literal)) return;
        const name = literal.text;
        if (name.startsWith(".")) {
          const target = resolve(dirname(file), name);
          expect(target.startsWith(resolve("src") + "/"), name).toBe(true);
          const resolved = [target, target + ".ts", target + ".tsx"].find(existsSync);
          expect(resolved, name).toBeDefined();
          expect(resolved?.includes(".test.")).toBe(false);
          if (resolved && /\.tsx?$/.test(resolved)) edges.push(resolved);
        } else {
          if (name === "virtual:release-content") return;
          expect(name.startsWith("@loop/") || name.startsWith("node:")).toBe(false);
          const dependency = name.startsWith("@")
            ? name.split("/").slice(0, 2).join("/")
            : name.split("/")[0];
          expect(manifest.dependencies?.[dependency], name).toBeDefined();
        }
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        expect(node.arguments[0] && ts.isStringLiteral(node.arguments[0])).toBe(true);
      }
      ts.forEachChild(node, visit);
    };
    visit(tree);
    graph.set(file, edges);
  }
  const active = new Set<string>();
  const visited = new Set<string>();
  const visit = (file: string): void => {
    expect(active.has(file), file).toBe(false);
    if (visited.has(file)) return;
    active.add(file);
    for (const target of graph.get(file) ?? []) visit(target);
    active.delete(file);
    visited.add(file);
  };
  for (const file of graph.keys()) visit(file);
});
