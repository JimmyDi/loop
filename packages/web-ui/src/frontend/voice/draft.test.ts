import { expect, test } from "vitest";

import { useRequests } from "../state/request-store";
import { useWorkspace } from "../state/workspace-store";
import { preserveRejectedVoice } from "./draft";

test("rejected voice preserves an existing draft while uncertain delivery retains its original request only", () => {
  const workspace = useWorkspace.getState();
  const requests = useRequests.getState();
  try {
    useWorkspace.setState({ drafts: { voice: "Existing" } });
    useRequests.setState({ pending: {}, delivery: {} });
    preserveRejectedVoice("voice", "Rejected sentence", "rejected");
    expect(useWorkspace.getState().drafts.voice).toBe("Existing Rejected sentence");
    useRequests.getState().put("voice", {
      requestId: "request",
      streamId: "stream",
      text: "Unconfirmed",
      preserveDraft: true,
    });
    preserveRejectedVoice("voice", "Unconfirmed", "uncertain");
    expect(useWorkspace.getState().drafts.voice).toBe("Existing Rejected sentence");
    expect(useRequests.getState().pending.voice?.requestId).toBe("request");
    preserveRejectedVoice("voice", "Rejected while another request is pending", "rejected");
    expect(useWorkspace.getState().drafts.voice).toContain(
      "Rejected while another request is pending",
    );
    preserveRejectedVoice("voice", "Already accepted", "accepted");
    expect(useWorkspace.getState().drafts.voice).not.toContain("Already accepted");
  } finally {
    useWorkspace.setState(workspace, true);
    useRequests.setState(requests, true);
  }
});
