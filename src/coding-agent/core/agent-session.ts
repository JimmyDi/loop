import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";

import { Agent } from "../../agent";
import type { AgentEvent, PromptContent } from "../../agent";
import { getModelEfforts } from "./model-runtime";
import type { ModelEffort } from "./models/model-effort";
import { validateMessages } from "./messages";
import { SessionTitleService } from "./titles/session-title";
import type {
  SessionEvent,
  SessionEventListener,
  SessionOptions,
  SessionState,
} from "./types/session";

export class AgentSession {
  private listeners = new Set<SessionEventListener>();
  private active?: Promise<void>;
  private agent?: Agent;
  private controller?: AbortController;
  private busy = false;
  private disposed = false;
  private draft?: AssistantMessage;
  private selected: Model<Api>;
  private selectedEffort: ModelEffort;
  private outcome: SessionState["outcome"] = "idle";
  private failure?: string;
  private listenerErrors: string[] = [];
  private readonly titles: SessionTitleService;
  private titleError?: string;

  constructor(private readonly options: SessionOptions) {
    this.selected = structuredClone(options.model);
    const effort = options.effort ?? options.sessionManager.getHeader().model?.effort;
    this.selectedEffort =
      effort && getModelEfforts(this.selected).includes(effort) ? effort : "default";
    this.titles = new SessionTitleService(
      options.sessionManager,
      options.modelRuntime,
      options.title,
      (title, error) => {
        this.titleError = error;
        this.emit({ type: "session_title", title, error });
      },
    );
  }

  get sessionManager() {
    return this.options.sessionManager;
  }

  get sessionId(): string {
    return this.sessionManager.getSessionId();
  }

  get sessionFile(): string | undefined {
    return this.sessionManager.getSessionFile();
  }

  get model(): Model<Api> {
    return structuredClone(this.selected);
  }

  get isRunning(): boolean {
    return this.busy;
  }

  get effort(): ModelEffort {
    return this.selectedEffort;
  }

  get state(): SessionState {
    return {
      messages: this.agent?.messages ?? this.sessionManager.messages,
      draft: this.draft ? structuredClone(this.draft) : undefined,
      isRunning: this.busy,
      hasPendingSave: this.sessionManager.hasPendingSave,
      outcome: this.outcome,
      error: this.failure,
      listenerErrors: [...this.listenerErrors],
      title: this.titles.title,
      titleError: this.titleError,
    };
  }

