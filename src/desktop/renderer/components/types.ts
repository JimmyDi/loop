export type MessageKind = "user" | "assistant" | "error";

export type Message = {
  kind: MessageKind;
  text: string;
};
