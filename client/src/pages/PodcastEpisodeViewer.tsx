/**
 * PodcastEpisodeViewer.tsx
 *
 * Full episode report viewer. Displays the Claude-generated BINGE-framework
 * research report in six tabbed sections:
 *   1. Guest Dossier
 *   2. Big Pain (B)
 *   3. Through-Line
 *   4. Interview Outline (BINGE-mapped)
 *   5. Question Bank (tagged B/I/N/G/E)
 *   6. Soundbite Setups
 *
 * Also shows the raw full report in a "Full Report" tab.
 * Allows regenerating the report and editing intake fields.
 */
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  RefreshCw,
  Sparkles,
  Target,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

// ─── BINGE colour palette ─────────────────────────────────────────────────────

const BINGE_COLORS: Record<string, string> = {
  B: "bg-red-100 text-red-800 border-red-200",
  I: "bg-orange-100 text-orange-800 border-orange-200",
  N: "bg-amber-100 text-amber-800 border-amber-200",
  G: "bg-emerald-100 text-emerald-800 border-emerald-200",
  E: "bg-blue-100 text-blue-800 border-blue-200",
};

const BINGE_LABELS: Record<string, string> = {
  B: "Bring attention",
  I: "Insert story",
  N: "Name the pain",
  G: "Give way forward",
  E: "Empower action",
};

