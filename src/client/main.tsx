import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from "sonner";
import App from "./App";
import { queryClient } from "./query";
import { Button, leadingBody, leadingHeading } from "./ui";
import "./index.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallbackRender={({ resetErrorBoundary }) => (
        <main className="grid min-h-screen place-content-center justify-items-center gap-3 bg-background p-8 text-center text-foreground">
          <h1 className={`text-xl font-semibold ${leadingHeading}`}>Something went wrong</h1>
          <p className={leadingBody}>Please reload the portal and try again.</p>
          <Button onClick={resetErrorBoundary}>Try again</Button>
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
