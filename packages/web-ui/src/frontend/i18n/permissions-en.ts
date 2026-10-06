export const permissionsEn = {
  label: "Session permissions",
  defaultLabel: "Permission",
  defaultDescription:
    "Choose the default access level for new Web sessions. Existing sessions keep their permissions.",
  defaultFullTitle: "Use full access for new sessions?",
  defaultFullWarning:
    "New Web sessions in every project will be able to modify host files and run commands with host network and environment access, without individual approval. Existing sessions keep their permissions.",
  defaultFullRisk:
    "This can cause data loss or expose sensitive information. Untrusted content may influence the model. Changing this default later affects only sessions created afterwards.",
  menuHeading: "Choose what this session can do",
  "read-only": "Read only",
  "workspace-write": "Workspace write",
  "danger-full-access": "Full access",
  "read-onlyHint": "File changes require approval; shell commands run in a sandbox.",
  "workspace-writeHint": "Workspace changes allowed; shell commands run in a sandbox.",
  "danger-full-accessHint": "Host access; shell commands run without a sandbox.",
  confirmFull: "Enable full access",
  fullTitle: "Turn on full access?",
  filesTitle: "Files and folders",
  filesDescription: "Read, create, modify or delete files wherever your system account has access.",
  commandsTitle: "Terminal commands",
  commandsDescription:
    "Run commands without a sandbox, including software installation and system changes allowed by your account.",
  networkTitle: "Network access",
  networkDescription:
    "Commands can use the host network and environment variables to access services or send data.",
  fullRisk:
    "This can cause data loss or expose sensitive information. Untrusted content may influence the model. You can switch back to restricted permissions when the session is idle.",
  fullWarning:
    "Allow this session to modify host files and run commands with host network and environment access, without individual approval. This choice is saved for this session.",
  approvalRequired: "Approval required",
  waiting: "Waiting for approval",
  allowWithPermissions: "Allow this operation with {{mode}} permissions",
  allowOperation: "Allow this operation once",
  hostScope: "Access to host files, network and environment.",
  details: "Operation details",
  workspace: "Working directory",
  target: "Target file",
  shellScope:
    "Allow one command and its descendants without a sandbox, with host filesystem, network and environment access. The command is not restricted to the displayed directory.",
  fileScope:
    "Allow only this file replacement, including required parent directories. The session permission level stays unchanged.",
  unknownScope: "Review this request. No managed execution scope was supplied.",
  reject: "Deny",
  allowOnce: "Allow once",
  disconnected: "Reconnect to respond",
  outcomes: {
    "allowed-session": "Allowed for this session",
    "allowed-once": "Allowed once",
    rejected: "Rejected",
    cancelled: "Approval cancelled",
    "timed-out": "Approval expired",
    unavailable: "Approval interface unavailable",
  },
};
