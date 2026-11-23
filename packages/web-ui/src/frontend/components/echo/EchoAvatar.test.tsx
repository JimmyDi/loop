import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import { EchoAvatar } from "./EchoAvatar";

test("Agent avatars use a default bot mark or the uploaded image", () => {
  expect(renderToStaticMarkup(<EchoAvatar />)).toContain("<svg");
  expect(renderToStaticMarkup(<EchoAvatar avatar="data:image/png;base64,AAAA" />)).toContain(
    'src="data:image/png;base64,AAAA"',
  );
});
