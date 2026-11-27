import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { checkoutConflict, getCheckout, registrationEnv } from "./agent-worktree-checkout.mjs";

const report = (additionalContext) => {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext },
    }) + "\n",
  );
};

try {
  const { cwd } = JSON.parse(readFileSync(0, "utf8"));
  const checkout = getCheckout(cwd);
  const ownRegistration = process.env[registrationEnv];
  if (!ownRegistration || dirname(ownRegistration) !== checkout.registrations) {
    const conflict = checkoutConflict(checkout);
    if (conflict) {
      report(
        "Workspace check: " +
          conflict +
          ". Follow the worktree workflow in AGENTS.md before editing. Reuse an isolated worktree assigned to this task.",
      );
    }
  }
} catch {
  report(
    "Workspace check failed. Before editing, verify checkout isolation using the workflow in AGENTS.md.",
  );
}
