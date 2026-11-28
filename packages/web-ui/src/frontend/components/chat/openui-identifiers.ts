// Keep quoted content and comments opaque while finding non-ASCII identifiers.
const tokens =
  /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/[^\n]*|#[^\n]*|([\p{L}_$][\p{L}\p{M}\p{N}_$]*)/gu;
const nonAscii = /[^\x00-\x7f]/;
const propertyAccess = /[.][ 	]*$/;
const propertyKey = /^[ 	]*:/;

export const normalizeOpenUiIdentifiers = (source: string): string => {
  if (!nonAscii.test(source)) return source;
  const names = new Map<string, string>();
  let next = 0;
  for (const match of source.matchAll(tokens)) {
    const name = match[1];
    if (!name || !nonAscii.test(name) || names.has(name)) continue;
    const start = source.lastIndexOf("\n", match.index - 1) + 1;
    if (
      source.slice(start, match.index).trim() ||
      !/^[ \t]*=(?!=)/.test(source.slice(match.index + name.length))
    )
      continue;
    let alias: string;
    do {
      alias = "loop_identifier_" + next++;
    } while (source.includes(alias));
    if (name.startsWith("$")) alias = "$" + alias;
    names.set(name, alias);
  }
  if (!names.size) return source;
  return source.replaceAll(tokens, (token, name: string | undefined, offset: number) => {
    if (!name || !names.has(name)) return token;
    if (
      propertyAccess.test(source.slice(0, offset)) ||
      propertyKey.test(source.slice(offset + token.length))
    )
      return token;
    return names.get(name) ?? token;
  });
};
