import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import type { SkillJob, SkillPreviewInput, SkillSummary } from "../../../shared/skills";
import { useSkills } from "../../hooks/useSkills";
import { useProjects } from "../../hooks/useProjects";
import { useWorkspace } from "../../state/workspace-store";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SkillRow } from "./SkillRow";
import { SkillInstallForm } from "./SkillInstallForm";
import { SkillDetails } from "./SkillDetails";
import { PluginAddMenu } from "./PluginAddMenu";
import { PluginSearch } from "./PluginSearch";
import { SkillScopeTabs } from "./SkillScopeTabs";
import { InstalledSkills } from "./InstalledSkills";
import "./SkillsSettings.css";

export const SkillsSettings = ({ onUse }: { onUse?(): void }) => {
  const { t } = useTranslation();
  const active = useWorkspace((state) => state.active);
  const [selectedId, setWorkspaceId] = useState("");
  const projects = useProjects();
  const project = projects.projects.data?.find((item) => item.id === selectedId);
  const workspaceId = selectedId;
  const scope = workspaceId ? "project" : "personal";
  const api = useSkills(workspaceId || undefined);
  const action = useAsyncAction();
  const [search, setSearch] = useState("");
  const [install, setInstall] = useState<
    { kind: SkillPreviewInput["kind"]; initial?: SkillJob; skill?: SkillSummary } | undefined
  >();
  const [detail, setDetail] = useState<SkillSummary & { content: string; files?: string[] }>();
  useEffect(() => setDetail(undefined), [workspaceId]);
  useEffect(() => {
    if (projects.projects.isSuccess && selectedId && !project && !install && !action.pending) {
      setWorkspaceId("");
    }
  }, [projects.projects.isSuccess, selectedId, project, install, action.pending]);
  const skills = (api.query.data?.skills ?? []).filter((skill) => skill.scope === scope);
  const shown = skills.filter((skill) =>
    (skill.name + " " + skill.description).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="skills-settings">
      <div className="integration-heading">
        <h3>{t("skills.title")}</h3>
        <div className="integration-actions">
          <PluginSearch label={t("skills.search")} value={search} onChange={setSearch} />
          <ActionButton
            className="icon ghost skill-refresh"
            aria-label={t("skills.refresh")}
            title={t("skills.refresh")}
            disabled={!!install || action.pending}
            onClick={() => void action.run(api.refresh)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 11a8 8 0 1 1-2.3-5.7L20 8" />
              <path d="M20 3v5h-5" />
            </svg>
          </ActionButton>
          <PluginAddMenu
            section="skills"
            disabled={!!install || action.pending}
            onSelect={(item) => {
              if (item === "mcp") return;
              setDetail(undefined);
              setInstall({ kind: item });
            }}
          />
        </div>
        <p>{t("skills.manage")}</p>
      </div>
      {!install && (
        <InstalledSkills
          projects={projects.projects.data ?? []}
          search={search}
          onUse={onUse}
          onUpdate={(entry, initial) => {
            setWorkspaceId(entry.workspaceId ?? "");
            setInstall({ kind: "github", initial, skill: entry.skill });
          }}
        />
      )}
      <div className="skill-filters plugin-list-controls">
        <SkillScopeTabs
          value={workspaceId}
          projects={projects.projects.data ?? []}
          disabled={!!install || action.pending}
          onChange={(id) => {
            setWorkspaceId(id);
            setDetail(undefined);
          }}
        />
      </div>
      <ErrorNotice
        error={projects.projects.error ?? api.query.error ?? api.query.data?.error ?? action.error}
      />
      {install ? (
        <SkillInstallForm
          key={install.initial?.id ?? install.kind}
          kind={install.kind}
          api={api}
          hasProject={!!workspaceId}
          projectName={project?.name}
          initialScope={scope}
          initial={install.initial}
          updateId={install.skill?.id}
          updateScope={install.skill?.scope}
          onClose={(installedScope) => {
            setInstall(undefined);
            if (installedScope === "personal") setWorkspaceId("");
          }}
        />
      ) : (
        <div className="plugin-list skill-list">
          {(api.query.isPending || api.query.data?.discovering) && (
            <p className="plugin-list-hint" role="status">
              {t("skills.discovering")}
            </p>
          )}
          {shown.map((skill) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              pending={action.pending}
              onToggle={() => void action.run(() => api.toggle(skill.id, !skill.enabled))}
              onOpen={() =>
                void action.run(async () =>
                  setDetail(skill.error ? { ...skill, content: "" } : await api.detail(skill.id)),
                )
              }
            />
          ))}
          {!shown.length &&
            !api.query.isPending &&
            !api.query.isError &&
            !api.query.data?.error &&
            !api.query.data?.discovering && (
              <p className="plugin-list-empty">
                {t(skills.length ? "skills.noMatch" : "skills.empty")}
              </p>
            )}
        </div>
      )}
      {detail && (
        <SkillDetails
          key={detail.id}
          skill={detail}
          api={api}
          onClose={() => setDetail(undefined)}
          onUpdate={(initial) => {
            setInstall({ kind: "github", initial, skill: detail });
            setDetail(undefined);
          }}
          onUse={
            active && (!workspaceId || active.workspaceId === workspaceId) && onUse
              ? () => {
                  useWorkspace
                    .getState()
                    .selectSkill(active.id, { id: detail.id, name: detail.name });
                  setDetail(undefined);
                  onUse();
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
