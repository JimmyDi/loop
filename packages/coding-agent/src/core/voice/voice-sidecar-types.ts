export type VoicePendingRequest = {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  expected: "ready" | "completed";
};
