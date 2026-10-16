import { useState } from "react";

import { useLanguage } from "../i18n/useLanguage";
import { interfaceOptions } from "./interface-options";
import type { InterfaceOption } from "./interface-options";
import { InterfacePanel } from "./InterfacePanel";
import styles from "./InterfaceWorkbench.module.css";

export const InterfaceWorkbench = () => {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<InterfaceOption["id"]>("web");
  return (
    <div className={styles["interface-workbench"]}>
      <div className={styles["interface-tabs"]} role="group" aria-label={t("previewSwitcher")}>
        {interfaceOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles["interface-tab"]}
            aria-controls={"panel-" + option.id}
            aria-pressed={selected === option.id}
            onClick={() => setSelected(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
      {interfaceOptions.map((option) => (
        <InterfacePanel key={option.id} option={option} hidden={selected !== option.id} />
      ))}
    </div>
  );
};
