import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { McpServerView } from "../../../shared/mcp";
import { i18n } from "../../i18n/setup";
import { McpSetupStatus } from "./McpSetupStatus";

test("setup status distinguishes checking, ready and failure without losing saved state", async () => {
  const language = i18n.language;
  const server: McpServerView = {
    id: "example",
    name: "Example",
    enabled: true,
    transport: "stdio",
    command: "node",
    args: [],
    env: [],
    envVars: [],
    cwd: "",
    status: "connecting",
    toolCount: 0,
  };
  try {
    await i18n.changeLanguage("en");
    const saving = renderToStaticMarkup(<McpSetupStatus saving />);
    expect(saving).toContain("Please wait a moment.");
    expect(saving).toContain("mcp-setup-spinner");
    expect(saving).not.toContain("Configuration saved");
    const pending = renderToStaticMarkup(<McpSetupStatus server={server} />);
    expect(pending).toContain("mcp-setup-spinner");
    expect(pending).toContain("Please wait a moment.");
    expect(pending).not.toContain("download");
    const queued = renderToStaticMarkup(
      <McpSetupStatus server={{ ...server, status: "queued" }} />,
    );
    expect(queued).toContain("Waiting for a connection slot");
    const refreshing = renderToStaticMarkup(
      <McpSetupStatus server={{ ...server, status: "refreshing" }} />,
    );
    expect(refreshing).toContain("Refreshing tools");
    expect(refreshing).not.toContain("2 minutes");
    const ready = renderToStaticMarkup(
      <McpSetupStatus server={{ ...server, status: "ready", toolCount: 2 }} />,
    );
    expect(ready).toContain("Connected · 2 tools");
    expect(ready).not.toContain("mcp-setup-spinner");
    const failed = renderToStaticMarkup(
      <McpSetupStatus server={{ ...server, status: "error", error: "connection_timeout" }} />,
    );
    expect(failed).toContain("timed out");
    expect(failed).toContain("Configuration saved");
    await i18n.changeLanguage("zh");
    expect(renderToStaticMarkup(<McpSetupStatus server={server} />)).toContain("请稍候。");
  } finally {
    await i18n.changeLanguage(language);
  }
});
