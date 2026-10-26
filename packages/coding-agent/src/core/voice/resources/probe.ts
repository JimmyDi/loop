import { spawn } from "node:child_process";
import { join } from "node:path";

import { componentDirectory } from "./resource-paths";
import type { VoiceComponent } from "./resource-types";

export const probeVoiceEngine = async (
  root: string,
  component: VoiceComponent,
  executable: string,
  signal?: AbortSignal,
): Promise<void> => {
  signal?.throwIfAborted();
  await new Promise<void>((yes, no) => {
    const child = spawn(join(componentDirectory(root, component), executable), ["--version"], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    let output = "",
      finished = false;
    const settle = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      error ? no(error) : yes();
    };
    const abort = () => {
      child.kill("SIGKILL");
      settle(new Error("voice_resource_operation_cancelled"));
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      settle(new Error("voice_engine_probe_failed"));
    }, 10_000);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
      if (output.length > 4096) {
        child.kill("SIGKILL");
        settle(new Error("voice_engine_probe_failed"));
      }
    });
    child.once("error", () => settle(new Error("voice_engine_probe_failed")));
    child.once("close", (code) =>
      settle(
        code === 0 &&
          /^loop-voice\/1[.]0[.]0 protocol\/1 sherpa\/2[.]0[.]0 onnxruntime\/[0-9.]+\s*$/.test(
            output,
          )
          ? undefined
          : new Error("voice_engine_probe_failed"),
      ),
    );
  });
};
