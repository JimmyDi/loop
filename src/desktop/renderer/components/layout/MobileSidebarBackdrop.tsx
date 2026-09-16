type MobileSidebarBackdropProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebarBackdrop({ open, onClose }: MobileSidebarBackdropProps) {
  return (
    <button
      type="button"
      className={`mobile-sidebar-backdrop${open ? " open" : ""}`}
      aria-label="Close navigation"
      onClick={onClose}
    />
  );
}
