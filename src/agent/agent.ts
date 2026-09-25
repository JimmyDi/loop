// Adapted from Pi (MIT). See THIRD_PARTY_NOTICES.md.
import type { AssistantMessage, Message } from "@earendil-works/pi-ai";

import { runAgentLoop } from "./agent-loop";
import type { AgentEventListener, AgentOptions } from "./types";

export class Agent {
  private readonly history: Message[];
  private readonly options: AgentOptions;
  private readonly listeners = new Set<AgentEventListener>();
  private controller?: AbortController;

  constructor(options: AgentOptions) {
    this.options = {
      ...options,
      model: structuredClone(options.model),
      tools: options.tools?.map((tool) => ({ ...tool })),
      streamOptions: { ...options.streamOptions },
    };

    this.history = structuredClone([...(options.messages ?? [])]);
  }

  /** Completed messages only. Mutating this snapshot cannot change the agent's history. */
  get messages(): Message[] {
    return structuredClone(this.history);
  }

  get isRunning(): boolean {
    return this.controller !== undefined;
  }

  subscribe(listener: AgentEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  abort(): void {
    this.controller?.abort(new Error("Run cancelled"));
  }

  async prompt(text: string): Promise<AssistantMessage> {
    if (this.isRunning) throw new Error("Agent is already running");

    this.controller = new AbortController();

    try {
      return await runAgentLoop(
        text,
        this.history,
        this.options,
        async (event) => {
          for (const listener of this.listeners) await listener(structuredClone(event));
        },
        this.controller.signal,
      );
    } finally {
      this.controller = undefined;
    }
  }
}
