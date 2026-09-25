import { expect, test } from "bun:test";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const root = import.meta.dir;

test("Web imports use public downward boundaries and static module paths", async () => {
  const failures: string[] = [];

  for await (const file of new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: root, absolute: true })) {
    if (/\/(?:node_modules|dist)\//.test(file) || file.includes(".test.")) continue;

    const text = await Bun.file(file).text();
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const browser = relative(root, file).startsWith("frontend/");
    const shared = relative(root, file).startsWith("shared/");
    const visit = (node: ts.Node) => {
      let path: ts.Expression | undefined;
      let typeOnly = false;

      if (ts.isImportDeclaration(node)) {
        path = node.moduleSpecifier;
        typeOnly = !!node.importClause?.isTypeOnly;
      } else if (ts.isExportDeclaration(node)) {
        path = node.moduleSpecifier;
        typeOnly = node.isTypeOnly;
      } else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        path = node.arguments[0];

        if (!path) failures.push(file + ": missing module");
      }

      if (path) {
        if (!ts.isStringLiteralLike(path)) failures.push(file + ": computed module");
        else {
          const name = path.text;
          const target = resolve(dirname(file), name).replace(/\.tsx?$/, "");

          if (name.startsWith(".")) {
            if (
              !target.startsWith(root + "/") &&
              (target !== resolve(root, "../coding-agent/index") ||
                ((browser || shared) && !typeOnly))
            ) {
              failures.push(relative(root, file) + " -> " + name);
            }

            if ((browser || shared) && target.startsWith(root + "/backend/")) failures.push(name);

            if (target.includes(".test")) failures.push(name);
          } else if ((browser || shared) && /^(node:|bun|@earendil-works)/.test(name))
            failures.push(name);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  expect(failures).toEqual([]);
});

test("components are arrows with colocated styles and tests; implementation files stay small", async () => {
  const failures: string[] = [];

  for await (const file of new Bun.Glob("**/*.{ts,tsx}").scan({ cwd: root, absolute: true })) {
    if (/\/(?:node_modules|dist)\//.test(file) || file.includes(".test.")) continue;

    const text = await Bun.file(file).text();
    const lines = text.split("\n").length;

    if (lines > 200) failures.push(relative(root, file) + ": exceeds 200 lines");

    if (!file.endsWith(".tsx") || file.endsWith("/main.tsx")) continue;

    for (const suffix of [".css", ".test.tsx"]) {
      if (!(await Bun.file(file.replace(/\.tsx$/, suffix)).exists()))
        failures.push(file + ": missing " + suffix);
    }

    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const components = source.statements.filter(
      (statement) =>
        ts.isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            /^[A-Z]/.test(declaration.name.text) &&
            declaration.initializer &&
            ts.isArrowFunction(declaration.initializer),
        ),
    );

    if (components.length !== 1) failures.push(file + ": expected one arrow component");
  }

  expect(failures).toEqual([]);
});
