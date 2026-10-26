import { expect, test, vi } from "vitest";

import { VoiceTickets } from "./voice-tickets";

test("tickets are single-use, principal and call scoped, short-lived and replaceable", () => {
  vi.useFakeTimers();
  try {
    const tickets = new VoiceTickets();
    const first = tickets.issue("call", "device");
    expect(() => tickets.consume(first.ticket, "other", "device")).toThrow("voice_ticket_expired");
    expect(() => tickets.consume(first.ticket, "call", "device")).toThrow("voice_ticket_expired");
    const second = tickets.issue("call", "device");
    const replacement = tickets.issue("call", "device");
    expect(() => tickets.consume(second.ticket, "call", "device")).toThrow();
    tickets.consume(replacement.ticket, "call", "device");
    const expired = tickets.issue("call", "device");
    vi.advanceTimersByTime(30_001);
    expect(() => tickets.consume(expired.ticket, "call", "device")).toThrow();
    const revoked = tickets.issue("call", "device");
    tickets.remove("call");
    expect(() => tickets.consume(revoked.ticket, "call", "device")).toThrow();
  } finally {
    vi.useRealTimers();
  }
});
