// Match strings and comments first so examples and labels stay untouched.
const stringLiteral = String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`;
const numberLiteral = String.raw`-?\d+(?:\.\d+)?`;
const metric = new RegExp(
  stringLiteral +
    String.raw`|//[^\n]*|#[^\n]*|\b(?<component>MetricIndicatorInline|MetricIndicatorWithStrikethrough)(?<open>\s*\(\s*)` +
    `(?<value>` +
    stringLiteral +
    "|" +
    numberLiteral +
    ")" +
    String.raw`(?=\s*[,\)])(?:(?<middle>\s*,\s*(?:` +
    stringLiteral +
    String.raw`|null)\s*,\s*)(?<previous>` +
    numberLiteral +
    String.raw`)(?=\s*[,\)]))?`,
  "g",
);

export const normalizeOpenUiMetricValues = (source: string): string =>
  source.replaceAll(metric, (match: string, ...args: unknown[]) => {
    const { component, open, value, middle, previous } = args.at(-1) as Record<
      string,
      string | undefined
    >;
    if (!component || !value) return match;
    const display = /^["']/.test(value) ? value : JSON.stringify(value);
    if (!middle || !previous) return component + open + display;
    return (
      component +
      open +
      display +
      middle +
      (component === "MetricIndicatorWithStrikethrough" ? JSON.stringify(previous) : previous)
    );
  });
