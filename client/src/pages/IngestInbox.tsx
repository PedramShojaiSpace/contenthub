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

  const generateMutation = trpc.ingest.generateFromReport.useMutation({
    onSuccess: (data) => {
      setGenerated(data);
      toast.success("Content generated for all 4 channels!");
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
          onClick: () => navigate("/command-center"),
        },
      });
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const platformConfig = [
    {
      key: "linkedin" as const,
      label: "LinkedIn",
      icon: <Linkedin className="w-4 h-4" />,
      platform: "linkedin" as const,
      color: "text-blue-600",
    },
    {
      key: "x" as const,
      label: "X / Twitter",
      icon: <Twitter className="w-4 h-4" />,
      platform: "x" as const,
      color: "text-sky-500",
    },
    {
      key: "blog" as const,
      label: "Blog Post",
      icon: <FileText className="w-4 h-4" />,
      platform: "blog" as const,
      color: "text-emerald-600",
    },
    {
      key: "email" as const,
      label: "Email Newsletter",
      icon: <Mail className="w-4 h-4" />,
      platform: "all" as const,
      color: "text-amber-600",
    },
  ];

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
            Generating all 4 channels…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Generate LinkedIn + X + Blog + Email
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

          <Tabs defaultValue="linkedin">
            <TabsList className="w-full grid grid-cols-4">
              {platformConfig.map((p) => (
                <TabsTrigger key={p.key} value={p.key} className="gap-1.5 text-xs">
                  {p.icon}
                  <span className="hidden sm:inline">{p.label}</span>
                  {savedTabs.has(p.platform) && (
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            {platformConfig.map((p) => (
              <TabsContent key={p.key} value={p.key} className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium flex items-center gap-1.5 ${p.color}`}>
                    {p.icon}
                    {p.label}
                  </span>
                  <div className="flex gap-2">
                    <CopyButton text={generated[p.key]} />
                    <Button
                      size="sm"
                      variant={savedTabs.has(p.platform) ? "outline" : "default"}
                      disabled={saveMutation.isPending || savedTabs.has(p.platform)}
                      onClick={() =>
                        saveMutation.mutate({
                          reportId: report.id,
                          platform: p.platform,
                          title: `${generated.reportTitle} — ${p.label}`,
                          textContent: generated[p.key],
                          ctaBlockLabel: generated.ctaLabel,
                        })
                      }
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
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto border">
                  {generated[p.key]}
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

function ReportCard({ report }: { report: IngestReport }) {
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
            Generate
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

  return (
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
            <strong>Generate</strong> on any report to produce LinkedIn, X, Blog, and Email content
            — with UTMs, hashtags, and CTA blocks auto-applied.
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
            <ReportCard key={report.id} report={report as IngestReport} />
          ))}
        </div>
      )}
    </div>
  );
}
