import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SkillJob, SkillPreviewInput, SkillScope } from "../../../shared/skills";
import { useSkillInstall } from "../../hooks/useSkillInstall";
import type { useSkills } from "../../hooks/useSkills";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SkillPreview } from "./SkillPreview";
import "./SkillInstallForm.css";

export const SkillInstallForm = ({
  kind,
  api,
  hasProject,
  projectName,
  initialScope = "personal",
  initial,
  updateId,
  updateScope,
  onClose,
}: {
  kind: SkillPreviewInput["kind"];
  api: ReturnType<typeof useSkills>;
  hasProject: boolean;
  projectName?: string;
  initialScope?: SkillScope;
  initial?: SkillJob;
  updateId?: string;
  updateScope?: SkillScope;
  onClose(installedScope?: SkillScope): void;
}) => {
  const { t } = useTranslation();
  const [location, setLocation] = useState("");
  const [ref, setRef] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [scope, setScope] = useState<SkillScope>(updateScope ?? initialScope);
  const [keys, setKeys] = useState<string[]>([]);
  const [checkedInput, setCheckedInput] = useState("");
  const install = useSkillInstall(api, initial);
  const job = install.job;
  useEffect(() => {
    if (job?.status === "ready") setKeys(job.candidates?.map((skill) => skill.key) ?? []);
  }, [job?.id, job?.status]);
  const busy = install.pending || job?.status === "running";
  const content =
    "---\nname: " +
    JSON.stringify(name) +
    "\ndescription: " +
    JSON.stringify(description) +
    "\n---\n\n" +
    instructions;
  const inputSignature = JSON.stringify({ location, ref, content });
  const ready = job?.status === "ready" && (!!initial || checkedInput === inputSignature);
  return (
    <form
      className="skill-install-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        if (ready)
          void install.install(keys, scope, updateId).then((success) => {
            if (success) onClose(scope);
          });
        else {
          setCheckedInput(inputSignature);
          void install.preview({ kind, location, ref: ref || undefined, content }, updateId);
        }
      }}
    >
      <ActionButton onClick={() => void install.cancel().then(() => onClose())}>
        ← {t("cancel")}
      </ActionButton>
      <h3>{t(updateId ? "skills.update" : "skills." + kind)}</h3>
      <div className="skill-install-body" aria-busy={busy}>
        <fieldset disabled={busy}>
          {!initial &&
            (kind === "created" ? (
              <>
                <label>
                  {t("skills.name")}
                  <input required value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  {t("skills.description")}
                  <input
                    required
                    maxLength={1024}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </label>
                <label>
                  {t("skills.instructions")}
                  <textarea
                    required
                    rows={8}
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {t("skills.location")}
                  <input
                    required
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                  />
                </label>
                {kind === "local" && <small>{t("skills.localHint")}</small>}
                {kind === "github" && (
                  <label>
                    {t("skills.version")}
                    <input value={ref} onChange={(event) => setRef(event.target.value)} />
                  </label>
                )}
              </>
            ))}
          <label>
            {t("skills.scope")}
            <select
              value={scope}
              disabled={!!updateId}
              onChange={(event) => setScope(event.target.value as SkillScope)}
            >
              <option value="personal">{t("skills.personal")}</option>
              {hasProject && (
                <option value="project">
                  {projectName
                    ? t("skills.projectTarget", { name: projectName })
                    : t("skills.project")}
                </option>
              )}
            </select>
          </label>
          {ready && job?.candidates && (
            <SkillPreview job={job} selected={keys} onSelect={setKeys} />
          )}
        </fieldset>
        {busy && (
          <div className="skill-install-overlay">
            <span role="status">
              <i className="skill-spinner" />
              {t("skills." + (job?.stage ?? "checking"))}
            </span>
          </div>
        )}
      </div>
      <ErrorNotice error={install.error ?? job?.error} />
      <div className="skill-install-actions">
        <ActionButton type="submit" className="primary" disabled={busy || (ready && !keys.length)}>
          {t(ready ? (updateId ? "skills.update" : "skills.install") : "skills.check")}
        </ActionButton>
      </div>
    </form>
  );
};
