import type { TokenizerExtension } from "marked";

// CommonMark treats the punctuation before the closer as left-flanking here.
const cjkStrongLabel =
  /^\*\*(?!\s)([^*\r\n]+[:：])\*\*(?=[0-9\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}])/u;

export const markdownCjk: TokenizerExtension = {
  name: "strong",
  level: "inline",
  tokenizer(src) {
    const match = cjkStrongLabel.exec(src);
    if (!match?.[1]) return;
    return {
      type: "strong",
      raw: match[0],
      text: match[1],
      tokens: this.lexer.inlineTokens(match[1]),
    };
  },
};
