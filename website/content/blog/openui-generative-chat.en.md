---
title: "Building ChatGPT-style Intelligent UI in Loop with OpenUI"
summary: "Ten browser-tested scenarios explain Loop’s OpenUI integration, from charts and forms to routes, illustrated guides, timers, scaling, image search, sales, and drums."
author: Di
category: engineering
publishedAt: 2026-11-28
draft: false
---

Give Loop a set of visit counts and its reply can include a chart. Ask for a comparison and the reply can line up prices and delivery times in a table with a clickable follow-up. When the task calls for preferences, the user can choose them and submit them in the message. Here, Intelligent UI means interfaces generated for the conversation and usable within it. This article traces how Loop Web and Desktop implement them with OpenUI.

The screenshots show Loop’s actual chat components in a browser with fixed fictional messages. Try the suggested prompts in a chat to explore the behavior. The interface depends on the model’s reply. The first three cases include OpenUI Lang examples. The next seven include copyable prompts and the results checked in the browser.

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

## 4. Route map: request walking directions

```text
Walk from Taipei Main Station via 228 Peace Memorial Park to the Presidential Office. Mark the stops in that order. Let me pan, zoom, select stops, and request a walking route.
```

Drag the map, use the zoom buttons, then select marker 2 for 228 Peace Memorial Park. Click “Find walking route.” The three stops stay in order and the markers keep their screen positions as the route appears.

![Three Taipei stops and the walking route after lookup](./route-map-en-light.webp)

`RouteMap` takes an ordered list of public landmark coordinates. MapLibre loads the map near the viewport. The click sends the stops to FOSSGIS, and the returned GeoJSON line updates the existing map layer while preserving the view.

