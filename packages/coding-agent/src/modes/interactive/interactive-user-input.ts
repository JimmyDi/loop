import type { AgentSession } from "../../core/agent-session";
import type { UserInputAnswer, UserInputRequest } from "../../core/user-input/types";

/** Collect one question at a time, submitting the complete request atomically. */
export class InteractiveUserInput {
  private detach = () => {};
  private unsubscribe = () => {};
  private session?: AgentSession;
  private request?: UserInputRequest;
  private answers: UserInputAnswer[] = [];

  constructor(
    private readonly write: (text: string) => void,
    private readonly interactive: boolean,
  ) {}

  bind(session: AgentSession): void {
    this.dispose();
    this.session = session;
    if (!this.interactive) return;
    this.detach = session.registerUserInputHandler((request) => {
      this.request = request;
      this.answers = [];
      this.show();
    });
    this.unsubscribe = session.subscribe((event) => {
      if (
        event.type === "user_input_resolved" &&
        event.result.request.requestId === this.request?.requestId
      ) {
        this.write("User input: " + event.result.outcome);
        this.request = undefined;
        this.answers = [];
      }
    });
  }

  handle(text: string): boolean {
    if (!this.request || (text.startsWith("/") && text !== "/skip")) return false;
    if (text.length > 10000) throw new Error("Answer exceeds 10000 characters");
    const question = this.request.questions[this.answers.length]!;
    const option = !text
      ? question.options?.[0]
      : /^\d+$/.test(text)
        ? question.options?.[Number(text) - 1]
        : undefined;
    if (!text && !option) throw new Error("Enter an answer");
    const answer: UserInputAnswer =
      text === "/skip"
        ? { questionId: question.id, type: "skipped" }
        : option
          ? { questionId: question.id, type: "option", optionId: option.id }
          : { questionId: question.id, type: "text", text };
    this.answers.push(answer);
    if (this.answers.length < this.request.questions.length) this.show();
    else {
      if (!this.session?.respondToUserInput({ ...this.request, answers: this.answers })) {
        this.answers.pop();
        throw new Error("Question is no longer pending or the answer is invalid");
      }
    }
    return true;
  }

  dispose(): void {
    this.unsubscribe();
    this.detach();
    this.unsubscribe = () => {};
    this.detach = () => {};
    this.request = undefined;
    this.answers = [];
    this.session = undefined;
  }

  private show(): void {
    const question = this.request!.questions[this.answers.length]!;
    const options = question.options?.map(
      (option, index) =>
        String(index + 1) +
        ". " +
        option.label +
        (index === 0 ? " (default)" : "") +
        (option.id === question.recommendedOptionId ? " (recommended)" : "") +
        (option.description ? " — " + option.description : ""),
    );
    this.write(
      [
        "Waiting for your answer",
        question.text,
        ...(options ?? []),
        (options
          ? "Enter a choice number or your own answer; press Enter for option 1."
          : "Enter your answer.") + " /skip is available.",
      ].join("\n"),
    );
  }
}
