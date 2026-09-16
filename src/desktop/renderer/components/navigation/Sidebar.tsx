import { Brand } from "./Brand";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
import { StatusIndicator } from "../status/StatusIndicator";

type SidebarProps = {
  open: boolean;
  status: string;
  onClose: () => void;
};

export function Sidebar({ open, status, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar${open ? " mobile-open" : ""}`}>
      <Brand />
      <WorkspaceNavigation onClose={onClose} />
      <StatusIndicator status={status} />
    </aside>
  );
}
