import { createInterface } from "node:readline";

import type { AgentSession } from "../core/agent-session";

/** Keep the only pending snapshot alive until storage is repaired. Never rerun a prompt. */
export async function recoverPendingSave(session: AgentSession): Promise<void> {
  if (!session.state.hasPendingSave) return;

  console.error(
    "Save failed. Pending messages remain in memory. Repair storage, then enter /flush.",
  );

  const input = createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: !!process.stdin.isTTY,
  });
  const keepAlive = setInterval(() => {}, 1000);
  const refuseExit = () =>
    console.error("Pending save retained; use /flush after repairing storage.");

  process.on("SIGINT", refuseExit);
  process.on("SIGTERM", refuseExit);
  input.on("SIGINT", refuseExit);

  try {
    await new Promise<void>((resolve) => {
      input.on("line", (line) => {
        if (line.trim() !== "/flush") {
          refuseExit();
          return;
        }

        void Promise.resolve()
          .then(() => session.flush())
          .then(resolve, (error: unknown) => {
            console.error(error instanceof Error ? error.message : String(error));
          });
      });
      input.on("close", refuseExit);
    });
  } finally {
    clearInterval(keepAlive);
    input.removeAllListeners();
    input.close();
    process.stdin.pause();
    process.off("SIGINT", refuseExit);
    process.off("SIGTERM", refuseExit);
  }
}
