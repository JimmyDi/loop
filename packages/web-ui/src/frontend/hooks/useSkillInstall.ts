import { useEffect, useRef, useState } from "react";

import type { SkillJob, SkillPreviewInput, SkillScope } from "../../shared/skills";
import type { useSkills } from "./useSkills";

export const useSkillInstall = (api: ReturnType<typeof useSkills>, initial?: SkillJob) => {
  const [job, setJob] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const active = useRef(initial?.id);
  const generation = useRef(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  useEffect(
    () => () => {
      generation.current++;
      if (active.current) void apiRef.current.cancel(active.current).catch(() => {});
    },
    [],
  );
  useEffect(() => {
    if (!job || job.status !== "running" || job.stage === "installing") return;
    let disposed = false;
    const timer = setInterval(() => {
      void apiRef.current.job(job.id).then(
        (next) => {
          if (!disposed) setJob(next);
        },
        (error) => {
          if (!disposed) setError(error);
        },
      );
    }, 700);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [job?.id, job?.status]);
  return {
    job,
    pending,
    error,
    preview: async (input: SkillPreviewInput, updateId?: string) => {
      const current = ++generation.current;
      setPending(true);
      setError(undefined);
      try {
        if (active.current) await api.cancel(active.current).catch(() => {});
        const next = updateId ? await api.update(updateId) : await api.preview(input);
        if (current !== generation.current) {
          await api.cancel(next.id).catch(() => {});
          return;
        }
        active.current = next.id;
        setJob(next);
      } catch (error) {
        if (current === generation.current) setError(error);
      } finally {
        if (current === generation.current) setPending(false);
      }
    },
    install: async (keys: string[], scope: SkillScope, updateId?: string) => {
      if (!job) return false;
      const current = generation.current;
      setPending(true);
      setError(undefined);
      setJob({ ...job, stage: "installing", status: "running" });
      try {
        await api.install(job.id, keys, scope, updateId);
        active.current = undefined;
        return current === generation.current;
      } catch (error) {
        if (current === generation.current) {
          setError(error);
          setJob({ ...job, status: "error" });
        }
        return false;
      } finally {
        if (current === generation.current) setPending(false);
      }
    },
    cancel: async () => {
      generation.current++;
      if (active.current) await api.cancel(active.current).catch(() => {});
      active.current = undefined;
    },
  };
};
