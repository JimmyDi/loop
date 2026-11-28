import type { AgentTool } from "@loop/coding-agent";
import { z } from "zod";

import { scenarioTopicSchema } from "../shared/openui-topics";
import { scenarioTopicGuidance } from "./openui-scenario-topics";

const topicGroups = {
  tables: ["Tables"],
  charts: ["Charts (2D)", "Charts (1D)", "Charts (Scatter)"],
  forms: ["Forms", "Buttons"],
  layout: ["Layout", "Content"],
  cards: ["Cards", "Data Display", "Content", "Other"],
};

type BaseTopic = keyof typeof topicGroups;

const baseTopicSchema = z.enum(Object.keys(topicGroups) as BaseTopic[]);
const argsSchema = z.strictObject({
  topic: z.enum([...baseTopicSchema.options, ...scenarioTopicSchema.options]),
});

type Topic = z.infer<typeof argsSchema>["topic"];

const { $schema: _dialect, ...parameters } = z.toJSONSchema(argsSchema, { target: "draft-7" });

const examples: Record<BaseTopic, string> = {
  tables: 'root = Stack([Table([Col("Test", ["Parser"]), Col("Status", ["Passed"])])])',
  charts: 'root = Stack([BarChart(["Mon", "Tue"], [Series("Visits", [12, 19])])])',
  forms:
    'root = Stack([Form("prefs", Buttons([Button("Save", @ToAssistant("Save preferences"))]), [name])])\nname = FormControl("Name", Input("name", "Enter name"))',
  layout: 'root = Stack([Card([CardHeader("Summary"), TextContent("12 passed")])])',
  cards:
    'root = Stack([Card([CardHeader("Summary")]), FollowUpBlock([FollowUpItem("Show failures")])])',
};

const commonRules = [
  "Emit a top-level fenced code block labeled openui. Markdown may appear before or after it.",
  'Inside the fence, start with root = Stack([...]). Write one name = expression per statement. Use ASCII names such as periods for bindings and references, and put localized labels in quoted strings. Separate array items, object fields, and component arguments with commas, including across line breaks. Components take positional arguments only. Never write named arguments such as gap="m". To set the Stack gap while leaving direction at its default, write Stack([child], null, "m"). Use only arguments listed in the component signature. Use null to skip an optional argument before a later one. References may point to later statements and must resolve from root.',
  "For charts, tables, or forms with local filters, declare bindings with $name = defaultValue. Bind controls to them and derive visible data with @Filter(rows, field, operator, value), @Sort(rows, field, direction), and array pluck rows.field. @Set($name, value) and @Reset($name) update local state.",
  "Use only supplied data or data obtained through normal agent tools. Keep the interface self-contained. Use Query only as described by its topic. Do not emit Mutation or @Run.",
  'Use @ToAssistant("message") for buttons and form submissions. Form values become part of the chat message. Never request passwords or secrets. Use absolute HTTP(S) links for @OpenUrl. Open modals only after a click.',
].join("\n");

let librarySpec:
  | ReturnType<typeof import("../shared/openui-library").openUiLibrary.toSpec>
  | undefined;
const docsByTopic = new Map<Topic, string>();

export const openUiDocsTool = {
  name: "load_openui_docs",
  description:
    "Choose how to present the reply from the user's intent, even if they do not name a UI component. " +
    "For a trend or outlier across several numeric observations, call this tool with charts before answering. " +
    "For alternatives compared across multiple criteria, use tables. When the user wants to pick preferences for a later recommendation, use forms. " +
    "For optional next steps the user can choose after reading the reply, use cards. Use request_user_input for a blocking clarification. " +
    Object.entries(scenarioTopicGuidance)
      .map(([topic, { useFor }]) => "For " + useFor + ", use " + topic + ". ")
      .join("") +
    "For simple facts, calculations, and prose, answer directly in Markdown. " +
    "For each needed topic, this tool returns component signatures and an example to use in the reply.",
  parameters,
  execute: async (args, signal) => {
    signal.throwIfAborted();
    const { topic: key } = argsSchema.parse(args);
    const cached = docsByTopic.get(key);
    if (cached !== undefined) return [{ type: "text", text: cached }];
    const { openUiLibrary, openUiTopicComponents } = await import("../shared/openui-library");
    signal.throwIfAborted();
    const spec = (librarySpec ??= openUiLibrary.toSpec());
    const groups = spec.componentGroups ?? [];
    const grouped = new Set(groups.flatMap((group) => group.components));
    const base = baseTopicSchema.safeParse(key);
    const custom = scenarioTopicSchema.safeParse(key);
    const scenario = custom.success ? scenarioTopicGuidance[custom.data] : undefined;
    const groupNames = base.success ? topicGroups[base.data] : [];
    const selected = groups
      .filter((group) => groupNames.includes(group.name))
      .flatMap((group) => group.components);
    const names = new Set([
      "Stack",
      ...selected,
      ...(custom.success ? (openUiTopicComponents.get(custom.data) ?? []) : []),
    ]);
    if (key === "cards") {
      const tagged = new Set([...openUiTopicComponents.values()].flat());
      for (const name of Object.keys(spec.components)) {
        if (!grouped.has(name) && !tagged.has(name)) names.add(name);
      }
    }
    const signatures = [...names].map((name) => {
      const { signature, description } = spec.components[name]!;
      return signature + (description ? " — " + description : "");
    });
    const notes = [];
    if (names.has("Card")) {
      notes.push(
        'Card takes children, variant, direction, then gap. For a recessed card with a small gap and default direction, use Card([TextContent("Example")], "sunk", null, "xs").',
      );
    }
    if (key === "cards") {
      notes.push(
        'Quote metric display values, for example MetricIndicatorInline("185", "units"). Keep trend.value numeric.',
      );
    }
    const example = base.success ? examples[base.data] : scenario?.example;
    const text = [
      commonRules,
      ...signatures,
      ...notes,
      ...(scenario ? [scenario.notes] : []),
      "Example:\n" + example,
    ].join("\n\n");
    docsByTopic.set(key, text);
    return [{ type: "text", text }];
  },
} satisfies AgentTool;
