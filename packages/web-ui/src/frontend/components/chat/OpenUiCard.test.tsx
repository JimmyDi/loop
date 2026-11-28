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

const { window } = new JSDOM("<!doctype html><html><body></body></html>");
const previous = { window: globalThis.window, document: globalThis.document };
let testing: typeof import("@testing-library/react/pure");

beforeAll(async () => {
  Object.assign(globalThis, { window, document: window.document });
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal("MutationObserver", window.MutationObserver);
  vi.stubGlobal("HTMLElement", window.HTMLElement);
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
  testing = await import("@testing-library/react/pure");
  // Keep the rendering assertions independent of the lazy chunk's cold-load time.
  await import("./OpenUiCard");
});
afterEach(() => testing?.cleanup());
afterAll(async () => {
  await testing?.act(async () => {});
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
  const canvas = vi.spyOn(window.HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        measureText: (text: string) => ({ width: text.length * 8 }),
      }) as CanvasRenderingContext2D,
  );
  try {
    const ui = render(<AssistantContent message={message(fenced(source))} tools={{}} />);
    expect(await ui.findByText("North", {}, { timeout: 8000 })).toBeTruthy();
    expect(ui.container.querySelector("pre code")).toBeNull();
  } finally {
    canvas.mockRestore();
  }
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
