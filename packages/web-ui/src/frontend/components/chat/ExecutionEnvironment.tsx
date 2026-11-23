import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { SessionSnapshot } from "../../../shared/protocol";
import { useAsyncAction } from "../../hooks/useAsyncAction";
import { api } from "../../lib/api";
import { createProjectDraft } from "../../lib/create-project-draft";
import { useWorkspace } from "../../state/workspace-store";
import { ErrorNotice } from "../ui/ErrorNotice";
import "./ExecutionEnvironment.css";

export const ExecutionEnvironment = ({
  snapshot,
  editable,
}: {
  snapshot: SessionSnapshot;
  editable: boolean;
}) => {
  const client = useQueryClient();
  const action = useAsyncAction();
  const configuration = useQuery({
    queryKey: ["execution-environments"],
    queryFn: () =>
      api<{
        sandboxAvailable: boolean;
        servers?: Array<{ id: string; name: string; status: string }>;
      }>("/execution-environments"),
    enabled: editable,
    retry: false,
    refetchInterval: 3000,
  });
  const mode = snapshot.state.execution ?? "local";
  const selected = snapshot.state.sandboxServerId ? "mcp:" + snapshot.state.sandboxServerId : mode;
  const label = snapshot.state.sandboxLabel ?? "Loop Sandbox";
  return (
    <div className="execution-environment">
      {editable ? (
        <label>
          <span className="sr-only">Execution environment</span>
          <select
            aria-label="Execution environment"
            value={selected}
            disabled={action.pending || configuration.isPending}
            onChange={(event) => {
              const execution = event.target.value;
              void action.run(async () => {
                const next = await createProjectDraft(snapshot.workspaceId, snapshot, execution);
                client.setQueryData(["session", next.sessionId], next);
                if (useWorkspace.getState().active?.id !== snapshot.sessionId) return;
                const target = { id: next.sessionId, workspaceId: next.workspaceId };
                useWorkspace.getState().moveDraft(snapshot.sessionId, target);
                useWorkspace.getState().open(target);
              });
            }}
          >
            <option value="local">Local</option>
            <option value="sandbox" disabled={!configuration.data?.sandboxAvailable}>
              Loop Sandbox
            </option>
            {configuration.data?.servers?.map((server) => (
              <option key={server.id} value={"mcp:" + server.id}>
                {server.name} · MCP
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span>{mode === "sandbox" ? label : "Local"}</span>
      )}
      {mode === "sandbox" && (
        <span className="execution-environment-detail">
          {snapshot.state.sandbox
            ? "Generation " + snapshot.state.sandbox.generation
            : snapshot.state.sandboxServerId
              ? "MCP execution provider"
              : "Created on first tool call"}
          {snapshot.state.sandbox && snapshot.state.sandbox.generation > 1
            ? " · Recreated; previous files discarded"
            : snapshot.state.sandboxServerId
              ? ""
              : " · Disposable workspace"}
        </span>
      )}
      {editable && mode === "sandbox" && (
        <span className="execution-environment-detail">
          Only the selected provider tools are enabled. Local project files are not uploaded.
        </span>
      )}
      <ErrorNotice error={action.error ?? configuration.error} />
    </div>
  );
};
