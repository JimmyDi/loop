import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import type { ScheduleRunCursor, ScheduleRunPage } from "../../../shared/schedules";
import { api, command } from "../../lib/api";
import { VirtualList } from "../chat/VirtualList";
import type { VirtualRow } from "../chat/VirtualList";
import { ActionButton } from "../ui/ActionButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ScheduleRunRow } from "./ScheduleRunRow";
import { ScheduleRunDelete } from "./ScheduleRunDelete";
import "./ScheduleRunHistory.css";

type RunRow = ScheduleRunPage["runs"][number];
type RunAction = "archive" | "restore" | "delete";

export const ScheduleRunHistory = ({
  viewport,
}: {
  viewport: RefObject<HTMLDivElement | null>;
}) => {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const more = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<RunRow>();
  const change = useMutation({
    mutationFn: ({ run, action }: { run: RunRow; action: RunAction }) =>
      command(
        "/schedules/" +
          run.scheduleId +
          "/runs/" +
          run.id +
          (action === "delete" ? "" : "/" + action),
        undefined,
        action === "delete" ? "DELETE" : "POST",
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["schedule-runs"] });
      setDeleting(undefined);
    },
  });
  const history = useInfiniteQuery({
    queryKey: ["schedule-runs"],
    initialPageParam: null as ScheduleRunCursor | null,
    queryFn: ({ pageParam, signal }) => {
      const after =
        pageParam && [pageParam.scheduledFor, pageParam.scheduleId, pageParam.id].join("/");
      return api<ScheduleRunPage>(
        "/schedules/runs/page" + (after ? "?after=" + encodeURIComponent(after) : ""),
        { signal },
      );
    },
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: 10000,
    retry: false,
  });
  const groups = useMemo(() => {
    const days = new Map<string, RunRow[]>();
    const archived: RunRow[] = [];
    for (const page of history.data?.pages ?? []) {
      for (const run of page.runs) {
        if (run.archived) archived.push(run);
        else {
          const day = new Date(run.scheduledFor).toDateString();
          const entries = days.get(day) ?? [];
          entries.push(run);
          days.set(day, entries);
        }
      }
    }
    if (archived.length) days.set("archived", archived);
    return days;
  }, [history.data]);
  const { fetchNextPage, hasNextPage, isFetching, isFetchNextPageError } = history;
  useEffect(() => {
    const root = viewport.current;
    const target = more.current;
    const Observer = root?.ownerDocument.defaultView?.IntersectionObserver;
    if (!root || !target || !Observer || !hasNextPage || isFetching || isFetchNextPageError) return;
    const observer = new Observer(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void fetchNextPage({ cancelRefetch: false });
        }
      },
      { root, rootMargin: "0px 0px 240px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [viewport, fetchNextPage, hasNextPage, isFetching, isFetchNextPageError]);
  if (history.isPending) return <p role="status">{t("loading")}</p>;

  const dayFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const clock = new Intl.DateTimeFormat(i18n.language, { timeStyle: "short" });
  const today = new Date().toDateString();
  const rows: VirtualRow[] = [];
  for (const [day, runs] of groups) {
    const label =
      day === "archived"
        ? t("scheduleArchivedRuns")
        : day === today
          ? t("scheduleToday")
          : dayFormat.format(runs[0]!.scheduledFor);
    const previous = rows.at(-1);
    const followsRun = previous !== undefined && !previous.key.startsWith("group/");
    rows.push({
      key: "group/" + day,
      render: () => (
        <button
          type="button"
          className="automation-run-group"
          data-follows-run={followsRun}
          aria-expanded={!collapsed[day]}
          onClick={() => setCollapsed((state) => ({ ...state, [day]: !state[day] }))}
        >
          {label}
        </button>
      ),
    });
    if (!collapsed[day])
      for (const run of runs) {
        rows.push({
          key: run.scheduleId + "/" + run.id,
          render: () => (
            <ScheduleRunRow
              run={run}
              busy={change.isPending}
              dayFormat={dayFormat}
              clock={clock}
              archive={() => change.mutate({ run, action: run.archived ? "restore" : "archive" })}
              remove={() => {
                change.reset();
                setDeleting(run);
              }}
            />
          ),
        });
      }
  }
  return (
    <>
      <ErrorNotice error={history.error ?? (deleting ? undefined : change.error)} />
      {!groups.size && !history.error && (
        <div className="automation-empty">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M16 3H6a3 3 0 0 0-3 3v13a3 3 0 0 0 3 3h13a3 3 0 0 0 3-3V8M7 9h5M7 15h11m-4-4 9-9" />
          </svg>
          <p>{t("scheduleEmptyRuns")}</p>
        </div>
      )}
      {!!rows.length && (
        <VirtualList rows={rows} viewport={viewport} estimate={48} overscan={300} />
      )}
      {history.hasNextPage && (
        <ActionButton
          ref={more}
          className="ghost automation-load-older"
          disabled={history.isFetching}
          onClick={() => void fetchNextPage({ cancelRefetch: false })}
        >
          {t(history.isFetchingNextPage ? "loading" : "scheduleLoadOlder")}
        </ActionButton>
      )}
      {deleting && (
        <ScheduleRunDelete
          pending={change.isPending}
          error={change.error}
          close={() => setDeleting(undefined)}
          confirm={() => change.mutate({ run: deleting, action: "delete" })}
        />
      )}
    </>
  );
};
