export type RemoteDevice = {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
};

export type PairingRequest = {
  id: string;
  name: string;
  confirmation: string;
  expiresAt: number;
};

export type RemoteDevicesStatus = {
  connected: boolean;
  connectionId?: string;
  devices: RemoteDevice[];
  pending: PairingRequest[];
};

export type PairingInvite = { url: string; expiresAt: number };

export type RemoteSession =
  | { mode: "local" }
  | { mode: "remote"; authorized: false }
  | { mode: "remote"; authorized: true; csrf: string; device: RemoteDevice };

export type PairingStatus = {
  state: "pending" | "approved" | "rejected" | "expired";
  confirmation?: string;
};
