export function buildSystemPrompt(
  cwd: string,
  base: string | undefined,
  instructions: Array<{ path: string; content: string }>,
): string {
  return [
    base ??
      "You are a coding assistant. Read relevant files before editing. Use tools to verify changes. Report results and limitations accurately.",
    "Working directory: " + cwd,
    ...instructions.map((file) => "Project instructions (" + file.path + "):\n" + file.content),
  ].join("\n\n");
}
