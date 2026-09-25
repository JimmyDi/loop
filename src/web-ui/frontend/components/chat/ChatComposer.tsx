import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePrompt } from "../../hooks/usePrompt";
import { command } from "../../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ComposerInput } from "./ComposerInput";
import "./ChatComposer.css";

export const ChatComposer = ({
  snapshot,
  connected,
}: {
  snapshot: SessionSnapshot;
  connected: boolean;
}) => {
  const { t } = useTranslation();
  const prompt = usePrompt(snapshot);
  const stopping = useAsyncAction();
  const running = snapshot.operation === "prompt";
  const disabled =
    !connected ||
    snapshot.operation !== "idle" ||
    snapshot.state.hasPendingSave ||
    prompt.pending ||
    prompt.uncertain;
  const submit = () => {
    if (!disabled) void prompt.submit();
  };

  return (
    <div className="composer-region">
      <ErrorNotice error={prompt.error ?? stopping.error} />
      {prompt.uncertain && (
        <div className="composer-uncertain">
          {t("uncertain")}
          <ActionButton
            disabled={!connected || prompt.pending}
            onClick={() => void prompt.submit(true)}
          >
            {t("syncRetry")}
          </ActionButton>
        </div>
      )}
      <form
        className="chat-composer"
        data-running={running}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <ComposerInput
          value={prompt.text}
          onChange={prompt.setText}
          onSubmit={submit}
          disabled={disabled}
          placeholder={t("placeholder")}
        />
        <div className="composer-toolbar">
          <span>{t("composerHint")}</span>
          {running ? (
            <ActionButton
              className="composer-send stop"
              aria-label={t("stop")}
              disabled={stopping.pending}
              onClick={() =>
                void stopping.run(() => command("/sessions/" + snapshot.sessionId + "/abort"))
              }
            >
              ■
            </ActionButton>
          ) : (
            <ActionButton
              className="composer-send primary"
              type="submit"
              aria-label={t("send")}
              disabled={disabled || !prompt.text.trim()}
            >
              ↑
            </ActionButton>
          )}
        </div>
        {stopping.pending && (
          <span className="sr-only" role="status">
            {t("stopping")}
          </span>
        )}
      </form>
    </div>
  );
};
