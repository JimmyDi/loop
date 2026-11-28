import { defineComponent } from "@openuidev/react-lang";
import { type ComponentType, createElement, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import { openUiLibrary as schemaLibrary } from "../../shared/openui-library";
import { scenarioComponents } from "../../shared/openui-scenarios";

const ScenarioLoading = () => {
  const { t } = useTranslation();
  return createElement("p", { role: "status" }, t("openUi.loadingCard"));
};

const withView = <Schema extends z.ZodObject>(
  definition: { name: string; props: Schema; description: string },
  view: ComponentType<z.infer<Schema>>,
) =>
  defineComponent({
    ...definition,
    component: ({ props }) => {
      const parsed = definition.props.safeParse(props);
      return parsed.success
        ? createElement(
            Suspense,
            { fallback: createElement(ScenarioLoading) },
            createElement(view, parsed.data),
          )
        : null;
    },
  });

export const openUiLibrary = schemaLibrary.extend!({
  components: {
    override: [
      withView(
        scenarioComponents.RouteMap.definition,
        lazy(() => import("../components/openui/MapView")),
      ),
      withView(
        scenarioComponents.StepGuide.definition,
        lazy(() => import("../components/openui/StepGuide")),
      ),
      withView(
        scenarioComponents.Countdown.definition,
        lazy(() => import("../components/openui/Countdown")),
      ),
      withView(
        scenarioComponents.ScaledList.definition,
        lazy(() => import("../components/openui/ScaledList")),
      ),
      withView(
        scenarioComponents.ColorSwatch.definition,
        lazy(() => import("../components/openui/ColorSwatch")),
      ),
      withView(
        scenarioComponents.SearchImage.definition,
        lazy(() => import("../components/openui/SearchImage")),
      ),
      withView(
        scenarioComponents.SalesScenario.definition,
        lazy(() => import("../components/openui/SalesScenario")),
      ),
      withView(
        scenarioComponents.DrumLab.definition,
        lazy(() => import("../components/openui/DrumLab")),
      ),
    ],
  },
});
