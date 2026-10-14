import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import App from "./App";
import { queryClient } from "./query";
import "./styles/theme.css";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <main className="app-crash-state">
          <h1>Something went wrong</h1>
          <p>Please reload the portal and try again.</p>
          <button className="ui-button ui-button-primary" onClick={resetErrorBoundary}>Try again</button>
        </main>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" closeButton richColors />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
