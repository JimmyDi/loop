import { join } from "node:path";
import { expect, test } from "vitest";

import { getProfileDir } from "./profile";

test("profile selection uses stable IDs and rejects traversal", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(getProfileDir(id, "data")).toBe(join("data", "users", id));
  for (const invalid of ["../other", "", "admin", "/root"])
    expect(() => getProfileDir(invalid)).toThrow();
});
