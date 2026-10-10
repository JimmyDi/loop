import { useLayoutEffect, useRef, useState } from "react";

type TimelinePosition = { sessionId: string; userMessageIndex: number; activityKey?: number };

export const useAutoScroll = ({
  sessionId,
  userMessageIndex,
  running,
  activityKey,
  revision,
}: TimelinePosition & { running: boolean; revision: unknown }) => {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const userMessageRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const previous = useRef<TimelinePosition | undefined>(undefined);
  const anchored = useRef(false);
  const followingUser = useRef(false);
  const lastScroll = useRef({ top: 0, width: 0, height: 0 });
  const [atBottom, setAtBottom] = useState(true);
  const onScroll = () => {
    const element = ref.current;
    const end = endRef.current;
    if (!element || !end) return;

    const last = lastScroll.current;
    const resized = last.width !== element.clientWidth || last.height !== element.clientHeight;
    // Resizing can clamp scrollTop before ResizeObserver restores reserved space.
    // Only a scroll within the same viewport releases the user-message anchor.
    if (!resized && Math.abs(element.scrollTop - last.top) > 1) followingUser.current = false;
    lastScroll.current = {
      top: element.scrollTop,
      width: element.clientWidth,
      height: element.clientHeight,
    };

    const paddingBottom =
      Number.parseFloat(
        element.ownerDocument.defaultView?.getComputedStyle(element).paddingBottom ?? "",
      ) || 0;
    const remaining =
      end.getBoundingClientRect().top -
      element.getBoundingClientRect().top +
      paddingBottom -
      element.clientHeight;
    setAtBottom(remaining < 80);
  };
  const jump = () => {
    const element = ref.current;
    const end = endRef.current;
    if (!element || !end) return;

    followingUser.current = false;
    const paddingBottom =
      Number.parseFloat(
        element.ownerDocument.defaultView?.getComputedStyle(element).paddingBottom ?? "",
      ) || 0;

    element.scrollTop = Math.max(
      0,
      element.scrollTop +
        end.getBoundingClientRect().top -
        element.getBoundingClientRect().top +
        paddingBottom -
        element.clientHeight,
    );
    onScroll();
  };
  const alignUserMessage = () => {
    const element = ref.current;
    const user = userMessageRef.current;
    if (!element || !user) return;

    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    const paddingTop = Number.parseFloat(style?.paddingTop ?? "") || 0;
    element.scrollTop +=
      user.getBoundingClientRect().top - element.getBoundingClientRect().top - paddingTop;
    lastScroll.current.top = element.scrollTop;
  };
  const updateMinHeight = () => {
    const element = ref.current;
    const content = contentRef.current;
    const user = userMessageRef.current;
    if (!element || !content) return;

    let height = 0;
    if (anchored.current && user) {
      const style = element.ownerDocument.defaultView?.getComputedStyle(element);
      const padding =
        (Number.parseFloat(style?.paddingTop ?? "") || 0) +
        (Number.parseFloat(style?.paddingBottom ?? "") || 0);
      const userOffset = user.getBoundingClientRect().top - content.getBoundingClientRect().top;
      // A minimum height keeps short turns at the top even when the waiting
      // indicator disappears. Replies naturally fill the reserved space.
      height = Math.max(0, userOffset + element.clientHeight - padding);
    }
    const value = `${height}px`;
    if (content.style.minHeight !== value) content.style.minHeight = value;
  };

  useLayoutEffect(() => {
    const opening = previous.current?.sessionId !== sessionId;
    const newUser =
      userMessageIndex >= 0 && previous.current?.userMessageIndex !== userMessageIndex;
    const alignUser = userMessageIndex >= 0 && (opening ? running : newUser);

    if (opening) {
      anchored.current = false;
      followingUser.current = false;
    }
    if (alignUser) {
      anchored.current = true;
      followingUser.current = true;
    }
    updateMinHeight();

    if (
      !alignUser &&
      (opening || (activityKey !== undefined && previous.current?.activityKey !== activityKey))
    ) {
      jump();
    } else if (followingUser.current) {
      alignUserMessage();
    }
    onScroll();
    previous.current = { sessionId, userMessageIndex, activityKey };
  }, [sessionId, userMessageIndex, running, revision, activityKey]);

  useLayoutEffect(() => {
    if (!ref.current || !contentRef.current || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      updateMinHeight();
      if (followingUser.current) alignUserMessage();
      onScroll();
    });
    observer.observe(ref.current);
    observer.observe(contentRef.current);

    return () => observer.disconnect();
  }, []);

  return { ref, contentRef, userMessageRef, endRef, onScroll, atBottom, jump };
};
