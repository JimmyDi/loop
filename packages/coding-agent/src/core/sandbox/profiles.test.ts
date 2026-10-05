import { expect, test } from "vitest";

import type { ExecutionPolicy } from "../permissions/types";
import { bubblewrapArgs, seatbeltProfile } from "./profiles";

test("profiles apply protected roots after workspace grants and isolate networking", () => {
  const policy: ExecutionPolicy = {
    preset: "workspace-write",
    workspaceRoot: "/workspace",
    writableRoots: ["/workspace", "/temporary"],
    protectedRoots: ["/workspace/storage"],
  };
  const args = bubblewrapArgs(policy, policy.protectedRoots);
  expect(args).toContain("--unshare-net");
  expect(args).toContain("--unshare-pid");
  expect(args.slice(-3)).toEqual(["--ro-bind", "/workspace/storage", "/workspace/storage"]);
  const profile = seatbeltProfile(policy);
  expect(profile).toContain("(deny network*)");
  expect(profile.indexOf('(deny file-write* (subpath "/workspace/storage"))')).toBeGreaterThan(
    profile.indexOf('(allow file-write* (subpath "/workspace"))'),
  );
  expect(seatbeltProfile({ ...policy, preset: "read-only", writableRoots: [] })).not.toContain(
    "(allow file-write* (subpath",
  );
});
