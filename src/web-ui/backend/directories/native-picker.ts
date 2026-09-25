import type { DirectoryCapabilities } from "../../shared/protocol";
import { HttpError } from "../http/errors";

export const directoryCapabilities = (
  platform = process.platform,
  env: Record<string, string | undefined> = process.env,
): DirectoryCapabilities => {
  const native = platform === "darwin" && !env.SSH_CONNECTION && !env.SSH_TTY;

  return { native, preferred: native ? "native" : "browse" };
};

type PickerRunner = (
  signal: AbortSignal,
) => Promise<{ code: number; output: string; error: string }>;

const runPicker: PickerRunner = async (signal) => {
  const child = Bun.spawn(
    ["osascript", "-e", 'POSIX path of (choose folder with prompt "Select project directory")'],
    { stdout: "pipe", stderr: "pipe", signal },
  );
  const [code, output, error] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  return { code, output, error };
};

export const createNativePicker = (
  run = runPicker,
  available = () => directoryCapabilities().native,
) => {
  let busy = false;

  return async (signal: AbortSignal): Promise<string | null> => {
    if (!available()) throw new HttpError(409, "native_unavailable");

    if (busy) throw new HttpError(409, "picker_busy");

    signal.throwIfAborted();
    busy = true;

    try {
      const { code, output, error } = await run(signal);

      signal.throwIfAborted();

      if (code !== 0 && /-128|User canceled/i.test(error)) return null;

      if (code !== 0) throw new HttpError(500, "native_unavailable");

      return output.replace(/[\r\n]+$/, "") || null;
    } finally {
      busy = false;
    }
  };
};
