import { spawn } from "node:child_process";
import type { SourceCommandOptions } from "./source-command-types";

export const sourceCommand = async (
  executable: string,
  args: string[],
  options: SourceCommandOptions = {},
): Promise<void> => {
  await new Promise<void>((yes, no) => {
    const child = spawn(executable, args, { ...options, shell: false, stdio: "inherit" });
    child.once("error", no);
    child.once("exit", (code) =>
      code === 0 ? yes() : no(new Error("Voice source command failed")),
    );
  });
};
