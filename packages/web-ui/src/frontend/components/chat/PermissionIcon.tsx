import type { PermissionPreset } from "../../../shared/protocol";

export const PermissionIcon = ({ preset }: { preset: PermissionPreset }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3 3 7v5c0 5 5 8 9 9 4-1 9-4 9-9V7l-9-4Z" />
    {preset === "danger-full-access" ? (
      <path d="M12 8v5m0 3h.01" />
    ) : preset === "workspace-write" ? (
      <path d="m8 12 3 3 5-6" />
    ) : (
      <path d="M8 12h8" />
    )}
  </svg>
);
