export const scrollSidebarSection = (heading: HTMLElement, target: string) => {
  const scroll = heading.closest<HTMLElement>(".sidebar-scroll");
  const first = scroll?.querySelector<HTMLElement>(target);
  if (!scroll || !first) return;

  const headings = [
    ...scroll.querySelectorAll<HTMLElement>(
      ".pinned-sessions h2, .standalone-chats h2, .sidebar-heading",
    ),
  ];
  const index = headings.indexOf(heading);
  const clearance = (index < 0 ? [heading] : headings.slice(0, index + 1)).reduce(
    (height, item) => height + item.getBoundingClientRect().height,
    0,
  );
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
