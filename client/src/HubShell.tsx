import { ReactNode, Suspense } from "react";
import { Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";

function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm">Loading Content Hub…</p>
    </div>
  );
}

export function HubShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<Loading />}>
            <Switch>{children}</Switch>
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