Basemap by OpenFreeMap. Map data © OpenStreetMap contributors. Walking route by FOSSGIS. [OpenFreeMap](https://openfreemap.org/) · [OpenStreetMap licensing](https://www.openstreetmap.org/copyright) · [FOSSGIS routing](https://routing.openstreetmap.de/)

## 5. Illustrated guide: page through assembly steps

```text
Make a step-by-step desktop bookshelf assembly guide with single- and double-shelf variants. Draw alignment, shelf installation, and squareness checks for both.
```

Click “Next” on the single-shelf version to change the diagram. Switch to “Double shelf” to return to step 1, then advance to the squareness check to see the diagonals.

![The third step of the double-shelf guide uses diagonals to check for square](./step-guide-en-light.webp)

`StepGuide` takes structured variants, each with its own instructions and SVG paths. The browser draws each step’s diagram and resets the step index when the variant changes.

## 6. Countdown and Markdown: show the timer with the steps

```text
Make a short pour-over coffee guide. Start with **Prep:**15 g of ground coffee, with no space after the bold label. Add a 12-second test countdown with start, pause, and reset next to the bloom step.
```

The label in “**Prep:**15 g of ground coffee” remains bold. The bloom step and timer appear together. Start the timer, pause it at 11 seconds, then reset it to 12.

![The bold prep label sits above the bloom step and timer paused at 11 seconds](./countdown-en-light.webp)

`AssistantContent` sends text outside the fence to the Markdown renderer. The CJK Markdown handling also recognizes the Chinese label ending in a fullwidth colon directly before a digit. `Countdown` takes a duration in seconds and runs its controls in the browser. The short interval is for testing the controls.

## 7. Ingredient scaling: change two servings to five

```text
Make a two-serving oatmeal shopping list with 100 g oats, 300 mL milk, and 20 g honey. Add a slider to scale quantities in the reply.
```

Move the slider from 2 to 5. The list immediately shows 250 g oats, 750 mL milk, and 50 g honey. The arrow keys work when the slider has focus.

![Five servings show recalculated quantities for oats, milk, and honey](./scaled-list-en-light.webp)

`ScaledList` receives the base serving count and quantities. It multiplies each quantity by the current serving count divided by the base count and keeps the supplied units.

## 8. Image search: open the source for each garden photo

```text
Create a Japanese courtyard mood board with stone, moss, and bamboo, plus a button that searches Wikimedia Commons for reference images.
```

Review the stone, moss, and bamboo swatches, then click “Find images on Wikimedia Commons.” The card shows thumbnails. Each result opens its own Commons file page.

![Garden palette with three swatches and Wikimedia results with source links](./image-search-en-light.webp)

`ColorSwatch` presents the color code and suggested use. `SearchImage` sends the query after the click and checks the thumbnail and source domains. The screenshot shows results from a live search.

Photo credits in screenshot order.

- Daderot (CC0). [DSC00327](https://commons.wikimedia.org/wiki/File:Stone_and_moss_-_Nagamachi_-_Kanazawa,_Japan_-_DSC00327.jpg) · [DSC00324](https://commons.wikimedia.org/wiki/File:Stone_and_moss_-_Nagamachi_-_Kanazawa,_Japan_-_DSC00324.jpg)
- Sherwin John Carlquist (CC BY 4.0). [Moss-covered stone sculpture](https://commons.wikimedia.org/wiki/File:%28Moss-covered_stone_sculpture_in_Sh%C5%8Dy%C5%8D-en_Garden,_Japan%29_-_DPLA_-_6b96501ada4b955821f774286da0b41f.jpg) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Z3lvs (CC0). [Stone lantern](https://commons.wikimedia.org/wiki/File:Stone_lantern,_stepping_stones_and_Japanese_maple_on_a_moss_lawn,_Portland_Japanese_Garden.jpg) · [Raked gravel](https://commons.wikimedia.org/wiki/File:Raked_gravel_and_moss-covered_stones,_Sand_and_Stone_Garden,_Portland_Japanese_Garden.jpg) · [Gravel court](https://commons.wikimedia.org/wiki/File:Gravel_court_with_moss-covered_stones,_Sand_and_Stone_Garden,_Portland_Japanese_Garden.jpg)

## 9. Sales dashboard: reduce projected revenue by 20%

```text
Build a dashboard from Loop’s built-in mock sales data. Plot actual revenue by month and add a slider to adjust projected revenue by a percentage.
```

Read the actual revenue bars for January through June, then move the slider to −20%. The chart still shows actual revenue. The projected total updates to $67,360, with actual and projected values listed below by month.

![Actual monthly revenue above the slider and projected total of $67,360 at minus 20 percent](./sales-dashboard-en-light.webp)

`Query("loop_demo_sales", {})` reads Loop’s bundled fictional data. `BarChart` and `SalesScenario` share it. The slider recalculates the projection in the browser, multiplying $84,200 by 0.8.

## 10. Drum machine: edit and play a 16-step pattern

```text
Put a 16-step drum machine in the reply at 108 BPM, with kick, snare, hi-hat, a swing slider, and playback. Let me edit the pattern and trigger each drum separately.
```

The sequencer opens at 108 BPM. Toggle cells in any row or audition the kick, snare, and hi-hat individually. Click “Play” to see the highlight move across the 16 columns. “Stop” clears it.

![Playing drum machine at 108 BPM with three rows of 16 editable steps](./drum-lab-en-light.webp)

`DrumLab` stores the three tracks in the browser. A user gesture starts Web Audio. Tempo and swing determine when each sound plays, while the UI tracks the current step.

## 11. Share component definitions between generation and rendering

Loop uses the parser and React renderer from `@openuidev/react-lang` and official components from `@openuidev/react-ui`. The shared library starts with the standalone set and adds chat components such as follow-up buttons. The backend reads component signatures from `toSpec()`. The frontend creates its parser with `toJSONSchema()` and the root configuration. One definition governs component names, argument order, and the root on both sides. [OpenUI source](https://github.com/thesysdev/openui)

The Web backend registers the read-only `load_openui_docs` tool through the SDK’s `additionalTools` option. Its description guides the model toward charts for trends, tables for comparisons, and forms for preferences. Simple replies can stay in Markdown. A call such as `{"topic":"charts"}` loads signatures, rules, and an example for one topic, so component documentation enters the conversation when the model needs it.

## 12. Render text increments and rebuild from history

The assistant still streams text. `AssistantContent` identifies top-level `openui` fences and sends the surrounding text to the Markdown renderer. The first renderable block loads `OpenUiCard` and its styles. A trailing block in the latest text segment can preview as text arrives, including before its fence closes.

At the end of the reply, the parser checks the root, references, and errors. Unclosed, invalid, or failed blocks remain readable as source. History retains the original assistant message so reopening the chat can rebuild the interface. Form submissions are saved with user messages, and a remounted card starts with fresh local control state.

## 13. Route interface actions through the chat

Hovering over a chart and changing a form choice happen in the browser. Follow-ups and form submissions use the current session’s message submission path and require a connected chat that can accept the message. Basic charts, tables, and forms can use data already in the message. The renderer allows `Query` only for the bundled fictional sales data and rejects `Mutation`. Any tool call in the next turn goes through the agent’s normal tool and permission flow.
