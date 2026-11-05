import { useRef, useState } from "react";

import { blogPath } from "../blog/blog-location";
import { asset } from "../assets";
import type { BlogBodies, BlogPost } from "../blog/types";
import { useLanguage } from "../i18n/useLanguage";
import content from "./ContentArticle.module.css";
import styles from "./BlogBody.module.css";

export const BlogBody = ({ post, bodies }: { post: BlogPost; bodies: BlogBodies }) => {
  const { language } = useLanguage();
  const [initial] = useState<BlogBodies>(() => {
    if (typeof document === "undefined") return {};
    return Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>("#root [data-blog-body]"))
        .filter((node) => node.dataset.blogSlug === post.slug)
        .map((node) => [node.dataset.blogBody, node.innerHTML]),
    );
  });
  const opener = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [image, setImage] = useState({ src: "", alt: "" });
  const [feedback, setFeedback] = useState("");
  return (
    <article
      className={[styles.body, content.article].join(" ")}
      onClick={async (event) => {
        const target = event.target as HTMLElement;
        const imageButton = target.closest("button[data-enlarge-image]");
        const selectedImage = imageButton?.querySelector("img");
        if (selectedImage) {
          opener.current = imageButton as HTMLElement;
          setImage({ src: selectedImage.currentSrc || selectedImage.src, alt: selectedImage.alt });
          dialog.current?.showModal();
        }
        const button = target.closest<HTMLButtonElement>("button[data-copy-code]");
        if (!button) return;
        try {
          await navigator.clipboard.writeText(
            button.parentElement?.querySelector("code")?.textContent ?? "",
          );
          setFeedback(language === "zh" ? "代码已复制" : "Code copied");
        } catch {
          setFeedback(
            language === "zh"
              ? "复制失败，请手动选择代码。"
              : "Copy failed. Select the code manually.",
          );
        }
      }}
    >
      {(["zh", "en"] as const).map((locale) => {
        const html = bodies[locale] || post[locale].html || initial[locale] || "";
        const markup = html
          .replace(
            /id="([^" ]*)"/g,
            (_, id: string) =>
              'id="' + (id.startsWith(locale + "-") ? id : locale + "-" + id) + '"',
          )
          .replace(
            /(href|src|srcset)="((?:blog|docs|changelog)\/[^" ]*)"/g,
            (_, attr: string, path: string) =>
              attr +
              '="' +
              asset(attr === "href" && path.startsWith("blog/") ? blogPath(path, locale) : path) +
              '"',
          )
          .replace(
            /href="#([^" ]*)"/g,
            (_, hash: string) =>
              'href="' +
              asset(blogPath("blog/" + post.slug + "/", locale) + "#" + locale + "-" + hash) +
              '"',
          );
        return (
          <div
            key={locale}
            hidden={locale !== language}
            lang={locale === "zh" ? "zh-CN" : "en"}
            data-blog-body={locale}
            data-blog-slug={post.slug}
            dangerouslySetInnerHTML={{ __html: markup }}
          />
        );
      })}
      <span role="status">{feedback}</span>
      <dialog ref={dialog} className={styles.dialog} onClose={() => opener.current?.focus()}>
        <button type="button" onClick={() => dialog.current?.close()}>
          {language === "zh" ? "关闭图片" : "Close image"}
        </button>
        <img src={image.src || undefined} alt={image.alt} referrerPolicy="no-referrer" />
      </dialog>
    </article>
  );
};
