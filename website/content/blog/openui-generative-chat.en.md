---
title: "Building ChatGPT-style Intelligent UI in Loop with OpenUI"
summary: "Browser-tested screenshots show chart tooltips, plan comparisons, and form submission, followed by how Loop selects, streams, and handles components."
author: Di
category: engineering
publishedAt: 2026-11-28
draft: false
---

Give Loop a set of visit counts and its reply can include a chart. Ask for a comparison and the reply can line up prices and delivery times in a table with a clickable follow-up. When the task calls for preferences, the user can choose them and submit them in the message. Here, Intelligent UI means interfaces generated for the conversation and usable within it. This article traces how Loop Web and Desktop implement them with OpenUI.

The screenshots show Loop’s actual chat components in a browser with fixed fictional messages. Try the suggested prompts in a chat to explore the behavior. The interface depends on the model’s reply. Each case includes the OpenUI Lang used for the screenshot so the rendering input can be reproduced.

## 1. Read a trend by hovering over Wednesday

Ask “Visits from Monday to Friday were 12, 19, 16, 24, and 28. Which day dipped, and what was the overall trend?” The reply explains that visits dropped from 19 to 16 on Wednesday before climbing to 28 on Friday. Hover over Wednesday’s bar to see its value of 16 in the tooltip.

![Visit trend chart with the pointer over Wednesday’s bar and a tooltip showing 16 visits](./trend-en-light.webp)

`BarChart` and `Series` take the axis labels and values. The React chart handles the tooltip in the browser so the reader can inspect a data point without sending another message.

~~~~markdown
```openui
root = Stack([BarChart(["Mon", "Tue", "Wed", "Thu", "Fri"], [Series("Visits", [12, 19, 16, 24, 28])])])
```
~~~~

## 2. Compare plans and choose a follow-up

Ask “Compare three fictional plans. Basic costs $29 with delivery in 5 days and email support. Standard costs $49 with delivery in 2 days and email support. Express costs $79 with delivery in 1 day and priority support.” The table puts price, delivery, and support side by side. Click “Compare only plans that deliver within two days” below it to send that text as a user message.

![Three plans compared by price, delivery, and support, with a follow-up button under the table](./comparison-en-light.webp)

`Table([Col(...)])` takes data by column. Values at matching positions form a row. `FollowUpItem` passes its text to the chat submission path. Clicking it starts the next turn and leaves the original table in the conversation.

~~~~markdown
```openui
root = Stack([comparison, followups])
comparison = Table([Col("Plan", ["Basic", "Standard", "Express"]), Col("Price", ["$29", "$49", "$79"]), Col("Delivery", ["5 days", "2 days", "1 day"]), Col("Support", ["Email", "Email", "Priority"])])
followups = FollowUpBlock([FollowUpItem("Compare only plans that deliver within two days")])
```
~~~~

## 3. Submit a weekly report preference

Ask “Let me choose weekly or monthly delivery, then recommend a report format.” Select “Weekly” and click “Apply.” Selecting an option updates the form state. Clicking “Apply” adds a new user message that reads “Recommend a report format for this frequency.”

![Report preferences form with Weekly selected and the user message sent by clicking Apply beneath it](./preferences-en-light.webp)

`Chips` defines a stable value and a visible label for each choice. `@ToAssistant` supplies the text shown in the user bubble. The next turn also receives structured form data, including the field name `frequency`, the label “Delivery frequency,” the raw value `weekly`, and the display value “Weekly.” That gives the model the exact choice when the message says only “this frequency.”

~~~~markdown
```openui
root = Stack([Form("report", actions, [frequency])])
actions = Buttons([Button("Apply", @ToAssistant("Recommend a report format for this frequency"))])
frequency = FormControl("Delivery frequency", Chips("frequency", "single", [weekly, monthly]))
weekly = ChipItem("weekly", "Weekly")
monthly = ChipItem("monthly", "Monthly")
```
~~~~

## 4. Share component definitions between generation and rendering

Loop uses the parser and React renderer from `@openuidev/react-lang` and official components from `@openuidev/react-ui`. The shared library starts with the standalone set and adds chat components such as follow-up buttons. The backend reads component signatures from `toSpec()`. The frontend creates its parser with `toJSONSchema()` and the root configuration. One definition governs component names, argument order, and the root on both sides. [OpenUI source](https://github.com/thesysdev/openui)

The Web backend registers the read-only `load_openui_docs` tool through the SDK’s `additionalTools` option. Its description guides the model toward charts for trends, tables for comparisons, and forms for preferences. Simple replies can stay in Markdown. A call such as `{"topic":"charts"}` loads signatures, rules, and an example for one topic, so component documentation enters the conversation when the model needs it.

## 5. Render text increments and rebuild from history

The assistant still streams text. `AssistantContent` identifies top-level `openui` fences and sends the surrounding text to the Markdown renderer. The first renderable block loads `OpenUiCard` and its styles. A trailing block in the latest text segment can preview as text arrives, including before its fence closes.

At the end of the reply, the parser checks the root, references, and errors. Unclosed, invalid, or failed blocks remain readable as source. History retains the original assistant message so reopening the chat can rebuild the interface. Form submissions are saved with user messages, and a remounted card starts with fresh local control state.

## 6. Route interface actions through the chat

Hovering over a chart and changing a form choice happen in the browser. Follow-ups and form submissions use the current session’s message submission path and require a connected chat that can accept the message. These examples use data already in the message. For other cards, the renderer allows `Query` only for the bundled fictional sales data and rejects `Mutation`. Any tool call in the next turn goes through the agent’s normal tool and permission flow.
