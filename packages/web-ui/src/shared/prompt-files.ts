export type PromptFile = { name: string; text: string };

export const MAX_TEXT_FILES = 4;

const TEXT_EXTENSIONS = new Set(
  "txt text md markdown mdx csv tsv json jsonc jsonl yaml yml toml xml html htm css scss sass less js jsx mjs cjs ts tsx mts cts py pyi rb php go rs java kt kts c h cc cpp cxx hpp cs fs fsx swift m mm sh bash zsh fish ps1 bat cmd sql graphql gql proto ini cfg conf properties env gitignore gitattributes editorconfig dockerignore vue svelte r lua pl ex exs erl hrl hs clj cljs dart tex rst log diff patch".split(
    " ",
  ),
);

export const TEXT_FILE_ACCEPT = [...TEXT_EXTENSIONS].map((extension) => "." + extension).join(",");

export const isTextFileName = (name: string): boolean => {
  if (!name || name.length > 255 || /[\x00-\x1f\x7f/\\]/.test(name)) return false;
  const extension = name.toLowerCase().split(".").at(-1)!;
  return !name.includes(".") || TEXT_EXTENSIONS.has(extension);
};

export const isPlainText = (text: string): boolean =>
  !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\ud800-\udfff]/u.test(text);

export const validTextFiles = (value: unknown): value is PromptFile[] =>
  Array.isArray(value) &&
  value.length <= MAX_TEXT_FILES &&
  value.every(
    (file) =>
      file &&
      typeof file.name === "string" &&
      isTextFileName(file.name) &&
      typeof file.text === "string" &&
      isPlainText(file.text),
  );

// Native text blocks keep file names and contents in SDK history without a new message type.
const FILE_PREFIX = "Attached UTF-8 text file (reference content):\n";

export const fileContent = (file: PromptFile): string =>
  FILE_PREFIX + JSON.stringify({ name: file.name, text: file.text });

export const readFileContent = (text: string): PromptFile | undefined => {
  if (!text.startsWith(FILE_PREFIX)) return;
  try {
    const file: unknown = JSON.parse(text.slice(FILE_PREFIX.length));
    if (validTextFiles([file])) return file as PromptFile;
  } catch {
    // Ordinary message text remains ordinary text if it is not a valid attachment block.
  }
};
