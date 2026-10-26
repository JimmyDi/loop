import { randomBytes } from "node:crypto";

import type { VoiceConnection } from "../../shared/voice";
import { HttpError } from "../http/errors";
import type { VoiceTicket } from "./voice-tickets-types";

export class VoiceTickets {
  private tickets = new Map<string, VoiceTicket>();

  issue = (callId: string, principal: string): VoiceConnection => {
    for (const [token, value] of this.tickets)
      if (value.expiresAt <= Date.now() || value.callId === callId) this.tickets.delete(token);
    const ticket = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 30_000;
    this.tickets.set(ticket, { callId, principal, expiresAt });
    return { callId, ticket, expiresAt };
  };

  consume = (ticket: unknown, callId: string, principal: string): void => {
    const value = typeof ticket === "string" ? this.tickets.get(ticket) : undefined;
    if (typeof ticket === "string") this.tickets.delete(ticket);
    if (
      !value ||
      value.callId !== callId ||
      value.principal !== principal ||
      value.expiresAt <= Date.now()
    )
      throw new HttpError(401, "voice_ticket_expired");
  };

  remove = (callId: string): void => {
    for (const [token, value] of this.tickets)
      if (value.callId === callId) this.tickets.delete(token);
  };
}
