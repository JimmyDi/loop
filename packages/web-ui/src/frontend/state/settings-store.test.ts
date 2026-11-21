import { expect, test } from "vitest";

import { useSettings } from "./settings-store";

test("settings openings select General by default and support direct section navigation", () => {
  const state = useSettings.getState();
  try {
    state.open("voice");
    expect(useSettings.getState().section).toBe("voice");
    state.close();
    expect(useSettings.getState().section).toBeUndefined();
    state.open();
    expect(useSettings.getState().section).toBe("general");
  } finally {
    useSettings.setState(state, true);
  }
});
