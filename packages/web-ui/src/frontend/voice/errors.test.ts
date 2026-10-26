import { expect, test } from "vitest";

import { voiceErrorKey } from "./errors";

test("voice failures explain asset availability and verification without exposing raw errors", () => {
  expect(voiceErrorKey("voice_engine_asset_unavailable")).toBe("voice.engineUnavailable");
  expect(voiceErrorKey(new Error("voice_resource_integrity_failed"))).toBe("voice.integrityFailed");
  expect(voiceErrorKey(new Error("NotAllowedError"))).toBe("voice.permissionDenied");
  expect(
    voiceErrorKey(
      Object.assign(new Error("voice_resource_asset_unavailable"), { code: "operation_failed" }),
    ),
  ).toBe("voice.engineUnavailable");
  expect(voiceErrorKey({ private: "detail" })).toBe("voice.failed");
});
