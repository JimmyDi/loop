import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { VoicePackageProgress } from "./VoicePackageProgress";

test.each([
  [25, 100, 25, 90],
  [200, 100, 100, 360],
  [-10, 100, 0, 0],
] as const)(
  "progress %s/%s fills from the top and bounds the animation",
  (received, total, percent, angle) => {
    const html = renderToStaticMarkup(
      <VoicePackageProgress
        label="Recognition"
        loading
        complete={false}
        failed={false}
        received={received}
        total={total}
      />,
    );
    expect(html).toContain('aria-valuenow="' + percent + '"');
    expect(html).toContain(">" + percent + "%</span>");
    expect(html).toContain('stroke-dasharray="' + percent + ' 100"');
    expect(html).toContain('transform="rotate(-90 16 16)"');
    expect(html).toContain("--voice-progress-angle:" + angle + "deg");
  },
);

test("unknown size does not invent progress or animate past the filled arc", () => {
  const html = renderToStaticMarkup(
    <VoicePackageProgress label="Recognition" loading complete={false} failed={false} />,
  );
  expect(html).not.toContain("aria-valuenow");
  expect(html).toContain(">—</span>");
  expect(html).not.toContain('class="voice-package-progress-runner"');
});

test("completion draws a full ring and check without a moving highlight", () => {
  const html = renderToStaticMarkup(
    <VoicePackageProgress label="Recognition" loading={false} complete failed={false} />,
  );
  expect(html).toContain('stroke-dasharray="100 100"');
  expect(html).toContain('data-state="completed"');
  expect(html).toContain('class="voice-package-progress-symbol"');
  expect(html).not.toContain('class="voice-package-progress-runner"');
});

test("failure preserves partial progress and shows the error cross", () => {
  const html = renderToStaticMarkup(
    <VoicePackageProgress
      label="Recognition"
      loading={false}
      complete={false}
      failed
      received={50}
      total={100}
    />,
  );
  expect(html).toContain('data-state="failed"');
  expect(html).toContain('stroke-dasharray="50 100"');
  expect(html).toContain('d="m13 13 6 6m0-6-6 6"');
});

test("failed package exposes its own error tooltip for hover and keyboard focus", () => {
  const html = renderToStaticMarkup(
    <VoicePackageProgress
      label="Recognition"
      loading={false}
      complete={false}
      failed
      error="Download failed"
    />,
  );
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('role="tooltip"');
  expect(html).toContain("aria-describedby=");
  expect(html).toContain("Download failed</span>");
});
