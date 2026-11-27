import { execFileSync, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const launcher = join(import.meta.dirname, "agent-worktree.mjs");
const hook = join(import.meta.dirname, "agent-worktree-hook.mjs");
const printCwd = "process.stdout.write(process.cwd())";

let fixture: string;
let source: string;

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const launch = (cwd = source) =>
  execFileSync(process.execPath, [launcher, process.execPath, "-e", printCwd], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

const checkHook = () =>
  execFileSync(process.execPath, [hook], {
    cwd: source,
    encoding: "utf8",
    input: JSON.stringify({ cwd: source }),
  });

beforeEach(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "loop-agent-test-")));
  source = join(fixture, "example repo");
  mkdirSync(source);
  git(source, "init", "--quiet");
  git(source, "config", "core.hooksPath", join(fixture, "empty-hooks"));
  writeFileSync(join(source, "tracked.txt"), "committed\n");
  writeFileSync(join(source, ".gitignore"), "ignored.txt\n");
  git(source, "add", ".");
  git(
    source,
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--quiet",
    "-m",
    "Fixture",
  );
});

afterEach(() => rmSync(fixture, { recursive: true, force: true }));

describe("agent worktree launcher", () => {
  it("reuses a clean checkout when started below its root", () => {
    writeFileSync(join(source, "ignored.txt"), "ignored\n");
    const subdir = join(source, "nested");
    mkdirSync(subdir);
    expect(launch(subdir)).toBe(source);
    expect(checkHook()).toBe("");
  });

  it.each(["staged", "unstaged", "untracked"])("isolates %s changes", (kind) => {
    writeFileSync(join(source, kind === "untracked" ? "untracked.txt" : "tracked.txt"), "local\n");
    if (kind === "staged") {
      git(source, "add", "tracked.txt");
    }
    const before = git(source, "status", "--porcelain");
    const result = JSON.parse(checkHook());
    expect(result.hookSpecificOutput).toMatchObject({
      hookEventName: "SessionStart",
      additionalContext: expect.stringContaining(
        "this checkout has staged, unstaged, or untracked changes",
      ),
    });
    const target = launch();
    expect(target).not.toBe(source);
    expect(git(target, "rev-parse", "HEAD")).toBe(git(source, "rev-parse", "HEAD"));
    expect(git(target, "status", "--porcelain")).toBe("");
    expect(git(source, "status", "--porcelain")).toBe(before);
  });

  it("does not start the agent if a dirty checkout has no committed base", () => {
    const unborn = join(fixture, "unborn");
    mkdirSync(unborn);
    git(unborn, "init", "--quiet");
    writeFileSync(join(unborn, "untracked.txt"), "local\n");
    const result = spawnSync(process.execPath, [launcher, process.execPath, "-e", printCwd], {
      cwd: unborn,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Agent launcher failed");
    expect(git(unborn, "status", "--porcelain")).toBe("?? untracked.txt\n");
  });

  it.each([".codex/hooks.json", ".claude/settings.json"])(
    "runs the configured %s hook from a subdirectory",
    (config) => {
      const repo = dirname(import.meta.dirname);
      const settings = JSON.parse(readFileSync(join(repo, config), "utf8"));
      const command: string = settings.hooks.SessionStart[0].hooks[0].command;
      mkdirSync(join(source, "scripts"));
      for (const script of ["agent-worktree-hook.mjs", "agent-worktree-checkout.mjs"]) {
        writeFileSync(join(source, "scripts", script), readFileSync(join(repo, "scripts", script)));
      }
      const cwd = join(source, "scripts");
      const output = execFileSync("bash", ["-c", command], {
        cwd,
        env: { ...process.env, CLAUDE_PROJECT_DIR: source },
        encoding: "utf8",
        input: JSON.stringify({ cwd }),
      });
      expect(JSON.parse(output).hookSpecificOutput.additionalContext).toContain("Workspace check:");
    },
  );

  it("isolates a second launcher before the first agent writes and releases on exit", async () => {
    const child = spawn(
      process.execPath,
      [launcher, process.execPath, "-e", printCwd + "; process.stdin.resume()"],
      {
        cwd: source,
        stdio: ["pipe", "pipe", "inherit"],
      },
    );
    const closed = new Promise((resolve) => child.once("close", resolve));
    try {
      const cwd = await new Promise((resolve, reject) => {
        child.stdout.once("data", (value: Buffer) => resolve(value.toString()));
        child.once("error", reject);
        void closed.then(() =>
          reject(new Error("First launcher exited before its agent was ready")),
        );
      });
      expect(cwd).toBe(source);
      expect(checkHook()).toContain("another guarded agent session");
      const second = launch();
      expect(second).not.toBe(source);
      expect(launch(second)).toBe(second);
    } finally {
      child.stdin.end();
      await closed;
    }
    expect(launch()).toBe(source);
  });
});
