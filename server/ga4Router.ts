/**
 * Google Analytics 4 (GA4) Router
 *
 * Provides:
 *  - getAuthUrl: generate OAuth URL for GA4 Data API access
 *  - getStatus: check if GA4 is connected
 *  - fetchReport: pull sessions, users, top pages, traffic sources for a given property + date range
 *
 * Two properties supported:
 *  - Main site:     395413090  (theurbanmonk.com)
 *  - Kajabi Academy: 462310116 (Academy)
 *
 * Uses the same Google OAuth credentials as Google Search Console
 * (GOOGLE_SEARCH_CONSOLE_CLIENT_ID / GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET)
 * since both are enabled on the same Google Cloud project.
 *
 * Setup:
 *  1. Visit /api/ga4/auth-url to get the authorization link
 *  2. Authorize — callback stores refresh token in userCredentials.ga4RefreshToken
 *  3. Use fetchReport to pull live data
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { userCredentials } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { google } from "googleapis";

// ─── Config ───────────────────────────────────────────────────────────────────

const GA4_REDIRECT_URI =
  process.env.GA4_REDIRECT_URI ??
  "https://content.theurbanmonk.com/api/ga4/callback";

const GA4_SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

export const GA4_PROPERTIES: Record<string, { label: string; propertyId: string }> = {
  main: {
    label: "Main Site (theurbanmonk.com)",
    propertyId: "395413090",
  },
  academy: {
    label: "Kajabi Academy",
    propertyId: "462310116",
  },
};

// ─── OAuth helpers ────────────────────────────────────────────────────────────

function getOAuthClient() {
  const clientId = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_SEARCH_CONSOLE_CLIENT_ID and GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET must be set in secrets"
    );
  }
  return new google.auth.OAuth2(clientId, clientSecret, GA4_REDIRECT_URI);
}

export function getGa4AuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    scope: GA4_SCOPES,
    prompt: "consent",
  });
}

export async function exchangeGa4Code(code: string): Promise<{ refreshToken: string }> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke access at https://myaccount.google.com/permissions and try again."
    );
  }
  return { refreshToken: tokens.refresh_token };
}

async function getGa4Client() {
  const db = await getDb();
  let refreshToken: string | null = null;

  if (db) {
    try {
      const [creds] = await db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, 1))
        .limit(1);
      refreshToken = (creds as any)?.ga4RefreshToken ?? null;
    } catch {
      // fall through
    }
  }

  if (!refreshToken) {
    refreshToken = process.env.GA4_REFRESH_TOKEN ?? null;
  }

  if (!refreshToken) {
    throw new Error(
      "GA4 is not connected. Please authorize via the GA4 Analytics page."
    );
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// ─── GA4 Data API helpers ─────────────────────────────────────────────────────

interface Ga4ReportRow {
  [key: string]: string;
}

async function runGa4Report(
  propertyId: string,
  dateRange: { startDate: string; endDate: string },
  dimensions: string[],
  metrics: string[],
  limit = 10
): Promise<Ga4ReportRow[]> {
  const auth = await getGa4Client();

  const analyticsData = google.analyticsdata({ version: "v1beta", auth });

  const response = await analyticsData.properties.runReport({
    property: `properties/${propertyId}`,
    requestBody: {
      dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
      dimensions: dimensions.map((name) => ({ name })),
      metrics: metrics.map((name) => ({ name })),
      limit,
      orderBys: metrics.length > 0 ? [{ metric: { metricName: metrics[0] }, desc: true }] : undefined,
    },
  });

  const rows = response.data.rows ?? [];
  const dimHeaders = response.data.dimensionHeaders?.map((h) => h.name ?? "") ?? [];
  const metHeaders = response.data.metricHeaders?.map((h) => h.name ?? "") ?? [];

  return rows.map((row) => {
    const obj: Ga4ReportRow = {};
    (row.dimensionValues ?? []).forEach((v, i) => {
      obj[dimHeaders[i]] = v.value ?? "";
    });
    (row.metricValues ?? []).forEach((v, i) => {
      obj[metHeaders[i]] = v.value ?? "";
    });
    return obj;
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const ga4Router = router({

  // ── Connection status ──────────────────────────────────────────────────────
  getStatus: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { connected: false, properties: GA4_PROPERTIES };

    try {
      const [creds] = await db
        .select()
        .from(userCredentials)
        .where(eq(userCredentials.userId, 1))
        .limit(1);
      const connected = !!(creds as any)?.ga4RefreshToken;
      return { connected, properties: GA4_PROPERTIES };
    } catch {
      return { connected: false, properties: GA4_PROPERTIES };
    }
  }),

  // ── Get OAuth authorization URL ────────────────────────────────────────────
  getAuthUrl: publicProcedure.query(() => {
    try {
      return { url: getGa4AuthUrl() };
    } catch (e: any) {
      return { url: null, error: e.message };
    }
  }),

  // ── Fetch full analytics report for a property ─────────────────────────────
  fetchReport: publicProcedure
    .input(
      z.object({
        propertyKey: z.enum(["main", "academy"]).default("main"),
        startDate: z.string().default("30daysAgo"),
        endDate: z.string().default("today"),
      })
    )
    .query(async ({ input }) => {
      const property = GA4_PROPERTIES[input.propertyKey];
      if (!property) throw new Error("Unknown property key");

      const dateRange = { startDate: input.startDate, endDate: input.endDate };

      // Run all queries in parallel
      const [overviewRows, topPagesRows, trafficSourceRows, deviceRows, countryRows] =
        await Promise.all([
          // Overview: sessions, users, new users, bounce rate, avg session duration
          runGa4Report(
            property.propertyId,
            dateRange,
            ["date"],
            ["sessions", "totalUsers", "newUsers", "bounceRate", "averageSessionDuration"],
            90
          ),
          // Top pages by views
          runGa4Report(
            property.propertyId,
            dateRange,
            ["pagePath", "pageTitle"],
            ["screenPageViews", "sessions", "bounceRate", "averageSessionDuration"],
            20
          ),
          // Traffic sources
          runGa4Report(
            property.propertyId,
            dateRange,
            ["sessionDefaultChannelGroup"],
            ["sessions", "totalUsers", "newUsers"],
            10
          ),
          // Device category
          runGa4Report(
            property.propertyId,
            dateRange,
            ["deviceCategory"],
            ["sessions", "totalUsers"],
            5
          ),
          // Top countries
          runGa4Report(
            property.propertyId,
            dateRange,
            ["country"],
            ["sessions", "totalUsers"],
            10
          ),
        ]);

      // Aggregate overview totals
      const totalSessions = overviewRows.reduce(
        (s, r) => s + parseInt(r["sessions"] ?? "0", 10),
        0
      );
      const totalUsers = overviewRows.reduce(
        (s, r) => s + parseInt(r["totalUsers"] ?? "0", 10),
        0
      );
      const totalNewUsers = overviewRows.reduce(
        (s, r) => s + parseInt(r["newUsers"] ?? "0", 10),
        0
      );
      const avgBounceRate =
        overviewRows.length > 0
          ? overviewRows.reduce(
              (s, r) => s + parseFloat(r["bounceRate"] ?? "0"),
              0
            ) / overviewRows.length
          : 0;
      const avgSessionDuration =
        overviewRows.length > 0
          ? overviewRows.reduce(
              (s, r) => s + parseFloat(r["averageSessionDuration"] ?? "0"),
              0
            ) / overviewRows.length
          : 0;

      return {
        property: { key: input.propertyKey, ...property },
        dateRange,
        summary: {
          totalSessions,
          totalUsers,
          totalNewUsers,
          avgBounceRate: Math.round(avgBounceRate * 1000) / 10, // as %
          avgSessionDurationSec: Math.round(avgSessionDuration),
        },
        dailyTrend: overviewRows.map((r) => ({
          date: r["date"],
          sessions: parseInt(r["sessions"] ?? "0", 10),
          users: parseInt(r["totalUsers"] ?? "0", 10),
          newUsers: parseInt(r["newUsers"] ?? "0", 10),
        })),
        topPages: topPagesRows.map((r) => ({
          path: r["pagePath"],
          title: r["pageTitle"],
          views: parseInt(r["screenPageViews"] ?? "0", 10),
          sessions: parseInt(r["sessions"] ?? "0", 10),
          bounceRate: Math.round(parseFloat(r["bounceRate"] ?? "0") * 1000) / 10,
          avgDurationSec: Math.round(parseFloat(r["averageSessionDuration"] ?? "0")),
        })),
        trafficSources: trafficSourceRows.map((r) => ({
          channel: r["sessionDefaultChannelGroup"],
          sessions: parseInt(r["sessions"] ?? "0", 10),
          users: parseInt(r["totalUsers"] ?? "0", 10),
          newUsers: parseInt(r["newUsers"] ?? "0", 10),
        })),
        devices: deviceRows.map((r) => ({
          device: r["deviceCategory"],
          sessions: parseInt(r["sessions"] ?? "0", 10),
          users: parseInt(r["totalUsers"] ?? "0", 10),
        })),
        countries: countryRows.map((r) => ({
          country: r["country"],
          sessions: parseInt(r["sessions"] ?? "0", 10),
          users: parseInt(r["totalUsers"] ?? "0", 10),
        })),
      };
    }),
});
