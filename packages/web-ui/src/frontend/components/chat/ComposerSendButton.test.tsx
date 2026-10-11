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

test("paused control resumes even with no draft and never submits the composer form", () => {
  const props = {
    running: false,
    disabled: true,
    stopping: false,
    onStop: () => {},
    onResume: () => {},
    resume: { disabled: false },
  };
  const paused = renderToStaticMarkup(<ComposerSendButton {...props} />);
  expect(paused).toContain('class="action-button composer-send resume"');
  expect(paused).toContain('aria-label="Resume"');
  expect(paused).toContain("<svg");
  expect(paused).toContain('type="button"');
  expect(paused).not.toContain('type="submit"');
  expect(paused).not.toContain("disabled");
  expect(renderToStaticMarkup(<ComposerSendButton {...props} stopping />)).toContain("disabled");
  expect(
    renderToStaticMarkup(<ComposerSendButton {...props} resume={{ disabled: true }} />),
  ).toContain("disabled");
});
