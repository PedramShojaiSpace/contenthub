import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Session key to prevent infinite reload loops on chunk errors
const CHUNK_RELOAD_KEY = "__chunk_reload_attempted";

function isChunkLoadError(error: Error): boolean {
  return (
    error?.message?.includes("Failed to fetch dynamically imported module") ||
    error?.message?.includes("Importing a module script failed") ||
    error?.message?.includes("Unable to preload CSS") ||
    error?.name === "ChunkLoadError"
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Stale chunk errors happen when a new deployment invalidates old JS bundles
    // that the browser cached. Auto-reload once to pick up the new build.
    if (isChunkLoadError(error)) {
      const alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      if (!alreadyTried) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
        // Reload with cache-bust to force fresh assets
        window.location.reload();
        // Return no-error state so nothing renders during reload
        return { hasError: false, error: null };
      }
    }
    // Clear the reload flag for non-chunk errors so future chunk errors can retry
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.message}
              </pre>
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem(CHUNK_RELOAD_KEY);
                window.location.reload();
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer"
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
