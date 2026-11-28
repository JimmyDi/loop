import { Button } from "@openuidev/react-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { stepGuideProps } from "../../../shared/openui-scenarios";
import "./StepGuide.css";

const StepGuide = ({ title, variants }: z.infer<typeof stepGuideProps>) => {
  const { t } = useTranslation();
  const [variantIndex, setVariantIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const variant = variants[variantIndex] ?? variants[0];
  const step = variant?.steps[stepIndex] ?? variant?.steps[0];
  if (!variant || !step) return null;

  const position = variant.steps.indexOf(step);
  return (
    <section className="loop-openui-guide" aria-label={title}>
      <h3>{title}</h3>
      {variants.length > 1 && (
        <div className="loop-openui-controls">
          {variants.map(({ name }, index) => (
            <Button
              type="button"
              size="small"
              variant={variant === variants[index] ? "primary" : "secondary"}
              key={index}
              aria-pressed={variant === variants[index]}
              onClick={() => {
                setVariantIndex(index);
                setStepIndex(0);
              }}
            >
              {name}
            </Button>
          ))}
        </div>
      )}
      <div aria-live="polite">
        <p>{t("openUi.step", { current: position + 1, total: variant.steps.length })}</p>
        {step.diagram?.length ? (
          <svg viewBox="0 0 320 180" role="img" aria-label={step.title}>
            {step.diagram.map((path, index) => (
              <path key={index} d={path} fill="none" stroke="currentColor" strokeWidth="2" />
            ))}
          </svg>
        ) : null}
        <h4>{step.title}</h4>
        <p>{step.description}</p>
      </div>
      <div className="loop-openui-controls">
        <Button
          type="button"
          size="small"
          variant="secondary"
          disabled={position === 0}
          onClick={() => setStepIndex(position - 1)}
        >
          {t("openUi.previous")}
        </Button>
        <Button
          type="button"
          size="small"
          variant="primary"
          disabled={position === variant.steps.length - 1}
          onClick={() => setStepIndex(position + 1)}
        >
          {t("openUi.next")}
        </Button>
      </div>
    </section>
  );
};

export default StepGuide;
