import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import { Modal } from "./Modal";

test("Modal exposes its accessible content and state", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <Modal title="Projects" onClose={() => {}}>
        Choose folder
      </Modal>
    </QueryClientProvider>,
  );

  expect(html).toContain("<dialog");
  expect(html).toContain("Projects");
  expect(html).toContain("Choose folder");
  client.clear();
});
