import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { AddProjectDialog } from "./AddProjectDialog";

test("AddProjectDialog exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <AddProjectDialog onClose={() => {}} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Add project");
  expect(html).toContain("Project directory");
  expect(html).toContain("Browse folders");
  client.clear();
});
