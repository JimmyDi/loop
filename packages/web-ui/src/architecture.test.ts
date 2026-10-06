import glob from "fast-glob";
import { relative } from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { expect, test } from "vitest";
import ts from "typescript";

const root = import.meta.dirname;

// Existing leaf components are styled/tested by their owning compositions.
// Keep this explicit so new components cannot silently skip companion coverage.
const compositionOwners: Record<string, { style?: string; test?: string }> = {
  "projects/SessionPinIcon": { style: "projects/SessionItem", test: "projects/SessionItem" },
  "ui/LoopIcon": { test: "layout/Sidebar" },
  "settings/DefaultPermissionSelect": { test: "settings/GeneralSettings" },
  "chat/ToolStatusIcon": { test: "chat/ToolCard" },
  "chat/ApprovalDetails": { test: "chat/ApprovalCard" },
  "chat/AssistantContent": { style: "chat/AssistantMessage", test: "chat/AssistantMessage" },
  "chat/AssistantTurn": { style: "chat/AssistantMessage" },
  "chat/FullAccessDialog": { test: "chat/SessionPermissions" },
  "chat/MessageFooter": { test: "chat/AssistantMessage" },
  "chat/PermissionIcon": { style: "chat/SessionPermissions", test: "chat/SessionPermissions" },
  "chat/TextFileAttachment": { test: "chat/ComposerAttachments" },
  "chat/ToolActionIcon": { test: "chat/ToolCard" },
};
// Session orchestration has a separate limit; other implementation files stay at 200 lines.
const implementationLimits: Record<string, number> = {
  "backend/session-controller.ts": 230,
  "backend/session-registry.ts": 240,
};

test("components are arrows with colocated styles and tests; implementation files stay small", async () => {
  const failures: string[] = [];

  for await (const file of await glob("**/*.{ts,tsx}", {
    cwd: root,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  })) {
    if (/\/(?:node_modules|dist)\//.test(file) || file.includes(".test.")) continue;

    const text = await readFile(file, "utf8");
    const lines = text.split("\n").length;

    const path = relative(root, file).replaceAll("\\", "/");
    if (!/^frontend\/i18n\/(en|zh)\.ts$/.test(path) && lines > (implementationLimits[path] ?? 200))
      failures.push(path + ": exceeds implementation limit");

    if (!file.endsWith(".tsx") || file.endsWith("/main.tsx")) continue;

    for (const suffix of [".css", ".test.tsx"]) {
      const key = relative(root + "/frontend/components", file)
        .replaceAll("\\", "/")
        .replace(/\.tsx$/, "");
      const owner = compositionOwners[key]?.[suffix === ".css" ? "style" : "test"];
      const companion = owner
        ? root + "/frontend/components/" + owner + suffix
        : file.replace(/\.tsx$/, suffix);
      if (!existsSync(companion)) failures.push(file + ": missing " + suffix);
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
