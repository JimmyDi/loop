import { join } from "node:path";

import { getAgentDir } from "../config";

/** Select a local data space; this does not authenticate the operating-system caller. */
export const getProfileDir = (userId: string, dataDir = getAgentDir()): string => {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(userId))
    throw new Error("Invalid profile ID");
  return join(dataDir, "users", userId);
};
