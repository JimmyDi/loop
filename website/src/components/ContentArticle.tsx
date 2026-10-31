import { asset } from "../assets";
import { normalizeRoute } from "../content-routes";
import styles from "./ContentArticle.module.css";

export const ContentArticle = ({
  html,
  route = typeof location === "undefined" ? "" : normalizeRoute(location.pathname),
}: {
  html: string;
  route?: string;
}) => {
  const articleHtml =
    html ||
    (typeof document === "undefined"
      ? ""
      : (document.querySelector("#root [data-content-article]")?.innerHTML ?? ""));
  const markup = articleHtml
    .replace(/href="#([^" ]*)"/g, (_, hash: string) => 'href="' + asset(route + "#" + hash) + '"')
    .replace(/href="(docs\/[^" ]*)"/g, (_, path: string) => 'href="' + asset(path) + '"');
  return (
    <div className={styles.article}>
      <div data-content-article dangerouslySetInnerHTML={{ __html: markup }} />
    </div>
  );
};
