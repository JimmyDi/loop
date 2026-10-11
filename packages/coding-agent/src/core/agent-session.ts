import type { Api, AssistantMessage, Model } from "@earendil-works/pi-ai";
import { randomUUID } from "node:crypto";

import { Agent } from "@loop/agent";
import type { AgentEvent, AgentRequestConfiguration, PromptContent } from "@loop/agent";
import { ApprovalService } from "./approvals/approval-service";
import { ToolApprovals } from "./approvals/tool-approvals";
import type {
  ApprovalHandler,
  ApprovalInput,
  ApprovalRequestOptions,
  ApprovalResponse,
  ApprovalResult,
} from "./approvals/types";
import { getModelEfforts } from "./model-runtime";
import type { ModelEffort } from "./models/model-effort";
import { validateRequestMaxTokens } from "./models/output-budget";
import { validateMessages } from "./messages";
import { SessionTitleService } from "./titles/session-title";
import type { PermissionPreset } from "./permissions/types";
import { approvalPolicyFor, DEFAULT_PERMISSION_PRESET } from "./permissions/types";
import type {
  SessionEvent,
  SessionEventListener,
  SessionOptions,
  SessionState,
} from "./types/session";

import type { PromptTiming } from "./prompt-timing";
import type { ContextBudget } from "./context-budget";
import type { ModelInputProjection } from "./model-input-projection";
import { withToolDisplayName } from "./tool-display";
import type { PermissionTool } from "./approvals/tool-approvals";
import type { LoadedSkill } from "./skills/types";
import { estimateSessionContextBudget } from "./context/session-context-budget";
import { compactSession } from "./context/compact-session";
import { NothingToCompactError } from "./context/compaction-error";
import { canCompactSession } from "./context/session-compaction-plan";
import { MessageQueue } from "./message-queue";
import type { AutomaticCompaction } from "./context/automatic-compaction";
import { prepareSessionInput, createSessionRequest } from "./context/session-input";
import { stoppedResponse } from "./stopped-response";

export class AgentSession {
  private listeners = new Set<SessionEventListener>();
  private active?: Promise<void>;
  private agent?: Agent;
  private controller?: AbortController;
  private busy = false;
  private readonly queue = new MessageQueue();
  private paused = false;
  private prompting = false;
  private continuation?: { content?: PromptContent; skills: string[]; queued?: boolean };
  private disposed = false;
  private draft?: AssistantMessage;
  private selected: Model<Api>;
  private selectedEffort: ModelEffort;
  private outcome: SessionState["outcome"] = "idle";
  private failure?: string;
  private listenerErrors: string[] = [];
  private readonly titles: SessionTitleService;
  private titleError?: string;
  private readonly approvals: ApprovalService;
  private readonly toolApprovals: ToolApprovals;
  private acceptingRunApprovals = false;
  private promptTiming?: PromptTiming;
  private contextBudget?: ContextBudget;
  private compactionAvailable = false;
  private activeCompaction?: SessionState["activeCompaction"];
  private inputProjection?: ModelInputProjection;
  private toolDisplayNames = new Map<string, string>();
  private skillLoads: Array<{ userTurn: number; skills: LoadedSkill[] }> = [];

