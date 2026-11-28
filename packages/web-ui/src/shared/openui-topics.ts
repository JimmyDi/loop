import { z } from "zod";

export const scenarioTopicSchema = z.enum([
  "maps",
  "guides",
  "cooking",
  "images",
  "sales",
  "music",
]);

export type ScenarioTopic = z.infer<typeof scenarioTopicSchema>;

export const scenarioTopicsSchema = z.array(scenarioTopicSchema).min(1);
