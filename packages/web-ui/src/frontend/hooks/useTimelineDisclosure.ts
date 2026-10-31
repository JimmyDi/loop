import { useContext, useState } from "react";

import { TimelineDisclosures } from "../lib/timeline-disclosures";

export const useTimelineDisclosure = (key: string) => {
  const saved = useContext(TimelineDisclosures);
  const [state, setState] = useState(() => ({ saved, key, open: saved?.get(key) ?? false }));
  const current =
    state.saved === saved && state.key === key
      ? state
      : { saved, key, open: saved?.get(key) ?? false };
  if (current !== state) setState(current);
  const toggle = (open: boolean) => {
    saved?.set(key, open);
    setState({ saved, key, open });
  };
  return [current.open, toggle] as const;
};