  constructor(private readonly options: SessionOptions) {
    validateRequestMaxTokens(options.maxTokens);
    this.skillLoads = options.sessionManager
      .getRuntimeContexts()
      .flatMap((row) =>
        row.skills?.length ? [{ userTurn: row.userTurn, skills: row.skills }] : [],
      );
    options.skillManager?.view(options.sessionManager.getCwd());
    this.toolApprovals = new ToolApprovals((input, options) =>
      this.requestApproval(input, options),
    );
    this.approvals = new ApprovalService(
      this.sessionId,
      () => approvalPolicyFor(this.permissionPreset ?? DEFAULT_PERMISSION_PRESET),
      (event) => this.emit(event),
      () => this.permissionPreset === "danger-full-access",
    );
    this.selected = structuredClone(options.model);
    this.compactionAvailable = canCompactSession(this.sessionManager, this.selected);
    const effort = options.effort ?? options.sessionManager.getHeader().model?.effort;
    this.selectedEffort =
      effort && getModelEfforts(this.selected).includes(effort) ? effort : "default";
    this.contextBudget = estimateSessionContextBudget(
      options,
      this.selected,
      this.permissionPreset,
      this.selectedEffort,
    );
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

  /** Latest dispatched main input's sources, without storing another copy of message bodies. */
  get modelInputProjection(): ModelInputProjection | undefined {
    return this.inputProjection ? structuredClone(this.inputProjection) : undefined;
  }

  get effort(): ModelEffort {
    return this.selectedEffort;
  }

  get permissionPreset(): PermissionPreset | undefined {
    return this.options.permissionPolicy?.preset();
  }

  registerApprovalHandler(handler: ApprovalHandler): () => void {
    if (this.disposed) throw new Error("Session is disposed");

    return this.approvals.registerHandler(handler);
  }

  async requestApproval(
    input: ApprovalInput,
    options: ApprovalRequestOptions = {},
  ): Promise<ApprovalResult> {
    if (this.disposed) throw new Error("Session is disposed");
    if (this.busy && !this.acceptingRunApprovals)
      throw new Error("Session is not accepting approval requests");
    if (this.sessionManager.hasPendingSave)
      throw new Error("Pending session save; call flush first");

    const signals = [this.controller?.signal, options.signal].filter(
      (signal): signal is AbortSignal => signal !== undefined,
    );
    return this.approvals.request(input, {
      ...options,
      signal: signals.length ? AbortSignal.any(signals) : undefined,
    });
  }

  respondToApproval(response: ApprovalResponse): boolean {
    return this.approvals.respond(response);
  }

  setPermissionPreset(preset: PermissionPreset): Promise<void> {
    try {
      this.assertIdle();
      if (!this.options.permissionPolicy)
        throw new Error("Custom tool sessions do not have a managed permission policy");
    } catch (error) {
      return Promise.reject(error);
    }
    this.busy = true;
    this.active = this.sessionManager
      .setPermissionPreset(preset)
      .then(() => {
        this.contextBudget = estimateSessionContextBudget(
          this.options,
          this.selected,
          this.permissionPreset,
          this.selectedEffort,
        );
        this.emit({ type: "permission_changed", permissionPreset: preset });
      })
      .finally(() => {
        this.busy = false;
      });
    return this.active;
  }

  get state(): SessionState {
    const timing = this.promptTiming;
    const checkpoint = this.sessionManager.getCompactions().at(-1);
    const names = new Map(this.toolDisplayNames);
    for (const tool of this.options.mcpManager?.tools(this.sessionManager.getCwd()) ?? []) {
      const displayName = (tool as PermissionTool).displayName;
      if (displayName && !names.has(tool.name)) names.set(tool.name, displayName);
    }
    return {
      messages: (this.agent?.messages ?? this.sessionManager.messages).map((message) =>
        withToolDisplayName(message, names),
      ),
      draft: this.draft ? structuredClone(this.draft) : undefined,
      isRunning: this.busy,
      queue: this.queue.messages,
      canResume: this.paused && !!this.continuation,
      hasPendingSave: this.sessionManager.hasPendingSave,
      unread: this.sessionManager.unread,
      outcome: this.outcome,
      error: this.failure,
      listenerErrors: [...this.listenerErrors],
      contextBudget: this.contextBudget ? structuredClone(this.contextBudget) : undefined,
      compactionAvailable: this.compactionAvailable,
      activeCompaction: this.activeCompaction ? { ...this.activeCompaction } : undefined,
      ...(checkpoint
        ? {
            compaction: {
              id: checkpoint.id,
              firstKeptMessageIndex: checkpoint.firstKeptMessageIndex,
              historyMessageCount: checkpoint.historyMessageCount,
              timestamp: checkpoint.timestamp,
            },
          }
        : {}),
      skillLoads: structuredClone(this.skillLoads),
      pendingApprovals: this.approvals.pending,
      ...(this.permissionPreset ? { permissionPreset: this.permissionPreset } : {}),
      title: this.titles.title,
      titleError: this.titleError,
      promptTimings: timing
        ? [
            ...this.sessionManager
              .getPromptTimings()
              .filter((candidate) => candidate.id !== timing.id),
            structuredClone(timing),
          ]
        : this.sessionManager.getPromptTimings(),
    };
  }

  subscribe(listener: SessionEventListener): () => void {
    if (this.disposed) throw new Error("Session is disposed");

    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  async validateSkillSelection(ids: string[], signal?: AbortSignal): Promise<void> {
    if (
      !Array.isArray(ids) ||
      ids.length > 8 ||
      ids.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id))
    )
      throw new Error("Invalid skill selection");
    if (!this.options.skillManager) throw new Error("Skills are unavailable in this session");
    for (const id of new Set(ids))
      await this.options.skillManager.load(this.sessionManager.getCwd(), id, signal, true);
  }

