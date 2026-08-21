import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDown, ExternalLink, RefreshCw, ShoppingCart } from "lucide-react";
import { useState } from "react";

type Counts = {
  pageViews: number;
  uniqueVisitors: number;
  scroll25: number;
  scroll50: number;
  scroll75: number;
  ctaClicks: number;
  cartIntents: number;
  purchases: number;
  revenueCents: number;
};

const EMPTY: Counts = { pageViews: 0, uniqueVisitors: 0, scroll25: 0, scroll50: 0, scroll75: 0, ctaClicks: 0, cartIntents: 0, purchases: 0, revenueCents: 0 };

function rate(numerator: number, denominator: number) {
  return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : "—";
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function Step({ label, value, base, tone, note }: { label: string; value: number; base: number; tone: string; note: string }) {
  return (
    <div className="border border-white/10 rounded-xl bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">{label}</div>
        <div className={`text-2xl font-bold ${tone}`}>{value.toLocaleString()}</div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(base ? (value / base) * 100 : 0, 100)}%`, backgroundColor: tone === "text-pink-300" ? "#f9a8d4" : tone === "text-sky-300" ? "#7dd3fc" : tone === "text-emerald-300" ? "#6ee7b7" : "#c4b5fd" }} /></div>
      <div className="mt-2 text-xs text-white/40">{note} · {rate(value, base)}</div>
    </div>
  );
}

function VariantPanel({ label, counts, primary }: { label: string; counts: Counts; primary: boolean }) {
  const views = counts.pageViews;
  return (
    <section className={`rounded-2xl border p-5 ${primary ? "border-pink-300/35 bg-pink-300/[0.06]" : "border-white/10 bg-white/[0.025]"}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{label}</h2>
          <p className="mt-1 text-sm text-white/50">{primary ? "Treatment: price, package inclusions, and exact CTA are visible in the hero." : "Control: currently published hero and CTA framing."}</p>
        </div>
        <div className="text-right"><div className="text-xl font-bold text-emerald-300">{money(counts.revenueCents)}</div><div className="text-xs text-white/40">verified tracked revenue</div></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Step label="Views" value={views} base={views} tone="text-white" note={`${counts.uniqueVisitors} unique`} />
        <Step label="75% Scroll" value={counts.scroll75} base={views} tone="text-sky-300" note="of page views" />
        <Step label="CTA Click" value={counts.ctaClicks} base={views} tone="text-pink-300" note="of page views" />
        <Step label="Cart Intent" value={counts.cartIntents} base={views} tone="text-violet-300" note="of page views" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 px-4 py-3"><div className="text-xs uppercase tracking-[0.1em] text-white/40">Purchase</div><div className="mt-1 text-xl font-bold text-emerald-300">{counts.purchases}</div><div className="text-xs text-white/40">{rate(counts.purchases, views)} of page views</div></div>
        <div className="rounded-lg border border-white/10 px-4 py-3"><div className="text-xs uppercase tracking-[0.1em] text-white/40">Cart Intent → Purchase</div><div className="mt-1 text-xl font-bold text-emerald-300">{rate(counts.purchases, counts.cartIntents)}</div><div className="text-xs text-white/40">Paid order captured from cart attributes</div></div>
      </div>
    </section>
  );
}

export default function OrobiomeFunnelDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const [days, setDays] = useState(14);
  const { data, isLoading, isFetching, refetch } = trpc.orobiomeFunnel.getSummary.useQuery({ days }, { enabled: isAuthenticated, refetchInterval: 60_000, staleTime: 45_000 });

  if (loading) return <div className="min-h-screen bg-[#090d18]" />;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }
  const control = data?.byVariant.control ?? EMPTY;
  const treatment = data?.byVariant.offer_clarity ?? EMPTY;
  const total = data?.totals ?? EMPTY;

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-[#090d18] px-5 py-8 text-white md:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-pink-200"><Activity className="h-4 w-4" /> Live first-party funnel</div>
              <h1 className="text-3xl font-semibold tracking-tight">Orobiome · Natalie Jill Funnel</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">Anonymous page behavior, direct cart intent, and paid orders correlated through Shopify-supported cart attributes. This panel does not use Meta proxy conversions as its denominator.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 7, 14, 30].map((option) => <button key={option} onClick={() => setDays(option)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${days === option ? "border-pink-300/60 bg-pink-300/15 text-pink-100" : "border-white/10 text-white/55 hover:text-white"}`}>{option === 1 ? "Today" : `${option} days`}</button>)}
              <button onClick={() => void refetch()} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 hover:text-white"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh</button>
            </div>
          </header>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="text-xs uppercase tracking-[0.12em] text-white/45">Unique visitors</div><div className="mt-2 text-3xl font-bold">{total.uniqueVisitors.toLocaleString()}</div><div className="mt-1 text-xs text-white/40">{total.pageViews.toLocaleString()} page views</div></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="text-xs uppercase tracking-[0.12em] text-white/45">CTA click rate</div><div className="mt-2 text-3xl font-bold text-pink-200">{rate(total.ctaClicks, total.pageViews)}</div><div className="mt-1 text-xs text-white/40">{total.ctaClicks.toLocaleString()} CTA clicks</div></div>
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4"><div className="text-xs uppercase tracking-[0.12em] text-white/45">Cart intent rate</div><div className="mt-2 text-3xl font-bold text-violet-200">{rate(total.cartIntents, total.pageViews)}</div><div className="mt-1 text-xs text-white/40">Direct native Shopify cart links</div></div>
            <div className="rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] p-4"><div className="text-xs uppercase tracking-[0.12em] text-emerald-100/60">Tracked paid revenue</div><div className="mt-2 text-3xl font-bold text-emerald-200">{money(total.revenueCents)}</div><div className="mt-1 text-xs text-emerald-100/50">{total.purchases} correlated purchase{total.purchases === 1 ? "" : "s"}</div></div>
          </div>

          {isLoading ? <div className="py-20 text-center text-white/45">Loading first-party funnel events…</div> : <div className="space-y-5"><VariantPanel label="Control" counts={control} primary={false} /><div className="flex justify-center"><ArrowDown className="h-5 w-5 text-white/25" /></div><VariantPanel label="A — Hero-offer clarity" counts={treatment} primary={true} /></div>}

          <div className="mt-7 rounded-xl border border-sky-300/20 bg-sky-300/[0.055] p-4 text-sm leading-6 text-sky-100/75"><div className="flex gap-2"><ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" /><p><strong>Decision rule:</strong> do not call a winner from early data. Compare A against control after both variants have meaningful volume, using paid purchase rate as the primary outcome and CTA/cart-intent rate as diagnostic signals. The page’s $399 package, native Shopify cart path, and Natalie Jill `bg_ref` remain constant in both variants.</p></div><a href="https://shop.theurbanmonk.com/pages/oral?bg_ref=109Nl4h0Ds" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sky-200 hover:text-white">Open live page <ExternalLink className="h-3.5 w-3.5" /></a></div>
        </div>
      </main>
    </DashboardLayout>
  );
}
