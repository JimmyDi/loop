import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import "../../i18n/setup";
import type { SessionSnapshot } from "../../../shared/protocol";
import type { useComposerProject } from "../../hooks/useComposerProject";
import { ComposerWorkspace } from "./ComposerWorkspace";

test("sandbox composer excludes local project selection", () => {
  const client = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ComposerWorkspace
        snapshot={{ state: { execution: "sandbox" } } as SessionSnapshot}
        project={{} as ReturnType<typeof useComposerProject>}
        blocked
      />
    </QueryClientProvider>,
  );
  expect(html).toContain("Loop Sandbox");
  expect(html).not.toContain("composer-project-selector");
  client.clear();
});
