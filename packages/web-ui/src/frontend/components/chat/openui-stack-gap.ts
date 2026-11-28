// Match strings and comments before attempting to repair a Stack assignment.
const namedStackGap =
  /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|^(?<prefix>[ \t]*[\w-]+[ \t]*=[ \t]*Stack\([ \t]*\[[ \t]*(?:[\w-]+(?:[ \t]*,[ \t]*[\w-]+)*)?[ \t]*\][ \t]*,)[ \t]*gap[ \t]*=[ \t]*(?<gap>"(?:none|xs|s|m|l|xl|2xl)")(?=[ \t]*\))/gm;

export const normalizeOpenUiStackGap = (source: string): string =>
  source.replaceAll(namedStackGap, (match: string, ...args: unknown[]) => {
    const { prefix, gap } = args.at(-1) as Record<string, string | undefined>;
    return prefix && gap ? prefix + " null, " + gap : match;
  });
