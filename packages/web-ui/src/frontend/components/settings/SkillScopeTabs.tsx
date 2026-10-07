import { useTranslation } from "react-i18next";

import type { Project } from "../../../shared/protocol";
import { useSkillScopeLayout } from "../../hooks/useSkillScopeLayout";
import { SkillProjectMenu } from "./SkillProjectMenu";
import "./SkillScopeTabs.css";

export const SkillScopeTabs = ({
  value,
  projects,
  disabled,
  onChange,
}: {
  value: string;
  projects: Pick<Project, "id" | "name">[];
  disabled: boolean;
  onChange(value: string): void;
}) => {
  const { t } = useTranslation();
  const scopes = [{ id: "", name: t("skills.personal") }, ...projects];
  const { root, measurements, visible } = useSkillScopeLayout(
    scopes.map((scope) => scope.name),
    scopes.findIndex((scope) => scope.id === value),
  );
  const displayed = visible.map((index) => scopes[index]!);
  const hidden = projects.filter((project) => !displayed.some((scope) => scope.id === project.id));
  return (
    <div className="skill-scope-control" ref={root}>
      <div className="skill-scope-measurements" ref={measurements} aria-hidden="true">
        {scopes.map((scope) => (
          <span className="skill-scope-tab" key={scope.id}>
            {scope.name}
          </span>
        ))}
        <span className="skill-scope-more">…</span>
      </div>
      <div
        className="skill-scope-tabs"
        role="tablist"
        aria-label={t("skills.scopes")}
        onKeyDown={(event) => {
          if (disabled || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const index = displayed.findIndex((scope) => scope.id === value);
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? displayed.length - 1
                : (index + (event.key === "ArrowRight" ? 1 : -1) + displayed.length) %
                  displayed.length;
          onChange(displayed[next]!.id);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>("button")
            [next]?.focus({ preventScroll: true });
        }}
      >
        {displayed.map((scope) => (
          <button
            className="skill-scope-tab"
            key={scope.id}
            type="button"
            role="tab"
            title={scope.name}
            aria-selected={scope.id === value}
            tabIndex={
              scope.id === value ||
              (!displayed.some((item) => item.id === value) && scope.id === "")
                ? 0
                : -1
            }
            disabled={disabled}
            onClick={() => onChange(scope.id)}
          >
            {scope.name}
          </button>
        ))}
      </div>
      {!!hidden.length && (
        <SkillProjectMenu
          projects={hidden}
          selected={value}
          disabled={disabled}
          onSelect={onChange}
        />
      )}
    </div>
  );
};
