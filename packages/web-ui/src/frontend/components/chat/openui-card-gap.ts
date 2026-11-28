// Match strings and comments as whole tokens so their punctuation cannot affect argument positions.
const tokens = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|[\w$@.-]+|[^\s]/g;
const closing: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const variant = /^\s*(?:null|"(?:card|sunk|clear)"|'(?:card|sunk|clear)')\s*$/;
const gap = /^\s*(?:"(?:none|xs|s|m|l|xl|2xl)"|'(?:none|xs|s|m|l|xl|2xl)')\s*$/;

type Scope = { end: string; cardCommas?: number[] };

// Recover Card(children, variant, gap) by inserting the skipped optional direction.
export const normalizeOpenUiCardGap = (source: string): string => {
  if (!source.includes("Card")) return source;
  const scopes: Scope[] = [];
  const insertions: number[] = [];
  let previous = "";
  for (const { 0: token, index } of source.matchAll(tokens)) {
    if (token.startsWith("//") || token.startsWith("#")) continue;
    const scope = scopes.at(-1);
    if (token === "(" || token === "[" || token === "{") {
      scopes.push({
        end: closing[token]!,
        cardCommas: token === "(" && previous === "Card" ? [] : undefined,
      });
    } else if (token === ",") {
      scope?.cardCommas?.push(index);
    } else if (token === scope?.end) {
      scopes.pop();
      const commas = scope.cardCommas;
      if (commas?.length === 2) {
        const [first, second] = commas as [number, number];
        if (
          variant.test(source.slice(first + 1, second)) &&
          gap.test(source.slice(second + 1, index))
        ) {
          insertions.push(second + 1);
        }
      }
    }
    previous = token;
  }
  if (!insertions.length) return source;

  let result = "";
  let start = 0;
  for (const index of insertions.sort((a, b) => a - b)) {
    result += source.slice(start, index) + " null,";
    start = index;
  }
  return result + source.slice(start);
};
