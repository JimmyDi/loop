import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";

import type { PairingInvite, RemoteDevicesStatus } from "../../shared/remote-devices";
import { api, command } from "../lib/api";
import { useAsyncAction } from "./useAsyncAction";

export const useRemoteDevices = (connected = true) => {
  const [invitation, setInvitation] = useState<
    PairingInvite & { connectionId: string; qr: string }
  >();
  const [revision, setRevision] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<unknown>();
  const action = useAsyncAction();
  const query = useQuery({
    queryKey: ["remote-devices"],
    queryFn: ({ signal }) => api<RemoteDevicesStatus>("/remote-access/devices", { signal }),
    retry: false,
    refetchInterval: 1500,
  });
  const connectionId =
    connected && query.data?.connected && !query.isError ? query.data.connectionId : undefined;
  const waiting = !!query.data?.pending.length;
  useEffect(() => {
    setInvitation(undefined);
    setGenerationError(undefined);
    if (!connectionId || waiting) {
      setGenerating(false);
      return;
    }
    const abort = new AbortController();
    setGenerating(true);
    void (async () => {
      try {
        const next = await api<PairingInvite>("/remote-access/pairing", {
          method: "POST",
          signal: abort.signal,
        });
        const qr = await QRCode.toDataURL(next.url, {
          width: 208,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (next.expiresAt <= Date.now()) throw new Error("Pairing invitation expired");
        if (!abort.signal.aborted) setInvitation({ ...next, connectionId, qr });
      } catch (error) {
        if (!abort.signal.aborted) setGenerationError(error);
      } finally {
        if (!abort.signal.aborted) setGenerating(false);
      }
    })();
    return () => abort.abort();
  }, [connectionId, waiting, revision]);
  useEffect(() => {
    if (!invitation || invitation.connectionId !== connectionId || waiting) return;
    const timer = setTimeout(
      () => {
        setInvitation(undefined);
        setRevision((value) => value + 1);
      },
      Math.max(0, invitation.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [invitation, connectionId, waiting]);
  const invite = !waiting && invitation?.connectionId === connectionId ? invitation : undefined;
  const createInvite = () => setRevision((value) => value + 1);
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
    qr: invite?.qr,
    createInvite,
    decide,
    revoke,
    generating,
    pending: action.pending || generating,
    error: generationError ?? action.error ?? query.error,
  };
};
