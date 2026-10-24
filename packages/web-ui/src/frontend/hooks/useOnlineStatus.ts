import { useSyncExternalStore } from "react";

const subscribe = (notify: () => void) => {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
};

export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => window.navigator.onLine !== false,
    () => true,
  );
