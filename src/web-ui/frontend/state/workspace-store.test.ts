import { expect, test } from "bun:test";

import { useWorkspace } from "./workspace-store";

test("tabs deduplicate and retain drafts when closed", () => {
  useWorkspace.setState({ tabs: [], active: undefined, drafts: {} });
  const state = useWorkspace.getState();
  const tab = { id: "a", workspaceId: "p", title: "First" };

  state.open(tab);
  state.open(tab);
  state.draft("a", "Keep");
  const images = [{ type: "image" as const, mimeType: "image/png", data: "AAAA" }];
  state.attach("a", images);
  expect(useWorkspace.getState().tabs).toHaveLength(1);
  state.close("a");
  expect(useWorkspace.getState().drafts.a).toBe("Keep");
  expect(useWorkspace.getState().images.a).toEqual(images);
  state.open(tab);
  state.removeProject("p");
  expect(useWorkspace.getState().tabs).toEqual([]);
  expect(useWorkspace.getState().drafts.a).toBeUndefined();
  expect(useWorkspace.getState().images.a).toBeUndefined();
});
