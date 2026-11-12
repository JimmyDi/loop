import { useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useMessageNavigation } from "../../hooks/useMessageNavigation";
import { useNavigationRail } from "../../hooks/useNavigationRail";
import { MarkdownText } from "./MarkdownText";
import "./MessageNavigation.css";

export const MessageNavigation = ({
  snapshot,
  viewport,
  onSelect,
  hasLaterMessages = false,
}: {
  snapshot: SessionSnapshot;
  viewport: RefObject<HTMLDivElement | null>;
  onSelect: (index: number) => void;
  hasLaterMessages?: boolean;
}) => {
  const { t } = useTranslation();
  const navigation = useMessageNavigation(snapshot, viewport, hasLaterMessages);
  const [hovered, setHovered] = useState<number>();
  const preview = navigation.previews.find((item) => item.index === hovered);
  const hoverPosition = navigation.previews.findIndex((item) => item.index === hovered);
  const bookmarked = preview !== undefined && navigation.bookmarks.includes(preview.index);
  const active = navigation.active ?? navigation.previews.at(-1)?.index;
  const activePosition = navigation.previews.findIndex((item) => item.index === active);
  const rail = useNavigationRail(
    activePosition,
    hoverPosition,
    navigation.previews.length,
    snapshot.sessionId + ":" + snapshot.streamId,
  );
  if (!navigation.previews.length) return null;
  return (
    <nav
      className="message-navigation"
      style={{ "--navigation-count": navigation.previews.length } as CSSProperties}
      aria-label={t("messageNavigation.label")}
      onMouseLeave={() => setHovered(undefined)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(undefined);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHovered(undefined);
          event.stopPropagation();
        }
      }}
    >
      <div
        className="message-navigation-marks"
        ref={rail.marks}
        onScroll={rail.onScroll}
        data-overflow-above={rail.above}
        data-overflow-below={rail.below}
      >
        {navigation.previews.map((item, position) => (
          <button
            type="button"
            className="message-navigation-mark"
            key={item.index}
            data-expanded={hovered === item.index}
            data-wave-distance={
              hoverPosition < 0 ? 4 : Math.min(4, Math.abs(position - hoverPosition))
            }
            data-active={active === item.index}
            data-near-active={
              navigation.active === undefined
                ? active === item.index
                : activePosition >= 0 && Math.abs(position - activePosition) <= 1
            }
            aria-current={active === item.index ? "location" : undefined}
            aria-label={t("messageNavigation.turn", {
              number: position + 1,
              text: item.user || t("messageNavigation.attachment"),
            })}
            onMouseEnter={() => setHovered(item.index)}
            onFocus={() => setHovered(item.index)}
            onClick={() => onSelect(item.index)}
          >
            <span className="message-navigation-line">
              {navigation.bookmarks.includes(item.index) && (
                <span
                  className="message-navigation-dot"
                  aria-label={t("messageNavigation.bookmarked")}
                />
              )}
            </span>
          </button>
        ))}
      </div>
      {preview && rail.previewTop !== undefined && (
        <div className="message-navigation-preview" style={{ top: rail.previewTop }}>
          <button
            type="button"
            className="message-navigation-bookmark"
            aria-pressed={bookmarked}
            disabled={navigation.pending}
            aria-label={t(bookmarked ? "messageNavigation.remove" : "messageNavigation.add")}
            title={t(bookmarked ? "messageNavigation.remove" : "messageNavigation.add")}
            onClick={() => void navigation.toggle(preview.index)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.7"
              fill={bookmarked ? "currentColor" : "none"}
              aria-hidden="true"
            >
              <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-4-6 4Z" />
            </svg>
          </button>
          <div className="message-navigation-summary" inert>
            <div className="message-navigation-user">
              <MarkdownText text={preview.user || t("messageNavigation.attachment")} />
            </div>
            <div className="message-navigation-reply">
              <MarkdownText text={preview.reply || t("messageNavigation.noReply")} />
            </div>
          </div>
          <button
            type="button"
            className="message-navigation-jump"
            aria-label={t("messageNavigation.turn", {
              number: hoverPosition + 1,
              text: preview.user || t("messageNavigation.attachment"),
            })}
            onClick={() => onSelect(preview.index)}
          />
          {navigation.error && <p role="alert">{t("messageNavigation.failed")}</p>}
        </div>
      )}
    </nav>
  );
};
