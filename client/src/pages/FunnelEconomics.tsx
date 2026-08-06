/**
 * Funnel Economics Calculator
 * ─────────────────────────────────────────────────────────────────────────────
 * Models the full Urban Monk monetization funnel:
 *   Opt-in → $67 core offer → $27 order bump → $97 OTO → $299/$399/$499 → $9,850 high-ticket
 *
 * All math is pure client-side. Sliders update results instantly.
 * Scenarios can be saved to the DB for historical comparison.
 */

import { useState, useMemo } from "react";
import { RefreshCw, Wifi, WifiOff, AlertTriangle, CheckCircle2, AlertCircle, ShoppingCart } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, Minus, DollarSign, Users, Target,
  Save, History, ChevronDown, ChevronUp, Info, BarChart3
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
const fmtFull$ = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (n: number) => `${n.toFixed(1)}%`;

function ROASBadge({ roas }: { roas: number }) {
  if (roas >= 2) return <Badge className="bg-green-600 text-white">{roas.toFixed(2)}x ROAS</Badge>;
  if (roas >= 1) return <Badge className="bg-yellow-500 text-white">{roas.toFixed(2)}x ROAS</Badge>;
  return <Badge className="bg-red-600 text-white">{roas.toFixed(2)}x ROAS</Badge>;
}

