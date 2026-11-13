import type {
  UserInputEvent,
  UserInputHandler,
  UserInputQuestion,
  UserInputRequest,
  UserInputResponse,
  UserInputResult,
} from "./types";
import { validAnswers, validQuestions } from "./validation";

type Pending = {
  request: UserInputRequest;
  signal: AbortSignal;
  resolve: (result: UserInputResult) => void;
  cleanup: () => void;
};

/** Session-owned waiting state, independent of permission grants. */
export class UserInputService {
  private handler?: UserInputHandler;
  private waiting?: Pending;
  private disposed = false;

  constructor(
    private readonly sessionId: string,
    private readonly emit: (event: UserInputEvent) => void,
  ) {}

  get pending(): UserInputRequest[] {
    return this.waiting ? [structuredClone(this.waiting.request)] : [];
  }

  registerHandler(handler: UserInputHandler): () => void {
    if (this.disposed) throw new Error("User input service is disposed");
    if (typeof handler !== "function" || this.handler)
      throw new Error("Invalid or duplicate user input handler");
    this.handler = handler;
    return () => {
      if (this.handler !== handler) return;
      this.handler = undefined;
      this.settle("unavailable");
    };
  }

  async request(questions: UserInputQuestion[], signal: AbortSignal): Promise<UserInputResult> {
    signal.throwIfAborted();
    if (!validQuestions(questions)) throw new Error("Invalid user input questions");
    if (this.waiting) throw new Error("A user input request is already pending");
    const request: UserInputRequest = {
      sessionId: this.sessionId,
      requestId: crypto.randomUUID(),
      questions: structuredClone(questions),
      createdAt: Date.now(),
    };
    const { promise, resolve } = Promise.withResolvers<UserInputResult>();
    const cancel = () => this.settle("cancelled");
    this.waiting = {
      request,
      signal,
      resolve,
      cleanup: () => signal.removeEventListener("abort", cancel),
    };
    signal.addEventListener("abort", cancel, { once: true });
    this.emit({ type: "user_input_requested", request: structuredClone(request) });
    const handler = this.handler;
    if (this.waiting?.request.requestId !== request.requestId) return promise;
    if (this.disposed || !handler) this.settle("unavailable");
    else {
      try {
        void Promise.resolve(handler(structuredClone(request))).catch(() => {
          if (this.waiting?.request.requestId === request.requestId) this.settle("unavailable");
        });
      } catch {
        if (this.waiting?.request.requestId === request.requestId) this.settle("unavailable");
      }
    }
    return promise;
  }

  respond(response: UserInputResponse): boolean {
    const pending = this.waiting;
    if (
      !pending ||
      this.disposed ||
      pending.signal.aborted ||
      response?.sessionId !== this.sessionId ||
      response.requestId !== pending.request.requestId ||
      !validAnswers(pending.request.questions, response.answers)
    )
      return false;
    const answers = response.answers.map((answer) =>
      answer.type === "text"
        ? { questionId: answer.questionId, type: answer.type, text: answer.text }
        : answer.type === "option"
          ? { questionId: answer.questionId, type: answer.type, optionId: answer.optionId }
          : { questionId: answer.questionId, type: answer.type },
    );
    return this.settle("answered", answers);
  }

  cancelPending(): void {
    this.settle("cancelled");
  }

  dispose(): void {
    this.disposed = true;
    this.handler = undefined;
    this.cancelPending();
  }

  private settle(
    outcome: UserInputResult["outcome"],
    answers?: UserInputResponse["answers"],
  ): boolean {
    const pending = this.waiting;
    if (!pending) return false;
    this.waiting = undefined;
    pending.cleanup();
    const result: UserInputResult = {
      request: pending.request,
      outcome,
      ...(answers ? { answers: structuredClone(answers) } : {}),
      resolvedAt: Date.now(),
    };
    pending.resolve(structuredClone(result));
    this.emit({ type: "user_input_resolved", result });
    return true;
  }
}
