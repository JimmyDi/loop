export const SessionPinIcon = ({ pinned }: { pinned: boolean }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16.3 2.8a1.7 1.7 0 0 1 2.4 0l2.5 2.5a1.7 1.7 0 0 1 0 2.4l-3.6 3.6a3 3 0 0 0-.9 2.1v2.4a1.7 1.7 0 0 1-2.9 1.2l-6.8-6.8a1.7 1.7 0 0 1 1.2-2.9h2.4a3 3 0 0 0 2.1-.9l3.6-3.6ZM10.4 13.6 3 21" />
    {pinned && <path d="m3 3 18 18" />}
  </svg>
);
