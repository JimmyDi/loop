#!/usr/bin/env bun
import { main } from "./main";

try {
  process.exitCode = await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

// main has already awaited cancellation and persistence; drain output before exit.
await Promise.all([
  new Promise<void>((resolve) => process.stdout.write("", () => resolve())),
  new Promise<void>((resolve) => process.stderr.write("", () => resolve())),
]);
process.exit(Number(process.exitCode ?? 0));
