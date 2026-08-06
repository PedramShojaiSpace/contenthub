import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Send,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType =
  | "wordpress_post"
  | "meta_ad"
  | "advertorial"
  | "email_sequence"
  | "landing_page"
  // v2.2 Part 3E — Script Factory scripts route through this same queue, via the
  // same creation path, so they appear here rather than in a parallel review UI.
  | "youtube_script"
  | "other";

type ReviewStatus = "pending" | "approved" | "rejected" | "auto_approved";

interface Verdict {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  flaggedText: string | null;
  explanation: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: ReviewStatus) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="text-amber-500 border-amber-500"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-green-500 border-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Approved</Badge>;
    case "rejected":
      return <Badge variant="outline" className="text-red-500 border-red-500"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    case "auto_approved":
      return <Badge variant="outline" className="text-blue-500 border-blue-500"><ShieldCheck className="w-3 h-3 mr-1" />Auto-Approved</Badge>;
  }
}

function contentTypeLabel(ct: string) {
  const map: Record<string, string> = {
    wordpress_post: "WordPress Post",
    meta_ad: "Meta Ad",
    advertorial: "Advertorial",
    email_sequence: "Email Sequence",
    landing_page: "Landing Page",
    youtube_script: "YouTube Script",
    other: "Other",
  };
  return map[ct] ?? ct;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Review Detail Modal ──────────────────────────────────────────────────────

function ReviewDetail({ reviewId, onClose }: { reviewId: number; onClose: () => void }) {
  const [rejectionNote, setRejectionNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: review, isLoading } = trpc.claimsReview.getReview.useQuery({ reviewId });

  const approve = trpc.claimsReview.approveReview.useMutation({
    onSuccess: () => {
      toast.success("Content approved for publication");
      utils.claimsReview.listPending.invalidate();
      utils.claimsReview.listAll.invalidate();
      utils.claimsReview.getStats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const reject = trpc.claimsReview.rejectReview.useMutation({
    onSuccess: () => {
      toast.success("Content rejected — author notified");
      utils.claimsReview.listPending.invalidate();
      utils.claimsReview.listAll.invalidate();
      utils.claimsReview.getStats.invalidate();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading review…</div>;
  if (!review) return <div className="p-8 text-center text-muted-foreground">Review not found.</div>;

  const verdicts: Verdict[] = Array.isArray(review.verdicts) ? (review.verdicts as Verdict[]) : [];
  const flags = verdicts.filter((v) => !v.passed);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{review.contentTitle ?? "Untitled Content"}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{contentTypeLabel(review.contentType)}</span>
              <span className="text-muted-foreground">·</span>
              {statusBadge(review.status as ReviewStatus)}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Flag summary */}
          {flags.length > 0 ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                <ShieldAlert className="w-4 h-4" />
                {flags.length} rule{flags.length > 1 ? "s" : ""} flagged
              </div>
              <div className="space-y-3">
                {flags.map((v) => (
                  <div key={v.ruleId} className="text-sm">
                    <button
                      className="flex items-center gap-2 w-full text-left font-medium text-red-300 hover:text-red-200"
                      onClick={() => setExpanded(expanded === v.ruleId ? null : v.ruleId)}
                    >
                      {expanded === v.ruleId ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {v.ruleName}
                    </button>
                    {expanded === v.ruleId && (
                      <div className="mt-2 ml-5 space-y-1">
                        {v.flaggedText && (
                          <blockquote className="border-l-2 border-red-500/50 pl-3 text-red-300/80 italic text-xs">
                            "{v.flaggedText}"
                          </blockquote>
                        )}
                        <p className="text-muted-foreground text-xs">{v.explanation}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-2 text-green-400">
              <ShieldCheck className="w-4 h-4" />
              All {verdicts.length} rules passed — no health-claim violations detected.
            </div>
          )}

          {/* Passed rules (collapsed) */}
          {verdicts.filter((v) => v.passed).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                {verdicts.filter((v) => v.passed).length} rules passed ▸
              </summary>
              <div className="mt-2 space-y-1 ml-4">
                {verdicts.filter((v) => v.passed).map((v) => (
                  <div key={v.ruleId} className="flex items-center gap-2 text-green-500/70">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{v.ruleName}</span>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Content preview */}
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Content Reviewed</p>
            <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap">
              {review.contentText}
            </div>
          </div>

          {/* Reviewer note (if already reviewed) */}
          {review.reviewerNote && (
            <div className="bg-muted/20 rounded-lg p-4 text-sm">
              <p className="text-xs text-muted-foreground mb-1">Reviewer note</p>
              <p>{review.reviewerNote}</p>
            </div>
          )}

          {/* Action buttons (only for pending) */}
          {review.status === "pending" && (
            <div className="space-y-3 pt-2 border-t border-border">
              <Textarea
                placeholder="Rejection reason (required to reject)…"
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                rows={3}
                className="text-sm"
              />
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => approve.mutate({ reviewId })}
                  disabled={approve.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {approve.isPending ? "Approving…" : "Approve for Publication"}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (!rejectionNote.trim()) {
                      toast.error("Please enter a rejection reason");
                      return;
                    }
                    reject.mutate({ reviewId, reviewerNote: rejectionNote });
                  }}
                  disabled={reject.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {reject.isPending ? "Rejecting…" : "Reject"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Submit for Review Panel ──────────────────────────────────────────────────

function SubmitReview() {
  const [contentType, setContentType] = useState<ContentType>("wordpress_post");
  const [contentTitle, setContentTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [result, setResult] = useState<null | { overallFlag: boolean; flagCount: number; summary: string; status: string }>(null);
  const utils = trpc.useUtils();

  const submit = trpc.claimsReview.reviewContent.useMutation({
    onSuccess: (data) => {
      setResult(data);
      utils.claimsReview.listPending.invalidate();
      utils.claimsReview.getStats.invalidate();
      if (!data.overallFlag) {
        toast.success("Content passed all rubric checks — auto-approved");
      } else {
        toast.warning(`${data.flagCount} issue${data.flagCount > 1 ? "s" : ""} flagged — review required`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Content Type</label>
          <Select value={contentType} onValueChange={(v) => setContentType(v as ContentType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="wordpress_post">WordPress Post</SelectItem>
              <SelectItem value="meta_ad">Meta Ad</SelectItem>
              <SelectItem value="advertorial">Advertorial</SelectItem>
              <SelectItem value="email_sequence">Email Sequence</SelectItem>
              <SelectItem value="landing_page">Landing Page</SelectItem>
              <SelectItem value="youtube_script">YouTube Script</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Title (optional)</label>
          <input
            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            placeholder="Post or ad title…"
            value={contentTitle}
            onChange={(e) => setContentTitle(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Content to Review</label>
        <Textarea
          placeholder="Paste the full text of the post, ad, or email here…"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          rows={10}
          className="text-sm font-mono"
        />
      </div>

      <Button
        className="w-full"
        onClick={() => submit.mutate({ contentType, contentTitle: contentTitle || undefined, contentText })}
        disabled={submit.isPending || contentText.trim().length < 10}
      >
        <Send className="w-4 h-4 mr-2" />
        {submit.isPending ? "Running AI Rubric…" : "Run Claims Review"}
      </Button>

      {result && (
        <div className={`rounded-lg p-4 border ${result.overallFlag ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
          <div className={`flex items-center gap-2 font-medium mb-2 ${result.overallFlag ? "text-red-400" : "text-green-400"}`}>
            {result.overallFlag ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
            {result.overallFlag ? `${result.flagCount} issue${result.flagCount > 1 ? "s" : ""} flagged — added to review queue` : "All checks passed — auto-approved"}
          </div>
          <p className="text-sm text-muted-foreground">{result.summary}</p>
        </div>
      )}
    </div>
  );
}

// ─── Rubric Viewer ────────────────────────────────────────────────────────────

function RubricViewer() {
  const { data: rules, isLoading } = trpc.claimsReview.getRubric.useQuery();

  if (isLoading) return <div className="text-center text-muted-foreground py-8">Loading rubric…</div>;
  if (!rules || rules.length === 0) return <div className="text-center text-muted-foreground py-8">No rules found.</div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        These rules are applied by the AI on every content submission. Content that fails any rule is routed to the pending queue for human review.
      </p>
      {rules.map((rule: any) => (
        <div key={rule.id} className="border border-border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-sm">{rule.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
            </div>
            <Badge variant={rule.severity === "critical" ? "destructive" : "outline"} className="shrink-0 text-xs">
              {rule.severity}
            </Badge>
          </div>
          {rule.examples && rule.examples.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-1">Examples of violations:</p>
              <ul className="space-y-1">
                {rule.examples.map((ex: string, i: number) => (
                  <li key={i} className="text-xs text-red-400/80 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ClaimsReview() {
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [historyStatus, setHistoryStatus] = useState<"all" | "pending" | "approved" | "rejected" | "auto_approved">("all");

  const { data: stats } = trpc.claimsReview.getStats.useQuery();
  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = trpc.claimsReview.listPending.useQuery();
  const { data: history, isLoading: historyLoading } = trpc.claimsReview.listAll.useQuery({ status: historyStatus, limit: 50 });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            Claims-Review Gate
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI rubric on every health-claim publish path — flagged content requires human approval before going live.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchPending()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Pending", value: stats.pending, color: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
            { label: "Approved", value: stats.approved, color: "text-green-400", icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "Rejected", value: stats.rejected, color: "text-red-400", icon: <XCircle className="w-4 h-4" /> },
            { label: "Auto-Approved", value: stats.autoApproved, color: "text-blue-400", icon: <ShieldCheck className="w-4 h-4" /> },
            { label: "Flag Rate", value: `${stats.flagRate}%`, color: stats.flagRate > 20 ? "text-red-400" : "text-muted-foreground", icon: <AlertTriangle className="w-4 h-4" /> },
          ].map((s) => (
            <Card key={s.label} className="bg-card/50">
              <CardContent className="pt-4 pb-3">
                <div className={`flex items-center gap-2 ${s.color} mb-1`}>
                  {s.icon}
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            Pending Queue
            {stats && stats.pending > 0 && (
              <span className="ml-2 bg-amber-500 text-black text-xs rounded-full px-1.5 py-0.5">{stats.pending}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="submit">Submit for Review</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="rubric">
            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
            Rubric Rules
          </TabsTrigger>
        </TabsList>

        {/* Pending Queue */}
        <TabsContent value="pending" className="mt-4">
          {pendingLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : !pending || pending.length === 0 ? (
            <div className="text-center py-12">
              <ShieldCheck className="w-12 h-12 text-green-500/50 mx-auto mb-3" />
              <p className="text-muted-foreground">No content pending review. Queue is clear.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pending.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 cursor-pointer"
                  onClick={() => setSelectedReviewId(row.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{row.contentTitle ?? "Untitled"}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{contentTypeLabel(row.contentType)}</span>
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {row.flagCount} flag{row.flagCount !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(row.createdAt)}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Review</Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Submit for Review */}
        <TabsContent value="submit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Submit Content for Claims Review</CardTitle>
            </CardHeader>
            <CardContent>
              <SubmitReview />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Select value={historyStatus} onValueChange={(v) => setHistoryStatus(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="auto_approved">Auto-Approved</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{history?.total ?? 0} total</span>
          </div>

          {historyLoading ? (
            <div className="text-center text-muted-foreground py-12">Loading…</div>
          ) : !history?.rows.length ? (
            <div className="text-center text-muted-foreground py-12">No reviews found.</div>
          ) : (
            <div className="space-y-2">
              {history.rows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/20 cursor-pointer"
                  onClick={() => setSelectedReviewId(row.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{row.contentTitle ?? "Untitled"}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">{contentTypeLabel(row.contentType)}</span>
                      {statusBadge(row.status as ReviewStatus)}
                      <span className="text-xs text-muted-foreground">{timeAgo(row.createdAt)}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost">View</Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Rubric Rules */}
        <TabsContent value="rubric" className="mt-4">
          <RubricViewer />
        </TabsContent>
      </Tabs>

      {/* Review Detail Modal */}
      {selectedReviewId !== null && (
        <ReviewDetail reviewId={selectedReviewId} onClose={() => setSelectedReviewId(null)} />
      )}
    </div>
  );
}
