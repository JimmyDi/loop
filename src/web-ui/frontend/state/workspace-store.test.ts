import { afterEach, expect, test } from "bun:test";

import { useWorkspace } from "./workspace-store";

const initial = useWorkspace.getState();

afterEach(() => useWorkspace.setState(initial, true));

test("selecting sessions retains their drafts and image ownership without an open-session list", () => {
  useWorkspace.setState({ active: undefined, drafts: {}, images: {}, draftProjects: {} });
  const state = useWorkspace.getState();
  const first = { id: "a", workspaceId: "p" };
  const second = { id: "b", workspaceId: "q" };
  const images = [{ type: "image" as const, mimeType: "image/png", data: "AAAA" }];

  state.open(first);
  state.draft("a", "Keep");
  state.toggleSidebar(true);
  state.open(second);
  // An image read started in the previous session can finish after switching.
  state.attach("a", images);
  state.draft("b", "Other draft");
  expect(useWorkspace.getState().active).toEqual(second);
  expect(useWorkspace.getState().sidebar).toBe(false);
  expect(useWorkspace.getState().draftProjects).toEqual({ a: "p", b: "q" });
  state.open(first);
  expect(useWorkspace.getState().drafts.a).toBe("Keep");
  expect(useWorkspace.getState().images.a).toEqual(images);
  state.open(second);
  state.removeProject("p");
  expect(useWorkspace.getState().active).toEqual(second);
  expect(useWorkspace.getState().drafts).toEqual({ b: "Other draft" });
  expect(useWorkspace.getState().images).toEqual({});
  expect(useWorkspace.getState().draftProjects).toEqual({ b: "q" });
  state.removeProject("q");
  expect(useWorkspace.getState().active).toBeUndefined();
  expect(useWorkspace.getState().drafts).toEqual({});
});

test("removing the selected project returns to welcome without selecting another history entry", () => {
  const state = useWorkspace.getState();
  state.open({ id: "previous", workspaceId: "other" });
  state.open({ id: "selected", workspaceId: "removed" });
  state.removeProject("removed");
  expect(useWorkspace.getState().active).toBeUndefined();
});

test.each(
  [null, { id: "current", workspaceId: "project" }, 42, [], { id: "bad" }].map((saved) => ({
    saved,
  })),
)("session selection restores validated storage: %j", ({ saved }) => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
          import { expect } from "bun:test";
          const saved = ${JSON.stringify(saved)};
          const stored = new Map([
            ["loop.web.activeSession", JSON.stringify(saved)],
            ["loop.web.drafts", JSON.stringify({ existing: "Keep draft" })],
            ["loop.web.draftProjects", JSON.stringify({ existing: "project" })],
          ]);
          globalThis.localStorage = {
            getItem: (key) => stored.get(key) ?? null,
            setItem: (key, value) => stored.set(key, value),
          };
          const { useWorkspace } = await import("./workspace-store.ts");
          const state = useWorkspace.getState();
          expect(state.active).toEqual(saved?.workspaceId ? saved : undefined);
          expect(state.drafts.existing).toBe("Keep draft");
          expect(state.draftProjects.existing).toBe("project");
          expect(state).not.toHaveProperty("tabs");
          expect(state).not.toHaveProperty("close");
          expect(state).not.toHaveProperty("title");
          state.open({ id: "next", workspaceId: "project" });
          expect(JSON.parse(stored.get("loop.web.activeSession"))).toEqual({ id: "next", workspaceId: "project" });
          state.removeProject("project");
          expect(JSON.parse(stored.get("loop.web.activeSession"))).toBeNull();
        `,
    ],
    { cwd: import.meta.dir },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});

test("session selection tolerates unavailable browser storage", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
        import { expect } from "bun:test";
        Object.defineProperty(globalThis, "localStorage", {
          get() { throw new Error("Unavailable"); },
        });
        const { useWorkspace } = await import("./workspace-store.ts");
        expect(useWorkspace.getState().active).toBeUndefined();
        useWorkspace.getState().open({ id: "selected", workspaceId: "project" });
        expect(useWorkspace.getState().active?.id).toBe("selected");
      `,
    ],
    { cwd: import.meta.dir },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