  prompt(content: PromptContent, options: { skills?: string[] } = {}): Promise<void> {
    try {
      if (Object.keys(options).some((key) => key !== "skills"))
        throw new Error("Prompt options are not supported");
      if (
        options.skills &&
        (!Array.isArray(options.skills) ||
          options.skills.length > 8 ||
          options.skills.some((id) => typeof id !== "string" || !/^[a-f0-9]{24}$/.test(id)))
      )
        throw new Error("Invalid skill selection");

      if (typeof content === "string" ? !content.trim() : !content.length)
        throw new Error("Prompt is required");
      validateMessages([{ role: "user", content, timestamp: 0 }]);

      this.assertIdle();
    } catch (error) {
      return Promise.reject(error);
    }

    this.paused = false;
    this.continuation = undefined;
    return this.start(content, options.skills ?? []);
  }

  enqueue(content: PromptContent, options: { skills?: string[]; id?: string } = {}): string {
    if (this.disposed) throw new Error("Session is disposed");
    if (this.sessionManager.hasPendingSave)
      throw new Error("Pending session save; call flush first");
    if (
      Array.isArray(content) &&
      content.some((part) => part.type === "image") &&
      !this.selected.input.includes("image")
    )
      throw new Error("Model does not support image input");
    const id = this.queue.add(content, options.skills, options.id);
    this.emit({ type: "queue_changed" });
    this.drain();
    return id;
  }

  editQueued(id: string, content: PromptContent, skills?: string[]): void {
    if (this.disposed) throw new Error("Session is disposed");
    if (
      Array.isArray(content) &&
      content.some((part) => part.type === "image") &&
      !this.selected.input.includes("image")
    )
      throw new Error("Model does not support image input");
    this.queue.edit(id, content, skills);
    this.emit({ type: "queue_changed" });
    this.drain();
  }

  beginQueuedEdit(id: string): void {
    if (this.disposed) throw new Error("Session is disposed");
    this.queue.beginEdit(id);
    this.emit({ type: "queue_changed" });
  }

  cancelQueuedEdit(id: string): void {
    if (this.disposed) throw new Error("Session is disposed");
    this.queue.cancelEdit(id);
    this.emit({ type: "queue_changed" });
    this.drain();
  }

  deleteQueued(id: string): void {
    this.queue.remove(id);
    this.emit({ type: "queue_changed" });
  }

  moveQueued(id: string, beforeId?: string): void {
    this.queue.move(id, beforeId);
    this.emit({ type: "queue_changed" });
  }

  steerQueued(id: string): void {
    if (this.disposed) throw new Error("Session is disposed");
    if (this.sessionManager.hasPendingSave)
      throw new Error("Pending session save; call flush first");
    this.queue.steer(id);
    this.emit({ type: "queue_changed" });
    if (this.paused) {
      this.paused = false;
      this.continuation = undefined;
    }
    this.drain();
  }

  resume(): Promise<void> {
    this.assertIdle();
    if (!this.paused || !this.continuation)
      return Promise.reject(new Error("Session cannot resume"));
    const next = this.continuation;
    this.paused = false;
    this.continuation = undefined;
    return this.start(next.content, next.skills, next.queued);
  }

  private drain(): void {
    if (
      this.busy ||
      this.paused ||
      this.sessionManager.hasPendingSave ||
      this.approvals.pending.length
    )
      return;
    const next = this.queue.peek();
    if (!next) return;
    void this.start(next.content, next.skills, true).catch(() => {});
  }

