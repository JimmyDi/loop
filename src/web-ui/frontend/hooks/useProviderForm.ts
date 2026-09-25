import { useState } from "react";

import type { ProviderInput, ProviderView } from "../../shared/provider";
import { useAsyncAction } from "./useAsyncAction";

export const useProviderForm = (
  initial: ProviderView | null,
  save: (input: ProviderInput) => Promise<void>,
) => {
  const [values, setValues] = useState<ProviderInput>({
    name: initial?.name ?? "",
    baseUrl: initial?.baseUrl ?? "",
    modelId: initial?.modelId ?? "gpt-5.5",
    authentication: initial?.authentication ?? "apiKey",
    apiKey: "",
  });
  const [saved, setSaved] = useState(false);
  const action = useAsyncAction();
  const set = <K extends keyof ProviderInput>(key: K, value: ProviderInput[K]) => {
    setSaved(false);
    setValues((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "authentication" && value === "none" ? { apiKey: "" } : {}),
    }));
  };
  const submit = () =>
    action.run(async () => {
      await save({
        ...values,
        apiKey: values.authentication === "apiKey" ? values.apiKey?.trim() || undefined : undefined,
      });
      setValues((previous) => ({ ...previous, apiKey: "" }));
      setSaved(true);
    });

  return { values, set, submit, saved, pending: action.pending, error: action.error };
};
