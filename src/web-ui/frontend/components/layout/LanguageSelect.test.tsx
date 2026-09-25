import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { LanguageSelect } from "./LanguageSelect";

test("LanguageSelect exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <LanguageSelect />
    </QueryClientProvider>,
  );

  expect(html).toContain("English");
  expect(html).toContain("中文");
  expect(html).toContain("Language");
  client.clear();
});
