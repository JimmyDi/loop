import { expect, test } from "bun:test";
import { Window } from "happy-dom";

import type { ProviderInput } from "../../shared/provider";

test("provider form preserves unsaved values on failure and clears keys after saving", async () => {
  const window = new Window();
  const previous = { window: globalThis.window, document: globalThis.document };

  Object.assign(globalThis, { window, document: window.document });

  try {
    const { renderHook, act, cleanup } = await import("@testing-library/react/pure");
    const { useProviderForm } = await import("./useProviderForm");
    const inputs: ProviderInput[] = [];
    let failed = true;
    const { result } = renderHook(() =>
      useProviderForm(null, async (input) => {
        if (failed) throw new Error("Save failed");

        inputs.push(input);
      }),
    );

    act(() => result.current.set("apiKey", "test-secret"));
    await act(() => result.current.submit());
    expect(result.current.values.apiKey).toBe("test-secret");
    expect(result.current.saved).toBe(false);
    failed = false;
    await act(() => result.current.submit());
    expect(inputs[0]?.apiKey).toBe("test-secret");
    expect(result.current.values.apiKey).toBe("");
    expect(result.current.saved).toBe(true);
    await act(() => result.current.submit());
    expect(inputs[1]?.apiKey).toBeUndefined();
    act(() => result.current.set("apiKey", "unsaved-secret"));
    act(() => result.current.set("authentication", "none"));
    expect(result.current.values.apiKey).toBe("");
    await act(() => result.current.submit());
    expect(inputs[2]?.apiKey).toBeUndefined();
    expect(inputs[2]?.authentication).toBe("none");
    cleanup();
  } finally {
    Object.assign(globalThis, previous);
    await window.happyDOM.close();
  }
});
