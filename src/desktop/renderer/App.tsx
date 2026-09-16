import { AppShell } from "./components/AppShell";
import { useAgentRun } from "./hooks/useAgentRun";

export function App() {
  const { messages, status, run } = useAgentRun();

  return <AppShell messages={messages} status={status} onRun={run} />;
}
