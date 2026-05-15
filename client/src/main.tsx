import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

/**
 * Safe fetch wrapper for tRPC.
 *
 * The Cloud Run gateway can return plain-text "Service Unavailable" or an HTML
 * error page — even with a 200 status code — when it is overloaded.
 * tRPC's httpBatchLink calls response.json() internally and crashes with
 * "Unexpected token 'S'" or "Unable to transform response from server".
 *
 * This wrapper reads EVERY response body as text first, checks whether it is
 * valid JSON, and throws a clean Error if it is not. tRPC's httpBatchLink
 * catches thrown errors and surfaces them as TRPCClientError with the message
 * intact, bypassing the JSON parse and superjson transform entirely.
 */
async function safeTrpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

  // Always read the body as text so we can inspect it before tRPC tries to JSON.parse it
  const text = await response.text();
  const trimmed = text.trim();

  // Check if the body is valid JSON (tRPC responses always start with { or [)
  const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  if (isJson) {
    // Reconstruct the response with the consumed body text
    return new Response(trimmed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  // Non-JSON body — plain text or HTML gateway error page
  // Determine if this looks like a transient service error
  const isTransient =
    response.status === 503 ||
    response.status === 502 ||
    response.status === 504 ||
    response.status === 500 ||
    response.status === 200 || // Gateway sometimes returns 200 with error body
    trimmed.toLowerCase().includes("service unavailable") ||
    trimmed.toLowerCase().includes("bad gateway") ||
    trimmed.toLowerCase().includes("gateway timeout") ||
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<HTML");

  const userMessage = isTransient
    ? "The AI service is temporarily unavailable. Please try again in a moment."
    : `Request failed (${response.status}): ${trimmed.slice(0, 120)}`;

  console.warn(`[safeTrpcFetch] Non-JSON response (${response.status}): ${trimmed.slice(0, 80)}`);

  // Throw a plain Error — tRPC's httpBatchLink catches this and surfaces it
  // as a TRPCClientError with the message intact
  throw new Error(userMessage);
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: safeTrpcFetch,
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
