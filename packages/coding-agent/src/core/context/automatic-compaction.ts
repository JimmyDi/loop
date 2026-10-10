import type { Api, Context, Message, Model } from "@earendil-works/pi-ai";

import type { ModelInputMetadata } from "@loop/agent";
import { ContextBudgetExceededError } from "../context-budget";
import type { ModelRuntime } from "../model-runtime";
import { assembleModelRequest } from "../model-request";
import { projectModelInput } from "../model-input-projection";
import type { RuntimeContextSnapshot } from "../runtime-context";
import type { SessionManager } from "../session-manager";
import type { SessionEvent } from "../types/session";
import type { SystemPromptCheckpoint } from "./system-prompt-state";
import type { CompactionCheckpoint } from "./compaction-checkpoint";
import { NothingToCompactError } from "./compaction-error";
import { planCompaction } from "./compaction-plan";
import { generateSummary } from "./generate-summary";
import { recentContextTokens } from "./session-compaction-plan";

type Preparation = {
  model: Model<Api>;
  context: Context;
  metadata: ModelInputMetadata;
  request: ReturnType<typeof assembleModelRequest>;
  signal: AbortSignal;
};

type Options = {
  manager: SessionManager;
  runtime: ModelRuntime;
  history: () => Message[];
  snapshots: readonly RuntimeContextSnapshot[];
  systemPromptCheckpoints: readonly SystemPromptCheckpoint[];
  notify: (event: SessionEvent) => void;
  onSaved: () => void;
};

/** Run-local pressure policy; never owns or rewrites Agent's complete in-memory history. */
export class AutomaticCompaction {
  private consecutive = 0;
  private active?: Promise<CompactionCheckpoint | undefined>;

  constructor(private readonly options: Options) {}

  prepare(input: Preparation): Promise<CompactionCheckpoint | undefined> {
    this.active = this.run(input);
    return this.active;
  }

  async wait(): Promise<void> {
    await this.active?.catch(() => {});
  }

  private async run({ model, context, metadata, request, signal }: Preparation) {
    let previous = this.options.manager.getCompactions().at(-1);
    const pressured = request.budget.estimatedInputTokens >= request.budget.inputLimit * 0.9;
    if (!pressured) {
      this.consecutive = 0;
      return previous;
    }
    // Refilled contexts must not spend an unbounded number of requests on summaries.
    if (this.consecutive >= 2) {
      if (request.budget.fits) return previous;
      throw new ContextBudgetExceededError(request.budget);
    }
    this.consecutive++;
    const history = this.options.history();
    const projected = projectModelInput(context.messages, this.options.snapshots, metadata);
    let current = request;
    let started = false;
    let saved: CompactionCheckpoint | undefined;
    let failure: string | undefined;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        signal.throwIfAborted();
        let plan: ReturnType<typeof planCompaction>;
        try {
          plan = planCompaction(
            history,
            projected,
            previous,
            attempt === 0 ? recentContextTokens(model) : 0,
          );
        } catch (error) {
          if (error instanceof NothingToCompactError) {
            if (attempt === 0 && !current.budget.fits) continue;
            break;
          }
          throw error;
        }
        if (!started) {
          started = true;
          this.options.notify({
            type: "compaction_start",
            startedAt: Date.now(),
            historyMessageCount: history.length,
          });
        }
        const bounded = AbortSignal.any([signal, AbortSignal.timeout(120000)]);
        let result: Awaited<ReturnType<typeof generateSummary>>;
        try {
          result = await generateSummary(
            this.options.runtime,
            model,
            plan.messages,
            bounded,
            previous?.summary,
          );
          bounded.throwIfAborted();
        } catch (error) {
          signal.throwIfAborted();
          failure = error instanceof Error ? error.message : String(error);
          break;
        }
        const candidate: CompactionCheckpoint = {
          id: crypto.randomUUID(),
          firstKeptMessageIndex: plan.firstKeptMessageIndex,
          historyMessageCount: history.length,
          timestamp: Date.now(),
          provider: model.provider,
          model: model.id,
          ...result,
        };
        const next = assembleModelRequest(
          model,
          context,
          this.options.snapshots,
          metadata,
          candidate,
          request.budget.reservedOutputTokens,
        );
        if (next.budget.estimatedInputTokens >= current.budget.estimatedInputTokens) {
          failure = "Compaction did not reduce the model input";
          break;
        }
        signal.throwIfAborted();
        await this.options.manager.commit(history, this.options.snapshots, undefined, {
          compactions: [...this.options.manager.getCompactions(), candidate],
          systemPromptCheckpoints: this.options.systemPromptCheckpoints,
        });
        previous = candidate;
        saved = candidate;
        current = next;
        this.options.onSaved();
        this.options.notify({ type: "context_budget", budget: structuredClone(current.budget) });
        signal.throwIfAborted();
        if (current.budget.fits) break;
      }
      if (!current.budget.fits) throw new ContextBudgetExceededError(current.budget);
      return previous;
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (started) {
        this.options.notify({
          type: "compaction_end",
          checkpoint: saved
            ? {
                id: saved.id,
                firstKeptMessageIndex: saved.firstKeptMessageIndex,
                historyMessageCount: saved.historyMessageCount,
                timestamp: saved.timestamp,
              }
            : undefined,
          error: failure,
        });
      }
    }
  }
}
