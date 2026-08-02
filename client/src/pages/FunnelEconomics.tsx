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
  Save, History, ChevronDown, ChevronUp, Info
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
          <ROASBadge roas={calc.roas} />
        </div>

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
