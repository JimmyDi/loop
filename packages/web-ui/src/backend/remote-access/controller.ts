import type { RemoteAccessCommand, RemoteAccessStatus } from "../../shared/remote-access";
import type { RemoteRuntime } from "./cli-runtime";
import type { SetupCommand } from "./command-phase";
import { commandPhase } from "./command-phase";
import { RemoteAccessError } from "./errors";
import { checkInstallation } from "./status-check";
import { runSetup } from "./setup-operation";
import { runStop } from "./stop-operation";
import { stepError, updateStepFailures } from "./step-failures";

type Dependencies = {
  supported: boolean;
  signedIn?: boolean;
  saveSignIn?(signedIn: boolean): Promise<void>;
  saveConnection?(enabled: boolean): Promise<void>;
  runtime(): RemoteRuntime;
};

export class RemoteAccessController {
  private state: RemoteAccessStatus;
  private runtime?: RemoteRuntime;
  private abort?: AbortController;
  private operation?: Promise<void>;
  private stopping?: Promise<void>;
  private checking?: { abort: AbortController; promise: Promise<void> };
  private closed = false;

  constructor(private readonly dependencies: Dependencies) {
    this.state = {
      supported: dependencies.supported,
      installed: false,
      signedIn: dependencies.signedIn ?? false,
      phase: "off",
    };
  }

  status(): RemoteAccessStatus {
    return structuredClone(this.state);
  }

  restore(): void {
    if (
      this.closed ||
      !this.state.supported ||
      this.state.phase !== "off" ||
      this.operation ||
      this.stopping ||
      this.checking
    )
      return;
    const abort = new AbortController();
    this.abort = abort;
    this.state.phase = "connecting";
    this.operation = this.run("start", abort.signal, true).finally(() => {
      this.operation = undefined;
    });
  }

  async refresh(): Promise<RemoteAccessStatus> {
    if (this.closed) throw new Error("Remote access is closed");
    if (!this.state.supported || this.operation || this.stopping) return this.status();
    if (!this.checking) {
      const abort = new AbortController();
      const promise = this.check(abort.signal).finally(() => {
        this.checking = undefined;
      });
      this.checking = { abort, promise };
    }
    await this.checking.promise;
    return this.status();
  }

  command(command: RemoteAccessCommand): void {
    if (this.closed) throw new Error("Remote access is closed");
    if (command === "pause" || command === "resume") {
      if (
        this.state.phase !== "installing" ||
        this.stopping ||
        !this.runtime?.pauseDownload(command === "pause")
      )
        throw new Error("Download is not active");
      return;
    }
    if (command === "stop" || command === "logout") {
      if (this.stopping) throw new Error("Remote access is busy");
      this.stopping = this.stop(command === "logout").finally(() => {
        this.stopping = undefined;
      });
      return;
    }
    if (this.operation || this.stopping || this.checking || this.state.phase === "connected")
      throw new Error("Remote access is busy");
    if (!this.state.supported) {
      this.state = { ...this.state, phase: "error", error: "unsupported_platform" };
      return;
    }
    const abort = new AbortController();
    this.abort = abort;
    this.state = {
      ...this.state,
      phase: commandPhase(command, this.state),
      error: undefined,
      errorStep: undefined,
      url: undefined,
      download: undefined,
    };
    this.operation = this.run(command, abort.signal).finally(() => {
      this.operation = undefined;
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    await (this.stopping ?? this.stop(false, true));
  }

  private async check(signal: AbortSignal): Promise<void> {
    try {
      this.runtime ??= this.dependencies.runtime();
      const checked = await checkInstallation(this.runtime, this.state, signal);
      signal.throwIfAborted();
      if (!checked.installed) {
        await this.dependencies.saveConnection?.(false);
        await this.signIn(false);
      }
      signal.throwIfAborted();
      this.state = checked;
    } catch (error) {
      if (!signal.aborted)
        throw new RemoteAccessError(error instanceof RemoteAccessError ? error.code : "cli_failed");
    }
  }

  private run(command: SetupCommand, signal: AbortSignal, restoring = false): Promise<void> {
    return runSetup(
      command,
      {
        read: () => this.status(),
        update: (state) => {
          this.state = state;
        },
        runtime: () => (this.runtime ??= this.dependencies.runtime()),
        signIn: (signedIn) => this.signIn(signedIn),
        saveConnection: this.dependencies.saveConnection,
        failed: () => {
          if (signal.aborted || this.stopping || this.closed) return;
          const failures = updateStepFailures(this.state, "start", "failed");
          this.stopping = this.stop(false, true)
            .then(() => {
              this.state = { ...this.state, ...failures, ...stepError("start", "tunnel_failed") };
            })
            .finally(() => {
              this.stopping = undefined;
            });
        },
      },
      signal,
      restoring,
    );
  }

  private async signIn(signedIn: boolean): Promise<void> {
    if (!signedIn) this.state.signedIn = false;
    await this.dependencies.saveSignIn?.(signedIn);
    this.state.signedIn = signedIn;
  }

  private stop(logout: boolean, preserveConnection = false): Promise<void> {
    return runStop(
      {
        read: () => this.status(),
        update: (state) => {
          this.state = state;
        },
        cancel: async () => {
          this.abort?.abort();
          this.checking?.abort.abort();
          await this.checking?.promise.catch(() => {});
          await this.operation;
          this.abort = undefined;
        },
        runtime: (create) =>
          create ? (this.runtime ??= this.dependencies.runtime()) : this.runtime,
        signIn: (signedIn) => this.signIn(signedIn),
        saveConnection: this.dependencies.saveConnection,
      },
      logout,
      preserveConnection,
    );
  }
}
