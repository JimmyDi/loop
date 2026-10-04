import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import { useReadState } from "./read-store";

test("read receipts persist only turn identities and never move backward", async () => {
  const window = new Window();
  const previous = globalThis.localStorage;
  const original = useReadState.getState();
  Object.assign(globalThis, { localStorage: window.localStorage });
  try {
    useReadState.setState({ readTurns: {} });
    useReadState.getState().markRead("example", 0);
    useReadState.getState().markRead("example", 4);
    useReadState.getState().markRead("example", 2);
    useReadState.getState().markRead("other", -1);
    useReadState.getState().markRead("other", Number.NaN);
    expect(useReadState.getState().readTurns).toEqual({ example: 4 });
    expect(JSON.parse(window.localStorage.getItem("loop.web.readTurns")!)).toEqual({ example: 4 });
    window.localStorage.setItem = () => {
      throw new Error("Storage unavailable");
    };
    expect(() => useReadState.getState().markRead("other", 0)).not.toThrow();
    expect(useReadState.getState().readTurns.other).toBe(0);
  } finally {
    useReadState.setState(original, true);
    Object.assign(globalThis, { localStorage: previous });
    await window.happyDOM.close();
  }
});

test("reload restores valid read receipts and ignores malformed stored values", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "--eval",
      `
      import { expect } from "bun:test";
      globalThis.localStorage = {
        getItem: () => JSON.stringify({ example: 4, negative: -1, invalid: "4", decimal: 1.5 }),
        setItem: () => {},
      };
      const { useReadState } = await import("./read-store.ts");
      expect(useReadState.getState().readTurns).toEqual({ example: 4 });
    `,
    ],
    { cwd: import.meta.dir },
  );
  expect(result.stderr.toString()).toBe("");
  expect(result.exitCode).toBe(0);
});
