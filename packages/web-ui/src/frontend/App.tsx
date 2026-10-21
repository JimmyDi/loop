import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";

import { RemoteAccessGate } from "./components/remote/RemoteAccessGate";
import { ErrorNotice } from "./components/ui/ErrorNotice";
import "./i18n/setup";
import "./theme.css";
import "./App.css";

const query = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });

const AppShell = lazy(() =>
  import("./components/layout/AppShell").then((module) => ({ default: module.AppShell })),
);

export const App = () => {
  const { t } = useTranslation();
  return (
    <QueryClientProvider client={query}>
      <ErrorBoundary FallbackComponent={ErrorNotice}>
        <RemoteAccessGate>
          <Suspense
            fallback={
              <main className="app-loading" role="status">
                {t("loading")}
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