  private start(
    content: PromptContent | undefined,
    skills: string[],
    queued = false,
  ): Promise<void> {
    this.prompting = true;
    this.busy = true;
    this.failure = undefined;
    this.contextBudget = undefined;
    this.inputProjection = undefined;
    this.outcome = "idle";
    this.controller = new AbortController();
    this.acceptingRunApprovals = true;
    this.promptTiming = {
      id: randomUUID(),
      messageStartIndex:
        this.sessionManager.messages.length + (content === undefined && !queued ? 0 : 1),
      userMessageIndex:
        content === undefined && !queued
          ? this.sessionManager.messages.findLastIndex((message) => message.role === "user")
          : this.sessionManager.messages.length,
      startedAt: Date.now(),
    };
    this.active = this.run(structuredClone(content), this.controller.signal, skills, queued);
    this.emit({ type: "queue_changed" });

    return this.active;
  }

  compact(): Promise<void> {
    try {
      this.assertIdle();
    } catch (error) {
      return Promise.reject(error);
    }
    this.titles.cancel();
    this.busy = true;
    this.failure = undefined;
    this.outcome = "idle";
    this.controller = new AbortController();
    const signal = this.controller.signal;
    this.active = compactSession(
      this.sessionManager,
      this.options.modelRuntime,
      this.selected,
      signal,
    )
      .then(() => {
        this.contextBudget = estimateSessionContextBudget(
          this.options,
          this.selected,
          this.permissionPreset,
          this.selectedEffort,
        );
        this.inputProjection = undefined;
        this.outcome = "success";
      })
      .catch((error) => {
        if (error instanceof NothingToCompactError && !signal.aborted) {
          this.outcome = "idle";
          throw error;
        }
        this.outcome = signal.aborted ? "cancelled" : "error";
        this.failure = error instanceof Error ? error.message : String(error);
        throw error;
      })
      .finally(() => {
        this.controller = undefined;
        this.busy = false;
        this.prompting = false;
        this.compactionAvailable = canCompactSession(this.sessionManager, this.selected);
        this.emit({ type: "agent_settled" });
      });
    return this.active;
  }

