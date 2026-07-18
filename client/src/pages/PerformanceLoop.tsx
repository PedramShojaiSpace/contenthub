/**
 * Performance Loop — Phase F
 *
 * 90-day feedback loop: record script performance, update pattern weights.
 * Tabs: Pending (scripts awaiting 90-day feedback), Submit, History, Stats
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/DashboardLayout";

// ─── Pending Tab ──────────────────────────────────────────────────────────────

function PendingTab({ onSelectScript }: { onSelectScript: (id: number, title: string) => void }) {
  const { data: pending = [], isLoading, refetch } = trpc.performanceLoop.getPendingFeedback.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Approved scripts that are 90+ days old and haven't received performance feedback yet.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : pending.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No scripts pending 90-day feedback. Check back later.</p>
          <p className="text-xs mt-1">Scripts appear here 90 days after approval.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pending.map((s) => (
            <div key={s.id} className="border rounded-lg p-4 bg-card flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{s.format}</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Approved {new Date((s as any).approvedAt ?? s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onSelectScript(s.id, s.title)}
              >
                <Activity className="w-3.5 h-3.5 mr-1" /> Submit Feedback
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submit Tab ───────────────────────────────────────────────────────────────

function SubmitTab({ preSelectedId, preSelectedTitle }: { preSelectedId?: number; preSelectedTitle?: string }) {
  const [scriptId, setScriptId] = useState<string>(preSelectedId?.toString() ?? "");
  const [videoId, setVideoId] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(new Date().toISOString().split("T")[0]);
  const [ctrPct, setCtrPct] = useState("");
  const [retentionPct, setRetentionPct] = useState("");
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{
    outlierScore: number; isOutlier: boolean; patternsUpdated: number; normalizedScore: number;
  } | null>(null);

  const utils = trpc.useUtils();

  const submit = trpc.performanceLoop.submitFeedback.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(
        data.isOutlier
          ? `Outlier! Score ${data.outlierScore} — patterns updated and script auto-approved.`
          : `Feedback recorded. Outlier score: ${data.outlierScore}. ${data.patternsUpdated} patterns updated.`
      );
      // Refresh all related tabs immediately
      utils.performanceLoop.getPendingFeedback.invalidate();
      utils.performanceLoop.listFeedback.invalidate();
      utils.performanceLoop.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const id = parseInt(scriptId);
    if (!id || isNaN(id)) { toast.error("Please enter a valid script ID."); return; }
    if (!feedbackDate) { toast.error("Please enter a feedback date."); return; }

    submit.mutate({
      scriptId: id,
      videoId: videoId || undefined,
      feedbackDate,
      ctrPct: ctrPct ? parseFloat(ctrPct) : undefined,
      avgViewDurationPct: retentionPct ? parseFloat(retentionPct) : undefined,
      views: views ? parseInt(views) : undefined,
      likes: likes ? parseInt(likes) : undefined,
      comments: comments ? parseInt(comments) : undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Submit 90-Day Performance Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {preSelectedTitle && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
              <strong>Script:</strong> {preSelectedTitle}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Script ID *</label>
              <Input
                type="number"
                placeholder="e.g. 42"
                value={scriptId}
                onChange={(e) => setScriptId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">YouTube Video ID</label>
              <Input
                placeholder="e.g. dQw4w9WgXcQ"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Feedback Date *</label>
            <Input
              type="date"
              value={feedbackDate}
              onChange={(e) => setFeedbackDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">CTR %</label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 6.2"
                value={ctrPct}
                onChange={(e) => setCtrPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Avg View Duration %</label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 52.4"
                value={retentionPct}
                onChange={(e) => setRetentionPct(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Views</label>
              <Input type="number" placeholder="e.g. 12500" value={views} onChange={(e) => setViews(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Likes</label>
              <Input type="number" placeholder="e.g. 450" value={likes} onChange={(e) => setLikes(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Comments</label>
              <Input type="number" placeholder="e.g. 38" value={comments} onChange={(e) => setComments(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              placeholder="Any observations about what worked or didn't…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={submit.isPending || !scriptId || !feedbackDate}
          >
            {submit.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Submit & Update Pattern Weights</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 space-y-2">
          <p><strong>How the feedback loop works:</strong></p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Submit CTR and retention % at 90 days after publishing</li>
            <li>System computes outlier score vs. 90-day channel baseline</li>
            <li>Pattern effectiveness scores update: <code className="bg-amber-100 px-1 rounded">new = 0.7×old + 0.3×signal</code></li>
            <li>Scripts scoring ≥1.5σ are auto-approved as proven outliers</li>
            <li>Next Script Factory run uses updated pattern weights</li>
          </ol>
        </div>

        {result && (
          <Card className={result.isOutlier ? "border-green-300 bg-green-50" : ""}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-2">
                {result.isOutlier ? (
                  <Badge className="bg-green-600 text-white text-sm px-3 py-1">
                    <TrendingUp className="w-4 h-4 mr-1" /> OUTLIER — Score {result.outlierScore}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    Score {result.outlierScore} (below 1.5σ threshold)
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Normalized signal:</span>
                  <span className="font-bold ml-2">{(result.normalizedScore * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Patterns updated:</span>
                  <span className="font-bold ml-2">{result.patternsUpdated}</span>
                </div>
              </div>
              {result.isOutlier && (
                <p className="text-xs text-green-700">
                  <ShieldCheck className="w-3 h-3 inline mr-1" />
                  Script auto-approved. Pattern weights boosted. Future scripts will use these patterns more.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab() {
  const { data: feedback = [], isLoading, refetch } = trpc.performanceLoop.listFeedback.useQuery({
    limit: 50, offset: 0,
  });

  const utils = trpc.useUtils();

  const deleteFeedback = trpc.performanceLoop.deleteFeedback.useMutation({
    onSuccess: () => {
      refetch();
      utils.performanceLoop.getPendingFeedback.invalidate();
      utils.performanceLoop.getStats.invalidate();
      toast.success("Feedback deleted.");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{feedback.length} feedback records</span>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : feedback.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback records yet. Submit your first 90-day report.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-xs">
                <th className="text-left py-2 pr-4">Script ID</th>
                <th className="text-left py-2 pr-4">Video ID</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-right py-2 pr-4">CTR %</th>
                <th className="text-right py-2 pr-4">Retention %</th>
                <th className="text-right py-2 pr-4">Views</th>
                <th className="text-right py-2 pr-4">Outlier Score</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 pr-4 font-mono text-xs">{f.scriptId}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{f.videoId ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs">{String(f.feedbackDate)}</td>
                  <td className="py-2 pr-4 text-right">{f.ctrPct != null ? `${f.ctrPct.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 pr-4 text-right">{f.avgViewDurationPct != null ? `${f.avgViewDurationPct.toFixed(1)}%` : "—"}</td>
                  <td className="py-2 pr-4 text-right">{f.views?.toLocaleString() ?? "—"}</td>
                  <td className="py-2 pr-4 text-right">
                    {f.outlierScore != null ? (
                      <span className={f.outlierScore >= 1.5 ? "text-green-700 font-bold" : ""}>
                        {f.outlierScore.toFixed(2)}
                        {f.outlierScore >= 1.5 && " ✓"}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteFeedback.mutate({ id: f.id })}>
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

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: stats, isLoading } = trpc.performanceLoop.getStats.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{stats?.total ?? 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Feedback Records</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">{stats?.outliers ?? 0}</div>
            <div className="text-sm text-muted-foreground mt-1">Outlier Scripts</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">
              {stats?.avgOutlierScore != null ? stats.avgOutlierScore.toFixed(2) : "—"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Avg Outlier Score</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-primary">{stats?.threshold ?? 1.5}σ</div>
            <div className="text-sm text-muted-foreground mt-1">Outlier Threshold</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-3">Pattern Weight Update Formula</h3>
          <div className="bg-muted/30 rounded-lg p-4 font-mono text-sm space-y-2">
            <p><span className="text-primary">new_effectiveness</span> = 0.7 × old_effectiveness + 0.3 × normalized_outlier_score</p>
            <p className="text-xs text-muted-foreground">Where normalized_outlier_score = min(1.0, outlier_score / 3.0)</p>
            <p className="text-xs text-muted-foreground">Outlier threshold: ≥ 1.5σ above 90-day channel baseline (CTR + retention)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PerformanceLoop() {
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedScriptId, setSelectedScriptId] = useState<number | undefined>();
  const [selectedScriptTitle, setSelectedScriptTitle] = useState<string | undefined>();

  const handleSelectScript = (id: number, title: string) => {
    setSelectedScriptId(id);
    setSelectedScriptTitle(title);
    setActiveTab("submit");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Performance Loop</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submit 90-day performance data for published scripts. Pattern weights update automatically.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending">
              <Clock className="w-4 h-4 mr-1.5" /> Pending
            </TabsTrigger>
            <TabsTrigger value="submit">
              <Activity className="w-4 h-4 mr-1.5" /> Submit
            </TabsTrigger>
            <TabsTrigger value="history">
              <BarChart3 className="w-4 h-4 mr-1.5" /> History
            </TabsTrigger>
            <TabsTrigger value="stats">
              <TrendingUp className="w-4 h-4 mr-1.5" /> Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <PendingTab onSelectScript={handleSelectScript} />
          </TabsContent>
          <TabsContent value="submit" className="mt-4">
            {/* key forces remount when a new script is selected from Pending tab */}
            <SubmitTab key={selectedScriptId ?? "empty"} preSelectedId={selectedScriptId} preSelectedTitle={selectedScriptTitle} />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <HistoryTab />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
