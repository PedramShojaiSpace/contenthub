/**
 * Topic Tree Router — Script Factory v2.1
 *
 * THE PROBLEM THIS SOLVES (operator-verified):
 * With one analog source and one persona, flat idea generation converges. Every
 * batch re-orbits the same 4–5 top-level themes with reworded titles, because the
 * prompt keeps seeing the same context and the only pressure against repetition
 * is a growing exclusion list. Exclusion lists suppress duplicates; they do not
 * create depth.
 *
 * The fix is structural rather than prompt-level: decompose the source into a
 * hierarchy once, then generate ideas *scoped to a branch*. A branch is a much
 * smaller conceptual box, so the model is forced into specifics ("post-meal
 * bloating triggers") instead of orbiting the trunk ("gut health").
 *
 * WHY A MATERIALIZED PATH:
 * `path` stores ancestor ids as "12/47" (self excluded). Lineage and subtree
 * queries become single indexed lookups rather than recursive round-trips, which
 * matters because the UI renders counts for every node on every paint.
 *
 * SEPARATE FILE, DELIBERATELY: scriptFactoryRouter.ts is already ~2,300 lines.
 * The spec allowed either; this is reported in the build notes.
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  analogDataEntries,
  personas,
  scriptFactoryOutputs,
  suggestedIdeas,
  topicNodes,
} from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { invokeLLM } from "./_core/llm";
import { parseLLMJson } from "./llmUtils";
import { vidiqBalance, vidiqKeywordResearch } from "./vidiq";
import {
  TITLE_PACKAGING_RULES,
  isoWeekLabel,
  makeBatchId,
  normalizeKeyword,
  parseJsonColumn,
  safeJsonParse,
} from "./scriptFactoryHelpers";

/** Hard cap from the spec. Root is depth 0, so depth 5 is the deepest insertable. */
const MAX_DEPTH = 5;

/** VidIQ keyword research costs ~5 credits; don't start a node call below this. */
const MIN_VIDIQ_CREDITS_FOR_NODE = 10;

type VidiqNodePayload = {
  keyword: string;
  volume: number;
  competition: number;
  opportunityScore: number;
  estimatedMonthlySearch: number;
  topRelatedKeywords: { keyword: string; overall: number; volume: number }[];
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Normalize a label for duplicate detection: lowercase, strip punctuation and
 * filler words, collapse whitespace. "The 'Normal' Labs Problem" and
 * "normal labs problem" must collide.
 */
export function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|and|or|of|for|to|in|on|your|my)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Two labels are "near duplicates" if normalized forms match or one contains the other. */
export function isNearDuplicate(a: string, b: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Containment only counts when the shorter side is substantial, so "gut" does
  // not swallow "gut microbiome imbalance".
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length >= 8 && longer.includes(shorter);
}

/** Ancestor ids for a node, oldest first, parsed from the materialized path. */
export function ancestorIds(path: string): number[] {
  if (!path) return [];
  return path
    .split("/")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** The path a child of this node should carry. */
export function childPath(node: { id: number; path: string }): string {
  return node.path ? `${node.path}/${node.id}` : String(node.id);
}

/**
 * Render a node's lineage as a breadcrumb ("Gut → Bloating → Post-Meal Triggers").
 * Loads ancestors in one query using the materialized path.
 */
async function buildBreadcrumb(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  node: { id: number; label: string; path: string }
): Promise<string> {
  const ids = ancestorIds(node.path);
  if (ids.length === 0) return node.label;
  const rows = await db
    .select({ id: topicNodes.id, label: topicNodes.label })
    .from(topicNodes)
    .where(inArray(topicNodes.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r.label]));
  const chain = ids.map((id) => byId.get(id) ?? "?");
  chain.push(node.label);
  return chain.join(" → ");
}

/** Best-effort persona context block, mirroring the Script Factory's own approach. */
async function loadPersonaContext(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  personaId: number | null | undefined
): Promise<string> {
  if (!personaId) return "";
  const rows = await db.select().from(personas).where(eq(personas.id, personaId)).limit(1);
  const p = rows[0];
  if (!p) return "";
  const pains = safeJsonParse<string[]>(p.painPoints)?.slice(0, 6) ?? [];
  const aspirations = safeJsonParse<string[]>(p.aspirations)?.slice(0, 6) ?? [];
  const questions = safeJsonParse<string[]>(p.topQuestions)?.slice(0, 8) ?? [];
  const parts = [`PERSONA: ${p.name}`];
  if (p.description) parts.push(p.description.slice(0, 600));
  if (pains.length) parts.push(`Pain points: ${pains.join(" | ")}`);
  if (aspirations.length) parts.push(`Aspirations: ${aspirations.join(" | ")}`);
  if (questions.length) parts.push(`Top questions: ${questions.join(" | ")}`);
  return parts.join("\n");
}

