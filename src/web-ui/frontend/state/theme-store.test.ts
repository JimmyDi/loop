import { expect, test } from "bun:test";

test.each([null, "light", "dark", "system", "invalid", 42, { theme: "dark" }])(
  "theme validates saved preference %j without persisting the browser default",
  (saved) => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "--eval",
        `
          import { expect } from "bun:test";
          const saved = ${JSON.stringify(saved)};
          const stored = new Map();
          globalThis.document = { documentElement: { dataset: {} } };
          globalThis.localStorage = {
            getItem: () => saved === null ? null : JSON.stringify(saved),
            setItem: (key, value) => stored.set(key, value),
          };
          const { initializeTheme, useTheme } = await import("./theme-store.ts");
          const expected = saved === "light" || saved === "dark" ? saved : "system";
          initializeTheme();
          expect(useTheme.getState().theme).toBe(expected);
          expect(document.documentElement.dataset.theme).toBe(expected);
          expect(stored.size).toBe(0);
          useTheme.getState().setTheme("dark");
          expect(document.documentElement.dataset.theme).toBe("dark");
          expect(stored.get("loop.web.theme")).toBe(JSON.stringify("dark"));
          useTheme.getState().setTheme("system");
          expect(document.documentElement.dataset.theme).toBe("system");
          expect(stored.get("loop.web.theme")).toBe(JSON.stringify("system"));
        `,
      ],
      { cwd: import.meta.dir },
    );

    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  },
);

test.each(["corrupt", "unavailable"])("theme handles %s browser storage", (storage) => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
        import { expect } from "bun:test";
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          get() {
            if (${JSON.stringify(storage)} === "unavailable") throw new Error("Unavailable");
            return { getItem: () => "{invalid", setItem: () => { throw new Error("Full"); } };
          },
        });
        const { initializeTheme, useTheme } = await import("./theme-store.ts");
        expect(useTheme.getState().theme).toBe("system");
        expect(() => initializeTheme()).not.toThrow();
        globalThis.document = { documentElement: { dataset: {} } };
        useTheme.getState().setTheme("light");
        expect(document.documentElement.dataset.theme).toBe("light");
        expect(useTheme.getState().theme).toBe("light");
      `,
    ],
    { cwd: import.meta.dir },
  );

  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
