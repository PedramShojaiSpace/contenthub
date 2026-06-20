/**
 * MetaAdPushTab — Push ad creatives to Meta Ads Manager
 *
 * Shows all 15 KBMO ads (5 variants × 3 ads) with:
 *  - Ad preview cards (image, headline, copy excerpt, CTA)
 *  - Per-ad push button
 *  - Per-variant batch push button
 *  - "Push All 15" button
 *  - Push history log
 *  - App Live Mode setup guide (shown when app is in dev mode)
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Zap,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdItem {
  adId: string;
  adName: string;
  imageFile: string;
  imageHash: string;
  headline: string;
  primaryText: string;
  description?: string;
  cta: string;
  landingUrl?: string;
}

interface VariantCatalog {
  variantNum: number;
  variantSlug: string;
  variantName: string;
  ads: AdItem[];
}

// ─── Variant color map ────────────────────────────────────────────────────────
const VARIANT_COLORS: Record<string, string> = {
  precision: "bg-blue-500/10 border-blue-500/30 text-blue-400",
  optimizer: "bg-purple-500/10 border-purple-500/30 text-purple-400",
  gutbrain: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  autoimmune: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  weight: "bg-rose-500/10 border-rose-500/30 text-rose-400",
};

const VARIANT_BADGE: Record<string, string> = {
  precision: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  optimizer: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  gutbrain: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  autoimmune: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  weight: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

// ─── Setup Guide ──────────────────────────────────────────────────────────────
function AppLiveModeGuide() {
  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-amber-400 text-base">
          <AlertTriangle className="w-4 h-4" />
          One-Time Setup Required: Switch Meta App to Live Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          The Meta app <strong className="text-foreground">"Urban Monk Ads Manager"</strong> is currently in{" "}
          <strong className="text-amber-400">Development Mode</strong>. Ad creatives can only be created via API
          when the app is in Live mode.
        </p>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Steps to switch to Live mode:</p>
          <ol className="list-decimal list-inside space-y-1.5 ml-2">
            <li>
              Go to{" "}
              <a
                href="https://developers.facebook.com/apps/2150724875769823/settings/basic/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline underline-offset-2 hover:text-blue-300"
              >
                developers.facebook.com → App Settings → Basic
              </a>
            </li>
            <li>
              Scroll to <strong className="text-foreground">Privacy Policy URL</strong> — add{" "}
              <code className="bg-muted px-1 rounded text-xs">https://theurbanmonk.com/privacy</code>
            </li>
            <li>
              Scroll to <strong className="text-foreground">App Mode</strong> toggle at the top of the page
            </li>
            <li>
              Click the toggle to switch from <strong className="text-amber-400">Development</strong> to{" "}
              <strong className="text-emerald-400">Live</strong>
            </li>
            <li>Confirm the dialog — no review required for ad management apps</li>
          </ol>
        </div>
        <p className="text-xs text-muted-foreground border-t border-border pt-2 mt-2">
          All 15 images are already uploaded to Meta's ad image library. Once the app is Live, push all 15 ads
          in one click below.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Ad Card ──────────────────────────────────────────────────────────────────
function AdCard({
  ad,
  variantSlug,
  onPush,
  isPushing,
  pushStatus,
}: {
  ad: AdItem;
  variantSlug: string;
  onPush: () => void;
  isPushing: boolean;
  pushStatus?: "pushed" | "failed" | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = VARIANT_COLORS[variantSlug] ?? "bg-muted/10 border-border text-muted-foreground";

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${colorClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">{ad.adName}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{ad.imageFile}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pushStatus === "pushed" && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Pushed
            </Badge>
          )}
          {pushStatus === "failed" && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
              <XCircle className="w-3 h-3 mr-1" /> Failed
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onPush}
            disabled={isPushing || pushStatus === "pushed"}
            className="text-xs h-7 px-2"
          >
            {isPushing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : pushStatus === "pushed" ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            <span className="ml-1">{pushStatus === "pushed" ? "Pushed" : "Push"}</span>
          </Button>
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm font-medium text-foreground leading-snug">{ad.headline}</p>

      {/* Copy preview */}
      <div className="text-xs text-muted-foreground">
        <p className={expanded ? "whitespace-pre-wrap" : "line-clamp-2"}>
          {ad.primaryText}
        </p>
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3 h-3" /> Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" /> Read full copy
            </>
          )}
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-white/5">
        <span>
          CTA: <strong className="text-foreground">{ad.cta}</strong>
        </span>
        <span className="truncate max-w-[200px]">
          {ad.description}
        </span>
      </div>
    </div>
  );
}

