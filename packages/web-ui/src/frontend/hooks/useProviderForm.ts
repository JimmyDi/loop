import { useState } from "react";

import type { ProviderConfig, ProviderRecord } from "../../shared/provider";
import { useAsyncAction } from "./useAsyncAction";

export const useProviderForm = (
  initial: ProviderRecord,
  save: (input: ProviderConfig) => Promise<void>,
) => {
  const [values, setValues] = useState<ProviderConfig>({ ...initial, apiKey: "" });
  const action = useAsyncAction();
  const set = <K extends keyof ProviderConfig>(key: K, value: ProviderConfig[K]) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "authentication" && value === "none" ? { apiKey: "" } : {}),
    }));
  };
  const submit = () =>
    action.run(async () => {
      const { hasApiKey: _, ...input } = values as ProviderConfig & { hasApiKey?: boolean };
      await save({
        ...input,
        apiKey: values.authentication === "apiKey" ? values.apiKey?.trim() || undefined : undefined,
      });
      setValues((previous) => ({ ...previous, apiKey: "" }));
    });
  return { values, set, submit, pending: action.pending, error: action.error };
};
