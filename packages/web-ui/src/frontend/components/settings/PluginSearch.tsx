import "./PluginSearch.css";

export const PluginSearch = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
}) => (
  <div className="plugin-search">
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m13 13 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
    <input
      type="search"
      aria-label={label}
      placeholder={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  </div>
);
