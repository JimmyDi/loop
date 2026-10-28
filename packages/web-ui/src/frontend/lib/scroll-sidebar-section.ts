export const scrollSidebarSection = (heading: HTMLElement, target: string) => {
  const scroll = heading.closest<HTMLElement>(".sidebar-scroll");
  const first = scroll?.querySelector<HTMLElement>(target);
  if (!scroll || !first) return;

  const pinned = scroll.querySelector<HTMLElement>(".pinned-sessions h2");
  const clearance =
    heading.getBoundingClientRect().height +
    (pinned && pinned !== heading ? pinned.getBoundingClientRect().height : 0);
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
