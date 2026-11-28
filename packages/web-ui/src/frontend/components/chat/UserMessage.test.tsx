import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { UserMessage } from "./UserMessage";
import { promptContent } from "../../../shared/prompt-images";

let browser: JSDOM["window"];

beforeEach(() => {
  browser = new JSDOM().window;
  vi.stubGlobal("window", browser);
  vi.stubGlobal("document", browser.document);
});

afterEach(() => {
  vi.unstubAllGlobals();
  browser.close();
});

test("UserMessage renders sanitized Markdown and keeps its copy action", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <UserMessage
        message={{
          role: "user",
          content: "## Request\n\n- **Review** the config\n\n<script>text</script>",
          timestamp: 0,
        }}
      />
    </QueryClientProvider>,
  );

  expect(html).toContain("<h2>Request</h2>");
  expect(html).toContain("<li><strong>Review</strong> the config</li>");
  expect(html).not.toContain("<script>");
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

test("mixed saved attachments show filename pills, extensions and safely escaped contents", () => {
  const files = [
    { name: "example.html", text: "<script>example</script>" },
    { name: "notes.md", text: "" },
    { name: "long-file-name-".repeat(12) + ".py", text: "example = 1" },
  ];
  const image = { type: "image" as const, mimeType: "image/png", data: "AAAA" };
  const html = renderToStaticMarkup(
    <UserMessage
      skills={[
        { id: "review-source", name: "Review" },
        { id: "escaped-source", name: "<script>skill</script>" },
      ]}
      message={{ role: "user", timestamp: 0, content: promptContent("Review", [image], files) }}
    />,
  );
  expect(html).toContain("example.html");
  expect(html).toContain("<details");
  expect(html).toContain("&lt;script&gt;example&lt;/script&gt;");
  expect(html).toContain("Review");
  expect(html).not.toContain("reference content");
  expect(html).not.toContain("<script>");
  browser.document.body.innerHTML = html;
  const pills = browser.document.querySelectorAll(".user-files .text-file-attachment-pill");
  expect(pills).toHaveLength(3);
  expect([...pills].map((pill) => pill.querySelector("summary")?.textContent)).toEqual(
    files.map((file) => file.name),
  );
  expect([...pills].map((pill) => pill.querySelector(".text-file-extension")?.textContent)).toEqual(
    [".html", ".md", ".py"],
  );
  expect(browser.document.querySelectorAll(".user-images img")).toHaveLength(1);
  const bubble = browser.document.querySelector(".user-message-text")!;
  const skills = bubble.querySelectorAll(".user-message-skill");
  expect([...skills].map((skill) => skill.textContent)).toEqual([
    "Review",
    "<script>skill</script>",
  ]);
  expect(skills[0]?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  expect(bubble.querySelector(".markdown-text p")?.textContent).toBe("Review");
  expect(bubble.querySelectorAll("button")).toHaveLength(2);
});

test("skill-only user messages retain a bubble and copy action", () => {
  const message = { role: "user" as const, content: "", timestamp: 0 };
  const html = renderToStaticMarkup(
    <UserMessage message={message} skills={[{ id: "review", name: "Review" }]} />,
  );
  expect(html).toContain('class="user-message-text"');
  expect(html).toContain('class="user-message-skill"');
  expect(html).toContain("Review");
  expect(html).toContain("Copy");
  expect(message.content).toBe("");
});

test("form submissions display only the message text", () => {
  const form = {
    name: "preferences",
    fields: [{ name: "frequency", label: "通知频率", value: "weekly", displayText: "每周" }],
  };
  const html = renderToStaticMarkup(
    <UserMessage
      message={{ role: "user", timestamp: 0, content: promptContent("已提交偏好", [], [], form) }}
    />,
  );
  expect(html).toContain("已提交偏好");
  expect(html).not.toContain("weekly");
  expect(html).not.toContain("每周");
  expect(html).not.toContain("Submitted form data");
});
