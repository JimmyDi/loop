import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { EchoConversationCard } from "./EchoConversationCard";

test("conversation card shows avatar, preview and activity date", () => {
  const html = renderToStaticMarkup(
    <EchoConversationCard
      name="Researcher"
      preview="Found the report"
      updatedAt="2026-11-22T00:00:00Z"
      selected
      onClick={() => {}}
    />,
  );
  expect(html).toContain("Researcher");
  expect(html).toContain("Found the report");
  expect(html).toContain("echo-avatar");
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain("<time");
});
