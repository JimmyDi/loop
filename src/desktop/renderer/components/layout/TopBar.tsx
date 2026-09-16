type TopBarProps = {
  onOpenNavigation: () => void;
};

export function TopBar({ onOpenNavigation }: TopBarProps) {
  return (
    <header className="topbar">
      <div>
        <span className="eyebrow">Local agent harness</span>
        <h1>Run a task</h1>
      </div>
      <button className="menu-button" type="button" onClick={onOpenNavigation}>
        Menu
      </button>
      <span className="provider-badge">mock provider</span>
    </header>
  );
}
