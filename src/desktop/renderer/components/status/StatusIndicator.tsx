type StatusIndicatorProps = {
  status: string;
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  return (
    <div className="sidebar-footer">
      <span className="status-dot" />
      <span>{status}</span>
    </div>
  );
}
