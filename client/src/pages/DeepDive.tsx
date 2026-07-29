/**
 * Paid Tier Deep Dive — Weekly Premium Content Generator
 *
 * Mines Pedram's book corpus to produce weekly deep dives
 * delivered exclusively to paid Substack subscribers.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  BookOpen,
  Sparkles,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Lock,
  Eye,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import { Streamdown } from "streamdown";

// ─── Types ─────────────────────────────────────────────────────────────────────
type DeepDiveStatus = "draft" | "ready" | "published" | "archived";

interface DeepDive {
  id: number;
  theme: string;
  title: string;
  teaser: string | null;
  practiceBody: string | null;
  insightBody: string | null;
  protocolBody: string | null;
  fullContent: string | null;
  bookSources: string | null;
  status: DeepDiveStatus;
  paidOnly: boolean;
  publishedAt: number | null;
  substackPostUrl: string | null;
  notes: string | null;
  createdAt: Date;
}

// ─── Status badge helper ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: DeepDiveStatus }) {
  const variants: Record<DeepDiveStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    ready: { label: "Ready", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    published: { label: "Published", className: "bg-green-500/20 text-green-400 border-green-500/30" },
    archived: { label: "Archived", className: "bg-muted text-muted-foreground border-border" },
  };
  const v = variants[status] ?? variants.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${v.className}`}>
      {v.label}
    </span>
  );
}

// ─── Deep Dive Card ────────────────────────────────────────────────────────────
function DeepDiveCard({
  dive,
  onRefresh,
}: {
  dive: DeepDive;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(dive.title);
  const [editTeaser, setEditTeaser] = useState(dive.teaser ?? "");
  const [editPractice, setEditPractice] = useState(dive.practiceBody ?? "");
  const [editInsight, setEditInsight] = useState(dive.insightBody ?? "");
  const [editProtocol, setEditProtocol] = useState(dive.protocolBody ?? "");
  const [editNotes, setEditNotes] = useState(dive.notes ?? "");
  const [sendEmail, setSendEmail] = useState(true);

  const utils = trpc.useUtils();

  const updateMutation = trpc.deepDive.update.useMutation({
    onSuccess: () => {
      toast.success("Deep dive saved");
      setEditing(false);
      onRefresh();
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  });

  const publishMutation = trpc.deepDive.publish.useMutation({
    onSuccess: (data) => {
      toast.success("Published to paid subscribers!");
      onRefresh();
      if (data.postUrl) window.open(data.postUrl, "_blank");
    },
    onError: (err) => toast.error(`Publish failed: ${err.message}`),
  });

  const deleteMutation = trpc.deepDive.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      onRefresh();
    },
    onError: (err) => toast.error(`Delete failed: ${err.message}`),
  });

  const markReadyMutation = trpc.deepDive.update.useMutation({
    onSuccess: () => {
      toast.success("Marked as ready");
      onRefresh();
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      id: dive.id,
      title: editTitle,
      teaser: editTeaser,
      practiceBody: editPractice,
      insightBody: editInsight,
      protocolBody: editProtocol,
      notes: editNotes,
    });
  };

  const handleMarkReady = () => {
    markReadyMutation.mutate({ id: dive.id, status: "ready" });
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusBadge status={dive.status} />
            {dive.paidOnly && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" /> Paid Only
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(dive.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h3 className="font-semibold text-foreground leading-tight">
            {editing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="font-semibold text-base"
              />
            ) : (
              dive.title
            )}
          </h3>
          {dive.teaser && !editing && (
            <p className="text-sm text-muted-foreground mt-1 italic">{dive.teaser}</p>
          )}
          {editing && (
            <Input
              value={editTeaser}
              onChange={(e) => setEditTeaser(e.target.value)}
              placeholder="Teaser / subtitle"
              className="mt-2 text-sm"
            />
          )}
          {dive.bookSources && (
            <p className="text-xs text-muted-foreground mt-1">
              📚 {dive.bookSources}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {dive.substackPostUrl && (
            <a
              href={dive.substackPostUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Practice */}
          <div>
            <Label className="text-xs font-semibold text-primary uppercase tracking-wide mb-1 block">
              The Practice
            </Label>
            {editing ? (
              <Textarea
                value={editPractice}
                onChange={(e) => setEditPractice(e.target.value)}
                rows={6}
                className="text-sm font-mono"
              />
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
                <Streamdown>{dive.practiceBody ?? ""}</Streamdown>
              </div>
            )}
          </div>

          {/* Insight */}
          <div>
            <Label className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1 block">
              The Insight
            </Label>
            {editing ? (
              <Textarea
                value={editInsight}
                onChange={(e) => setEditInsight(e.target.value)}
                rows={6}
                className="text-sm font-mono"
              />
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
                <Streamdown>{dive.insightBody ?? ""}</Streamdown>
              </div>
            )}
          </div>

          {/* Protocol */}
          <div>
            <Label className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-1 block">
              The Protocol
            </Label>
            {editing ? (
              <Textarea
                value={editProtocol}
                onChange={(e) => setEditProtocol(e.target.value)}
                rows={6}
                className="text-sm font-mono"
              />
            ) : (
              <div className="prose prose-sm prose-invert max-w-none text-sm text-muted-foreground">
                <Streamdown>{dive.protocolBody ?? ""}</Streamdown>
              </div>
            )}
          </div>

          {/* Notes */}
          {editing && (
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">
                Editor Notes
              </Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes..."
                className="text-sm"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {editing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                  )}
                  Save Changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(true)}
                >
                  <Edit3 className="w-3 h-3 mr-1" /> Edit
                </Button>
                {dive.status === "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleMarkReady}
                    disabled={markReadyMutation.isPending}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Ready
                  </Button>
                )}
                {dive.status !== "published" && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendEmail}
                        onChange={(e) => setSendEmail(e.target.checked)}
                        className="rounded"
                      />
                      Send email
                    </label>
                    <Button
                      size="sm"
                      onClick={() => publishMutation.mutate({ id: dive.id, sendEmail })}
                      disabled={publishMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {publishMutation.isPending ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Send className="w-3 h-3 mr-1" />
                      )}
                      Publish to Paid Subscribers
                    </Button>
                  </div>
                )}
                {dive.status === "published" && dive.substackPostUrl && (
                  <a
                    href={dive.substackPostUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-3 h-3 mr-1" /> View on Substack
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive ml-auto"
                  onClick={() => {
                    if (confirm("Delete this deep dive?")) {
                      deleteMutation.mutate({ id: dive.id });
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DeepDivePage() {
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: themes = [] } = trpc.deepDive.getThemes.useQuery();
  const { data: books = [] } = trpc.deepDive.getBooks.useQuery();
  const {
    data: dives = [],
    isLoading: divesLoading,
    refetch: refetchDives,
  } = trpc.deepDive.list.useQuery({ limit: 50, offset: 0 });

  const generateMutation = trpc.deepDive.generate.useMutation({
    onSuccess: () => {
      toast.success("Deep dive generated! Review and publish when ready.");
      refetchDives();
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      theme: selectedTheme || undefined,
    });
  };

  const handleRefresh = () => {
    refetchDives();
    setRefreshKey(k => k + 1);
  };

  const publishedCount = dives.filter(d => d.status === "published").length;
  const draftCount = dives.filter(d => d.status === "draft").length;
  const readyCount = dives.filter(d => d.status === "ready").length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl font-bold text-foreground">Paid Deep Dives</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Lock className="w-3 h-3" /> Paid Subscribers Only
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Weekly premium content mined from Pedram's books — delivered exclusively to paid Substack subscribers.
            </p>
          </div>
          <div className="flex gap-3 text-center shrink-0">
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{publishedCount}</div>
              <div className="text-xs text-muted-foreground">Published</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{readyCount}</div>
              <div className="text-xs text-muted-foreground">Ready</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-foreground">{draftCount}</div>
              <div className="text-xs text-muted-foreground">Drafts</div>
            </div>
          </div>
        </div>

        {/* Generator panel */}
        <div className="border border-border rounded-lg bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-foreground">Generate New Deep Dive</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Theme (optional — auto-rotates if blank)</Label>
              <Select value={selectedTheme} onValueChange={setSelectedTheme}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-select next theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Auto-select next theme</SelectItem>
                  {themes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Available Books ({books.length} ready)</Label>
              <div className="flex flex-wrap gap-1 min-h-[38px] items-center">
                {books.map((b) => (
                  <Badge key={b.id} variant="outline" className="text-xs">
                    {b.title ?? `Book #${b.id}`}
                  </Badge>
                ))}
                {books.length === 0 && (
                  <span className="text-xs text-muted-foreground">No books ready yet</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating from books…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Deep Dive
                </>
              )}
            </Button>
            {generateMutation.isPending && (
              <span className="text-xs text-muted-foreground">
                Mining book corpus and writing with Pedram's voice…
              </span>
            )}
          </div>

          {/* How it works */}
          <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How it works:</p>
            <p>1. Selects the next theme in rotation (or use the dropdown to pick one)</p>
            <p>2. Scans all uploaded books for the most relevant passages</p>
            <p>3. Writes a deep dive in Pedram's voice: The Practice, The Insight, The Protocol</p>
            <p>4. Saves as a draft — review, edit, then publish to paid subscribers only</p>
          </div>
        </div>

        {/* Deep dives list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">
              All Deep Dives ({dives.length})
            </h2>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>

          {divesLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Loading deep dives…
            </div>
          ) : dives.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border rounded-lg">
              <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No deep dives yet.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Click "Generate Deep Dive" to create your first premium piece.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(dives as DeepDive[]).map((dive) => (
                <DeepDiveCard key={`${dive.id}-${refreshKey}`} dive={dive} onRefresh={handleRefresh} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
