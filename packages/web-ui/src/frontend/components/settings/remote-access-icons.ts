import type { RemoteAccessCommand } from "../../../shared/remote-access";

export const remoteAccessIcons: Record<Exclude<RemoteAccessCommand, "pause" | "resume">, string> = {
  install: "M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4",
  uninstall: "M4 7h16M10 3h4l1 4H9l1-4ZM6 7l1 14h10l1-14M10 11v6m4-6v6",
  login: "M14 4h6v16h-6M3 12h12m-4-4 4 4-4 4",
  start:
    "M2 2l1.8 1.8M5.25 10.75 3.5 9a4 4 0 0 1 5.5-5.5l1.75 1.75M4.5 11.5l7-7M18.75 13.25 20.5 15a4 4 0 0 1-5.5 5.5l-1.75-1.75M19.5 12.5l-7 7m5.2-5.2-1.8-1.8m-1.6 5.2-1.8-1.8m7.7 4.3L22 22",
  stop: "M2 2l3.8 3.8M9.25 14.75 5.5 11A4 4 0 0 1 11 5.5l3.75 3.75M8.5 15.5l7-7m-.75.75L18.5 13a4 4 0 0 1-5.5 5.5l-3.75-3.75m8.95 3.45L22 22",
  logout: "M10 4H4v16h6m-1-8h12m-4-4 4 4-4 4",
};
