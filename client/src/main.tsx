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
 * error page at the HTTP level — BEFORE the request reaches the Express server.
 * tRPC's httpBatchLink calls response.json() internally and crashes with
 * "Unexpected token 'S'" when the body isn't JSON.
 *
 * This wrapper intercepts those gateway-level errors and converts them into a
 * synthetic tRPC-compatible error response so the user sees a clean message
 * instead of a raw JSON parse crash.
 */
async function safeTrpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });

  // Fast path: 2xx responses are almost always JSON — return as-is
  if (response.ok) return response;

  // For non-2xx responses, read the body as text to check if it's JSON
  const text = await response.text();
  const trimmed = text.trim();
  const isJson = trimmed.startsWith("{") || trimmed.startsWith("[");

  if (isJson) {
    // Already valid JSON — reconstruct the response with the consumed body
    return new Response(trimmed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  // Non-JSON body (plain text "Service Unavailable" or HTML gateway error page)
  // Synthesize a tRPC-compatible batch error response so tRPC doesn't crash on JSON.parse
  const isTransient =
    response.status === 503 ||
    response.status === 502 ||
    response.status === 504 ||
    response.status === 500 ||
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

  console.warn(`[safeTrpcFetch] Non-JSON gateway response (${response.status}): ${trimmed.slice(0, 80)}`);

  // tRPC batch responses are arrays; return a synthetic error in batch format
  const syntheticBody = JSON.stringify([{
    error: {
      message: userMessage,
      code: -32603,
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: response.status }
    }
  }]);

  return new Response(syntheticBody, {
    status: 207, // Multi-status — tRPC batch responses use non-200 for errors
    statusText: "Multi-Status",
    headers: { "content-type": "application/json" },
  });
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
