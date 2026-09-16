import { useState } from "react";
import { Composer } from "./composer/Composer";
import { ConversationPanel } from "./conversation/ConversationPanel";
import { MobileSidebarBackdrop } from "./layout/MobileSidebarBackdrop";
import { TopBar } from "./layout/TopBar";
import { Sidebar } from "./navigation/Sidebar";
import type { Message } from "./types";

type AppShellProps = {
  messages: Message[];
  status: string;
  onRun: (prompt: string) => Promise<void>;
};

export function AppShell({ messages, status, onRun }: AppShellProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const closeNavigation = () => setNavigationOpen(false);

  return (
    <div id="app-shell">
      <MobileSidebarBackdrop open={navigationOpen} onClose={closeNavigation} />
      <Sidebar open={navigationOpen} status={status} onClose={closeNavigation} />
      <main className="workspace">
        <TopBar onOpenNavigation={() => setNavigationOpen(true)} />
        <ConversationPanel messages={messages} />
        <Composer disabled={status === "Running…"} onRun={onRun} />
      </main>
    </div>
  );
}
