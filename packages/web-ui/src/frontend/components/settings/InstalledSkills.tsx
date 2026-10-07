import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";

import type { Project } from "../../../shared/protocol";
import type { SkillJob, SkillSummary } from "../../../shared/skills";
import { useInstalledSkills } from "../../hooks/useInstalledSkills";
import type { InstalledSkill } from "../../hooks/useInstalledSkills";
import { useSkills } from "../../hooks/useSkills";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { useWorkspace } from "../../state/workspace-store";
import { api, command } from "../../lib/api";
import { skillQueryPath } from "../../hooks/useSkills";
import { ErrorNotice } from "../ui/ErrorNotice";
import { SkillRow } from "./SkillRow";
import { SkillDetails } from "./SkillDetails";
import "./InstalledSkills.css";

export const InstalledSkills = ({
  projects,
  search,
  onUpdate,
  onUse,
}: {
  projects: Project[];
  search: string;
  onUpdate(entry: InstalledSkill, job: SkillJob): void;
  onUse?(): void;
}) => {
  const { t } = useTranslation();
  const id = useId();
  const catalog = useInstalledSkills(projects);
  const action = useAsyncAction();
  const client = useQueryClient();
  const active = useWorkspace((state) => state.active);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<{
    entry: InstalledSkill;
    body: SkillSummary & { content: string; files?: string[] };
  }>();
  const detailApi = useSkills(detail?.entry.workspaceId, false);
  const matching = catalog.entries.filter(({ skill }) =>
    (skill.name + " " + skill.description).toLowerCase().includes(search.toLowerCase()),
  );
  const shown = expanded ? matching : matching.slice(0, 6);
  return (
    <section className="installed-skills" aria-labelledby={id + "-heading"}>
      <h4 id={id + "-heading"}>{t("skills.installed")}</h4>
      <ErrorNotice error={catalog.error ?? action.error} />
      <div className="plugin-list skill-list" id={id + "-list"}>
        {shown.map((entry) => (
          <SkillRow
            key={entry.skill.id}
            skill={entry.skill}
            pending={action.pending}
            onOpen={() =>
              void action.run(async () => {
                const body = entry.skill.error
                  ? { ...entry.skill, content: "" }
                  : await api<SkillSummary & { content: string; files?: string[] }>(
                      "/settings/skills/" + entry.skill.id + skillQueryPath(entry.workspaceId),
                    );
                setDetail({ entry, body });
              })
            }
            onToggle={() =>
              void action.run(async () => {
                await command(
                  "/settings/skills/" +
                    entry.skill.id +
                    "/enabled" +
                    skillQueryPath(entry.workspaceId),
                  { enabled: !entry.skill.enabled },
                  "PATCH",
                );
                await client.invalidateQueries({ queryKey: ["skills"] });
              })
            }
          />
        ))}
        {catalog.loading && (
          <p className="plugin-list-hint" role="status">
            {t("skills.discovering")}
          </p>
        )}
        {!matching.length && !catalog.loading && !catalog.error && (
          <p className="plugin-list-hint">
            {t(search ? "skills.noMatch" : "skills.picker.emptyTitle")}
          </p>
        )}
      </div>
      {matching.length > 6 && (
        <button
          type="button"
          className="installed-skills-more"
          aria-expanded={expanded}
          aria-controls={id + "-list"}
          onClick={() => setExpanded((value) => !value)}
        >
          {t(expanded ? "skills.showLess" : "skills.showMore")}
        </button>
      )}
      {detail && (
        <SkillDetails
          key={detail.body.id}
          skill={detail.body}
          api={detailApi}
          onClose={() => setDetail(undefined)}
          onUpdate={(job) => {
            onUpdate(detail.entry, job);
            setDetail(undefined);
          }}
          onUse={
            active &&
            (!detail.entry.workspaceId || active.workspaceId === detail.entry.workspaceId) &&
            onUse
              ? () => {
                  useWorkspace
                    .getState()
                    .selectSkill(active.id, { id: detail.body.id, name: detail.body.name });
                  setDetail(undefined);
                  onUse();
                }
              : undefined
          }
        />
      )}
    </section>
  );
};
