import { within } from "@testing-library/dom";
import { JSDOM } from "jsdom";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest";

import "../../i18n/setup";
import { AssistantContent } from "./AssistantContent";
import { OpenUiActionContext } from "../../lib/openui-actions";
import type { Message } from "../../../shared/protocol";

const sample =
  'root = Stack([Card([CardHeader("Test results"), Table([Col("Test", ["Parser", "Renderer"]), Col("Status", ["Passed", "Failed"])])])])';

const message = (text: string, stopReason: "stop" | "aborted" = "stop") =>
  ({ role: "assistant", content: [{ type: "text", text }], stopReason }) as Extract<
    Message,
    { role: "assistant" }
  >;

const fenced = (source: string) => "```openui\n" + source + "\n```";

const { window } = new JSDOM("<!doctype html><html><body></body></html>", {
  pretendToBeVisual: true,
});
const previous = { window: globalThis.window, document: globalThis.document };
let testing: typeof import("@testing-library/react/pure");

beforeAll(async () => {
  Object.assign(globalThis, { window, document: window.document });
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("MutationObserver", window.MutationObserver);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
  vi.stubGlobal("HTMLFormElement", window.HTMLFormElement);
  vi.stubGlobal("HTMLInputElement", window.HTMLInputElement);
  vi.stubGlobal("Element", window.Element);
  vi.stubGlobal("Node", window.Node);
  vi.stubGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(Date.now()), 0),
  );
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.spyOn(window.HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        measureText: (text: string) => ({ width: text.length * 8 }),
      }) as CanvasRenderingContext2D,
  );
  testing = await import("@testing-library/react/pure");
  // Load the renderer after installing DOM globals, before timing its UI assertions.
  await import("./OpenUiCard");
});
afterEach(() => testing?.cleanup());
afterAll(async () => {
  await testing?.act(async () => {});
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.assign(globalThis, previous);
  window.close();
});

test("renders a growing native table and restores a saved OpenUI block with its Markdown", async () => {
  const { act, render } = testing;
  const draft = "Summary\n\n```openui\n" + sample.slice(0, -2);
  const saved = message(
    "[Summary][docs]\n\n" + fenced(sample) + "\n\nMore details\n\n[docs]: https://example.com",
  );
  const ui = render(<AssistantContent message={message(draft)} tools={{}} generating streaming />);
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  expect(ui.getByRole("table")).toBeTruthy();
  expect(ui.getByText("Test results")).toBeTruthy();
  expect(ui.getByText("Parser")).toBeTruthy();

  ui.rerender(<AssistantContent message={saved} tools={{}} />);
  expect(ui.getByRole("link", { name: "Summary" }).getAttribute("href")).toBe(
    "https://example.com",
  );
  expect(ui.getByText("More details")).toBeTruthy();
  ui.unmount();
  const reopened = render(<AssistantContent message={saved} tools={{}} />);
  expect(await reopened.findByText("Parser")).toBeTruthy();
});

