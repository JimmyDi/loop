import { expect, test } from "vitest";

import { countdownProps, mapViewProps } from "./openui-scenarios";

test("requires meaningful labels and validates numeric component bounds", () => {
  expect(countdownProps.safeParse({ title: "Rest", seconds: 12 }).success).toBe(true);
  expect(countdownProps.safeParse({ title: "   ", seconds: 12 }).success).toBe(false);
  expect(countdownProps.safeParse({ title: "Rest", seconds: 0 }).success).toBe(false);
  expect(
    mapViewProps.safeParse({
      title: "Route",
      stops: [{ name: "Place", longitude: 181, latitude: 10 }],
    }).success,
  ).toBe(false);
});