// ─── Push History ─────────────────────────────────────────────────────────────
function PushHistory() {
  const { data: history, isLoading, refetch } = trpc.metaAdPush.getPushHistory.useQuery({ limit: 30 });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading push history...
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No push history yet. Push your first ad above.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium">Recent Pushes</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>
      <div className="space-y-1.5">
        {history.map((push) => (
          <div
            key={push.id}
            className="flex items-center justify-between text-xs rounded-md bg-muted/30 px-3 py-2 gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              {push.status === "pushed" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : push.status === "failed" ? (
                <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : (
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
              )}
              <span className="truncate text-foreground">{push.adName}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Badge
                variant="outline"
                className={`text-[10px] ${VARIANT_BADGE[push.variantSlug] ?? "bg-muted text-muted-foreground"}`}
              >
                {push.variantSlug}
              </Badge>
              {push.metaCampaignId && (
                <a
                  href={`https://www.facebook.com/adsmanager/manage/campaigns?act=${push.metaCampaignId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <span className="text-muted-foreground">
                {push.pushedAt ? new Date(push.pushedAt).toLocaleDateString() : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MetaAdPushTab() {
  const { data: catalog, isLoading } = trpc.metaAdPush.getCatalog.useQuery();
  const utils = trpc.useUtils();

  // Track per-ad push state
  const [pushingAds, setPushingAds] = useState<Record<string, boolean>>({});
  const [adStatuses, setAdStatuses] = useState<Record<string, "pushed" | "failed">>({});
  const [pushingVariant, setPushingVariant] = useState<string | null>(null);
  const [pushingAll, setPushingAll] = useState(false);
  const [devModeError, setDevModeError] = useState(false);

  const pushAdMutation = trpc.metaAdPush.pushAd.useMutation();
  const pushVariantMutation = trpc.metaAdPush.pushVariantBatch.useMutation();
  const pushAllMutation = trpc.metaAdPush.pushAllBatches.useMutation();

  const handlePushAd = async (variantSlug: string, adId: string) => {
    const key = `${variantSlug}:${adId}`;
    setPushingAds((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await pushAdMutation.mutateAsync({ variantSlug, adId });
      setAdStatuses((prev) => ({ ...prev, [key]: "pushed" }));
      toast.success("Ad pushed to Meta!", {
        description: (
          <a
            href={result.adsManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline"
          >
            View in Ads Manager →
          </a>
        ) as any,
      });
      utils.metaAdPush.getPushHistory.invalidate();
    } catch (err: any) {
      setAdStatuses((prev) => ({ ...prev, [key]: "failed" }));
      const msg = err.message ?? "Push failed";
      if (msg.includes("META_APP_DEV_MODE")) {
        setDevModeError(true);
        toast.error("Meta app is in Development Mode", {
          description: "See the setup guide above to switch to Live mode.",
        });
      } else {
        toast.error("Push failed", { description: msg.slice(0, 120) });
      }
    } finally {
      setPushingAds((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handlePushVariant = async (variantSlug: string) => {
    setPushingVariant(variantSlug);
    try {
      const result = await pushVariantMutation.mutateAsync({ variantSlug });
      const pushed = result.results.filter((r) => r.success).length;
      const failed = result.results.filter((r) => !r.success).length;

      // Update local statuses
      result.results.forEach((r) => {
        const key = `${variantSlug}:${r.adId}`;
        setAdStatuses((prev) => ({ ...prev, [key]: r.success ? "pushed" : "failed" }));
      });

      if (failed === 0) {
        toast.success(`All ${pushed} ads pushed successfully!`);
      } else {
        toast.warning(`${pushed} pushed, ${failed} failed`);
        if (result.results.some((r) => r.error?.includes("META_APP_DEV_MODE"))) {
          setDevModeError(true);
        }
      }
      utils.metaAdPush.getPushHistory.invalidate();
    } catch (err: any) {
      toast.error("Batch push failed", { description: err.message?.slice(0, 120) });
    } finally {
      setPushingVariant(null);
    }
  };

  const handlePushAll = async () => {
    setPushingAll(true);
    try {
      const result = await pushAllMutation.mutateAsync({});
      result.results.forEach((r) => {
        const key = `${r.variantSlug}:${r.adId}`;
        setAdStatuses((prev) => ({ ...prev, [key]: r.success ? "pushed" : "failed" }));
      });

      if (result.failed === 0) {
        toast.success(`All ${result.pushed} ads pushed to Meta!`);
      } else {
        toast.warning(`${result.pushed} pushed, ${result.failed} failed`);
        if (result.results.some((r) => r.error?.includes("META_APP_DEV_MODE"))) {
          setDevModeError(true);
        }
      }
      utils.metaAdPush.getPushHistory.invalidate();
    } catch (err: any) {
      toast.error("Full push failed", { description: err.message?.slice(0, 120) });
    } finally {
      setPushingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading ad catalog...
      </div>
    );
  }

  const variants = (catalog as VariantCatalog[]) ?? [];
  const totalPushed = Object.values(adStatuses).filter((s) => s === "pushed").length;
  const totalFailed = Object.values(adStatuses).filter((s) => s === "failed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-400" />
            Push to Meta Ads Manager
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            15 KBMO ads across 5 audience variants — all PAUSED, no budget set. Review and activate in Meta
            Ads Manager after pushing.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalPushed > 0 && (
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {totalPushed} pushed
            </Badge>
          )}
          {totalFailed > 0 && (
            <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/30">
              <XCircle className="w-3 h-3 mr-1" />
              {totalFailed} failed
            </Badge>
          )}
          <Button
            onClick={handlePushAll}
            disabled={pushingAll || totalPushed === 15}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pushingAll ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {totalPushed === 15 ? "All Pushed ✓" : "Push All 15 Ads"}
          </Button>
        </div>
      </div>

      {/* Dev mode warning */}
      {devModeError && <AppLiveModeGuide />}

      {/* Info banner */}
      {!devModeError && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-2.5 border border-border">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
          <span>
            All ads are created as <strong className="text-foreground">PAUSED</strong> with no budget. After
            pushing, go to{" "}
            <a
              href="https://www.facebook.com/adsmanager"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              Meta Ads Manager
            </a>{" "}
            to set budgets, targeting refinements, and activate the campaigns you want to run.
          </span>
        </div>
      )}

      {/* Variant sections */}
      {variants.map((variant) => (
        <Card key={variant.variantSlug} className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-xs ${VARIANT_BADGE[variant.variantSlug] ?? "bg-muted text-muted-foreground"}`}
                >
                  Variant {variant.variantNum}
                </Badge>
                <div>
                  <CardTitle className="text-sm font-semibold">{variant.variantName}</CardTitle>
                  <p className="text-xs text-muted-foreground">/{variant.variantSlug} · 3 ads</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePushVariant(variant.variantSlug)}
                disabled={pushingVariant === variant.variantSlug}
                className="text-xs h-8"
              >
                {pushingVariant === variant.variantSlug ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <Send className="w-3 h-3 mr-1" />
                )}
                Push All 3
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {variant.ads.map((ad) => {
              const key = `${variant.variantSlug}:${ad.adId}`;
              return (
                <AdCard
                  key={ad.adId}
                  ad={ad}
                  variantSlug={variant.variantSlug}
                  onPush={() => handlePushAd(variant.variantSlug, ad.adId)}
                  isPushing={pushingAds[key] ?? false}
                  pushStatus={adStatuses[key] ?? null}
                />
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Push History */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Push History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PushHistory />
        </CardContent>
      </Card>
    </div>
  );
}
