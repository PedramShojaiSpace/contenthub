import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  BookMarked,
  Loader2,
  CheckCircle2,
  Share2,
  RefreshCw,
  Linkedin,
  Twitter,
  Facebook,
  Sparkles,
  Clock,
  Quote,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

const PLATFORM_OPTIONS = [
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "x", label: "X / Twitter", icon: Twitter },
  { id: "meta", label: "Meta / Facebook", icon: Facebook },
  { id: "instagram_feed", label: "Instagram Feed", icon: Share2 },
] as const;

type Platform = (typeof PLATFORM_OPTIONS)[number]["id"];

export default function DailyBookPullPanel() {
  const utils = trpc.useUtils();
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["linkedin", "x", "meta", "instagram_feed"]);
  const [activePlatform, setActivePlatform] = useState<Platform>("linkedin");

  const { data: pull, isLoading, refetch } = trpc.bookLibrary.getDailyBookPull.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const prepare = trpc.bookLibrary.prepareDailyBookPull.useMutation({
    onSuccess: () => {
      toast.success("Daily pull prepared — cards are generating…");
      utils.bookLibrary.getDailyBookPull.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const approve = trpc.bookLibrary.approveDailyBookPull.useMutation({
    onSuccess: (data) => {
      toast.success(`Scheduled to ${data.postedCount} platform${data.postedCount !== 1 ? "s" : ""} via Buffer!`);
      utils.bookLibrary.getDailyBookPull.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const cardUrlForPlatform = (p: Platform): string | null => {
    if (!pull?.snippet) return null;
    const s = pull.snippet;
    switch (p) {
      case "linkedin": return s.titleCardLinkedinUrl ?? null;
      case "x": return s.titleCardXUrl ?? null;
      case "meta": return s.titleCardMetaUrl ?? null;
      case "instagram_feed": return s.titleCardInstagramFeedUrl ?? null;
      default: return null;
    }
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <BookMarked className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Daily Book Pull</CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                {today}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pull?.rotation && (
              <Badge variant="outline" className="text-xs">
                Book {(pull.rotation.rotationIndex % (pull.totalBooks || 1)) + 1} of {pull.totalBooks}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => refetch()}
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !pull?.snippet ? (
          /* No pull ready yet */
          <div className="text-center py-8 space-y-3">
            <Clock className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
            <div>
              <p className="text-sm font-medium">No pull ready for today</p>
              <p className="text-xs text-muted-foreground mt-1">
                The daily cron runs at 6:00 AM CT. You can also prepare one manually.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => prepare.mutate()}
              disabled={prepare.isPending}
              className="gap-1.5"
            >
              {prepare.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Prepare Today's Pull
            </Button>
          </div>
        ) : pull.rotation?.todayStatus === "posted" ? (
          /* Already posted today */
          <div className="flex items-center gap-3 py-4 px-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Posted today</p>
              <p className="text-xs text-muted-foreground">
                From <span className="font-medium">{pull.bookTitle}</span> — {pull.rotation.approvedPlatforms?.split(",").join(", ")}
              </p>
            </div>
          </div>
        ) : (
          /* Pull ready for review */
          <div className="space-y-4">
            {/* Quote */}
            <div className="rounded-lg border bg-background/60 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Quote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm leading-relaxed italic">
                  {pull.snippet.passageText.length > 280
                    ? pull.snippet.passageText.slice(0, 280) + "…"
                    : pull.snippet.passageText}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge variant="secondary" className="text-xs gap-1">
                  <BookMarked className="w-3 h-3" />
                  {pull.bookTitle}
                </Badge>
                {pull.snippet.qualityScore && (
                  <Badge variant="outline" className="text-xs">
                    Score: {pull.snippet.qualityScore}/10
                  </Badge>
                )}
              </div>
            </div>

            {/* Platform card preview */}
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {PLATFORM_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActivePlatform(id)}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      activePlatform === id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>

              {cardUrlForPlatform(activePlatform) ? (
                <div className="rounded-lg overflow-hidden border bg-black/5 flex items-center justify-center" style={{ minHeight: 200 }}>
                  <img
                    src={cardUrlForPlatform(activePlatform)!}
                    alt={`${activePlatform} title card`}
                    className="max-w-full max-h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/30 flex items-center justify-center h-32">
                  <div className="text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground">Card generating…</p>
                  </div>
                </div>
              )}
            </div>

            {/* Platform selection */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Schedule to:</p>
              <div className="grid grid-cols-2 gap-2">
                {PLATFORM_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <div key={id} className="flex items-center gap-2">
                    <Checkbox
                      id={`platform-${id}`}
                      checked={selectedPlatforms.includes(id)}
                      onCheckedChange={() => togglePlatform(id)}
                    />
                    <Label htmlFor={`platform-${id}`} className="flex items-center gap-1.5 text-sm cursor-pointer">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Approve button */}
            <Button
              className="w-full gap-2"
              disabled={approve.isPending || selectedPlatforms.length === 0}
              onClick={() =>
                approve.mutate({
                  platforms: selectedPlatforms as string[],
                })
              }
            >
              {approve.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              Approve & Schedule to Buffer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