/**
 * One VidIQ keyword lookup for a node label, gated on a confirmed balance.
 * Returns null on any failure — research is a flavour, never a hard dependency.
 */
async function tryNodeResearch(label: string): Promise<VidiqNodePayload | null> {
  try {
    const balance = await vidiqBalance();
    const credits = typeof balance?.credits === "number" ? balance.credits : null;
    if (credits !== null && credits < MIN_VIDIQ_CREDITS_FOR_NODE) return null;
  } catch {
    // Balance endpoint down is not a reason to skip; the call itself may still work.
  }
  try {
    const keyword = normalizeKeyword(label);
    const research = await vidiqKeywordResearch(keyword, true);
    if (!research) return null;
    return {
      keyword,
      volume: research.volume ?? 0,
      competition: research.competition ?? 0,
      // The interface exposes the opportunity score as `overall`, not
      // `opportunityScore` — verified against server/vidiq.ts.
      opportunityScore: research.overall ?? 0,
      estimatedMonthlySearch: research.estimatedMonthlySearch ?? 0,
      topRelatedKeywords: (research.related ?? []).slice(0, 10),
    };
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const topicTreeRouter = router({
  /**
   * Decompose the analog library into 6–10 root clusters.
   *
   * Idempotent by design: near-duplicate roots are skipped, so re-running after
   * adding new analog data only contributes novel clusters.
   */
  buildTopicMap: protectedProcedure
    .input(
      z.object({
        analogDataEntryIds: z.array(z.number()).optional(),
        personaId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const analogRows = await db
        .select({
          id: analogDataEntries.id,
          title: analogDataEntries.title,
          type: analogDataEntries.type,
          content: analogDataEntries.content,
          extractedInsights: analogDataEntries.extractedInsights,
        })
        .from(analogDataEntries)
        .where(
          input.analogDataEntryIds && input.analogDataEntryIds.length > 0
            ? inArray(analogDataEntries.id, input.analogDataEntryIds)
            : undefined
        )
        .limit(12);

      if (analogRows.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No analog data found. Add at least one converting asset (sales page, ad, interview) in Analyze first.",
        });
      }

      // Give the model real source text — this extraction is only as good as the
      // excerpt it sees, so allow a generous budget per entry.
      const analogContext = analogRows
        .map((r) => {
          const insights = safeJsonParse<{ hooks?: string[]; painPoints?: string[] }>(
            r.extractedInsights
          );
          const hooks = insights?.hooks?.slice(0, 4).join(" | ") ?? "";
          const pains = insights?.painPoints?.slice(0, 6).join(" | ") ?? "";
          return [
            `[Entry #${r.id}] ${r.title ?? "(untitled)"} (${r.type})`,
            hooks ? `Known hooks: ${hooks}` : "",
            pains ? `Known pain points: ${pains}` : "",
            `Content excerpt:\n${(r.content ?? "").slice(0, 6000)}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n---\n\n");

      const personaContext = await loadPersonaContext(db, input.personaId);

      const existingRoots = await db
        .select({ id: topicNodes.id, label: topicNodes.label })
        .from(topicNodes)
        .where(and(eq(topicNodes.depth, 0), eq(topicNodes.status, "active")));

      const exclusions =
        existingRoots.length > 0
          ? `\n\nEXISTING ROOT CLUSTERS (do NOT repeat these — only propose genuinely new territory):\n${existingRoots
              .map((r) => `- ${r.label}`)
              .join("\n")}`
          : "";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a content strategist decomposing proven converting copy into a TOPIC MAP for Dr. Pedram Shojai (The Urban Monk).

Your job: read the analog source material and extract 6-10 ROOT TOPIC CLUSTERS — the major territories of thought this material opens up. These become the trunk of a content tree that will be drilled into for months.

COVERAGE REQUIREMENT (all four categories must be represented):
1. Core pains and symptoms explicitly named in the source.
2. The central mechanism or product theme (what the offer actually claims to fix, and how).
3. Audience frustration with prior solutions (what they already tried and why it failed them).
4. Desired transformations (who they become on the other side).

RULES FOR CLUSTERS:
- Each cluster must be a distinct TERRITORY, not a video title. "Bloating & Gas" is a territory; "7 Foods That Cause Bloating" is a video inside it.
- Clusters must be mutually exclusive. If two clusters would generate overlapping videos, merge them and add a different territory.
- Each must be deep enough to support 10+ videos, and narrow enough to be recognizable.
- Ground every cluster in the source material. Do not import generic wellness themes that the source never raises.
- Label: 2-5 words, plain language the audience would use about themselves.
- Description: one sentence naming what lives in this branch.
- sourceEntryId: the [Entry #N] number this cluster came from, or null if it emerged from several.

Return JSON: { "clusters": [ { "label": string, "description": string, "sourceEntryId": number|null } ] }`,
          },
          {
            role: "user",
            content: `ANALOG SOURCE MATERIAL:\n${analogContext}\n\n${personaContext}${exclusions}\n\nExtract 6-10 root topic clusters covering all four required categories.`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "topic_clusters",
            strict: true,
            schema: {
              type: "object",
              properties: {
                clusters: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      description: { type: "string" },
                      sourceEntryId: { type: ["number", "null"] },
                    },
                    required: ["label", "description", "sourceEntryId"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["clusters"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      const parsed = parseLLMJson<{
        clusters: { label: string; description: string; sourceEntryId: number | null }[];
      }>(raw);
      const clusters = parsed?.clusters ?? [];

      if (clusters.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The model returned no topic clusters. Try again, or add richer analog data.",
        });
      }

      // Duplicate guard runs against existing roots AND within this batch, so a
      // model that repeats itself cannot create sibling twins.
      const acceptedLabels: string[] = existingRoots.map((r) => r.label);
      const toInsert: { label: string; description: string; sourceEntryId: number | null }[] = [];
      const skipped: string[] = [];

      for (const c of clusters) {
        const label = (c.label ?? "").trim();
        if (!label) continue;
        if (acceptedLabels.some((existing) => isNearDuplicate(existing, label))) {
          skipped.push(label);
          continue;
        }
        acceptedLabels.push(label);
        toInsert.push({ label, description: c.description ?? "", sourceEntryId: c.sourceEntryId });
      }

      const validEntryIds = new Set(analogRows.map((r) => r.id));
      let insertedCount = 0;
      if (toInsert.length > 0) {
        await db.insert(topicNodes).values(
          toInsert.map((c) => ({
            parentId: null,
            path: "",
            depth: 0,
            label: c.label.slice(0, 255),
            description: c.description || null,
            sourceType: "analog_extraction" as const,
            // Only trust an attribution that names a row we actually loaded.
            analogDataEntryId:
              c.sourceEntryId && validEntryIds.has(c.sourceEntryId)
                ? c.sourceEntryId
                : analogRows.length === 1
                  ? analogRows[0].id
                  : null,
            personaId: input.personaId ?? null,
            status: "active" as const,
          }))
        );
        insertedCount = toInsert.length;
      }

      const roots = await db
        .select()
        .from(topicNodes)
        .where(and(eq(topicNodes.depth, 0), eq(topicNodes.status, "active")))
        .orderBy(desc(topicNodes.createdAt));

      return {
        proposed: clusters.length,
        inserted: insertedCount,
        skippedDuplicates: skipped.length,
        skippedLabels: skipped,
        roots: roots.map((r) => ({
          ...r,
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(r.vidiqData, null),
        })),
        analogEntriesUsed: analogRows.length,
      };
    }),

  /**
   * Split one node into `count` strictly-narrower children.
   *
   * The ancestor chain is passed to the model as a breadcrumb so it understands
   * where it already is — without that, "expand" drifts back toward the trunk.
   */
  expandTopicNode: protectedProcedure
    .input(
      z.object({
        nodeId: z.number(),
        count: z.number().min(3).max(10).default(6),
        useResearch: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const nodeRows = await db
        .select()
        .from(topicNodes)
        .where(eq(topicNodes.id, input.nodeId))
        .limit(1);
      const node = nodeRows[0];
      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Topic node ${input.nodeId} not found` });
      }
      if (node.status === "archived") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This topic is archived. Restore it before expanding.",
        });
      }
      // Refuse cleanly at the cap rather than inserting an over-deep child.
      if (node.depth >= MAX_DEPTH) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Depth limit reached (max ${MAX_DEPTH}). This branch is as deep as the tree goes — generate ideas here instead.`,
        });
      }

      const breadcrumb = await buildBreadcrumb(db, node);

      const existingChildren = await db
        .select({ label: topicNodes.label })
        .from(topicNodes)
        .where(and(eq(topicNodes.parentId, node.id), eq(topicNodes.status, "active")));

      let analogExcerpt = "";
      if (node.analogDataEntryId) {
        const rows = await db
          .select({ title: analogDataEntries.title, content: analogDataEntries.content })
          .from(analogDataEntries)
          .where(eq(analogDataEntries.id, node.analogDataEntryId))
          .limit(1);
        if (rows[0]) {
          analogExcerpt = `SOURCE MATERIAL (${rows[0].title ?? "untitled"}):\n${(rows[0].content ?? "").slice(0, 4000)}`;
        }
      }

      // Research flavour: prefer stored data, otherwise try one affordable call.
      let vidiq = parseJsonColumn<VidiqNodePayload | null>(node.vidiqData, null);
      if (!vidiq && input.useResearch) {
        vidiq = await tryNodeResearch(node.label);
        if (vidiq) {
          await db
            .update(topicNodes)
            .set({ vidiqData: vidiq, updatedAt: new Date() })
            .where(eq(topicNodes.id, node.id));
        }
      }
      const researchBlock = vidiq
        ? `\n\nSEARCH DEMAND for "${vidiq.keyword}" (volume ${vidiq.volume}, competition ${vidiq.competition}, opportunity ${vidiq.opportunityScore}).\nRelated searches to mine for subtopics: ${vidiq.topRelatedKeywords
            .slice(0, 8)
            .map((k) => k.keyword)
            .join(" | ")}`
        : "";

      const exclusions =
        existingChildren.length > 0
          ? `\n\nEXISTING SUBTOPICS under this node (do NOT repeat or paraphrase these):\n${existingChildren
              .map((c) => `- ${c.label}`)
              .join("\n")}`
          : "";

      const personaContext = await loadPersonaContext(db, node.personaId);

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are decomposing one branch of a content topic tree for Dr. Pedram Shojai (The Urban Monk).

CURRENT BRANCH: ${breadcrumb}
CURRENT DEPTH: ${node.depth} (children will be depth ${node.depth + 1}; the tree stops at depth ${MAX_DEPTH})

Your job: split THIS node into exactly ${input.count} child subtopics.

HARD RULES:
1. STRICTLY NARROWER. Every child must be a subset of "${node.label}". If a child could sit at the same level as "${node.label}", or belongs under a different ancestor, it is wrong.
2. MUTUALLY DISTINCT. No two children may overlap. If two children would generate the same video, replace one.
3. PROGRESSIVE SPECIFICITY. You are ${node.depth} level(s) deep. Children must be noticeably more specific than the parent — mechanisms, triggers, timeframes, populations, foods, tests, failure modes.
4. NOT VIDEO TITLES. These are territories that will each spawn many videos. "Post-Meal Bloating Triggers" is right; "5 Foods That Bloat You" is a video, not a territory.
5. GROUNDED. Stay inside what the source material and audience actually raise.

Label: 2-6 words. Description: one sentence naming what lives inside.

Return JSON: { "children": [ { "label": string, "description": string } ] }`,
          },
          {
            role: "user",
            content: `BRANCH TO EXPAND: ${breadcrumb}\nDescription: ${node.description ?? "(none)"}\n\n${analogExcerpt}\n\n${personaContext}${researchBlock}${exclusions}\n\nProduce exactly ${input.count} strictly-narrower, mutually-distinct child subtopics.`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "topic_children",
            strict: true,
            schema: {
              type: "object",
              properties: {
                children: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["label", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["children"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      const parsed = parseLLMJson<{ children: { label: string; description: string }[] }>(raw);
      const children = parsed?.children ?? [];

      if (children.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The model returned no subtopics. Try again.",
        });
      }

      const accepted: string[] = existingChildren.map((c) => c.label);
      const toInsert: { label: string; description: string }[] = [];
      const skipped: string[] = [];
      for (const c of children) {
        const label = (c.label ?? "").trim();
        if (!label) continue;
        // Guard against duplicating a sibling and against restating the parent.
        if (
          accepted.some((existing) => isNearDuplicate(existing, label)) ||
          isNearDuplicate(node.label, label)
        ) {
          skipped.push(label);
          continue;
        }
        accepted.push(label);
        toInsert.push({ label, description: c.description ?? "" });
      }

      if (toInsert.length > 0) {
        await db.insert(topicNodes).values(
          toInsert.map((c) => ({
            parentId: node.id,
            path: childPath(node),
            depth: node.depth + 1,
            label: c.label.slice(0, 255),
            description: c.description || null,
            sourceType: "llm_expansion" as const,
            analogDataEntryId: node.analogDataEntryId ?? null,
            personaId: node.personaId ?? null,
            status: "active" as const,
          }))
        );
      }

      const inserted = await db
        .select()
        .from(topicNodes)
        .where(and(eq(topicNodes.parentId, node.id), eq(topicNodes.status, "active")))
        .orderBy(topicNodes.id);

      return {
        nodeId: node.id,
        breadcrumb,
        proposed: children.length,
        inserted: toInsert.length,
        skippedDuplicates: skipped.length,
        skippedLabels: skipped,
        researchUsed: vidiq !== null,
        children: inserted.map((r) => ({
          ...r,
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(r.vidiqData, null),
        })),
      };
    }),

  /**
   * `suggestIdeas` scoped to one branch.
   *
   * The dedup context is deliberately wider than the node itself: ideas from the
   * ancestor chain and from siblings are excluded too, because those are exactly
   * the near-misses a branch-scoped prompt would otherwise re-derive.
   */
  generateIdeasForNode: protectedProcedure
    .input(
      z.object({
        nodeId: z.number(),
        count: z.number().min(1).max(12).default(6),
        /**
         * Provenance for the generated rows. The UI leaves this default; the
         * weekly cron passes "weekly_auto" so its rotation batches are
         * distinguishable from operator-triggered ones (and so the cron's
         * one-batch-per-week idempotency guard can find them).
         */
        source: z.enum(["manual_generate", "weekly_auto"]).default("manual_generate"),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const nodeRows = await db
        .select()
        .from(topicNodes)
        .where(eq(topicNodes.id, input.nodeId))
        .limit(1);
      const node = nodeRows[0];
      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Topic node ${input.nodeId} not found` });
      }

      const breadcrumb = await buildBreadcrumb(db, node);
      const personaContext = await loadPersonaContext(db, node.personaId);

      let analogExcerpt = "";
      if (node.analogDataEntryId) {
        const rows = await db
          .select({ title: analogDataEntries.title, content: analogDataEntries.content })
          .from(analogDataEntries)
          .where(eq(analogDataEntries.id, node.analogDataEntryId))
          .limit(1);
        if (rows[0]) {
          analogExcerpt = `BRANCH SOURCE MATERIAL (${rows[0].title ?? "untitled"}):\n${(rows[0].content ?? "").slice(0, 5000)}`;
        }
      }

      // ── Dedup context: this node + ancestors + siblings, last 90 days ────────
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const lineage = ancestorIds(node.path);
      const siblingRows = node.parentId
        ? await db
            .select({ id: topicNodes.id })
            .from(topicNodes)
            .where(eq(topicNodes.parentId, node.parentId))
        : [];
      const relatedNodeIds = Array.from(
        new Set<number>([node.id, ...lineage, ...siblingRows.map((s) => s.id)])
      );

      const branchIdeas = await db
        .select({ topic: suggestedIdeas.topic, nodeId: suggestedIdeas.topicNodeId })
        .from(suggestedIdeas)
        .where(
          and(
            inArray(suggestedIdeas.topicNodeId, relatedNodeIds),
            gte(suggestedIdeas.createdAt, ninetyDaysAgo)
          )
        )
        .limit(200);

      const sameNodeIdeas = branchIdeas.filter((i) => i.nodeId === node.id).map((i) => i.topic);
      const nearbyIdeas = branchIdeas.filter((i) => i.nodeId !== node.id).map((i) => i.topic);

      // Global exclusions carried over from v2: the script library and the
      // operator's dismissed/disliked signals.
      const libraryScripts = await db
        .select({ topic: scriptFactoryOutputs.topic })
        .from(scriptFactoryOutputs)
        .orderBy(desc(scriptFactoryOutputs.createdAt))
        .limit(60);

      const dismissedRows = await db
        .select({ topic: suggestedIdeas.topic })
        .from(suggestedIdeas)
        .where(and(eq(suggestedIdeas.status, "dismissed"), gte(suggestedIdeas.createdAt, ninetyDaysAgo)))
        .limit(80);

      const vidiq = parseJsonColumn<VidiqNodePayload | null>(node.vidiqData, null);
      const researchBlock = vidiq
        ? `SEARCH DEMAND for this branch ("${vidiq.keyword}"): volume ${vidiq.volume}, competition ${vidiq.competition}, opportunity ${vidiq.opportunityScore}.\nRelated searches: ${vidiq.topRelatedKeywords
            .slice(0, 8)
            .map((k) => `${k.keyword} (vol ${k.volume})`)
            .join(" | ")}`
        : "No search data for this branch — rely on the source material and persona.";

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a YouTube content strategist for Dr. Pedram Shojai (The Urban Monk).

You are generating ${input.count} video ideas for ONE SPECIFIC BRANCH of a topic tree:

    ${breadcrumb}

AUDIENCE: Health-conscious professionals aged 35-55. High-achievers who feel something is missing. They want energy, clarity, longevity, stress relief, gut health, sleep — ancient wisdom validated by modern science.

BRANCH DISCIPLINE (the whole point of this feature):
1. Every idea must live INSIDE "${node.label}". An idea that would fit equally well under a sibling branch is a failure.
2. Every idea must attack a DIFFERENT SUB-ANGLE of this specific branch. If two ideas could share a thumbnail, replace one.
3. Go deeper than the branch label. Name mechanisms, timeframes, specific foods/tests/symptoms, specific failure modes.
4. Do not drift up to the parent topic. "${breadcrumb}" is your box; stay in it.

${TITLE_PACKAGING_RULES}

For each idea return:
- topic: the video title, following the TITLE PACKAGING RULES above
- rationale: 1-2 sentences on why this converts for this audience
- audienceAlignment: number 0-100
- contentGap: what gap this fills
- recommendedFormat: one of youtube_script, short_form, email, ad_copy, sales_page_section, podcast_outline
- recommendedPatterns: 2-4 of hook, pain_point, proof_element, objection_handler, cta, story_structure, key_phrase, transformation_arc, authority_signal, social_proof, open_loop
- subAngle: the specific sub-angle of this branch you are attacking (used to verify distinctness)

Return JSON: { "ideas": [...] } with exactly ${input.count} ideas.`,
          },
          {
            role: "user",
            content: `BRANCH: ${breadcrumb}\nBranch description: ${node.description ?? "(none)"}\n\n${analogExcerpt}\n\n${personaContext}\n\n${researchBlock}\n\nIDEAS ALREADY GENERATED FOR THIS EXACT BRANCH (never repeat or paraphrase):\n${sameNodeIdeas.length > 0 ? sameNodeIdeas.map((t) => `- ${t}`).join("\n") : "(none yet)"}\n\nIDEAS FROM PARENT AND SIBLING BRANCHES (avoid colliding with these):\n${nearbyIdeas.length > 0 ? nearbyIdeas.slice(0, 40).map((t) => `- ${t}`).join("\n") : "(none)"}\n\nSCRIPTS ALREADY IN THE LIBRARY (do not echo):\n${libraryScripts.map((s) => `- ${s.topic}`).join("\n") || "(none)"}\n\nDISMISSED IDEAS (strongest negative signal — never resurface):\n${dismissedRows.map((s) => `- ${s.topic}`).join("\n") || "(none)"}\n\nGenerate exactly ${input.count} ideas that live strictly inside "${node.label}", each attacking a different sub-angle, all obeying the title packaging rules.`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "node_ideas",
            strict: true,
            schema: {
              type: "object",
              properties: {
                ideas: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      rationale: { type: "string" },
                      audienceAlignment: { type: "number" },
                      contentGap: { type: "string" },
                      recommendedFormat: { type: "string" },
                      recommendedPatterns: { type: "array", items: { type: "string" } },
                      subAngle: { type: "string" },
                    },
                    required: [
                      "topic",
                      "rationale",
                      "audienceAlignment",
                      "contentGap",
                      "recommendedFormat",
                      "recommendedPatterns",
                      "subAngle",
                    ],
                    additionalProperties: false,
                  },
                },
              },
              required: ["ideas"],
              additionalProperties: false,
            },
          },
        },
      });

      const raw = String(response?.choices?.[0]?.message?.content ?? "{}");
      const parsed = parseLLMJson<{
        ideas: {
          topic: string;
          rationale: string;
          audienceAlignment: number;
          contentGap: string;
          recommendedFormat: string;
          recommendedPatterns: string[];
          subAngle: string;
        }[];
      }>(raw);
      const ideas = parsed?.ideas ?? [];

      if (ideas.length === 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "The model returned no ideas for this branch. Try again.",
        });
      }

      const batchId = makeBatchId();
      const weekLabel = isoWeekLabel();

      const rows = ideas
        .filter((i) => i.topic && i.topic.trim().length > 0)
        .map((i) => ({
          batchId,
          weekLabel,
          source: input.source,
          topic: i.topic.slice(0, 500),
          rationale: i.rationale ?? null,
          audienceAlignment:
            typeof i.audienceAlignment === "number" ? Math.round(i.audienceAlignment) : null,
          contentGap: i.contentGap ?? null,
          recommendedFormat: i.recommendedFormat?.slice(0, 64) ?? null,
          recommendedPatterns: Array.isArray(i.recommendedPatterns) ? i.recommendedPatterns : [],
          analogDataSource: node.label,
          analogDataEntryId: node.analogDataEntryId ?? null,
          personaId: node.personaId ?? null,
          vidiqData: vidiq ?? null,
          seedKeyword: vidiq?.keyword?.slice(0, 255) ?? null,
          status: "suggested" as const,
          topicNodeId: node.id,
        }));

      if (rows.length > 0) {
        await db.insert(suggestedIdeas).values(rows);
      }

      // Stamp the mine time — this is what drives weekly cron rotation.
      await db
        .update(topicNodes)
        .set({ lastMinedAt: new Date(), updatedAt: new Date() })
        .where(eq(topicNodes.id, node.id));

      const savedRaw = await db
        .select()
        .from(suggestedIdeas)
        .where(eq(suggestedIdeas.batchId, batchId))
        .orderBy(desc(suggestedIdeas.audienceAlignment));

      return {
        nodeId: node.id,
        breadcrumb,
        batchId,
        weekLabel,
        inserted: rows.length,
        ideas: savedRaw.map((r) => ({
          ...r,
          recommendedPatterns: parseJsonColumn<string[]>(r.recommendedPatterns, []),
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(r.vidiqData, null),
        })),
      };
    }),

  /** The operator typing an idea straight in, optionally scoped to a branch. */
  createManualIdea: protectedProcedure
    .input(
      z.object({
        topic: z.string().min(3).max(500),
        topicNodeId: z.number().optional(),
        personaId: z.number().optional(),
        analogDataEntryId: z.number().optional(),
        rationale: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      // Inherit branch context so a manual idea is as well-provenanced as a
      // generated one.
      let inheritedPersonaId = input.personaId ?? null;
      let inheritedAnalogId = input.analogDataEntryId ?? null;
      let branchLabel: string | null = null;

      if (input.topicNodeId) {
        const rows = await db
          .select()
          .from(topicNodes)
          .where(eq(topicNodes.id, input.topicNodeId))
          .limit(1);
        const node = rows[0];
        if (!node) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Topic node ${input.topicNodeId} not found`,
          });
        }
        branchLabel = node.label;
        inheritedPersonaId = inheritedPersonaId ?? node.personaId ?? null;
        inheritedAnalogId = inheritedAnalogId ?? node.analogDataEntryId ?? null;
      }

      const batchId = makeBatchId();
      const weekLabel = isoWeekLabel();

      await db.insert(suggestedIdeas).values({
        batchId,
        weekLabel,
        source: "manual",
        topic: input.topic.trim().slice(0, 500),
        rationale: input.rationale?.trim() || "Entered manually by the operator.",
        audienceAlignment: null,
        contentGap: null,
        recommendedFormat: "youtube_script",
        recommendedPatterns: [],
        analogDataSource: branchLabel,
        analogDataEntryId: inheritedAnalogId,
        personaId: inheritedPersonaId,
        vidiqData: null,
        seedKeyword: null,
        status: "suggested",
        topicNodeId: input.topicNodeId ?? null,
      });

      const saved = await db
        .select()
        .from(suggestedIdeas)
        .where(eq(suggestedIdeas.batchId, batchId))
        .limit(1);

      const row = saved[0];
      return {
        idea: row
          ? {
              ...row,
              recommendedPatterns: parseJsonColumn<string[]>(row.recommendedPatterns, []),
              vidiqData: parseJsonColumn<VidiqNodePayload | null>(row.vidiqData, null),
            }
          : null,
      };
    }),

  /** Manual node anywhere in the tree, with the same depth cap as expansion. */
  createManualNode: protectedProcedure
    .input(
      z.object({
        parentId: z.number().optional(),
        label: z.string().min(2).max(255),
        description: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      let parent: typeof topicNodes.$inferSelect | undefined;
      if (input.parentId) {
        const rows = await db
          .select()
          .from(topicNodes)
          .where(eq(topicNodes.id, input.parentId))
          .limit(1);
        parent = rows[0];
        if (!parent) {
          throw new TRPCError({ code: "NOT_FOUND", message: `Parent node ${input.parentId} not found` });
        }
        if (parent.depth >= MAX_DEPTH) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `Depth limit reached (max ${MAX_DEPTH}). Add ideas to this branch instead of another level.`,
          });
        }
      }

      // Sibling duplicate guard, matching the automated paths.
      const siblings = await db
        .select({ label: topicNodes.label })
        .from(topicNodes)
        .where(
          and(
            parent ? eq(topicNodes.parentId, parent.id) : eq(topicNodes.depth, 0),
            eq(topicNodes.status, "active")
          )
        );
      if (siblings.some((s) => isNearDuplicate(s.label, input.label))) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A sibling topic already covers "${input.label}".`,
        });
      }

      await db.insert(topicNodes).values({
        parentId: parent?.id ?? null,
        path: parent ? childPath(parent) : "",
        depth: parent ? parent.depth + 1 : 0,
        label: input.label.trim().slice(0, 255),
        description: input.description?.trim() || null,
        sourceType: "manual",
        analogDataEntryId: parent?.analogDataEntryId ?? null,
        personaId: parent?.personaId ?? null,
        status: "active",
      });

      const created = await db
        .select()
        .from(topicNodes)
        .where(
          and(
            parent ? eq(topicNodes.parentId, parent.id) : eq(topicNodes.depth, 0),
            eq(topicNodes.label, input.label.trim().slice(0, 255))
          )
        )
        .orderBy(desc(topicNodes.id))
        .limit(1);

      return { node: created[0] ?? null };
    }),

  /**
   * The whole active tree, flat, each node carrying `path` plus counts.
   *
   * FLAT, deliberately: the client nests it in one pass, and a flat payload keeps
   * this a fixed three-query endpoint no matter how deep the tree grows.
   */
  listTopicTree: protectedProcedure
    .input(
      z.object({
        includeArchived: z.boolean().default(false),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const nodes = await db
        .select()
        .from(topicNodes)
        .where(input.includeArchived ? undefined : eq(topicNodes.status, "active"))
        .orderBy(topicNodes.depth, topicNodes.id);

      // Direct idea counts in one grouped query.
      const directCounts = await db
        .select({
          nodeId: suggestedIdeas.topicNodeId,
          count: sql<number>`COUNT(*)`,
        })
        .from(suggestedIdeas)
        .groupBy(suggestedIdeas.topicNodeId);

      const directMap = new Map<number, number>();
      for (const row of directCounts) {
        if (row.nodeId != null) directMap.set(row.nodeId, Number(row.count));
      }

      const childCount = new Map<number, number>();
      for (const n of nodes) {
        if (n.parentId != null) {
          childCount.set(n.parentId, (childCount.get(n.parentId) ?? 0) + 1);
        }
      }

      // Subtree counts computed in-process from the materialized paths: deepest
      // first, so each node can absorb totals its children already finished.
      const subtreeMap = new Map<number, number>();
      const byDepthDesc = [...nodes].sort((a, b) => b.depth - a.depth);
      for (const n of byDepthDesc) {
        const own = directMap.get(n.id) ?? 0;
        const accumulated = subtreeMap.get(n.id) ?? 0;
        const total = own + accumulated;
        subtreeMap.set(n.id, total);
        if (n.parentId != null) {
          subtreeMap.set(n.parentId, (subtreeMap.get(n.parentId) ?? 0) + total);
        }
      }

      return {
        nodes: nodes.map((n) => ({
          ...n,
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(n.vidiqData, null),
          directIdeaCount: directMap.get(n.id) ?? 0,
          subtreeIdeaCount: subtreeMap.get(n.id) ?? 0,
          childCount: childCount.get(n.id) ?? 0,
        })),
        totalNodes: nodes.length,
        rootCount: nodes.filter((n) => n.depth === 0).length,
      };
    }),

  /** Ideas belonging to one node, for the drill panel. */
  listNodeIdeas: protectedProcedure
    .input(z.object({ nodeId: z.number(), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const node = (
        await db.select().from(topicNodes).where(eq(topicNodes.id, input.nodeId)).limit(1)
      )[0];
      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Topic node ${input.nodeId} not found` });
      }
      const rows = await db
        .select()
        .from(suggestedIdeas)
        .where(eq(suggestedIdeas.topicNodeId, input.nodeId))
        .orderBy(desc(suggestedIdeas.createdAt))
        .limit(input.limit);

      return {
        breadcrumb: await buildBreadcrumb(db, node),
        node: {
          ...node,
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(node.vidiqData, null),
        },
        ideas: rows.map((r) => ({
          ...r,
          recommendedPatterns: parseJsonColumn<string[]>(r.recommendedPatterns, []),
          vidiqData: parseJsonColumn<VidiqNodePayload | null>(r.vidiqData, null),
        })),
      };
    }),

  /**
   * Rename or archive. Archiving cascades to the subtree via the materialized
   * path — ideas are never deleted, they simply belong to an archived branch.
   */
  updateNode: protectedProcedure
    .input(
      z.object({
        nodeId: z.number(),
        label: z.string().min(2).max(255).optional(),
        description: z.string().max(2000).optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const node = (
        await db.select().from(topicNodes).where(eq(topicNodes.id, input.nodeId)).limit(1)
      )[0];
      if (!node) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Topic node ${input.nodeId} not found` });
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.label !== undefined) patch.label = input.label.trim().slice(0, 255);
      if (input.description !== undefined) patch.description = input.description.trim() || null;
      if (input.status !== undefined) patch.status = input.status;

      await db.update(topicNodes).set(patch).where(eq(topicNodes.id, input.nodeId));

      // Cascade status to descendants: their path contains this node's id.
      let cascaded = 0;
      if (input.status !== undefined) {
        const prefix = childPath(node);
        const descendants = await db
          .select({ id: topicNodes.id })
          .from(topicNodes)
          .where(or(eq(topicNodes.path, prefix), like(topicNodes.path, `${prefix}/%`)));
        if (descendants.length > 0) {
          await db
            .update(topicNodes)
            .set({ status: input.status, updatedAt: new Date() })
            .where(
              inArray(
                topicNodes.id,
                descendants.map((d) => d.id)
              )
            );
          cascaded = descendants.length;
        }
      }

      const updated = (
        await db.select().from(topicNodes).where(eq(topicNodes.id, input.nodeId)).limit(1)
      )[0];

      return {
        node: updated
          ? { ...updated, vidiqData: parseJsonColumn<VidiqNodePayload | null>(updated.vidiqData, null) }
          : null,
        cascadedDescendants: cascaded,
      };
    }),
});
