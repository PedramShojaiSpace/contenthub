import { useMemo, useState, type ReactNode } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, RefreshCw, ShieldCheck, ShoppingCart, Users } from "lucide-react";
import { toast } from "sonner";

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function InterconnectedEmailRevenue() {
  const [days, setDays] = useState(14);
  const [endAt] = useState(() => Date.now());
  const startAt = useMemo(() => endAt - days * 86_400_000, [days, endAt]);
  const report = trpc.emailRevenue.getReport.useQuery({ startAt, endAt, funnelPath: "all" });
  const collect = trpc.emailRevenue.collectKlaviyo.useMutation({
    onSuccess: (result) => { toast.success(`Collected ${result.messageRows} Klaviyo message rows`); report.refetch(); },
    onError: (error) => toast.error(error.message),
  });

  return (
    <DashboardLayout>
      <main className="max-w-7xl space-y-6 p-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700"><ShieldCheck className="h-4 w-4" /> Isolated A/B measurement</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Interconnected Email → Revenue</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Compare Kajabi and KO/Klaviyo as separate cohorts from opt-in through payment. These columns are never pooled into a winner metric.</p>
          </div>
          <div className="flex gap-2">
            <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="7">7 days</SelectItem><SelectItem value="14">14 days</SelectItem><SelectItem value="30">30 days</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={() => report.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button disabled={collect.isPending} onClick={() => collect.mutate({ startAt, endAt })}><BarChart3 className="mr-2 h-4 w-4" />{collect.isPending ? "Collecting" : "Collect Klaviyo"}</Button>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {(report.data?.paths ?? ["kajabi", "ko_klaviyo"].map((funnelPath) => typeof funnelPath === "string" ? { funnelPath, snapshots: [], checkoutTouches: [], cohort: { leads: 0, purchases: 0, revenueCents: 0, ltvCents: 0 } } : funnelPath)).map((path) => {
            const isKajabi = path.funnelPath === "kajabi";
            const emailRows = path.snapshots.filter((row) => row.sendChannel === "email");
            const delivered = emailRows.reduce((sum, row) => sum + row.delivered, 0);
            const clicks = emailRows.reduce((sum, row) => sum + row.clicks, 0);
            const directRevenue = path.checkoutTouches.reduce((sum, row) => sum + row.revenueCents, 0);
            return <Card key={path.funnelPath} className={isKajabi ? "border-amber-300" : "border-emerald-300"}>
              <CardHeader className="border-b bg-muted/30 pb-4"><div className="flex items-center justify-between"><CardTitle>{isKajabi ? "Kajabi Path" : "KO / Klaviyo Path"}</CardTitle><Badge variant="outline">{isKajabi ? "Kajabi payment" : "Shopify payment"}</Badge></div></CardHeader>
              <CardContent className="space-y-5 pt-5">
                <div className="grid grid-cols-2 gap-3 text-sm"><Metric label="Cohort leads" value={String(path.cohort.leads)} icon={<Users className="h-4 w-4" />} /><Metric label="14-day LTV / lead" value={money(path.cohort.ltvCents)} icon={<ShoppingCart className="h-4 w-4" />} /><Metric label="14-day cohort revenue" value={money(path.cohort.revenueCents)} icon={<BarChart3 className="h-4 w-4" />} /><Metric label="Cohort purchases" value={String(path.cohort.purchases)} icon={<ShoppingCart className="h-4 w-4" />} /></div>
                <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Email engagement</p><p className="mt-1 text-muted-foreground">Delivered: {delivered} · Clicks: {clicks} · Aggregate CTR: {delivered ? pct(clicks / delivered) : "—"}</p></div>
                <div className="rounded-lg border p-3 text-xs"><p className="font-semibold">Direct checkout-touch revenue</p><p className="mt-1 text-muted-foreground">{money(directRevenue)} from {path.checkoutTouches.reduce((sum, row) => sum + row.touches, 0)} first-party checkout touches. {isKajabi ? "Kajabi’s native last-click revenue remains separate from Shopify direct-click credit." : "Shopify orders are joined through the first-party click token."}</p></div>
                <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="pb-2">Email</th><th className="pb-2 text-right">Delivered</th><th className="pb-2 text-right">Open</th><th className="pb-2 text-right">Click</th><th className="pb-2 text-right">Platform revenue</th></tr></thead><tbody>{emailRows.length ? emailRows.map((row) => <tr key={row.id} className="border-t"><td className="py-2 pr-2">{row.messageName ?? row.messageId}</td><td className="py-2 text-right">{row.delivered}</td><td className="py-2 text-right">{pct(row.openRate)}</td><td className="py-2 text-right">{pct(row.clickRate)}</td><td className="py-2 text-right">{money(row.platformRevenueCents)}</td></tr>) : <tr><td colSpan={5} className="py-5 text-center text-muted-foreground">No collected message data for this path and window.</td></tr>}</tbody></table></div>
              </CardContent>
            </Card>;
          })}
        </div>
        <Card><CardContent className="p-4 text-xs text-muted-foreground"><strong className="text-foreground">ROAS guardrail:</strong> the dashboard intentionally withholds a pooled ROAS. Path-level ROAS activates only when each path has a separately mapped paid-spend source; until then, LTV and revenue remain path-isolated rather than creating a misleading A/B winner.</CardContent></Card>
      </main>
    </DashboardLayout>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-lg bg-muted/50 p-3"><div className="flex items-center gap-1 text-muted-foreground">{icon}<span>{label}</span></div><p className="mt-1 text-lg font-bold">{value}</p></div>;
}
