import "./ComposerSkillTokens.css";

export const ComposerSkillTokens = ({
  skills,
  disabled,
}: {
  skills: { id: string; name: string }[];
  disabled: boolean;
}) => {
  return skills.map((skill) => (
    <span key={skill.id} className="composer-skill-token" data-disabled={disabled}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z m-8 4.5 8 4.5 8-4.5M12 12v9m-8-9 8 4.5 8-4.5" />
      </svg>
      <span>{skill.name}</span>
    </span>
  ));
};
