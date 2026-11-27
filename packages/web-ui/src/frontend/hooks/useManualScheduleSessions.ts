import {
  queryOptions,
  skipToken,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";

import type { Schedule, ScheduleRun } from "../../shared/schedules";
import { api, command } from "../lib/api";
import { useWorkspace } from "../state/workspace-store";
import { projectSessionsQueryOptions } from "./useProjectSessions";

export type PendingScheduleSession = {
  requestId: string;
  name: string;
  projectId: string;
  scheduleId: string;
  runId?: string;
  sessionId?: string;
  status?: ScheduleRun["status"];
};

const noSubmissions: PendingScheduleSession[] = [];
const submissionsKey = ["manual-schedule-submissions"] as const;

const remove = (client: QueryClient, requestId: string) =>
  client.setQueryData<PendingScheduleSession[]>(submissionsKey, (items) =>
    items?.filter((item) => item.requestId !== requestId),
  );

export const submitScheduleRun = async (client: QueryClient, plan: Schedule) => {
  const requestId = crypto.randomUUID();
  const { name, projectId } = plan;
  client.setQueryData<PendingScheduleSession[]>(submissionsKey, (items = []) => [
    { requestId, projectId, name, scheduleId: plan.id },
    ...items,
  ]);
  useWorkspace.getState().expand(projectId, true);
  try {
    const run = await command<ScheduleRun>("/schedules/" + plan.id + "/run", { requestId });
    client.setQueryData<PendingScheduleSession[]>(submissionsKey, (items) =>
      items?.map((item) =>
        item.requestId === requestId
          ? { ...item, runId: run.id, status: run.status, sessionId: run.sessionId }
          : item,
      ),
    );
  } catch (error) {
    remove(client, requestId);
    throw error;
  }
};

type RunProgress = Pick<ScheduleRun, "status" | "sessionId">;

type RunCheck = { progress: RunProgress | null; settled: boolean };

const runCheckQuery = (client: QueryClient, item: PendingScheduleSession & { runId: string }) => {
  const queryKey = ["schedule-run-progress", item.scheduleId, item.runId];
  return queryOptions({
    queryKey,
    queryFn: async ({ signal }): Promise<RunCheck> => {
      const previous = client.getQueryData<RunCheck>(queryKey)?.progress;
      const progress = await api<RunProgress | null>(
        "/schedules/" + item.scheduleId + "/runs/" + item.runId,
        { signal },
      );
      const finished = progress?.status !== "queued" && progress?.status !== "running";
      if (!progress?.sessionId) return { progress, settled: finished };

      const sessionsQuery = projectSessionsQueryOptions(item.projectId);
      const containsSession = (sessions = client.getQueryData(sessionsQuery.queryKey)) =>
        sessions?.some((session) => session.id === progress.sessionId) ?? false;
      if (containsSession()) return { progress, settled: true };

      // Between attachment and completion, the existing session events handle list refreshes.
      if (!previous?.sessionId || finished) {
        const sessions = await client.fetchQuery({ ...sessionsQuery, staleTime: 0, retry: false });
        return { progress, settled: finished || containsSession(sessions) };
      }
      return { progress, settled: false };
    },
    refetchInterval: (query) => (query.state.data?.settled ? false : 1000),
    retry: false,
  });
};

export const useManualScheduleSessions = () => {
  const { data: submissions = noSubmissions } = useQuery<PendingScheduleSession[]>({
    queryKey: submissionsKey,
    queryFn: skipToken,
    gcTime: Infinity,
  });
  const client = useQueryClient();
  const tracking = submissions.filter(
    (item): item is typeof item & { runId: string } => !!item.runId,
  );
  const checks = useQueries({ queries: tracking.map((item) => runCheckQuery(client, item)) });
  const settled = new Set(
    tracking.filter((_, index) => checks[index]?.data?.settled).map((item) => item.requestId),
  );
  useEffect(() => {
    if (!settled.size) return;
    client.setQueryData<PendingScheduleSession[]>(submissionsKey, (items) =>
      items?.filter((item) => !settled.has(item.requestId)),
    );
  }, [client, settled]);
  const progressByRequest = new Map(
    tracking.map((item, index) => [item.requestId, checks[index]?.data?.progress]),
  );
  return submissions.flatMap((item) => {
    if (settled.has(item.requestId)) return [];
    const progress = progressByRequest.get(item.requestId);
    return [progress ? { ...item, ...progress } : item];
  });
};
