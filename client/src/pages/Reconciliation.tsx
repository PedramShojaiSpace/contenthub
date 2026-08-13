/**
 * Reconciliation — per-funnel ad spend vs. Kajabi + Shopify sales
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  buildControlledEmailCheckoutLink,
  CONTROLLED_EMAIL_DEFAULT_DESTINATIONS,
} from "@/lib/controlledEmailCheckoutLink";
import {
  Loader2, RefreshCw, TrendingUp, DollarSign, Users, Zap,
  ChevronDown, Lock, CheckCircle2, ShoppingCart, BookOpen, Filter,
  CalendarDays, Mail, Target, Copy, Link2,
} from "lucide-react";

type AttributionFilter = "all" | "meta_only" | "non_meta";

function CustomerTypeBadge({ type }: { type: string }) {
  if (type === "meta_lead") return (
    <Badge className="text-xs bg-green-500/10 text-green-700 border-green-500/20 gap-1">
      <Zap className="h-2.5 w-2.5" /> Lead Matched
    </Badge>
  );
  if (type === "returning") return (
    <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 gap-1">
      ↩ Not Lead-Matched
    </Badge>
  );
  return (
    <Badge variant="secondary" className="text-xs text-muted-foreground gap-1">
      ? Unknown
    </Badge>
  );
}

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtD(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }

// Preset definitions are functions so dates are always computed fresh at click time,
// not frozen to the module-load timestamp.
const PRESETS: { label: string; getRange: () => { start: string; end: string } }[] = [
  { label: "Today",      getRange: () => ({ start: todayStr(),   end: todayStr() }) },
  { label: "Yesterday",  getRange: () => ({ start: daysAgo(1),   end: daysAgo(1) }) },
  { label: "Last 7d",    getRange: () => ({ start: daysAgo(6),   end: todayStr() }) },
  { label: "Last 14d",   getRange: () => ({ start: daysAgo(13),  end: todayStr() }) },
  { label: "This Month", getRange: () => ({ start: monthStart(), end: todayStr() }) },
];

export default function Reconciliation() {
  const [funnelId, setFunnelId]         = useState("interconnected_agora");
  const [preset, setPreset]             = useState("Today");
  const [startDate, setStartDate]       = useState(todayStr());
  const [endDate, setEndDate]           = useState(todayStr());
  const [menuOpen, setMenuOpen]         = useState(false);
  const [newCustOnly, setNewCustOnly]   = useState(false);
  const [attrFilter, setAttrFilter]     = useState<AttributionFilter>("all");
  const [trackingSource, setTrackingSource] = useState<"kajabi" | "klaviyo">("kajabi");
  const [trackingMedium, setTrackingMedium] = useState<"email" | "sms">("email");
  const [trackingDestination, setTrackingDestination] = useState(CONTROLLED_EMAIL_DEFAULT_DESTINATIONS.kajabi);
  const [trackingContent, setTrackingContent] = useState("d01_episode");

  const { data: funnels = [] } = trpc.funnelRecon.listFunnels.useQuery();

  const { data, isLoading, isRefetching, refetch } = trpc.funnelRecon.getReconciliation.useQuery(
    { funnelId, startDate, endDate, newCustomersOnly: newCustOnly, attributionFilter: attrFilter },
    { staleTime: 60_000 }
  );

  const loading = isLoading || isRefetching;
  const activeFunnel = funnels.find(f => f.id === funnelId);
  const { summary, meta, kajabi, shopify, individualSales, cohortAnalytics } = data ?? {};
  const cohortDay0Revenue = cohortAnalytics?.cohorts.reduce((sum, cohort) => sum + cohort.day0RevenueCents, 0) ?? 0;
  const cohortDownstreamRevenue = cohortAnalytics?.cohorts.reduce((sum, cohort) => sum + cohort.day1to14RevenueCents, 0) ?? 0;
  const cohortTotalRevenue = cohortAnalytics?.cohorts.reduce((sum, cohort) => sum + cohort.total14DayRevenueCents, 0) ?? 0;
  const trackedEmailLink = useMemo(() => {
    if (!trackingDestination.trim()) return "";
    return buildControlledEmailCheckoutLink({
      source: trackingSource,
      medium: trackingMedium,
      content: trackingContent,
      destination: trackingDestination.trim(),
      baseOrigin: window.location.origin,
    });
  }, [trackingContent, trackingDestination, trackingMedium, trackingSource]);

  const selectTrackingSource = (source: "kajabi" | "klaviyo") => {
    setTrackingSource(source);
    setTrackingDestination(CONTROLLED_EMAIL_DEFAULT_DESTINATIONS[source]);
  };

  const copyTrackedLink = async () => {
    if (trackedEmailLink) await navigator.clipboard.writeText(trackedEmailLink);
  };

  const isFullyPlaceholder = activeFunnel &&
    !activeFunnel.kajabiActive && !activeFunnel.shopifyActive && !activeFunnel.metaActive;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Reconciliation</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Meta spend vs. Kajabi + Shopify revenue — scoped to the selected funnel only.{" "}
              <span className="text-amber-500 font-medium">
                ⚠️ Meta pixel cannot see Kajabi or Shopify sales — always verify here.
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading} className="gap-2 shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Funnel Selector */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm text-muted-foreground font-medium">Funnel:</span>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium text-foreground min-w-[320px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    {activeFunnel && isFullyPlaceholder && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activeFunnel?.label ?? "Select a funnel…"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {menuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[340px] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
                    {funnels.map(f => {
                      const isPlaceholder = !f.kajabiActive && !f.shopifyActive && !f.metaActive;
                      const sources = [
                        f.kajabiActive && "Kajabi",
                        f.shopifyActive && "Shopify",
                        f.metaActive && "Meta",
                      ].filter(Boolean).join(" · ");
                      return (
                        <button
                          key={f.id}
                          onClick={() => { setFunnelId(f.id); setMenuOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors ${
                            f.id === funnelId ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                          }`}
                        >
                          {!isPlaceholder
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <span className="flex-1">{f.label}</span>
                          {sources
                            ? <span className="text-xs text-muted-foreground">{sources}</span>
                            : <Badge variant="secondary" className="text-xs">Placeholder</Badge>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Source badges */}
              {activeFunnel && (
                <div className="flex gap-1.5 ml-2">
                  <Badge variant={activeFunnel.kajabiActive ? "default" : "secondary"} className="text-xs gap-1">
                    <BookOpen className="h-3 w-3" /> Kajabi {activeFunnel.kajabiActive ? "✓" : "—"}
                  </Badge>
                  <Badge variant={activeFunnel.shopifyActive ? "default" : "secondary"} className="text-xs gap-1">
                    <ShoppingCart className="h-3 w-3" /> Shopify {activeFunnel.shopifyActive ? "✓" : "—"}
                  </Badge>
                  <Badge variant={activeFunnel.metaActive ? "default" : "secondary"} className="text-xs gap-1">
                    <Zap className="h-3 w-3" /> Meta {activeFunnel.metaActive ? "✓" : "—"}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attribution Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm text-muted-foreground font-medium flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Attribution:
              </span>
              {/* New customers only toggle */}
              <button
                onClick={() => setNewCustOnly(!newCustOnly)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  newCustOnly
                    ? "bg-green-500/10 border-green-500/30 text-green-700"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                New Customers Only
              </button>
              {/* Attribution source filter */}
              {(["all", "meta_only", "non_meta"] as AttributionFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setAttrFilter(f)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    attrFilter === f
                      ? f === "meta_only"
                        ? "bg-green-500/10 border-green-500/30 text-green-700"
                        : f === "non_meta"
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-700"
                          : "bg-primary/10 border-primary/30 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f === "all" ? "All Sales" : f === "meta_only" ? "⚡ Lead-Matched Only" : "↩ Not Lead-Matched"}
                </button>
              ))}
              {(newCustOnly || attrFilter !== "all") && (
                <button
                  onClick={() => { setNewCustOnly(false); setAttrFilter("all"); }}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Clear filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date Range */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground font-medium mr-1">Date range:</span>
              {PRESETS.map(p => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => { const r = p.getRange(); setPreset(p.label); setStartDate(r.start); setEndDate(r.end); }}
                  className={preset === p.label ? "bg-primary text-primary-foreground border-primary" : ""}
                >
                  {p.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">
                {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
              </span>
              <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                <label className="sr-only" htmlFor="recon-start-date">Custom start date</label>
                <input
                  id="recon-start-date"
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(event) => { setStartDate(event.target.value); setPreset("Custom"); }}
                  className="h-8 rounded-md border border-border bg-background px-2 text-foreground"
                />
                <span>to</span>
                <label className="sr-only" htmlFor="recon-end-date">Custom end date</label>
                <input
                  id="recon-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={todayStr()}
                  onChange={(event) => { setEndDate(event.target.value); setPreset("Custom"); }}
                  className="h-8 rounded-md border border-border bg-background px-2 text-foreground"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder notice */}
        {isFullyPlaceholder && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-amber-700">
              <strong>{activeFunnel?.label}</strong> is a placeholder funnel. Kajabi SKUs, Shopify products,
              and Meta campaign keywords will be wired in when this funnel launches.
            </CardContent>
          </Card>
        )}

        {/* Shopify disabled notice */}
        {activeFunnel && !activeFunnel.shopifyActive && !isFullyPlaceholder && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="pt-4 text-sm text-blue-700">
              <ShoppingCart className="h-4 w-4 inline mr-1" />
              <strong>Shopify:</strong> Products are mapped for this funnel but Shopify pulling is currently
              disabled. Enable <code>shopifyActive: true</code> in the funnel registry when you start routing
              this funnel through Shopify.
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling live data from Meta, Kajabi, and Shopify…
          </div>
        )}

        {/* KPI Row */}
        {data && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Meta Spend */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Zap className="h-3.5 w-3.5" /> Meta Spend
                </div>
                <div className="text-2xl font-bold text-foreground">{fmtD(meta?.spend ?? 0)}</div>
                {meta?.error && <div className="text-xs text-red-500 mt-1">{meta.error}</div>}
                {!meta?.error && (meta?.leads ?? 0) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{meta!.leads.toLocaleString()} leads</div>
                )}
                {meta?.note === "placeholder" && <div className="text-xs text-muted-foreground mt-1 italic">Placeholder</div>}
              </CardContent>
            </Card>

            {/* Combined Revenue */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Total Revenue
                </div>
                <div className="text-2xl font-bold text-green-600">{fmtD(summary?.totalRevenue ?? 0)}</div>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  {(kajabi?.totalRevenueCents ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Kajabi: {fmt(kajabi!.totalRevenueCents)}
                    </div>
                  )}
                  {(shopify?.totalRevenueCents ?? 0) > 0 && (
                    <div className="flex items-center gap-1">
                      <ShoppingCart className="h-3 w-3" /> Shopify: {fmt(shopify!.totalRevenueCents)}
                    </div>
                  )}
                  {(summary?.totalPurchases ?? 0) > 0 && (
                    <div>{summary!.totalPurchases} total sales</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ROAS */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> True ROAS
                </div>
                {summary?.roas != null ? (
                  <>
                    <div className={`text-2xl font-bold ${summary.roas >= 3 ? "text-green-600" : summary.roas >= 1.5 ? "text-yellow-600" : "text-red-500"}`}>
                      {summary.roas.toFixed(2)}x
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {summary.roas >= 3 ? "✅ Strong" : summary.roas >= 1.5 ? "⚠️ Marginal" : "🔴 Below break-even"}
                    </div>
                  </>
                ) : (
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>

            {/* CPL */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Users className="h-3.5 w-3.5" /> Cost Per Lead
                </div>
                {summary?.cpl != null ? (
                  <>
                    <div className="text-2xl font-bold">{fmtD(summary.cpl)}</div>
                    {summary.convRate != null && (
                      <div className="text-xs text-muted-foreground mt-1">{summary.convRate.toFixed(1)}% lead→sale</div>
                    )}
                  </>
                ) : (
                  <div className="text-2xl font-bold text-muted-foreground">—</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Interconnected lead-acquisition cohort economics */}
        {cohortAnalytics && !loading && (
          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="text-base flex flex-wrap gap-2 justify-between items-center">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" /> 14-Day Lead Cohort Economics
                </span>
                <Badge variant="outline" className="font-normal">{cohortAnalytics.totalUniqueLeads.toLocaleString()} unique leads acquired</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground leading-relaxed">
                These are lead-acquisition cohorts: a sale counts only when a matching lead buys within 14 days of opt-in. This separates the initial Kajabi page, the future Klaviyo/SMS path, paid Meta leads, and untagged traffic instead of blending them.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Day-Zero Revenue</div>
                  <div className="text-xl font-bold text-foreground">{fmt(cohortDay0Revenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Same-calendar-day purchases</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Days 1–14 Revenue</div>
                  <div className="text-xl font-bold text-primary">{fmt(cohortDownstreamRevenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Downstream cohort revenue</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">14-Day Cohort Revenue</div>
                  <div className="text-xl font-bold text-green-600">{fmt(cohortTotalRevenue)}</div>
                  <div className="text-xs text-muted-foreground mt-1">Partial for cohorts younger than 14 days</div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2"><Users className="h-4 w-4" /> Daily Unique Leads</div>
                  <div className="rounded-md border border-border overflow-x-auto max-h-72 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted">
                        <tr className="text-muted-foreground">
                          <th className="text-left p-2">Date</th>
                          <th className="text-right p-2">Total</th>
                          <th className="text-right p-2">Kajabi</th>
                          <th className="text-right p-2">Klaviyo / SMS</th>
                          <th className="text-right p-2">Meta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohortAnalytics.dailyLeads.length === 0 ? (
                          <tr><td colSpan={5} className="p-3 text-muted-foreground text-center">No unique Interconnected leads in this window.</td></tr>
                        ) : cohortAnalytics.dailyLeads.map((row) => (
                          <tr key={row.date} className="border-t border-border">
                            <td className="p-2 font-medium">{row.date}</td>
                            <td className="p-2 text-right font-semibold">{row.uniqueLeads}</td>
                            <td className="p-2 text-right">{row.kajabiPage}</td>
                            <td className="p-2 text-right">{row.klaviyoSms}</td>
                            <td className="p-2 text-right">{row.metaPaid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium mb-2"><Mail className="h-4 w-4" /> Cohort Path Performance</div>
                  <div className="rounded-md border border-border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr className="text-muted-foreground">
                          <th className="text-left p-2">Path</th>
                          <th className="text-right p-2">Leads</th>
                          <th className="text-right p-2">D0</th>
                          <th className="text-right p-2">D1–14</th>
                          <th className="text-right p-2">14-Day Rev.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cohortAnalytics.cohorts.map((cohort) => (
                          <tr key={cohort.path} className="border-t border-border">
                            <td className="p-2 font-medium">{cohort.label}</td>
                            <td className="p-2 text-right">{cohort.uniqueLeads}</td>
                            <td className="p-2 text-right">{fmt(cohort.day0RevenueCents)}</td>
                            <td className="p-2 text-right text-primary">{fmt(cohort.day1to14RevenueCents)}</td>
                            <td className="p-2 text-right font-semibold text-green-600">{fmt(cohort.total14DayRevenueCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="h-4 w-4 text-primary" /> Acquisition Credit vs. Closing Touch</div>
                  <Badge variant="outline" className="font-normal">{cohortAnalytics.attributionLedger.purchaseCount} ledger-linked purchases</Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Each confirmed purchase is credited once to the original opt-in cohort. The closing-touch table identifies the later email/SMS or checkout path that closed it. These are two views of the same revenue, so <strong>do not add the columns together.</strong>
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="rounded-md border border-border bg-background overflow-x-auto">
                    <div className="px-3 py-2 border-b text-xs font-medium">Original Acquisition Credit</div>
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground"><tr><th className="text-left p-2">Lead source</th><th className="text-right p-2">Purchases</th><th className="text-right p-2">Revenue</th></tr></thead>
                      <tbody>
                        {cohortAnalytics.attributionLedger.acquisitionCredits.length === 0 ? <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">No new ledger credits in this cohort window.</td></tr> : cohortAnalytics.attributionLedger.acquisitionCredits.map((row) => (
                          <tr key={row.path} className="border-t border-border"><td className="p-2">{row.path.replace(/_/g, " ")}</td><td className="p-2 text-right">{row.purchases}</td><td className="p-2 text-right font-semibold text-green-600">{fmt(row.revenueCents)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-md border border-border bg-background overflow-x-auto">
                    <div className="px-3 py-2 border-b text-xs font-medium">Closing Email / SMS / Checkout Touch</div>
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground"><tr><th className="text-left p-2">Touch</th><th className="text-right p-2">Purchases</th><th className="text-right p-2">Revenue</th></tr></thead>
                      <tbody>
                        {cohortAnalytics.attributionLedger.closingTouches.length === 0 ? <tr><td colSpan={3} className="p-3 text-center text-muted-foreground">No new ledger closing touches in this cohort window.</td></tr> : cohortAnalytics.attributionLedger.closingTouches.map((row) => (
                          <tr key={`${row.label}-${row.confidence}`} className="border-t border-border"><td className="p-2">{row.label} <span className="text-muted-foreground">({row.confidence})</span></td><td className="p-2 text-right">{row.purchases}</td><td className="p-2 text-right font-semibold text-primary">{fmt(row.revenueCents)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded border border-border bg-background p-3"><span className="text-muted-foreground">Direct email/SMS click revenue:</span> <strong className="text-foreground">{fmt(cohortAnalytics.attributionLedger.directClosingRevenueCents)}</strong></div>
                  <div className="rounded border border-border bg-background p-3"><span className="text-muted-foreground">Modeled Kajabi sequence revenue:</span> <strong className="text-foreground">{fmt(cohortAnalytics.attributionLedger.modeledClosingRevenueCents)}</strong></div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground border-t pt-3">
                <strong>Definitions:</strong> “Meta” means a lead with Meta/Agora UTM or fbclid; “Kajabi Page” means the Kajabi webhook path; “Klaviyo / SMS” means explicit Klaviyo or SMS UTM labeling. Kajabi webhook purchases receive original-lead credit and a clearly marked <em>modeled</em> sequence close because Kajabi does not return a click token. Klaviyo/SMS or Kajabi links routed through the tracked Shopify bridge receive <em>direct</em> closing-touch credit on payment.
              </p>
            </CardContent>
          </Card>
        )}

        {funnelId === "interconnected_agora" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Controlled Email Checkout Link Builder</CardTitle>
              <p className="text-xs text-muted-foreground">
                Use a different link for each Kajabi and Klaviyo/SMS message. The first-party bridge records the click, retains the UTM convention, and writes a Shopify order attribute for direct paid-order attribution.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>Sequence path</span>
                  <select value={trackingSource} onChange={(event) => selectTrackingSource(event.target.value as "kajabi" | "klaviyo")} className="w-full h-9 rounded-md border border-border bg-background px-2 text-foreground">
                    <option value="kajabi">Kajabi sequence</option>
                    <option value="klaviyo">Klaviyo sequence</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>Channel</span>
                  <select value={trackingMedium} onChange={(event) => setTrackingMedium(event.target.value as "email" | "sms")} className="w-full h-9 rounded-md border border-border bg-background px-2 text-foreground">
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>Message marker</span>
                  <input value={trackingContent} onChange={(event) => setTrackingContent(event.target.value)} placeholder="d03_episode" className="w-full h-9 rounded-md border border-border bg-background px-2 text-foreground" />
                </label>
                <label className="text-xs text-muted-foreground space-y-1">
                  <span>{trackingSource === "kajabi" ? "Kajabi checkout destination" : "Shopify checkout destination"}</span>
                  <input value={trackingDestination} onChange={(event) => setTrackingDestination(event.target.value)} className="w-full h-9 rounded-md border border-border bg-background px-2 text-foreground" />
                </label>
              </div>
              <div className="rounded-md bg-muted p-3 flex gap-3 items-start">
                <code className="text-xs text-foreground break-all flex-1">{trackedEmailLink || "Enter a checkout destination to create a tracked link."}</code>
                <Button variant="outline" size="sm" className="gap-1 shrink-0" disabled={!trackedEmailLink} onClick={copyTrackedLink}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Kajabi links go directly to the selected Kajabi checkout with UTMs. Klaviyo/SMS links use the first-party bridge to the selected Shopify cart so the click token can be written to the paid Shopify order. Keep the campaign as <code>interconnected_14day</code> and vary only the message marker: for example, <code>d01_episode</code>, <code>d10_offer</code>, or <code>d12_last_call</code>.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Kajabi Tier Breakdown */}
        {kajabi && !loading && kajabi.tiers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" /> Kajabi Sales by Tier
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {kajabi.pagesScanned} pages scanned
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Product</th>
                    <th className="text-right py-2 font-medium">Sales</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {[...kajabi.tiers].sort((a, b) => b.revenueCents - a.revenueCents).map(tier => (
                    <tr key={tier.tier} className="border-b last:border-0">
                      <td className="py-2 font-medium">{tier.label}</td>
                      <td className="py-2 text-right"><Badge variant="secondary">{tier.count}</Badge></td>
                      <td className="py-2 text-right text-green-600 font-semibold">{fmt(tier.revenueCents)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td className="py-2">Kajabi Total</td>
                    <td className="py-2 text-right">{kajabi.totalPurchases}</td>
                    <td className="py-2 text-right text-green-600">{fmt(kajabi.totalRevenueCents)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Shopify Tier Breakdown */}
        {shopify && !loading && shopify.tiers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Shopify Sales by Product
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Product</th>
                    <th className="text-right py-2 font-medium">Orders</th>
                    <th className="text-right py-2 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {shopify.tiers.map((tier, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 font-medium">{tier.label}</td>
                      <td className="py-2 text-right"><Badge variant="secondary">{tier.count}</Badge></td>
                      <td className="py-2 text-right text-green-600 font-semibold">{fmt(tier.revenueCents)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td className="py-2">Shopify Total</td>
                    <td className="py-2 text-right">{shopify.totalOrders}</td>
                    <td className="py-2 text-right text-green-600">{fmt(shopify.totalRevenueCents)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* No sales notice */}
        {data && !loading &&
          (kajabi?.tiers.length === 0 && shopify?.tiers.length === 0) &&
          (activeFunnel?.kajabiActive || activeFunnel?.shopifyActive) && (
          <Card>
            <CardContent className="pt-4 text-center text-muted-foreground text-sm py-8">
              No sales found for <strong>{activeFunnel?.label}</strong> in this date range.
            </CardContent>
          </Card>
        )}

        {/* Meta Campaign Breakdown */}
        {meta && !loading && meta.campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meta Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Campaign</th>
                    <th className="text-right py-2 font-medium">Spend</th>
                    <th className="text-right py-2 font-medium">Leads</th>
                    <th className="text-right py-2 font-medium">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.campaigns.map((c, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 max-w-[260px] truncate" title={c.name}>{c.name}</td>
                      <td className="py-1.5 text-right font-medium">{fmtD(c.spend)}</td>
                      <td className="py-1.5 text-right">
                        {c.leads > 0 ? <Badge variant="secondary">{c.leads}</Badge> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1.5 text-right text-muted-foreground">
                        {c.cpl !== null ? fmtD(c.cpl) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Combined Transaction Log */}
        {individualSales && individualSales.length > 0 && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 justify-between">
                <span>Transaction Log (Kajabi + Shopify)</span>
                {(newCustOnly || attrFilter !== "all") && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30">
                    <Filter className="h-3 w-3 mr-1" />
                    Filtered: {newCustOnly ? "New customers only" : ""}{newCustOnly && attrFilter !== "all" ? " + " : ""}{attrFilter !== "all" ? (attrFilter === "meta_only" ? "Meta-attributed only" : "Non-Meta only") : ""}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">Time (CT)</th>
                      <th className="text-left py-2 font-medium">Source</th>
                      <th className="text-left py-2 font-medium">Product</th>
                      <th className="text-left py-2 font-medium">Attribution</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {individualSales.map((s, i) => {
                      const ct = new Date(s.time).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      });
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-1.5 text-muted-foreground font-mono text-xs">{ct}</td>
                          <td className="py-1.5">
                            <Badge variant={s.source === "shopify" ? "outline" : "secondary"} className="text-xs">
                              {s.source === "shopify" ? <ShoppingCart className="h-3 w-3 mr-1 inline" /> : <BookOpen className="h-3 w-3 mr-1 inline" />}
                              {s.source}
                            </Badge>
                          </td>
                          <td className="py-1.5 max-w-[180px] truncate" title={s.label}>{s.label}</td>
                          <td className="py-1.5">
                            <CustomerTypeBadge type={(s as any).customerType ?? "unknown"} />
                          </td>
                          <td className="py-1.5 text-right text-green-600 font-semibold">{fmt(s.amountCents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attribution Note */}
        {data && ((meta?.spend ?? 0) > 0 || (summary?.totalRevenue ?? 0) > 0) && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-amber-700 space-y-1">
              <p className="font-semibold">Attribution note</p>
              <p>
                Meta spend is filtered to campaigns/adsets matching <strong>{activeFunnel?.label}</strong> keywords.
                Kajabi revenue is filtered to registered SKUs for this funnel.
                Shopify revenue is filtered to registered product IDs for this funnel.
                ROAS = (Kajabi + Shopify revenue) ÷ Meta spend — all three independently scoped to the same funnel.
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
