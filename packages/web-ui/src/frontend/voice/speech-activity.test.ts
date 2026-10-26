import { expect, test } from "vitest";

import { SpeechActivity } from "./speech-activity";

test("local speech interrupts after 60ms and ends after 1200ms of silence", () => {
  const activity = new SpeechActivity();
  expect(activity.push(0.03)).toBeUndefined();
  expect(activity.push(0.03)).toBeUndefined();
  expect(activity.push(0.03)).toBe("start");
  for (let frame = 0; frame < 59; frame++) expect(activity.push(0)).toBeUndefined();
  expect(activity.push(0)).toBe("end");
  expect(activity.push(0)).toBeUndefined();
  activity.push(0.03);
  activity.reset();
  expect(activity.push(0.03)).toBeUndefined();
});
