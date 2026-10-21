import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";

import "../../i18n/setup";
import { RemoteAccessPanel } from "./RemoteAccessPanel";

test("desktop remote access combines tunnel setup and paired-device management", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <RemoteAccessPanel />
    </QueryClientProvider>,
  );
  expect(html).toContain("Install Dev Tunnels CLI");
  expect(html).toContain("Paired devices");
  expect(html).toContain("Pair a device");
  client.clear();
});