test("renders a horizontal bar chart with an ignored extra positional argument", async () => {
  const { render } = testing;
  const source = [
    "root = Stack([chart])",
    'chart = HorizontalBarChart(["North", "South"], [Series("Count", [5, 12])], null, "Count", null, 360)',
  ].join("\n");
  const ui = render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  expect(await ui.findByText("North", {}, { timeout: 8000 })).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("renders numeric metric display values inside native cards", async () => {
  const { render } = testing;
  const source = [
    "root = Stack([overview, comparison, TextContent(example)])",
    'overview = OverviewCardBlock([OverviewCardItem("sales", Text("text", "Sales"), MetricIndicatorInline(185, "units", {direction: "up", value: 14.2}))], "grid", true)',
    'comparison = CompositeCardBlock([CompositeCardItem("price", Text("text", "Price"), [Text("text", "Details")], {price: MetricIndicatorWithStrikethrough(6500, "USD", 6600)})], "grid", true)',
    'example = "MetricIndicatorInline(42)"',
  ].join("\n");
  const ui = render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  expect(await ui.findByText("185", {}, { timeout: 8000 })).toBeTruthy();
  expect(ui.getByText("6500")).toBeTruthy();
  expect(ui.getByText("6600")).toBeTruthy();
  expect(ui.getByText("MetricIndicatorInline(42)")).toBeTruthy();
});

test("keeps malformed, unsupported, or interrupted OpenUI as source", async () => {
  const { render } = testing;
  const invalid = 'root = Table("Test results", ["Name"], [["Old format"]])';
  const ui = render(<AssistantContent message={message(fenced(invalid))} tools={{}} />);
  expect((await ui.findByText(invalid, { selector: "pre code" })).textContent?.trim()).toBe(
    invalid,
  );
  expect(ui.queryByRole("table")).toBeNull();

  const query = 'data = Query("shell", {})\n' + sample;
  ui.rerender(<AssistantContent message={message(fenced(query))} tools={{}} />);
  expect(ui.container.querySelector("pre code")?.textContent?.trim()).toBe(query);

  ui.rerender(<AssistantContent message={message(fenced(sample), "aborted")} tools={{}} />);
  expect(ui.container.querySelector("pre code")?.textContent?.trim()).toBe(sample);
});

test("renders official tabs and submits a generated form through the chat action", async () => {
  const { render, fireEvent } = testing;
  const send = vi.fn(async () => {});
  const source = [
    'form = Form("preferences", Buttons([Button("Apply", @ToAssistant("Apply preferences"))]), [FormControl("昵称", Input("name", "Enter name")), FormControl("通知频率", Chips("frequency", "single", [ChipItem("weekly", "每周")]))])',
    'tabs = Tabs([TabItem("edit", "Edit", [form]), TabItem("info", "About", [TextContent("Example notes")])])',
    'followups = FollowUpBlock([FollowUpItem("Show a summary")])',
    'root = Stack([Card([CardHeader("Preferences"), tabs]), followups])',
  ].join("\n");
  const ui = render(
    <OpenUiActionContext value={send}>
      <AssistantContent message={message(fenced(source))} tools={{}} />
    </OpenUiActionContext>,
  );
  expect(await ui.findByText("Preferences", {}, { timeout: 8000 })).toBeTruthy();
  fireEvent.change(ui.getByPlaceholderText("Enter name"), { target: { value: "Sample" } });
  fireEvent.click(ui.getByText("每周"));
  fireEvent.click(ui.getByRole("button", { name: "Apply" }));
  expect(send).toHaveBeenCalledWith({
    text: "Apply preferences",
    form: {
      name: "preferences",
      fields: [
        { name: "name", label: "昵称", value: "Sample", displayText: "Sample" },
        { name: "frequency", label: "通知频率", value: "weekly", displayText: "每周" },
      ],
    },
  });
  fireEvent.click(ui.getByText("Show a summary"));
  expect(send).toHaveBeenLastCalledWith({ text: "Show a summary" });
});

test("renders a step guide, a scaling list, and a synthetic dashboard from saved chat source", async () => {
  const { render, fireEvent } = testing;
  const source = [
    "root = Stack([guide, ingredients, sales])",
    'guide = StepGuide("Build guide", [{name: "Small", steps: [{title: "Align", description: "Check edges", diagram: ["M40 40 H160 V140"]}, {title: "Attach", description: "Follow the manual"}]}])',
    'ingredients = ScaledList("Dinner", 4, [{name: "Rice", amount: 300, unit: "g"}])',
    'sales = SalesScenario("Synthetic sales", "USD", data.rows)',
    'data = Query("loop_demo_sales", {})',
  ].join("\n");
  const ui = render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  expect(await ui.findByRole("rowheader", { name: "Jun" })).toBeTruthy();
  expect(ui.getByRole("img", { name: "Align" })).toBeTruthy();
  fireEvent.click(ui.getByRole("button", { name: "Next" }));
  expect(ui.getByText("Follow the manual")).toBeTruthy();
  const servingInput = within(ui.getByRole("group", { name: /Servings/ })).getByRole("slider");
  for (let step = 0; step < 4; step += 1) fireEvent.keyDown(servingInput, { key: "ArrowRight" });
  expect(ui.getByText("600 g")).toBeTruthy();
  const revenueInput = within(ui.getByRole("group", { name: /Revenue adjustment/ })).getByRole(
    "slider",
  );
  for (let step = 0; step < 10; step += 1) fireEvent.keyDown(revenueInput, { key: "ArrowRight" });
  expect(ui.getByText("Projected total: $92,620.00")).toBeTruthy();
});

test("renders a saved map when Stack uses a named gap", async () => {
  const source = [
    'root = Stack([walkMap], gap="m")',
    'walkMap = RouteMap("City walk", [',
    '  {name: "First stop", longitude: 10, latitude: 20},',
    '  {name: "Second stop", longitude: 11, latitude: 21}',
    "])",
  ].join("\n");
  const observe = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = observe;
      disconnect = vi.fn();
    },
  );
  try {
    const ui = testing.render(<AssistantContent message={message(fenced(source))} tools={{}} />);
    expect(await ui.findByRole("heading", { name: "City walk" })).toBeTruthy();
    expect(ui.getByRole("button", { name: "First stop" })).toBeTruthy();
    expect(ui.getByRole("button", { name: "Find walking route" })).toBeTruthy();
    expect(ui.container.querySelector("pre code")).toBeNull();
    ui.unmount();
  } finally {
    vi.stubGlobal("IntersectionObserver", undefined);
  }
});

