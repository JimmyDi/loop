export type UserInputOption = { id: string; label: string; description?: string };

export type UserInputQuestion = {
  id: string;
  text: string;
  options?: UserInputOption[];
  recommendedOptionId?: string;
};

export type UserInputAnswer =
  | { questionId: string; type: "text"; text: string }
  | { questionId: string; type: "option"; optionId: string }
  | { questionId: string; type: "skipped" };

export type UserInputRequest = {
  sessionId: string;
  requestId: string;
  questions: UserInputQuestion[];
  createdAt: number;
};

export type UserInputResponse = {
  sessionId: string;
  requestId: string;
  answers: UserInputAnswer[];
};

export type UserInputResult = {
  request: UserInputRequest;
  outcome: "answered" | "cancelled" | "unavailable";
  answers?: UserInputAnswer[];
  resolvedAt: number;
};

export type UserInputHandler = (request: UserInputRequest) => void | Promise<void>;

export type UserInputEvent =
  | { type: "user_input_requested"; request: UserInputRequest }
  | { type: "user_input_resolved"; result: UserInputResult };
