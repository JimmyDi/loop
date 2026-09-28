import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePrompt } from "../../hooks/usePrompt";
import { useModelSelection } from "../../hooks/useModelSelection";
import { command } from "../../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ComposerInput } from "./ComposerInput";
import { ComposerModelSettings } from "./ComposerModelSettings";
import { ComposerAttachments } from "./ComposerAttachments";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { useComposerAttachments } from "../../hooks/useComposerAttachments";
import { useModels } from "../../hooks/useModels";
import { ApiError } from "../../lib/api";
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
  const model = useModelSelection(snapshot);
  const attachments = useComposerAttachments(snapshot.sessionId);
  const models = useModels();
  const current =
    models.data?.find(
      (model) => model.provider === snapshot.model.provider && model.id === snapshot.model.id,
    ) ?? snapshot.model;
  const unsupportedImages = prompt.images.length > 0 && current.input?.includes("image") === false;
  const imageError = useMemo(
    () => (unsupportedImages ? new ApiError("model_images_unsupported", "", 400) : undefined),
    [unsupportedImages],
  );
  const running = snapshot.operation === "prompt";
  const disabled =
    !connected ||
    snapshot.operation !== "idle" ||
    snapshot.state.hasPendingSave ||
    prompt.pending ||
    prompt.uncertain;
  const blocked = disabled || model.pending || attachments.pending;
  const submit = () => {
    if (!blocked && !unsupportedImages) void prompt.submit();
  };

  return (
    <div className="composer-region">
      <ErrorNotice
        dismissible
        error={prompt.error ?? stopping.error ?? model.error ?? attachments.error ?? imageError}
      />
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
        <ComposerAttachments
          images={prompt.images}
          files={prompt.files}
          disabled={blocked}
          remove={attachments.remove}
          removeFile={attachments.removeFile}
        />
        <ComposerInput
          value={prompt.text}
          onChange={prompt.setText}
          onSubmit={submit}
          disabled={disabled || model.pending}
          onFiles={(files) => void attachments.add(files)}
          placeholder={t("placeholder")}
        />
        <div className="composer-toolbar">
          <ComposerAddMenu
            disabled={blocked}
            imageCount={prompt.images.length}
            fileCount={prompt.files.length}
            add={(files) => void attachments.add(files)}
          />
          <ComposerModelSettings
            snapshot={snapshot}
            disabled={disabled}
            pending={model.pending}
            error={model.error}
            select={model.change}
          />
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
              disabled={
                blocked ||
                unsupportedImages ||
                (!prompt.text.trim() && !prompt.images.length && !prompt.files.length)
              }
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
