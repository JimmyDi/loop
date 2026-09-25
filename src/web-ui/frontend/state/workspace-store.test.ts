import { expect, test } from "bun:test";

import { useWorkspace } from "./workspace-store";

test("tabs deduplicate and retain drafts when closed", () => {
  useWorkspace.setState({ tabs: [], active: undefined, drafts: {} });
  const state = useWorkspace.getState();
  const tab = { id: "a", workspaceId: "p", title: "First" };

  state.open(tab);
  state.open(tab);
  state.draft("a", "Keep");
  expect(useWorkspace.getState().tabs).toHaveLength(1);
  state.close("a");
  expect(useWorkspace.getState().drafts.a).toBe("Keep");
  state.open(tab);
  state.removeProject("p");
  expect(useWorkspace.getState().tabs).toEqual([]);
  expect(useWorkspace.getState().drafts.a).toBeUndefined();
});
