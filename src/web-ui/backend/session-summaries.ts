import type { SessionSummary } from "../shared/protocol";
import type { SessionController } from "./session-controller";

export const sessionSummaries = (
  records: SessionSummary[],
  instances: Iterable<SessionController>,
  workspaceId: string,
): SessionSummary[] => {
  const summaries = new Map(
    records.map((record) => [
      record.id,
      { ...record, isGenerating: false, isWaitingForApproval: false },
    ]),
  );
  for (const controller of instances) {
    if (controller.workspaceId !== workspaceId) continue;
    const { sessionId, state, operation } = controller.snapshot;
    const record = summaries.get(sessionId);
    const users = state.messages.filter((message) => message.role === "user");
    if (!record && !users.length) continue;
    const last = users.at(-1);
    summaries.set(sessionId, {
      id: sessionId,
      workspaceId,
      createdAt: record?.createdAt ?? controller.createdAt,
      updatedAt: record?.updatedAt ?? controller.createdAt,
      ...record,
      ...(last
        ? {
            updatedAt: new Date(
              Math.max(last.timestamp, Date.parse(record?.updatedAt ?? controller.createdAt)),
            ).toISOString(),
          }
        : {}),
      messageCount: state.messages.length,
      userMessageCount: users.length,
      unread: state.unread ?? false,
      pinnedAt: controller.session.sessionManager.getHeader().pinnedAt,
      title: state.title?.text ?? record?.title,
      isGenerating: operation === "prompt",
      isWaitingForApproval:
        state.pendingApprovals?.some((request) => request.sessionId === sessionId) ?? false,
    });
  }
  return [...summaries.values()].sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
  );
};