function MetricRow({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: "green" | "red" | "yellow" }) {
  const color = highlight === "green" ? "text-green-600" : highlight === "red" ? "text-red-500" : highlight === "yellow" ? "text-yellow-600" : "text-foreground";
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className={`font-semibold text-sm ${color}`}>{value}</span>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function SliderRow({
  label, desc, value, min, max, step, onChange, format = (v: number) => `${v}%`
}: {
  label: string; desc?: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold text-primary">{format(value)}</span>
      </div>
      {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="w-full" />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FunnelEconomics() {
  // ── Inputs ──
  const [leadsPerMonth, setLeadsPerMonth] = useState(1000);
  const [cpl, setCpl] = useState(3.0);

  // Conversion rates (%)
  const [cr67, setCr67] = useState(5);        // opt-in → $67 core
  const [crBump, setCrBump] = useState(35);   // $67 buyers → $27 bump
  const [crOto, setCrOto] = useState(20);     // $67 buyers → $97 OTO
  const [crMid, setCrMid] = useState(8);      // $67 buyers → mid-tier ($299/$399/$499)
  const [midPrice, setMidPrice] = useState(399); // which mid-tier they buy
  const [crHighTicket, setCrHighTicket] = useState(20); // mid-tier → $9,850 sales call close

  // ── Live Meta data ──
  const [datePreset, setDatePreset] = useState<"today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "this_month">("last_7d");
  const [liveMode, setLiveMode] = useState(true);

  const { data: liveData, isLoading: liveLoading, refetch: refetchLive, dataUpdatedAt } =
    trpc.metaFunnelMetrics.getLiveMetrics.useQuery(
      { datePreset },
      { enabled: liveMode, refetchInterval: 5 * 60 * 1000, staleTime: 4 * 60 * 1000 }
    );

  // Auto-fill CPL and leads from live data when available
  const liveCpl = liveData?.avgCpl ?? null;

  // ── Kajabi sales data ──
  const { data: salesData, isLoading: salesLoading, refetch: refetchSales } =
    trpc.kajabiSales.getFunnelSales.useQuery(
      { datePreset },
      { enabled: liveMode, refetchInterval: 10 * 60 * 1000, staleTime: 9 * 60 * 1000 }
    );

  // ── Scenario save ──
  const [scenarioName, setScenarioName] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const saveScenario = trpc.funnelEconomics.saveScenario.useMutation({
    onSuccess: () => {
      toast.success("Scenario saved");
      setScenarioName("");
      utils.funnelEconomics.listScenarios.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const utils = trpc.useUtils();
  const { data: scenarios } = trpc.funnelEconomics.listScenarios.useQuery(undefined, {
    enabled: showHistory,
  });

  // ── Math ──────────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    const adSpend = leadsPerMonth * cpl;

    const buyers67 = leadsPerMonth * (cr67 / 100);
    const rev67 = buyers67 * 67;

    const bumpBuyers = buyers67 * (crBump / 100);
    const revBump = bumpBuyers * 27;

    const otoBuyers = buyers67 * (crOto / 100);
    const revOto = otoBuyers * 97;

    const midBuyers = buyers67 * (crMid / 100);
    const revMid = midBuyers * midPrice;

    const htBuyers = midBuyers * (crHighTicket / 100);
    const revHt = htBuyers * 9850;

    const totalRev = rev67 + revBump + revOto + revMid + revHt;
    const profit = totalRev - adSpend;
    const roas = adSpend > 0 ? totalRev / adSpend : 0;
    const revenuePerLead = leadsPerMonth > 0 ? totalRev / leadsPerMonth : 0;
    const breakEvenCr = adSpend > 0 ? (adSpend / (67 + 27 * (crBump / 100) + 97 * (crOto / 100))) / leadsPerMonth * 100 : 0;

    // Front-end only (pre-mid-tier)
    const frontEndRev = rev67 + revBump + revOto;
    const frontEndRoas = adSpend > 0 ? frontEndRev / adSpend : 0;

    return {
      adSpend, buyers67, rev67,
      bumpBuyers, revBump,
      otoBuyers, revOto,
      midBuyers, revMid,
      htBuyers, revHt,
      totalRev, profit, roas,
      revenuePerLead, breakEvenCr,
      frontEndRev, frontEndRoas,
    };
  }, [leadsPerMonth, cpl, cr67, crBump, crOto, crMid, midPrice, crHighTicket]);

  const profitColor = calc.profit >= 0 ? "green" : "red";

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" /> Funnel Economics Calculator
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Model your full 6-layer monetization funnel and find break-even in real time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ROASBadge roas={calc.roas} />
            <button
              onClick={() => setLiveMode((v) => !v)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors ${
                liveMode ? "bg-green-50 border-green-300 text-green-700" : "bg-muted border-border text-muted-foreground"
              }`}
            >
              {liveMode ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {liveMode ? "Live" : "Manual"}
            </button>
          </div>
        </div>

        {/* Live Meta Data Banner */}
        {liveMode && (
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap items-start gap-4">
                {/* Date range selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Window:</span>
                  {(["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setDatePreset(p)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        datePreset === p ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background"
                      }`}
                    >
                      {p === "last_7d" ? "7d" : p === "last_14d" ? "14d" : p === "last_30d" ? "30d" : p === "this_month" ? "MTD" : p}
                    </button>
                  ))}
                </div>

                {liveLoading && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Fetching Meta data…
                  </div>
                )}

                {liveData && !liveLoading && (
                  <>
                    {/* Key live metrics */}
                    <div className="flex flex-wrap gap-4 flex-1">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Ad Spend</p>
                        <p className="font-bold text-sm">{liveData.totalSpend.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Leads</p>
                        <p className="font-bold text-sm">{liveData.totalLeads.toLocaleString()}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Avg CPL</p>
                        <p className={`font-bold text-sm ${
                          liveCpl === null ? "" : liveCpl <= 5 ? "text-green-600" : liveCpl <= 8 ? "text-yellow-600" : "text-red-500"
                        }`}>
                          {liveCpl !== null ? `$${liveCpl.toFixed(2)}` : "—"}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Today Spend</p>
                        <p className="font-bold text-sm">${liveData.dailySpend.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Today Leads</p>
                        <p className="font-bold text-sm">{liveData.dailyLeads}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Campaigns</p>
                        <p className="font-bold text-sm">{liveData.campaigns.length}</p>
                      </div>
                    </div>

                    {/* Apply to calculator button */}
                    {liveCpl !== null && (
                      <button
                        onClick={() => {
                          setCpl(parseFloat(liveCpl.toFixed(2)));
                          // Annualise leads: for multi-day presets, estimate monthly
                          const days = datePreset === "today" ? 1 : datePreset === "yesterday" ? 1 : datePreset === "last_7d" ? 7 : datePreset === "last_14d" ? 14 : 30;
                          const monthlyLeads = Math.round((liveData.totalLeads / days) * 30);
                          if (monthlyLeads > 0) setLeadsPerMonth(monthlyLeads);
                          toast.success("Live CPL and leads applied to calculator");
                        }}
                        className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium whitespace-nowrap"
                      >
                        Apply to Calculator
                      </button>
                    )}

                    <button onClick={() => refetchLive()} className="text-xs text-muted-foreground hover:text-foreground">
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>

              {/* Flags */}
              {liveData?.flags && liveData.flags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {liveData.flags.map((flag, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                        flag.level === "ok" ? "bg-green-100 text-green-800" :
                        flag.level === "warn" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}
                    >
                      {flag.level === "ok" ? <CheckCircle2 className="w-3 h-3" /> :
                       flag.level === "warn" ? <AlertTriangle className="w-3 h-3" /> :
                       <AlertCircle className="w-3 h-3" />}
                      {flag.message}
                    </div>
                  ))}
                </div>
              )}

              {/* Campaign breakdown (collapsible) */}
              {liveData?.campaigns && liveData.campaigns.length > 0 && (
                <details className="mt-3">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    {liveData.campaigns.length} Interconnected campaigns — click to expand
                  </summary>
                  <div className="mt-2 space-y-1">
                    {liveData.campaigns.map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs py-1 border-b border-border/50 last:border-0">
                        <span className="text-muted-foreground truncate max-w-[60%]" title={c.name}>
                          {c.name.replace(/^CM - (Top|Middle|Bottom) - /i, "").slice(0, 60)}
                        </span>
                        <div className="flex gap-3 text-right shrink-0">
                          <span>${c.spend.toFixed(0)} spend</span>
                          <span>{c.leads} leads</span>
                          <span className={c.cpl === null ? "" : c.cpl <= 5 ? "text-green-600 font-semibold" : c.cpl <= 8 ? "text-yellow-600 font-semibold" : "text-red-500 font-semibold"}>
                            {c.cpl !== null ? `$${c.cpl.toFixed(2)} CPL` : "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {dataUpdatedAt > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Last refreshed {new Date(dataUpdatedAt).toLocaleTimeString()} · auto-refreshes every 5 min
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Kajabi Live Sales Card */}
        {liveMode && (
          <Card className="border-green-200 bg-green-50/40">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-green-700" />
                  <span>Kajabi Funnel Sales</span>
                  {salesLoading && <RefreshCw className="w-3 h-3 animate-spin text-muted-foreground" />}
                </span>
                <button onClick={() => refetchSales()} className="text-xs text-muted-foreground hover:text-foreground">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {salesData && !salesLoading ? (
                <>
                  {/* Tier breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    {([
                      { tier: "67",  label: "$67 OTO",         color: "text-indigo-700" },
                      { tier: "299", label: "$299 Course",      color: "text-purple-700" },
                      { tier: "399", label: "$399 Test+Consult",color: "text-orange-700" },
                      { tier: "499", label: "$499 Bundle",      color: "text-red-700"    },
                    ]).map(({ tier, label, color }) => {
                      const t = salesData.tiers.find((x) => x.tier === tier);
                      const count = t?.count ?? 0;
                      const rev = t ? (t.revenueCents / 100) : 0;
                      // Compute CR vs leads
                      const leads = liveData?.totalLeads ?? 0;
                      const cr = leads > 0 && count > 0 ? ((count / leads) * 100).toFixed(1) : null;
                      return (
                        <div key={tier} className="bg-white rounded-lg p-3 border border-border/50">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className={`font-bold text-lg ${color}`}>{count}</p>
                          <p className="text-xs text-muted-foreground">${rev.toFixed(0)} rev</p>
                          {cr && <p className="text-xs font-medium text-green-700">{cr}% CR</p>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Subscription tiers */}
                  {salesData.tiers.filter(t => ["297", "369"].includes(t.tier)).length > 0 && (
                    <div className="flex gap-3 mb-3">
                      {salesData.tiers.filter(t => ["297", "369"].includes(t.tier)).map(t => (
                        <div key={t.tier} className="bg-white rounded-lg p-3 border border-border/50 flex-1">
                          <p className="text-xs text-muted-foreground">{t.label}</p>
                          <p className="font-bold text-lg text-green-700">{t.count}</p>
                          <p className="text-xs text-muted-foreground">${(t.revenueCents/100).toFixed(0)} rev</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totals + Apply button */}
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="flex gap-6">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Sales</p>
                        <p className="font-bold">{salesData.totalPurchases}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                        <p className="font-bold text-green-700">${(salesData.totalRevenueCents/100).toLocaleString("en-US", {maximumFractionDigits:0})}</p>
                      </div>
                      {liveData && liveData.totalSpend > 0 && salesData.totalRevenueCents > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Actual ROAS</p>
                          <p className={`font-bold ${
                            salesData.totalRevenueCents / 100 / liveData.totalSpend >= 2 ? "text-green-700" :
                            salesData.totalRevenueCents / 100 / liveData.totalSpend >= 1 ? "text-yellow-600" : "text-red-600"
                          }`}>
                            {(salesData.totalRevenueCents / 100 / liveData.totalSpend).toFixed(2)}x
                          </p>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        // Apply live conversion rates to the calculator sliders
                        const leads = liveData?.totalLeads ?? 0;
                        if (leads === 0) return;
                        const t67 = salesData.tiers.find(t => t.tier === "67");
                        const t299 = salesData.tiers.find(t => t.tier === "299");
                        const t399 = salesData.tiers.find(t => t.tier === "399");
                        const t499 = salesData.tiers.find(t => t.tier === "499");
                        if (t67 && t67.count > 0) setCr67(parseFloat(((t67.count / leads) * 100).toFixed(1)));
                        // Mid-tier: use whichever has sales, pick highest revenue
                        const midTier = [t399, t499, t299].find(t => t && t.count > 0);
                        if (midTier) {
                          setCrMid(parseFloat(((midTier.count / leads) * 100).toFixed(1)));
                          if (midTier.tier === "299") setMidPrice(299);
                          else if (midTier.tier === "399") setMidPrice(399);
                          else if (midTier.tier === "499") setMidPrice(499);
                        }
                        toast.success("Live conversion rates applied to calculator");
                      }}
                      className="text-xs px-3 py-1.5 rounded bg-green-700 text-white font-medium whitespace-nowrap"
                    >
                      Apply CRs to Calculator
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Kajabi data · auto-refreshes every 10 min</p>
                </>
              ) : salesLoading ? (
                <p className="text-xs text-muted-foreground">Loading Kajabi sales…</p>
              ) : (
                <p className="text-xs text-muted-foreground">No sales data available for this window.</p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Inputs ── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Traffic & Cost */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Traffic & Ad Spend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <SliderRow
                  label="Leads per Month"
                  value={leadsPerMonth}
                  min={100} max={10000} step={100}
                  onChange={setLeadsPerMonth}
                  format={(v) => v.toLocaleString()}
                />
                <SliderRow
                  label="Cost Per Lead (CPL)"
                  desc="Average paid ad cost to acquire one opt-in"
                  value={cpl}
                  min={0.5} max={20} step={0.25}
                  onChange={setCpl}
                  format={(v) => `$${v.toFixed(2)}`}
                />
                <div className="flex justify-between text-sm pt-1 border-t">
                  <span className="text-muted-foreground">Monthly Ad Spend</span>
                  <span className="font-bold">{fmtFull$(calc.adSpend)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Layer 1: $67 Core */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Layer 1 — $67 Core Offer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SliderRow
                  label="Opt-in → $67 Conversion Rate"
                  desc="% of leads who buy the core offer on the thank-you page"
                  value={cr67} min={0.5} max={20} step={0.5}
                  onChange={setCr67}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calc.buyers67.toFixed(0)} buyers/mo</span>
                  <span className="font-semibold text-foreground">{fmtFull$(calc.rev67)}/mo</span>
                </div>
              </CardContent>
            </Card>

            {/* Layer 2: $27 Order Bump */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Layer 2 — $27 Order Bump</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SliderRow
                  label="$67 Buyers → Order Bump Rate"
                  desc="% of $67 buyers who add the $27 bump at checkout"
                  value={crBump} min={5} max={70} step={5}
                  onChange={setCrBump}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calc.bumpBuyers.toFixed(0)} bump buyers/mo</span>
                  <span className="font-semibold text-foreground">{fmtFull$(calc.revBump)}/mo</span>
                </div>
              </CardContent>
            </Card>

            {/* Layer 3: $97 OTO */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Layer 3 — $97 One-Click Upsell (OTO)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SliderRow
                  label="$67 Buyers → OTO Rate"
                  desc="% of $67 buyers who take the $97 post-purchase upsell"
                  value={crOto} min={5} max={50} step={5}
                  onChange={setCrOto}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calc.otoBuyers.toFixed(0)} OTO buyers/mo</span>
                  <span className="font-semibold text-foreground">{fmtFull$(calc.revOto)}/mo</span>
                </div>
              </CardContent>
            </Card>

            {/* Layer 4: Mid-tier */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Layer 4 — Mid-Tier Offer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {[299, 399, 499].map((p) => (
                    <button
                      key={p}
                      onClick={() => setMidPrice(p)}
                      className={`flex-1 py-2 rounded-md text-sm font-semibold border transition-colors ${
                        midPrice === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  $299 = Academy/course · $399 = Gut or Oral test + consult · $499 = Combo
                </p>
                <SliderRow
                  label="$67 Buyers → Mid-Tier Rate"
                  desc="% of $67 buyers who eventually purchase the mid-tier offer"
                  value={crMid} min={1} max={30} step={1}
                  onChange={setCrMid}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calc.midBuyers.toFixed(0)} mid-tier buyers/mo</span>
                  <span className="font-semibold text-foreground">{fmtFull$(calc.revMid)}/mo</span>
                </div>
              </CardContent>
            </Card>

            {/* Layer 5: $9,850 High-Ticket */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Layer 5 — $9,850 High-Ticket Program</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <SliderRow
                  label="Mid-Tier → Sales Call Close Rate"
                  desc="% of mid-tier buyers who close on the $9,850 program (your team's ~20% baseline)"
                  value={crHighTicket} min={5} max={50} step={5}
                  onChange={setCrHighTicket}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{calc.htBuyers.toFixed(1)} high-ticket closes/mo</span>
                  <span className="font-semibold text-foreground">{fmtFull$(calc.revHt)}/mo</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Right: Results ── */}
          <div className="space-y-4">
            {/* P&L Summary */}
            <Card className="sticky top-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Monthly P&L
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow label="Ad Spend" value={fmtFull$(calc.adSpend)} />
                <MetricRow label="Layer 1 · $67 Core" value={fmtFull$(calc.rev67)}
                  sub={`${calc.buyers67.toFixed(0)} buyers @ ${pct(cr67)}`} />
                <MetricRow label="Layer 2 · $27 Bump" value={fmtFull$(calc.revBump)}
                  sub={`${calc.bumpBuyers.toFixed(0)} buyers @ ${pct(crBump)}`} />
                <MetricRow label="Layer 3 · $97 OTO" value={fmtFull$(calc.revOto)}
                  sub={`${calc.otoBuyers.toFixed(0)} buyers @ ${pct(crOto)}`} />
                <MetricRow label={`Layer 4 · $${midPrice} Mid-Tier`} value={fmtFull$(calc.revMid)}
                  sub={`${calc.midBuyers.toFixed(0)} buyers @ ${pct(crMid)}`} />
                <MetricRow label="Layer 5 · $9,850 HT" value={fmtFull$(calc.revHt)}
                  sub={`${calc.htBuyers.toFixed(1)} closes @ ${pct(crHighTicket)}`} highlight="green" />

                <div className="border-t pt-3 mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Total Revenue</span>
                    <span className="font-bold text-base">{fmtFull$(calc.totalRev)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-semibold">Net Profit</span>
                    <span className={`font-bold text-base ${calc.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {calc.profit >= 0 ? "+" : ""}{fmtFull$(calc.profit)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">Overall ROAS</span>
                    <ROASBadge roas={calc.roas} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Metrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Key Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <MetricRow
                  label="Revenue Per Lead"
                  value={`$${calc.revenuePerLead.toFixed(2)}`}
                  sub={`vs $${cpl.toFixed(2)} CPL`}
                  highlight={calc.revenuePerLead >= cpl ? "green" : "red"}
                />
                <MetricRow
                  label="Front-End ROAS"
                  value={`${calc.frontEndRoas.toFixed(2)}x`}
                  sub="Layers 1–3 only (before mid/HT)"
                  highlight={calc.frontEndRoas >= 1 ? "green" : "red"}
                />
                <MetricRow
                  label="Break-Even CR on $67"
                  value={pct(calc.breakEvenCr)}
                  sub="Min conversion rate to cover ad spend (front-end)"
                  highlight={cr67 >= calc.breakEvenCr ? "green" : "yellow"}
                />
                <MetricRow
                  label="High-Ticket Revenue Share"
                  value={calc.totalRev > 0 ? pct((calc.revHt / calc.totalRev) * 100) : "0%"}
                  sub="% of total revenue from $9,850 program"
                  highlight="green"
                />
                <MetricRow
                  label="Avg Revenue Per Buyer"
                  value={calc.buyers67 > 0 ? `$${(calc.totalRev / calc.buyers67).toFixed(0)}` : "$0"}
                  sub="Total revenue ÷ $67 buyers"
                />
              </CardContent>
            </Card>

            {/* ROAS Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> ROAS by Layer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "L1 · $67 Core",        rev: calc.rev67,                        color: "bg-indigo-500" },
                  { label: "L2 · $27 Bump",         rev: calc.rev67 + calc.revBump,         color: "bg-purple-500" },
                  { label: "L3 · $97 OTO",          rev: calc.rev67 + calc.revBump + calc.revOto, color: "bg-pink-500" },
                  { label: `L4 · $${midPrice} Mid`, rev: calc.rev67 + calc.revBump + calc.revOto + calc.revMid, color: "bg-orange-500" },
                  { label: "L5 · $9,850 HT",        rev: calc.totalRev,                     color: "bg-green-600" },
                ].map(({ label, rev, color }) => {
                  const layerRoas = calc.adSpend > 0 ? rev / calc.adSpend : 0;
                  const barW = Math.min(100, (layerRoas / 5) * 100);
                  const roasColor = layerRoas >= 2 ? "text-green-600" : layerRoas >= 1 ? "text-yellow-600" : "text-red-500";
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className={`font-bold ${roasColor}`}>{layerRoas.toFixed(2)}x</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${barW}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="border-t pt-2 mt-1">
                  <p className="text-xs text-muted-foreground">Bar = ROAS scaled to 5x max. Each row shows cumulative ROAS as layers are added.</p>
                </div>
              </CardContent>
            </Card>

            {/* Funnel Waterfall */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Funnel Waterfall</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Opt-ins", n: leadsPerMonth, color: "bg-blue-500" },
                  { label: "$67 Buyers", n: calc.buyers67, color: "bg-indigo-500" },
                  { label: "$27 Bump", n: calc.bumpBuyers, color: "bg-purple-500" },
                  { label: "$97 OTO", n: calc.otoBuyers, color: "bg-pink-500" },
                  { label: `$${midPrice} Mid`, n: calc.midBuyers, color: "bg-orange-500" },
                  { label: "$9,850 HT", n: calc.htBuyers, color: "bg-green-600" },
                ].map(({ label, n, color }) => {
                  const w = leadsPerMonth > 0 ? Math.max(2, (n / leadsPerMonth) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{n.toFixed(n < 10 ? 1 : 0)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${w}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Save Scenario */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Scenario
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Scenario name (e.g. 'July baseline')"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                />
                <Button
                  className="w-full"
                  disabled={!scenarioName.trim() || saveScenario.isPending}
                  onClick={() => saveScenario.mutate({
                    name: scenarioName.trim(),
                    leadsPerMonth, cpl, cr67, crBump, crOto, crMid, midPrice, crHighTicket,
                    totalRevenue: calc.totalRev,
                    netProfit: calc.profit,
                    roas: calc.roas,
                  })}
                >
                  {saveScenario.isPending ? "Saving…" : "Save Snapshot"}
                </Button>

                <button
                  className="w-full text-xs text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <History className="w-3 h-3" />
                  {showHistory ? "Hide" : "Show"} saved scenarios
                  {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showHistory && scenarios && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {scenarios.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No saved scenarios yet</p>
                    )}
                    {scenarios.map((s) => (
                      <div key={s.id} className="border rounded-md p-2 text-xs space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{s.name}</span>
                          <span className="text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>{s.leadsPerMonth.toLocaleString()} leads @ ${s.cpl}/CPL</span>
                          <span className={s.netProfit >= 0 ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>
                            {s.netProfit >= 0 ? "+" : ""}{fmtFull$(s.netProfit)}
                          </span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Rev: {fmtFull$(s.totalRevenue)}</span>
                          <span>ROAS: {s.roas.toFixed(2)}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
