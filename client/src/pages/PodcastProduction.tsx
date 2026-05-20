/**
 * PodcastProduction.tsx
 *
 * Main Podcast Production page.
 * Left side: list of all episodes with status badges.
 * Right side: guest intake form to create a new episode prep session.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Loader2,
  Mic,
  Plus,
  Radio,
  Trash2,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type Episode = {
  id: number;
  guestName: string;
  guestRole?: string | null;
  guestCompany?: string | null;
  episodeNumber?: number | null;
  status: "pending" | "generating" | "complete" | "failed";
  intakeStatus?: "not_sent" | "sent" | "submitted" | null;
  intakeToken?: string | null;
  createdAt: Date;
};

// ─── Status helpers ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Episode["status"] }) {
  const map = {
    pending: { label: "Pending", icon: Clock, className: "bg-amber-100 text-amber-800 border-amber-200" },
    generating: { label: "Generating…", icon: Loader2, className: "bg-blue-100 text-blue-800 border-blue-200" },
    complete: { label: "Ready", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    failed: { label: "Failed", icon: AlertCircle, className: "bg-red-100 text-red-800 border-red-200" },
  };
  const { label, icon: Icon, className } = map[status];
  return (
    <Badge variant="outline" className={`gap-1 text-xs ${className}`}>
      <Icon className={`w-3 h-3 ${status === "generating" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
}

// ─── New Episode Dialog ───────────────────────────────────────────────────────

function NewEpisodeDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    guestName: "",
    guestRole: "",
    guestCompany: "",
    whyNow: "",
    backgroundUrls: "",
    backgroundText: "",
    episodeLengthMin: 45,
    episodeNumber: "",
  });

  const utils = trpc.useUtils();
  const createEpisode = trpc.podcast.createEpisode.useMutation({
    onSuccess: (episode) => {
      utils.podcast.getEpisodes.invalidate();
      setOpen(false);
      resetForm();
      onCreated(episode.id);
      toast.success(`Episode prep for ${episode.guestName} created — generating report now.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateReport = trpc.podcast.generateReport.useMutation({
    onSuccess: () => utils.podcast.getEpisodes.invalidate(),
    onError: (err) => toast.error(`Report generation failed: ${err.message}`),
  });

  function resetForm() {
    setForm({
      guestName: "",
      guestRole: "",
      guestCompany: "",
      whyNow: "",
      backgroundUrls: "",
      backgroundText: "",
      episodeLengthMin: 45,
      episodeNumber: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.guestName.trim()) {
      toast.error("Guest name is required");
      return;
    }
    const episode = await createEpisode.mutateAsync({
      guestName: form.guestName.trim(),
      guestRole: form.guestRole.trim() || undefined,
      guestCompany: form.guestCompany.trim() || undefined,
      whyNow: form.whyNow.trim() || undefined,
      backgroundUrls: form.backgroundUrls.trim() || undefined,
      backgroundText: form.backgroundText.trim() || undefined,
      episodeLengthMin: form.episodeLengthMin,
      episodeNumber: form.episodeNumber ? parseInt(form.episodeNumber) : undefined,
    });
    // Immediately kick off report generation
    generateReport.mutate({ episodeId: episode.id });
  }

  const isPending = createEpisode.isPending || generateReport.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          New Episode Prep
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            New Podcast Episode Prep
          </DialogTitle>
          <DialogDescription>
            Enter your guest details and any background context. Claude will generate a full
            BINGE-framework research report — dossier, interview outline, question bank, and
            soundbite setups.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Guest basics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="guestName">
                Guest Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="guestName"
                placeholder="e.g. Dr. Mark Hyman"
                value={form.guestName}
                onChange={(e) => setForm((f) => ({ ...f, guestName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="episodeNumber">Episode Number (optional)</Label>
              <Input
                id="episodeNumber"
                type="number"
                placeholder="e.g. 312"
                value={form.episodeNumber}
                onChange={(e) => setForm((f) => ({ ...f, episodeNumber: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="guestRole">Role / Title</Label>
              <Input
                id="guestRole"
                placeholder="e.g. Author & Functional Medicine Doctor"
                value={form.guestRole}
                onChange={(e) => setForm((f) => ({ ...f, guestRole: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guestCompany">Company / Organization</Label>
              <Input
                id="guestCompany"
                placeholder="e.g. Cleveland Clinic"
                value={form.guestCompany}
                onChange={(e) => setForm((f) => ({ ...f, guestCompany: e.target.value }))}
              />
            </div>
          </div>

          {/* Episode length */}
          <div className="space-y-1.5">
            <Label htmlFor="episodeLength">Episode Length (minutes)</Label>
            <Input
              id="episodeLength"
              type="number"
              min={10}
              max={180}
              value={form.episodeLengthMin}
              onChange={(e) =>
                setForm((f) => ({ ...f, episodeLengthMin: parseInt(e.target.value) || 45 }))
              }
              className="w-32"
            />
          </div>

          {/* Why this guest */}
          <div className="space-y-1.5">
            <Label htmlFor="whyNow">Why this guest, why now?</Label>
            <Textarea
              id="whyNow"
              placeholder="e.g. Just released a new book on metabolic health, trending topic after recent Netflix doc…"
              rows={2}
              value={form.whyNow}
              onChange={(e) => setForm((f) => ({ ...f, whyNow: e.target.value }))}
            />
          </div>

          {/* Background URLs */}
          <div className="space-y-1.5">
            <Label htmlFor="backgroundUrls">Background URLs (one per line)</Label>
            <Textarea
              id="backgroundUrls"
              placeholder={`https://guestwebsite.com\nhttps://youtube.com/watch?v=...\nhttps://podcast.com/episode/...`}
              rows={3}
              value={form.backgroundUrls}
              onChange={(e) => setForm((f) => ({ ...f, backgroundUrls: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Paste any URLs — website, previous interviews, social profiles, recent articles.
            </p>
          </div>

          {/* Background text */}
          <div className="space-y-1.5">
            <Label htmlFor="backgroundText">Background Notes / Bio (optional)</Label>
            <Textarea
              id="backgroundText"
              placeholder="Paste a bio, press kit, transcript excerpts, or any notes about the guest…"
              rows={4}
              value={form.backgroundText}
              onChange={(e) => setForm((f) => ({ ...f, backgroundText: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Create & Generate Report
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Episode Card ─────────────────────────────────────────────────────────────

function EpisodeCard({
  episode,
  onClick,
  onDelete,
  onShareLink,
}: {
  episode: Episode;
  onClick: () => void;
  onDelete: () => void;
  onShareLink: () => void;
}) {
  const guestLabel = [episode.guestRole, episode.guestCompany].filter(Boolean).join(" · ");

  const intakeBadge =
    episode.intakeStatus === "submitted"
      ? { label: "Form submitted", className: "bg-green-100 text-green-700 border-green-200" }
      : episode.intakeStatus === "sent"
      ? { label: "Link sent", className: "bg-blue-100 text-blue-700 border-blue-200" }
      : null;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border/60 group"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Mic className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {episode.episodeNumber && (
                  <span className="text-xs font-mono text-muted-foreground">
                    #{episode.episodeNumber}
                  </span>
                )}
                <span className="font-semibold text-sm truncate">{episode.guestName}</span>
              </div>
              {guestLabel && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{guestLabel}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={episode.status} />
                {intakeBadge && (
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${intakeBadge.className}`}>
                    {intakeBadge.label}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(episode.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onShareLink();
              }}
              title="Get guest intake link"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete episode"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PodcastProduction() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: episodes, isLoading } = trpc.podcast.getEpisodes.useQuery();

  const deleteEpisode = trpc.podcast.deleteEpisode.useMutation({
    onSuccess: () => {
      utils.podcast.getEpisodes.invalidate();
      toast.success("Episode deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const generateIntakeLink = trpc.podcast.generateIntakeLink.useMutation({
    onSuccess: (data) => {
      utils.podcast.getEpisodes.invalidate();
      navigator.clipboard.writeText(data.url).then(() => {
        toast.success("Intake link copied to clipboard!", {
          description: data.url,
          duration: 5000,
        });
      }).catch(() => {
        // Fallback: show the URL in a toast so user can copy manually
        toast.info("Intake link generated", {
          description: data.url,
          duration: 10000,
        });
      });
    },
    onError: (err) => toast.error(err.message),
  });

  function handleCreated(id: number) {
    navigate(`/podcast-production/${id}`);
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete episode prep for "${name}"? This cannot be undone.`)) return;
    deleteEpisode.mutate({ id });
  }

  function handleShareLink(id: number) {
    generateIntakeLink.mutate({ id, origin: window.location.origin });
  }

  const completeCount = episodes?.filter((e) => e.status === "complete").length ?? 0;
  const pendingCount = episodes?.filter((e) => e.status !== "complete").length ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">Podcast Production</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            BINGE-framework episode prep — guest dossier, interview outline, and question bank
            generated by Claude.
          </p>
        </div>
        <NewEpisodeDialog onCreated={handleCreated} />
      </div>

      {/* Stats strip */}
      {episodes && episodes.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-card border rounded-lg px-4 py-2.5 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-primary">{episodes.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="bg-card border rounded-lg px-4 py-2.5 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-emerald-600">{completeCount}</div>
            <div className="text-xs text-muted-foreground">Ready</div>
          </div>
          <div className="bg-card border rounded-lg px-4 py-2.5 text-center min-w-[90px]">
            <div className="text-2xl font-bold text-amber-600">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>
      )}

      {/* Episode list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !episodes || episodes.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Mic className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
            <CardTitle className="text-lg mb-2">No episodes yet</CardTitle>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              Create your first episode prep session. Enter your guest's name and any background
              context — Claude will generate a full BINGE-framework research report.
            </p>
            <NewEpisodeDialog onCreated={handleCreated} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode as Episode}
              onClick={() => navigate(`/podcast-production/${episode.id}`)}
              onDelete={() => handleDelete(episode.id, episode.guestName)}
              onShareLink={() => handleShareLink(episode.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
