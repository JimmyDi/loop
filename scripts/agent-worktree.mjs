import { spawn } from "node:child_process";
import { constants } from "node:os";
import {
  addWorktree,
  checkoutConflict,
  getCheckout,
  register,
  registrationEnv,
} from "./agent-worktree-checkout.mjs";

const runAgent = (command, args, checkout, registration) => {
  const child = spawn(command, args, {
    cwd: checkout.root,
    env: { ...process.env, [registrationEnv]: registration.path },
    stdio: "inherit",
  });
  // Interactive terminals send Ctrl+C to both processes in the foreground group.
  const forwardInterrupt = () => {
    if (!process.stdin.isTTY) {
      child.kill("SIGINT");
    }
  };
  const forwardTermination = () => child.kill("SIGTERM");
  const forwardHangup = () => child.kill("SIGHUP");
  process.on("SIGINT", forwardInterrupt);
  process.on("SIGTERM", forwardTermination);
  process.on("SIGHUP", forwardHangup);
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve(code ?? 128 + constants.signals[signal]));
  }).finally(() => {
    process.off("SIGINT", forwardInterrupt);
    process.off("SIGTERM", forwardTermination);
    process.off("SIGHUP", forwardHangup);
  });
};

const launch = async ([command, ...args]) => {
  if (!command) {
    throw new Error("Usage: node scripts/agent-worktree.mjs <agent-command> [arguments...]");
  }
  let checkout = getCheckout(process.cwd());
  let registration = register(checkout);
  try {
    const conflict = checkoutConflict(checkout, registration.path);
    if (conflict) {
      checkout = addWorktree(checkout);
      const isolatedRegistration = register(checkout);
      registration.release();
      registration = isolatedRegistration;
      process.stderr.write("Using worktree " + checkout.root + " because " + conflict + ".\n");
    }
    return await runAgent(command, args, checkout, registration);
  } finally {
    registration.release();
  }
};

try {
  process.exitCode = await launch(process.argv.slice(2));
} catch (error) {
  process.stderr.write("Agent launcher failed: " + error.message + "\n");
  process.exitCode = 1;
}
