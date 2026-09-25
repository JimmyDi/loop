import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { AppShell } from "./components/layout/AppShell";
import { ErrorNotice } from "./components/ui/ErrorNotice";
import "./i18n/setup";
import "./App.css";

const query = new QueryClient({ defaultOptions: { queries: { staleTime: 5000, retry: 1 } } });

export const App = () => (
  <QueryClientProvider client={query}>
    <ErrorBoundary FallbackComponent={ErrorNotice}>
      <AppShell />
    </ErrorBoundary>
  </QueryClientProvider>
);
