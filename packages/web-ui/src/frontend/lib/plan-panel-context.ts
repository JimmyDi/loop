import { createContext } from "react";

export const PlanPanelContext = createContext<(id: string) => void>(() => {});
