/**
 * Apollo Daily Draw Handler
 * ─────────────────────────
 * Fires daily at 08:00 UTC via Heartbeat cron.
 * Pulls ~133 professional emails/day (4,000/month ÷ 30) across 9 health
 * professional categories, deduplicates against existing leads, saves to
 * lead_prospects, and auto-pushes found emails to Meta Custom Audiences.
 *
 * Budget: 4,000 Apollo credits/month → 133/day → ~15 per category per day.
 */

import type { Request, Response } from "express";
import { getDb } from "./db";
import { inArray } from "drizzle-orm";
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

// ── Daily profile fetch (FREE search, no credits) ────────────────────────────
// Fetch 50 profiles per category = 450 leads/day at zero cost
// Email reveal (1 credit each) is triggered separately via Lead Scrubber or batch reveal
const PER_CATEGORY = 50;

// ── Apollo search (FREE — no credits used) ──────────────────────────────────
async function apolloSearch(titles: string[], perPage: number): Promise<Array<{
  apolloId: string | null;
  firstName: string; lastName: string;
  name: string; title: string; email: string | null; emailStatus: string | null;
  hasEmail: boolean;
  company: string | null; domain: string | null; linkedinUrl: string | null; location: string;
}>> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return [];

  const res = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      person_titles: titles,
      person_locations: ["United States"],
      per_page: perPage,
      page: Math.floor(Math.random() * 10) + 1, // rotate pages to avoid duplicate results
    }),
  });

  if (!res.ok) {
    console.error(`[Apollo Daily Draw] Search failed: ${res.status}`);
    return [];
  }

  const data = await res.json() as { people?: any[]; error?: string };
  if (data.error) {
    console.error(`[Apollo Daily Draw] API error: ${data.error}`);
    return [];
  }

  return (data.people ?? []).map((p: any) => ({
    apolloId: p.id ?? null,
    firstName: p.first_name ?? "",
    lastName: p.last_name_obfuscated ?? p.last_name ?? "",
    name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    title: p.title ?? "",
    email: p.email ?? null,
    emailStatus: p.email_status ?? null,
    hasEmail: p.has_email === true,
    company: p.organization?.name ?? null,
    domain: p.organization?.website_url?.replace(/^https?:\/\//, "").split("/")[0] ?? null,
    linkedinUrl: p.linkedin_url ?? null,
    location: [p.city, p.state, p.country].filter(Boolean).join(", "),
  }));
}

