export const holdHistoryPosition = (element: HTMLDivElement) => {
  const top = element.scrollTop;
  const height = element.scrollHeight;
  const viewportTop = element.getBoundingClientRect().top;
  const content = element.querySelector(".timeline-content") ?? element;
  const anchor = Array.from(content.children).find(
    (child) => child.getBoundingClientRect().bottom > viewportTop,
  );
  const anchorTop = anchor?.getBoundingClientRect().top;
  const overflowY = element.style.overflowY;
  const touchAction = element.style.touchAction;
  element.style.overflowY = "hidden";
  element.style.touchAction = "none";

  return {
    freeze: () => {
      element.scrollTop = top;
    },
    restore: (prepended?: boolean) => {
      element.style.overflowY = overflowY;
      element.style.touchAction = touchAction;
      if (prepended === undefined) return;
      element.scrollTop =
        prepended && anchor && element.contains(anchor) && anchorTop !== undefined
          ? top + anchor.getBoundingClientRect().top - anchorTop
          : top + (prepended ? element.scrollHeight - height : 0);
    },
  };
};
