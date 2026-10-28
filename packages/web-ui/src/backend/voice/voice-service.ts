import { VoiceRuntime } from "@loop/coding-agent";
import type { VoiceResourceManager } from "@loop/coding-agent";
import type { WebSocket } from "ws";

import type { VoiceMode } from "../../shared/voice";
import type { BusinessContext } from "../http/business-context";
import { HttpError } from "../http/errors";
import type { SessionRegistry } from "../session-registry";
import { VoiceTickets } from "./voice-tickets";
import { forwardVoiceEvent } from "./call-events";
import { connectVoiceCall } from "./call-connection";
import type { WebVoiceCall } from "./call-types";

export class VoiceService {
  private readonly runtime: VoiceRuntime;
  private readonly tickets = new VoiceTickets();
  private state?: WebVoiceCall;
  private starting = false;
  private startingPrincipal?: string;
  private readonly revoked = new Set<string>();
  private closed = false;

  constructor(
    readonly resources: VoiceResourceManager,
    private readonly registry: SessionRegistry,
    runtime = new VoiceRuntime({ resources: (options) => resources.acquireRuntime(options) }),
  ) {
    this.runtime = runtime;
  }

  start = async (
    owner: BusinessContext,
    clientId: string,
    mode: VoiceMode,
    sessionId?: string,
    signal?: AbortSignal,
    synthesis = mode === "conversation",
  ) => {
    if (this.closed || this.starting || this.state) throw new HttpError(409, "voice_call_active");
    this.assertAuthorized(owner);
    signal?.throwIfAborted();
    this.starting = true;
    this.startingPrincipal = owner.principal;
    const abort = () => void this.runtime.close();
    signal?.addEventListener("abort", abort, { once: true });
    const expiry = owner.expiresAt
      ? setTimeout(() => void this.runtime.close(), Math.max(0, owner.expiresAt - Date.now()))
      : undefined;
    expiry?.unref();
    try {
      if (mode !== "test") {
        if (!sessionId) throw new HttpError(400, "invalid_sessionId");
        const session = await this.registry.get(sessionId);
        this.registry.assertAvailable(session.workspaceId);
      }
      if (this.closed) throw new HttpError(503, "voice_closed");
      this.assertAuthorized(owner);
      signal?.throwIfAborted();
      const call = await this.runtime.startCall({
        mode: mode === "conversation" ? mode : "dictation",
        synthesis,
      });
      if (this.closed) {
        await call.close();
        throw new HttpError(503, "voice_closed");
      }
      try {
        this.assertAuthorized(owner);
        signal?.throwIfAborted();
      } catch (error) {
        await call.close();
        throw error;
      }
      const state: WebVoiceCall = {
        id: call.id,
        owner,
        clientId,
        mode,
        sessionId,
        call,
        unsubscribe: () => {},
        muted: false,
        readingPaused: false,
        generation: 0,
        utteranceId: crypto.randomUUID(),
        input: Promise.resolve(),
        audioBytes: 0,
        discarding: false,
        speech: new Map(),
        audioWindow: { started: Date.now(), bytes: 0 },
      };
      this.state = state;
      state.unsubscribe = call.subscribe((event) => {
        forwardVoiceEvent(state, event);
        if (event.type === "state" && event.state === "closed") void this.end(state);
      });
      this.grace(state);
      if (owner.expiresAt) {
        state.expiry = setTimeout(
          () => void this.end(state),
          Math.max(0, owner.expiresAt - Date.now()),
        );
        state.expiry.unref();
      }
      return this.tickets.issue(state.id, owner.principal);
    } finally {
      signal?.removeEventListener("abort", abort);
      clearTimeout(expiry);
      this.starting = false;
      this.startingPrincipal = undefined;
    }
  };

  reconnect = (id: string, owner: BusinessContext, clientId: string) => {
    const state = this.owned(id, owner, clientId);
    if (state.socket) throw new HttpError(409, "voice_call_connected");
    return this.tickets.issue(id, state.owner.principal);
  };

  stop = async (id: string, owner: BusinessContext, clientId: string): Promise<void> => {
    await this.end(this.owned(id, owner, clientId));
  };

  revoke = async (principal: string): Promise<void> => {
    this.revoked.add(principal);
    if (this.startingPrincipal === principal) await this.runtime.close();
    if (this.state?.owner.principal === principal) await this.end(this.state);
  };

  connect = (socket: WebSocket, id: string, owner: BusinessContext): void => {
    connectVoiceCall(socket, {
      authenticate: (ticket) => {
        this.tickets.consume(ticket, id, owner.principal);
        return this.owned(id, owner);
      },
      isCurrent: (state) => this.state === state,
      end: this.end,
      disconnected: this.grace,
    });
  };

  close = async (): Promise<void> => {
    this.closed = true;
    if (this.state) await this.end(this.state);
    await this.runtime.close();
  };

  private owned = (id: string, owner: BusinessContext, clientId?: string): WebVoiceCall => {
    const state = this.state;
    if (!state || state.id !== id) throw new HttpError(410, "voice_call_expired");
    if (state.owner.principal !== owner.principal || (clientId && state.clientId !== clientId))
      throw new HttpError(403, "voice_call_owner");
    this.assertAuthorized(owner);
    this.assertAuthorized(state.owner);
    return state;
  };

  private assertAuthorized = (owner: BusinessContext): void => {
    if (this.revoked.has(owner.principal) || (owner.expiresAt && owner.expiresAt <= Date.now()))
      throw new HttpError(401, "device_unauthorized");
  };

  private grace = (state: WebVoiceCall): void => {
    clearTimeout(state.lease);
    state.lease = setTimeout(() => void this.end(state), 30_000);
    state.lease.unref();
  };

  private end = async (state: WebVoiceCall): Promise<void> => {
    if (this.state !== state) return;
    this.state = undefined;
    clearTimeout(state.lease);
    clearTimeout(state.expiry);
    this.tickets.remove(state.id);
    state.unsubscribe();
    state.socket?.close(1000, "voice_call_closed");
    await state.call.close();
  };
}