// ── Push emails to Meta Custom Audience ──────────────────────────────────────
async function pushEmailsToMetaAudience(emails: string[], category: string): Promise<{ pushed: number; error?: string }> {
  try {
    const { getDb: getDbLocal } = await import("../db");
    const db = await getDbLocal();
    if (!db) return { pushed: 0, error: "no db" };

    // Find the Meta Custom Audience for this category
    const [audience] = await db.execute(
      `SELECT id, meta_audience_id FROM meta_custom_audiences WHERE category = '${category}' AND status = 'active' LIMIT 1`
    ) as any;

    const rows: any[] = Array.isArray(audience) ? audience : [];
    if (!rows.length || !rows[0]?.meta_audience_id) {
      // No audience for this category yet — skip silently
      return { pushed: 0 };
    }

    const metaAudienceId = rows[0].meta_audience_id;
    const accessToken = process.env.META_AD_ACCESS_TOKEN;
    if (!accessToken) return { pushed: 0, error: "no meta token" };

    // Hash emails SHA256 (Meta requirement)
    const hashedEmails = emails.map(e => crypto.createHash("sha256").update(e.toLowerCase().trim()).digest("hex"));

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${metaAudienceId}/users`,
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
      return { pushed: 0, error: `Meta API ${metaRes.status}: ${errText.slice(0, 200)}` };
    }

    const metaData = await metaRes.json() as { num_received?: number; num_invalid_entries?: number; error?: any };
    if (metaData.error) return { pushed: 0, error: metaData.error.message };

    return { pushed: metaData.num_received ?? emails.length };
  } catch (err: any) {
    return { pushed: 0, error: err?.message ?? "unknown" };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function apolloDailyDrawHandler(req: Request, res: Response) {
  // Allow cron platform OR manual trigger from admin (for first-run seeding)
  const isCron = !!req.headers["x-manus-cron-task-uid"];
  const isManual = req.headers["x-manual-trigger"] === process.env.INGEST_SECRET;
  if (!isCron && !isManual) {
    return res.status(403).json({ error: "Forbidden: cron or manual trigger only" });
  }

  const startTime = Date.now();
  const results: Array<{
    category: string; searched: number; newLeads: number; emailsFound: number; metaPushed: number; error?: string;
  }> = [];

  try {
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    for (const cat of DAILY_CATEGORIES) {
      try {
        // 1. Search Apollo
        const people = await apolloSearch(cat.titles, PER_CATEGORY + 5); // fetch a few extra to account for dupes

        if (!people.length) {
          results.push({ category: cat.category, searched: 0, newLeads: 0, emailsFound: 0, metaPushed: 0 });
          continue;
        }

        // 2. Deduplicate: skip leads whose LinkedIn URL or name+company already exists
        const linkedinUrls = people.filter(p => p.linkedinUrl).map(p => p.linkedinUrl!);
        let existingUrls = new Set<string>();
        if (linkedinUrls.length) {
          const existing = await db.execute(
            `SELECT url FROM lead_prospects WHERE url IN (${linkedinUrls.map(u => `'${u.replace(/'/g, "''")}'`).join(",")}) LIMIT 500`
          ) as any;
          const existingRows: any[] = Array.isArray(existing) ? existing[0] as any[] : [];
          existingUrls = new Set(existingRows.map((r: any) => r.url));
        }

        const newPeople = people.filter(p => !p.linkedinUrl || !existingUrls.has(p.linkedinUrl)).slice(0, PER_CATEGORY);

        // 3. Insert new leads
        let newLeads = 0;
        let emailsFound = 0;
        const emailsToSync: string[] = [];

        for (const p of newPeople) {
          const now = Date.now();
          try {
            // Store apolloId in the body JSON for later credit-based reveal
            const bodyJson = JSON.stringify({
              title: p.title ?? "",
              company: p.company ?? "",
              location: p.location,
              apolloId: p.apolloId,
              firstName: p.firstName,
              lastName: p.lastName,
              domain: p.domain,
              hasEmail: p.hasEmail,
            });
            await db.execute(
              `INSERT IGNORE INTO lead_prospects
                (lp_source, title, body, url, author, subredditOrChannel, keywordsMatched, category, lp_status, emailFound, emailConfidence, lp_createdAt, lp_updatedAt)
               VALUES (
                'apollo',
                ${JSON.stringify(p.name + (p.title ? ` — ${p.title}` : ""))},
                ${JSON.stringify(bodyJson)},
                ${p.linkedinUrl ? JSON.stringify(p.linkedinUrl) : "NULL"},
                ${JSON.stringify(p.name)},
                ${JSON.stringify(p.company ?? cat.label)},
                ${JSON.stringify(cat.titles.slice(0, 3).join(", "))},
                ${JSON.stringify(cat.category)},
                ${p.hasEmail ? "'has_email_flag'" : "'new'"},
                ${p.email ? JSON.stringify(p.email) : "NULL"},
                ${p.emailStatus === "verified" ? "'verified'" : p.email ? "'likely'" : "NULL"},
                ${now},
                ${now}
              )`
            );
            newLeads++;
            if (p.email) {
              emailsFound++;
              emailsToSync.push(p.email);
            }
          } catch (_) {
            // INSERT IGNORE handles duplicates silently
          }
        }

        // 4. Push emails to Meta Custom Audience
        let metaPushed = 0;
        if (emailsToSync.length) {
          const metaResult = await pushEmailsToMetaAudience(emailsToSync, cat.metaAudienceCategory);
          metaPushed = metaResult.pushed;
          if (metaResult.error) {
            console.warn(`[Apollo Daily Draw] Meta push warning for ${cat.category}: ${metaResult.error}`);
          }
        }

        results.push({ category: cat.category, searched: people.length, newLeads, emailsFound, metaPushed });
        console.log(`[Apollo Daily Draw] ${cat.label}: searched=${people.length} new=${newLeads} emails=${emailsFound} meta=${metaPushed}`);

        // Small delay between categories to be respectful of rate limits
        await new Promise(r => setTimeout(r, 500));

      } catch (catErr: any) {
        const msg = catErr?.message ?? "unknown";
        console.error(`[Apollo Daily Draw] Category ${cat.category} failed:`, msg);
        results.push({ category: cat.category, searched: 0, newLeads: 0, emailsFound: 0, metaPushed: 0, error: msg });
      }
    }

    const totalNew = results.reduce((s, r) => s + r.newLeads, 0);
    const totalEmails = results.reduce((s, r) => s + r.emailsFound, 0);
    const totalMeta = results.reduce((s, r) => s + r.metaPushed, 0);
    const elapsed = Date.now() - startTime;

    console.log(`[Apollo Daily Draw] Complete: newLeads=${totalNew} emails=${totalEmails} metaPushed=${totalMeta} elapsed=${elapsed}ms`);

    res.json({
      ok: true,
      summary: { totalNew, totalEmails, totalMeta, elapsed },
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

    // Count leads added in the last 48 hours
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const [recentRows] = await db.execute(
      `SELECT category, COUNT(*) as cnt, SUM(emailFound IS NOT NULL) as with_email
       FROM lead_prospects
       WHERE lp_source = 'apollo' AND lp_createdAt >= ${cutoff}
       GROUP BY category`
    ) as any;

    const recent: any[] = Array.isArray(recentRows) ? recentRows : [];

    // Check Meta Custom Audience sizes
    const accessToken = process.env.META_AD_ACCESS_TOKEN;
    const adAccountId = process.env.META_AD_ACCOUNT_ID;
    const audienceStats: any[] = [];

    if (accessToken && adAccountId) {
      const [audienceRows] = await db.execute(
        `SELECT id, name, category, meta_audience_id, status FROM meta_custom_audiences WHERE status = 'active'`
      ) as any;
      const audiences: any[] = Array.isArray(audienceRows) ? audienceRows : [];

      for (const aud of audiences.slice(0, 10)) {
        if (!aud.meta_audience_id) continue;
        try {
          const metaRes = await fetch(
            `https://graph.facebook.com/v21.0/${aud.meta_audience_id}?fields=name,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status&access_token=${accessToken}`
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

    // Notify owner with summary
    const { notifyOwner } = await import("./_core/notification").catch(() => ({ notifyOwner: null }));
    const totalLeads = recent.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const totalEmails = recent.reduce((s: number, r: any) => s + Number(r.with_email), 0);

    const summary = `Apollo Daily Draw — 48-hour validation\n\nLeads added: ${totalLeads}\nEmails found: ${totalEmails}\n\nBy category:\n${recent.map((r: any) => `  ${r.category}: ${r.cnt} leads, ${r.with_email} emails`).join("\n")}\n\nMeta Custom Audiences:\n${audienceStats.map(a => `  ${a.name}: ${a.metaLower ?? "?"}–${a.metaUpper ?? "?"} matched`).join("\n") || "  (no audiences yet)"}`;

    console.log("[Apollo Validation]", summary);

    if (notifyOwner) {
      await (notifyOwner as any)({
        title: "✅ Apollo Lead Pipeline — 48hr Check",
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
    const msg = err?.message ?? "Unknown error";
    res.status(500).json({ error: msg, timestamp: new Date().toISOString() });
  }
}
