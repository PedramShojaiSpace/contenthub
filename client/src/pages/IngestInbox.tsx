import DashboardLayout from "@/components/DashboardLayout";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Inbox,
  Sparkles,
  Linkedin,
  Twitter,
  FileText,
  Mail,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  BookOpen,
  Tag,
  Calendar,
  Hash,
  ExternalLink,
  Facebook,
  Youtube,
  Clapperboard,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface IngestReport {
  id: number;
  source: string;
  topic: string;
  title: string;
  narrativeHtml: string;
  wordCount: number | null;
  citationCount: number | null;
  format: string;
  generatedContent: string | null;
  tags: string[];
  pushedAt: Date | string;
  contentItemId: number | null;
}

interface GeneratedContent {
  reportId: number;
  reportTitle: string;
  topic: string;
  ctaLabel: string;
  campaign: string;
  linkedin: string;
  x: string;
  facebook: string;
  instagram: string;
  meta: string; // backward compat — same as facebook
  youtube: string;
  blog: string;
  email: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    "upstream-gut-health": "Upstream Gut Health",
  };
  return map[source] ?? source;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

// ── GeneratePanel ─────────────────────────────────────────────────────────────

function GeneratePanel({ report }: { report: IngestReport }) {
  const [, navigate] = useLocation();
  const [customInstructions, setCustomInstructions] = useState("");
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [savedTabs, setSavedTabs] = useState<Set<string>>(new Set());
  const [generatingScript, setGeneratingScript] = useState(false);
  const [metaVariant, setMetaVariant] = useState<"facebook" | "instagram">("facebook");

  const utils = trpc.useUtils();

  const generateMutation = trpc.ingest.generateFromReport.useMutation({
    onSuccess: (data) => {
      setGenerated(data);
      if (data.partialFailures && data.partialFailures > 0) {
        toast.warning(`Content generated — ${7 - data.partialFailures} of 7 channels succeeded. ${data.partialFailures} channel(s) failed and will show empty. You can edit them manually.`);
      } else {
        toast.success("Content generated for all 7 channels!");
      }
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const saveMutation = trpc.ingest.saveGenerated.useMutation({
    onSuccess: (_, vars) => {
      setSavedTabs((prev) => { const next = new Set(prev); next.add(vars.platform); return next; });
      toast.success("Saved to Command Center!", {
        action: {
          label: "View →",
          onClick: () => navigate("/"),
        },
      });
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const saveAllMutation = trpc.ingest.saveAll.useMutation({
    onSuccess: (data) => {
      setSavedTabs(new Set(["linkedin", "x", "meta", "youtube", "blog", "email"]));
      toast.success(`${data.saved} pieces saved to Command Center!`, {
        action: {
          label: "View →",
          onClick: () => navigate("/"),
        },
      });
    },
    onError: (err) => toast.error(`Save all failed: ${err.message}`),
  });

  // Track the saved YouTube ContentItem ID so we can link the script to it
  const [savedYoutubeItemId, setSavedYoutubeItemId] = useState<number | null>(null);
  const [generatedScriptId, setGeneratedScriptId] = useState<number | null>(null);

  // Override saveMutation to capture the YouTube ContentItem ID
  const saveYoutubeMutation = trpc.ingest.saveGenerated.useMutation({
    onSuccess: (data, vars) => {
      if (vars.platform === "youtube") {
        setSavedYoutubeItemId(data.contentItemId);
        setSavedTabs((prev) => { const next = new Set(prev); next.add("youtube"); return next; });
      }
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  // Generate + save script via the new generateAndSaveScript procedure
  const generateAndSaveScriptMutation = trpc.ingest.generateAndSaveScript.useMutation({
    onSuccess: (data) => {
      setGeneratingScript(false);
      setGeneratedScriptId(data.scriptId);
      toast.success("Script generated and saved to Script Library!", {
        action: { label: "View Script →", onClick: () => navigate(`/script-library?scriptId=${data.scriptId}`) },
      });
    },
    onError: (err) => {
      setGeneratingScript(false);
      toast.error(`Script generation failed: ${err.message}`);
    },
  });

  const handleGenerateScript = async () => {
    if (!generated) return;
    setGeneratingScript(true);

    // 1. Save the YouTube card first if not already saved, to get a ContentItem ID
    let contentItemId = savedYoutubeItemId;
    if (!contentItemId) {
      try {
        const saved = await saveYoutubeMutation.mutateAsync({
          reportId: report.id,
          platform: "youtube",
          title: `${generated.reportTitle} — YouTube`,
          textContent: generated.youtube,
          ctaBlockLabel: generated.ctaLabel,
        });
        contentItemId = saved.contentItemId;
      } catch (err) {
        setGeneratingScript(false);
        toast.error("Could not save YouTube card before generating script.");
        return;
      }
    }

    // 2. Generate script and link it to the ContentItem
    generateAndSaveScriptMutation.mutate({
      contentItemId,
      reportTitle: generated.reportTitle,
      youtubeDescription: generated.youtube,
      topic: generated.topic,
    });
  };

  const platformConfig = [
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      shortLabel: "LinkedIn",
      icon: <Linkedin className="w-4 h-4" />,
      platform: "linkedin" as const,
      color: "text-blue-600",
    },
    {
      key: "x" as const,
      label: "X / Twitter",
      shortLabel: "X",
      icon: <Twitter className="w-4 h-4" />,
      platform: "x" as const,
      color: "text-sky-500",
    },
    {
      key: "meta" as const,
      label: "Meta (FB/IG)",
      shortLabel: "Meta",
      icon: <Facebook className="w-4 h-4" />,
      platform: "meta" as const,
      color: "text-indigo-600",
    },
    {
      key: "youtube" as const,
      label: "YouTube",
      shortLabel: "YouTube",
      icon: <Youtube className="w-4 h-4" />,
      platform: "youtube" as const,
      color: "text-red-600",
    },
    {
      key: "blog" as const,
      label: "Blog Post",
      shortLabel: "Blog",
      icon: <FileText className="w-4 h-4" />,
      platform: "blog" as const,
      color: "text-emerald-600",
    },
    {
      key: "email" as const,
      label: "Email Newsletter",
      shortLabel: "Email",
      icon: <Mail className="w-4 h-4" />,
      platform: "email" as const,
      color: "text-amber-600",
    },
  ];

  const totalPlatforms = platformConfig.length;
  const allSaved = savedTabs.size >= totalPlatforms;

  return (
    <div className="space-y-4 pt-2">
      {/* Custom instructions */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Custom Instructions (optional)
        </label>
        <Textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="e.g. Focus on the gut-brain connection angle. Mention the KBMO FIT22 test."
          className="text-sm resize-none h-20"
        />
      </div>

      {/* Generate button */}
      <Button
        onClick={() =>
          generateMutation.mutate({
            reportId: report.id,
            customInstructions: customInstructions || undefined,
          })
        }
        disabled={generateMutation.isPending}
        className="w-full gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
        size="lg"
      >
        {generateMutation.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating all 6 channels…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate LinkedIn + X + Meta + YouTube + Blog + Email
          </>
        )}
      </Button>

      {/* Generated output */}
      {generated && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tag className="w-3.5 h-3.5" />
            CTA Block: <span className="font-medium text-foreground">{generated.ctaLabel}</span>
            <span className="mx-1">·</span>
            <Hash className="w-3.5 h-3.5" />
            Campaign: <span className="font-medium text-foreground">{generated.campaign}</span>
          </div>

          {/* Save All to Hub — one-click save all 6 platforms */}
          <Button
            onClick={() =>
              saveAllMutation.mutate({
                reportId: report.id,
                reportTitle: generated.reportTitle,
                ctaLabel: generated.ctaLabel,
                linkedin: generated.linkedin,
                x: generated.x,
                meta: generated.meta,
                youtube: generated.youtube,
                blog: generated.blog,
                email: generated.email,
              })
            }
            disabled={saveAllMutation.isPending || allSaved}
            variant="outline"
            className="w-full gap-2 border-cyan-600/40 text-cyan-600 hover:bg-cyan-600/10"
          >
            {saveAllMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving all 6 channels…
              </>
            ) : allSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                All 6 saved to Command Center
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save All 6 to Command Center
              </>
            )}
          </Button>

          <Tabs defaultValue="linkedin">
            <TabsList className="w-full grid grid-cols-6">
              {platformConfig.map((p) => (
                <TabsTrigger key={p.key} value={p.key} className="gap-1 text-xs px-1">
                  {p.icon}
                  <span className="hidden lg:inline">{p.shortLabel}</span>
                  {savedTabs.has(p.platform) && (
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {platformConfig.map((p) => (
              <TabsContent key={p.key} value={p.key} className="mt-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${p.color}`}>
                    {p.icon}
                    {p.label}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    <CopyButton text={
                      p.key === "meta"
                        ? (metaVariant === "facebook" ? generated.facebook : generated.instagram)
                        : generated[p.key]
                    } />
                    <Button
                      size="sm"
                      variant={savedTabs.has(p.platform) ? "outline" : "default"}
                      disabled={saveMutation.isPending || savedTabs.has(p.platform)}
                      onClick={() => {
                        const textContent = p.key === "meta"
                          ? (metaVariant === "facebook" ? generated.facebook : generated.instagram)
                          : generated[p.key];
                        const label = p.key === "meta"
                          ? `${generated.reportTitle} — ${metaVariant === "facebook" ? "Facebook" : "Instagram"}`
                          : `${generated.reportTitle} — ${p.label}`;
                        saveMutation.mutate({
                          reportId: report.id,
                          platform: p.platform,
                          title: label,
                          textContent,
                          ctaBlockLabel: generated.ctaLabel,
                        });
                      }}
                      className="gap-1.5"
                    >
                      {savedTabs.has(p.platform) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          Saved
                        </>
                      ) : (
                        "Save to Hub"
                      )}
                    </Button>

                    {/* YouTube-only: Generate Script + View Script buttons */}
                    {p.key === "youtube" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={generatingScript || generateAndSaveScriptMutation.isPending}
                          onClick={handleGenerateScript}
                          className="gap-1.5 border-red-500/40 text-red-600 hover:bg-red-500/10"
                        >
                          {generatingScript || generateAndSaveScriptMutation.isPending ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating script…
                            </>
                          ) : (
                            <>
                              <Clapperboard className="w-3.5 h-3.5" />
                              Generate Script
                            </>
                          )}
                        </Button>
                        {generatedScriptId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/script-library?scriptId=${generatedScriptId}`)}
                            className="gap-1.5 border-violet-500/40 text-violet-600 hover:bg-violet-500/10"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            View Script
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* YouTube-specific guidance */}
                {p.key === "youtube" && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1.5">
                      <Clapperboard className="w-3.5 h-3.5 text-red-500" />
                      YouTube Production Workflow
                    </p>
                    <p>
                      1. <strong>Copy</strong> the spoken hook (first paragraph) — say it directly to camera to open your video.
                    </p>
                    <p>
                      2. Click <strong>Generate Script</strong> to create a full teleprompter script in the Script Library.
                    </p>
                    <p>
                      3. Record your video using the script, then bring the recording back to the <strong>Media Vault</strong>.
                    </p>
                    <p>
                      4. <strong>Save to Hub</strong> to add the YouTube description to your Command Center Kanban.
                    </p>
                  </div>
                )}

                {/* Meta tab: Facebook / Instagram toggle */}
                {p.key === "meta" && (
                  <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5 w-fit">
                    <button
                      onClick={() => setMetaVariant("facebook")}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        metaVariant === "facebook"
                          ? "bg-background shadow text-blue-700 dark:text-blue-400"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Facebook
                    </button>
                    <button
                      onClick={() => setMetaVariant("instagram")}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        metaVariant === "instagram"
                          ? "bg-background shadow text-pink-600 dark:text-pink-400"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Instagram
                    </button>
                  </div>
                )}

                <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto border">
                  {p.key === "meta"
                    ? (metaVariant === "facebook" ? generated.facebook : generated.instagram)
                    : generated[p.key]}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
}

// ── ReportCard ────────────────────────────────────────────────────────────────

function ReportCard({ report, cardCount = 0 }: { report: IngestReport; cardCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  return (
    <Card className="border border-border/60 hover:border-emerald-600/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
              {report.title}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                {sourceLabel(report.source)}
              </Badge>
              {cardCount > 0 && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-300/40 gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {cardCount} card{cardCount !== 1 ? "s" : ""} created
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {report.format}
              </Badge>
              {report.wordCount && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <BookOpen className="w-3 h-3" />
                  {report.wordCount.toLocaleString()} words
                </span>
              )}
              {report.citationCount && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  {report.citationCount} citations
                </span>
              )}
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(report.pushedAt)}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setShowGenerate((v) => !v)}
            className="shrink-0 gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showGenerate ? "Close" : "Generate"}
          </Button>
        </div>

        {/* Tags */}
        {report.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {report.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Topic */}
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Topic:</span> {report.topic}
        </p>

        {/* Narrative preview */}
        <div>
          <button
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Hide" : "Show"} research narrative
          </button>
          {expanded && (
            <div
              className="mt-2 text-sm text-muted-foreground bg-muted/40 rounded-lg p-3 max-h-60 overflow-y-auto leading-relaxed prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: report.narrativeHtml }}
            />
          )}
        </div>

        {/* Generate panel */}
        {showGenerate && <GeneratePanel report={report} />}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IngestInbox() {
  const { data: reports, isLoading } = trpc.ingest.list.useQuery();
  const { data: countData } = trpc.ingest.countByReport.useQuery();

  // Build a map of reportId → card count
  const cardCountMap = new Map<number, number>();
  for (const row of countData ?? []) {
    cardCountMap.set(row.reportId, row.count);
  }

  return (
    <DashboardLayout>
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-emerald-600" />
            Ingest Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Research reports pushed from external apps (e.g. Upstream Gut Health). Click{" "}
            <strong>Generate</strong> on any report to produce LinkedIn, X, Meta, YouTube, Blog, and Email content
            — with UTMs, hashtags, and CTA blocks auto-applied. YouTube cards include a one-click{" "}
            <strong>Generate Script</strong> flow to create a teleprompter script.
          </p>
        </div>
        <Badge variant="outline" className="text-sm shrink-0">
          {reports?.length ?? 0} report{reports?.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Endpoint info */}
      <Card className="border-dashed border-emerald-600/40 bg-emerald-50/30 dark:bg-emerald-950/20">
        <CardContent className="pt-4 pb-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Ingest endpoint:</span>{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
              POST https://content.theurbanmonk.com/api/ingest/research-report
            </code>
            {" "}— authenticate with your <code className="bg-muted px-1.5 py-0.5 rounded text-xs">INGEST_SECRET</code>.
          </p>
        </CardContent>
      </Card>

      {/* Report list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading reports…
        </div>
      ) : !reports || reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <Inbox className="w-10 h-10 mx-auto opacity-30" />
          <p className="text-sm">No reports yet. Push a research report from your Upstream app to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report as IngestReport} cardCount={cardCountMap.get(report.id) ?? 0} />
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
