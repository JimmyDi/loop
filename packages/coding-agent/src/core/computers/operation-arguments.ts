const browserActions = ["open", "set_content", "snapshot", "click", "fill", "screenshot"];
const desktopActions = ["screenshot", "click", "type", "keypress", "scroll"];

export const computerOperationArguments = (
  name: string,
  value: unknown,
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Computer operation arguments must be an object");
  const args = value as Record<string, unknown>;
  if (name === "browser") {
    if (!browserActions.includes(String(args.action)))
      throw new Error(
        "Unsupported browser action. Use open, set_content, snapshot, click, fill or screenshot. For keyboard shortcuts, use desktop keypress after a fresh desktop screenshot.",
      );
    if (args.action === "open" && (typeof args.url !== "string" || !/^https?:\/\//.test(args.url)))
      throw new Error("Browser open requires an HTTP(S) url");
    if (["click", "fill"].includes(String(args.action)) && !args.selector)
      throw new Error("Browser click and fill require a selector");
    if (Object.keys(args).some((key) => !["action", "url", "selector", "text"].includes(key)))
      throw new Error("Browser accepts only action, url, selector and text");
    return args;
  }
  if (name !== "desktop") return args;
  const action = args.action === "key" ? "keypress" : args.action;
  if (!desktopActions.includes(String(action)))
    throw new Error("Unsupported desktop action. Use screenshot, click, type, keypress or scroll.");
  const result = { ...args, action };
  if (
    Object.keys(result).some(
      (key) =>
        !["action", "screenshot_id", "x", "y", "text", "key", "direction", "amount"].includes(key),
    )
  )
    throw new Error("Desktop arguments contain an unsupported field");
  if (action === "screenshot") return result;
  if (typeof args.screenshot_id !== "string" || !args.screenshot_id)
    throw new Error("Take a fresh desktop screenshot and pass its screenshot_id before input");
  if (action === "keypress") {
    result.key = args.key === " " || args.key === "Space" ? "space" : args.key;
    if (typeof result.key !== "string" || !/^[A-Za-z0-9_+]{1,80}$/.test(result.key))
      throw new Error("Desktop keypress requires an X11 key name such as space or Return");
  }
  if (action === "type" && typeof args.text !== "string")
    throw new Error("Desktop type requires text");
  return result;
};