function BingeBadge({ letter }: { letter: string }) {
  const color = BINGE_COLORS[letter] ?? "bg-gray-100 text-gray-800 border-gray-200";
  const label = BINGE_LABELS[letter];
  return (
    <Badge variant="outline" className={`text-xs font-bold ${color}`} title={label}>
      {letter}
    </Badge>
  );
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function SectionContent({ markdown }: { markdown: string }) {
  if (!markdown) {
    return <p className="text-muted-foreground text-sm italic">No content available.</p>;
  }
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90 prose-strong:text-foreground">
      <Streamdown>{markdown}</Streamdown>
    </div>
  );
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: "Pending", icon: Clock, className: "text-amber-700 bg-amber-50 border-amber-200" },
    generating: { label: "Generating…", icon: Loader2, className: "text-blue-700 bg-blue-50 border-blue-200" },
    complete: { label: "Ready", icon: CheckCircle2, className: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    failed: { label: "Failed", icon: AlertCircle, className: "text-red-700 bg-red-50 border-red-200" },
  };
  const { label, icon: Icon, className } = map[status] ?? map.pending;
  return (
    <Badge variant="outline" className={`gap-1.5 ${className}`}>
      <Icon className={`w-3.5 h-3.5 ${status === "generating" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}

// ─── Polling hook ─────────────────────────────────────────────────────────────

function usePollingEpisode(id: number) {
  const utils = trpc.useUtils();
  const { data: episode, isLoading } = trpc.podcast.getEpisode.useQuery({ id });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (episode?.status === "generating") {
      intervalRef.current = setInterval(() => {
        utils.podcast.getEpisode.invalidate({ id });
      }, 4000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [episode?.status, id, utils]);

  return { episode, isLoading };
}

// ─── Main viewer ──────────────────────────────────────────────────────────────

export default function PodcastEpisodeViewer() {
  const params = useParams<{ id: string }>();
  const episodeId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { episode, isLoading } = usePollingEpisode(episodeId);

  const generateReport = trpc.podcast.generateReport.useMutation({
    onSuccess: () => {
      utils.podcast.getEpisode.invalidate({ id: episodeId });
      utils.podcast.getEpisodes.invalidate();
      toast.success("Report generation started — this takes 30–90 seconds.");
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  const generateShowNotes = trpc.podcast.generateShowNotes.useMutation({
    onSuccess: () => {
      utils.podcast.getEpisode.invalidate({ id: episodeId });
      toast.success("Show notes generated!");
    },
    onError: (err) => toast.error(`Show notes failed: ${err.message}`),
  });

  const generateIntakeLink = trpc.podcast.generateIntakeLink.useMutation({
    onSuccess: (data) => {
      utils.podcast.getEpisode.invalidate({ id: episodeId });
      navigator.clipboard.writeText(data.url).then(() => {
        toast.success("Intake link copied to clipboard!", {
          description: data.url,
          duration: 5000,
        });
      }).catch(() => {
        toast.info("Intake link generated", { description: data.url, duration: 10000 });
      });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!episode) {
    return (
      <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto text-center py-24">
        <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Episode not found.</p>
        <Button variant="link" onClick={() => navigate("/podcast-production")}>
          Back to Podcast Production
        </Button>
      </div>
      </DashboardLayout>
    );
  }

  const guestLabel = [episode.guestRole, episode.guestCompany].filter(Boolean).join(" · ");
  const isGenerating = episode.status === "generating";
  const hasReport = episode.status === "complete" && episode.reportMarkdown;

  return (
    <DashboardLayout>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back nav */}
      <button
        onClick={() => navigate("/podcast-production")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Episodes
      </button>

      {/* Episode header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Mic className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {episode.episodeNumber && (
                <span className="text-sm font-mono text-muted-foreground">
                  #{episode.episodeNumber}
                </span>
              )}
              <h1 className="text-2xl font-bold">{episode.guestName}</h1>
              <StatusChip status={episode.status} />
            </div>
            {guestLabel && <p className="text-muted-foreground text-sm">{guestLabel}</p>}
            {episode.whyNow && (
              <p className="text-sm text-muted-foreground mt-1 italic">"{episode.whyNow}"</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generateIntakeLink.isPending}
            onClick={() =>
              generateIntakeLink.mutate(
                { id: episodeId, origin: window.location.origin },
                {
                  onSuccess: (data) => {
                    const firstName = episode.guestName.split(" ")[0];
                    const subject = encodeURIComponent(
                      `Podcast Guest Intake Form — The Urban Monk Podcast`
                    );
                    const body = encodeURIComponent(
                      `Hi ${firstName},\n\n` +
                      `We're looking forward to having you on The Urban Monk Podcast! ` +
                      `To help us prepare the best possible conversation, please take a few minutes to fill out our guest intake form:\n\n` +
                      `${data.url}\n\n` +
                      `The form asks for a brief bio, any topics you'd like to explore, and background context that will help Dr. Pedram Shojai craft a deeply tailored interview.\n\n` +
                      `If you have any questions, just reply to this email.\n\n` +
                      `Thank you — we can't wait to record with you!\n\n` +
                      `Warm regards,\n` +
                      `The Urban Monk Productions Team`
                    );
                    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                  },
                }
              )
            }
          >
            {generateIntakeLink.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Send Intake Form
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generateIntakeLink.isPending}
            onClick={() => generateIntakeLink.mutate({ id: episodeId, origin: window.location.origin })}
          >
            {generateIntakeLink.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Copy Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={isGenerating || generateReport.isPending}
            onClick={() => {
              if (
                hasReport &&
                !confirm(
                  "Regenerate the report? The existing report will be overwritten."
                )
              )
                return;
              generateReport.mutate({ episodeId });
            }}
          >
            {isGenerating || generateReport.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {hasReport ? "Regenerate Report" : "Generate Report"}
          </Button>
        </div>
      </div>

      {/* Generating state */}
      {isGenerating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-8 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="font-medium text-blue-800">Claude is researching {episode.guestName}…</p>
            <p className="text-sm text-blue-600 mt-1">
              Building the full BINGE-framework report — typically takes 30–90 seconds.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Failed state */}
      {episode.status === "failed" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">Report generation failed</p>
                {episode.errorMessage && (
                  <p className="text-sm text-red-600 mt-1">{episode.errorMessage}</p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                  onClick={() => generateReport.mutate({ episodeId })}
                  disabled={generateReport.isPending}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending state */}
      {episode.status === "pending" && !isGenerating && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sparkles className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium mb-1">Report not yet generated</p>
            <p className="text-sm text-muted-foreground mb-5">
              Click "Generate Report" to have Claude research {episode.guestName} and produce the
              full BINGE-framework episode prep.
            </p>
            <Button
              onClick={() => generateReport.mutate({ episodeId })}
              disabled={generateReport.isPending}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Report tabs */}
      {hasReport && (
        <Tabs defaultValue="dossier" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 mb-2">
            <TabsTrigger value="dossier" className="gap-1.5 text-xs sm:text-sm">
              <BookOpen className="w-3.5 h-3.5" />
              Dossier
            </TabsTrigger>
            <TabsTrigger value="bigpain" className="gap-1.5 text-xs sm:text-sm">
              <Target className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Big Pain</span>
              <BingeBadge letter="B" />
            </TabsTrigger>
            <TabsTrigger value="throughline" className="gap-1.5 text-xs sm:text-sm">
              <ChevronRight className="w-3.5 h-3.5" />
              Through-Line
            </TabsTrigger>
            <TabsTrigger value="outline" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" />
              Outline
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="w-3.5 h-3.5" />
              Questions
            </TabsTrigger>
            <TabsTrigger value="soundbites" className="gap-1.5 text-xs sm:text-sm">
              <Volume2 className="w-3.5 h-3.5" />
              Soundbites
            </TabsTrigger>
            <TabsTrigger value="shownotes" className="gap-1.5 text-xs sm:text-sm">
              <MessageSquare className="w-3.5 h-3.5" />
              Show Notes
            </TabsTrigger>
            <TabsTrigger value="full" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="w-3.5 h-3.5" />
              Full Report
            </TabsTrigger>
          </TabsList>

          {/* 1. Guest Dossier */}
          <TabsContent value="dossier">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-base">Guest Dossier</h2>
                </div>
                <SectionContent markdown={episode.sectionDossier ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Big Pain */}
          <TabsContent value="bigpain">
            <Card className="border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-red-600" />
                  <h2 className="font-semibold text-base">The Big Pain</h2>
                  <BingeBadge letter="B" />
                </div>
                <p className="text-xs text-muted-foreground mb-4 italic">
                  The single biggest pain or challenge this guest helps solve — what the whole
                  episode orbits.
                </p>
                <SectionContent markdown={episode.sectionBigPain ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Through-Line */}
          <TabsContent value="throughline">
            <Card className="border-primary/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ChevronRight className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-base">The Through-Line</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4 italic">
                  The idea a listener repeats to a friend afterward.
                </p>
                <SectionContent markdown={episode.sectionThroughLine ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. Interview Outline */}
          <TabsContent value="outline">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-base">Interview Outline — BINGE Mapped</h2>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {["B", "I", "N", "G", "E"].map((l) => (
                    <BingeBadge key={l} letter={l} />
                  ))}
                </div>
                <SectionContent markdown={episode.sectionOutline ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5. Question Bank */}
          <TabsContent value="questions">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <h2 className="font-semibold text-base">Question Bank</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4 italic">
                  Ranked best to worst, each tagged with its BINGE stage.
                </p>
                <div className="flex gap-1.5 flex-wrap mb-4">
                  {["B", "I", "N", "G", "E"].map((l) => (
                    <span key={l} className="flex items-center gap-1 text-xs">
                      <BingeBadge letter={l} />
                      <span className="text-muted-foreground">{BINGE_LABELS[l]}</span>
                    </span>
                  ))}
                </div>
                <SectionContent markdown={episode.sectionQuestionBank ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 6. Soundbite Setups */}
          <TabsContent value="soundbites">
            <Card className="border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Volume2 className="w-4 h-4 text-emerald-600" />
                  <h2 className="font-semibold text-base">Soundbite Setups</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4 italic">
                  3 moments most likely to produce a clip-worthy answer.
                </p>
                <SectionContent markdown={episode.sectionSoundbites ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Full report */}
          <TabsContent value="full">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h2 className="font-semibold text-base">Full Report</h2>
                </div>
                <SectionContent markdown={episode.reportMarkdown ?? ""} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Show Notes ──────────────────────────────────────────── */}
          <TabsContent value="shownotes">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-base">Show Notes</h2>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {episode.showNotes && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => {
                          navigator.clipboard.writeText(episode.showNotes ?? "").then(() =>
                            toast.success("Show notes copied to clipboard!")
                          );
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Copy
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="gap-2"
                      disabled={generateShowNotes.isPending}
                      onClick={() => {
                        if (
                          episode.showNotes &&
                          !confirm("Regenerate show notes? The existing version will be overwritten.")
                        )
                          return;
                        generateShowNotes.mutate({ episodeId });
                      }}
                    >
                      {generateShowNotes.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5" />
                      )}
                      {episode.showNotes ? "Regenerate Show Notes" : "Generate Show Notes"}
                    </Button>
                  </div>
                </div>

                {generateShowNotes.isPending ? (
                  <div className="py-12 text-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">
                      Claude is writing your show notes… typically 15–30 seconds.
                    </p>
                  </div>
                ) : episode.showNotes ? (
                  <SectionContent markdown={episode.showNotes} />
                ) : (
                  <div className="py-12 text-center">
                    <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm mb-4">
                      Generate paste-ready show notes — a 200-word summary, 3 key takeaways, and a CTA
                      paragraph for your podcast host’s description field.
                    </p>
                    <Button
                      onClick={() => generateShowNotes.mutate({ episodeId })}
                      disabled={generateShowNotes.isPending}
                      className="gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Generate Show Notes
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
    </DashboardLayout>
  );
}
