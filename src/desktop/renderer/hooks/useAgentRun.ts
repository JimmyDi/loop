import { useState } from "react";
import type { Message } from "../components/types";

type RunResult = {
  output?: string;
};

export function useAgentRun() {
  const [status, setStatus] = useState("Local API ready");
  const [messages, setMessages] = useState<Message[]>([]);

  const run = async (prompt: string) => {
    setMessages((current) => [...current, { kind: "user", text: prompt }]);
    setStatus("Running…");
    try {
      const result = (await window.loop.run({ prompt })) as RunResult;
      setMessages((current) => [
        ...current,
        { kind: "assistant", text: result.output ?? "No output" },
      ]);
      setStatus("Local API ready");
    } catch (error) {
      setMessages((current) => [
        ...current,
        { kind: "error", text: error instanceof Error ? error.message : String(error) },
      ]);
      setStatus("Run failed");
    }
  };

  return { messages, status, run };
}
