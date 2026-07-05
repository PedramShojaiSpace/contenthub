import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DollarSign,
  ShoppingCart,
  Target,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  BarChart3,
} from "lucide-react";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(ts: number | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function AttributionBadge({ type }: { type: string }) {
  if (type === "direct") return <Badge className="bg-emerald-600 text-white text-xs">Direct Match</Badge>;
  if (type === "probabilistic") return <Badge className="bg-amber-500 text-white text-xs">Probabilistic</Badge>;
  return <Badge variant="outline" className="text-xs text-muted-foreground">Unattributed</Badge>;
}

function CapiBadge({ sent }: { sent: boolean }) {
  if (sent) return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="w-3 h-3" /> CAPI Sent</span>;
  return <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertCircle className="w-3 h-3" /> No CAPI</span>;
}

export default function AdAttributionDashboard() {
  const [days, setDays] = useState(30);
  const [filterType, setFilterType] = useState<"all" | "direct" | "probabilistic" | "unattributed">("all");

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = trpc.attribution.getSummary.useQuery({ days });
  const { data: sales, isLoading: salesLoading, refetch: refetchSales } = trpc.attribution.listSales.useQuery({ days, attributionType: filterType, limit: 100 });

  const retryCapi = trpc.attribution.retryCapi.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("CAPI Purchase event sent to Meta");
        refetchSales();
      } else {
        toast.error("CAPI send failed — check META_AD_ACCESS_TOKEN");
      }
    },
    onError: () => toast.error("Failed to retry CAPI"),
  });

  const handleRefresh = () => {
    refetchSummary();
    refetchSales();
    toast.success("Data refreshed");
  };

  const s = summary?.summary;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ad Attribution</h1>
            <p className="text-muted-foreground text-sm mt-1">Track which Meta ads and advertorials are driving Shopify sales</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="60">Last 60 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Setup Banner */}
        <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-300 mb-1">One-time Shopify setup required</p>
            <p className="text-blue-400/80">
              Go to <strong>Shopify Admin → Settings → Notifications → Webhooks</strong> and add a webhook for the <em>Order payment</em> event pointing to:
            </p>
            <code className="block mt-1 bg-blue-950 text-blue-200 px-2 py-1 rounded text-xs font-mono">
              https://content.theurbanmonk.com/api/shopify/order-paid
            </code>
            <p className="text-blue-400/80 mt-1">Set the secret to your <code className="text-blue-200">INGEST_SECRET</code> value. Once done, all paid orders will flow into this dashboard automatically.</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <DollarSign className="w-4 h-4" /> Attributed Revenue
              </div>
              <div className="text-2xl font-bold">{summaryLoading ? "…" : formatCurrency(s?.totalRevenue ?? 0)}</div>
              <div className="text-xs text-muted-foreground mt-1">Last {days} days</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ShoppingCart className="w-4 h-4" /> Total Orders
              </div>
              <div className="text-2xl font-bold">{summaryLoading ? "…" : s?.totalSales ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Received via webhook</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Target className="w-4 h-4" /> Direct Matches
              </div>
              <div className="text-2xl font-bold text-emerald-500">{summaryLoading ? "…" : s?.directCount ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Exact click token match</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="w-4 h-4" /> Attribution Rate
              </div>
              <div className="text-2xl font-bold">
                {summaryLoading ? "…" : s?.totalSales
                  ? `${Math.round(((s.directCount + s.probCount) / s.totalSales) * 100)}%`
                  : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Direct + probabilistic</div>
            </CardContent>
          </Card>
        </div>

        {/* By Campaign + By Advertorial */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Revenue by Campaign
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !summary?.byCampaign.length ? (
                <div className="text-sm text-muted-foreground">No data yet — waiting for attributed orders</div>
              ) : (
                <div className="space-y-2">
                  {summary.byCampaign.map((row) => {
                    const maxRevenue = summary.byCampaign[0]?.revenue || 1;
                    const pct = Math.round((row.revenue / maxRevenue) * 100);
                    return (
                      <div key={row.campaign}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate max-w-[60%]">{row.campaign}</span>
                          <span className="text-muted-foreground">{row.sales} orders · {formatCurrency(row.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Revenue by Advertorial
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !summary?.byAdvertorial.length ? (
                <div className="text-sm text-muted-foreground">No data yet — waiting for attributed orders</div>
              ) : (
                <div className="space-y-2">
                  {summary.byAdvertorial.map((row) => {
                    const maxRevenue = summary.byAdvertorial[0]?.revenue || 1;
                    const pct = Math.round((row.revenue / maxRevenue) * 100);
                    return (
                      <div key={row.slug}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate max-w-[60%]">{row.slug}</span>
                          <span className="text-muted-foreground">{row.sales} orders · {formatCurrency(row.revenue)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Order Feed</CardTitle>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All orders</SelectItem>
                  <SelectItem value="direct">Direct match only</SelectItem>
                  <SelectItem value="probabilistic">Probabilistic only</SelectItem>
                  <SelectItem value="unattributed">Unattributed only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : !sales?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No orders yet. Once the Shopify webhook is configured and a paid order comes in, it will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs">
                      <th className="text-left pb-2 pr-4">Order</th>
                      <th className="text-left pb-2 pr-4">Customer</th>
                      <th className="text-left pb-2 pr-4">Amount</th>
                      <th className="text-left pb-2 pr-4">Attribution</th>
                      <th className="text-left pb-2 pr-4">Campaign</th>
                      <th className="text-left pb-2 pr-4">Advertorial</th>
                      <th className="text-left pb-2 pr-4">CAPI</th>
                      <th className="text-left pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          #{sale.shopifyOrderNumber || sale.shopifyOrderId.slice(-6)}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{sale.customerName || "—"}</div>
                          <div className="text-xs text-muted-foreground">{sale.customerEmail || ""}</div>
                        </td>
                        <td className="py-2 pr-4 font-semibold">{formatCurrency(sale.orderTotal)}</td>
                        <td className="py-2 pr-4">
                          <AttributionBadge type={sale.attributionType} />
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {sale.utmCampaign ? (
                            <span className="text-foreground">{sale.utmCampaign}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {sale.utmSource && (
                            <div className="text-muted-foreground">{sale.utmSource} / {sale.utmMedium}</div>
                          )}
                        </td>
                        <td className="py-2 pr-4 text-xs text-muted-foreground">
                          {sale.advertorialSlug || "—"}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <CapiBadge sent={sale.capiEventSent} />
                            {!sale.capiEventSent && sale.attributionType !== "unattributed" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => retryCapi.mutate({ saleId: sale.id })}
                                disabled={retryCapi.isPending}
                              >
                                Retry
                              </Button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">{formatDate(sale.receivedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attribution Legend */}
        <Card className="bg-muted/20">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">How Attribution Works</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Direct Match</p>
                  <p>The bridge page stored a unique click token as a Shopify order note attribute. Exact 1:1 match — highest confidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Probabilistic</p>
                  <p>No click token found, but the buyer's IP hash matches an ad click within the last 24 hours. Medium confidence.</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">Unattributed</p>
                  <p>No match found. Could be direct traffic, email, organic, or a sale from a channel not tracked by the bridge page.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
