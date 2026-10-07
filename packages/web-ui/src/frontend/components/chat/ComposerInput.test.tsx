import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ComposerInput } from "./ComposerInput";
import { Window } from "happy-dom";
import { useWorkspace } from "../../state/workspace-store";

test("mixed pasted files all become attachments without inserting clipboard HTML", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  let files: File[] = [];
  try {
    const view = render(
      <ComposerInput
        value="Draft"
        onChange={() => {}}
        onSubmit={() => {}}
        disabled={false}
        placeholder="Message"
        onFiles={(value) => {
          files = value;
        }}
      />,
    );
    const image = new File(["test"], "test.png", { type: "image/png" });
    const source = new File(["example = 1"], "example.py", { type: "text/plain" });
    const markdown = new File(["# Example"], "notes.md", { type: "text/markdown" });
    fireEvent.paste(view.getByRole("textbox"), {
      clipboardData: { files: [image, source, markdown], getData: () => "<img>" },
    });
    expect(files).toEqual([image, source, markdown]);
    expect(view.getByRole("textbox").textContent).toBe("Draft");
    fireEvent.paste(view.getByRole("textbox"), {
      clipboardData: { files: [source], getData: () => "" },
    });
    expect(files).toEqual([source]);
  } finally {
    cleanup();
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("ComposerInput exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ComposerInput
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        disabled
        placeholder="Message"
      />
    </QueryClientProvider>,
  );

  expect(html).toContain('role="textbox"');
  expect(html).toContain('contentEditable="false"');
  expect(html).toContain('aria-multiline="true"');
  client.clear();
});

test("selected skills appear beside text and Backspace removes them only at the text start", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };
  const state = useWorkspace.getState();
  Object.assign(globalThis, { window, document: window.document });
  const { render, fireEvent, cleanup } = await import("@testing-library/react/pure");
  try {
    useWorkspace.setState({ skills: { example: [{ id: "skill-one", name: "Review" }] } });
    const view = render(
      <ComposerInput
        sessionId="example"
        value="Draft"
        onChange={() => {}}
        onSubmit={() => {}}
        disabled={false}
        placeholder="Message"
      />,
    );
    const input = view.getByRole("textbox");
    const token = view.getByText("Review").closest(".composer-skill-token")!;
    expect(token.parentElement).toBe(input.parentElement);
    fireEvent.click(token);
    expect(useWorkspace.getState().skills.example).toEqual([{ id: "skill-one", name: "Review" }]);
    expect(input.textContent).toBe("Draft");
    const selection = document.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(useWorkspace.getState().skills.example).toHaveLength(1);
    range.selectNodeContents(input);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.keyDown(input, { key: "Backspace", isComposing: true, keyCode: 229 });
    expect(useWorkspace.getState().skills.example).toHaveLength(1);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(useWorkspace.getState().skills.example).toEqual([]);
    expect(view.queryByText("Review")).toBeNull();
    expect(input.textContent).toBe("Draft");
  } finally {
    cleanup();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});

test("copying a user message and pasting restores skill tokens, text and existing selections", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    DOMParser: globalThis.DOMParser,
    ClipboardItem: globalThis.ClipboardItem,
  };
  const state = useWorkspace.getState();
  let copied: Record<string, Blob> = {};
  Object.assign(globalThis, {
    window,
    document: window.document,
    DOMParser: window.DOMParser,
    ClipboardItem: class {
      constructor(public data: Record<string, Blob>) {}
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: window.navigator.userAgent,
      clipboard: {
        write: async (items: { data: Record<string, Blob> }[]) => {
          copied = items[0]!.data;
        },
      },
    },
  });
  const { render, fireEvent, cleanup, act } = await import("@testing-library/react/pure");
  const { UserMessage } = await import("./UserMessage");
  const a = { id: "a".repeat(24), name: "Review" };
  const b = { id: "b".repeat(24), name: "Review" };
  const existing = { id: "c".repeat(24), name: "Existing" };
  let changed = "";
  try {
    useWorkspace.setState({ skills: { example: [existing] } });
    const view = render(
      <>
        <UserMessage
          message={{ role: "user", content: "<img>Task", timestamp: 0 }}
          skills={[a, b]}
        />
        <ComposerInput
          sessionId="example"
          value="Before after"
          onChange={(text) => {
            changed = text;
          }}
          onSubmit={() => {}}
          disabled={false}
          placeholder="Message"
        />
      </>,
    );
    await act(async () => fireEvent.click(view.getByRole("button", { name: "Copy message" })));
    const plain = await copied["text/plain"]!.text();
    const html = await copied["text/html"]!.text();
    expect(plain).toBe("Review Review <img>Task");
    const input = view.getByRole("textbox");
    const range = document.createRange();
    range.setStart(input.firstChild!, 7);
    range.collapse(true);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
    fireEvent.paste(input, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === "text/html" ? html : plain),
      },
    });
    expect(changed).toBe("Before <img>Taskafter");
    expect(input.querySelector("img")).toBeNull();
    expect(useWorkspace.getState().skills.example).toEqual([existing, a, b]);
    expect(view.container.querySelectorAll(".composer-skill-token")).toHaveLength(3);
    fireEvent.paste(input, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === "text/html" ? html : plain),
      },
    });
    expect(useWorkspace.getState().skills.example).toEqual([existing, a, b]);
    fireEvent.paste(input, {
      clipboardData: {
        files: [],
        getData: (type: string) => (type === "text/html" ? "<strong>Review</strong>" : " Review"),
      },
    });
    expect(useWorkspace.getState().skills.example).toHaveLength(3);
    expect(input.querySelector("strong")).toBeNull();
  } finally {
    cleanup();
    useWorkspace.setState(state, true);
    Object.assign(globalThis, {
      window: previous.window,
      document: previous.document,
      DOMParser: previous.DOMParser,
      ClipboardItem: previous.ClipboardItem,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: previous.navigator,
    });
    await window.happyDOM.close();
  }
});
