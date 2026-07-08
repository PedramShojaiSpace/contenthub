/**
 * HistoricalPosts.tsx
 *
 * Historical WordPress Post Rehabilitation Dashboard.
 *
 * Three tabs:
 * 1. Import   — browse unimported WP posts, select and import them into the content hub
 * 2. Audit    — review imported posts, run AI Yoast audit, fix and push to WP, inject CTA
 * 3. Batch    — run the full pipeline across all imported posts in one shot
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RefreshCw,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Play,
  SkipForward,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "import" | "audit" | "batch";

// ─── Yoast score badge ────────────────────────────────────────────────────────

function YoastBadge({ score }: { score: string | null | undefined }) {
  if (!score) return <Badge variant="outline" className="text-xs text-muted-foreground">Not scored</Badge>;
  const colors: Record<string, string> = {
    good: "bg-green-100 text-green-800 border-green-200",
    ok: "bg-yellow-100 text-yellow-800 border-yellow-200",
    bad: "bg-red-100 text-red-800 border-red-200",
  };
  const labels: Record<string, string> = { good: "Good", ok: "Needs work", bad: "Poor" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[score] ?? "bg-gray-100 text-gray-700"}`}>
      {labels[score] ?? score}
    </span>
  );
}

function RehabBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline" className="text-xs">Not imported</Badge>;
  const map: Record<string, { label: string; cls: string }> = {
    imported: { label: "Imported", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    yoast_fixed: { label: "Yoast Fixed", cls: "bg-purple-100 text-purple-800 border-purple-200" },
    cta_injected: { label: "CTA Injected ✓", cls: "bg-green-100 text-green-800 border-green-200" },
  };
  const info = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${info.cls}`}>
      {info.label}
    </span>
  );
}

// ─── Import Tab ───────────────────────────────────────────────────────────────

function ImportTab() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, refetch } = trpc.historicalPosts.listUnimported.useQuery(
    { search: debouncedSearch, page, pageSize: 50 },
    { placeholderData: (prev: any) => prev }
  );

  const importMutation = trpc.historicalPosts.importPosts.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.created} posts imported into the content hub.`);
      setSelected(new Set());
      refetch();
    },
    onError: (err) => toast.error(`Import failed: ${err.message}`),
  });

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;

  const toggleSelect = (wpPostId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(wpPostId)) next.delete(wpPostId);
      else next.add(wpPostId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(posts.map(p => p.wpPostId)));
  const clearAll = () => setSelected(new Set());

  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as any).__histSearchTimer);
    (window as any).__histSearchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Import Historical Posts</h2>
          <p className="text-sm text-muted-foreground">
            {total} posts from WordPress not yet in the content hub
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
          {selected.size > 0 && (
            <Button
              size="sm"
              onClick={() => importMutation.mutate({ wpPostIds: Array.from(selected) })}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 mr-1.5" />
              )}
              Import {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by title or slug…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* Select controls */}
      {posts.length > 0 && (
        <div className="flex gap-2 text-sm">
          <button className="text-primary hover:underline" onClick={selectAll}>Select all {posts.length}</button>
          <span className="text-muted-foreground">·</span>
          <button className="text-muted-foreground hover:underline" onClick={clearAll}>Clear</button>
          {selected.size > 0 && (
            <span className="text-muted-foreground ml-2">{selected.size} selected</span>
          )}
        </div>
      )}

      {/* Post list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {debouncedSearch ? "No posts match your search." : "All posts have been imported."}
        </div>
      ) : (
        <div className="border rounded-lg divide-y overflow-hidden">
          {posts.map(post => (
            <div
              key={post.wpPostId}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                selected.has(post.wpPostId) ? "bg-primary/5" : "hover:bg-muted/30"
              }`}
              onClick={() => toggleSelect(post.wpPostId)}
            >
              <input
                type="checkbox"
                checked={selected.has(post.wpPostId)}
                onChange={() => toggleSelect(post.wpPostId)}
                className="mt-1 accent-primary"
                onClick={e => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{post.title}</span>
                  {post.topicCluster && (
                    <Badge variant="outline" className="text-xs shrink-0">{post.topicCluster}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>/{post.slug}</span>
                  {post.publishedAt && (
                    <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                  )}
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary flex items-center gap-0.5"
                    onClick={e => e.stopPropagation()}
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * 50 + 1}–{Math.min(page * 50, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({ post, ctaBlocks, onRefresh }: {
  post: {
    id: number;
    wpPostId: number;
    title: string;
    slug: string;
    url: string;
    rehabStatus: string | null;
    yoastScore: string | null;
    topicCluster: string | null;
    suggestedFocusKeyword: string | null;
    suggestedSeoTitle: string | null;
    suggestedMetaDescription: string | null;
    publishedAt: Date | null;
  };
  ctaBlocks: Array<{ id: number; label: string; topic: string | null }>;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [focusKw, setFocusKw] = useState(post.suggestedFocusKeyword ?? "");
  const [seoTitle, setSeoTitle] = useState(post.suggestedSeoTitle ?? "");
  const [metaDesc, setMetaDesc] = useState(post.suggestedMetaDescription ?? "");
  const [selectedCtaId, setSelectedCtaId] = useState<number | undefined>(undefined);

  const auditMutation = trpc.historicalPosts.auditPost.useMutation({
    onSuccess: (res) => {
      setFocusKw(res.suggestions?.focusKeyword ?? "");
      setSeoTitle(res.suggestions?.seoTitle ?? "");
      setMetaDesc(res.suggestions?.metaDescription ?? "");
      toast.success("Yoast audit complete — suggestions generated.");
      onRefresh();
    },
    onError: (err) => toast.error(`Audit failed: ${err.message}`),
  });

  const fixMutation = trpc.historicalPosts.fixYoast.useMutation({
    onSuccess: () => {
      toast.success("Yoast fields pushed to WordPress.");
      onRefresh();
    },
    onError: (err) => toast.error(`Fix failed: ${err.message}`),
  });

  const ctaMutation = trpc.historicalPosts.injectCta.useMutation({
    onSuccess: (res) => {
      toast.success(`CTA "${res.ctaBlockUsed}" injected and pushed to WordPress.`);
      onRefresh();
    },
    onError: (err) => toast.error(`CTA injection failed: ${err.message}`),
  });

  const isBusy = auditMutation.isPending || fixMutation.isPending || ctaMutation.isPending;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{post.title}</span>
            <RehabBadge status={post.rehabStatus} />
            <YoastBadge score={post.yoastScore} />
            {post.topicCluster && (
              <Badge variant="outline" className="text-xs">{post.topicCluster}</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">/{post.slug}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-primary"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t bg-muted/10 px-4 py-4 space-y-4">
          {/* Audit button */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => auditMutation.mutate({ wpPostId: post.wpPostId })}
              disabled={isBusy}
            >
              {auditMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
              Run AI Audit
            </Button>
            <span className="text-xs text-muted-foreground">Generates focus keyword, SEO title, and meta description from the post body.</span>
          </div>

          {/* Yoast fields */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Focus Keyword</label>
              <Input
                value={focusKw}
                onChange={e => setFocusKw(e.target.value)}
                placeholder="e.g. gut health inflammation"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                SEO Title <span className={seoTitle.length > 48 ? "text-red-500" : "text-muted-foreground"}>({seoTitle.length}/48)</span>
              </label>
              <Input
                value={seoTitle}
                onChange={e => setSeoTitle(e.target.value)}
                placeholder="e.g. Gut Health Guide | The Urban Monk"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Meta Description <span className={metaDesc.length > 155 ? "text-red-500" : metaDesc.length >= 140 ? "text-green-600" : "text-muted-foreground"}>({metaDesc.length}/155)</span>
              </label>
              <Textarea
                value={metaDesc}
                onChange={e => setMetaDesc(e.target.value)}
                placeholder="140-155 characters including the focus keyword…"
                className="text-sm resize-none"
                rows={2}
              />
            </div>
          </div>

          {/* Fix Yoast button */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={() => fixMutation.mutate({ wpPostId: post.wpPostId, focusKeyword: focusKw, seoTitle, metaDescription: metaDesc })}
              disabled={isBusy || !focusKw || !seoTitle || !metaDesc}
            >
              {fixMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
              Push Yoast to WordPress
            </Button>

            {/* CTA injection */}
            <div className="flex items-center gap-2">
              <select
                className="text-sm border rounded px-2 py-1.5 bg-background"
                value={selectedCtaId ?? ""}
                onChange={e => setSelectedCtaId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Auto-select CTA by topic</option>
                {ctaBlocks.map(b => (
                  <option key={b.id} value={b.id}>{b.label}{b.topic ? ` (${b.topic})` : ""}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => ctaMutation.mutate({ wpPostId: post.wpPostId, ctaBlockId: selectedCtaId })}
                disabled={isBusy}
              >
                {ctaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                Inject CTA
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit Tab ────────────────────────────────────────────────────────────────

function AuditTab() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "imported" | "yoast_fixed" | "cta_injected">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = trpc.historicalPosts.listImported.useQuery(
    { search, status: statusFilter, page, pageSize: 30 },
    { placeholderData: (prev: any) => prev }
  );

  const { data: ctaBlocks = [] } = trpc.historicalPosts.listCtaBlocks.useQuery();

  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Audit & Fix Imported Posts</h2>
          <p className="text-sm text-muted-foreground">{total} imported posts</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="text-sm border rounded px-3 py-2 bg-background"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1); }}
        >
          <option value="all">All statuses</option>
          <option value="imported">Imported (needs Yoast fix)</option>
          <option value="yoast_fixed">Yoast Fixed (needs CTA)</option>
          <option value="cta_injected">Fully rehabilitated</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No posts match the current filter. Import posts from the Import tab first.
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <AuditRow key={post.wpPostId} post={post} ctaBlocks={ctaBlocks} onRefresh={refetch} />
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
            <Button variant="outline" size="sm" disabled={page * 30 >= total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Batch Tab ────────────────────────────────────────────────────────────────

function BatchTab() {
  const [limit, setLimit] = useState(20);
  const [skipCta, setSkipCta] = useState(false);
  const [results, setResults] = useState<Array<{
    wpPostId: number;
    title: string;
    status: string;
    steps: string[];
    error?: string;
  }> | null>(null);

  const { data: stats, refetch: refetchStats } = trpc.historicalPosts.getStats.useQuery();

  const batchMutation = trpc.historicalPosts.batchFix.useMutation({
    onSuccess: (res) => {
      setResults(res.results);
      toast.success(res.message);
      refetchStats();
    },
    onError: (err) => toast.error(`Batch fix failed: ${err.message}`),
  });

  const pending = (stats?.imported ?? 0) + (stats?.yoastFixed ?? 0);

  return (
    <div className="space-y-6">
      {/* Stats overview */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total in WP", value: stats.total, color: "text-foreground" },
            { label: "Not imported", value: stats.unimported, color: "text-muted-foreground" },
            { label: "Imported", value: stats.imported, color: "text-blue-600" },
            { label: "Yoast Fixed", value: stats.yoastFixed, color: "text-purple-600" },
            { label: "Fully Done", value: stats.ctaInjected, color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="border rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Batch controls */}
      <div className="border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold">Batch Rehabilitation</h2>
        <p className="text-sm text-muted-foreground">
          Runs the full AI pipeline on up to {limit} posts that are not yet fully rehabilitated.
          Each post takes ~10-15 seconds (AI audit + WP API calls).
        </p>

        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Posts per batch</label>
            <select
              className="text-sm border rounded px-3 py-2 bg-background"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
            >
              {[5, 10, 20, 50].map(n => (
                <option key={n} value={n}>{n} posts (~{n * 12}s)</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input
              type="checkbox"
              id="skipCta"
              checked={skipCta}
              onChange={e => setSkipCta(e.target.checked)}
              className="accent-primary"
            />
            <label htmlFor="skipCta" className="text-sm">Skip CTA injection (Yoast fix only)</label>
          </div>
        </div>

        {pending === 0 ? (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            All imported posts have been rehabilitated.
          </div>
        ) : (
          <Button
            onClick={() => batchMutation.mutate({ limit, skipCta })}
            disabled={batchMutation.isPending}
            className="gap-2"
          >
            {batchMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing {limit} posts…</>
            ) : (
              <><Play className="w-4 h-4" /> Run Batch Fix ({pending} pending)</>
            )}
          </Button>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/20 flex items-center justify-between">
            <span className="font-medium text-sm">Batch Results — {results.length} posts processed</span>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-green-600">{results.filter(r => r.status !== "error").length} fixed</span>
              <span className="text-red-500">{results.filter(r => r.status === "error").length} errors</span>
            </div>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {results.map(r => (
              <div key={r.wpPostId} className="flex items-start gap-3 px-4 py-3">
                {r.status === "error" ? (
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.steps.length > 0 ? r.steps.join(" → ") : "No steps taken"}
                    {r.error && <span className="text-red-500 ml-2">{r.error}</span>}
                  </div>
                </div>
                <RehabBadge status={r.status === "cta_injected" ? "cta_injected" : r.status === "fixed" ? "yoast_fixed" : r.status === "error" ? null : r.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HistoricalPosts() {
  const [tab, setTab] = useState<Tab>("import");

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "import", label: "Import" },
    { id: "audit", label: "Audit & Fix" },
    { id: "batch", label: "Batch Fix" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold">Historical Post Rehabilitation</h1>
          <p className="text-muted-foreground mt-1">
            Pull historical WordPress posts into the content hub, fix Yoast SEO issues with AI, and inject calls-to-action.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex border-b gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "import" && <ImportTab />}
        {tab === "audit" && <AuditTab />}
        {tab === "batch" && <BatchTab />}
      </div>
    </DashboardLayout>
  );
}
