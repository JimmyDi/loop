import { Marked } from "marked";

const markdown = new Marked({ gfm: true, breaks: true });
const openingFence = /^ {0,3}(`{3,})openui[ \t]*\n/;
const maxSourceLength = 24 * 1024;

type Block = { raw: string; offset: number } & (
  | { type: "markdown" }
  | { type: "openui"; response: string; streaming: boolean }
);

export const splitOpenUiBlocks = (text: string, streaming: boolean, enabled: boolean): Block[] => {
  const original: Block[] = [{ type: "markdown", raw: text, offset: 0 }];
  if (!enabled || !text.includes("```openui")) return original;

  const tokens = markdown.lexer(text);
  const definitions = tokens.flatMap((token) => (token.type === "def" ? [token.raw] : []));
  const blocks: Block[] = [];
  let offset = 0;
  let markdownStart = 0;
  let pendingMarkdown = "";

  for (const [index, token] of tokens.entries()) {
    const opening =
      token.type === "code" && token.lang === "openui" ? openingFence.exec(token.raw) : null;
    if (opening && token.type === "code" && token.text.length <= maxSourceLength) {
      const closing = new RegExp("^ {0,3}`{" + opening[1]?.length + ",}[ \\t]*\\n*$", "m");
      const complete = closing.test(token.raw.slice(opening[0].length));
      const active = streaming && index === tokens.length - 1 && !complete;
      if (complete || active) {
        if (pendingMarkdown) {
          blocks.push({ type: "markdown", raw: pendingMarkdown, offset: markdownStart });
          pendingMarkdown = "";
        }
        blocks.push({
          type: "openui",
          raw: token.raw,
          offset,
          response: token.text,
          streaming: active,
        });
        offset += token.raw.length;
        markdownStart = offset;
        continue;
      }
    }
    pendingMarkdown += token.raw;
    offset += token.raw.length;
  }
  if (!blocks.length) return original;
  if (pendingMarkdown)
    blocks.push({ type: "markdown", raw: pendingMarkdown, offset: markdownStart });
  if (!definitions.length) return blocks;
  return blocks.map((block) =>
    block.type === "markdown"
      ? { ...block, raw: block.raw + "\n\n" + definitions.join("\n") }
      : block,
  );
};
