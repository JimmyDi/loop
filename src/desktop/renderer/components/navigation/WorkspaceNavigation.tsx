type WorkspaceNavigationProps = {
  onClose: () => void;
};

export function WorkspaceNavigation({ onClose }: WorkspaceNavigationProps) {
  return (
    <div className="sidebar-section">
      <span className="eyebrow">Workspace</span>
      <button className="nav-item active" type="button" onClick={onClose}>
        New run
      </button>
      <button className="nav-item" type="button">
        History
      </button>
    </div>
  );
}
