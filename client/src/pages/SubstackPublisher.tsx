/**
 * Substack Publisher — First-Class UI (Rec 10, Grok 3 Audit v2)
 *
 * - Substack-only view of the syndication queue
 * - Cookie health banner with live validation + Quick Refresh modal
 * - Manual fallback: 3-step copy-paste flow with URL recording
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Rss,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  RefreshCw,
  Copy,
  ExternalLink,
  AlertTriangle,
  ShieldCheck,
  Send,
  Eye,
  SkipForward,
  BookOpen,
  Key,
  ExternalLink as OpenIcon,
  Terminal,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SyndicationStatus = "pending" | "adapting" | "ready" | "published" | "failed" | "skipped";

interface SyndicationJob {
  id: number;
  contentItemId: number;
  wordpressUrl: string;
  wordpressTitle: string;
  platform: string;
  status: SyndicationStatus;
  scheduledAt: number;
  adaptedContent: string | null;
  publishedUrl: string | null;
  errorMessage: string | null;
  retryCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SubstackContent {
  title: string;
  subtitle?: string;
  bodyHtml: string;
}

// ─── Refresh Substack Session Modal ──────────────────────────────────────────

const JS_SNIPPET = `copy(document.cookie.match(/substack\\.sid=([^;]+)/)?.[1])`;

export function RefreshSubstackSessionModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [step, setStep] = useState(1);
  const [cookieValue, setCookieValue] = useState("");
  const [testResult, setTestResult] = useState<{ connected: boolean; reason?: string } | null>(null);

  const utils = trpc.useUtils();

  const updateCookieMutation = trpc.substackInbox.updateSubstackCookie.useMutation({
    onSuccess: async () => {
      // Invalidate both connection queries so they re-check with the new cookie
      await utils.substackInbox.testConnection.invalidate();
      await utils.substack.validateSession.invalidate();
    },
    onError: (err) => toast.error(`Failed to save cookie: ${err.message}`),
  });

  const testConnectionQuery = trpc.substackInbox.testConnection.useQuery(undefined, {
    enabled: false, // Only run manually
    staleTime: 0,
  });

  const handleSave = async () => {
    if (!cookieValue.trim()) {
      toast.error("Please paste the cookie value first");
      return;
    }
    try {
      await updateCookieMutation.mutateAsync({ cookie: cookieValue.trim() });
      // Test the new cookie
      const result = await testConnectionQuery.refetch();
      setTestResult(result.data ?? null);
      setStep(4);
      if (result.data?.connected) {
        toast.success("Substack session refreshed successfully!");
        onSuccess?.();
      } else {
        toast.error(`Cookie saved but connection test failed: ${result.data?.reason}`);
      }
    } catch {
      // Error already handled by mutation onError
    }
  };

  const handleClose = () => {
    setStep(1);
    setCookieValue("");
    setTestResult(null);
    onClose();
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(JS_SNIPPET);
    toast.success("Snippet copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Key className="w-4 h-4 text-orange-400" />
            Quick Refresh — Substack Session
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Step progress */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${step === s && step < 4 ? "bg-orange-500 text-white" : step > s || step === 4 ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                >
                  {(step > s || step === 4) ? <CheckCircle2 className="w-3 h-3" /> : s}
                </div>
                {s < 3 && <div className={`h-px w-8 ${step > s || step === 4 ? "bg-emerald-600" : "bg-zinc-700"}`} />}
              </div>
            ))}
            <span className="text-xs text-zinc-500 ml-2">
              {step === 1 && "Open Substack"}
              {step === 2 && "Run JS snippet"}
              {step === 3 && "Paste & save"}
              {step === 4 && "Done"}
            </span>
          </div>

          {/* Step 1: Open Substack */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">
                First, open Substack in a new tab and make sure you're logged in as Dr. Pedram Shojai.
              </p>
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 flex items-center gap-2"
                onClick={() => {
                  window.open("https://substack.com", "_blank");
                  setStep(2);
                }}
              >
                <OpenIcon className="w-4 h-4" />
                Open Substack in New Tab →
              </Button>
              <p className="text-xs text-zinc-500 text-center">
                Already logged in? Click the button above to continue.
              </p>
            </div>
          )}

          {/* Step 2: Run JS snippet */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">
                In the Substack tab, open DevTools (F12 or Cmd+Option+I), go to the{" "}
                <strong className="text-zinc-200">Console</strong> tab, paste this snippet, and press Enter.
                It will copy your session cookie to your clipboard automatically.
              </p>
              <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 font-mono text-sm text-emerald-400 flex items-start justify-between gap-3">
                <code className="break-all">{JS_SNIPPET}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-zinc-400 hover:text-zinc-200 shrink-0"
                  onClick={copySnippet}
                  title="Copy snippet"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-500 bg-zinc-900/50 rounded-lg p-3">
                <Terminal className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                <span>
                  The console will show <code className="text-zinc-300">undefined</code> — that's normal. Your cookie value has been copied to your clipboard.
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 flex-1" onClick={() => setStep(1)}>← Back</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => setStep(3)}>
                  Cookie copied — paste it →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Paste & save */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">
                Paste the cookie value from your clipboard into the field below, then click Save.
              </p>
              <Textarea
                placeholder="Paste the cookie value here (starts with s%3A or similar)"
                value={cookieValue}
                onChange={(e) => setCookieValue(e.target.value)}
                className="bg-zinc-900 border-zinc-700 text-zinc-200 placeholder-zinc-600 font-mono text-xs min-h-[80px] resize-none"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 flex-1" onClick={() => setStep(2)}>← Back</Button>
                <Button
                  className="flex-1 bg-emerald-700 hover:bg-emerald-600"
                  disabled={!cookieValue.trim() || updateCookieMutation.isPending || testConnectionQuery.isFetching}
                  onClick={handleSave}
                >
                  {(updateCookieMutation.isPending || testConnectionQuery.isFetching) ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving & testing…</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Save & Test Connection</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 4 && (
            <div className="space-y-4">
              {testResult?.connected ? (
                <div className="flex items-center gap-3 p-4 bg-emerald-950/40 border border-emerald-800/40 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Session refreshed successfully!</p>
                    <p className="text-xs text-emerald-500 mt-0.5">Substack is connected and ready to publish.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-red-950/40 border border-red-800/40 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Cookie saved but connection failed</p>
                    <p className="text-xs text-red-400 mt-0.5">{testResult?.reason ?? "Unknown error"}</p>
                    <p className="text-xs text-zinc-400 mt-2">Make sure you ran the snippet on substack.com while logged in, then try again.</p>
                  </div>
                </div>
              )}
              <Button className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200" onClick={handleClose}>
                Close
              </Button>
              {!testResult?.connected && (
                <Button variant="outline" className="w-full border-zinc-700 text-zinc-300" onClick={() => { setStep(1); setCookieValue(""); setTestResult(null); }}>
                  Try Again
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cookie Health Banner ─────────────────────────────────────────────────────

function CookieHealthBanner() {
  const [refreshOpen, setRefreshOpen] = useState(false);
  const { data: health, isLoading, refetch } = trpc.substack.validateSession.useQuery(undefined, {
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-4 pb-3 flex items-center gap-3">
          <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          <span className="text-sm text-zinc-400">Checking Substack session…</span>
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  if (health.valid) {
    return (
      <Card className="bg-emerald-950/30 border-emerald-800/40">
        <CardContent className="pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-medium text-emerald-300">Substack session active</p>
              {health.email && (
                <p className="text-xs text-emerald-500">Authenticated as {health.email}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-emerald-500 hover:text-emerald-300 h-7" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-red-950/30 border-red-800/40">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-300">Substack session expired or invalid</p>
              <p className="text-xs text-red-400 mt-1">{health.error ?? "The session cookie is no longer valid."}</p>
              <p className="text-xs text-zinc-400 mt-2">
                Use <strong className="text-zinc-300">Quick Refresh</strong> to update the cookie in 3 steps — no Manus Secrets panel required.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                className="h-7 bg-orange-600 hover:bg-orange-700 text-white text-xs px-3"
                onClick={() => setRefreshOpen(true)}
              >
                <Key className="w-3 h-3 mr-1" />
                Quick Refresh
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-200 h-7 w-7 p-0" onClick={() => refetch()}>
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <RefreshSubstackSessionModal
        open={refreshOpen}
        onClose={() => setRefreshOpen(false)}
        onSuccess={() => { setRefreshOpen(false); refetch(); }}
      />
    </>
  );
}

// ─── Manual Publish Dialog ────────────────────────────────────────────────────

function ManualPublishDialog({
  job,
  content,
  open,
  onClose,
  onMarkPosted,
}: {
  job: SyndicationJob;
  content: SubstackContent;
  open: boolean;
  onClose: () => void;
  onMarkPosted: (url: string) => void;
}) {
  const [step, setStep] = useState(1);
  const [publishedUrl, setPublishedUrl] = useState("");
  const pubUrl = "https://theurbanmonk.substack.com";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-orange-400" />
            Manual Publish — {job.wordpressTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Step progress */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer
                    ${step === s ? "bg-orange-500 text-white" : step > s ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-400"}`}
                  onClick={() => setStep(s)}
                >
                  {step > s ? <CheckCircle2 className="w-3 h-3" /> : s}
                </div>
                {s < 3 && <div className={`h-px w-8 ${step > s ? "bg-emerald-600" : "bg-zinc-700"}`} />}
              </div>
            ))}
            <span className="text-xs text-zinc-500 ml-2">
              {step === 1 && "Copy content"}{step === 2 && "Paste into Substack"}{step === 3 && "Record URL"}
            </span>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">Copy the subject line and body, then open Substack.</p>
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Subject Line</p>
                <div className="flex items-center gap-2">
                  <p className="text-zinc-200 font-medium flex-1 bg-zinc-900 rounded px-3 py-2 text-sm">{content.title}</p>
                  <Button size="sm" variant="outline" className="border-zinc-700 shrink-0" onClick={() => { navigator.clipboard.writeText(content.title); toast.success("Title copied"); }}>
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {content.subtitle && (
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Subtitle</p>
                  <p className="text-zinc-400 text-sm bg-zinc-900 rounded px-3 py-2">{content.subtitle}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Letter Body (HTML)</p>
                <div className="prose prose-invert prose-sm max-w-none text-zinc-300 bg-zinc-900 rounded-lg p-4 max-h-48 overflow-y-auto" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300 w-full" onClick={() => { navigator.clipboard.writeText(content.bodyHtml); toast.success("Body HTML copied"); }}>
                  <Copy className="w-3 h-3 mr-2" /> Copy Body HTML
                </Button>
              </div>
              <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => setStep(2)}>Content copied — open Substack →</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">Create a new post in Substack:</p>
              <ol className="space-y-3 text-sm text-zinc-300">
                {[
                  <>Go to <a href={`${pubUrl}/publish/post`} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline">New Post on Substack</a></>,
                  "Paste the subject line into the Title field, subtitle into Subtitle",
                  "Paste the body HTML using the HTML block or as rich text",
                  "Click Publish → Send to all subscribers",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 flex-1" onClick={() => setStep(1)}>← Back</Button>
                <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => setStep(3)}>Published — record URL →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-300">Paste the published Substack post URL:</p>
              <input
                type="url"
                placeholder="https://theurbanmonk.substack.com/p/..."
                value={publishedUrl}
                onChange={(e) => setPublishedUrl(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-orange-500"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-700 text-zinc-300 flex-1" onClick={() => setStep(2)}>← Back</Button>
                <Button className="flex-1 bg-emerald-700 hover:bg-emerald-600" disabled={!publishedUrl} onClick={() => { onMarkPosted(publishedUrl); onClose(); }}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Mark Published
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Substack Job Card ────────────────────────────────────────────────────────

function SubstackJobCard({ job, onRefresh }: { job: SyndicationJob; onRefresh: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [content, setContent] = useState<SubstackContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  const retryMutation = trpc.syndicationPipeline.retryJob.useMutation({
    onSuccess: () => { toast.success("Queued for retry"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const skipMutation = trpc.syndicationPipeline.skipJob.useMutation({
    onSuccess: () => { toast.success("Job skipped"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const markPostedMutation = trpc.syndicationPipeline.markVaJobPosted.useMutation({
    onSuccess: () => { toast.success("Marked as published"); onRefresh(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const previewMutation = trpc.syndicationPipeline.previewAdaptation.useMutation({
    onSuccess: (data: { ok: boolean; content: Record<string, unknown> }) => {
      setContent(data.content as unknown as SubstackContent);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const loadContent = async () => {
    if (content) return content;
    if (job.adaptedContent) {
      const parsed = JSON.parse(job.adaptedContent) as SubstackContent;
      setContent(parsed);
      return parsed;
    }
    setLoadingContent(true);
    try {
      const result = await previewMutation.mutateAsync({ jobId: job.id });
      const c = result.content as SubstackContent;
      setContent(c);
      return c;
    } finally {
      setLoadingContent(false);
    }
  };

  const isOverdue = job.scheduledAt < Date.now() && job.status === "pending";
  const scheduledDate = new Date(job.scheduledAt);

  const statusConfig: Record<SyndicationStatus, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: isOverdue ? "Overdue" : "Scheduled", color: isOverdue ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" /> },
    adapting: { label: "Adapting…", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    ready: { label: "Ready to Send", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: <Eye className="w-3 h-3" /> },
    published: { label: "Published", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { label: "Failed", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: <XCircle className="w-3 h-3" /> },
    skipped: { label: "Skipped", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", icon: <SkipForward className="w-3 h-3" /> },
  };

  const cfg = statusConfig[job.status];

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-zinc-200 leading-snug">{job.wordpressTitle}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}>
                {cfg.icon}{cfg.label}
              </Badge>
              <span className="text-xs text-zinc-500">
                {job.status === "published"
                  ? `Published ${new Date(job.updatedAt).toLocaleDateString()}`
                  : isOverdue
                  ? `Was due ${scheduledDate.toLocaleDateString()}`
                  : `Scheduled ${scheduledDate.toLocaleDateString()}`}
              </span>
            </div>
            {job.publishedUrl && (
              <a href={job.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 mt-1">
                <ExternalLink className="w-3 h-3" /> View on Substack
              </a>
            )}
            {job.errorMessage && (
              <p className="text-xs text-red-400 mt-1 bg-red-950/30 rounded px-2 py-1">{job.errorMessage}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {(job.status === "ready" || job.adaptedContent) && job.status !== "skipped" && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-400 hover:text-zinc-200"
                onClick={async () => { await loadContent(); setPreviewOpen(true); }}
                disabled={loadingContent}
              >
                {loadingContent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
            )}

            {["pending", "ready", "failed"].includes(job.status) && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-amber-400 hover:text-amber-200"
                onClick={async () => { await loadContent(); setManualOpen(true); }}
                disabled={loadingContent}
                title="Manual publish"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            )}

            {(job.status === "failed" || isOverdue) && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-400 hover:text-blue-200"
                onClick={() => retryMutation.mutate({ jobId: job.id })}
                disabled={retryMutation.isPending}
                title="Retry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            )}

            {!["published", "skipped"].includes(job.status) && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-500 hover:text-zinc-300"
                onClick={() => skipMutation.mutate({ jobId: job.id })}
                title="Skip"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>

      {content && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-zinc-950 border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Substack Letter Preview</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Subject Line</p>
                <p className="text-zinc-200 font-medium">{content.title}</p>
              </div>
              {content.subtitle && (
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Subtitle</p>
                  <p className="text-zinc-400 text-sm">{content.subtitle}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Letter Body</p>
                <div className="prose prose-invert prose-sm max-w-none text-zinc-300" dangerouslySetInnerHTML={{ __html: content.bodyHtml }} />
              </div>
              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-300" onClick={() => { setPreviewOpen(false); setManualOpen(true); }}>
                  <Send className="w-3 h-3 mr-1" /> Publish Manually
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {content && manualOpen && (
        <ManualPublishDialog
          job={job}
          content={content}
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onMarkPosted={(url) => markPostedMutation.mutate({ jobId: job.id, publishedUrl: url })}
        />
      )}
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SubstackPublisher() {
  const [tab, setTab] = useState<"queue" | "published" | "failed">("queue");

  const { data: allJobs = [], isLoading, refetch } = trpc.syndicationPipeline.listPendingJobs.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const substackJobs = (allJobs as SyndicationJob[]).filter((j) => j.platform === "substack");
  const queueJobs = substackJobs.filter((j) => ["pending", "adapting", "ready"].includes(j.status));
  const publishedJobs = substackJobs.filter((j) => j.status === "published");
  const failedJobs = substackJobs.filter((j) => j.status === "failed");

  const displayJobs = tab === "queue" ? queueJobs : tab === "published" ? publishedJobs : failedJobs;
  const overdueCount = queueJobs.filter((j) => j.scheduledAt < Date.now() && j.status === "pending").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Rss className="w-5 h-5 text-orange-400" />
              <h1 className="text-2xl font-bold text-zinc-100">Substack Publisher</h1>
            </div>
            <p className="text-sm text-zinc-400">Founder letters sent 24 h after WordPress publish. Primary owned channel.</p>
          </div>
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <CookieHealthBanner />

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "In Queue", value: queueJobs.length, color: "text-blue-400" },
            { label: "Published", value: publishedJobs.length, color: "text-emerald-400" },
            { label: "Failed", value: failedJobs.length, color: failedJobs.length > 0 ? "text-red-400" : "text-zinc-500" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4 pb-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {overdueCount > 0 && (
          <Card className="bg-amber-950/30 border-amber-800/40">
            <CardContent className="pt-3 pb-3 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-sm text-amber-300">
                {overdueCount} letter{overdueCount > 1 ? "s are" : " is"} overdue. Use the retry button or the manual publish flow (→) to send now.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-zinc-900/30 border-zinc-800/60">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-6 text-xs text-zinc-400 flex-wrap">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" />WordPress publishes → Day 0</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-orange-500" />Substack letter → Day 1 (auto)</div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" />Manual fallback if auto fails (→ icon)</div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {(["queue", "published", "failed"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors
                ${tab === t ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {t === "queue" ? `Queue (${queueJobs.length})` : t === "published" ? `Published (${publishedJobs.length})` : `Failed (${failedJobs.length})`}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : displayJobs.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <Rss className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {tab === "queue" ? "No letters in queue — publish a blog post to WordPress to generate one." : `No ${tab} letters.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayJobs.map((job) => (
              <SubstackJobCard key={job.id} job={job} onRefresh={refetch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
