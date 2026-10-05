import { useQuery } from "@tanstack/react-query";

import type { ModelChoice } from "../../shared/protocol";
import { api } from "../lib/api";

export const useModels = () =>
  useQuery({
    queryKey: ["models"],
    queryFn: () => api<ModelChoice[]>("/models"),
    staleTime: 60_000,
  });
