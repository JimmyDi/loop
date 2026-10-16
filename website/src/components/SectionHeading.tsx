import layout from "./Layout.module.css";
import styles from "./SectionHeading.module.css";

export const SectionHeading = ({
  id,
  first,
  last,
  description,
}: {
  id: string;
  first: string;
  last: string;
  description: readonly string[];
}) => (
  <div className={styles.heading}>
    <h2 id={id} className={layout["responsive-title"]}>
      <span>{first}</span>
      <span>{last}</span>
    </h2>
    <p className={layout["responsive-copy"]}>{description.join("\n")}</p>
  </div>
);
