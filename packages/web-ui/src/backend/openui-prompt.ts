import type { AgentTool } from "@loop/coding-agent";

const topicGroups = {
  tables: ["Tables"],
  charts: ["Charts (2D)", "Charts (1D)", "Charts (Scatter)"],
  forms: ["Forms", "Buttons"],
  layout: ["Layout", "Content"],
  cards: ["Cards", "Data Display", "Content", "Other"],
};

type Topic = keyof typeof topicGroups;

const examples: Record<Topic, string> = {
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
  "Inside the fence, start with root = Stack([...]). Write one name = expression per line. Components take positional arguments. Use only arguments listed in the component signature. Use null to skip an optional argument before a later one. References may point to later statements and must resolve from root.",
  "For charts, tables, or forms with local filters, declare bindings with $name = defaultValue. Bind controls to them and derive visible data with @Filter(rows, field, operator, value), @Sort(rows, field, direction), and array pluck rows.field. @Set($name, value) and @Reset($name) update local state.",
  "Use only supplied data or data obtained through normal agent tools. Keep the interface self-contained. Do not emit Query, Mutation, or @Run.",
  'Use @ToAssistant("message") for buttons and form submissions. Form values become part of the chat message. Never request passwords or secrets. Use absolute HTTP(S) links for @OpenUrl. Open modals only after a click.',
].join("\n");

let librarySpec:
  | ReturnType<typeof import("../shared/openui-library").openUiLibrary.toSpec>
  | undefined;
const docsByTopic = new Map<Topic, string>();

export const openUiDocsTool: AgentTool = {
  name: "load_openui_docs",
  description:
    "Choose how to present the reply from the user's intent, even if they do not name a UI component. " +
    "For a trend or outlier across several numeric observations, call this tool with charts before answering. " +
    "For alternatives compared across multiple criteria, use tables. When the user wants to pick preferences for a later recommendation, use forms. " +
    "For optional next steps the user can choose after reading the reply, use cards. Use request_user_input for a blocking clarification. " +
    "For simple facts, calculations, and prose, answer directly in Markdown. " +
    "For each needed topic, this tool returns component signatures and an example to use in the reply.",
  parameters: {
    type: "object",
    properties: { topic: { type: "string", enum: Object.keys(topicGroups) } },
    required: ["topic"],
    additionalProperties: false,
  },
  execute: async ({ topic }, signal) => {
    signal.throwIfAborted();
    if (typeof topic !== "string" || !Object.hasOwn(topicGroups, topic)) {
      throw new Error("Unknown OpenUI documentation topic");
    }
    const key = topic as Topic;
    const cached = docsByTopic.get(key);
    if (cached !== undefined) return [{ type: "text", text: cached }];
    const { openUiLibrary } = await import("../shared/openui-library");
    signal.throwIfAborted();
    const spec = (librarySpec ??= openUiLibrary.toSpec());
    const groups = spec.componentGroups ?? [];
    const grouped = new Set(groups.flatMap((group) => group.components));
    const selected = groups.filter((group) => topicGroups[key].includes(group.name));
    const names = new Set(["Stack", ...selected.flatMap((group) => group.components)]);
    if (key === "cards") {
      for (const name of Object.keys(spec.components)) if (!grouped.has(name)) names.add(name);
    }
    const signatures = [...names].map((name) => {
      const { signature, description } = spec.components[name]!;
      return signature + (description ? " — " + description : "");
    });
    const notes =
      key === "cards"
        ? [
            'Quote metric display values, for example MetricIndicatorInline("185", "units"). Keep trend.value numeric.',
          ]
        : [];
    const text = [commonRules, ...signatures, ...notes, "Example:\n" + examples[key]].join("\n\n");
    docsByTopic.set(key, text);
    return [{ type: "text", text }];
  },
};
