import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { useLanguage } from "./useLanguage";

afterEach(cleanup);

it("provides the static Chinese fallback outside an interactive provider", () => {
  const { result } = renderHook(useLanguage);
  expect(result.current.language).toBe("zh");
  expect(result.current.t("home")).toBe("Loop 首页");
});
