import { expect, test } from "vitest";

import { UserInputService } from "./user-input-service";
import type { UserInputEvent } from "./types";

const questions = [
  {
    id: "choice",
    text: "Choose an update strategy",
    options: [
      { id: "auto", label: "Automatic" },
      { id: "manual", label: "Manual" },
    ],
    recommendedOptionId: "auto",
  },
];

test("requires complete valid answers, isolates snapshots and accepts only the first live response", async () => {
  const events: UserInputEvent[] = [];
  const service = new UserInputService("session", (event) => events.push(event));
  service.registerHandler((request) => {
    request.questions[0]!.text = "mutated";
  });
  const pending = service.request(questions, new AbortController().signal);
  const request = service.pending[0]!;
  expect(request.questions).toEqual(questions);
  request.questions[0]!.text = "another mutation";
  expect(service.pending[0]!.questions).toEqual(questions);
  expect(service.respond({ ...request, sessionId: "other", answers: [] })).toBe(false);
  expect(
    service.respond({
      ...request,
      answers: [{ questionId: "choice", type: "option", optionId: "unknown" }],
    }),
  ).toBe(false);
  expect(
    service.respond({ ...request, answers: [{ questionId: "choice", type: "text", text: " " }] }),
  ).toBe(false);
  expect(service.pending).toHaveLength(1);
  const response = {
    ...request,
    answers: [{ questionId: "choice", type: "option" as const, optionId: "manual" }],
  };
  expect(service.respond(response)).toBe(true);
  expect(service.respond(response)).toBe(false);
  expect(await pending).toMatchObject({ outcome: "answered", answers: response.answers });
  expect(events.map((event) => event.type)).toEqual([
    "user_input_requested",
    "user_input_resolved",
  ]);
  expect(service.pending).toEqual([]);
  service.dispose();
});

test("missing or failing handlers, detaching and cancellation never select the recommendation", async () => {
  const service = new UserInputService("session", () => {});
  expect(await service.request(questions, new AbortController().signal)).toMatchObject({
    outcome: "unavailable",
  });
  let detach = service.registerHandler(async () => {
    throw new Error("offline");
  });
  expect((await service.request(questions, new AbortController().signal)).outcome).toBe(
    "unavailable",
  );
  detach();
  detach = service.registerHandler(() => {});
  const signal = new AbortController();
  const waiting = service.request(questions, signal.signal);
  const request = service.pending[0]!;
  signal.abort();
  expect((await waiting).outcome).toBe("cancelled");
  expect(
    service.respond({
      ...request,
      answers: [{ questionId: "choice", type: "text", text: "late" }],
    }),
  ).toBe(false);
  const abandoned = service.request(questions, new AbortController().signal);
  detach();
  expect((await abandoned).outcome).toBe("unavailable");
  service.dispose();
});

test("validates question IDs, option IDs and atomic multi-question submissions", async () => {
  const service = new UserInputService("session", () => {});
  service.registerHandler(() => {});
  await expect(
    service.request([...questions, ...questions], new AbortController().signal),
  ).rejects.toThrow("Invalid");
  await expect(
    service.request(
      [{ ...questions[0]!, recommendedOptionId: "missing" }],
      new AbortController().signal,
    ),
  ).rejects.toThrow("Invalid");
  const pending = service.request(
    [
      { id: "one", text: "First?" },
      { id: "two", text: "Second?" },
    ],
    new AbortController().signal,
  );
  const request = service.pending[0]!;
  expect(
    service.respond({ ...request, answers: [{ questionId: "one", type: "text", text: "answer" }] }),
  ).toBe(false);
  expect(
    service.respond({
      ...request,
      answers: [
        { questionId: "one", type: "text", text: "answer" },
        { questionId: "one", type: "skipped" },
      ],
    }),
  ).toBe(false);
  expect(
    service.respond({
      ...request,
      answers: [
        { questionId: "one", type: "text", text: "answer" },
        { questionId: "two", type: "skipped" },
      ],
    }),
  ).toBe(true);
  expect((await pending).outcome).toBe("answered");
  service.dispose();
});

test("explicit skips are accepted for every question while blank text remains invalid", async () => {
  const service = new UserInputService("session", () => {});
  service.registerHandler(() => {});
  const waiting = service.request(
    [{ id: "q", text: "【必答】Details?" }],
    new AbortController().signal,
  );
  const request = service.pending[0]!;
  expect(
    service.respond({ ...request, answers: [{ questionId: "q", type: "text", text: " " }] }),
  ).toBe(false);
  expect(service.pending).toHaveLength(1);
  expect(service.respond({ ...request, answers: [{ questionId: "q", type: "skipped" }] })).toBe(
    true,
  );
  expect(await waiting).toMatchObject({
    outcome: "answered",
    answers: [{ questionId: "q", type: "skipped" }],
  });
  service.dispose();
});
