import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { DirectoryListing } from "../../../shared/protocol";
import { api } from "../../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./DirectoryBrowser.css";

export const DirectoryBrowser = ({ onSelect }: { onSelect(path: string): void }) => {
  const { t } = useTranslation();
  const [path, setPath] = useState("");
  const [input, setInput] = useState("");
  const query = useQuery({
    queryKey: ["directories", path],
    queryFn: () =>
      api<DirectoryListing>("/directories" + (path ? "?path=" + encodeURIComponent(path) : "")),
  });
  const navigate = (value: string) => {
    setPath(value);
    setInput(value);
  };

  return (
    <div className="directory-browser">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          navigate(input);
        }}
      >
        <input
          aria-label={t("directory")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={query.data?.path}
        />
        <ActionButton type="submit">{t("browsePath")}</ActionButton>
      </form>
      <ErrorNotice error={query.error} />
      {query.isPending && <p>{t("loading")}</p>}
      {query.data && (
        <>
          <p className="directory-current">{query.data.path}</p>
          <div className="directory-navigation">
            <ActionButton onClick={() => navigate(query.data!.parent)}>{t("parent")}</ActionButton>
            <ActionButton onClick={() => navigate(query.data!.home)}>{t("home")}</ActionButton>
          </div>
          <ul>
            {query.data.entries.map((entry) => (
              <li key={entry.path}>
                <ActionButton className="ghost" onClick={() => navigate(entry.path)}>
                  ▸ {entry.name}
                </ActionButton>
              </li>
            ))}
          </ul>
          {!query.data.entries.length && <p>{t("noMatchingFolders")}</p>}
          {query.data.truncated && <p>{t("truncated")}</p>}
          <ActionButton className="primary" onClick={() => onSelect(query.data!.path)}>
            {t("selectFolder")}
          </ActionButton>
        </>
      )}
    </div>
  );
};
