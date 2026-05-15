/**
 * fetchUtils.ts
 *
 * Shared utilities for safe HTTP fetch + JSON parsing.
 *
 * The core problem: many external APIs (and our own internal forge proxy) return
 * plain-text or HTML error pages (e.g. "Service Unavailable", "<html>...") on
 * transient 5xx errors. Calling res.json() on these crashes with a cryptic
 * "Unexpected token '<'" or "Unexpected token 'S'" error.
 *
 * safeParseJson() reads the response body as text first, detects HTML/plain-text
 * errors, and throws a clean Error with a user-readable message.
 */

const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

/**
 * Detects whether a response body is an HTML or plain-text error page
 * rather than valid JSON.
 */
export function isHtmlOrPlainError(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.startsWith("<")) return true; // HTML page
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[") && !trimmed.startsWith('"')) {
    // Plain text — check for known error phrases
    const lower = trimmed.toLowerCase();
    return (
      lower.includes("service unavailable") ||
      lower.includes("bad gateway") ||
      lower.includes("gateway timeout") ||
      lower.includes("temporarily unavailable") ||
      lower.includes("internal server error") ||
      lower.includes("upstream connect error") ||
      lower.includes("error 502") ||
      lower.includes("error 503") ||
      lower.includes("error 504")
    );
  }
  return false;
}

/**
 * Reads a fetch Response as text, detects HTML/plain-text error pages,
 * and either returns the parsed JSON or throws a clean Error.
 *
 * @param res        The fetch Response object
 * @param context    Human-readable context for error messages (e.g. "WordPress upload")
 * @param retryable  If true, prefixes the error with "TRANSIENT:" so callers can retry
 */
export async function safeParseJson<T = unknown>(
  res: Response,
  context: string,
  retryable = true
): Promise<T> {
  const body = await res.text();
  const trimmed = body.trim();

  // Transient HTTP status — always retryable
  if (TRANSIENT_STATUS_CODES.has(res.status)) {
    const prefix = retryable ? "TRANSIENT: " : "";
    throw new Error(
      `${prefix}${context} is temporarily unavailable (${res.status}). Please try again in a moment.`
    );
  }

  // HTML or plain-text error body
  if (isHtmlOrPlainError(trimmed)) {
    const preview = trimmed.slice(0, 120).replace(/\s+/g, " ");
    const prefix = retryable ? "TRANSIENT: " : "";
    throw new Error(
      `${prefix}${context} returned an unexpected response (${res.status}): ${preview}`
    );
  }

  // Non-OK status with JSON body — parse and surface
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = JSON.parse(trimmed) as Record<string, unknown>;
      detail = String(errJson.message ?? errJson.error ?? errJson.detail ?? trimmed.slice(0, 200));
    } catch {
      detail = trimmed.slice(0, 200);
    }
    throw new Error(`${context} failed (${res.status}): ${detail}`);
  }

  // Happy path — parse JSON
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`${context} returned invalid JSON: ${trimmed.slice(0, 200)}`);
  }
}

/**
 * Convenience wrapper: fetch + safeParseJson in one call.
 * Throws a clean error on HTML/plain-text responses or non-OK status.
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  init: RequestInit,
  context: string,
  retryable = true
): Promise<T> {
  const res = await fetch(url, init);
  return safeParseJson<T>(res, context, retryable);
}
