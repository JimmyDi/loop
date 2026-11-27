import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmdirSync } from "node:fs";
import { dirname, join } from "node:path";

export const registrationEnv = "LOOP_AGENT_CHECKOUT_REGISTRATION";

const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const gitPath = (cwd, option) =>
  git(cwd, "rev-parse", "--path-format=absolute", option).replace(/\r?\n$/, "");

export const getCheckout = (cwd) => ({
  root: gitPath(cwd, "--show-toplevel"),
  registrations: join(gitPath(cwd, "--absolute-git-dir"), "loop-agent-sessions"),
});

export const register = (checkout) => {
  mkdirSync(checkout.registrations, { recursive: true });
  const path = mkdtempSync(join(checkout.registrations, String(process.pid) + "-"));
  return { path, release: () => rmdirSync(path) };
};

const isRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") {
      return false;
    }
    if (error.code === "EPERM") {
      return true;
    }
    throw error;
  }
};

export const checkoutConflict = (checkout, ownRegistration) => {
  let entries;
  try {
    entries = readdirSync(checkout.registrations);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    entries = [];
  }

  for (const entry of entries) {
    const pid = Number(/^([1-9]\d*)-/.exec(entry)?.[1]);
    if (
      pid > 0 &&
      pid <= 0x7fffffff &&
      join(checkout.registrations, entry) !== ownRegistration &&
      isRunning(pid)
    ) {
      return "another guarded agent session is using this checkout";
    }
  }

  const status = git(
    checkout.root,
    "--no-optional-locks",
    "-c",
    "core.fsmonitor=false",
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=normal",
    "--ignore-submodules=none",
  );
  return status ? "this checkout has staged, unstaged, or untracked changes" : undefined;
};

export const addWorktree = (checkout) => {
  const root = mkdtempSync(join(dirname(checkout.root), ".loop-agent-worktree-"));
  try {
    git(checkout.root, "worktree", "add", "--detach", "--quiet", "--", root, "HEAD");
  } catch (error) {
    // Preserve any files Git left behind after a failed checkout.
    try {
      rmdirSync(root);
    } catch (cleanupError) {
      if (cleanupError.code !== "ENOTEMPTY" && cleanupError.code !== "ENOENT") {
        throw new AggregateError([error, cleanupError], "Worktree creation and cleanup failed");
      }
    }
    throw error;
  }
  return getCheckout(root);
};
