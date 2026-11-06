import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import type { SessionSnapshot } from "../../shared/protocol";
import { timelinePreviews } from "../../shared/timeline-navigation";
import type { TimelineNavigation } from "../../shared/timeline-navigation";
import { api } from "../lib/api";

export const useMessageNavigation = (
  snapshot: SessionSnapshot,
  viewport: RefObject<HTMLDivElement | null>,
) => {
  const [saved, setSaved] = useState<TimelineNavigation>({ previews: [], bookmarks: [] });
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const [active, setActive] = useState<number>();
  const scrolled = useRef(false);
  const path = "/sessions/" + encodeURIComponent(snapshot.sessionId) + "/navigation";
  const total = snapshot.history?.total ?? snapshot.state.messages.length;
  useEffect(() => {
    const abort = new AbortController();
    const load = () => {
      void api<TimelineNavigation>(path, { signal: abort.signal })
        .then((value) => {
          if (!abort.signal.aborted && !saving.current) setSaved(value);
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("focus", load);
    return () => {
      abort.abort();
      window.removeEventListener("focus", load);
    };
  }, [path, snapshot.streamId, total, snapshot.operation]);
  const previews = useMemo(() => {
    const merged = new Map(saved.previews.map((preview) => [preview.index, preview]));
    const messages = [...snapshot.state.messages];
    if (snapshot.state.draft)
      messages[
        (snapshot.draftIndex ?? (snapshot.history?.start ?? 0) + messages.length) -
          (snapshot.history?.start ?? 0)
      ] = snapshot.state.draft;
    for (const preview of timelinePreviews(messages, snapshot.history?.start ?? 0))
      merged.set(preview.index, preview);
    return [...merged.values()].sort((a, b) => a.index - b.index);
  }, [
    saved.previews,
    snapshot.state.messages,
    snapshot.state.draft,
    snapshot.draftIndex,
    snapshot.history?.start,
  ]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => {
      if (!scrolled.current) return;
      if (
        element.scrollHeight > 0 &&
        element.scrollHeight - element.scrollTop - element.clientHeight <= 1
      ) {
        setActive(previews.at(-1)?.index);
        return;
      }
      const padding =
        Number.parseFloat(
          element.ownerDocument.defaultView?.getComputedStyle(element).paddingTop ?? "",
        ) || 0;
      const top = element.getBoundingClientRect().top + padding;
      let index: number | undefined;
      for (const row of element.querySelectorAll<HTMLElement>(
        ".timeline-content > .virtual-list > .virtual-row",
      )) {
        const parts = row.dataset.rowKey?.split(":") ?? [];
        const messageIndex = Number(parts.at(-1));
        if (row.getBoundingClientRect().bottom > top) {
          index = previews.findLast((preview) => preview.index <= messageIndex)?.index;
          break;
        }
      }
      if (index !== undefined) setActive(index);
    };
    const onScroll = () => {
      scrolled.current = true;
      update();
    };
    update();
    element.addEventListener("scroll", onScroll, { passive: true });
    const Observer = element.ownerDocument.defaultView?.MutationObserver;
    const observer = Observer ? new Observer(update) : undefined;
    const content = element.querySelector(".timeline-content");
    if (content) observer?.observe(content, { childList: true, subtree: true });
    return () => {
      element.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [previews, viewport]);
  const toggle = async (index: number) => {
    if (saving.current) return;
    saving.current = true;
    setPending(true);
    setError(false);
    try {
      const result = await api<{ bookmarks: number[] }>(path, {
        method: "PUT",
        body: JSON.stringify({
          messageIndex: index,
          bookmarked: !saved.bookmarks.includes(index),
          streamId: snapshot.streamId,
        }),
      });
      setSaved((previous) => ({ ...previous, bookmarks: result.bookmarks }));
    } catch {
      setError(true);
    } finally {
      saving.current = false;
      setPending(false);
    }
  };
  return { previews, bookmarks: saved.bookmarks, error, pending, active, toggle };
};