  subscribe(listener: SessionEventListener): () => void {
    if (this.disposed) throw new Error("Session is disposed");

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  prompt(content: PromptContent, options: Record<string, never> = {}): Promise<void> {
    try {
      if (Object.keys(options).length) throw new Error("Prompt options are not supported");

      if (typeof content === "string" ? !content.trim() : !content.length)
        throw new Error("Prompt is required");
      validateMessages([{ role: "user", content, timestamp: 0 }]);

      this.assertIdle();
    } catch (error) {
      return Promise.reject(error);
    }

    this.busy = true;
    this.failure = undefined;
    this.outcome = "idle";
    this.controller = new AbortController();
    this.active = this.run(structuredClone(content), this.controller.signal);

    return this.active;
  }

  async abort(): Promise<void> {
    this.titles.cancel();
    this.controller?.abort(new Error("Run cancelled"));
    this.agent?.abort();
    await this.waitForIdle();
    await this.titles.wait();
  }

  renameTitle(title: string): Promise<void> {
    return this.changeTitle(() => this.titles.rename(title));
  }

  refreshTitle(): Promise<void> {
    return this.changeTitle(() => this.titles.refresh(this.sessionManager.messages, this.selected));
  }

  waitForTitle(): Promise<void> {
    return this.titles.wait();
  }

  async cancelTitle(): Promise<void> {
    this.titles.cancel();
    await this.titles.wait();
  }

  private changeTitle(action: () => Promise<void>): Promise<void> {
    this.assertIdle();
    this.busy = true;
    this.active = action().finally(() => {
      this.busy = false;
    });
    return this.active;
  }

  async waitForIdle(): Promise<void> {
    let activity: Promise<void> | undefined;

    do {
      activity = this.active;
      await activity?.catch(() => {});
    } while (this.active !== activity);
  }

  setModel(
    model: Model<Api>,
    options: { persist?: boolean; effort?: ModelEffort } = {},
  ): Promise<void> {
    try {
      this.assertIdle();

      if (
        options.persist ||
        Object.keys(options).some((key) => key !== "persist" && key !== "effort")
      )
        throw new Error("Persisting model defaults is not supported; edit settings.json");
      if (
        options.effort !== undefined &&
        options.effort !== "default" &&
        !getModelEfforts(model).includes(options.effort)
      )
        throw new Error("Unsupported model effort");
    } catch (error) {
      return Promise.reject(error);
    }

    const selected = structuredClone(model);
    this.titles.cancel();
    const effort =
      options.effort ??
      (getModelEfforts(selected).includes(this.selectedEffort) ? this.selectedEffort : "default");
    this.busy = true;

    this.active = (async () => {
      try {
        await this.options.modelRuntime.checkModel(selected);
        await this.sessionManager.setModel({
          provider: selected.provider,
          id: selected.id,
          effort,
        });
        this.selected = selected;
        this.selectedEffort = effort;
      } finally {
        this.busy = false;
      }
    })();

    return this.active;
  }

  flush(): Promise<void> {
    this.assertIdle(true);
    this.busy = true;
    this.active = this.sessionManager.flush().finally(() => {
      this.busy = false;
    });

    return this.active;
  }

  /** Internal lifecycle reservation: holds ordinary calls during Runtime preparation. */
  reserve(): () => void {
    this.assertIdle();
    this.titles.cancel();
    this.busy = true;

    let released = false;

    return () => {
      if (released) return;

      released = true;
      this.busy = false;
    };
  }

  dispose(): void {
    if (this.disposed) return;

    this.assertIdle();
    this.disposed = true;
    this.titles.dispose();
    this.listeners.clear();
  }

  private assertIdle(allowPending = false): void {
    if (this.disposed) throw new Error("Session is disposed");

    if (this.busy) throw new Error("Session is already running");

    if (!allowPending && this.sessionManager.hasPendingSave)
      throw new Error("Pending session save; call flush first");
  }

  private emit(event: SessionEvent): void {
    const report = (error: unknown) => {
      this.listenerErrors.push(error instanceof Error ? error.message : String(error));
    };

    for (const listener of this.listeners) {
      try {
        const result = listener(structuredClone(event));

        if (result) void Promise.resolve(result).catch(report);
      } catch (error) {
        report(error);
      }
    }
  }

  private onAgentEvent(event: AgentEvent): void {
    if (
      event.type === "message_end" &&
      event.message.role === "user" &&
      this.agent &&
      !this.controller?.signal.aborted
    )
      this.titles.onPrompt(this.agent.messages, this.selected);
    if (
      (event.type === "message_start" || event.type === "message_update") &&
      event.message.role === "assistant"
    )
      this.draft = structuredClone(event.message);

    if (event.type === "message_end" && event.message.role === "assistant") this.draft = undefined;

    this.emit(event);
  }

  private async run(content: PromptContent, signal: AbortSignal): Promise<void> {
    let unsubscribe = () => {};
    const failures: unknown[] = [];

    try {
      await this.options.modelRuntime.checkModel(this.selected, signal);
      signal.throwIfAborted();

      this.agent = new Agent({
        model: this.selected,
        messages: this.sessionManager.messages,
        systemPrompt: this.options.systemPrompt,
        tools: this.options.tools,
        streamFn: this.options.modelRuntime.streamSimple.bind(this.options.modelRuntime),
        streamOptions: {
          reasoning:
            this.selectedEffort === "default" || this.selectedEffort === "off"
              ? undefined
              : this.selectedEffort,
        },
        maxTurns: this.options.maxTurns,
      });
      unsubscribe = this.agent.subscribe((event) => this.onAgentEvent(event));
      await this.agent.prompt(content);
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        if (this.agent) await this.sessionManager.commit(this.agent.messages);
      } catch (error) {
        failures.push(error);
      } finally {
        unsubscribe();
        this.agent = undefined;
        this.draft = undefined;
        this.controller = undefined;
        this.busy = false;
        this.outcome = failures.length ? (signal.aborted ? "cancelled" : "error") : "success";
        this.failure = failures.length
          ? failures
              .map((error) => (error instanceof Error ? error.message : String(error)))
              .join("; ")
          : undefined;
        this.emit({ type: "agent_settled" });
      }
    }

    if (failures.length === 1) throw failures[0];

    if (failures.length > 1) throw new AggregateError(failures, this.failure);
  }
}
