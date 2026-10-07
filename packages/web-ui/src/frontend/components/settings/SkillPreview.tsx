import { useTranslation } from "react-i18next";

import type { SkillJob } from "../../../shared/skills";
import "./SkillPreview.css";

export const SkillPreview = ({
  job,
  selected,
  onSelect,
}: {
  job: SkillJob;
  selected: string[];
  onSelect(keys: string[]): void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="skill-preview">
      {job.source?.revision && (
        <small>
          {t("skills.version")}: {job.source.ref} · {job.source.revision.slice(0, 12)}
        </small>
      )}
      {job.candidates?.map((skill) => (
        <div key={skill.key}>
          <label>
            <input
              type="checkbox"
              checked={selected.includes(skill.key)}
              onChange={(event) =>
                onSelect(
                  event.target.checked
                    ? [...selected, skill.key]
                    : selected.filter((key) => key !== skill.key),
                )
              }
            />
            {skill.name}
          </label>
          <p>{skill.description}</p>
          <details>
            <summary>{t("skills.instructions")}</summary>
            <pre>{skill.content}</pre>
          </details>
          <details>
            <summary>
              {t("skills.resources")} ({skill.files.length})
            </summary>
            <pre>{skill.files.join("\n")}</pre>
          </details>
        </div>
      ))}
    </div>
  );
};
