import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { ProjectItem } from "./ProjectItem";

test("ProjectItem exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ProjectItem project={{ id: "p", name: "Example", cwd: "/example", accessible: false }} />
    </QueryClientProvider>,
  );

  expect(html).toContain("Example");
  expect(html).toContain("Directory unavailable");
  expect(html).toContain("disabled");
  client.clear();
});