test("renders a multiline guide with a countdown and an entity list", async () => {
  const source = [
    "root = Stack([",
    '  Card([CardHeader("Coffee", "Single serving")])',
    '  Card([TextContent("**Prepare** (30 seconds)\\n\\nRinse the filter.")])',
    "  Stack([",
    '    Card([TextContent("**Bloom**\\n\\nPour slowly."), TextContent("Start the timer.", "small")], "sunk")',
    '    Countdown("Bloom timer", 12)',
    '  ], "row", "m", "stretch")',
    '  Card([InlineHeader("Adjustments", "Change one variable"),',
    '    EntityList([{left: "Too fast (< 1:50)", right: "Grind finer"}], "default", {left: "Issue", right: "Fix"})',
    "  ])",
    '], null, "m")',
  ].join("\n");
  const raw = "Guide\n\n" + fenced(source) + "\n\nEnjoy.";
  const ui = testing.render(
    <AssistantContent
      message={message("Guide\n\n" + fenced(source).slice(0, -20))}
      tools={{}}
      generating
      streaming
    />,
  );
  await testing.act(async () => {
    await vi.dynamicImportSettled();
  });
  ui.rerender(<AssistantContent message={message(raw)} tools={{}} />);
  expect((await ui.findByRole("timer")).textContent).toBe("00:00:12");
  expect(ui.getByText("Grind finer")).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("renders a saved 96 BPM drum lab between Markdown blocks", async () => {
  const source = 'root = Stack([DrumLab("Drum check", 96)])';
  const saved = message("Instructions\n\n" + fenced(source) + "\n\nPlay a pad.");
  const ui = testing.render(<AssistantContent message={saved} tools={{}} />);
  expect(await ui.findByRole("heading", { name: "Drum check" })).toBeTruthy();
  expect(ui.getAllByRole("button", { name: /step/ })).toHaveLength(48);
  expect(ui.getAllByRole("slider")[0]?.getAttribute("aria-valuenow")).toBe("96");
  expect(ui.getByText("Play a pad.")).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("renders a grouped sales chart and slider with an accented binding name", async () => {
  const source = [
    'root = Stack([chart, scenario], "column", "l")',
    'chart = BarChart(périodes, [Series("Actual", actual), Series("Trend", forecast)], "grouped", "Month", "Revenue", 320)',
    'scenario = SalesScenario("Demo sales", "USD", data.rows)',
    "périodes = data.rows.period",
    "actual = data.rows.revenue",
    "forecast = [12000, 13000, 14000, 15000, 16000, 17000]",
    'data = Query("loop_demo_sales", {})',
  ].join("\n");
  const ui = testing.render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  expect(await ui.findByRole("heading", { name: "Demo sales" })).toBeTruthy();
  expect(ui.getByRole("slider")).toBeTruthy();
  expect(ui.getByText("Trend")).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("renders a saved cooking guide whose preparation label is followed by a number", async () => {
  const source = [
    "root = Stack([prep, bloomRow, pour, finish])",
    'prep = TextContent("**1. 润纸布粉**：润湿滤纸。")',
    'bloomRow = Stack([bloom, timer], "row", "m", "center", "between", true)',
    'bloom = TextContent("**2. 闷蒸**：浸湿咖啡粉。")',
    'timer = Countdown("测试倒计时", 12)',
    'pour = TextContent("**3. 注水**：慢慢注水。")',
    'finish = TextContent("**4. 完成**：移开滤杯。")',
  ].join("\n");
  const saved = message("### 咖啡\n\n**准备：**15 克咖啡粉。\n\n" + fenced(source));
  const ui = testing.render(<AssistantContent message={saved} tools={{}} />);
  expect((await ui.findByRole("timer")).textContent).toBe("00:00:12");
  expect(ui.getByText("准备：", { selector: "strong" })).toBeTruthy();
  expect(ui.getByText("2. 闷蒸", { selector: "strong" })).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("keeps the previous card visible while an allowed query name streams in", async () => {
  const source = 'root = Stack([Card([CardHeader("Preview remains visible")])])';
  const open = fenced(source).slice(0, -4);
  const draft = (text: string) => (
    <AssistantContent message={message(text)} tools={{}} generating streaming />
  );
  const ui = testing.render(draft(open));
  await ui.findByText("Preview remains visible");
  const card = ui.container.querySelector(".loop-openui");

  ui.rerender(draft(open + '\ndata = Query("loop_'));
  expect(ui.container.querySelector(".loop-openui")).toBe(card);
  expect(ui.getByText("Preview remains visible")).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();

  ui.rerender(draft(open + '\ndata = Query("loop_demo_sales", {})'));
  expect(ui.container.querySelector(".loop-openui")).toBe(card);

  const rewritten = 'data = Mutation("unsupported", {})\n' + source;
  ui.rerender(draft(fenced(rewritten).slice(0, -4)));
  expect(ui.container.querySelector(".loop-openui")).toBeNull();
  expect(ui.container.querySelector("pre code")?.textContent?.trim()).toBe(rewritten);

  const rejected = source + '\ndata = Query("unsupported", {})';
  ui.rerender(<AssistantContent message={message(fenced(rejected))} tools={{}} />);
  expect(ui.container.querySelector(".loop-openui")).toBeNull();
  expect(ui.container.querySelector("pre code")?.textContent?.trim()).toBe(rejected);
});

test("renders a mood board with shortened Card gaps, Markdown and native image search controls", async () => {
  const source = [
    'root = Stack([palette, materials, ratios, gallery], null, "l")',
    'palette = Card([CardHeader("配色"), Stack([',
    '  Card([TextContent("**岩灰** `#8C8F88`", "small-heavy")], "sunk", "xs"),',
    '  Card([TextContent("苔绿", "small")], "sunk", "xs")',
    '], "row", "s", "stretch", null, true)])',
    'materials = Card([TextContent("- **石材**：粗糙表面\n- **苔藓**：半阴")], "card", "column", "s")',
    'ratios = Card([TextContent("| 材质 | 占比 |\n| --- | --- |\n| 石材 | 25% |", "small")])',
    'gallery = Card([CardHeader("参考图库"), Stack([SearchImage("庭院照片", "Japanese garden")], "row", "s", null, null, true)])',
  ].join("\n");
  const ui = testing.render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  expect(await ui.findByText("庭院照片")).toBeTruthy();
  const gray = ui.getByText("#8C8F88", { selector: "code" });
  expect(gray.closest(".openui-card")?.getAttribute("style")).toContain(
    "gap: var(--openui-space-xs)",
  );
  expect(ui.getByRole("cell", { name: "25%" })).toBeTruthy();
  expect(ui.getByRole("button", { name: "Find images on Wikimedia Commons" })).toBeTruthy();
  expect(ui.container.querySelector("pre code")).toBeNull();
});

test("renders exact swatches and opens native list actions through the link path", async () => {
  const source = [
    "root = Stack([palette, gallery])",
    'palette = Stack([ColorSwatch("Moss", "#5E7A4B", "Ground cover")], "row", "s", null, null, true)',
    'gallery = Card([ListBlock([ListItem("Garden photos", null, null, "View photos", @OpenUrl("https://example.com/photos"))])])',
  ].join("\n");
  const ui = testing.render(<AssistantContent message={message(fenced(source))} tools={{}} />);
  const swatch = (await ui.findByText("#5E7A4B")).closest("figure");
  expect(swatch?.querySelector("div")?.style.backgroundColor).toBe("rgb(94, 122, 75)");
  expect(ui.getByText("Ground cover")).toBeTruthy();
  const clicked = vi.fn();
  const onClick = (event: Event) => {
    if (event.target instanceof window.HTMLAnchorElement) {
      event.preventDefault();
      clicked(event.target.href, event.target.target, event.target.rel);
    }
  };
  window.document.addEventListener("click", onClick);
  try {
    testing.fireEvent.click(ui.getByText("View photos"));
    expect(clicked).toHaveBeenCalledWith(
      "https://example.com/photos",
      "_blank",
      "noopener noreferrer",
    );
  } finally {
    window.document.removeEventListener("click", onClick);
  }
});
