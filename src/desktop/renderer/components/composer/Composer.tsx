import { useState, type FormEvent } from "react";
import { ComposerActions } from "./ComposerActions";
import { PromptInput } from "./PromptInput";

type ComposerProps = {
  disabled: boolean;
  onRun: (prompt: string) => Promise<void>;
};

export function Composer({ disabled, onRun }: ComposerProps) {
  const [prompt, setPrompt] = useState("");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = prompt.trim();
    if (!value || disabled) return;
    setPrompt("");
    await onRun(value);
  };

  return (
    <form className="composer" onSubmit={(event) => void submit(event)}>
      <PromptInput value={prompt} onChange={setPrompt} onSubmit={() => void submit()} />
      <ComposerActions disabled={disabled} />
    </form>
  );
}
