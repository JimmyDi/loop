import { ScheduleService } from "@loop/coding-agent";
import type { ScheduleHost } from "@loop/coding-agent";
import { createSchedulePeer } from "./schedule-peer";
import { watchScheduleChanges } from "./schedule-change-notifications";
import { watchScheduleSessions } from "./schedule-session-notifications";
import { scheduleRoutes } from "./routes/schedules";
import { createScheduledChatCache } from "./scheduled-chat-cache";
import { scheduledChatRoute } from "./scheduled-chat-route";
import type { SessionController } from "./session-controller";
import type { SessionSummary } from "../shared/protocol";
import type { SessionRegistry } from "./session-registry";

export const createSchedules = (
  agentDir: string,
  registry: SessionRegistry,
  admitting = () => true,
) => {
  const peer = createSchedulePeer(agentDir);
  const liveSummary = createScheduledChatCache(async () => {
    const request = new Request("http://localhost/live/api/sessions");
    try {
      const response = await peer.forward(request, "/live/api/sessions", 1500);
      return response.ok ? ((await response.json()) as SessionSummary | null) : null;
    } catch {
      return null;
    }
  });
  const notifications = new AbortController();
  const scheduleChanges = new AbortController();
  let watchingChanges: Promise<void> | undefined;
  let watching: Promise<void> | undefined;
  let liveChat: { item: SessionController; stream: AbortController } | undefined;
  const host: ScheduleHost = {
    onOwner: () => {
      notifications.abort();
      return peer.listen(async (request) => {
        if (!admitting()) return Response.json({ code: "server_updating" }, { status: 503 });
        const url = new URL(request.url);
        return (
          scheduledChatRoute(request, url, liveChat) ??
          (await localRoute(request, url)) ??
          new Response(null, { status: 404 })
        );
      });
    },
    available: (projectId) =>
      admitting() &&
      ![...registry.activeSessions()].some((item) => item.workspaceId === projectId && item.busy),
    execute: async (run, attach, signal) => {
      signal.throwIfAborted();
      const project = await registry.project(run.input.projectId);
      if (!project.accessible) throw new Error("Scheduled project is unavailable");
      const item = await registry.create(project.id, run.input.permission);

      // SessionController owns the event stream and the existing interactive approval handlers.
      const abort = () => {
        void item.abort().catch(() => {});
      };
      const stream = new AbortController();
      liveChat = { item, stream };
      try {
        await attach(item.session.sessionId);
        signal.throwIfAborted();
        signal.addEventListener("abort", abort, { once: true });
        item.prompt(run.id, run.input.prompt);
        await item.waitForCompletion();
        if (item.session.state.hasPendingSave) {
          try {
            await item.session.flush();
          } catch {
            return "save-pending";
          }
        }
        if (signal.aborted || item.session.state.outcome === "cancelled") return "cancelled";
        if (item.session.state.outcome !== "success" || item.snapshot.commandError)
          throw new Error(
            item.snapshot.commandError ?? item.session.state.error ?? "Scheduled prompt failed",
          );
        return "completed";
      } finally {
        liveChat = undefined;
        stream.abort();
        signal.removeEventListener("abort", abort);
      }
    },
  };
  const service = new ScheduleService(agentDir, host);
  const startService = service.start.bind(service);
  const closeService = service.close.bind(service);
  const start = async () => {
    await startService();
    watchingChanges ??= watchScheduleChanges(
      agentDir,
      registry.events,
      scheduleChanges.signal,
      () => !service.owner,
      liveSummary.invalidate,
    );
    await watchingChanges;
    if (!service.owner && !service.error) {
      watching ??= watchScheduleSessions(agentDir, registry, notifications.signal);
      await watching;
    }
  };
  const close = async () => {
    notifications.abort();
    scheduleChanges.abort();
    await closeService();
  };
  const localRoute = scheduleRoutes(service, registry);
  const forwardLive = (request: Request, url: URL) =>
    peer.forward(request, "/live" + url.pathname + url.search, 1500).catch(() => undefined);
  const route = async (request: Request, url: URL) => {
    if (!service.owner && !service.error && request.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (
        url.pathname === "/api/sessions" &&
        workspaceId &&
        url.searchParams.get("scope") !== "global" &&
        url.searchParams.get("archived") !== "true"
      ) {
        const [live, sessions] = await Promise.all([liveSummary.get(), registry.list(workspaceId)]);
        const rows = sessions.filter((row) => !row.archived && row.userMessageCount > 0);
        if (
          live?.workspaceId === workspaceId &&
          !sessions.some((row) => row.id === live.id && row.archived)
        ) {
          const existing = rows.findIndex((row) => row.id === live.id);
          if (existing < 0) rows.unshift(live);
          else rows[existing] = { ...live, pinnedAt: rows[existing]?.pinnedAt ?? live.pinnedAt };
        }
        return Response.json(rows);
      }
      const chat = /^\/api\/sessions\/([a-f0-9-]{36})(?:\/(events|history))?$/.exec(url.pathname);
      if (chat && (await liveSummary.get())?.id === chat[1]) {
        const response = await forwardLive(request, url);
        if (response?.ok || response?.status === 409) return response;
        liveSummary.invalidate();
      }
    }
    if (url.pathname !== "/api/schedules" && !url.pathname.startsWith("/api/schedules/")) return;
    if (!service.owner && !service.error) await service.start();
    if (service.owner || service.error) return localRoute(request, url);
    return peer.forward(request, url.pathname + url.search);
  };
  return Object.assign(service, { start, close, route });
};
