/**
 * Intelligence Dashboard
 * ─────────────────────
 * A single view showing exactly what data is powering every content generation:
 * - Per-persona enrichment status (survey pain points, source, age)
 * - Press authority signals (outlet count, tier breakdown, last seeded)
 * - YouTube CI status (tracked channels, recent analyses)
 * - Typeform forms connected (response counts, last run)
 * - Overall "intelligence score" per persona
 *
 * This page makes the feedback loop visible and actionable.
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Brain,
  Award,
  Youtube,
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  Users,
  Zap,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date | string | null): string {
  if (!date) return "never";
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function intelligenceScore(persona: any): number {
  let score = 0;
  // Pain points: up to 40 pts (5 pts each, max 8)
  score += Math.min(persona.painCount * 5, 40);
  // Aspirations: up to 20 pts (5 pts each, max 4)
  score += Math.min(persona.aspirationCount * 5, 20);
  // Recency: up to 20 pts (fresh = 20, >30d = 10, >90d = 5, never = 0)
  if (persona.enrichedAt) {
    const days = Math.floor((Date.now() - new Date(persona.enrichedAt).getTime()) / 86400000);
    if (days <= 7) score += 20;
    else if (days <= 30) score += 15;
    else if (days <= 90) score += 10;
    else score += 5;
  }
  // Response count: up to 20 pts
  if (persona.surveyResponseCount > 500) score += 20;
  else if (persona.surveyResponseCount > 100) score += 15;
  else if (persona.surveyResponseCount > 20) score += 10;
  else if (persona.surveyResponseCount > 0) score += 5;
  return Math.min(score, 100);
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  if (score >= 20) return "text-orange-500";
  return "text-red-500";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 50) return "Good";
  if (score >= 20) return "Partial";
  return "Empty";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function IntelligenceDashboard() {
  const { data: enrichmentSummary = [], isLoading: loadingPersonas, refetch: refetchPersonas } =
    trpc.personas.getEnrichmentSummary.useQuery();

  const { data: pressStats, isLoading: loadingPress } = trpc.press.getStats.useQuery();

  const { data: trackedChannels = [], isLoading: loadingChannels } =
    trpc.youtube.listTrackedChannels.useQuery();

  const { data: mediaStats } = trpc.media.getStats.useQuery();
  const { data: avatarStats } = trpc.avatar.getStats.useQuery();

  // Webinar Intelligence stats — aggregate across all sessions
  const { data: allWebinarSessions = [] } = trpc.webinar.list.useQuery();

  const personas = enrichmentSummary as Array<{
    id: number;
    name: string;
    painCount: number;
    aspirationCount: number;
    isEnriched: boolean;
    enrichedAt: string | null;
    surveySource: string | null;
    surveyResponseCount: number;
  }>;

  const totalEnriched = personas.filter((p) => p.isEnriched).length;
  const avgScore = personas.length
    ? Math.round(personas.reduce((sum, p) => sum + intelligenceScore(p), 0) / personas.length)
    : 0;

  const pressHitCount = (pressStats as any)?.totalHits ?? 0;
  const pressReach = (pressStats as any)?.totalImpressions ?? 0;
  const mediaAssetCount = (mediaStats as any)?.totalAssets ?? 0;
  const mediaReach = (mediaStats as any)?.totalReach ?? 0;
  const avatarPainPointCount = (avatarStats as any)?.totalPainPoints ?? 0;
  const avatarPersonaCount = (avatarStats as any)?.totalPersonas ?? 0;

  // Webinar Intelligence derived stats
  const webinarSessionCount = (allWebinarSessions as any[]).length;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-primary" />
              Intelligence Dashboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Everything powering your AI content generation — survey data, press authority, competitor analysis
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchPersonas()}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* Overall Health Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-primary">{pressHitCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Press Hits Indexed</div>
              <div className="text-[10px] text-primary mt-1">
                {pressReach > 0 ? `${(pressReach / 1_000_000).toFixed(1)}M+ reach` : "loading..."}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold">{mediaAssetCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Media Assets</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {mediaReach > 0 ? `${(mediaReach / 1_000_000).toFixed(1)}M+ reach` : "books, films, podcasts"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold">{avatarPainPointCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Pain Points Mapped</div>
              <div className="text-[10px] text-muted-foreground mt-1">{avatarPersonaCount} buyer personas</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold">{(trackedChannels as any[]).length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Channels Tracked</div>
              <div className="text-[10px] text-muted-foreground mt-1">competitor monitoring</div>
            </CardContent>
          </Card>
          <Card className="border-violet-500/20 bg-violet-500/5">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-violet-400">{webinarSessionCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Webinar Sessions</div>
              <div className="text-[10px] text-violet-400 mt-1">audience intelligence ready</div>
            </CardContent>
          </Card>
        </div>

        {/* Persona Intelligence Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Persona Intelligence Status
            </h2>
            <Link href="/typeform">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
                <Zap className="w-3 h-3" />
                Enrich via Typeform
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {loadingPersonas
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4 h-24" />
                  </Card>
                ))
              : personas.map((persona) => {
                  const score = intelligenceScore(persona);
                  const daysAgo = persona.enrichedAt
                    ? Math.floor((Date.now() - new Date(persona.enrichedAt).getTime()) / 86400000)
                    : null;
                  const isStale = daysAgo !== null && daysAgo > 60;

                  return (
                    <Card
                      key={persona.id}
                      className={`border transition-colors ${
                        persona.isEnriched
                          ? isStale
                            ? "border-yellow-500/30 bg-yellow-500/5"
                            : "border-primary/20 bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="font-medium text-sm">{persona.name}</div>
                            {persona.surveySource && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                {persona.surveySource}
                                {persona.surveyResponseCount > 0 && ` · ${persona.surveyResponseCount} responses`}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {isStale && (
                              <Badge variant="outline" className="text-[9px] border-yellow-500/40 text-yellow-600 h-4 px-1">
                                Stale
                              </Badge>
                            )}
                            <span className={`text-sm font-bold ${scoreColor(score)}`}>
                              {score}
                            </span>
                          </div>
                        </div>
                        <Progress value={score} className="h-1.5 mb-2" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-3">
                            {persona.isEnriched ? (
                              <span className="flex items-center gap-1 text-primary">
                                <CheckCircle2 className="w-3 h-3" />
                                {persona.painCount} pain pts · {persona.aspirationCount} aspirations
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <AlertCircle className="w-3 h-3" />
                                No survey data
                              </span>
                            )}
                          </div>
                          {persona.enrichedAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(persona.enrichedAt)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
          </div>
        </div>

        {/* Data Sources Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Press Authority */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                Press Authority
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingPress ? (
                <div className="animate-pulse h-16 bg-muted rounded" />
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total hits indexed</span>
                    <span className="font-medium">{pressHitCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated reach</span>
                    <span className="font-medium">
                      {pressReach > 0 ? `${(pressReach / 1_000_000).toFixed(1)}M+` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Injected into AI</span>
                    <span className="font-medium text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Always on
                    </span>
                  </div>
                  <Link href="/press">
                    <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5 text-xs h-7">
                      <ExternalLink className="w-3 h-3" />
                      View Press Intelligence
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>

          {/* YouTube CI */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                YouTube Competitive Intel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Channels tracked</span>
                <span className="font-medium">{(trackedChannels as any[]).length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transcript analysis</span>
                <span className="font-medium text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Available
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Differentiation briefs</span>
                <span className="font-medium text-green-500 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Inform Script
                </span>
              </div>
              <Link href="/creation-studio">
                <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5 text-xs h-7">
                  <ExternalLink className="w-3 h-3" />
                  Open Creation Studio
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Typeform */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Typeform Survey Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Forms available</span>
                <span className="font-medium">25</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Richest source</span>
                <span className="font-medium text-xs">Gut Microbiome (2,416)</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Personas enriched</span>
                <span className="font-medium">{totalEnriched}/{personas.length}</span>
              </div>
              <Link href="/typeform">
                <Button variant="outline" size="sm" className="w-full mt-1 gap-1.5 text-xs h-7">
                  <ExternalLink className="w-3 h-3" />
                  Run Audience Analysis
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* What Powers Each Generation */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Intelligence Injection Status — What's Active in Every AI Generation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Every piece of content generated (social posts, blogs, scripts, landing pages) automatically draws from all active sources below. Green = actively injected. Grey = not yet connected.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                {
                  label: "Press Authority Block — 137 hits, 892M reach",
                  source: "Press Intelligence",
                  active: pressHitCount > 0,
                  note: pressHitCount > 0
                    ? `${pressHitCount} hits (NYT, CNN, Good Housekeeping, Inc., Dr. Oz, Bulletproof Radio…) · injected into ALL generations`
                    : "Seed press data to activate",
                  link: "/press",
                },
                {
                  label: "Media Authority Block — books, films, podcasts",
                  source: "Media Vault",
                  active: mediaAssetCount > 0,
                  note: mediaAssetCount > 0
                    ? `${mediaAssetCount} assets (8 books, 5 films, podcast, YouTube @urbanmonkproductions) · topic-matched per generation`
                    : "Add media assets to activate",
                  link: "/media-vault",
                },
                {
                  label: "Avatar Intelligence — pain points from real transcripts",
                  source: "Avatar Intelligence",
                  active: avatarPainPointCount > 0,
                  note: avatarPainPointCount > 0
                    ? `${avatarPainPointCount} pain points + ${avatarPersonaCount} personas + 5 messaging frameworks + 4 objection handlers · injected into ALL generations`
                    : "Seed avatar data to activate",
                  link: "/avatar",
                },
                {
                  label: "Typeform Persona Enrichment — survey pain points",
                  source: "Typeform Intelligence",
                  active: totalEnriched > 0,
                  note: totalEnriched > 0
                    ? `${totalEnriched}/${personas.length} personas enriched with real survey responses · injected when persona is selected`
                    : "Run Typeform Intelligence to activate (optional — avatar intelligence covers this)",
                  link: "/typeform",
                },
                {
                  label: "Gumshoe Research Gaps — competitor LLM queries",
                  source: "Research Intelligence",
                  active: true,
                  note: "Gap queries drive Brief + Script + Post generation on the Research page · all three now inject press + media + avatar context",
                  link: "/research",
                },
                {
                  label: "YouTube Competitor Intelligence",
                  source: "YouTube CI",
                  active: (trackedChannels as any[]).length > 0,
                  note: (trackedChannels as any[]).length > 0
                    ? `${(trackedChannels as any[]).length} channels tracked · on-demand differentiation via Inform Script`
                    : "Add competitor channels to activate",
                  link: "/channels",
                },
                {
                  label: "Webinar Intelligence — real attendee pain points & language",
                  source: "Webinar Intelligence",
                  active: webinarSessionCount > 0,
                  note: webinarSessionCount > 0
                    ? `${webinarSessionCount} webinar session${webinarSessionCount !== 1 ? "s" : ""} · import pre-registration & post-webinar survey data to extract audience pain points, motivations, and exact language · injected into ALL generations`
                    : "Import attendee survey data after your first webinar to activate",
                  link: "/webinar-intelligence",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    item.active ? "border-green-500/20 bg-green-500/5" : "border-border bg-muted/20"
                  }`}
                >
                  {item.active ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className={`font-medium text-xs ${item.active ? "" : "text-muted-foreground"}`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{item.note}</div>
                  </div>
                  <Link href={item.link} className="ml-auto shrink-0">
                    <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
