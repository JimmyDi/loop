import { expect, test } from "bun:test";

import { sandboxEnvironment } from "./environment";

test("confined environment excludes credentials and interpreter startup hooks", () => {
  const keys = ["LOOP_SANDBOX_TEST_SECRET", "BASH_ENV", "NODE_OPTIONS"];
  const previous = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) process.env[key] = "synthetic-test-value";
    const env = sandboxEnvironment("/temporary");
    for (const key of keys) expect(env[key]).toBeUndefined();
    expect(env.TMPDIR).toBe("/temporary");
    expect(env.TMP).toBe("/temporary");
    expect(env.PATH).toBeDefined();
  } finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
});
