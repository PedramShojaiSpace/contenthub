/**
 * Corpus Builder — Phase C
 *
 * UI for managing the verified content corpus used to ground the Script Factory.
 *
 * Tabs:
 *   1. Search — semantic vector search (with keyword fallback indicator)
 *   2. Library — browse all corpus entries
 *   3. Seed — one-click seed from Analog Data Library or outlier transcripts
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Database,
  Loader2,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar() {
  const { data: stats } = trpc.corpus.getStats.useQuery(undefined, { refetchInterval: 15_000 });

  if (!stats) return null;

  const embeddingPct = stats.total > 0 ? Math.round((stats.embedded / stats.total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Total Entries</p>
        <p className="text-xl font-bold">{stats.total}</p>
      </div>
      <div className="border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Embedded</p>
        <p className="text-xl font-bold text-primary">{stats.embedded}</p>
        <p className="text-xs text-muted-foreground">{embeddingPct}%</p>
      </div>
      <div className="border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Transcripts</p>
        <p className="text-xl font-bold">{stats.transcripts}</p>
      </div>
      <div className="border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Analog Data</p>
        <p className="text-xl font-bold">{stats.analogData}</p>
      </div>
      <div className="border rounded-lg p-3">
        <p className="text-xs text-muted-foreground">Manual</p>
        <p className="text-xl font-bold">{stats.manual}</p>
      </div>
    </div>
  );
}

// ─── Search Tab ───────────────────────────────────────────────────────────────

function SearchTab() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [sourceType, setSourceType] = useState<"all" | "transcript" | "analog_data" | "manual">("all");

  const { data: results, isFetching } = trpc.corpus.searchCorpus.useQuery(
    { query: submitted, topK: 8, sourceType },
    { enabled: submitted.length > 0 }
  );

  const handleSearch = () => {
    if (query.trim().length < 2) return;
    setSubmitted(query.trim());
  };

  return (
    <div className="space-y-5">
      {/* Source type filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(["all", "transcript", "analog_data", "manual"] as const).map((t) => (
          <Button
            key={t}
            variant={sourceType === t ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSourceType(t);
              // Re-run search immediately if a query is already submitted
              if (submitted) setSubmitted(submitted);
            }}
            className="text-xs capitalize"
          >
            {t.replace("_", " ")}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search the corpus... e.g. 'gut health transformation story'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={isFetching || query.trim().length < 2}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {results && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {results.method === "vector" ? (
              <><Sparkles className="w-3.5 h-3.5 text-primary" /><span>Vector similarity search</span></>
            ) : (
              <><Search className="w-3.5 h-3.5" /><span>Keyword fallback search</span></>
            )}
            <span>· {results.results.length} results</span>
          </div>

          {results.results.length === 0 ? (
            <p className="text-muted-foreground text-sm py-6 text-center">No results found. Try different keywords or seed more content.</p>
          ) : (
            results.results.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{r.title ?? `Entry #${r.id}`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs capitalize">{r.sourceType.replace("_", " ")}</Badge>
                      {r.similarity !== null && (
                        <span className="text-xs text-muted-foreground">
                          {(r.similarity * 100).toFixed(1)}% similarity
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{r.wordCount?.toLocaleString()} words</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 font-mono">{r.excerpt}</p>
              </div>
            ))
          )}
        </div>
      )}

      {!submitted && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Enter a query to search the corpus semantically.</p>
          <p className="text-xs mt-1">Uses TiDB vector cosine similarity. Falls back to keyword search if no embedding available.</p>
        </div>
      )}
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const [sourceFilter, setSourceFilter] = useState<"all" | "transcript" | "analog_data" | "manual">("all");
  const { data: entries, refetch, isLoading } = trpc.corpus.listEntries.useQuery({
    sourceType: sourceFilter,
    limit: 100,
    offset: 0,
  });

  const utils = trpc.useUtils();

  const removeEntry = trpc.corpus.removeEntry.useMutation({
    onSuccess: () => {
      toast.success("Entry removed from corpus");
      refetch();
      utils.corpus.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const reEmbed = trpc.corpus.reEmbed.useMutation({
    onSuccess: (r) => {
      toast.success(`Re-embedded (${r.dims} dims)`);
      refetch();
      utils.corpus.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {(["all", "transcript", "analog_data", "manual"] as const).map((t) => (
          <Button
            key={t}
            variant={sourceFilter === t ? "default" : "outline"}
            size="sm"
            onClick={() => setSourceFilter(t)}
            className="text-xs capitalize"
          >
            {t.replace("_", " ")}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : !entries || entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No corpus entries yet. Use the Seed tab to populate the corpus.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-4 font-medium">Title / Source</th>
                <th className="text-center py-2 px-2 font-medium">Type</th>
                <th className="text-right py-2 px-2 font-medium">Words</th>
                <th className="text-center py-2 px-2 font-medium">Embedded</th>
                <th className="text-right py-2 pl-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 max-w-[300px]">
                    <p className="font-medium text-xs line-clamp-1">{row.title ?? `Entry #${row.id}`}</p>
                    {row.sourceId && <p className="text-xs text-muted-foreground font-mono">{row.sourceId}</p>}
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge variant="outline" className="text-xs capitalize">{row.sourceType.replace("_", " ")}</Badge>
                  </td>
                  <td className="text-right py-2 px-2 tabular-nums text-xs">{row.wordCount?.toLocaleString()}</td>
                  <td className="text-center py-2 px-2">
                    {(row as any).hasEmbedding ? (
                      <span className="text-green-600 text-xs">✓</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => reEmbed.mutate({ id: row.id })}
                        disabled={reEmbed.isPending}
                      >
                        Embed
                      </Button>
                    )}
                  </td>
                  <td className="text-right py-2 pl-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={() => removeEntry.mutate({ id: row.id })}
                      disabled={removeEntry.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Seed Tab ─────────────────────────────────────────────────────────────────

function SeedTab() {
  const utils = trpc.useUtils();

  const seedAnalog = trpc.corpus.seedFromAnalogData.useMutation({
    onSuccess: (r) => {
      toast.success(`Seeded ${r.added} entries from Analog Data Library (${r.embedded} embedded, ${r.skipped} skipped)`);
      utils.corpus.getStats.invalidate();
      utils.corpus.listEntries.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const seedTranscripts = trpc.corpus.seedFromOutlierTranscripts.useMutation({
    onSuccess: (r) => {
      toast.success(`Seeded ${r.added} outlier transcripts (${r.embedded} embedded, ${r.skipped} skipped)`);
      utils.corpus.getStats.invalidate();
      utils.corpus.listEntries.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-xl">
      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Seed from Analog Data Library</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Pulls entries from your Analog Data Library that have the <strong>corpus toggle enabled</strong> (winning ads, converting sales pages, customer interviews, surveys) and adds them to the corpus with embeddings. Toggle entries in the Analyze page first.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => seedAnalog.mutate({ overwrite: false })}
            disabled={seedAnalog.isPending}
            className="flex items-center gap-2"
          >
            {seedAnalog.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Seed (skip existing)
          </Button>
          <Button
            variant="outline"
            onClick={() => seedAnalog.mutate({ overwrite: true })}
            disabled={seedAnalog.isPending}
          >
            Re-seed (overwrite all)
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold">Seed from Outlier Transcripts</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Pulls transcripts from videos flagged as outliers (≥1.5σ above baseline) by the Outlier Detector. These are your highest-performing videos — the most valuable corpus content.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => seedTranscripts.mutate({ overwrite: false })}
            disabled={seedTranscripts.isPending}
            className="flex items-center gap-2"
          >
            {seedTranscripts.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Seed Outliers (skip existing)
          </Button>
          <Button
            variant="outline"
            onClick={() => seedTranscripts.mutate({ overwrite: true })}
            disabled={seedTranscripts.isPending}
          >
            Re-seed (overwrite all)
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground border-l-2 border-amber-400 pl-3">
        <strong>Quality gate reminder:</strong> Only proven, converting content belongs in the corpus. The Analog Data Library already enforces this — only seed from it after you've verified the entries are genuinely converting.
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CorpusBuilder() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Corpus Builder
          </h1>
          <p className="text-muted-foreground mt-1">
            Verified, converting content that grounds the Script Factory. Vector search via TiDB cosine similarity.
          </p>
        </div>

        <StatsBar />

        <Tabs defaultValue="search">
          <TabsList>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="seed" className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Seed
            </TabsTrigger>
          </TabsList>
          <TabsContent value="search" className="mt-4">
            <SearchTab />
          </TabsContent>
          <TabsContent value="library" className="mt-4">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="seed" className="mt-4">
            <SeedTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
