/**
 * Google Search Console Integration
 * ────────────────────────────────────
 * Provides:
 *  1. OAuth 2.0 authorization URL generation
 *  2. Token exchange and refresh token storage (in DB via userCredentials)
 *  3. Search Analytics API queries: top keywords, top pages, striking-distance keywords
 *
 * Setup flow:
 *  1. GOOGLE_SEARCH_CONSOLE_CLIENT_ID and GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET are in secrets
 *  2. User visits /api/gsc/auth-url to get the authorization link
 *  3. After authorization, callback stores refresh token in userCredentials table
 *  4. SEO Dashboard now shows live data from Search Console
 */

import { google } from "googleapis";

const REDIRECT_URI = "https://content.theurbanmonk.com/api/gsc/callback";

const GSC_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/webmasters", // needed for URL Inspection API
  "https://www.googleapis.com/auth/indexing",   // needed for Indexing API (request indexing)
];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_SEARCH_CONSOLE_CLIENT_ID and GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET must be set in secrets"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/** Generate the one-time authorization URL the owner must visit */
export function getGscAuthUrl(): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: GSC_SCOPES,
    prompt: "consent",
  });
}

/** Exchange authorization code for tokens */
export async function exchangeGscCode(code: string): Promise<{
  refreshToken: string;
  accessToken: string;
}> {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Try revoking access at https://myaccount.google.com/permissions and reconnecting."
    );
  }
  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? "",
  };
}

/** Get an authenticated Search Console client using a stored refresh token */
function getSearchConsoleClient(refreshToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.webmasters({ version: "v3", auth: oauth2Client });
}

/** Get an authenticated OAuth2 client using a stored refresh token (for Indexing API) */
function getOAuthClientWithToken(refreshToken: string) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}

export interface UrlIndexStatus {
  url: string;
  coverageState: string; // e.g. "Submitted and indexed", "URL is not on Google", "Crawled - currently not indexed"
  robotsTxtState: string;
  indexingState: string;
  lastCrawlTime: string | null;
  pageFetchState: string;
  googleCanonical: string | null;
  userCanonical: string | null;
  verdict: "PASS" | "NEUTRAL" | "FAIL";
}

/**
 * Inspect a URL using the Google Search Console URL Inspection API.
 * Returns indexing status and coverage state.
 */
export async function inspectUrl(
  refreshToken: string,
  siteUrl: string,
  inspectionUrl: string
): Promise<UrlIndexStatus> {
  const oauth2Client = getOAuthClientWithToken(refreshToken);

  // Wrap in a 15-second timeout — the URL Inspection API can hang if the token
  // lacks the webmasters scope or the site is not verified in Search Console.
  const timeoutMs = 15_000;
  const inspectPromise = (google as any).searchconsole({ version: "v1", auth: oauth2Client })
    .urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
      },
    });
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("URL Inspection API timed out after 15s. Ensure GSC is reconnected with the webmasters scope.")), timeoutMs)
  );

  const { data } = await Promise.race([inspectPromise, timeoutPromise]);
  const result = data?.inspectionResult ?? {};
  const indexResult = result.indexStatusResult ?? {};
  return {
    url: inspectionUrl,
    coverageState: indexResult.coverageState ?? "Unknown",
    robotsTxtState: indexResult.robotsTxtState ?? "Unknown",
    indexingState: indexResult.indexingState ?? "Unknown",
    lastCrawlTime: indexResult.lastCrawlTime ?? null,
    pageFetchState: indexResult.pageFetchState ?? "Unknown",
    googleCanonical: indexResult.googleCanonical ?? null,
    userCanonical: indexResult.userCanonical ?? null,
    verdict: indexResult.verdict === "PASS" ? "PASS" : indexResult.verdict === "NEUTRAL" ? "NEUTRAL" : "FAIL",
  };
}

/**
 * Request indexing for a URL using the Google Indexing API.
 * Note: This API is officially only for job postings and live streams, but
 * Google processes URL_UPDATED notifications for any URL as a crawl hint.
 */
export async function requestIndexing(
  refreshToken: string,
  pageUrl: string
): Promise<{ success: boolean; message: string }> {
  try {
    const oauth2Client = getOAuthClientWithToken(refreshToken);
    const indexing = (google as any).indexing({ version: "v3", auth: oauth2Client });
    await indexing.urlNotifications.publish({
      requestBody: {
        url: pageUrl,
        type: "URL_UPDATED",
      },
    });
    return { success: true, message: "Indexing request submitted successfully." };
  } catch (err: any) {
    // Fall back to URL Inspection API ping (which also triggers a crawl hint)
    return {
      success: false,
      message: err?.message ?? "Indexing request failed. Use Google Search Console manually.",
    };
  }
}

/** Helper: get date string N days ago in YYYY-MM-DD format */
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export interface QueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Get top queries by clicks over the last 28 days
 */
