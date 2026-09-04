import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ClipboardList, FlaskConical, Loader2, LockKeyhole, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const TIME_ZONE = "America/Chicago";
function centralDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function daysAgo(days: number) { return centralDate(new Date(Date.now() - days * 86_400_000)); }
function dollars(cents: number) { return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

type DraftArm = { armId: "p49" | "p67" | "p99"; offerId: string; checkoutUrl: string };

export default function AgoraPriceTestTracker() {
  const utils = trpc.useUtils();
  const [startDate, setStartDate] = useState(() => daysAgo(13));
  const [endDate, setEndDate] = useState(() => centralDate());
  const tracker = trpc.agoraPriceTestTracking.getTracker.useQuery(undefined, { staleTime: 60_000 });
  const results = trpc.agoraPriceTestTracking.getResults.useQuery({ startDate, endDate }, { enabled: Boolean(tracker.data?.initialized), staleTime: 120_000 });
  const initialize = trpc.agoraPriceTestTracking.initializeDraftTracker.useMutation({
    onSuccess: () => { void utils.agoraPriceTestTracking.getTracker.invalidate(); void utils.agoraPriceTestTracking.getResults.invalidate(); toast.success("Draft tracker initialized. No traffic or external settings changed."); },
    onError: (error) => toast.error(error.message),
  });
  const saveMappings = trpc.agoraPriceTestTracking.saveDraftMappings.useMutation({
    onSuccess: () => { void utils.agoraPriceTestTracking.getTracker.invalidate(); void utils.agoraPriceTestTracking.getResults.invalidate(); toast.success("Draft mapping saved. The split remains inactive."); },
    onError: (error) => toast.error(error.message),
  });
  const [draftArms, setDraftArms] = useState<DraftArm[]>([]);
  const [ocusOfferId, setOcusOfferId] = useState("2151333044");
  const [p49Parity, setP49Parity] = useState(false);
  const [p99Parity, setP99Parity] = useState(false);

  useEffect(() => {
    if (!tracker.data) return;
    setDraftArms(tracker.data.arms.map((arm) => ({ armId: arm.armId, offerId: arm.offerId ?? "", checkoutUrl: arm.checkoutUrl ?? "" })));
    setOcusOfferId(tracker.data.ocusOfferId);
    setP49Parity(tracker.data.ocusParity.p49);
    setP99Parity(tracker.data.ocusParity.p99);
  }, [tracker.data]);

  const trackerData = tracker.data;
  const resultData = results.data?.results;
  const mappingsComplete = useMemo(() => draftArms.length === 3 && draftArms.every((arm) => arm.offerId.trim() && arm.checkoutUrl.trim()), [draftArms]);
  const updateArm = (armId: DraftArm["armId"], key: "offerId" | "checkoutUrl", value: string) => {
    setDraftArms((current) => current.map((arm) => arm.armId === armId ? { ...arm, [key]: value } : arm));
  };

  if (tracker.isLoading) return <DashboardLayout><div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;

  return <DashboardLayout><div className="p-6 max-w-7xl mx-auto space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex items-center gap-2"><FlaskConical className="h-6 w-6 text-emerald-600" /><h1 className="text-2xl font-bold">Agora Entry-Price Test Tracker</h1></div>
        <p className="text-sm text-muted-foreground mt-1">Internal Kajabi cohort tracking for $49 / $67 / $99. Revenue is exact-offer Kajabi data; Meta is not a revenue source.</p>
      </div>
      <Badge variant="outline" className="w-fit gap-1.5 border-amber-300 bg-amber-50 text-amber-900"><LockKeyhole className="h-3.5 w-3.5" />Draft-only — no visitor routing</Badge>
    </header>

    <Card className="border-amber-300 bg-amber-50/60">
      <CardContent className="p-4 flex gap-3 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-amber-700" /><div><strong>Safety boundary.</strong> This page only stores internal Offer mappings and reads aggregate Kajabi transactions. It cannot publish an Offer, activate a split, share a checkout, change a landing page, alter Klaviyo/SMS, or modify Meta.</div></CardContent>
    </Card>

    {!trackerData?.initialized ? <Card className="border-dashed border-emerald-400"><CardHeader><CardTitle>Initialize the internal draft tracker</CardTitle><CardDescription>Creates a Content Hub-only draft record and three internal arms. It does not create any Kajabi Offer or traffic rule.</CardDescription></CardHeader><CardContent><Button onClick={() => initialize.mutate()} disabled={initialize.isPending}><ClipboardList className="h-4 w-4 mr-2" />{initialize.isPending ? "Initializing…" : "Initialize Draft Tracker"}</Button></CardContent></Card> : <>
      <Card>
        <CardHeader><CardTitle>Manual Kajabi mapping</CardTitle><CardDescription>After the VA creates the two draft Offers, enter the exact Offer IDs and recorded checkout URLs here. Saving this data does not activate traffic.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Arm</th><th className="p-2">Exact Kajabi Offer ID</th><th className="p-2">Recorded checkout URL</th><th className="p-2">State</th></tr></thead><tbody>{trackerData.arms.map((arm) => { const draft = draftArms.find((item) => item.armId === arm.armId); return <tr key={arm.armId} className="border-b"><td className="p-2 font-medium">{arm.label}<div className="text-xs text-muted-foreground">{dollars(arm.priceCents)}</div></td><td className="p-2"><input className="w-full min-w-[160px] rounded-md border bg-background px-2 py-1.5" value={draft?.offerId ?? ""} onChange={(event) => updateArm(arm.armId, "offerId", event.target.value)} aria-label={`${arm.label} Offer ID`} /></td><td className="p-2"><input className="w-full min-w-[260px] rounded-md border bg-background px-2 py-1.5" value={draft?.checkoutUrl ?? ""} onChange={(event) => updateArm(arm.armId, "checkoutUrl", event.target.value)} aria-label={`${arm.label} checkout URL`} /></td><td className="p-2"><Badge variant="outline">{arm.isControl ? "Control" : "Draft treatment"}</Badge></td></tr>; })}</tbody></table></div>
          <div className="grid gap-3 md:grid-cols-3"><label className="text-sm font-medium">Shared $199 OCUS Offer ID<input className="mt-1 w-full rounded-md border bg-background px-2 py-1.5" value={ocusOfferId} onChange={(event) => setOcusOfferId(event.target.value)} /></label><label className="flex gap-2 rounded-md border p-3 text-sm"><input type="checkbox" checked={p49Parity} onChange={(event) => setP49Parity(event.target.checked)} /><span><strong>$49 parity verified</strong><br/><span className="text-xs text-muted-foreground">Same $199 upsell, price, sequence, and eligibility as control</span></span></label><label className="flex gap-2 rounded-md border p-3 text-sm"><input type="checkbox" checked={p99Parity} onChange={(event) => setP99Parity(event.target.checked)} /><span><strong>$99 parity verified</strong><br/><span className="text-xs text-muted-foreground">Same $199 upsell, price, sequence, and eligibility as control</span></span></label></div>
          <Button onClick={() => saveMappings.mutate({ arms: draftArms.map((arm) => ({ armId: arm.armId, offerId: arm.offerId.trim() || null, checkoutUrl: arm.checkoutUrl.trim() || null })), ocusOfferId: ocusOfferId.trim(), ocusParityP49Verified: p49Parity, ocusParityP99Verified: p99Parity })} disabled={saveMappings.isPending || !mappingsComplete}><Save className="h-4 w-4 mr-2" />{saveMappings.isPending ? "Saving…" : "Save Draft Mapping"}</Button>
          {!mappingsComplete && <p className="text-xs text-muted-foreground">Save is available after all three exact Offer IDs and recorded checkout URLs are entered. This does not make the test live.</p>}
        </CardContent>
      </Card>

      <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>Exact-offer Kajabi results</CardTitle><CardDescription>Aggregate transaction data by America/Chicago date. Shared $199 OCUS is deliberately not assigned to an entry-price arm until a separately approved live cohort link exists.</CardDescription></div><Button size="sm" variant="outline" onClick={() => void results.refetch()} disabled={results.isFetching}><RefreshCw className={`h-4 w-4 mr-2 ${results.isFetching ? "animate-spin" : ""}`} />Refresh</Button></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-3 items-end"><label className="text-sm">Start<input type="date" className="mt-1 block rounded-md border bg-background px-2 py-1.5" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="text-sm">End<input type="date" className="mt-1 block rounded-md border bg-background px-2 py-1.5" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label><span className="text-xs text-muted-foreground pb-2">Central time</span></div>{!resultData ? <div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Complete the exact Offer ID mapping above before the tracker reads Kajabi results. This protects against amount-only attribution and keeps the draft test inactive.</div> : <><div className="grid gap-3 md:grid-cols-3">{resultData.arms.map((arm) => <Card key={arm.armId} className={arm.isControl ? "border-emerald-400" : ""}><CardContent className="p-4"><div className="flex justify-between gap-2"><p className="font-semibold">{arm.label}</p><Badge variant="outline">{arm.isControl ? "Control" : "Treatment"}</Badge></div><p className="mt-3 text-2xl font-bold">{dollars(arm.clearedRevenueCents)}</p><p className="text-xs text-muted-foreground">{arm.clearedPurchases} cleared base purchases</p><p className="mt-2 text-xs text-muted-foreground">{arm.excludedRefundRows} refunded/failed rows excluded</p></CardContent></Card>)}</div><Card className="border-amber-300 bg-amber-50/50"><CardContent className="p-4"><p className="font-semibold">Shared $199 OCUS — reported separately</p><p className="mt-1 text-xl font-bold">{dollars(resultData.sharedOcus.clearedRevenueCents)} <span className="text-sm font-normal text-muted-foreground">· {resultData.sharedOcus.clearedPurchases} cleared purchases</span></p><p className="text-xs text-muted-foreground mt-1">Not assigned to a base price arm until a separately approved live cohort-linking implementation is in place. {resultData.sharedOcus.excludedRefundRows} refunded/failed rows excluded.</p></CardContent></Card></>}</CardContent></Card>

      <Card className="border-red-200"><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" />Activation blockers</CardTitle><CardDescription>These checks document readiness only. This page cannot remove them or activate the test.</CardDescription></CardHeader><CardContent>{trackerData.blockers.length ? <ul className="space-y-2 text-sm">{trackerData.blockers.map((blocker) => <li key={blocker} className="flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />{blocker}</li>)}</ul> : <p className="flex gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />Internal mapping complete. Separate owner approval is still required before any activation.</p>}</CardContent></Card>
    </>}
  </div></DashboardLayout>;
}
