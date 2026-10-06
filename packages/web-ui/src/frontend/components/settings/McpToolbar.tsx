import { useTranslation } from "react-i18next";

import "./McpToolbar.css";

export const McpToolbar = ({
  count,
  search,
  onSearch,
}: {
  count: number;
  search: string;
  onSearch(search: string): void;
}) => {
  const { t } = useTranslation();
  return (
    <div className="mcp-toolbar">
      <div className="mcp-toolbar-label">
        <span>MCPs</span>
        <span className="mcp-toolbar-count">{count}</span>
      </div>
      <div className="mcp-toolbar-search">
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
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
          aria-label={t("mcp.search")}
          placeholder={t("mcp.search")}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
        />
      </div>
    </div>
  );
};
