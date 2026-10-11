import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { queuedContent } from "../../../shared/queued-content";
import { command } from "../../lib/api";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { MessageQueueActions } from "./MessageQueueActions";
import { ErrorNotice } from "../ui/ErrorNotice";
import { useQueueDrag } from "../../hooks/useQueueDrag";
import "./MessageQueue.css";

export const MessageQueue = ({
  snapshot,
  disabled,
  editingId,
  onEdit,
}: {
  snapshot: SessionSnapshot;
  disabled: boolean;
  editingId?: string;
  onEdit(id: string): void;
}) => {
  const { t } = useTranslation();
  const action = useAsyncAction();
  const items = (snapshot.state.queue ?? []).filter((item) => item.id !== editingId);
  const run = (id: string, operation: string, fields: { text?: string; beforeId?: string } = {}) =>
    action.run(async () => {
      await command("/sessions/" + snapshot.sessionId + "/queue", {
        id,
        action: operation,
        ...fields,
      });
    });
  const drag = useQueueDrag(
    items.map((item) => item.id),
    disabled || action.pending,
    (id, beforeId) => void run(id, "move", { beforeId }),
  );
  if (!items.length) return null;
  return (
    <div className="message-queue">
      <ErrorNotice error={action.error} dismissible />
      {snapshot.state.canResume && (
        <div className="queue-paused">
          <span>{t("queuePaused")}</span>
        </div>
      )}
      <ol
        aria-label={t("queueTitle", { count: items.length })}
        data-dragging={!!drag.id}
        onDragOver={drag.over}
        onDrop={drag.drop}
      >
        {items.map((item, index) => {
          const payload = queuedContent(item.content);
          const locked = disabled || action.pending || item.steering;
          return (
            <li
              key={item.id}
              data-steering={item.steering}
              data-held={!!item.editing}
              data-queue-id={item.id}
              data-dragged={drag.id === item.id}
              style={{ transform: "translateY(" + drag.offset(item.id) + "px)" }}
            >
              <button
                type="button"
                className="queue-drag"
                draggable={!locked}
                disabled={locked}
                aria-label={t("queueDrag")}
                title={t("queueDrag")}
                onDragStart={(event) => drag.start(event, item.id)}
                onDragEnd={drag.cancel}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp" && index > 0) {
                    event.preventDefault();
                    void run(item.id, "move", { beforeId: items[index - 1]!.id });
                  }
                  if (event.key === "ArrowDown" && index < items.length - 1) {
                    event.preventDefault();
                    void run(item.id, "move", { beforeId: items[index + 2]?.id });
                  }
                }}
              >
                <svg className="queue-grip" viewBox="0 0 10 18" aria-hidden="true">
                  <circle cx="3" cy="3" r="1" />
                  <circle cx="7" cy="3" r="1" />
                  <circle cx="3" cy="9" r="1" />
                  <circle cx="7" cy="9" r="1" />
                  <circle cx="3" cy="15" r="1" />
                  <circle cx="7" cy="15" r="1" />
                </svg>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 4v11a3 3 0 0 0 3 3h12m-4-4 4 4-4 4M9 6h8M9 10h8" />
                </svg>
              </button>
              <div className="queue-body">
                <div className="queue-text" title={payload.text || t("queueAttachments")}>
                  {payload.text || t("queueAttachments")}
                </div>
                {(payload.images.length > 0 ||
                  payload.files.length > 0 ||
                  item.skills.length > 0 ||
                  item.editing) && (
                  <div className="queue-metadata">
                    {item.editing
                      ? t("queueEditing")
                      : t("queuePayload", {
                          images: payload.images.length,
                          files: payload.files.length,
                          skills: item.skills.length,
                        })}
                  </div>
                )}
              </div>
              <MessageQueueActions
                disabled={locked || !!drag.id}
                editing={false}
                editDisabled={!!editingId}
                held={!!item.editing}
                steering={item.steering}
                onEdit={() => onEdit(item.id)}
                onSteer={() => void run(item.id, "steer")}
                onDelete={() => void run(item.id, "delete")}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
};
