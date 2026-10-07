import { expect, test, vi } from "vitest";
import { Window } from "happy-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { SkillSummary } from "../../shared/skills";
import { useInstalledSkills } from "./useInstalledSkills";

test("Installed aggregates unique sources while exposing partial discovery failures", async () => {
  const window = new Window();
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    fetch: globalThis.fetch,
  };
  Object.assign(globalThis, { window, document: window.document });
  const { renderHook, cleanup, act, waitFor } = await import("@testing-library/react/pure");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const personal: SkillSummary = {
    id: "a".repeat(24),
    name: "same-name",
    handle: "personal",
    description: "Review source",
    path: "skills/personal/SKILL.md",
    enabled: true,
    managed: false,
    modelInvocable: true,
    scope: "personal",
    source: { kind: "discovered" },
  };
  const shared: SkillSummary = {
    ...personal,
    id: "b".repeat(24),
    handle: "project",
    scope: "project",
  };
  const projects = [
    { id: "one", name: "Example", cwd: "fixtures/example" },
    { id: "two", name: "Nested", cwd: "fixtures/example/nested" },
    { id: "failed", name: "Unavailable", cwd: "fixtures/unavailable" },
  ];
  client.setQueryData(["skills", "personal"], { skills: [personal], discovering: false });
  client.setQueryData(["skills", "one"], { skills: [personal, shared], discovering: false });
  client.setQueryData(["skills", "two"], { skills: [personal, shared], discovering: true });
  globalThis.fetch = vi.fn(async () =>
    Response.json({ message: "Cannot discover skills" }, { status: 500 }),
  );
  try {
    const { result } = renderHook(() => useInstalledSkills(projects), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries.find((entry) => entry.skill.id === shared.id)?.workspaceId).toBe(
      "one",
    );
    expect(
      result.current.entries.find((entry) => entry.skill.id === personal.id)?.workspaceId,
    ).toBeUndefined();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.error).toBeTruthy());
    await act(async () =>
      client.setQueryData(["skills", "two"], { skills: [personal, shared], discovering: false }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.entries).toHaveLength(2);
  } finally {
    await act(async () => {
      cleanup();
      client.clear();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
