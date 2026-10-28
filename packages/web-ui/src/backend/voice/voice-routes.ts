import type { VoiceStatus } from "../../shared/voice";
import type { BusinessContext } from "../http/business-context";
import { localContext } from "../http/business-context";
import { HttpError } from "../http/errors";
import { readBody, requiredString } from "../http/input";
import type { VoiceService } from "./voice-service";

export const voiceRoutes = (voice: VoiceService) => {
  let installing: AbortController | undefined;
  const status = async (context: BusinessContext): Promise<VoiceStatus> => {
    const value = await voice.resources.status();
    return {
      ...value,
      localManagement: !context.remote,
      directory: context.remote ? undefined : value.directory,
    };
  };
  const route = async (
    request: Request,
    url: URL,
    context = localContext,
  ): Promise<Response | undefined> => {
    if (!url.pathname.startsWith("/api/voice/")) return;
    if (url.pathname === "/api/voice/status" && request.method === "GET")
      return Response.json(await status(context));
    if (request.method !== "POST") throw new HttpError(405, "method_not_allowed");
    if (!context.remote && request.headers.get("origin") !== (context.origin ?? url.origin))
      throw new HttpError(403, "invalid_origin");
    const body = await readBody(request, 4_096);
    if (url.pathname === "/api/voice/install") {
      if (context.remote) throw new HttpError(403, "local_only");
      if (
        !["install", "update", "cancel", "uninstall"].includes(String(body.action)) ||
        !["input", "conversation"].includes(String(body.profile))
      )
        throw new HttpError(400, "invalid_voice_command");
      if (body.action === "cancel") installing?.abort();
      else {
        if (installing) throw new HttpError(409, "voice_install_busy");
        const abort = new AbortController();
        installing = abort;
        const work = Promise.resolve().then(async () => {
          await (body.action === "uninstall"
            ? voice.resources.uninstall()
            : body.action === "update"
              ? voice.resources.update({ tts: body.profile === "conversation" }, abort.signal)
              : voice.resources.install({ tts: body.profile === "conversation" }, abort.signal));
        });
        void work
          .catch(() => {})
          .finally(() => {
            if (installing === abort) installing = undefined;
          });
      }
      return Response.json(await status(context), { status: 202 });
    }
    const clientId = requiredString(body, "clientId");
    if (!/^[a-f0-9-]{36}$/.test(clientId)) throw new HttpError(400, "invalid_clientId");
    if (url.pathname === "/api/voice/calls") {
      if (body.mode !== "dictation" && body.mode !== "conversation" && body.mode !== "test")
        throw new HttpError(400, "invalid_voice_mode");
      const sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
      if (body.synthesis !== undefined && typeof body.synthesis !== "boolean")
        throw new HttpError(400, "invalid_voice_synthesis");
      return Response.json(
        await voice.start(context, clientId, body.mode, sessionId, request.signal, body.synthesis),
        {
          status: 201,
        },
      );
    }
    const match = /^\/api\/voice\/calls\/([a-f0-9-]{36})\/(connect|close)$/.exec(url.pathname);
    if (!match) throw new HttpError(404, "not_found");
    if (match[2] === "connect") return Response.json(voice.reconnect(match[1]!, context, clientId));
    await voice.stop(match[1]!, context, clientId);
    return new Response(null, { status: 204 });
  };
  return { route, close: () => installing?.abort() };
};
