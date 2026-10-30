import { useLayoutEffect, useRef } from "react";

export const useSidebarClipping = () => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scroll = ref.current;
    if (!scroll) return;

    const update = () => {
      const reserved = Number.parseFloat(scroll.style.paddingBottom) || 0;
      if (reserved > 0) {
        const contentHeight = scroll.scrollHeight - reserved;
        scroll.style.paddingBottom = `${Math.max(0, scroll.scrollTop + scroll.clientHeight - contentHeight)}px`;
      }
      for (const [headingSelector, listSelector] of [
        [
          ".pinned-sessions h2",
          ".pinned-sessions .sidebar-session-list, .pinned-sessions > .session-list",
        ],
        [".standalone-chats h2", ".standalone-chats .sidebar-session-list"],
        [".sidebar-heading", ".sidebar-projects"],
      ]) {
        const heading = scroll.querySelector<HTMLElement>(headingSelector);
        const list = scroll.querySelector<HTMLElement>(listSelector);
        if (!heading || !list) continue;

        const bounds = list.getBoundingClientRect();
        const hidden = Math.min(
          bounds.height,
          Math.max(0, heading.getBoundingClientRect().bottom - bounds.top),
        );
        list.style.setProperty("--sidebar-list-clip", `${hidden}px`);
      }
    };

    const resize = new window.ResizeObserver(update);
    resize.observe(scroll);
    const observeContent = () => {
      resize.disconnect();
      resize.observe(scroll);
      for (const child of scroll.querySelectorAll(
        ".pinned-sessions h2, .pinned-sessions > .session-list, .sidebar-session-list, .standalone-chats h2, .sidebar-heading, .sidebar-projects",
      )) {
        resize.observe(child);
      }
      update();
    };
    const mutations = new window.MutationObserver(observeContent);
    mutations.observe(scroll, { childList: true, subtree: true });
    scroll.addEventListener("scroll", update, { passive: true });
    observeContent();

    return () => {
      scroll.removeEventListener("scroll", update);
      resize.disconnect();
      mutations.disconnect();
    };
  }, []);

  return ref;
};
