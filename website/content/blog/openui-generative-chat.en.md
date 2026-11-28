---
title: "From Markdown to interactive replies: How Loop integrates OpenUI"
summary: "Chart and form examples trace Loop’s OpenUI integration from component selection and streaming to chat submission and history replay."
author: Di
category: engineering
publishedAt: 2026-11-28
draft: false
---

Ask Loop, “Visits from Monday to Friday were 12, 19, 16, 24, and 28. Which day dipped, and what was the overall trend?” The model can produce a chart alongside its explanation. A reply can also offer a form so readers can choose preferences and pass them into the next turn. With generative UI, the same chat can present different interfaces depending on the question. This article covers the implementation in the current development version of Loop Web and Desktop.

## 1. Share a component library between generation and rendering

Loop uses two packages from the OpenUI repository. `@openuidev/react-lang` (1.2.0) provides the OpenUI Lang parser and React renderer. `@openuidev/react-ui` (0.20.1) supplies charts, tables, forms, layouts, and styles. Loop starts with the official standalone library and adds chat components whose names are missing. This lets a single `Stack` contain charts, forms, and follow-up buttons. [OpenUI source](https://github.com/thesysdev/openui)

The shared library lives in `packages/web-ui/src/shared/openui-library.ts`. The backend reads component signatures from `toSpec()`. The frontend creates its parser with `toJSONSchema()` and the library’s root configuration. Both sides use the same component names, argument order, and root constraints as the dependencies evolve.

## 2. Choose a component from the user’s intent

When the Web backend creates a Loop instance, it uses the SDK’s `additionalTools` option to register `load_openui_docs` as a read-only tool. Its description teaches the model how to choose components. Charts suit trends and outliers, tables suit comparisons across several criteria, and forms suit preference selection. Markdown remains the default for simple answers.

Each call returns the signatures, rules, and an example for one topic, such as `{"topic":"charts"}`. The tool loads the shared library on its first call and caches the documentation by topic. The tool definition can therefore guide the model from the start, while component signatures enter the conversation on demand. The data comes from the user or from results the agent has already obtained through its regular tools.

For the visits question, the reply can identify Wednesday’s drop from 19 to 16, then include this top-level `openui` block. `Stack` is the root, each line defines one expression, and component arguments follow the order in their signatures. Keep the outer backticks when copying the example into a reply.

~~~~markdown
```openui
root = Stack([chart])
chart = BarChart(["Mon", "Tue", "Wed", "Thu", "Fri"], [Series("Visits", [12, 19, 16, 24, 28])])
```
~~~~

## 3. Render components from the text stream

`AssistantContent` identifies top-level `openui` fences in the Markdown token stream. The text around them still goes through the Markdown renderer. The first renderable block loads `OpenUiCard` and the OpenUI styles. While the latest text segment is still generating, the trailing block can preview before its fence closes and update as more text arrives.

When the reply finishes, the parser checks for a root, unresolved references, and errors. A missing closing fence, an incomplete structure, or a render failure leaves the source available as readable, copyable code. The history stores the original assistant message, so reopening a chat rebuilds the interface from the same source. Form submissions are saved with their messages. Local controls start with fresh state when the card mounts again.

## 4. Submit a form back to the chat

A report preferences form can let users pick a delivery frequency. The button’s `@ToAssistant` supplies the message to send, and the `Chips` options define both stable values and readable labels.

~~~~markdown
```openui
root = Stack([Form("report", actions, [frequency])])
actions = Buttons([Button("Apply", @ToAssistant("Recommend a report format for this frequency"))])
frequency = FormControl("Delivery frequency", Chips("frequency", "single", [weekly, monthly]))
weekly = ChipItem("weekly", "Weekly")
monthly = ChipItem("monthly", "Monthly")
```
~~~~

Choose “Weekly” and click “Apply.” The chat bubble shows “Recommend a report format for this frequency.” The model also receives a separate user input block with the form name, the field name `frequency`, the label “Delivery frequency,” the raw value `weekly`, and the display value “Weekly.” Follow-up buttons send ordinary user messages. Both use the current session’s message submission path and require a connected chat that is ready to accept the message.

## 5. Keep rendering and tool execution separate

OpenUI can render charts, tables, and local filters from data already in the message. Loop rejects blocks containing `Query` or `Mutation` declarations, and its generation rules tell the model to avoid `@Run`. Link actions accept only absolute HTTP(S) URLs without embedded credentials. A form submission enters the conversation as user input, so any later tool use follows the agent’s normal tool and permission flow.

Three checks cover the round trip. Stream an OpenUI block and replay it from history, verify that a malformed block stays readable as source, and check that both the raw value and display label reach the next model request. Loop covers these behaviors in `OpenUiCard.test.tsx`, `openui-blocks.test.ts`, and the Web backend’s `loop.test.ts`.
