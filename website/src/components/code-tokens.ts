export type CodeLanguage = "bash" | "typescript";

type TokenKind =
  | "plain"
  | "comment"
  | "string"
  | "keyword"
  | "function"
  | "type"
  | "property"
  | "number";

type CodeToken = { text: string; kind: TokenKind; offset: number };

// Covers the website's fixed examples; this is not a general-purpose language parser.
const syntax =
  /\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|--[\w-]+|[A-Za-z_$][\w$]*|\b\d+\b/g;

const keywords = new Set([
  "import",
  "from",
  "const",
  "if",
  "throw",
  "new",
  "await",
  "try",
  "finally",
]);

const classify = (text: string, rest: string, language: CodeLanguage): TokenKind => {
  if (text.startsWith("//") || text.startsWith("#")) return "comment";
  if (text.startsWith('"') || text.startsWith("'")) return "string";
  if (language === "bash") {
    if (text === "export") return "keyword";
    if (text === "npx") return "function";
    if (text.startsWith("--")) return "property";
    if (/^[A-Z][A-Z_0-9]+$/.test(text)) return "type";
    return "plain";
  }
  if (keywords.has(text)) return "keyword";
  if (/^\d+$/.test(text)) return "number";
  if (/^[A-Z]/.test(text)) return "type";
  if (
    /^\s*\(/.test(rest) ||
    ["createAgentSession", "createModelRuntime", "messageText"].includes(text)
  ) {
    return "function";
  }
  return "property";
};

export const tokenizeCode = (source: string, language: CodeLanguage): CodeToken[] => {
  const tokens: CodeToken[] = [];
  let cursor = 0;
  for (const match of source.matchAll(syntax)) {
    const offset = match.index;
    if (offset > cursor)
      tokens.push({ text: source.slice(cursor, offset), kind: "plain", offset: cursor });
    const text = match[0];
    cursor = offset + text.length;
    tokens.push({ text, kind: classify(text, source.slice(cursor), language), offset });
  }
  if (cursor < source.length)
    tokens.push({ text: source.slice(cursor), kind: "plain", offset: cursor });
  return tokens;
};
