import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { RemoteAccessGate } from "./components/remote/RemoteAccessGate";
import { ErrorNotice } from "./components/ui/ErrorNotice";
import { LoopIcon } from "./components/ui/LoopIcon";
import { useDebug } from "./state/debug-store";
import "./i18n/setup";
import "./theme.css";
import "./App.css";

const query = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });

const AppShell = lazy(() =>
  import("./components/layout/AppShell").then((module) => ({ default: module.AppShell })),
);

const OpenUiDevtools =
  import.meta.env.LOOP_ENVIRONMENT === "local-dev"
    ? lazy(async () => {
        // The inspector needs the OpenUI observability bus before it mounts.
        const [{ OpenUIDevtools }] = await Promise.all([
          import("@openuidev/devtools"),
          import("@openuidev/react-lang"),
        ]);
        return { default: OpenUIDevtools };
      })
    : undefined;

export const App = () => {
  const { t } = useTranslation();
  const openUiDevtools = useDebug((state) => state.openUiDevtools);
  return (
    <QueryClientProvider client={query}>
      <ErrorBoundary FallbackComponent={ErrorNotice}>
        <RemoteAccessGate>
          {OpenUiDevtools && openUiDevtools && (
            <Suspense fallback={null}>
              <OpenUiDevtools enabled version="0.3.1" />
            </Suspense>
          )}
          <Suspense
            fallback={
              <main className="app-loading" role="status">
                <LoopIcon size={48} />
                <span>{t("loading")}</span>
              </main>
            }
          >
            <AppShell />
          </Suspense>
        </RemoteAccessGate>
      </ErrorBoundary>
    </QueryClientProvider>
  );
};
