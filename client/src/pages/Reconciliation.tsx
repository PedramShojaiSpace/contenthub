import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, DollarSign, ShoppingCart, Users, Zap } from "lucide-react";

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDollars(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function thisMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const quickPresets = [
  { label: "Today", start: todayStr(), end: todayStr() },
  { label: "Yesterday", start: daysAgoStr(1), end: daysAgoStr(1) },
  { label: "Last 7d", start: daysAgoStr(6), end: todayStr() },
  { label: "Last 14d", start: daysAgoStr(13), end: todayStr() },
  { label: "This Month", start: thisMonthStart(), end: todayStr() },
];

export default function Reconciliation() {
  const [activePreset, setActivePreset] = useState("Today");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());

  // Auto-fetch Meta spend whenever dates change
  const {
    data: metaData,
    isLoading: metaLoading,
    refetch: refetchMeta,
  } = trpc.kajabiSales.getMetaSpend.useQuery(
    { startDate, endDate },
    { staleTime: 60_000 }
  );

  // Auto-fetch Kajabi sales whenever dates change
  const {
    data: kajabiData,
    isLoading: kajabiLoading,
    refetch: refetchKajabi,
  } = trpc.kajabiSales.getCustomRangeSales.useQuery(
    { startDate, endDate },
    { staleTime: 60_000 }
  );

  const isLoading = metaLoading || kajabiLoading;

  const handlePreset = (preset: typeof quickPresets[0]) => {
    setActivePreset(preset.label);
    setStartDate(preset.start);
    setEndDate(preset.end);
  };

  const handleRefresh = () => {
    refetchMeta();
    refetchKajabi();
  };

  // Derived metrics
  const spendNum = metaData?.spend ?? 0;
  const leadsNum = metaData?.leads ?? 0;
  const checkoutsNum = metaData?.checkouts ?? 0;
  const totalRevenue = (kajabiData?.totalRevenueCents ?? 0) / 100;
  const roas = spendNum > 0 ? totalRevenue / spendNum : null;
  const cpl = spendNum > 0 && leadsNum > 0 ? spendNum / leadsNum : null;
  const checkoutRate = leadsNum > 0 && checkoutsNum > 0 ? (checkoutsNum / leadsNum) * 100 : null;
  const convRate = leadsNum > 0 && kajabiData ? (kajabiData.totalPurchases / leadsNum) * 100 : null;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Reconciliation</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Meta ad spend + Kajabi revenue pulled live — no manual entry needed.
              <span className="text-amber-500 font-medium ml-1">
                ⚠️ Meta pixel cannot see Kajabi sales — always verify here.
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading} className="gap-2 shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {/* Date Range Presets */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-muted-foreground font-medium mr-1">Date range:</span>
              {quickPresets.map((p) => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreset(p)}
                  className={activePreset === p.label ? "bg-primary text-primary-foreground border-primary" : ""}
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-3 text-muted-foreground text-sm py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling live data from Meta and Kajabi…
          </div>
        )}

        {/* KPI Row */}
        {(metaData || kajabiData) && !isLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Ad Spend */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Zap className="h-3.5 w-3.5" /> Meta Ad Spend
                </div>
                <div className="text-2xl font-bold text-foreground">{fmtDollars(spendNum)}</div>
                {metaData?.error && (
                  <div className="text-xs text-red-500 mt-1">{metaData.error}</div>
                )}
                {!metaData?.error && leadsNum > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">{leadsNum.toLocaleString()} leads</div>
                )}
              </CardContent>
            </Card>

            {/* Kajabi Revenue */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <DollarSign className="h-3.5 w-3.5" /> Kajabi Revenue
                </div>
                <div className="text-2xl font-bold text-green-600">{fmtDollars(totalRevenue)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {kajabiData?.totalPurchases ?? 0} sales
                </div>
              </CardContent>
            </Card>

            {/* ROAS */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> True ROAS
                </div>
                {roas !== null ? (
                  <>
                    <div className={`text-2xl font-bold ${roas >= 3 ? "text-green-600" : roas >= 1.5 ? "text-yellow-600" : "text-red-500"}`}>
                      {roas.toFixed(2)}x
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {roas >= 3 ? "✅ Strong" : roas >= 1.5 ? "⚠️ Marginal" : "🔴 Below break-even"}
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
                {cpl !== null ? (
                  <>
                    <div className="text-2xl font-bold">{fmtDollars(cpl)}</div>
                    {checkoutRate !== null && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {checkoutRate.toFixed(0)}% checkout rate
                      </div>
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
        {kajabiData && !kajabiLoading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Kajabi Sales by Tier
                <span className="text-xs font-normal text-muted-foreground">
                  {kajabiData.pagesScanned} pages scanned · {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kajabiData.tiers.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No sales found in this date range.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 font-medium">Product</th>
                      <th className="text-right py-2 font-medium">Sales</th>
                      <th className="text-right py-2 font-medium">Revenue</th>
                      {spendNum > 0 && <th className="text-right py-2 font-medium">% of Rev</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {[...kajabiData.tiers]
                      .sort((a, b) => b.revenueCents - a.revenueCents)
                      .map((tier) => (
                        <tr key={tier.tier} className="border-b last:border-0">
                          <td className="py-2 font-medium">{tier.label}</td>
                          <td className="py-2 text-right">
                            <Badge variant="secondary">{tier.count}</Badge>
                          </td>
                          <td className="py-2 text-right text-green-600 font-semibold">
                            {fmt(tier.revenueCents)}
                          </td>
                          {spendNum > 0 && (
                            <td className="py-2 text-right text-muted-foreground">
                              {((tier.revenueCents / kajabiData.totalRevenueCents) * 100).toFixed(0)}%
                            </td>
                          )}
                        </tr>
                      ))}
                    <tr className="font-bold border-t-2">
                      <td className="py-2">TOTAL</td>
                      <td className="py-2 text-right">{kajabiData.totalPurchases}</td>
                      <td className="py-2 text-right text-green-600">{fmt(kajabiData.totalRevenueCents)}</td>
                      {spendNum > 0 && <td className="py-2 text-right">100%</td>}
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Meta Campaign Breakdown */}
        {metaData && !metaLoading && metaData.campaigns.length > 0 && (
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
                  {[...metaData.campaigns]
                    .sort((a, b) => b.spend - a.spend)
                    .map((c, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 max-w-[260px] truncate" title={c.name}>{c.name}</td>
                        <td className="py-1.5 text-right font-medium">{fmtDollars(c.spend)}</td>
                        <td className="py-1.5 text-right">
                          {c.leads > 0 ? <Badge variant="secondary">{c.leads}</Badge> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 text-right text-muted-foreground">
                          {c.cpl !== null ? fmtDollars(c.cpl) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Transaction Log */}
        {kajabiData?.individualSales && kajabiData.individualSales.length > 0 && (
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
                    {kajabiData.individualSales.map((s, i) => {
                      const ct = new Date(s.time).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
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
        {kajabiData && spendNum > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 text-sm space-y-1">
              <p className="font-semibold text-amber-600">⚠️ Attribution Note for Ad Buyer</p>
              <p className="text-muted-foreground">
                Meta reports <strong>"0 sales"</strong> because Kajabi checkout runs on a separate domain — the pixel
                cannot fire there. The {kajabiData.totalPurchases} sales above ({fmtDollars(totalRevenue)}) are{" "}
                <strong>real revenue</strong>. His "0 sales" means zero Meta-attributed conversions, not zero actual sales.
              </p>
              {roas && (
                <p className="text-muted-foreground">
                  True ROAS:{" "}
                  <strong className={roas >= 3 ? "text-green-600" : "text-yellow-600"}>
                    {roas.toFixed(2)}x
                  </strong>{" "}
                  ({fmtDollars(totalRevenue)} revenue ÷ {fmtDollars(spendNum)} spend).
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
