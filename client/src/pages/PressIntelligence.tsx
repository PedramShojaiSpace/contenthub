import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Newspaper, Star, TrendingUp, Globe, Mic, Tv, Radio,
  BookOpen, Search, Copy, Sparkles, ChevronLeft, ChevronRight,
  ExternalLink, BarChart3, Tag, Award, Zap
} from "lucide-react";

const TIER_COLORS: Record<string, string> = {
  S: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  A: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  B: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const TIER_LABELS: Record<string, string> = {
  S: "Tier S — Major National",
  A: "Tier A — Industry Authority",
  B: "Tier B — Niche / Podcast",
};

const MEDIUM_ICONS: Record<string, React.ReactNode> = {
  online:    <Globe className="w-3 h-3" />,
  print:     <Newspaper className="w-3 h-3" />,
  podcast:   <Mic className="w-3 h-3" />,
  broadcast: <Tv className="w-3 h-3" />,
  social:    <Star className="w-3 h-3" />,
  radio:     <Radio className="w-3 h-3" />,
};

export default function PressIntelligence() {
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [mediumFilter, setMediumFilter] = useState<string>("all");
  const [bookFilter, setBookFilter] = useState<string>("all");
  const [topicFilter, setTopicFilter] = useState("");
  const [seoFocus, setSeoFocus] = useState("");
  const [seoSnippet, setSeoSnippet] = useState("");
  const [llmBio, setLlmBio] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  const { data: stats } = trpc.press.getStats.useQuery();
  const { data: clusters } = trpc.press.getTopicClusters.useQuery();
  const { data: authorityBlock } = trpc.press.getAuthorityBlock.useQuery({ topic: topicFilter || undefined });
  const { data: listData, isLoading: listLoading } = trpc.press.list.useQuery({
    page,
    limit: 20,
    tier:   tierFilter !== "all" ? (tierFilter as "S"|"A"|"B") : undefined,
    medium: mediumFilter !== "all" ? (mediumFilter as any) : undefined,
    book:   bookFilter !== "all" ? bookFilter : undefined,
    topic:  topicFilter || undefined,
  });

  const seoMutation = trpc.press.generateSEOSnippet.useMutation({
    onSuccess: (data) => { setSeoSnippet(String(data.snippet ?? "")); toast.success("SEO snippet generated"); },
    onError: (e) => toast.error(e.message),
  });

  const llmMutation = trpc.press.generateLLMBio.useMutation({
    onSuccess: (data) => { setLlmBio(String(data.content ?? "")); toast.success("LLM authority bio generated"); },
    onError: (e) => toast.error(e.message),
  });

  const books = stats ? Object.keys(stats.bookCounts) : [];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-400" />
              Press Intelligence
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {stats?.totalHits ?? "—"} verified press placements · {stats?.totalImpressionsFormatted ?? "—"} total reach · SEO &amp; LLM authority signals
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800/60 border border-slate-700">
            <TabsTrigger value="dashboard">Authority Dashboard</TabsTrigger>
            <TabsTrigger value="coverage">Coverage Browser</TabsTrigger>
            <TabsTrigger value="topics">Topic Clusters</TabsTrigger>
            <TabsTrigger value="seo">SEO &amp; LLM Tools</TabsTrigger>
          </TabsList>

          {/* ── Authority Dashboard ─────────────────────────────────────────── */}
          <TabsContent value="dashboard" className="space-y-6 mt-4">
            {/* Tier summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(["S","A","B"] as const).map(tier => (
                <Card key={tier} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={TIER_COLORS[tier]}>{tier === "S" ? "⭐ Tier S" : tier === "A" ? "✦ Tier A" : "· Tier B"}</Badge>
                      <span className="text-3xl font-bold text-white">{stats?.tierCounts[tier] ?? 0}</span>
                    </div>
                    <p className="text-xs text-slate-400">{TIER_LABELS[tier]}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Top outlets by reach */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Top Outlets by Total Reach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats?.topOutlets.map((o, i) => (
                    <div key={o.outlet} className="flex items-center gap-3">
                      <span className="text-slate-500 text-xs w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-200 text-sm truncate">{o.outlet}</span>
                          <span className="text-emerald-400 text-sm font-mono ml-2">{o.impressionsFormatted}</span>
                        </div>
                        <div className="h-1 bg-slate-700 rounded mt-1">
                          <div
                            className="h-1 bg-emerald-500/60 rounded"
                            style={{ width: `${Math.min(100, (o.impressions / (stats.topOutlets[0]?.impressions || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Medium breakdown + Book breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">By Medium</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats && Object.entries(stats.mediumCounts).sort((a,b) => b[1]-a[1]).map(([medium, count]) => (
                      <div key={medium} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-300 text-sm capitalize">
                          {MEDIUM_ICONS[medium]}
                          {medium}
                        </div>
                        <Badge variant="outline" className="text-slate-400 border-slate-600">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base">By Book Campaign</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats && Object.entries(stats.bookCounts).sort((a,b) => b[1]-a[1]).map(([book, count]) => (
                      <div key={book} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                          <BookOpen className="w-3 h-3 text-violet-400" />
                          {book}
                        </div>
                        <Badge variant="outline" className="text-slate-400 border-slate-600">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Authority block preview */}
            {authorityBlock && (
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Live Authority Block (injected into every AI generation)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/50 rounded p-4 border border-slate-700">
                    {authorityBlock.block}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 text-slate-400 hover:text-white"
                    onClick={() => { navigator.clipboard.writeText(authorityBlock.block); toast.success("Copied!"); }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copy
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Coverage Browser ────────────────────────────────────────────── */}
          <TabsContent value="coverage" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <Select value={tierFilter} onValueChange={v => { setTierFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="S">⭐ Tier S</SelectItem>
                  <SelectItem value="A">✦ Tier A</SelectItem>
                  <SelectItem value="B">· Tier B</SelectItem>
                </SelectContent>
              </Select>

              <Select value={mediumFilter} onValueChange={v => { setMediumFilter(v); setPage(1); }}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="All Mediums" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mediums</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="print">Print</SelectItem>
                  <SelectItem value="podcast">Podcast</SelectItem>
                  <SelectItem value="broadcast">Broadcast</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="radio">Radio</SelectItem>
                </SelectContent>
              </Select>

              <Select value={bookFilter} onValueChange={v => { setBookFilter(v); setPage(1); }}>
                <SelectTrigger className="w-52 bg-slate-800 border-slate-700 text-slate-200">
                  <SelectValue placeholder="All Campaigns" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Campaigns</SelectItem>
                  {books.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>

              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Filter by topic..."
                  value={topicFilter}
                  onChange={e => { setTopicFilter(e.target.value); setPage(1); }}
                  className="pl-9 bg-slate-800 border-slate-700 text-slate-200"
                />
              </div>
            </div>

            {/* Results */}
            {listLoading ? (
              <div className="text-slate-400 text-center py-12">Loading coverage...</div>
            ) : (
              <>
                <div className="text-xs text-slate-500">{listData?.total ?? 0} placements</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {listData?.hits.map((h: any) => (
                    <Card key={h.id} className="bg-slate-800/60 border-slate-700 hover:border-slate-500 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`${TIER_COLORS[h.authorityTier]} text-xs`}>{h.authorityTier}</Badge>
                            <span className="flex items-center gap-1 text-slate-400 text-xs">
                              {MEDIUM_ICONS[h.medium]} {h.medium}
                            </span>
                          </div>
                          {h.url && (
                            <a href={h.url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-blue-400 flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-white text-sm font-medium leading-snug">{h.outlet}</p>
                        {h.description && (
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{h.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex gap-1 flex-wrap">
                            {h.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{tag}</span>
                            ))}
                          </div>
                          {h.impressionsFormatted !== "—" && (
                            <span className="text-emerald-400 text-xs font-mono">{h.impressionsFormatted}</span>
                          )}
                        </div>
                        {h.coverageDate && (
                          <p className="text-slate-600 text-xs mt-1">{h.coverageDate}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {(listData?.pages ?? 0) > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button
                      size="sm" variant="outline"
                      disabled={page === 1}
                      onClick={() => setPage(p => p - 1)}
                      className="border-slate-700 text-slate-300"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-slate-400 text-sm">Page {page} of {listData?.pages}</span>
                    <Button
                      size="sm" variant="outline"
                      disabled={page === listData?.pages}
                      onClick={() => setPage(p => p + 1)}
                      className="border-slate-700 text-slate-300"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Topic Clusters ──────────────────────────────────────────────── */}
          <TabsContent value="topics" className="space-y-4 mt-4">
            <p className="text-slate-400 text-sm">
              Topics where Pedram has the most press authority — use these to prioritize content creation and SEO targeting.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {clusters?.map((c) => (
                <Card key={c.topic} className="bg-slate-800/60 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-white font-medium capitalize">{c.topic}</span>
                      </div>
                      <span className="text-emerald-400 text-sm font-mono">{c.impressionsFormatted}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                      <span>{c.count} placements</span>
                      {c.tierS > 0 && <span className="text-yellow-400">⭐ {c.tierS} Tier S</span>}
                      {c.tierA > 0 && <span className="text-blue-400">✦ {c.tierA} Tier A</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {c.topOutlets.slice(0, 3).map((o: string) => (
                        <span key={o} className="text-xs bg-slate-700/60 text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[120px]">{o}</span>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 text-xs text-slate-500 hover:text-violet-300 px-0"
                      onClick={() => { setTopicFilter(c.topic); setActiveTab("coverage"); }}
                    >
                      Browse {c.count} hits →
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── SEO & LLM Tools ─────────────────────────────────────────────── */}
          <TabsContent value="seo" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SEO Snippet Generator */}
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    SEO Authority Bio
                  </CardTitle>
                  <p className="text-slate-400 text-xs">
                    Generates an E-E-A-T optimized bio paragraph using real press data. Use on About pages, press kits, and guest post bios.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Optional topic focus (e.g. 'gut health', 'focus')"
                    value={seoFocus}
                    onChange={e => setSeoFocus(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-slate-200"
                  />
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => seoMutation.mutate({ focus: seoFocus || undefined })}
                    disabled={seoMutation.isPending}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {seoMutation.isPending ? "Generating..." : "Generate SEO Bio"}
                  </Button>
                  {seoSnippet && (
                    <div className="space-y-2">
                      <div className="bg-slate-900/60 rounded p-4 border border-slate-700 text-slate-200 text-sm leading-relaxed">
                        {seoSnippet}
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="text-slate-400 hover:text-white px-0"
                        onClick={() => { navigator.clipboard.writeText(seoSnippet); toast.success("Copied!"); }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy to clipboard
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* LLM Authority Bio */}
              <Card className="bg-slate-800/60 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    LLM Authority Entry
                  </CardTitle>
                  <p className="text-slate-400 text-xs">
                    Generates a Wikipedia-style authority entry + JSON-LD schema + key facts + target queries. Use to improve how AI models cite Pedram.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-slate-900/40 rounded p-3 border border-slate-700 text-xs text-slate-400 space-y-1">
                    <p>Includes: {stats?.tierCounts.S ?? 0} Tier S + {stats?.tierCounts.A ?? 0} Tier A placements</p>
                    <p>Total reach: {stats?.totalImpressionsFormatted ?? "—"}</p>
                  </div>
                  <Button
                    className="w-full bg-violet-600 hover:bg-violet-700 text-white"
                    onClick={() => llmMutation.mutate()}
                    disabled={llmMutation.isPending}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {llmMutation.isPending ? "Generating..." : "Generate LLM Authority Entry"}
                  </Button>
                  {llmBio && (
                    <div className="space-y-2">
                      <div className="bg-slate-900/60 rounded p-4 border border-slate-700 text-slate-200 text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {llmBio}
                      </div>
                      <Button
                        size="sm" variant="ghost"
                        className="text-slate-400 hover:text-white px-0"
                        onClick={() => { navigator.clipboard.writeText(llmBio); toast.success("Copied!"); }}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy to clipboard
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Strategy explainer */}
            <Card className="bg-slate-800/40 border-slate-700/50">
              <CardContent className="p-5">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-yellow-400" />
                  How This Improves Your SEO &amp; LLM Rankings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-400">
                  <div>
                    <p className="text-slate-200 font-medium mb-1">Google E-E-A-T</p>
                    <p>Every piece of content generated by this app now includes your verified press authority signals in the LLM prompt — so the output naturally references your credentials and coverage, making it easier for Google to recognize you as an authoritative source.</p>
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium mb-1">LLM Citation Training</p>
                    <p>The LLM Authority Entry generates Wikipedia-style structured content and JSON-LD schema. Publishing this on your site gives AI models (GPT, Claude, Gemini) factual, citable content to reference when users ask about wellness, meditation, or focus experts.</p>
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium mb-1">Backward &amp; Forward Linking</p>
                    <p>The Topic Clusters show where you have the most press authority. Create new content on those exact topics to reinforce existing rankings. Link back to the original press coverage where possible — this creates a citation web that both Google and LLMs can follow.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
