import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ProviderSettingsDialog } from "./ProviderSettingsDialog";

test("model settings are available before creating any project or session", () => {
  const client = new QueryClient();

  client.setQueryData(["provider-settings"], null);
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ProviderSettingsDialog onClose={() => {}} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Model settings");
  expect(html).toContain("Base URL");
  client.clear();
});
