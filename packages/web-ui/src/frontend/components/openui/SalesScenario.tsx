import {
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openuidev/react-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { salesScenarioProps } from "../../../shared/openui-scenarios";
import "./SalesScenario.css";

const SalesScenario = ({ title, currency, rows }: z.infer<typeof salesScenarioProps>) => {
  const { t, i18n } = useTranslation();
  const [change, setChange] = useState(0);
  const multiplier = 1 + change / 100;
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const max = Math.max(1, ...rows.map(({ revenue }) => revenue * Math.max(1, multiplier)));
  const money = new Intl.NumberFormat(i18n.language, { style: "currency", currency });
  return (
    <section className="loop-openui-sales" aria-label={title}>
      <h3>{title}</h3>
      <div
        className="loop-openui-slider"
        role="group"
        aria-label={t("openUi.adjustSales", { change })}
      >
        <p>{t("openUi.adjustSales", { change })}</p>
        <Slider
          variant="continuous"
          min={-100}
          max={100}
          value={[change]}
          onValueChange={([next]) => {
            if (next !== undefined) setChange(next);
          }}
        />
      </div>
      <p aria-live="polite">
        {t("openUi.projectedTotal", { total: money.format(total * multiplier) })}
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{t("openUi.period")}</TableHead>
            <TableHead scope="col">{t("openUi.actual")}</TableHead>
            <TableHead scope="col">{t("openUi.projected")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ period, revenue }, index) => (
            <TableRow key={index}>
              <TableHead scope="row">{period}</TableHead>
              <TableCell>
                <meter aria-label={t("openUi.actual")} min={0} max={max} value={revenue} />
                {money.format(revenue)}
              </TableCell>
              <TableCell>
                <meter
                  aria-label={t("openUi.projected")}
                  min={0}
                  max={max}
                  value={revenue * multiplier}
                />
                {money.format(revenue * multiplier)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
};

export default SalesScenario;
