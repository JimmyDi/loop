import { useLanguage } from "../i18n/useLanguage";
import productPreviewStyles from "./ProductPreview.module.css";
import { ProductScreenshot } from "./ProductScreenshot";

export const ProductPreview = () => {
  const { language, t } = useLanguage();
  return (
    <figure className={productPreviewStyles["product-stage"]}>
      <div
        className={productPreviewStyles["app-preview"]}
        aria-label={t("previewLabel")}
        data-pointer-clear
      >
        <ProductScreenshot language={language} label={t("previewLabel")} />
      </div>
    </figure>
  );
};
