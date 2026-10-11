import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { usePrompt } from "../../hooks/usePrompt";
import { useModelSelection } from "../../hooks/useModelSelection";
import { useSessionPermission } from "../../hooks/useSessionPermission";
import { command } from "../../lib/api";
import { ComposerDeliveryNotice } from "./ComposerDeliveryNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { MessageQueue } from "./MessageQueue";
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
import { useQueuedComposer } from "../../hooks/useQueuedComposer";
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
  const queue = useQueuedComposer(snapshot, () => setFocusRequest((request) => request + 1));
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
  const running = snapshot.operation === "prompt" || compact.running;
  const hasContent = !!prompt.text.trim() || !!prompt.images.length || !!prompt.files.length;
  const queueing = snapshot.operation === "prompt" && !!snapshot.state.queue?.length && hasContent;
  const disabled =
    !connected ||
    project.pending ||
    (snapshot.operation !== "idle" && snapshot.operation !== "prompt") ||
    snapshot.state.hasPendingSave ||
    prompt.pending ||
    compact.running ||
    prompt.uncertain ||
    queue.pending;
  const blocked =
    disabled || model.pending || permission.pending || attachments.pending || stopping.pending;
  const control = (action: "abort" | "resume") =>
    void stopping.run(() => command("/sessions/" + snapshot.sessionId + "/" + action));
  const submit = () => {
    if (blocked || unsupportedImages || !project.hasProject) return;
    if (queue.editing) {
      void queue.save();
      return;
    }
    const slash = prompt.text.match(/^\s*\/([a-z]*)\s*$/i);
    if (slash) {
      if ("compact".startsWith(slash[1]!.toLowerCase())) void compact.start();
      return;
    }
    if (!prompt.text.trim() && !prompt.images.length && !prompt.files.length) return;

    setFocusRequest((request) => request + 1);
    void prompt.submit();
  };

  const error = [
    prompt.error,
    queue.error,
    compact.error,
    stopping.error,
    model.error,
    permission.error,
    attachments.error,
    project.error,
    unsupportedImages ? new ApiError("model_images_unsupported", "", 400) : undefined,
  ].find((error) => error !== undefined);

  return (
    <div className="composer-region">
      <ErrorNotice dismissible error={error} />
      {prompt.uncertain && (
        <ComposerDeliveryNotice
          disabled={!connected || prompt.pending}
          retry={() => void prompt.submit(true)}
        />
      )}
      <MessageQueue
        snapshot={snapshot}
        disabled={blocked}
        editingId={queue.editing?.id}
        onEdit={(id) => void queue.begin(id)}
      />
      {newSession && <ComposerProjectSelector selection={project} disabled={blocked} />}
      <form
        className="chat-composer"
        data-running={snapshot.operation === "prompt" && !queue.editing}
        data-editing={!!queue.editing}
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
          focusRequest={focusRequest}
          value={compact.running && /^\s*\/[a-z]*\s*$/i.test(prompt.text) ? "" : prompt.text}
          onChange={prompt.setText}
          onSubmit={submit}
          disabled={
            !connected || project.pending || model.pending || permission.pending || queue.pending
          }
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
          disabled={blocked || !!queue.editing}
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
            disabled={disabled || running || model.pending || attachments.pending}
            pending={permission.pending}
            error={permission.error}
            select={permission.change}
          />
          <ComposerModelSettings
            snapshot={snapshot}
            disabled={disabled || running || permission.pending}
            pending={model.pending}
            error={model.error}
            select={model.change}
          />
          <ComposerSendButton
            running={running && !queue.editing && !queueing}
            stopping={stopping.pending}
            disabled={blocked || !project.hasProject || unsupportedImages || !hasContent}
            resume={snapshot.state.canResume && !queue.editing ? { disabled: blocked } : undefined}
            onResume={() => control("resume")}
            onStop={() => control("abort")}
          />
        </div>
      </form>
    </div>
  );
};