  async abort(): Promise<void> {
    if (this.prompting) this.paused = true;
    this.titles.cancel();
    this.controller?.abort(new Error("Run cancelled"));
    this.agent?.abort();
    this.approvals.cancelPending();
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
        this.compactionAvailable = canCompactSession(this.sessionManager, this.selected);
        this.contextBudget = estimateSessionContextBudget(
          this.options,
          this.selected,
          this.permissionPreset,
          this.selectedEffort,
        );
        this.inputProjection = undefined;
      } finally {
        this.busy = false;
      }
    })();

    return this.active;
  }

  flush(): Promise<void> {
    this.assertIdle(true);
    this.busy = true;
    this.active = this.sessionManager
      .flush()
      .then(() => {
        this.compactionAvailable = canCompactSession(this.sessionManager, this.selected);
        this.contextBudget = estimateSessionContextBudget(
          this.options,
          this.selected,
          this.permissionPreset,
          this.selectedEffort,
        );
      })
      .finally(() => {
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

    this.assertIdle(false, true);
    this.disposed = true;
    this.approvals.dispose();
    this.titles.dispose();
    if (this.options.ownsSkillManager) void this.options.skillManager?.close();
    this.listeners.clear();
  }

  private assertIdle(allowPending = false, allowApprovals = false): void {
    if (this.disposed) throw new Error("Session is disposed");

    if (this.busy) throw new Error("Session is already running");

    if (!allowApprovals && this.approvals.pending.length)
      throw new Error("Session has pending approvals");

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
    this.toolApprovals.onEvent(event);
    if (event.type === "message_start" && event.message.role === "user" && this.promptTiming)
      this.emit({ type: "prompt_timing", timing: this.promptTiming });
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

    if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
      this.emit({
        ...event,
        toolDisplayName: this.toolDisplayNames.get(event.toolName),
        ...(event.type === "tool_execution_end"
          ? {
              result: withToolDisplayName(
                event.result,
                this.toolDisplayNames,
              ) as typeof event.result,
            }
          : {}),
      });
    } else if (
      (event.type === "message_start" || event.type === "message_end") &&
      event.message.role === "toolResult"
    ) {
      this.emit({ ...event, message: withToolDisplayName(event.message, this.toolDisplayNames) });
    } else this.emit(event);
  }

  private async run(
    content: PromptContent | undefined,
    signal: AbortSignal,
    selectedSkills: string[],
    queued: boolean,
  ): Promise<void> {
    let unsubscribe = () => {};
    const failures: unknown[] = [];
    let autoCompaction: AutomaticCompaction | undefined;
    let runtimeContexts = this.sessionManager.getRuntimeContexts();
    let systemPromptCheckpoints = this.sessionManager.getSystemPromptCheckpoints();
    let continuationContent = queued ? undefined : content;
    let continuationStart = this.sessionManager.messages.length;
    let queuedInputPending = queued;
    let configuration: AgentRequestConfiguration;
    let retainAcceptedInput = () => {};

    const finishTiming = (messages: typeof this.sessionManager.messages, stopped = false) => {
      const timings = this.sessionManager.getPromptTimings();
      if (this.promptTiming && messages[this.promptTiming.userMessageIndex]?.role === "user") {
        if (this.promptTiming.finishedAt !== undefined) return timings;
        this.promptTiming = {
          ...this.promptTiming,
          finishedAt: Math.max(this.promptTiming.startedAt, Date.now()),
          messageEndIndex: messages.length,
          stopped,
        };
        const index = timings.findIndex((timing) => timing.id === this.promptTiming!.id);
        if (index < 0) timings.push(this.promptTiming);
        else timings[index] = this.promptTiming;
        this.emit({ type: "prompt_timing", timing: this.promptTiming });
      }
      return timings;
    };

    const prepareInput = (input: PromptContent | undefined, skills: string[]) =>
      prepareSessionInput({
        options: this.options,
        model: this.selected,
        permissionPreset: this.permissionPreset,
        messages: this.agent?.messages ?? this.sessionManager.messages,
        runtimeContexts,
        systemPromptCheckpoints,
        input,
        skills,
        signal,
      });

    const acceptInput = (prepared: Awaited<ReturnType<typeof prepareInput>>) => {
      selectedSkills = [...prepared.selection];
      this.toolDisplayNames = prepared.toolDisplayNames;
      retainAcceptedInput = () => {
        runtimeContexts = prepared.runtimeContexts;
        systemPromptCheckpoints = prepared.systemPromptCheckpoints;
      };
      const request = createSessionRequest({
        options: this.options,
        prepared,
        bindTools: (tools) =>
          this.options.permissionPolicy || this.options.mcpManager
            ? this.toolApprovals.bind(tools)
            : tools,
        history: () =>
          this.agent!.messages.map((message) =>
            withToolDisplayName(message, this.toolDisplayNames),
          ),
        onRetained: () => {
          runtimeContexts = prepared.runtimeContexts;
          systemPromptCheckpoints = prepared.systemPromptCheckpoints;
        },
        onRequest: (projection) => {
          this.inputProjection = projection;
          const { loaded, userTurn } = prepared;
          if (loaded.length && !this.skillLoads.some((row) => row.userTurn === userTurn)) {
            this.skillLoads.push({ userTurn, skills: loaded });
            this.emit({ type: "skills_loaded", userTurn, skills: loaded });
          }
        },
        notify: (event) => {
          if (event.type === "compaction_start") {
            this.activeCompaction = {
              startedAt: event.startedAt,
              historyMessageCount: event.historyMessageCount,
            };
          } else if (event.type === "compaction_end") this.activeCompaction = undefined;
          else if (event.type === "context_budget") this.contextBudget = event.budget;
          this.emit(event);
        },
      });
      autoCompaction = request.compaction;
      configuration = request.configuration;
    };

    const takeInput = async (steeringOnly: boolean): Promise<PromptContent[]> => {
      while (true) {
        signal.throwIfAborted();
        const next = this.queue.peek(steeringOnly);
        if (!next) return [];
        const prepared = await prepareInput(next.content, next.skills);
        signal.throwIfAborted();
        // Queue edits and reorders remain live while asynchronous Skill preparation runs.
        if (JSON.stringify(next) !== JSON.stringify(this.queue.peek(steeringOnly))) continue;
        const messages = this.agent!.messages.map((message) =>
          withToolDisplayName(message, this.toolDisplayNames),
        );
        await this.sessionManager.commit(messages, runtimeContexts, finishTiming(messages), {
          systemPromptCheckpoints,
        });
        signal.throwIfAborted();
        if (JSON.stringify(next) !== JSON.stringify(this.queue.peek(steeringOnly))) continue;
        this.queue.take(steeringOnly);
        continuationContent = next.content;
        continuationStart = messages.length;
        acceptInput(prepared);
        this.promptTiming = {
          id: randomUUID(),
          userMessageIndex: messages.length,
          messageStartIndex: messages.length + 1,
          startedAt: Date.now(),
        };
        this.emit({ type: "queue_changed" });
        return [next.content];
      }
    };

    try {
      await this.options.modelRuntime.checkModel(this.selected, signal);
      signal.throwIfAborted();

      const messages = this.sessionManager.messages;
      if (content === undefined && this.promptTiming)
        this.emit({ type: "prompt_timing", timing: this.promptTiming });
      if (queued) {
        while (true) {
          const next = this.queue.peek();
          if (!next) return;
          const prepared = await prepareInput(next.content, next.skills);
          signal.throwIfAborted();
          if (JSON.stringify(next) !== JSON.stringify(this.queue.peek())) continue;
          this.queue.take();
          queuedInputPending = false;
          content = next.content;
          continuationContent = content;
          acceptInput(prepared);
          this.emit({ type: "queue_changed" });
          break;
        }
      } else acceptInput(await prepareInput(content, selectedSkills));
      this.agent = new Agent({
        model: this.selected,
        messages,
        ...configuration!,
        prepareRequest: () => configuration,
        getSteeringMessages: () => takeInput(true),
        getFollowUpMessages: () => takeInput(false),
        finishTurn: async ({ message }) => {
          signal.throwIfAborted();
          const completed = this.agent!.messages.map((message) =>
            withToolDisplayName(message, this.toolDisplayNames),
          );
          await this.sessionManager.commit(
            completed,
            runtimeContexts,
            message.content.some((part) => part.type === "toolCall")
              ? undefined
              : finishTiming(completed),
            { systemPromptCheckpoints },
          );
          signal.throwIfAborted();
        },
        streamOptions: {
          maxTokens: this.options.maxTokens,
          reasoning:
            this.selectedEffort === "default" || this.selectedEffort === "off"
              ? undefined
              : this.selectedEffort,
        },
        maxTurns: this.options.maxTurns,
      });
      unsubscribe = this.agent.subscribe((event) => {
        if (event.type === "message_end" && event.message.role === "user") retainAcceptedInput();
        this.onAgentEvent(event);
      });
      signal.throwIfAborted();
      if (content === undefined) await this.agent.continue();
      else await this.agent.prompt(content);
      signal.throwIfAborted();
    } catch (error) {
      failures.push(error);
    } finally {
      this.acceptingRunApprovals = false;
      this.approvals.cancelPending();
      try {
        await autoCompaction?.wait();
        if (this.agent) {
          const messages = this.agent.messages.map((message) =>
            withToolDisplayName(message, this.toolDisplayNames),
          );
          const partial = signal.aborted && this.paused ? stoppedResponse(this.draft) : undefined;
          if (partial) {
            messages.push(partial);
            this.emit({ type: "message_end", message: partial });
          }
          const timings = finishTiming(messages, signal.aborted && this.paused);
          if (!this.sessionManager.hasPendingSave) {
            await this.sessionManager.commit(messages, runtimeContexts, timings, {
              systemPromptCheckpoints,
            });
          }
        }
      } catch (error) {
        failures.push(error);
      } finally {
        if (signal.aborted && this.paused) {
          this.continuation = {
            content:
              (this.agent?.messages.length ?? continuationStart) > continuationStart
                ? undefined
                : continuationContent,
            skills: selectedSkills,
            queued: queuedInputPending,
          };
        } else if (!failures.length) {
          this.paused = false;
          this.continuation = undefined;
        }
        unsubscribe();
        this.agent = undefined;
        this.draft = undefined;
        this.activeCompaction = undefined;
        this.controller = undefined;
        this.promptTiming = undefined;
        this.busy = false;
        this.prompting = false;
        this.compactionAvailable = canCompactSession(this.sessionManager, this.selected);
        this.outcome = failures.length ? (signal.aborted ? "cancelled" : "error") : "success";
        this.failure = failures.length
          ? failures
              .map((error) => (error instanceof Error ? error.message : String(error)))
              .join("; ")
          : undefined;
        this.emit({ type: "agent_settled" });
        if (!failures.length) this.drain();
      }
    }

    if (failures.length === 1) throw failures[0];

    if (failures.length > 1) throw new AggregateError(failures, this.failure);
  }
}
