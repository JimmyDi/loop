const headingClearance = (scroll: HTMLElement, heading: HTMLElement) => {
  const headings = [
    ...scroll.querySelectorAll<HTMLElement>(
      ".pinned-sessions h2, .standalone-chats h2, .sidebar-heading",
    ),
  ];
  const index = headings.indexOf(heading);
  return (index < 0 ? [heading] : headings.slice(0, index + 1)).reduce((height, item) => {
    const margin = Number.parseFloat(
      item.ownerDocument.defaultView?.getComputedStyle(item).marginTop ?? "0",
    );
    return height + item.getBoundingClientRect().height + (Number.isFinite(margin) ? margin : 0);
  }, 0);
};

export const preserveSidebarScroll = (heading: HTMLElement, collapse: () => void) => {
  const scroll = heading.closest<HTMLElement>(".sidebar-scroll");
  if (!scroll) {
    collapse();
    return;
  }

  const top = scroll.scrollTop;
  // Reserve space before collapsing so the browser cannot clamp the current scroll position.
  const reserved = Number.parseFloat(scroll.style.paddingBottom) || 0;
  const temporary = reserved + scroll.scrollHeight;
  scroll.style.paddingBottom = `${temporary}px`;
  collapse();
  const contentHeight = scroll.scrollHeight - temporary;
  scroll.style.paddingBottom = `${Math.max(0, top + scroll.clientHeight - contentHeight)}px`;
  scroll.scrollTop = top;
};

export const isSidebarSectionAtTop = (heading: HTMLElement, target: string) => {
  const scroll = heading.closest<HTMLElement>(".sidebar-scroll");
  const first = scroll?.querySelector<HTMLElement>(target);
  if (!scroll || !first) return true;

  const margin = Number.parseFloat(
    first.ownerDocument.defaultView?.getComputedStyle(first).marginTop ?? "0",
  );
  const gap = Number.isFinite(margin) ? Math.max(0, margin) : 0;
  return (
    Math.abs(first.getBoundingClientRect().top - heading.getBoundingClientRect().bottom - gap) <= 1
  );
};

export const scrollSidebarSection = (heading: HTMLElement, target: string) => {
  const scroll = heading.closest<HTMLElement>(".sidebar-scroll");
  const first = scroll?.querySelector<HTMLElement>(target);
  if (!scroll || !first) return;

  const clearance = headingClearance(scroll, heading);
  scroll.scrollTop = Math.max(
    0,
    scroll.scrollTop +
      first.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      clearance,
  );
  const event = scroll.ownerDocument.createEvent("Event");
  event.initEvent("scroll", false, false);
  scroll.dispatchEvent(event);
};
