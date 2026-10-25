import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat } from "node:fs/promises";
import { dirname } from "node:path";

import { HttpError } from "../http/errors";

export const revealSession = async (sessionFile: string | undefined): Promise<void> => {
  if (!sessionFile) throw new HttpError(409, "session_not_saved");
  const folder = dirname(sessionFile);
  if (!(await stat(folder)).isDirectory()) throw new HttpError(404, "session_folder_not_found");
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "explorer.exe"
        : "xdg-open";
  const child = spawn(command, [folder], { stdio: "ignore" });
  const [code] = await once(child, "close");
  // Explorer can report 1 when handing off to an existing file manager window.
  if (code !== 0 && !(process.platform === "win32" && code === 1))
    throw new HttpError(500, "session_folder_open_failed");
};
