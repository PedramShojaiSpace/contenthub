import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react";

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDollars(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function sevenDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split("T")[0];
}

export default function Reconciliation() {
  const [startDate, setStartDate] = useState(sevenDaysAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [adSpend, setAdSpend] = useState("");
  const [leads, setLeads] = useState("");
  const [checkouts, setCheckouts] = useState("");
  const [queryDates, setQueryDates] = useState<{ start: string; end: string } | null>(null);

  const { data, isLoading, error, refetch } = trpc.kajabiSales.getCustomRangeSales.useQuery(
    { startDate: queryDates?.start ?? startDate, endDate: queryDates?.end ?? endDate },
    { enabled: !!queryDates, staleTime: 0 }
  );

  const handleRun = () => {
    setQueryDates({ start: startDate, end: endDate });
  };

  const handleRefresh = () => {
    refetch();
  };

  const spendNum = parseFloat(adSpend) || 0;
  const leadsNum = parseInt(leads) || 0;
  const checkoutsNum = parseInt(checkouts) || 0;
  const totalRevenue = (data?.totalRevenueCents ?? 0) / 100;
  const roas = spendNum > 0 ? (totalRevenue / spendNum) : null;
  const cpl = spendNum > 0 && leadsNum > 0 ? spendNum / leadsNum : null;
  const checkoutRate = leadsNum > 0 && checkoutsNum > 0 ? ((checkoutsNum / leadsNum) * 100) : null;
  const convRate = leadsNum > 0 && data ? ((data.totalPurchases / leadsNum) * 100) : null;

  const quickPresets = [
    { label: "Today", start: todayStr(), end: todayStr() },
    { label: "Yesterday", start: (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })(), end: (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })() },
    { label: "Last 7d", start: sevenDaysAgoStr(), end: todayStr() },
    { label: "Last 14d", start: (() => { const d = new Date(); d.setDate(d.getDate()-13); return d.toISOString().split("T")[0]; })(), end: todayStr() },
    { label: "This Month", start: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`; })(), end: todayStr() },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Reconciliation</h1>
          <p className="text-muted-foreground mt-1">
            Pull live Kajabi transactions for any date range and reconcile against ad spend.
            <span className="text-amber-500 font-medium ml-1">⚠️ Meta pixel cannot see Kajabi sales — always verify here.</span>
          </p>
        </div>

        {/* Date Range + Ad Buyer Numbers */}
        <Card>
          <CardHeader><CardTitle className="text-base">Date Range & Campaign Numbers</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              {quickPresets.map(p => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => { setStartDate(p.start); setEndDate(p.end); setQueryDates({ start: p.start, end: p.end }); }}
                  className={queryDates?.start === p.start && queryDates?.end === p.end ? "bg-primary text-primary-foreground" : ""}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Ad Spend ($) <span className="text-muted-foreground text-xs">optional</span></Label>
                <Input type="number" placeholder="e.g. 177" value={adSpend} onChange={e => setAdSpend(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Leads <span className="text-muted-foreground text-xs">optional</span></Label>
                <Input type="number" placeholder="e.g. 86" value={leads} onChange={e => setLeads(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label>Checkouts <span className="text-muted-foreground text-xs">optional</span></Label>
                <Input type="number" placeholder="e.g. 22" value={checkouts} onChange={e => setCheckouts(e.target.value)} />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleRun} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                Pull Kajabi Sales
              </Button>
              {queryDates && (
                <Button variant="outline" onClick={handleRefresh} disabled={isLoading} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4 text-destructive text-sm">
              Error loading data: {error.message}
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {data && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    <DollarSign className="h-4 w-4" /> Kajabi Revenue
                  </div>
                  <div className="text-2xl font-bold text-green-500">{fmt(data.totalRevenueCents)}</div>
                  <div className="text-xs text-muted-foreground mt-1">{data.totalPurchases} sales</div>
                </CardContent>
              </Card>

              {spendNum > 0 && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <TrendingUp className="h-4 w-4" /> ROAS
                    </div>
                    <div className={`text-2xl font-bold ${roas && roas >= 2 ? "text-green-500" : roas && roas >= 1 ? "text-yellow-500" : "text-red-500"}`}>
                      {roas?.toFixed(2)}x
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{fmtDollars(spendNum)} spend</div>
                  </CardContent>
                </Card>
              )}

              {cpl !== null && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <Users className="h-4 w-4" /> Cost Per Lead
                    </div>
                    <div className="text-2xl font-bold">{fmtDollars(cpl)}</div>
                    <div className="text-xs text-muted-foreground mt-1">{leadsNum} leads</div>
                  </CardContent>
                </Card>
              )}

              {convRate !== null && (
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                      <ShoppingCart className="h-4 w-4" /> Lead → Sale
                    </div>
                    <div className="text-2xl font-bold">{convRate.toFixed(1)}%</div>
                    <div className="text-xs text-muted-foreground mt-1">{data.totalPurchases} of {leadsNum} leads</div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Tier breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  Sales by Tier
                  <span className="text-xs font-normal text-muted-foreground">
                    {data.startDate} → {data.endDate} · {data.pagesScanned} pages scanned
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.tiers.length === 0 ? (
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
                      {[...data.tiers].sort((a, b) => b.revenueCents - a.revenueCents).map(tier => (
                        <tr key={tier.tier} className="border-b last:border-0">
                          <td className="py-2 font-medium">{tier.label}</td>
                          <td className="py-2 text-right">
                            <Badge variant="secondary">{tier.count}</Badge>
                          </td>
                          <td className="py-2 text-right text-green-600 font-semibold">{fmt(tier.revenueCents)}</td>
                          {spendNum > 0 && (
                            <td className="py-2 text-right text-muted-foreground">
                              {((tier.revenueCents / data.totalRevenueCents) * 100).toFixed(0)}%
                            </td>
                          )}
                        </tr>
                      ))}
                      <tr className="font-bold border-t-2">
                        <td className="py-2">TOTAL</td>
                        <td className="py-2 text-right">{data.totalPurchases}</td>
                        <td className="py-2 text-right text-green-600">{fmt(data.totalRevenueCents)}</td>
                        {spendNum > 0 && <td className="py-2 text-right">100%</td>}
                      </tr>
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Individual sales log */}
            {data.individualSales && data.individualSales.length > 0 && (
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
                        {data.individualSales.map((s, i) => {
                          const ct = new Date(s.time).toLocaleString("en-US", {
                            timeZone: "America/Chicago",
                            month: "short", day: "numeric",
                            hour: "2-digit", minute: "2-digit"
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

            {/* Reconciliation note */}
            {spendNum > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-4 text-sm space-y-1">
                  <p className="font-semibold text-amber-600">⚠️ Attribution Note for Ad Buyer</p>
                  <p className="text-muted-foreground">
                    Meta pixel reports <strong>"0 sales"</strong> because Kajabi checkout runs on a separate domain —
                    the pixel cannot fire there. The {data.totalPurchases} sales above ({fmt(data.totalRevenueCents)}) are <strong>real revenue</strong>.
                    His "0 sales" means zero Meta-attributed conversions, not zero actual sales.
                  </p>
                  {roas && (
                    <p className="text-muted-foreground">
                      True ROAS for this period: <strong className="text-green-600">{roas.toFixed(2)}x</strong> ({fmt(data.totalRevenueCents)} revenue ÷ {fmtDollars(spendNum)} spend).
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
