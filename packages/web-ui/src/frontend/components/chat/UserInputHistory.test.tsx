import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { UserInputHistory } from "./UserInputHistory";
import "../../i18n/setup";

test("history displays the exact decision with escaped question and answer text", () => {
  const html = renderToStaticMarkup(
    <UserInputHistory
      result={{
        outcome: "answered",
        resolvedAt: 1,
        request: {
          sessionId: "s",
          requestId: "r",
          createdAt: 0,
          questions: [
            {
              id: "q",
              text: "Choose <script>strategy</script>",
              options: [{ id: "manual", label: "Manual" }],
            },
          ],
        },
        answers: [{ questionId: "q", type: "option", optionId: "manual" }],
      }}
    />,
  );
  expect(html).toContain("Answered questions");
  expect(html).toContain("Manual");
  expect(html).not.toContain("<script>");
});
