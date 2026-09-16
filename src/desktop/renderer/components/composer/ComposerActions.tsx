type ComposerActionsProps = {
  disabled: boolean;
};

export function ComposerActions({ disabled }: ComposerActionsProps) {
  return (
    <div className="composer-actions">
      <span className="hint">Enter to run · Shift+Enter for a new line</span>
      <button type="submit" disabled={disabled}>
        {disabled ? "Running…" : "Run task"}
      </button>
    </div>
  );
}
