/**
 * Reconciliation — per-funnel ad spend vs. Kajabi sales
 *
 * Select a funnel, pick a date range, see spend + revenue scoped
 * ONLY to that funnel's campaigns and SKUs.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, RefreshCw, TrendingUp, DollarSign, Users, Zap,
  ChevronDown, Lock, CheckCircle2,
} from "lucide-react";

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtD(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function todayStr() { return new Date().toISOString().split("T")[0]; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; }

const PRESETS = [
  { label: "Today",      start: todayStr(),  end: todayStr() },
  { label: "Yesterday",  start: daysAgo(1),  end: daysAgo(1) },
  { label: "Last 7d",    start: daysAgo(6),  end: todayStr() },
  { label: "Last 14d",   start: daysAgo(13), end: todayStr() },
  { label: "This Month", start: monthStart(), end: todayStr() },
];

export default function Reconciliation() {
  const [funnelId, setFunnelId]         = useState("interconnected_agora");
  const [preset, setPreset]             = useState("Today");
  const [startDate, setStartDate]       = useState(todayStr());
  const [endDate, setEndDate]           = useState(todayStr());
  const [menuOpen, setMenuOpen]         = useState(false);

  const { data: funnels = [] } = trpc.funnelRecon.listFunnels.useQuery();

  const { data, isLoading, isRefetching, refetch } = trpc.funnelRecon.getReconciliation.useQuery(
    { funnelId, startDate, endDate },
    { staleTime: 60_000 }
  );

  const loading = isLoading || isRefetching;
  const activeFunnel = funnels.find(f => f.id === funnelId);
  const { summary, meta, kajabi } = data ?? {};

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Reconciliation</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Ad spend + Kajabi revenue scoped to the selected funnel only.{" "}
              <span className="text-amber-500 font-medium">
                ⚠️ Meta pixel cannot see Kajabi sales — always verify here.
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
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-card hover:bg-muted text-sm font-medium text-foreground min-w-[300px] justify-between"
                >
                  <span className="flex items-center gap-2">
                    {activeFunnel && !activeFunnel.active && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                    {activeFunnel?.label ?? "Select a funnel…"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>

                {menuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[320px] bg-card border border-border rounded-md shadow-lg z-50 overflow-hidden">
                    {funnels.map(f => (
                      <button
                        key={f.id}
                        onClick={() => { setFunnelId(f.id); setMenuOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors ${
                          f.id === funnelId ? "bg-primary/10 text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {f.active
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                          : <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span className="flex-1">{f.label}</span>
                        {!f.active && <Badge variant="secondary" className="text-xs">Placeholder</Badge>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  onClick={() => { setPreset(p.label); setStartDate(p.start); setEndDate(p.end); }}
                  className={preset === p.label ? "bg-primary text-primary-foreground border-primary" : ""}
                >
                  {p.label}
                </Button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">
                {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Placeholder notice */}
        {activeFunnel && !activeFunnel.active && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-amber-700">
              <strong>{activeFunnel.label}</strong> is a placeholder. SKUs and Meta campaign keywords
              will be wired in when this funnel launches. No live data is available yet.
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling live data from Meta and Kajabi…
          </div>
        )}

        {/* KPI Row */}
        {data && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

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

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Kajabi Revenue
                </div>
                <div className="text-2xl font-bold text-green-600">{fmtD(summary?.totalRevenue ?? 0)}</div>
                <div className="text-xs text-muted-foreground mt-1">{kajabi?.totalPurchases ?? 0} sales</div>
                {kajabi?.note === "placeholder" && <div className="text-xs text-muted-foreground mt-1 italic">Placeholder</div>}
              </CardContent>
            </Card>

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

        {/* Kajabi Tier Breakdown */}
        {kajabi && !loading && kajabi.tiers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Kajabi Sales by Tier
                <span className="text-xs font-normal text-muted-foreground">
                  {kajabi.pagesScanned} pages scanned · {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
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
                    {(meta?.spend ?? 0) > 0 && <th className="text-right py-2 font-medium">% of Rev</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...kajabi.tiers].sort((a, b) => b.revenueCents - a.revenueCents).map(tier => (
                    <tr key={tier.tier} className="border-b last:border-0">
                      <td className="py-2 font-medium">{tier.label}</td>
                      <td className="py-2 text-right"><Badge variant="secondary">{tier.count}</Badge></td>
                      <td className="py-2 text-right text-green-600 font-semibold">{fmt(tier.revenueCents)}</td>
                      {(meta?.spend ?? 0) > 0 && (
                        <td className="py-2 text-right text-muted-foreground">
                          {((tier.revenueCents / kajabi.totalRevenueCents) * 100).toFixed(0)}%
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td className="py-2">TOTAL</td>
                    <td className="py-2 text-right">{kajabi.totalPurchases}</td>
                    <td className="py-2 text-right text-green-600">{fmt(kajabi.totalRevenueCents)}</td>
                    {(meta?.spend ?? 0) > 0 && <td className="py-2 text-right">100%</td>}
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {kajabi && !loading && kajabi.tiers.length === 0 && activeFunnel?.active && (
          <Card>
            <CardContent className="pt-4 text-center text-muted-foreground text-sm py-8">
              No sales found for <strong>{activeFunnel.label}</strong> in this date range.
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

        {/* Transaction Log */}
        {kajabi?.individualSales && kajabi.individualSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">Time (CT)</th>
                      <th className="text-left py-2 font-medium">Product</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kajabi.individualSales.map((s, i) => {
                      const ct = new Date(s.time).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      });
                      return (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-1.5 text-muted-foreground font-mono text-xs">{ct}</td>
                          <td className="py-1.5">{s.label}</td>
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
        {data && (meta?.spend ?? 0) > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm text-amber-700 space-y-1">
              <p className="font-semibold">Attribution note</p>
              <p>
                Meta spend is filtered to campaigns/adsets matching <strong>{activeFunnel?.label}</strong> keywords only.
                Kajabi revenue is filtered to SKUs registered for this funnel only.
                ROAS is the true ratio between these two independently scoped numbers.
              </p>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
