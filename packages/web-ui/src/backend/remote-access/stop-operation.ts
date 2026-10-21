import type { RemoteAccessStatus } from "../../shared/remote-access";
import type { RemoteRuntime } from "./cli-runtime";
import { RemoteAccessError } from "./errors";
import { stepError, updateStepFailures } from "./step-failures";

type StopContext = {
  read(): RemoteAccessStatus;
  update(state: RemoteAccessStatus): void;
  cancel(): Promise<void>;
  runtime(create?: boolean): RemoteRuntime | undefined;
  signIn(signedIn: boolean): Promise<void>;
  saveConnection?(enabled: boolean): Promise<void>;
};

export const runStop = async (
  context: StopContext,
  logout: boolean,
  preserveConnection: boolean,
): Promise<void> => {
  let step: "login" | "start" = "start";
  context.update({
    ...context.read(),
    ...updateStepFailures(context.read(), "start", "passed"),
    phase: "stopping",
    url: undefined,
    download: undefined,
    error: undefined,
    errorStep: undefined,
  });
  await context.cancel();
  let saveError: unknown;
  if (!preserveConnection) {
    try {
      await context.saveConnection?.(false);
    } catch (error) {
      saveError = error;
    }
  }
  try {
    await context.runtime()?.close();
    if (saveError) throw saveError;
    if (logout && context.read().supported) {
      step = "login";
      context.update({ ...context.read(), phase: "signing-out" });
      await context.signIn(false);
      const runtime = context.runtime(true)!;
      const installed = await runtime.installed(new AbortController().signal);
      context.update({ ...context.read(), installed });
      if (installed) await runtime.logout();
      context.update({
        ...context.read(),
        ...updateStepFailures(context.read(), "login", "passed"),
      });
    }
    context.update({ ...context.read(), phase: "off" });
  } catch (error) {
    context.update({
      ...context.read(),
      ...stepError(step, error instanceof RemoteAccessError ? error.code : "cli_failed"),
    });
  }
};
