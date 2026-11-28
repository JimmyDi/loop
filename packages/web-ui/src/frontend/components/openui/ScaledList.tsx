import { Slider } from "@openuidev/react-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { scaledListProps } from "../../../shared/openui-scenarios";
import "./ScaledList.css";

const ScaledList = ({ title, baseServings, items }: z.infer<typeof scaledListProps>) => {
  const { t, i18n } = useTranslation();
  const [servings, setServings] = useState(baseServings);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });
  return (
    <section className="loop-openui-scaled" aria-label={title}>
      <h3>{title}</h3>
      <div
        className="loop-openui-slider"
        role="group"
        aria-label={t("openUi.servings", { count: servings })}
      >
        <p>{t("openUi.servings", { count: servings })}</p>
        <Slider
          variant="continuous"
          min={1}
          max={Math.max(20, baseServings)}
          value={[servings]}
          onValueChange={([next]) => {
            if (next !== undefined) setServings(next);
          }}
        />
      </div>
      <ul>
        {items.map(({ name, amount, unit }, index) => (
          <li key={index}>
            {name}{" "}
            <strong>
              {number.format((amount * servings) / baseServings)} {unit}
            </strong>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ScaledList;
