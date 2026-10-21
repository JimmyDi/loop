import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";

import type { PairingInvite, RemoteDevicesStatus } from "../../shared/remote-devices";
import { api, command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";

export const useRemoteDevices = () => {
  const [invite, setInvite] = useState<PairingInvite>();
  const [qr, setQr] = useState<string>();
  const action = useAsyncAction();
  const query = useQuery({
    queryKey: ["remote-devices"],
    queryFn: ({ signal }) => api<RemoteDevicesStatus>("/remote-access/devices", { signal }),
    retry: false,
    refetchInterval: 1500,
  });
  useEffect(() => {
    if (!invite) return;
    const timer = setTimeout(
      () => {
        setInvite(undefined);
        setQr(undefined);
      },
      Math.max(0, invite.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [invite]);
  useEffect(() => {
    if (query.data && (!query.data.connected || query.data.pending.length)) {
      setInvite(undefined);
      setQr(undefined);
    }
  }, [query.data]);
  const createInvite = () =>
    action.run(async () => {
      const next = await command<PairingInvite>("/remote-access/pairing");
      const image = await QRCode.toDataURL(next.url, {
        width: 208,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      setInvite(next);
      setQr(image);
    });
  const decide = (id: string, approve: boolean) =>
    action.run(async () => {
      await command("/remote-access/pairing/" + id, { approve });
      await query.refetch();
    });
  const revoke = (id: string) =>
    action.run(async () => {
      await command("/remote-access/devices/" + id, undefined, "DELETE");
      await query.refetch();
    });
  return {
    query,
    invite,
    qr,
    createInvite,
    decide,
    revoke,
    pending: action.pending,
    error: action.error ?? query.error,
  };
};
