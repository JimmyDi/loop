import { expect, test } from "bun:test";

test("browser launcher module has no import-time browser or process side effects", async () => {
  const child = Bun.spawn(
    [
      process.execPath,
      "-e",
      "await import(process.argv[1]);",
      import.meta.dir + "/open-browser.ts",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  expect(await new Response(child.stdout).text()).toBe("");
  expect(await new Response(child.stderr).text()).toBe("");
  expect(await child.exited).toBe(0);
});
