import { nextOccurrence, ScheduleInputError, ScheduleUnavailableError } from "@loop/coding-agent";
import type { ScheduleInput, ScheduleService } from "@loop/coding-agent";
import type { SessionRegistry } from "../session-registry";
import { readBody } from "../http/input";
import { HttpError } from "../http/errors";

export const scheduleRoutes =
  (service: ScheduleService, registry: SessionRegistry) => async (request: Request, url: URL) => {
    const match =
      /^\/api\/schedules(?:\/([a-f0-9-]{36})(?:\/(runs|pause|resume|run|cancel))?)?$/.exec(
        url.pathname,
      );
    try {
      if (url.pathname === "/api/schedules/preview" && request.method === "POST") {
        const body = await readBody(request);
        const times: number[] = [];
        let cursor = Date.now();
        const limit = body.limit === 4 ? 4 : 3;
        while (times.length < limit) {
          const next = nextOccurrence(body.trigger as ScheduleInput["trigger"], cursor);
          if (next === null) break;
          times.push(next);
          cursor = next;
        }
        return Response.json(times);
      }
      if (url.pathname === "/api/schedules/runs" && request.method === "GET")
        return Response.json(await service.history());
      if (url.pathname === "/api/schedules/runs/page" && request.method === "GET") {
        const limit = Number(url.searchParams.get("limit") ?? 50);
        const after = url.searchParams.get("after");
        if (after === null) return Response.json(await service.historyPage(limit));
        const match = /^(-?\d{1,16})\/([a-z0-9-]{1,90})\/([a-z0-9-]{1,90})$/i.exec(after);
        if (!match || !Number.isSafeInteger(Number(match[1])))
          throw new ScheduleInputError("Invalid run history cursor");
        const [, scheduledFor, scheduleId, id] = match;
        return Response.json(
          await service.historyPage(limit, {
            scheduledFor: Number(scheduledFor),
            scheduleId: scheduleId!,
            id: id!,
          }),
        );
      }
      const runAction =
        /^\/api\/schedules\/([a-f0-9-]{36})\/runs\/([a-z0-9-]{1,90})(?:\/(archive|restore))?$/i.exec(
          url.pathname,
        );
      if (runAction) {
        const [, scheduleId, runId, action] = runAction;
        if (request.method === "DELETE" && !action) {
          await service.changeRun(scheduleId!, runId!, "delete");
          return new Response(null, { status: 204 });
        }
        if (request.method === "POST" && (action === "archive" || action === "restore")) {
          await service.changeRun(scheduleId!, runId!, action);
          return new Response(null, { status: 204 });
        }
      }
      const runMatch = /^\/api\/schedules\/([a-f0-9-]{36})\/runs\/(manual-[a-f0-9-]{36})$/.exec(
        url.pathname,
      );
      if (request.method === "GET" && runMatch) {
        const run = await service.findRun(runMatch[1]!, runMatch[2]!);
        return Response.json(run ? { status: run.status, sessionId: run.sessionId } : null);
      }
      if (!match) return;
      const [, id, action] = match;
      if (request.method === "GET" && !id) return Response.json(service.list());
      if (request.method === "GET" && id && action === "runs")
        return Response.json(await service.history(id));
      if ((!id && request.method === "POST") || (id && !action && request.method === "PUT")) {
        const body = await readBody(request);
        if (typeof body.projectId !== "string") throw new ScheduleInputError("Project required");
        const project = await registry.projects.get(body.projectId);
        if (!project.accessible) throw new ScheduleInputError("Project unavailable");
        return Response.json(await service.put(body as ScheduleInput, id));
      }
      if (id && request.method === "DELETE" && !action) await service.change(id, "delete");
      else if (
        id &&
        request.method === "POST" &&
        (action === "pause" || action === "resume" || action === "cancel")
      )
        await service.change(id, action);
      else if (id && request.method === "POST" && action === "run") {
        const body = await readBody(request);
        return Response.json(
          await service.change(
            id,
            "run",
            typeof body.requestId === "string" ? body.requestId : undefined,
          ),
        );
      } else throw new HttpError(405, "method_not_allowed");
      return new Response(null, { status: 204 });
    } catch (error) {
      if (error instanceof ScheduleInputError)
        throw new HttpError(400, "invalid_schedule", error.message);
      if (error instanceof ScheduleUnavailableError)
        throw new HttpError(409, "scheduler_unavailable", error.message);
      throw error;
    }
  };
