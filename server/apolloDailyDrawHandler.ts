/**
 * Apollo Daily Draw Handler
 * ─────────────────────────
 * Fires daily at 08:00 UTC via Heartbeat cron.
 *
 * Strategy:
 *  - Searches Apollo for professionals in 9 wellness categories (US only)
 *  - Uses a SEQUENTIAL page cursor per category (stored in app_settings) so
 *    each daily run fetches a fresh page of profiles — never re-hitting the same people
 *  - Immediately reveals emails for every profile that Apollo flags as having one
 *  - ONLY saves leads that have a real email address (no email = not useful)
 *  - Auto-pushes found emails to Meta Custom Audiences
 *
 * Target: 133 email-verified leads/day
 *   Organization plan: 4,000 export credits/month ÷ 30 days = ~133/day
 *   9 categories × ~15 reveals/category = 135/day
 *
 * Credit usage:
 *   - Search (mixed_people/api_search): FREE — no credits
 *   - Email reveal (GET /api/v1/people/:id): 1 export credit per reveal
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import crypto from "crypto";

// ── Category definitions ──────────────────────────────────────────────────────
const DAILY_CATEGORIES = [
  {
    category: "medical_doctor",
    label: "Medical Doctors (MDs)",
    titles: ["physician", "medical doctor", "internal medicine physician", "family medicine physician", "general practitioner", "integrative physician"],
    metaAudienceCategory: "medical_doctor",
  },
  {
    category: "nurse",
    label: "Nurses & Nurse Practitioners",
    titles: ["nurse practitioner", "registered nurse", "advanced practice nurse", "clinical nurse specialist", "holistic nurse"],
    metaAudienceCategory: "nurse",
  },
  {
    category: "dentist",
    label: "Dentists",
    titles: ["dentist", "dental surgeon", "holistic dentist", "biological dentist", "periodontist"],
    metaAudienceCategory: "dentist",
  },
  {
    category: "wellness_coach",
    label: "Wellness Coaches",
    titles: ["wellness coach", "health coach", "life coach"],
    metaAudienceCategory: "wellness_coach",
  },
  {
    category: "functional_med",
    label: "Functional Medicine",
    titles: ["functional medicine doctor", "integrative medicine physician", "naturopathic doctor"],
    metaAudienceCategory: "functional_med",
  },
  {
    category: "nutritionist",
    label: "Nutritionists",
    titles: ["nutritionist", "dietitian", "holistic nutritionist"],
    metaAudienceCategory: "nutritionist",
  },
  {
    category: "meditation_teacher",
    label: "Meditation Teachers",
    titles: ["meditation teacher", "mindfulness coach", "yoga instructor"],
    metaAudienceCategory: "meditation_teacher",
  },
  {
    category: "biohacker",
    label: "Biohackers / Longevity",
    titles: ["biohacker", "longevity coach", "anti-aging specialist"],
    metaAudienceCategory: "biohacking",
  },
  {
    category: "burnout",
    label: "Stress & Burnout Coaches",
    titles: ["burnout coach", "stress management coach", "executive wellness coach"],
    metaAudienceCategory: "stress",
  },
];

// Per-category: how many profiles to search (free), and max email reveals (costs credits)
const SEARCH_PER_CATEGORY = 50;   // free search — fetch 50 candidates
const MAX_REVEALS_PER_CATEGORY = 15; // ~135 reveals/day total across 9 categories

// ── Email quality guard — checked BEFORE spending a reveal credit ─────────────
// Apollo sometimes returns placeholder or unrevealable emails even when has_email=true.
// These patterns indicate a bad lead that will waste a credit and never convert.
const BLOCKED_EMAIL_PATTERNS = [
  /^email_not_unlocked@/i,
  /^not_unlocked@/i,
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^bounced@/i,
  /^invalid@/i,
  /^placeholder@/i,
  /^test@/i,
  /@domain\.com$/i,
  /@example\.com$/i,
  /@test\.com$/i,
  /@b\.cmail\d+\.com$/i,   // Constant Contact bounce domains
  /@cmail\d+\.com$/i,
  /@mcsv\.net$/i,            // Mailchimp bounce domain
  /@bounce\.com$/i,
];
const BLOCKED_EMAIL_STATUSES = ["invalid", "do_not_email", "spam", "deactivated", "unsubscribed", "bounced"];

function isValidEmail(email: string | null | undefined, status?: string | null): boolean {
  if (!email) return false;
  // Must have exactly one @ and a real TLD
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return false;
  if (BLOCKED_EMAIL_PATTERNS.some(p => p.test(email))) return false;
  if (status && BLOCKED_EMAIL_STATUSES.includes(status.toLowerCase())) return false;
  return true;
}

// ── Page cursor helpers (stored in app_settings) ─────────────────────────────
const CURSOR_KEY_PREFIX = "apollo_page_cursor_";

async function getPageCursor(db: any, category: string): Promise<number> {
  const key = CURSOR_KEY_PREFIX + category;
  const [rows] = await db.execute(
    "SELECT value FROM app_settings WHERE `key` = " + JSON.stringify(key) + " LIMIT 1"
  ) as any[];
  const row = Array.isArray(rows) ? rows[0] : null;
  return row?.value ? parseInt(row.value as string, 10) || 1 : 1;
}

async function advancePageCursor(db: any, category: string, currentPage: number): Promise<void> {
  const key = CURSOR_KEY_PREFIX + category;
  // Apollo has ~100 pages max per search. Reset to 1 after page 95 to avoid empty results.
  const nextPage = currentPage >= 95 ? 1 : currentPage + 1;
  await db.execute(
    "INSERT INTO app_settings (`key`, value) VALUES (" +
    JSON.stringify(key) + ", " + JSON.stringify(String(nextPage)) +
    ") ON DUPLICATE KEY UPDATE value = " + JSON.stringify(String(nextPage))
  );
}

// ── Apollo email reveal (uses 1 export credit per call) ─────────────────────
async function apolloRevealEmail(apolloId: string): Promise<{ email: string | null; emailStatus: string | null }> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey || !apolloId) return { email: null, emailStatus: null };

  const res = await fetch("https://api.apollo.io/api/v1/people/" + apolloId, {
    method: "GET",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
  });

  if (!res.ok) {
    if (res.status === 429 || res.status === 403) {
      throw new Error("CREDIT_LIMIT:" + res.status);
    }
    return { email: null, emailStatus: null };
  }

  const data = await res.json() as { person?: { email?: string; email_status?: string } };
  return {
    email: data.person?.email ?? null,
    emailStatus: data.person?.email_status ?? null,
  };
}

// ── Apollo people search (FREE — no credits used) ────────────────────────────
interface ApolloProfile {
  apolloId: string | null;
  firstName: string;
  lastName: string;
  name: string;
  title: string;
  email: string | null;
  emailStatus: string | null;
  hasEmail: boolean;
  company: string | null;
  domain: string | null;
  linkedinUrl: string | null;
  location: string;
}

async function apolloSearch(titles: string[], perPage: number, page: number): Promise<ApolloProfile[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      person_titles: titles,
      person_locations: ["United States"],
      per_page: perPage,
      page,
    }),
  });

  if (!res.ok) return [];

  const data = await res.json() as { people?: any[]; error?: string };
  if (data.error) return [];

  return (data.people ?? []).map((p: any): ApolloProfile => ({
    apolloId: p.id ?? null,
    firstName: p.first_name ?? "",
    lastName: p.last_name_obfuscated ?? p.last_name ?? "",
    name: p.name ?? ((p.first_name ?? "") + " " + (p.last_name ?? "")).trim(),
    title: p.title ?? "",
    email: p.email ?? null,
    emailStatus: p.email_status ?? null,
    hasEmail: p.has_email === true,
    company: p.organization?.name ?? null,
    domain: (p.organization?.website_url ?? "").replace(/^https?:\/\//, "").split("/")[0] || null,
    linkedinUrl: p.linkedin_url ?? null,
    location: [p.city, p.state, p.country].filter(Boolean).join(", "),
  }));
}

// ── Push emails to Meta Custom Audience ──────────────────────────────────────
async function pushEmailsToMetaAudience(
  emails: string[],
  category: string,
  db: any
): Promise<{ pushed: number; error?: string }> {
  try {
    const [rows] = await db.execute(
      "SELECT meta_audience_id FROM meta_custom_audiences WHERE category = " +
      JSON.stringify(category) +
      " AND status = 'active' LIMIT 1"
    ) as any[];

    const audienceRows: any[] = Array.isArray(rows) ? rows : [];
    if (!audienceRows.length || !audienceRows[0]?.meta_audience_id) {
      return { pushed: 0 };
    }

    const metaAudienceId = audienceRows[0].meta_audience_id as string;
    const accessToken = process.env.META_AD_ACCESS_TOKEN;
    if (!accessToken) return { pushed: 0, error: "no meta token" };

    const hashedEmails = emails.map(e =>
      crypto.createHash("sha256").update(e.toLowerCase().trim()).digest("hex")
    );

    const metaRes = await fetch(
      "https://graph.facebook.com/v21.0/" + metaAudienceId + "/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: {
            schema: ["EMAIL_SHA256"],
            data: hashedEmails.map(h => [h]),
          },
          access_token: accessToken,
        }),
      }
    );

    if (!metaRes.ok) {
      const errText = await metaRes.text();
      return { pushed: 0, error: "Meta API " + metaRes.status + ": " + errText.slice(0, 200) };
    }

    const metaData = await metaRes.json() as { num_received?: number; error?: any };
    if (metaData.error) return { pushed: 0, error: String(metaData.error.message) };
    return { pushed: metaData.num_received ?? emails.length };
  } catch (err: any) {
    return { pushed: 0, error: err?.message ?? "unknown" };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function apolloDailyDrawHandler(req: Request, res: Response) {
  const isCron = !!req.headers["x-manus-cron-task-uid"];
  const isManual = req.headers["x-manual-trigger"] === process.env.INGEST_SECRET;
  if (!isCron && !isManual) {
    return res.status(403).json({ error: "Forbidden: cron or manual trigger only" });
  }

  const startTime = Date.now();
  const results: Array<{
    category: string;
    page: number;
    searched: number;
    withEmailFlag: number;
    revealsAttempted: number;
    emailsFound: number;
    metaPushed: number;
    error?: string;
  }> = [];

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    for (const cat of DAILY_CATEGORIES) {
      try {
        // ── 1. Get the current page cursor for this category ─────────────────
        const page = await getPageCursor(db, cat.category);

        // ── 2. Search Apollo (FREE) ──────────────────────────────────────────
        const people = await apolloSearch(cat.titles, SEARCH_PER_CATEGORY, page);

        if (!people.length) {
          // Empty page — reset cursor to 1 for next run
          await advancePageCursor(db, cat.category, 95); // wraps to 1
          results.push({ category: cat.category, page, searched: 0, withEmailFlag: 0, revealsAttempted: 0, emailsFound: 0, metaPushed: 0 });
          continue;
        }

        // ── 3. Advance cursor for next run ───────────────────────────────────
        await advancePageCursor(db, cat.category, page);

        // ── 4. Deduplicate against existing LinkedIn URLs ────────────────────
        const linkedinUrls = people.filter(p => p.linkedinUrl).map(p => p.linkedinUrl as string);
        let existingUrls = new Set<string>();
        if (linkedinUrls.length) {
          const [existingRows] = await db.execute(
            "SELECT url FROM lead_prospects WHERE url IN (" +
            linkedinUrls.map((u: string) => JSON.stringify(u)).join(",") +
            ") LIMIT 500"
          ) as any[];
          const rows: any[] = Array.isArray(existingRows) ? existingRows : [];
          existingUrls = new Set(rows.map((r: any) => r.url as string));
        }

        const newPeople = people.filter(p => !p.linkedinUrl || !existingUrls.has(p.linkedinUrl));

        // ── 5. Reveal emails — ONLY save leads that have an email ────────────
        const withEmailFlag = newPeople.filter(p => p.hasEmail || !!p.email).length;
        let revealsAttempted = 0;
        let emailsFound = 0;
        let creditLimitHit = false;
        const emailsToSync: string[] = [];

        for (const p of newPeople) {
          const now = Date.now();
          let resolvedEmail = p.email;
          let resolvedEmailStatus = p.emailStatus;

          // Attempt reveal if Apollo signals this person has an email.
          // Guard: if Apollo already returned an email in the search result,
          // validate it first — if it's bad, skip the reveal to save the credit.
          if (resolvedEmail && !isValidEmail(resolvedEmail, resolvedEmailStatus)) {
            resolvedEmail = null; // discard bad pre-filled email
          }

          if (
            !resolvedEmail &&
            p.hasEmail &&
            p.apolloId &&
            revealsAttempted < MAX_REVEALS_PER_CATEGORY &&
            !creditLimitHit
          ) {
            try {
              revealsAttempted++;
              const revealed = await apolloRevealEmail(p.apolloId);
              if (revealed.email && isValidEmail(revealed.email, revealed.emailStatus)) {
                resolvedEmail = revealed.email;
                resolvedEmailStatus = revealed.emailStatus;
              } else if (revealed.email) {
                // Apollo returned an email but it failed quality check — don't save it
                console.warn("[Apollo Daily Draw] Blocked bad email after reveal for " + p.name + ": " + revealed.email);
              }
              await new Promise(r => setTimeout(r, 200));
            } catch (revealErr: any) {
              if ((revealErr?.message ?? "").startsWith("CREDIT_LIMIT")) {
                creditLimitHit = true;
                console.warn("[Apollo Daily Draw] Credit limit hit for " + cat.category);
              }
            }
          }

          // ── CRITICAL: skip this lead if no email was found ────────────────
          if (!resolvedEmail) continue;

          const bodyJson = JSON.stringify({
            title: p.title ?? "",
            company: p.company ?? "",
            location: p.location,
            apolloId: p.apolloId,
            firstName: p.firstName,
            lastName: p.lastName,
            domain: p.domain,
          });

          const sourceId = "apollo_" +
            (p.apolloId || (p.firstName.toLowerCase() + "_" + p.lastName.toLowerCase())) +
            "_" + now;

          const displayTitle = p.name + (p.title ? " \u2014 " + p.title : "");
          const keywordsMatched = cat.titles.slice(0, 3).join(", ");

          const q = (s: string) => JSON.stringify(s);
          const confVal = resolvedEmailStatus === "verified" ? "'verified'" : "'likely'";
          const urlVal = p.linkedinUrl ? q(p.linkedinUrl) : "NULL";

          const insertSql =
            "INSERT IGNORE INTO lead_prospects " +
            "(lp_source, sourceId, title, body, url, author, subredditOrChannel, keywordsMatched, category, lp_status, emailFound, emailConfidence, lp_createdAt, lp_updatedAt) " +
            "VALUES (" +
            "'apollo', " +
            q(sourceId) + ", " +
            q(displayTitle) + ", " +
            q(bodyJson) + ", " +
            urlVal + ", " +
            q(p.name) + ", " +
            q(p.company ?? cat.label) + ", " +
            q(keywordsMatched) + ", " +
            q(cat.category) + ", " +
            "'email_found', " +
            q(resolvedEmail) + ", " +
            confVal + ", " +
            now + ", " +
            now +
            ")";

          try {
            await db.execute(insertSql);
            emailsFound++;
            emailsToSync.push(resolvedEmail);
          } catch (_) {
            // INSERT IGNORE handles duplicates silently
          }
        }

        if (revealsAttempted > 0) {
          console.log("[Apollo Daily Draw] " + cat.label + ": page=" + page + " revealed=" + revealsAttempted + " saved=" + emailsFound);
        }

        // ── 6. Push found emails to Meta Custom Audience ─────────────────────
        let metaPushed = 0;
        if (emailsToSync.length) {
          const metaResult = await pushEmailsToMetaAudience(emailsToSync, cat.metaAudienceCategory, db);
          metaPushed = metaResult.pushed;
          if (metaResult.error) {
            console.warn("[Apollo Daily Draw] Meta push warning for " + cat.category + ": " + metaResult.error);
          }
        }

        results.push({ category: cat.category, page, searched: people.length, withEmailFlag, revealsAttempted, emailsFound, metaPushed });
        console.log(
          "[Apollo Daily Draw] " + cat.label +
          ": page=" + page +
          " searched=" + people.length +
          " hasEmail=" + withEmailFlag +
          " reveals=" + revealsAttempted +
          " saved=" + emailsFound +
          " meta=" + metaPushed
        );

        await new Promise(r => setTimeout(r, 500));

      } catch (catErr: any) {
        const msg = catErr?.message ?? "unknown";
        console.error("[Apollo Daily Draw] Category " + cat.category + " failed:", msg);
        results.push({ category: cat.category, page: 0, searched: 0, withEmailFlag: 0, revealsAttempted: 0, emailsFound: 0, metaPushed: 0, error: msg });
      }
    }

    const totalSearched = results.reduce((s, r) => s + r.searched, 0);
    const totalEmails = results.reduce((s, r) => s + r.emailsFound, 0);
    const totalReveals = results.reduce((s, r) => s + r.revealsAttempted, 0);
    const totalMeta = results.reduce((s, r) => s + r.metaPushed, 0);
    const elapsed = Date.now() - startTime;

    console.log(
      "[Apollo Daily Draw] Complete: searched=" + totalSearched +
      " emails=" + totalEmails +
      " reveals=" + totalReveals +
      " metaPushed=" + totalMeta +
      " elapsed=" + elapsed + "ms"
    );

    res.json({
      ok: true,
      summary: { totalSearched, totalEmails, totalReveals, totalMeta, elapsed },
      categories: results,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    console.error("[Apollo Daily Draw] Fatal:", msg);
    res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}

// ── 2-day validation check handler ───────────────────────────────────────────
export async function apolloAudienceValidationHandler(req: Request, res: Response) {
  const isCron = !!req.headers["x-manus-cron-task-uid"];
  const isManual = req.headers["x-manual-trigger"] === process.env.INGEST_SECRET;
  if (!isCron && !isManual) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const [recentRows] = await db.execute(
      "SELECT category, COUNT(*) as cnt, SUM(emailFound IS NOT NULL) as with_email " +
      "FROM lead_prospects " +
      "WHERE lp_source = 'apollo' AND lp_createdAt >= " + cutoff + " " +
      "GROUP BY category"
    ) as any[];

    const recent: any[] = Array.isArray(recentRows) ? recentRows : [];

    const accessToken = process.env.META_AD_ACCESS_TOKEN;
    const audienceStats: any[] = [];

    if (accessToken) {
      const [audienceRows] = await db.execute(
        "SELECT id, name, category, meta_audience_id FROM meta_custom_audiences WHERE status = 'active'"
      ) as any[];
      const audiences: any[] = Array.isArray(audienceRows) ? audienceRows : [];

      for (const aud of audiences.slice(0, 10)) {
        if (!aud.meta_audience_id) continue;
        try {
          const metaRes = await fetch(
            "https://graph.facebook.com/v21.0/" + aud.meta_audience_id +
            "?fields=name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status&access_token=" + accessToken
          );
          if (metaRes.ok) {
            const metaData = await metaRes.json() as any;
            audienceStats.push({
              name: aud.name,
              category: aud.category,
              metaLower: metaData.approximate_count_lower_bound,
              metaUpper: metaData.approximate_count_upper_bound,
              deliveryStatus: metaData.delivery_status?.code,
            });
          }
        } catch (_) {}
      }
    }

    const { notifyOwner } = await import("./_core/notification").catch(() => ({ notifyOwner: null }));
    const totalLeads = recent.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const totalEmails = recent.reduce((s: number, r: any) => s + Number(r.with_email), 0);

    const summary =
      "Apollo Daily Draw — 48-hour validation\n\n" +
      "Leads added: " + totalLeads + "\n" +
      "Emails found: " + totalEmails + "\n\n" +
      "By category:\n" +
      recent.map((r: any) => "  " + r.category + ": " + r.cnt + " leads, " + r.with_email + " emails").join("\n") + "\n\n" +
      "Meta Custom Audiences:\n" +
      (audienceStats.length
        ? audienceStats.map(a => "  " + a.name + ": " + (a.metaLower ?? "?") + "-" + (a.metaUpper ?? "?") + " matched").join("\n")
        : "  (no audiences yet)");

    if (notifyOwner) {
      await (notifyOwner as any)({
        title: "Apollo Lead Pipeline — 48hr Check",
        content: summary,
      }).catch(() => {});
    }

    res.json({
      ok: true,
      recentLeads: totalLeads,
      recentEmails: totalEmails,
      categories: recent,
      metaAudiences: audienceStats,
      timestamp: new Date().toISOString(),
    });

  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Unknown error", timestamp: new Date().toISOString() });
  }
}
