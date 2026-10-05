import { dirname } from "node:path";

import type { ExecutionPolicy } from "../permissions/types";

const quote = (value: string): string => JSON.stringify(value);

export const seatbeltProfile = (policy: ExecutionPolicy): string => {
  const rules = [
    "(version 1)",
    "(allow default)",
    "(deny network*)",
    "(deny mach-lookup)",
    "(deny process-info* (target others))",
    "(deny signal (target others))",
    "(deny file-write*)",
    '(allow file-write* (literal "/dev/null"))',
  ];
  for (const root of policy.writableRoots)
    rules.push(`(allow file-write* (subpath ${quote(root)}))`);
  for (const root of policy.protectedRoots) {
    rules.push(`(deny file-write* (subpath ${quote(root)}))`);
    // Renaming an ancestor would move protected data without accessing its leaves.
    for (let parent = dirname(root); parent !== dirname(parent); parent = dirname(parent)) {
      rules.push(`(deny file-write-unlink (literal ${quote(parent)}))`);
    }
  }
  return rules.join("\n");
};

export const bubblewrapArgs = (policy: ExecutionPolicy, protectedMounts: string[]): string[] => {
  const args = [
    "--unshare-user",
    "--unshare-pid",
    "--unshare-net",
    "--unshare-ipc",
    "--unshare-uts",
    "--new-session",
    "--die-with-parent",
    "--cap-drop",
    "ALL",
    "--ro-bind",
    "/",
    "/",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
  ];
  for (const root of policy.writableRoots) args.push("--bind", root, root);
  // More specific protected mounts override a writable workspace bind.
  for (const root of [...new Set(protectedMounts)].sort((a, b) => a.length - b.length)) {
    args.push("--ro-bind", root, root);
  }
  return args;
};
