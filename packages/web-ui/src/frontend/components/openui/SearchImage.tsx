import { Button } from "@openuidev/react-ui";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { searchImageProps } from "../../../shared/openui-scenarios";
import { findCommonsImages } from "./commons-images";
import "./SearchImage.css";

type Images = Awaited<ReturnType<typeof findCommonsImages>>;

const SearchImage = ({ title, query }: z.infer<typeof searchImageProps>) => {
  const { t } = useTranslation();
  const request = useRef<AbortController>(undefined);
  const [result, setResult] = useState<{ query: string; images?: Images; failed?: boolean }>();
  useEffect(() => () => request.current?.abort(), [query]);

  const current = result?.query === query ? result : undefined;
  const pending = current && !current.images && !current.failed;
  const search = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResult({ query });
    try {
      const images = await findCommonsImages(query, controller.signal);
      if (!controller.signal.aborted) setResult({ query, images });
    } catch {
      if (!controller.signal.aborted) setResult({ query, failed: true });
    }
  };
  return (
    <section className="loop-openui-image-search" aria-label={title}>
      <h3>{title}</h3>
      <p>{query}</p>
      <div className="loop-openui-controls">
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={pending}
          onClick={() => void search()}
        >
          {t(pending ? "openUi.searchingImages" : "openUi.searchImages")}
        </Button>
      </div>
      {current?.failed && <p role="status">{t("openUi.imageSearchFailed")}</p>}
      {current?.images?.length === 0 && <p role="status">{t("openUi.noImages")}</p>}
      {!!current?.images?.length && (
        <ul>
          {current.images.map((image) => (
            <li key={image.source}>
              <a href={image.source} target="_blank" rel="noreferrer">
                <img src={image.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
                <span>{image.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default SearchImage;
