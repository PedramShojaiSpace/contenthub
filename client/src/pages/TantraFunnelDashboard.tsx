import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useMemo, useState } from "react";
import { ArrowDown, CreditCard, DollarSign, ShoppingCart, TrendingDown, Users } from "lucide-react";

type FinancialRange = "since_launch" | "today" | "last_7_days" | "this_month";

const TANTRA_LAUNCH_DATE = "2026-07-30";

function localDateString(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function resolveFinancialRange(range: FinancialRange) {
  const today = new Date();
  const endDate = localDateString(today);
  const start = new Date(today);

  if (range === "today") return { startDate: endDate, endDate, label: "Today" };
  if (range === "last_7_days") {
    start.setDate(start.getDate() - 6);
    return { startDate: localDateString(start), endDate, label: "Last 7 days" };
  }
  if (range === "this_month") {
    start.setDate(1);
    return { startDate: localDateString(start), endDate, label: "This month" };
  }
  return { startDate: TANTRA_LAUNCH_DATE, endDate, label: "Since launch" };
}

function usd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function pct(num: number, den: number) {
  if (!den) return "—";
  return ((num / den) * 100).toFixed(1) + "%";
}

function FunnelStep({
  label,
  value,
  total,
  color,
  sublabel,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  sublabel?: string;
}) {
  const rate = total ? (value / total) * 100 : 0;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/60 text-sm font-medium uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-bold text-white">{value.toLocaleString()}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 mb-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(rate, 100)}%`, background: color }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{sublabel ?? `${pct(value, total)} of started`}</span>
        <span style={{ color }} className="font-semibold">{pct(value, total)}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent = "text-white",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: string;
}) {
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-5">
      <div className="text-white/50 text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accent}`}>{value}</div>
      <div className="text-white/40 text-xs mt-2">{detail}</div>
    </div>
  );
}

