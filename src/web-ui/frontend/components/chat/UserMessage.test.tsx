import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { UserMessage } from "./UserMessage";
import { promptContent } from "../../../shared/prompt-images";

test("UserMessage exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <UserMessage message={{ role: "user", content: "<script>text</script>", timestamp: 0 }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Copy");
  const imageMessage = renderToStaticMarkup(
    <UserMessage
      message={{
        role: "user",
        timestamp: 0,
        content: [{ type: "image", data: "AAAA", mimeType: "image/png" }],
      }}
    />,
  );
  expect(imageMessage).toContain("data:image/png;base64,AAAA");
  expect(imageMessage).toContain("Image attachment 1");
  client.clear();
});

test("mixed saved attachments show filename pills, extensions and safely escaped contents", async () => {
  const { Window } = await import("happy-dom");
  const window = new Window();
  const files = [
    { name: "example.html", text: "<script>example</script>" },
    { name: "notes.md", text: "" },
    { name: "long-file-name-".repeat(12) + ".py", text: "example = 1" },
  ];
  const image = { type: "image" as const, mimeType: "image/png", data: "AAAA" };
  const html = renderToStaticMarkup(
    <UserMessage
      message={{ role: "user", timestamp: 0, content: promptContent("Review", [image], files) }}
    />,
  );
  expect(html).toContain("example.html");
  expect(html).toContain("<details");
  expect(html).toContain("&lt;script&gt;example&lt;/script&gt;");
  expect(html).toContain("Review");
  expect(html).not.toContain("reference content");
  expect(html).not.toContain("<script>");
  try {
    window.document.body.innerHTML = html;
    const pills = window.document.querySelectorAll(".user-files .text-file-attachment-pill");
    expect(pills).toHaveLength(3);
    expect([...pills].map((pill) => pill.querySelector("summary")?.textContent)).toEqual(
      files.map((file) => file.name),
    );
    expect(
      [...pills].map((pill) => pill.querySelector(".text-file-extension")?.textContent),
    ).toEqual([".html", ".md", ".py"]);
    expect(window.document.querySelectorAll(".user-images img")).toHaveLength(1);
    expect(window.document.querySelector(".user-message-text")?.textContent).toBe("Review");
  } finally {
    await window.happyDOM.close();
  }
});
