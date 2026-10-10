import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePrompt } from "../../hooks/usePrompt";
import { useModelSelection } from "../../hooks/useModelSelection";
import { useSessionPermission } from "../../hooks/useSessionPermission";
import { command } from "../../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ComposerInput } from "./ComposerInput";
import { ComposerSkills } from "./ComposerSkills";
import { ComposerModelSettings } from "./ComposerModelSettings";
import { SessionPermissions } from "./SessionPermissions";
import { ComposerAttachments } from "./ComposerAttachments";
import { ComposerAddMenu } from "./ComposerAddMenu";
import { useComposerAttachments } from "../../hooks/useComposerAttachments";
import { useComposerProject } from "../../hooks/useComposerProject";
import { ComposerProjectSelector } from "./ComposerProjectSelector";
import { useModels } from "../../hooks/useModels";
import { useContextCompaction } from "../../hooks/useContextCompaction";
import { ComposerCommands } from "./ComposerCommands";
import { ComposerSendButton } from "./ComposerSendButton";
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
  const [focusRequest, setFocusRequest] = useState(0);
  const newSession =
    snapshot.state.messages.length === 0 && !snapshot.state.draft && !snapshot.requestId;
  const project = useComposerProject(snapshot, newSession);
  const prompt = usePrompt(snapshot, project.hasProject);
  const stopping = useAsyncAction();
  const model = useModelSelection(snapshot);
  const permission = useSessionPermission(snapshot);
  const attachments = useComposerAttachments(snapshot.sessionId);
  const models = useModels();
  const compact = useContextCompaction(snapshot, connected);
  const current =
    models.data?.find(
      (model) => model.provider === snapshot.model.provider && model.id === snapshot.model.id,
    ) ?? snapshot.model;
  const unsupportedImages = prompt.images.length > 0 && current.input?.includes("image") === false;
  const imageError = useMemo(
    () => (unsupportedImages ? new ApiError("model_images_unsupported", "", 400) : undefined),
    [unsupportedImages],
  );
  const running = snapshot.operation === "prompt" || compact.running;
  const disabled =
    !connected ||
    project.pending ||
    snapshot.operation !== "idle" ||
    snapshot.state.hasPendingSave ||
    !!snapshot.state.pendingApprovals?.length ||
    prompt.pending ||
    compact.running ||
    prompt.uncertain;
  const blocked =
    disabled || model.pending || permission.pending || attachments.pending || project.pending;
  const submit = () => {
    if (blocked || unsupportedImages || !project.hasProject) return;
    const slash = prompt.text.match(/^\s*\/([a-z]*)\s*$/i);
    if (slash) {
      if ("compact".startsWith(slash[1]!.toLowerCase())) void compact.start();
      return;
    }
    if (!prompt.text.trim() && !prompt.images.length && !prompt.files.length) return;

    setFocusRequest((request) => request + 1);
    void prompt.submit();
  };

  return (
    <div className="composer-region">
      <ErrorNotice
        dismissible
        error={
          prompt.error ??
          compact.error ??
          stopping.error ??
          model.error ??
          permission.error ??
          attachments.error ??
          project.error ??
          imageError
        }
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
      {newSession && <ComposerProjectSelector selection={project} disabled={blocked} />}
      <form
        className="chat-composer"
        data-running={snapshot.operation === "prompt"}
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
          sessionId={snapshot.sessionId}
          hideSkills={prompt.submitted}
          focusRequest={focusRequest}
          value={compact.running && /^\s*\/[a-z]*\s*$/i.test(prompt.text) ? "" : prompt.text}
          onChange={prompt.setText}
          onSubmit={submit}
          disabled={disabled || model.pending || permission.pending}
          onFiles={(files) => void attachments.add(files)}
          placeholder={t("placeholder")}
        />
        <ComposerSkills
          sessionId={snapshot.sessionId}
          workspaceId={snapshot.workspaceId}
          text={prompt.text}
          onText={prompt.setText}
          disabled={blocked}
        />
        <ComposerCommands
          snapshot={snapshot}
          text={prompt.text}
          disabled={blocked}
          commandDisabled={compact.disabled}
          onCompact={() => void compact.start()}
        />
        <div className="composer-toolbar">
          <ComposerAddMenu
            disabled={blocked}
            imageCount={prompt.images.length}
            fileCount={prompt.files.length}
            add={(files) => void attachments.add(files)}
          />
          <SessionPermissions
            key={snapshot.sessionId}
            snapshot={snapshot}
            disabled={disabled || model.pending || attachments.pending}
            pending={permission.pending}
            error={permission.error}
            select={permission.change}
          />
          <ComposerModelSettings
            snapshot={snapshot}
            disabled={disabled || permission.pending}
            pending={model.pending}
            error={model.error}
            select={model.change}
          />
          <ComposerSendButton
            running={running}
            stopping={stopping.pending}
            disabled={
              blocked ||
              !project.hasProject ||
              unsupportedImages ||
              (!prompt.text.trim() && !prompt.images.length && !prompt.files.length)
            }
            onStop={() =>
              void stopping.run(() => command("/sessions/" + snapshot.sessionId + "/abort"))
            }
          />
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
