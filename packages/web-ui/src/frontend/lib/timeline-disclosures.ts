import { createContext } from "react";

export const TimelineDisclosures = createContext<Map<string, boolean> | undefined>(undefined);