export default function TantraFunnelDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [financialRange, setFinancialRange] = useState<FinancialRange>("since_launch");
  const dateRange = useMemo(() => resolveFinancialRange(financialRange), [financialRange]);
  const { data, isLoading, refetch } = trpc.tantraQuiz.getFunnelStats.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });
  const {
    data: financials,
    isLoading: financialsLoading,
    isFetching: financialsRefreshing,
    refetch: refetchFinancials,
  } = trpc.funnelRecon.getReconciliation.useQuery(
    {
      funnelId: "tantra_quiz",
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      newCustomersOnly: false,
      attributionFilter: "all",
    },
    {
      enabled: isAuthenticated,
      refetchInterval: 60_000,
      staleTime: 45_000,
    }
  );

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="text-white/40">Loading…</div></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const t = data?.totals;
  const started = Number(t?.started ?? 0);
  const completed = Number(t?.completed ?? 0);
  const emailCaptured = Number(t?.emailCaptured ?? 0);
  const kajabiTagged = Number(t?.kajabiTagged ?? 0);
  const tantraHim = Number(t?.tantraHim ?? 0);
  const tantraHer = Number(t?.tantraHer ?? 0);
  const gutFlag = Number(t?.gutFlag ?? 0);
  const sleepFlag = Number(t?.sleepFlag ?? 0);
  const oralFlag = Number(t?.oralFlag ?? 0);
  const shopifyRevenue = financials?.shopify.totalRevenueCents
    ? financials.shopify.totalRevenueCents / 100
    : 0;
  const shopifyUnits = Number(financials?.shopify.totalOrders ?? 0);
  const metaSpend = Number(financials?.meta.spend ?? 0);
  const skuRoas = metaSpend > 0 ? shopifyRevenue / metaSpend : null;
  const costPerPurchase = shopifyUnits > 0 ? metaSpend / shopifyUnits : null;
  const purchaseRate = emailCaptured > 0 ? (shopifyUnits / emailCaptured) * 100 : null;

  const refreshAll = () => {
    void refetch();
    void refetchFinancials();
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tantra Quiz Funnel</h1>
          <p className="text-white/40 text-sm mt-1">Click → Start → Complete → Email → Purchase</p>
        </div>
        <button
          onClick={refreshAll}
          className="text-xs text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:text-white/70 transition-colors"
        >
          {financialsRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-center py-20">Loading stats…</div>
      ) : (
        <>
          {/* Funnel Steps */}
          <div className="grid grid-cols-1 gap-3 mb-8">
            <FunnelStep label="Quiz Started" value={started} total={started} color="#6366f1" sublabel="All sessions" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Quiz Completed" value={completed} total={started} color="#8b5cf6" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Email Captured" value={emailCaptured} total={started} color="#a78bfa" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Kajabi Tagged (in sequence)" value={kajabiTagged} total={started} color="#c4b5fd" />
          </div>

          {/* Commercial results — verified against paid Shopify product line items */}
          <section className="bg-[#0e0e0e] border border-emerald-500/20 rounded-xl p-5 mb-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">Verified Sales & ROAS</h2>
                </div>
                <p className="text-white/40 text-xs mt-1">
                  Paid Shopify line items for Tantra Him, Tantra Her, and the couples bundle only.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["since_launch", "Since launch"],
                  ["today", "Today"],
                  ["last_7_days", "Last 7d"],
                  ["this_month", "This month"],
                ] as Array<[FinancialRange, string]>).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFinancialRange(key)}
                    className={`px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                      financialRange === key
                        ? "bg-emerald-500/15 border-emerald-400/50 text-emerald-300"
                        : "border-white/10 text-white/45 hover:text-white/75"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {financialsLoading ? (
              <div className="text-white/40 text-sm text-center py-10">Loading Shopify sales and Meta spend…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    label="Shopify Tantra Revenue"
                    value={usd(shopifyRevenue)}
                    detail={`${shopifyUnits} paid Tantra ${shopifyUnits === 1 ? "unit" : "units"} · ${dateRange.label}`}
                    accent="text-emerald-400"
                  />
                  <MetricCard
                    label="Meta Spend"
                    value={usd(metaSpend)}
                    detail={`${financials?.meta.campaigns.length ?? 0} Tantra campaign${(financials?.meta.campaigns.length ?? 0) === 1 ? "" : "s"} included`}
                    accent="text-white"
                  />
                  <MetricCard
                    label="Shopify SKU ROAS"
                    value={skuRoas === null ? "—" : `${skuRoas.toFixed(2)}x`}
                    detail="Shopify Tantra revenue ÷ matched Meta spend"
                    accent={skuRoas !== null && skuRoas >= 1 ? "text-emerald-400" : "text-amber-400"}
                  />
                  <MetricCard
                    label="Cost per Purchase"
                    value={costPerPurchase === null ? "—" : usd(costPerPurchase)}
                    detail={purchaseRate === null ? "No captured-email base yet" : `${purchaseRate.toFixed(1)}% of captured emails purchased`}
                    accent="text-sky-300"
                  />
                </div>

                {financials?.meta.error && (
                  <div className="mt-4 border border-red-500/25 bg-red-500/10 rounded-lg px-3 py-2 text-red-200 text-xs">
                    Meta reporting issue: {financials.meta.error}
                  </div>
                )}
                {financials?.shopify.note && financials.shopify.note !== "placeholder" && (
                  <div className="mt-4 border border-amber-500/25 bg-amber-500/10 rounded-lg px-3 py-2 text-amber-100 text-xs">
                    Shopify reporting note: {financials.shopify.note}
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                      <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Shopify Sales by SKU</span>
                    </div>
                    {financials?.shopify.tiers.length ? (
                      <div className="divide-y divide-white/5">
                        {financials.shopify.tiers.map((tier) => (
                          <div key={tier.productId} className="flex justify-between gap-4 px-4 py-3 text-sm">
                            <div>
                              <div className="text-white/85">{tier.label}</div>
                              <div className="text-white/40 text-xs mt-0.5">{tier.count} paid {tier.count === 1 ? "unit" : "units"}</div>
                            </div>
                            <div className="text-emerald-400 font-semibold whitespace-nowrap">{usd(tier.revenueCents / 100)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/35 text-sm px-4 py-7 text-center">No paid Tantra SKU sales in this period.</div>
                    )}
                  </div>

                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-sky-300" />
                      <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Matched Meta Campaign Spend</span>
                    </div>
                    {financials?.meta.campaigns.length ? (
                      <div className="divide-y divide-white/5 max-h-56 overflow-y-auto">
                        {financials.meta.campaigns.map((campaign) => (
                          <div key={campaign.name} className="flex justify-between gap-4 px-4 py-3 text-sm">
                            <div className="text-white/70 min-w-0">
                              <div className="truncate" title={campaign.name}>{campaign.name}</div>
                              <div className="text-white/40 text-xs mt-0.5">
                                {campaign.leads ? `${campaign.leads} Meta-reported leads` : "No Meta lead event reported"}
                              </div>
                            </div>
                            <div className="text-white font-semibold whitespace-nowrap">{usd(campaign.spend)}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-white/35 text-sm px-4 py-7 text-center">No Tantra campaign spend in this period.</div>
                    )}
                  </div>
                </div>

                <p className="text-white/35 text-[11px] leading-relaxed mt-4">
                  Basis: paid Shopify orders containing only mapped Tantra SKUs; Meta spend is limited to campaigns or ad sets named “Tantra.” ROAS uses Shopify Tantra revenue ÷ that spend. Shopify revenue does not rely on the Meta pixel and excludes Kajabi sales.
                </p>
              </>
            )}
          </section>

          {/* Split stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111] border border-white/10 rounded-xl p-5">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Recommendation Split</div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-3xl font-bold text-blue-400">{tantraHim}</div>
                  <div className="text-white/40 text-xs mt-1">Tantra Him</div>
                </div>
                <div className="text-white/20 text-2xl mb-1">vs</div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">{tantraHer}</div>
                  <div className="text-white/40 text-xs mt-1">Tantra Her</div>
                </div>
              </div>
            </div>
            <div className="bg-[#111] border border-white/10 rounded-xl p-5">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Upsell Flags</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Gut Test</span>
                  <span className="text-amber-400 font-semibold">{gutFlag} ({pct(gutFlag, emailCaptured)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Sleep Test</span>
                  <span className="text-amber-400 font-semibold">{sleepFlag} ({pct(sleepFlag, emailCaptured)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Oral Test</span>
                  <span className="text-amber-400 font-semibold">{oralFlag} ({pct(oralFlag, emailCaptured)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Drop-off summary */}
          <div className="bg-[#111] border border-amber-500/20 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold uppercase tracking-wider">Drop-off Analysis</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-white/40 text-xs mb-1">Start → Complete</div>
                <div className="text-white font-bold">{pct(completed, started)}</div>
                <div className="text-red-400 text-xs">{(started - completed).toLocaleString()} dropped off</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Complete → Email</div>
                <div className="text-white font-bold">{pct(emailCaptured, completed)}</div>
                <div className="text-red-400 text-xs">{(completed - emailCaptured).toLocaleString()} dropped off</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Email → Tagged</div>
                <div className="text-white font-bold">{pct(kajabiTagged, emailCaptured)}</div>
                <div className="text-red-400 text-xs">{(emailCaptured - kajabiTagged).toLocaleString()} dropped off</div>
              </div>
            </div>
          </div>

          {/* Recent completions */}
          <div className="bg-[#111] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-white/50" />
              <span className="text-white/50 text-sm font-semibold uppercase tracking-wider">Recent Completions</span>
            </div>
            {data?.recent?.length === 0 ? (
              <div className="text-white/30 text-sm text-center py-6">No completions yet — ads just launched</div>
            ) : (
              <div className="space-y-2">
                {data?.recent?.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <div className="text-white text-sm font-medium">{lead.name ?? "Anonymous"}</div>
                      <div className="text-white/40 text-xs">{lead.email}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-semibold ${lead.result === "tantra_him" ? "text-blue-400" : "text-purple-400"}`}>
                        {lead.result === "tantra_him" ? "Tantra Him" : lead.result === "tantra_her" ? "Tantra Her" : lead.result}
                      </div>
                      <div className="text-white/30 text-xs">
                        {lead.emailCapturedAt ? new Date(lead.emailCapturedAt).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
