import type { Api, Message, Model } from "@earendil-works/pi-ai";

import type { ModelRuntime } from "../model-runtime";
import type { SessionManager } from "../session-manager";
import { generateTitle } from "./generate-title";
import { fallbackTitle, normalizeTitle, titleInputs } from "./title-text";
import type { SessionTitle, SessionTitleOptions, TitleInput } from "./types";

export class SessionTitleService {
  private revision = 0;
  private controller?: AbortController;
  private work = new Set<Promise<unknown>>();
  private current?: SessionTitle;
  private disposed = false;
  private readonly options: SessionTitleOptions;

  constructor(
    private readonly manager: SessionManager,
    private readonly runtime: ModelRuntime,
    options: SessionTitleOptions = {},
    private readonly notify: (title: SessionTitle, error?: string) => void,
  ) {
    this.options = structuredClone(options);
    if (!["off", "first-prompt", "all-prompts"].includes(options.mode ?? "off"))
      throw new Error("Invalid title mode");
    for (const key of ["maxInputBytes", "maxOutputTokens", "timeoutMs"] as const) {
      const value = options[key];
      if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > 2147483647))
        throw new Error("Invalid title option: " + key);
    }
    if (options.model && (!options.model.provider || !options.model.id))
      throw new Error("Title model requires provider and id");
    this.current = manager.getHeader().title;
  }

  get title(): SessionTitle | undefined {
    return this.current ? structuredClone(this.current) : undefined;
  }

  onPrompt(messages: readonly Message[], model: Model<Api>): void {
    if (this.disposed || this.current?.source === "user") return;
    const inputs = titleInputs(messages);
    if (!inputs.length || inputs.at(-1)!.index !== messages.length - 1) return;
    const first = this.current === undefined;
    this.cancel();
    const revision = this.revision;
    const fallback = first ? fallbackTitle(inputs[0]!) : undefined;
    if (fallback) {
      this.current = fallback;
      this.notify(fallback);
    }
    const shouldGenerate =
      this.options.mode === "all-prompts" ||
      (this.options.mode === "first-prompt" && first && inputs.length === 1);
    this.track(
      (async () => {
        const unsaved = this.current && !this.manager.getHeader().title;
        if (unsaved) await this.save(this.current!, revision);
        if (shouldGenerate && this.valid(revision)) await this.generate(inputs, model, revision);
      })().catch((error) => this.report(error, revision)),
    );
  }

  async rename(text: string): Promise<void> {
    const normalized = normalizeTitle(text);
    if (!normalized) throw new Error("Session title is required");
    this.cancel();
    const revision = this.revision;
    await this.track(this.save({ text: normalized, source: "user", messageIndices: [] }, revision));
  }

  async refresh(messages: readonly Message[], model: Model<Api>): Promise<void> {
    this.cancel();
    const revision = this.revision;
    const inputs = titleInputs(messages);
    if (!inputs.length) throw new Error("No text messages to title");
    await this.track(
      (async () => {
        if (this.options.mode === "off" || this.options.mode === undefined) {
          await this.save(fallbackTitle(inputs[0]!), revision);
        } else {
          await this.generate(inputs, model, revision);
        }
      })(),
    );
  }

  cancel(): void {
    this.revision++;
    this.controller?.abort(new Error("Title generation cancelled"));
    this.controller = undefined;
  }

  async wait(): Promise<void> {
    while (this.work.size) await Promise.allSettled([...this.work]);
    await this.manager.waitForWrites();
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }

  private valid(revision: number): boolean {
    return !this.disposed && revision === this.revision;
  }

  private track<T>(work: Promise<T>): Promise<T> {
    this.work.add(work);
    void work.finally(() => this.work.delete(work)).catch(() => {});
    return work;
  }

  private async save(title: SessionTitle, revision: number): Promise<void> {
    if (await this.manager.setTitle(title, () => this.valid(revision))) {
      this.current = structuredClone(title);
      this.notify(title);
    } else {
      throw new Error("Title generation cancelled");
    }
  }

  private async generate(inputs: TitleInput[], model: Model<Api>, revision: number): Promise<void> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      const selected = this.options.mode === "all-prompts" ? inputs : inputs.slice(0, 1);
      const title = await generateTitle(
        this.runtime,
        model,
        selected,
        this.options,
        controller.signal,
      );
      if (this.valid(revision)) await this.save(title, revision);
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }

  private report(error: unknown, revision: number): void {
    if (this.valid(revision) && this.current)
      this.notify(this.current, error instanceof Error ? error.message : String(error));
  }
}
