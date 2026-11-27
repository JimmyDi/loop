import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RepeatChoices } from "./RepeatChoices";

test("submits every selected day even while collapsed", () => {
  const html = renderToStaticMarkup(
    <RepeatChoices
      name="days"
      label="On"
      values={["MO", "TU", "WE"]}
      labels={["Monday", "Tuesday", "Wednesday"]}
      initial="MO,WE"
    />,
  );
  expect(html).toContain("Monday, Wednesday");
  expect(html.match(/name="days"/g)).toHaveLength(2);
});
