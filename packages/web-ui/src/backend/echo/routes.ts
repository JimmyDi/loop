import { LoopSandboxProvider } from "@loop/coding-agent";

import type { EchoStore } from "./store";
import type { SessionRegistry } from "../session-registry";
import { echoProvider } from "./bridge";
import { echoConversationView } from "./conversation-view";
import { createEchoConversation } from "./create-conversation";
import { readBody, requiredString } from "../http/input";
import { HttpError } from "../http/errors";

export const echoRoutes =
  (store: EchoStore, registry: SessionRegistry) =>
  async (request: Request, url: URL): Promise<Response | undefined> => {
    const path = url.pathname.slice("/api/echo".length);
    const method = request.method;
    if (path === "" && method === "GET") {
      const data = await store.read();
      return Response.json(await echoConversationView(store, data));
    }
    if (path === "/connection" && method === "PUT") {
      const body = await readBody(request);
      const endpoint = requiredString(body, "endpoint");
      if (body.provider !== "loop-sandbox") throw new HttpError(400, "invalid_provider");
      const idleSeconds = body.idleSeconds ?? 900;
      if (
        typeof idleSeconds !== "number" ||
        !Number.isInteger(idleSeconds) ||
        idleSeconds < 60 ||
        idleSeconds > 86400
      )
        throw new HttpError(400, "invalid_idle_seconds");
      if (typeof body.desktop !== "boolean") throw new HttpError(400, "invalid_desktop");
      const previous = (await store.read()).connection;
      if (body.token !== undefined && (typeof body.token !== "string" || body.token.length > 8192))
        throw new HttpError(400, "invalid_token");
      const token = typeof body.token === "string" ? body.token : await store.token();
      if (previous && previous.endpoint !== endpoint && body.token === undefined)
        throw new HttpError(400, "reenter_connection_token");
      new LoopSandboxProvider(endpoint, token);
      await registry.configure(async () => {
        for (const chat of (await store.read()).conversations) await registry.unload(chat.id);
        await store.saveToken(token);
        await store.mutate((data) => {
          if (previous && previous.endpoint !== endpoint)
            for (const chat of data.conversations) delete chat.computerId;
          data.connection = {
            provider: "loop-sandbox",
            endpoint,
            idleSeconds,
            desktop: body.desktop as boolean,
            tokenSaved: !!token,
          };
        });
      });
      return Response.json((await store.read()).connection);
    }
    if (path === "/agents" && method === "POST") {
      const body = await readBody(request);
      const name = requiredString(body, "name").trim();
      if (
        name.length > 80 ||
        typeof body.instructions !== "string" ||
        body.instructions.length > 16000
      )
        throw new HttpError(400, "invalid_agent");
      if (
        body.avatar !== undefined &&
        (typeof body.avatar !== "string" ||
          !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.avatar) ||
          body.avatar.length > 350_000)
      )
        throw new HttpError(400, "invalid_avatar");
      const agent = {
        id: crypto.randomUUID(),
        name,
        instructions: body.instructions,
        ...(body.avatar ? { avatar: body.avatar as string } : {}),
      };
      await store.mutate((data) => {
        data.agents.push(agent);
      });
      return Response.json(agent, { status: 201 });
    }
    if (path === "/conversations" && method === "POST") {
      return Response.json(await createEchoConversation(store, await readBody(request)), {
        status: 201,
      });
    }
    const chatMatch = path.match(/^\/conversations\/([^/]+)$/);
    if (chatMatch && method === "PUT") {
      const body = await readBody(request);
      await registry.configure(async () => {
        await registry.unload(chatMatch[1]!);
        await store.mutate(async (data) => {
          const chat = data.conversations.find((row) => row.id === chatMatch[1]);
          if (!chat) throw new HttpError(404, "echo_conversation_not_found");
          if (body.agentIds !== undefined) {
            if (chat.agentIds.length === 1)
              throw new HttpError(409, "private_conversation_members_fixed");
            if (
              !Array.isArray(body.agentIds) ||
              body.agentIds.length < 2 ||
              body.agentIds.length > 16 ||
              body.agentIds.some((id) => !data.agents.some((agent) => agent.id === id))
            )
              throw new HttpError(400, "invalid_members");
            chat.agentIds = [...new Set(body.agentIds as string[])];
          }
          const responder = body.responderId ?? chat.responderId;
          if (typeof responder !== "string" || !chat.agentIds.includes(responder))
            throw new HttpError(400, "invalid_responder");
          chat.responderId = responder;
          if (body.computerId !== undefined) {
            if (typeof body.computerId !== "string" || !/^[a-f0-9]{32}$/.test(body.computerId))
              throw new HttpError(400, "invalid_computer");
            const client = new LoopSandboxProvider(
              data.connection?.endpoint ?? "",
              await store.token(),
            );
            await client.bind(body.computerId, chat.id);
            chat.computerId = body.computerId;
          }
        });
      });
      return Response.json(
        (await store.read()).conversations.find((chat) => chat.id === chatMatch[1]),
      );
    }
    if (path === "/computers" && method === "GET")
      return Response.json(await (await echoProvider(store)).list(request.signal));
    if (path === "/computers" && method === "POST") {
      const body = await readBody(request);
      const requestId = requiredString(body, "requestId");
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) throw new HttpError(400, "invalid_requestId");
      const connection = (await store.read()).connection!;
      if (!connection) throw new HttpError(409, "echo_connection_required");
      return Response.json(
        await (await echoProvider(store)).create(
          requestId,
          connection.desktop,
          connection.idleSeconds,
        ),
        { status: 201 },
      );
    }
    const computer = path.match(/^\/computers\/([a-f0-9]{32})$/);
    if (computer && method === "DELETE") {
      const computerId = computer[1]!;
      await registry.configure(async () => {
        const bound = (await store.read()).conversations.filter(
          (chat) => chat.computerId === computerId,
        );
        for (const chat of bound) await registry.unload(chat.id);
        await (await echoProvider(store)).destroy(computerId);
        await store.mutate((data) => {
          for (const chat of data.conversations)
            if (chat.computerId === computerId) delete chat.computerId;
        });
      });
      return Response.json({ sandbox_id: computerId, state: "destroyed" });
    }
    const power = path.match(/^\/computers\/([a-f0-9]{32})\/(start|stop|rebuild)$/);
    const preview = path.match(/^\/computers\/([a-f0-9]{32})\/preview$/);
    if (preview && method === "GET") {
      const response = await (await echoProvider(store)).preview(preview[1]!, request.signal);
      return new Response(response.body, {
        headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    }
    if (power && method === "POST")
      return Response.json(
        await (await echoProvider(store)).power(
          power[1]!,
          power[2] as "start" | "stop" | "rebuild",
        ),
      );
    return Response.json({ code: "not_found" }, { status: 404 });
  };
