import { spawn } from "node:child_process";
import { once } from "node:events";
export const openBrowser = async (url: string): Promise<void> => {
  const command =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["rundll32", "url.dll,FileProtocolHandler", url]
        : ["xdg-open", url];
  const child = spawn(command[0]!, command.slice(1), { stdio: "ignore" });

  if ((await once(child, "close"))[0] !== 0) throw new Error("Browser could not be opened");
};
