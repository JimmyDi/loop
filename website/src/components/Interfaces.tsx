import { useLanguage } from "../i18n/useLanguage";
import { InterfaceWorkbench } from "./InterfaceWorkbench";
import styles from "./Interfaces.module.css";
import layout from "./Layout.module.css";
import { SectionHeading } from "./SectionHeading";

export const Interfaces = () => {
  const { t } = useLanguage();
  return (
    <section
      id="interfaces"
      className={[styles.interfaces, layout.shell].join(" ")}
      aria-labelledby="interfaces-title"
    >
      <SectionHeading
        id="interfaces-title"
        first={t("interfacesFirst")}
        last={t("interfacesLast")}
        description={[t("interfacesDescription"), t("interfacesChoice")]}
      />
      <InterfaceWorkbench />
    </section>
  );
};
