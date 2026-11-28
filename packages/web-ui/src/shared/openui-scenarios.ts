import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

import { type ScenarioTopic, scenarioTopicsSchema } from "./openui-topics";

const label = z.string().min(1).max(160).regex(/\S/);
const detail = z.string().max(2500);
const longitude = z.number().min(-180).max(180);
const latitude = z.number().min(-85).max(85);
const coordinate = z.tuple([longitude, latitude]);

export const mapViewProps = z.object({
  title: label,
  stops: z
    .array(z.object({ name: label, longitude, latitude, detail: detail.optional() }))
    .min(1)
    .max(30),
  route: z.array(coordinate).min(2).max(2000).optional(),
});

export const stepGuideProps = z.object({
  title: label,
  variants: z
    .array(
      z.object({
        name: label,
        steps: z
          .array(
            z.object({
              title: label,
              description: detail,
              diagram: z
                .array(
                  z
                    .string()
                    .max(1000)
                    .regex(/^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]+$/),
                )
                .max(30)
                .optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .min(1)
    .max(8),
});

export const countdownProps = z.object({
  title: label,
  seconds: z.number().int().min(1).max(86400),
});

export const scaledListProps = z.object({
  title: label,
  baseServings: z.number().int().min(1).max(100),
  items: z
    .array(
      z.object({ name: label, amount: z.number().min(0).max(100000), unit: z.string().max(40) }),
    )
    .min(1)
    .max(50),
});

export const colorSwatchProps = z.object({
  name: label,
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  description: detail.optional(),
});

export const searchImageProps = z.object({ title: label, query: z.string().min(1).max(120) });

export const salesScenarioProps = z.object({
  title: label,
  currency: z.string().regex(/^[A-Z]{3}$/),
  rows: z
    .array(z.object({ period: label, revenue: z.number().min(0).max(1e12) }))
    .min(1)
    .max(24),
});

export const drumLabProps = z.object({
  title: label,
  tempo: z.number().int().min(40).max(220).optional(),
});

const scenarioComponent = <Schema extends z.ZodObject>(
  name: string,
  props: Schema,
  description: string,
  topics: ScenarioTopic[],
) => ({
  definition: defineComponent({ name, props, description, component: () => null }),
  topics: scenarioTopicsSchema.parse(topics),
});

export const scenarioComponents = {
  RouteMap: scenarioComponent(
    "RouteMap",
    mapViewProps,
    "Interactive map. Supply named stops with longitude and latitude. Optionally supply route geometry as [longitude, latitude] pairs from a route source.",
    ["maps"],
  ),
  StepGuide: scenarioComponent(
    "StepGuide",
    stepGuideProps,
    "Local previous/next walkthrough with selectable variants. Optional diagram paths use a 320 by 180 view box.",
    ["guides"],
  ),
  Countdown: scenarioComponent(
    "Countdown",
    countdownProps,
    "User-started local countdown in seconds with pause and reset.",
    ["cooking"],
  ),
  ScaledList: scenarioComponent(
    "ScaledList",
    scaledListProps,
    "Shopping list that rescales locally. Amounts are for the base serving count.",
    ["cooking"],
  ),
  ColorSwatch: scenarioComponent(
    "ColorSwatch",
    colorSwatchProps,
    "A visible color sample with its name, exact #RRGGBB value, and optional usage. Place directly in a Stack.",
    ["images"],
  ),
  SearchImage: scenarioComponent(
    "SearchImage",
    searchImageProps,
    "Search Wikimedia Commons on click to show freely licensed image previews with source links.",
    ["images"],
  ),
  SalesScenario: scenarioComponent(
    "SalesScenario",
    salesScenarioProps,
    "Compare supplied period revenue against a local what-if percentage adjustment. Pass the ISO 4217 currency code.",
    ["sales"],
  ),
  DrumLab: scenarioComponent(
    "DrumLab",
    drumLabProps,
    "Playable 16-step drum sequencer with tempo, swing, and drum pads. Audio starts from a user gesture.",
    ["music"],
  ),
};
