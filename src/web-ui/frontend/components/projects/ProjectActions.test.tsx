import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ProjectActions } from "./ProjectActions";

test("ProjectActions exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ProjectActions project={{ id: "p", name: "Example", cwd: "/example" }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Rename");
  expect(html).toContain("Remove");
  client.clear();
});
