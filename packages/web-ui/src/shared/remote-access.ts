export type RemoteAccessPhase =
  | "off"
  | "installing"
  | "uninstalling"
  | "signing-in"
  | "signing-out"
  | "connecting"
  | "connected"
  | "stopping"
  | "error";

export type RemoteAccessErrorCode =
  | "unsupported_platform"
  | "cli_install_failed"
  | "cli_uninstall_failed"
  | "cli_integrity_failed"
  | "cli_failed"
  | "sign_in_failed"
  | "sign_in_timeout"
  | "sign_in_state_failed"
  | "connection_state_failed"
  | "tunnel_failed";

export type RemoteAccessStep = "install" | "login" | "start";

export type RemoteAccessStatus = {
  supported: boolean;
  installed: boolean;
  signedIn: boolean;
  phase: RemoteAccessPhase;
  failedSteps?: RemoteAccessStep[];
  download?: {
    received: number;
    total?: number;
    paused?: boolean;
    stage?: "downloading" | "verifying";
  };
  url?: string;
  error?: RemoteAccessErrorCode;
  errorStep?: RemoteAccessStep;
};

export type RemoteAccessCommand =
  | "install"
  | "uninstall"
  | "login"
  | "start"
  | "stop"
  | "logout"
  | "pause"
  | "resume";
