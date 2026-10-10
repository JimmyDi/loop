import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { ComposerSendButton } from "./ComposerSendButton";

test("uses a host stop action while running and form submission while idle", () => {
  const props = { disabled: true, stopping: false, onStop: () => {} };
  const idle = renderToStaticMarkup(<ComposerSendButton {...props} running={false} />);
  expect(idle).toContain('type="submit"');
  expect(idle).toContain("disabled");
  const running = renderToStaticMarkup(<ComposerSendButton {...props} running />);
  expect(running).toContain('type="button"');
  expect(running).toContain("Stop generating");
  expect(running).not.toContain("disabled");
});
