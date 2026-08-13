import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { ReactNode } from "react";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "./const";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined") return;
  if (error.message === UNAUTHED_ERR_MSG) window.location.href = getLoginUrl();
};

const TRANSIENT_PATTERNS = [
  "temporarily unavailable",
  "ai service",
  "bad gateway",
  "gateway timeout",
  "service unavailable",
];

const isTransientError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return TRANSIENT_PATTERNS.some((pattern) => message.includes(pattern));
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== "updated" || event.action.type !== "error") return;
  const error = event.query.state.error;
  redirectToLoginIfUnauthorized(error);
  if (isTransientError(error)) {
    console.warn("[API Query Transient]", error instanceof Error ? error.message : error);
  } else {
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type !== "updated" || event.action.type !== "error") return;
  const error = event.mutation.state.error;
  redirectToLoginIfUnauthorized(error);
  if (isTransientError(error)) {
    console.warn("[API Mutation Transient]", error instanceof Error ? error.message : error);
  } else {
    console.error("[API Mutation Error]", error);
  }
});

async function safeTrpcFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
  if (response.ok) return response;

  const text = await response.text();
  const trimmed = text.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return new Response(trimmed, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  const isTransient =
    [500, 502, 503, 504].includes(response.status) ||
    /service unavailable|bad gateway|gateway timeout|^<!doctype|^<html/i.test(trimmed);
  const message = isTransient
    ? "The AI service is temporarily unavailable. Please try again in a moment."
    : `Request failed (${response.status}): ${trimmed.slice(0, 120)}`;
  console.warn(`[safeTrpcFetch] Non-JSON response (${response.status}): ${trimmed.slice(0, 80)}`);
  throw new Error(message);
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: safeTrpcFetch,
      methodOverride: "POST",
    }),
  ],
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
