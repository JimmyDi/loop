import type { AgentSession } from "../../core/agent-session";
import type { ApprovalRequest } from "../../core/approvals/types";

const describe = (request: ApprovalRequest): string => {
  const operation = request.operation;
  return JSON.stringify(
    {
      sessionId: request.sessionId,
      tool: request.toolName,
      reason: request.reason,
      ...(request.expiresAt === null
        ? {}
        : { expiresAt: new Date(request.expiresAt).toISOString() }),
      scope:
        operation?.kind === "shell-unrestricted"
          ? "One command and descendants; host filesystem, network and environment; no sandbox"
          : operation?.kind === "file-write"
            ? "One exact file replacement and required parent directories"
            : "No managed execution scope supplied",
      operation,
    },
    null,
    2,
  );
};

/** Decisions require the exact live request ID; arbitrary input never approves. */
export class InteractiveApprovals {
  private detach = () => {};
  private unsubscribe = () => {};
  private session?: AgentSession;

  constructor(
    private readonly write: (text: string) => void,
    private readonly interactive: boolean,
  ) {}

  bind(session: AgentSession): void {
    this.dispose();
    this.session = session;
    if (!this.interactive) return;
    this.unsubscribe = session.subscribe((event) => {
      if (event.type === "approval_resolved")
        this.write(`Approval ${event.result.request.requestId}: ${event.result.outcome}`);
    });
    this.detach = session.registerApprovalHandler((request) => {
      this.write(
        `Approval required\n${describe(request)}\n/approve ${request.requestId}\n/reject ${request.requestId}`,
      );
    });
  }

  handle(text: string): boolean {
    if (!/^\/(approve|reject)(?:\s|$)/.test(text)) return false;
    const match = /^\/(approve|reject) ([^\s]+)$/.exec(text);
    if (!match) throw new Error("Use /approve REQUEST_ID or /reject REQUEST_ID");
    if (
      !this.interactive ||
      !this.session?.respondToApproval({
        sessionId: this.session.sessionId,
        requestId: match[2]!,
        decision: match[1] === "approve" ? "allowed-once" : "rejected",
      })
    )
      throw new Error("Approval is no longer pending in this session");
    return true;
  }

  dispose(): void {
    this.detach();
    this.unsubscribe();
    this.detach = () => {};
    this.unsubscribe = () => {};
    this.session = undefined;
  }
}
