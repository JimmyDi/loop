import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { RemoteAccessIssue } from "./RemoteAccessIssue";

test.each([false, true])(
  "remote issue includes a decorative icon and translated alert; warning=%s",
  (warning) => {
    const html = renderToStaticMarkup(
      <RemoteAccessIssue message="remote.errors.sign_in_failed" warning={warning} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('data-tone="' + (warning ? "warning" : "error") + '"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).toContain("Microsoft sign-in did not complete");
  },
);
