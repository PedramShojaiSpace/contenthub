import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  Users, ShoppingCart, Zap, FlaskConical, Activity, ExternalLink,
  AlertTriangle, CheckCircle2, Clock, BarChart3
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function thisMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtDollars(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDollarsCents(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}

const QUICK_PRESETS = [
  { label: "Today", start: todayStr(), end: todayStr() },
  { label: "Yesterday", start: daysAgoStr(1), end: daysAgoStr(1) },
  { label: "Last 7d", start: daysAgoStr(6), end: todayStr() },
  { label: "Last 14d", start: daysAgoStr(13), end: todayStr() },
  { label: "This Month", start: thisMonthStart(), end: todayStr() },
];

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color = "text-foreground", loading = false, alert = false
}: {
  label: string; value: string; sub?: string;
  icon: any; color?: string; loading?: boolean; alert?: boolean;
}) {
  return (
    <Card className={`relative ${alert ? "border-red-400" : ""}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{label}</p>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin mt-1 text-muted-foreground" />
            ) : (
              <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
            )}
            {sub && !loading && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-muted/50 ml-2 shrink-0`}>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
        </div>
        {alert && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
      </CardContent>
    </Card>
  );
}

// ── ROAS Badge ────────────────────────────────────────────────────────────────
function RoasBadge({ roas }: { roas: number | null }) {
  if (roas === null) return <Badge variant="secondary">ROAS: N/A</Badge>;
  const color = roas >= 3 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : roas >= 2 ? "bg-blue-100 text-blue-800 border-blue-200"
    : roas >= 1 ? "bg-yellow-100 text-yellow-800 border-yellow-200"
    : "bg-red-100 text-red-800 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${color}`}>
      {roas >= 1 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      ROAS {roas.toFixed(2)}x
    </span>
  );
}

// ── A/B Test Mini Widget ──────────────────────────────────────────────────────
function ABTestWidget() {
  const { data: tests, isLoading } = trpc.abTest.listTests.useQuery(undefined, { staleTime: 60_000 });
  const runningTests = tests?.filter(t => t.status === "running") ?? [];

  // Fetch stats for first running test
  const firstTestId = runningTests[0]?.id ?? null;
  const { data: statsData, isLoading: statsLoading } = trpc.abTest.getResults.useQuery(
    { testId: firstTestId! },
    { enabled: firstTestId !== null, staleTime: 60_000 }
  );

  if (isLoading) return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" />A/B Test Status</CardTitle></CardHeader>
      <CardContent><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent>
    </Card>
  );

  if (runningTests.length === 0) return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" />A/B Test Status</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">No running tests</p></CardContent>
    </Card>
  );

  const test = runningTests[0];
  const stats = statsData?.stats ?? [];
  const sig = statsData?.significance ?? [];
  const totalExposures = stats.reduce((s, v) => s + v.exposures, 0);
  const minExp = test.minExposures ?? 200;
  const pctToMin = Math.min(100, Math.round(totalExposures / (minExp * 2) * 100));
  const isSignificant = sig.some(s => s.isSignificant);
  const winner = sig.find((s: any) => s.isSignificant);

  return (
    <Card className={isSignificant ? "border-emerald-400" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            A/B Test Live
          </span>
          {isSignificant ? (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Winner Found!</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">Collecting Data</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs font-medium text-foreground truncate">{test.name}</p>

        {/* Progress to significance */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{totalExposures.toLocaleString()} exposures</span>
            <span>Min: {(minExp * 2).toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pctToMin >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${pctToMin}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{pctToMin}% to significance threshold</p>
        </div>

        {/* Variant breakdown */}
        {statsLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-1.5">
            {stats.map(v => (
              <div key={v.variantId} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  {v.isControl ? <span className="text-muted-foreground">(A)</span> : <span className="text-blue-600">(B)</span>}
                  <span className="font-medium">{v.name}</span>
                </span>
                <span className="text-muted-foreground">
                  {v.exposures} views · {fmtPct(v.conversionRate * 100)} CVR
                </span>
              </div>
            ))}
          </div>
        )}

        {isSignificant && winner && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2 text-xs text-emerald-800">
            🏆 <strong>Winner:</strong> Variant B — {fmtPct(((winner as any).relativeLift ?? 0) * 100)} uplift
            ({fmtPct(((winner as any).confidence ?? 0) * 100)} confidence)
          </div>
        )}

        <a
          href="/ab-tests"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          View full A/B dashboard <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InterconnectedCommandCenter() {
  const [activePreset, setActivePreset] = useState("Today");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());

  const {
    data: metaData,
    isLoading: metaLoading,
    refetch: refetchMeta,
  } = trpc.kajabiSales.getMetaSpend.useQuery(
    { startDate, endDate },
    { staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 }
  );

  const {
    data: kajabiData,
    isLoading: kajabiLoading,
    refetch: refetchKajabi,
  } = trpc.kajabiSales.getCustomRangeSales.useQuery(
    { startDate, endDate },
    { staleTime: 10 * 60_000, refetchInterval: 10 * 60_000 }
  );

  const isLoading = metaLoading || kajabiLoading;

  // Derived metrics
  const spend = metaData?.spend ?? 0;
  const leads = metaData?.leads ?? 0;
  const checkouts = metaData?.checkouts ?? 0;
  const metaPurchases = metaData?.purchases ?? 0;
  const cpl = leads > 0 ? spend / leads : null;
  const checkoutRate = leads > 0 ? (checkouts / leads) * 100 : null;
  const kajabiRevenue = kajabiData ? kajabiData.totalRevenueCents / 100 : 0;
  const kajabiPurchases = kajabiData?.totalPurchases ?? 0;
  // Meta-attributed revenue excludes purchases confirmed as email-list buyers (not Meta leads).
  // The $499 purchase on Aug 3 was a 2+ year email subscriber — excluded from Meta ROAS.
  // As CAPI + Kajabi webhook attribution matures, this will be automated via kajabi_purchases.is_email_list_buyer.
  const emailListRevenue = kajabiData?.tiers?.find(t => t.tier === 'combo')?.revenueCents
    ? (kajabiData.tiers.find(t => t.tier === 'combo')!.revenueCents >= 49900 ? 499 : 0)
    : 0;
  const metaAttributedRevenue = Math.max(0, kajabiRevenue - emailListRevenue);
  const metaAttributedPurchases = emailListRevenue > 0 ? Math.max(0, kajabiPurchases - 1) : kajabiPurchases;
  const roas = spend > 0 && metaAttributedRevenue > 0 ? metaAttributedRevenue / spend : null;
  const cpp = metaAttributedPurchases > 0 ? spend / metaAttributedPurchases : null;

  // ROAS color
  const roasColor = roas === null ? "text-muted-foreground"
    : roas >= 3 ? "text-emerald-600"
    : roas >= 2 ? "text-blue-600"
    : roas >= 1 ? "text-yellow-600"
    : "text-red-600";

  function handlePreset(p: typeof QUICK_PRESETS[0]) {
    setActivePreset(p.label);
    setStartDate(p.start);
    setEndDate(p.end);
  }

  function handleRefresh() {
    refetchMeta();
    refetchKajabi();
  }

  // ── Upsell KPI: $299 Gut Permeability + Food Sensitivity Test (primary funnel metric) ──
  const upsellTier = kajabiData?.tiers?.find(t => t.tier === '299');
  const upsellCount = upsellTier?.count ?? 0;
  const upsellRevenue = (upsellTier?.revenueCents ?? 0) / 100;
  const otoTier = kajabiData?.tiers?.find(t => t.tier === '67');
  const otoCount = otoTier?.count ?? 0;
  // Upsell take rate = upsell purchases / $67 OTO purchases
  const upsellTakeRate = otoCount > 0 ? (upsellCount / otoCount) * 100 : null;
  // Cost per upsell = Meta spend / upsell purchases
  const costPerUpsell = upsellCount > 0 ? spend / upsellCount : null;

  // Tier breakdown
  const tiers = kajabiData?.tiers ?? [];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-amber-500" />
              Interconnected Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Live funnel performance — Meta spend + Kajabi sales + A/B test
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RoasBadge roas={roas} />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap gap-2 items-center">
          {QUICK_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                activePreset === p.label
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {p.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
          </span>
        </div>

        {/* ★ UPSELL SPOTLIGHT: $299 Gut Permeability + Food Sensitivity Test */}
        <Card className="border-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-amber-600" />
                <span className="font-bold text-sm text-amber-800 dark:text-amber-300">PRIMARY KPI — $299 Upsell: Gut Permeability + Food Sensitivity Test w/ Coach</span>
              </div>
              <Badge className="bg-amber-500 text-white text-xs">Day-Zero Upsell</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-3xl font-black text-amber-700 dark:text-amber-300">{upsellCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upsells Taken</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-emerald-600">{upsellTakeRate !== null ? `${upsellTakeRate.toFixed(1)}%` : '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Take Rate (of $67 OTOs)</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-blue-600">{costPerUpsell !== null ? fmtDollars(costPerUpsell) : '—'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Cost Per Upsell</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-black text-foreground">{fmtDollars(upsellRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Upsell Revenue</p>
              </div>
            </div>
            {otoCount > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {otoCount} people bought the $67 OTO → {upsellCount} took the $299 upsell
                {upsellTakeRate !== null && ` (${upsellTakeRate.toFixed(1)}% take rate)`}
              </p>
            )}
            {otoCount === 0 && kajabiLoading && (
              <div className="flex justify-center mt-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            )}
          </CardContent>
        </Card>

        {/* Top KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            label="Meta Spend"
            value={fmtDollars(spend)}
            sub="Agora campaigns"
            icon={DollarSign}
            loading={metaLoading}
          />
          <StatCard
            label="Leads"
            value={leads.toLocaleString()}
            sub={cpl !== null ? `CPL: ${fmtDollars(cpl)}` : "—"}
            icon={Users}
            loading={metaLoading}
          />
          <StatCard
            label="Checkouts"
            value={checkouts.toLocaleString()}
            sub={checkoutRate !== null ? `${fmtPct(checkoutRate)} of leads` : "—"}
            icon={ShoppingCart}
            loading={metaLoading}
          />
          <StatCard
            label="Kajabi Revenue"
            value={fmtDollars(kajabiRevenue)}
            sub={`${kajabiPurchases} purchases`}
            icon={TrendingUp}
            color={roas !== null && roas >= 1 ? "text-emerald-600" : "text-red-600"}
            loading={kajabiLoading}
          />
          <StatCard
            label="ROAS"
            value={roas !== null ? `${roas.toFixed(2)}x` : "—"}
            sub={spend > 0 ? `$${kajabiRevenue.toFixed(0)} / $${spend.toFixed(0)}` : "—"}
            icon={BarChart3}
            color={roasColor}
            loading={isLoading}
          />
          <StatCard
            label="Cost / Purchase"
            value={cpp !== null ? fmtDollars(cpp) : "—"}
            sub={`${metaPurchases} pixel events`}
            icon={Activity}
            loading={isLoading}
          />
        </div>

        {/* Middle row: Kajabi breakdown + A/B test + Campaign breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Kajabi Sales Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-emerald-600" />
                Kajabi Sales by Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kajabiLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : tiers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sales in this period</p>
              ) : (
                <div className="space-y-2">
                  {tiers.map((tier) => (
                    <div key={tier.tier} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="font-medium">{tier.label}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold">{tier.count}×</span>
                        <span className="text-muted-foreground ml-2">{fmtDollarsCents(tier.revenueCents)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-2 flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="text-emerald-600">{fmtDollars(kajabiRevenue)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* A/B Test Widget */}
          <ABTestWidget />

          {/* Meta Campaign Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                Meta Campaign Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metaLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : !metaData?.campaigns?.length ? (
                <p className="text-sm text-muted-foreground">No Agora campaigns found</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {metaData.campaigns
                    .sort((a: any, b: any) => b.spend - a.spend)
                    .slice(0, 8)
                    .map((c: any, i: number) => (
                      <div key={i} className="text-xs border-b pb-1.5 last:border-0">
                        <p className="font-medium truncate text-foreground">{c.name}</p>
                        <div className="flex gap-3 text-muted-foreground mt-0.5">
                          <span>${c.spend.toFixed(2)}</span>
                          <span>{c.leads} leads</span>
                          {c.leads > 0 && <span>${(c.spend / c.leads).toFixed(2)} CPL</span>}
                        </div>
                      </div>
                    ))}
                  {metaData.campaigns.length > 8 && (
                    <p className="text-xs text-muted-foreground">+{metaData.campaigns.length - 8} more campaigns</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reconciliation note */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Attribution note:</strong> Meta pixel purchases fire at checkout completion. Kajabi records payment when it clears. These will differ by 1–3 purchases at any given moment — Kajabi is the source of truth for revenue.</p>
                <p>Meta spend reflects Agora-named ad sets only. For full reconciliation with custom date ranges, see the <a href="/reconciliation" className="text-blue-600 hover:underline">Reconciliation page</a>.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="flex flex-wrap gap-2">
          <a href="/reconciliation" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Full Reconciliation
          </a>
          <span className="text-muted-foreground">·</span>
          <a href="/funnel-economics" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Funnel Economics
          </a>
          <span className="text-muted-foreground">·</span>
          <a href="/ab-tests" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> A/B Tests
          </a>
          <span className="text-muted-foreground">·</span>
          <a href="/funnel-advisor" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Funnel Advisor
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
