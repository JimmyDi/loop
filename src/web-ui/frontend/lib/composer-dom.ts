export const shouldSubmit = (key: string, shift: boolean, composing: boolean): boolean =>
  key === "Enter" && !shift && !composing;

export const readComposer = (element: HTMLElement): string =>
  element.innerText.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");

export const insertPlainText = (element: HTMLElement, text: string): void => {
  const selection = element.ownerDocument.getSelection();

  if (!selection?.rangeCount) return;

  const range = selection.getRangeAt(0);

  if (!element.contains(range.commonAncestorContainer)) return;

  range.deleteContents();

  const node = element.ownerDocument.createTextNode(text);

  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};
