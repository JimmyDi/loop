export const remoteEn = {
  info: "Dev Tunnels license and privacy information",
  steps: "Remote access setup",
  step: "Step {{number}}",
  completed: "Completed",
  failed: "Check failed",
  incomplete: "Not completed",
  loading: "Loading",
  termsPrefix: "Using the connection tool is subject to Microsoft's",
  terms: "Dev Tunnels license terms",
  privacy: "Privacy Statement",
  install: "Install Dev Tunnels CLI",
  uninstall: "Uninstall Dev Tunnels CLI",
  download: "Downloading: {{received}} / {{total}} MB",
  pauseDownload: "Pause download",
  resumeDownload: "Resume download",
  stopDownload: "Stop and delete download",
  downloadPaused: "Download paused",
  verifyingAndInstalling: "Verifying and installing…",
  login: "Sign in",
  logout: "Sign out",
  start: "Connect Tunnel",
  disconnect: "Disconnect Tunnel",
  stop: "Stop / cancel",
  requestFailed: "The operation could not be confirmed. Refresh the status before trying again.",
  phases: {
    off: "Tunnel off",
    installing: "Installing CLI…",
    uninstalling: "Uninstalling CLI…",
    "signing-in": "Signing in… Complete any system credential prompt, then browser sign-in.",
    "signing-out": "Signing out…",
    connecting: "Connecting…",
    connected: "Tunnel connected",
    stopping: "Stopping…",
    error: "Action required",
  },
  errors: {
    connection_state_failed:
      "The connection preference could not be saved. Check the data directory permissions, then retry.",
    sign_in_state_failed:
      "The sign-in state could not be saved. Check the data directory permissions, then retry.",
    cli_uninstall_failed:
      "The CLI could not be removed. Check the data directory permissions, then retry.",
    unsupported_platform:
      "Automatic installation is unavailable for this operating system or CPU architecture.",
    cli_integrity_failed:
      "The downloaded connection tool failed verification and was not installed. Retry the download.",
    cli_failed:
      "The connection tool could not complete the operation. Check the network and system credential storage, then retry.",
    sign_in_failed:
      "Microsoft sign-in did not complete. Check the browser, network and system credential storage, then retry.",
    sign_in_timeout:
      "Sign-in timed out. Check for a system credential prompt and complete browser sign-in, then retry.",
    tunnel_failed: "The tunnel could not stay connected. Check the network and reconnect.",
  },
};
