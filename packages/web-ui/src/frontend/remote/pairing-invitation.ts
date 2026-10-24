const key = "loop.pending-pairing";

export const clearPairingInvitation = (): void => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {}
};

export const capturePairingInvitation = (): string => {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("pair");
  const now = Date.now();
  let restored = "";
  try {
    if (token) {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({ token, origin: window.location.origin, expiresAt: now + 300_000 }),
      );
    } else {
      const saved = JSON.parse(window.sessionStorage.getItem(key) ?? "null");
      if (
        typeof saved?.token === "string" &&
        saved.origin === window.location.origin &&
        Number.isFinite(saved.expiresAt) &&
        saved.expiresAt > now &&
        saved.expiresAt <= now + 300_000
      )
        restored = saved.token;
      else clearPairingInvitation();
    }
  } catch {
    clearPairingInvitation();
  }
  if (window.location.hash)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return token ?? restored;
};
