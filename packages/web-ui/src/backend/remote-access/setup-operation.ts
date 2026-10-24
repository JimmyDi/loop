import type { RemoteAccessStatus } from "../../shared/remote-access";
import type { RemoteRuntime } from "./cli-runtime";
import type { SetupCommand } from "./command-phase";
import { RemoteAccessError } from "./errors";
import { completeStep, resetSteps, stepError, updateStepFailures } from "./step-failures";

type SetupContext = {
  read(): RemoteAccessStatus;
  update(state: RemoteAccessStatus): void;
  runtime(): RemoteRuntime;
  signIn(signedIn: boolean): Promise<void>;
  saveConnection?(enabled: boolean): Promise<void>;
  failed(): void;
};

export const runSetup = async (
  command: SetupCommand,
  context: SetupContext,
  signal: AbortSignal,
  restoring = false,
): Promise<void> => {
  const previous = context.read();
  let step: "install" | "login" | "start" = "install";
  let runtime: RemoteRuntime | undefined;
  try {
    runtime = context.runtime();
    if (command === "uninstall") {
      await context.saveConnection?.(false);
      await context.signIn(false);
      signal.throwIfAborted();
      await runtime.uninstall();
      context.update(resetSteps(context.read()));
      return;
    }
    const installed = await runtime.installed(signal);
    signal.throwIfAborted();
    context.update({ ...context.read(), installed });
    if (restoring && (!installed || !context.read().signedIn)) {
      await context.saveConnection?.(false);
      if (!installed) await context.signIn(false);
      signal.throwIfAborted();
      context.update({ ...context.read(), phase: "off" });
      return;
    }
    if (!installed) {
      await context.saveConnection?.(false);
      await context.signIn(false);
      signal.throwIfAborted();
      context.update({ ...context.read(), phase: "installing" });
      await runtime.install(signal, (download) => {
        if (!signal.aborted) context.update({ ...context.read(), download });
      });
    }
    signal.throwIfAborted();
    context.update(completeStep(context.read(), "install"));
    if (command === "install") {
      context.update({ ...context.read(), phase: "off" });
      return;
    }
    if (command === "login" || !context.read().signedIn) {
      step = "login";
      context.update({ ...context.read(), phase: "signing-in" });
      await context.saveConnection?.(false);
      await context.signIn(false);
      signal.throwIfAborted();
      await runtime.login(signal);
      signal.throwIfAborted();
      await context.signIn(true);
      signal.throwIfAborted();
      context.update(completeStep(context.read(), "login"));
    }
    if (command === "login") {
      context.update({ ...context.read(), phase: "off" });
      return;
    }
    step = "start";
    context.update({ ...context.read(), phase: "connecting" });
    const url = await runtime.start(signal, context.failed, (url) => {
      if (signal.aborted) return;
      context.update({
        ...context.read(),
        phase: url ? "connected" : "connecting",
        url,
      });
    });
    signal.throwIfAborted();
    await context.saveConnection?.(true);
    signal.throwIfAborted();
    context.update({ ...completeStep(context.read(), "start"), url });
  } catch (error) {
    await runtime?.close().catch(() => {});
    if (error instanceof RemoteAccessError && error.code === "connection_state_failed")
      step = "start";
    if (!signal.aborted)
      context.update({
        ...context.read(),
        ...(command === "uninstall"
          ? {}
          : updateStepFailures(context.read(), step, "failed", previous)),
        signedIn: step === "login" ? false : context.read().signedIn,
        ...stepError(step, error instanceof RemoteAccessError ? error.code : "cli_failed"),
      });
  }
};
