import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ClipboardCheck, FlaskConical, LockKeyhole, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const REQUIRED_FIXED_VARIABLES = ["Audience strategy", "Offer", "Destination URL", "Optimization event", "Placement mix", "Attribution view"];
const NEW_TEST = {
  title: "",
  offer: "Interconnected education",
  destinationUrl: "",
  audienceDescription: "",
  objective: "Confirmed downstream conversion quality",
  primaryMetric: "Confirmed purchase rate",
  fixedVariables: REQUIRED_FIXED_VARIABLES,
  maxTestSpendCents: null as number | null,
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function PolicyBadge({ status }: { status: string }) {
  const palette = status === "reviewed" ? "bg-emerald-100 text-emerald-800" : status === "needs_revision" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette}`}>{statusLabel(status)}</span>;
}

export function SignalLabWorkspace() {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState(NEW_TEST);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [clusterDraft, setClusterDraft] = useState({ label: "", hypothesis: "", headline: "", primaryText: "", description: "", cta: "Learn more", creativeReference: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [resultDraft, setResultDraft] = useState({ resultDate: new Date().toISOString().slice(0, 10), dataCoverage: "partial" as "not_connected" | "partial" | "complete", impressions: 0, outboundClicks: 0, landingPageViews: 0, leads: 0, qualifiedLeads: 0, checkouts: 0, purchases: 0, spendCents: 0, revenueCents: 0, sourceNote: "" });
  const [decisionDraft, setDecisionDraft] = useState({ decision: "hold" as "hold" | "refine" | "prepare_manual_test" | "not_selected", rationale: "", nextStep: "" });

  const tests = trpc.signalLab.listTests.useQuery({ status: "all" });
  const detail = trpc.signalLab.getTest.useQuery({ testId: selectedId ?? 0 }, { enabled: selectedId !== null });
  const selected = detail.data;

  const refresh = async () => {
    await utils.signalLab.listTests.invalidate();
    if (selectedId) await utils.signalLab.getTest.invalidate({ testId: selectedId });
  };

  const createTest = trpc.signalLab.createTest.useMutation({
    onSuccess: async ({ id }) => {
      toast.success("Review-only Signal Lab brief saved.");
      setDraft(NEW_TEST);
      setSelectedId(id);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const addCluster = trpc.signalLab.addCluster.useMutation({
    onSuccess: async () => { toast.success("Message cluster added for review."); setClusterDraft({ label: "", hypothesis: "", headline: "", primaryText: "", description: "", cta: "Learn more", creativeReference: "" }); await refresh(); },
    onError: error => toast.error(error.message),
  });
  const submitReview = trpc.signalLab.submitForPolicyReview.useMutation({ onSuccess: async () => { toast.success("Brief is queued for manual policy review."); await refresh(); }, onError: error => toast.error(error.message) });
  const reviewCluster = trpc.signalLab.reviewCluster.useMutation({ onSuccess: async () => { toast.success("Policy review recorded."); await refresh(); }, onError: error => toast.error(error.message) });
  const approve = trpc.signalLab.approveForManualSetup.useMutation({ onSuccess: async () => { toast.success("Internal brief approved for manual setup. No Meta action was taken."); await refresh(); }, onError: error => toast.error(error.message) });
  const addResult = trpc.signalLab.recordAggregateResult.useMutation({ onSuccess: async () => { toast.success("Aggregate result recorded. No Meta action was taken."); await refresh(); }, onError: error => toast.error(error.message) });
  const recordDecision = trpc.signalLab.recordDecision.useMutation({ onSuccess: async () => { toast.success("Human decision memo recorded."); setDecisionDraft({ decision: "hold", rationale: "", nextStep: "" }); await refresh(); }, onError: error => toast.error(error.message) });

  const totals = useMemo(() => {
    const rows = selected?.results ?? [];
    return rows.reduce((sum, row) => ({ spendCents: sum.spendCents + row.spendCents, leads: sum.leads + row.leads, qualifiedLeads: sum.qualifiedLeads + row.qualifiedLeads, checkouts: sum.checkouts + row.checkouts, purchases: sum.purchases + row.purchases, revenueCents: sum.revenueCents + row.revenueCents }), { spendCents: 0, leads: 0, qualifiedLeads: 0, checkouts: 0, purchases: 0, revenueCents: 0 });
  }, [selected?.results]);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 border border-violet-200 bg-violet-50 p-4">
        <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
        <div>
          <p className="font-semibold text-violet-950">Review-only Signal Lab</p>
          <p className="mt-1 text-sm leading-6 text-violet-900">This workspace stores test briefs and aggregate scorecards only. It cannot create, edit, pause, activate, or budget a Meta campaign; manage an audience; upload customer data; or connect Honest Signals.</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.65fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4 text-violet-700" /> New test brief</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Test title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} />
            <Input placeholder="Offer" value={draft.offer} onChange={event => setDraft({ ...draft, offer: event.target.value })} />
            <Input placeholder="Live destination URL" value={draft.destinationUrl} onChange={event => setDraft({ ...draft, destinationUrl: event.target.value })} />
            <Textarea placeholder="Audience strategy in neutral, non-sensitive language" value={draft.audienceDescription} onChange={event => setDraft({ ...draft, audienceDescription: event.target.value })} />
            <Input placeholder="Objective" value={draft.objective} onChange={event => setDraft({ ...draft, objective: event.target.value })} />
            <Input placeholder="Primary metric" value={draft.primaryMetric} onChange={event => setDraft({ ...draft, primaryMetric: event.target.value })} />
            <Input type="number" min="0" placeholder="Maximum test exposure (USD, optional)" value={draft.maxTestSpendCents === null ? "" : (draft.maxTestSpendCents / 100).toString()} onChange={event => setDraft({ ...draft, maxTestSpendCents: event.target.value ? Math.round(Number(event.target.value) * 100) : null })} />
            <div className="border-t pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variables held constant</p>
              <div className="mt-2 space-y-1.5">
                {REQUIRED_FIXED_VARIABLES.map(variable => (
                  <label key={variable} className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={draft.fixedVariables.includes(variable)} onChange={() => setDraft(current => ({ ...current, fixedVariables: current.fixedVariables.includes(variable) ? current.fixedVariables.filter(value => value !== variable) : [...current.fixedVariables, variable] }))} />{variable}</label>
                ))}
              </div>
            </div>
            <Button className="w-full gap-2" disabled={createTest.isPending} onClick={() => createTest.mutate(draft)}><Plus className="h-4 w-4" />{createTest.isPending ? "Saving brief…" : "Save review-only brief"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Test queue</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {tests.isLoading ? <p className="text-sm text-muted-foreground">Loading Signal Lab briefs…</p> : (tests.data?.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No brief yet. Create a review-only test plan before drafting message clusters.</p> : tests.data?.map(test => (
                <button key={test.id} onClick={() => setSelectedId(test.id)} className={`w-full border p-3 text-left ${selectedId === test.id ? "border-violet-400 bg-violet-50" : "border-border hover:bg-muted/40"}`}>
                  <div className="flex items-center justify-between gap-3"><span className="font-medium">{test.title}</span><PolicyBadge status={test.policyStatus} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{test.offer} · {statusLabel(test.status)} · {test.primaryMetric}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {!selected ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Select a test brief to add message clusters, record aggregate results, and prepare a human decision memo.</CardContent></Card> : (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center justify-between gap-3 text-base"><span>{selected.title}</span><PolicyBadge status={selected.status} /></CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Primary metric</p><p className="font-medium">{selected.primaryMetric}</p></div><div><p className="text-xs text-muted-foreground">Maximum exposure</p><p className="font-medium">{selected.maxTestSpendCents === null ? "Not set" : money(selected.maxTestSpendCents)}</p></div></div>
                  <p><span className="text-muted-foreground">Audience strategy:</span> {selected.audienceDescription}</p>
                  <p className="text-xs leading-5 text-muted-foreground">Fixed: {selected.fixedVariables.join(" · ")}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Message clusters — {selected.clusters.length}/7</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {selected.clusters.map(cluster => <div key={cluster.id} className="border border-border p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{cluster.label}</p><p className="mt-1 text-xs text-muted-foreground">{cluster.hypothesis}</p></div><PolicyBadge status={cluster.policyStatus} /></div><p className="mt-3 text-sm font-medium">{cluster.headline}</p><p className="mt-1 text-sm text-muted-foreground">{cluster.primaryText}</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><Input placeholder="Policy review note" value={reviewNotes[cluster.id] ?? ""} onChange={event => setReviewNotes({ ...reviewNotes, [cluster.id]: event.target.value })} /><Button size="sm" variant="outline" disabled={reviewCluster.isPending} onClick={() => reviewCluster.mutate({ clusterId: cluster.id, policyStatus: "needs_revision", policyNotes: reviewNotes[cluster.id] ?? "Needs revision" })}>Needs revision</Button><Button size="sm" disabled={reviewCluster.isPending} onClick={() => reviewCluster.mutate({ clusterId: cluster.id, policyStatus: "reviewed", policyNotes: reviewNotes[cluster.id] ?? "Reviewed for benefit-led language, substantiation, and landing-page consistency." })}>Mark reviewed</Button></div></div>)}
                  {selected.status !== "owner_approved_for_manual_setup" && selected.clusters.length < 7 && <div className="grid gap-2 border-t pt-4"><Input placeholder="Cluster label" value={clusterDraft.label} onChange={event => setClusterDraft({ ...clusterDraft, label: event.target.value })} /><Textarea placeholder="Hypothesis" value={clusterDraft.hypothesis} onChange={event => setClusterDraft({ ...clusterDraft, hypothesis: event.target.value })} /><Input placeholder="Headline" value={clusterDraft.headline} onChange={event => setClusterDraft({ ...clusterDraft, headline: event.target.value })} /><Textarea placeholder="Primary text" value={clusterDraft.primaryText} onChange={event => setClusterDraft({ ...clusterDraft, primaryText: event.target.value })} /><Input placeholder="CTA" value={clusterDraft.cta} onChange={event => setClusterDraft({ ...clusterDraft, cta: event.target.value })} /><Input placeholder="Creative reference URL (optional)" value={clusterDraft.creativeReference} onChange={event => setClusterDraft({ ...clusterDraft, creativeReference: event.target.value })} /><Button variant="outline" disabled={addCluster.isPending} onClick={() => addCluster.mutate({ testId: selected.id, cluster: { ...clusterDraft, description: null, creativeReference: clusterDraft.creativeReference || null } })}>Add message cluster</Button></div>}
                  {selected.status === "draft" && <Button className="w-full" variant="outline" disabled={submitReview.isPending} onClick={() => submitReview.mutate({ testId: selected.id })}>Submit the internal brief for policy review</Button>}
                  {selected.status === "ready_for_owner_review" && <Button className="w-full gap-2 bg-emerald-700 text-white hover:bg-emerald-800" disabled={approve.isPending} onClick={() => approve.mutate({ testId: selected.id, ownerApprovalNote: "Approved for a separate human/manual Meta setup review. No external ad action is authorized by this record." })}><ShieldCheck className="h-4 w-4" />Approve internal brief for manual setup</Button>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Aggregate scorecard</CardTitle></CardHeader>
                <CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Spend</p><p className="font-semibold">{money(totals.spendCents)}</p></div><div><p className="text-xs text-muted-foreground">Leads</p><p className="font-semibold">{totals.leads.toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Qualified leads</p><p className="font-semibold">{totals.qualifiedLeads.toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Checkouts</p><p className="font-semibold">{totals.checkouts.toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Purchases</p><p className="font-semibold">{totals.purchases.toLocaleString()}</p></div><div><p className="text-xs text-muted-foreground">Revenue</p><p className="font-semibold">{money(totals.revenueCents)}</p></div></div>
                  {selected.clusters.length > 0 && <div className="grid gap-2 border-t pt-4"><Select value={resultDraft.dataCoverage} onValueChange={value => setResultDraft({ ...resultDraft, dataCoverage: value as typeof resultDraft.dataCoverage })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_connected">Not connected</SelectItem><SelectItem value="partial">Partial coverage</SelectItem><SelectItem value="complete">Complete coverage</SelectItem></SelectContent></Select><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["impressions", "outboundClicks", "landingPageViews", "leads", "qualifiedLeads", "checkouts", "purchases", "spendCents", "revenueCents"] as const).map(key => <Input key={key} type="number" min="0" value={resultDraft[key]} placeholder={key} onChange={event => setResultDraft({ ...resultDraft, [key]: Math.max(0, Number(event.target.value)) })} />)}</div><Textarea placeholder="Aggregate source and coverage note" value={resultDraft.sourceNote} onChange={event => setResultDraft({ ...resultDraft, sourceNote: event.target.value })} /><Select onValueChange={value => { const cluster = selected.clusters.find(item => item.id === Number(value)); if (cluster) addResult.mutate({ clusterId: cluster.id, ...resultDraft, sourceNote: resultDraft.sourceNote || null }); }}><SelectTrigger><SelectValue placeholder="Record this aggregate row for a reviewed cluster" /></SelectTrigger><SelectContent>{selected.clusters.map(cluster => <SelectItem key={cluster.id} value={String(cluster.id)}>{cluster.label}</SelectItem>)}</SelectContent></Select></div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-violet-700" /> Human decision memo</CardTitle></CardHeader>
                <CardContent className="space-y-3"><Select value={decisionDraft.decision} onValueChange={value => setDecisionDraft({ ...decisionDraft, decision: value as typeof decisionDraft.decision })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hold">Hold</SelectItem><SelectItem value="refine">Refine</SelectItem><SelectItem value="prepare_manual_test">Prepare manual test</SelectItem><SelectItem value="not_selected">Not selected</SelectItem></SelectContent></Select><Textarea placeholder="Decision rationale" value={decisionDraft.rationale} onChange={event => setDecisionDraft({ ...decisionDraft, rationale: event.target.value })} /><Textarea placeholder="Controlled next step — no external action is performed" value={decisionDraft.nextStep} onChange={event => setDecisionDraft({ ...decisionDraft, nextStep: event.target.value })} /><Button variant="outline" disabled={recordDecision.isPending} onClick={() => recordDecision.mutate({ testId: selected.id, ...decisionDraft })}><CheckCircle2 className="mr-2 h-4 w-4" />Record human decision</Button>
                  {selected.decisions.length > 0 && <div className="space-y-2 border-t pt-3">{selected.decisions.map(decision => <div key={decision.id} className="text-sm"><p className="font-medium">{statusLabel(decision.decision)}</p><p className="text-muted-foreground">{decision.rationale}</p></div>)}</div>}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