export async function getTopQueries(
  refreshToken: string,
  siteUrl: string,
  limit = 20
): Promise<QueryRow[]> {
  const sc = getSearchConsoleClient(refreshToken);
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: daysAgo(28),
      endDate: daysAgo(3), // GSC data has ~3 day lag
      dimensions: ["query"],
      rowLimit: limit,
    },
  } as any);
  const data = (res as any).data;
  return ((data.rows ?? []) as any[]).map((r: any) => ({
    query: r.keys[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/**
 * Get top pages by clicks over the last 28 days
 */
export async function getTopPages(
  refreshToken: string,
  siteUrl: string,
  limit = 20
): Promise<PageRow[]> {
  const sc = getSearchConsoleClient(refreshToken);
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: daysAgo(28),
      endDate: daysAgo(3),
      dimensions: ["page"],
      rowLimit: limit,
    },
  } as any);
  const data = (res as any).data;
  return ((data.rows ?? []) as any[]).map((r: any) => ({
    page: r.keys[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
}

/**
 * Get "striking distance" keywords: positions 11–30 with >=10 impressions
 * These are the fastest SEO wins — one good content update can push them to page 1
 */
export async function getStrikingDistanceKeywords(
  refreshToken: string,
  siteUrl: string,
  limit = 30
): Promise<QueryRow[]> {
  const sc = getSearchConsoleClient(refreshToken);
  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: daysAgo(28),
      endDate: daysAgo(3),
      dimensions: ["query"],
      rowLimit: 1000, // fetch more so we can filter client-side
    },
  } as any);
  const data = (res as any).data;
  const rows = ((data.rows ?? []) as any[]).map((r: any) => ({
    query: r.keys[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));
  // Filter: positions 11–30, at least 10 impressions (broad enough to surface real opportunities)
  return rows
    .filter((r: QueryRow) => r.position >= 11 && r.position <= 30 && r.impressions >= 10)
    .sort((a: QueryRow, b: QueryRow) => b.impressions - a.impressions)
    .slice(0, limit);
}

/**
 * Get week-over-week comparison: clicks and impressions for last 7 days vs prior 7 days
 */
export async function getWeekOverWeekSummary(
  refreshToken: string,
  siteUrl: string
): Promise<{
  thisWeekClicks: number;
  lastWeekClicks: number;
  thisWeekImpressions: number;
  lastWeekImpressions: number;
  clicksDelta: number;
  impressionsDelta: number;
}> {
  const sc = getSearchConsoleClient(refreshToken);

  const [thisWeekRes, lastWeekRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: daysAgo(10),
        endDate: daysAgo(3),
        dimensions: [],
        rowLimit: 1,
      },
    } as any),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: daysAgo(17),
        endDate: daysAgo(10),
        dimensions: [],
        rowLimit: 1,
      },
    } as any),
  ]);

  const thisRow = (thisWeekRes as any).data?.rows?.[0] ?? { clicks: 0, impressions: 0 };
  const lastRow = (lastWeekRes as any).data?.rows?.[0] ?? { clicks: 0, impressions: 0 };

  const thisWeekClicks = (thisRow as any).clicks ?? 0;
  const lastWeekClicks = (lastRow as any).clicks ?? 0;
  const thisWeekImpressions = (thisRow as any).impressions ?? 0;
  const lastWeekImpressions = (lastRow as any).impressions ?? 0;

  return {
    thisWeekClicks,
    lastWeekClicks,
    thisWeekImpressions,
    lastWeekImpressions,
    clicksDelta: lastWeekClicks > 0
      ? Math.round(((thisWeekClicks - lastWeekClicks) / lastWeekClicks) * 100)
      : 0,
    impressionsDelta: lastWeekImpressions > 0
      ? Math.round(((thisWeekImpressions - lastWeekImpressions) / lastWeekImpressions) * 100)
      : 0,
  };
}

/**
 * List all Search Console properties the authorized account has access to
 */
export async function listGscSites(refreshToken: string): Promise<string[]> {
  const sc = getSearchConsoleClient(refreshToken);
  const res = await sc.sites.list();
  return (res.data.siteEntry ?? [])
    .map((s: any) => s.siteUrl ?? "")
    .filter(Boolean);
}

export interface RankChangeRow {
  query: string;
  previousPosition: number;
  currentPosition: number;
  /** Positive = dropped (worse), negative = improved */
  drop: number;
}

/**
 * Compare keyword positions between the current 7-day window and the prior 7-day window.
 * Returns keywords that dropped by at least `minDrop` positions, sorted by largest drop first.
 *
 * GSC data has a ~3-day lag, so:
 *   current window:  days 4–10 ago
 *   previous window: days 11–17 ago
 */
export async function getQueryRankChanges(
  refreshToken: string,
  siteUrl: string,
  minDrop = 3,
  limit = 50
): Promise<RankChangeRow[]> {
  const sc = getSearchConsoleClient(refreshToken);

  const [currentRes, previousRes] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: daysAgo(10),
        endDate: daysAgo(4),
        dimensions: ["query"],
        rowLimit: limit,
      },
    } as any),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: daysAgo(17),
        endDate: daysAgo(11),
        dimensions: ["query"],
        rowLimit: limit,
      },
    } as any),
  ]);

  const currentRows: QueryRow[] = ((currentRes as any).data?.rows ?? []).map((r: any) => ({
    query: r.keys[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0,
  }));

  const previousMap = new Map<string, number>();
  for (const r of (previousRes as any).data?.rows ?? []) {
    previousMap.set(r.keys[0] ?? "", r.position ?? 0);
  }

  const drops: RankChangeRow[] = [];
  for (const row of currentRows) {
    const prev = previousMap.get(row.query);
    if (prev === undefined) continue; // new keyword, no comparison
    const drop = row.position - prev; // positive = dropped
    if (drop >= minDrop) {
      drops.push({
        query: row.query,
        previousPosition: prev,
        currentPosition: row.position,
        drop,
      });
    }
  }

  return drops.sort((a, b) => b.drop - a.drop);
}
