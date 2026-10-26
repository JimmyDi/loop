import { spawn } from "node:child_process";

export const runNativeBuildCommand = async (command: string, args: string[], cwd: string) => {
  await new Promise<void>((yes, no) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", no);
    child.once("exit", (code) => (code === 0 ? yes() : no(new Error("Native build failed"))));
  });
};
