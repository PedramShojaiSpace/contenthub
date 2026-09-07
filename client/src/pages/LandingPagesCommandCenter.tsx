import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Globe2,
  LayoutTemplate,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CommandStatus =
  | "brief_draft"
  | "copy_review"
  | "approved_for_framer_draft"
  | "framer_draft"
  | "preview_ready"
  | "qa_passed"
  | "release_requested"
  | "live"
  | "archived"
  | "blocked"
  | "needs_revision"
  | "rolled_back";

type DraftForm = {
  campaignId: string;
  title: string;
  ownerName: string;
  pageType: "lead_magnet" | "webinar" | "offer_page" | "thank_you_offer" | "product_bridge" | "quiz" | "evergreen_resource";
  audienceSource: string;
  audienceDescription: string;
  messageBrief: string;
  claimReferences: string;
  assetReferences: string;
  disclosureText: string;
  checkoutLedger: "none" | "kajabi" | "shopify";
  offerName: string;
  exactOfferId: string;
  displayPriceUsd: string;
  upsellPolicy: string;
  ctaLabel: string;
  ctaDestinationKey: string;
  pageKey: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  seoPolicy: "paid_test_noindex" | "campaign_control_indexable" | "resource_indexable" | "redirect_migration";
  canonicalUrl: string;
  seoTitle: string;
  metaDescription: string;
  framerProjectName: string;
  framerBranchName: string;
  framerTemplateKey: string;
  framerPreviewUrl: string;
  plannedPublicPath: string;
};

const EMPTY_FORM: DraftForm = {
  campaignId: "",
  title: "",
  ownerName: "",
  pageType: "offer_page",
  audienceSource: "",
  audienceDescription: "",
  messageBrief: "",
  claimReferences: "",
  assetReferences: "",
  disclosureText: "",
  checkoutLedger: "none",
  offerName: "",
  exactOfferId: "",
  displayPriceUsd: "",
  upsellPolicy: "",
  ctaLabel: "",
  ctaDestinationKey: "",
  pageKey: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  seoPolicy: "paid_test_noindex",
  canonicalUrl: "",
  seoTitle: "",
  metaDescription: "",
  framerProjectName: "",
  framerBranchName: "",
  framerTemplateKey: "",
  framerPreviewUrl: "",
  plannedPublicPath: "",
};

const STATUS_STYLE: Record<CommandStatus, string> = {
  brief_draft: "border-slate-300 bg-slate-50 text-slate-700",
  copy_review: "border-violet-300 bg-violet-50 text-violet-800",
  approved_for_framer_draft: "border-blue-300 bg-blue-50 text-blue-800",
  framer_draft: "border-blue-300 bg-blue-50 text-blue-800",
  preview_ready: "border-cyan-300 bg-cyan-50 text-cyan-800",
  qa_passed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  release_requested: "border-amber-300 bg-amber-50 text-amber-900",
  live: "border-emerald-400 bg-emerald-50 text-emerald-800",
  archived: "border-slate-300 bg-slate-50 text-slate-600",
  blocked: "border-red-300 bg-red-50 text-red-800",
  needs_revision: "border-orange-300 bg-orange-50 text-orange-800",
  rolled_back: "border-slate-400 bg-slate-100 text-slate-700",
};

function labelize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function toForm(page: any): DraftForm {
  return {
    campaignId: page.campaignId ?? "",
    title: page.title ?? "",
    ownerName: page.ownerName ?? "",
    pageType: page.pageType ?? "offer_page",
    audienceSource: page.audienceSource ?? "",
    audienceDescription: page.audienceDescription ?? "",
    messageBrief: page.messageBrief ?? "",
    claimReferences: page.claimReferences ?? "",
    assetReferences: page.assetReferences ?? "",
    disclosureText: page.disclosureText ?? "",
    checkoutLedger: page.checkoutLedger ?? "none",
    offerName: page.offerName ?? "",
    exactOfferId: page.exactOfferId ?? "",
    displayPriceUsd: page.displayPriceCents == null ? "" : (page.displayPriceCents / 100).toFixed(2),
    upsellPolicy: page.upsellPolicy ?? "",
    ctaLabel: page.ctaLabel ?? "",
    ctaDestinationKey: page.ctaDestinationKey ?? "",
    pageKey: page.pageKey ?? "",
    utmSource: page.utmSource ?? "",
    utmMedium: page.utmMedium ?? "",
    utmCampaign: page.utmCampaign ?? "",
    utmContent: page.utmContent ?? "",
    seoPolicy: page.seoPolicy ?? "paid_test_noindex",
    canonicalUrl: page.canonicalUrl ?? "",
    seoTitle: page.seoTitle ?? "",
    metaDescription: page.metaDescription ?? "",
    framerProjectName: page.framerProjectName ?? "",
    framerBranchName: page.framerBranchName ?? "",
    framerTemplateKey: page.framerTemplateKey ?? "",
    framerPreviewUrl: page.framerPreviewUrl ?? "",
    plannedPublicPath: page.plannedPublicPath ?? "",
  };
}

function StatusBadge({ status }: { status: CommandStatus }) {
  return <Badge variant="outline" className={STATUS_STYLE[status]}>{labelize(status)}</Badge>;
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base">{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">{children}</CardContent>
  </Card>;
}

export default function LandingPagesCommandCenter() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.landingPageCommand.list.useQuery(undefined, { staleTime: 30_000 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"registry" | "new" | "detail">("registry");
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [qa, setQa] = useState({
    qaClaimsApproved: false,
    qaAssetsApproved: false,
    qaSeoApproved: false,
    qaCtaApproved: false,
    qaTrackingApproved: false,
    qaNotes: "",
  });
  const detail = trpc.landingPageCommand.get.useQuery({ id: selectedId ?? 0 }, { enabled: selectedId !== null, staleTime: 15_000 });
  const create = trpc.landingPageCommand.create.useMutation({
    onSuccess: ({ id }) => {
      toast.success("Internal campaign-page brief created. Nothing was sent to Framer.");
      void utils.landingPageCommand.list.invalidate();
      setSelectedId(id);
      setMode("detail");
    },
    onError: error => toast.error(error.message),
  });
  const updateBrief = trpc.landingPageCommand.updateBrief.useMutation({
    onSuccess: () => {
      toast.success("Brief saved. No external page or destination changed.");
      void utils.landingPageCommand.get.invalidate();
      void utils.landingPageCommand.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const saveQa = trpc.landingPageCommand.saveQa.useMutation({
    onSuccess: () => {
      toast.success("QA status saved. The record remains internal-only.");
      void utils.landingPageCommand.get.invalidate();
      void utils.landingPageCommand.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const requestRelease = trpc.landingPageCommand.requestRelease.useMutation({
    onSuccess: () => {
      toast.success("Release request recorded. No Framer publish action was performed.");
      void utils.landingPageCommand.get.invalidate();
      void utils.landingPageCommand.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const cancelRelease = trpc.landingPageCommand.cancelReleaseRequest.useMutation({
    onSuccess: () => {
      toast.success("Release request cancelled. No external system was contacted.");
      void utils.landingPageCommand.get.invalidate();
      void utils.landingPageCommand.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (!detail.data?.page) return;
    setForm(toForm(detail.data.page));
    setQa({
      qaClaimsApproved: detail.data.page.qaClaimsApproved,
      qaAssetsApproved: detail.data.page.qaAssetsApproved,
      qaSeoApproved: detail.data.page.qaSeoApproved,
      qaCtaApproved: detail.data.page.qaCtaApproved,
      qaTrackingApproved: detail.data.page.qaTrackingApproved,
      qaNotes: detail.data.page.qaNotes ?? "",
    });
  }, [detail.data?.page]);

  const priceCents = useMemo(() => {
    if (!form.displayPriceUsd.trim()) return null;
    const numeric = Number(form.displayPriceUsd);
    return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : null;
  }, [form.displayPriceUsd]);

  const payload = useMemo(() => ({
    ...form,
    ownerName: form.ownerName || null,
    audienceSource: form.audienceSource || null,
    audienceDescription: form.audienceDescription || null,
    messageBrief: form.messageBrief || null,
    claimReferences: form.claimReferences || null,
    assetReferences: form.assetReferences || null,
    disclosureText: form.disclosureText || null,
    offerName: form.offerName || null,
    exactOfferId: form.exactOfferId || null,
    displayPriceCents: priceCents,
    upsellPolicy: form.upsellPolicy || null,
    ctaLabel: form.ctaLabel || null,
    ctaDestinationKey: form.ctaDestinationKey || null,
    pageKey: form.pageKey || null,
    utmSource: form.utmSource || null,
    utmMedium: form.utmMedium || null,
    utmCampaign: form.utmCampaign || null,
    utmContent: form.utmContent || null,
    canonicalUrl: form.canonicalUrl || null,
    seoTitle: form.seoTitle || null,
    metaDescription: form.metaDescription || null,
    framerProjectName: form.framerProjectName || null,
    framerBranchName: form.framerBranchName || null,
    framerTemplateKey: form.framerTemplateKey || null,
    framerPreviewUrl: form.framerPreviewUrl || null,
    plannedPublicPath: form.plannedPublicPath || null,
  }), [form, priceCents]);

  const setField = <Key extends keyof DraftForm>(key: Key, value: DraftForm[Key]) => setForm(current => ({ ...current, [key]: value }));
  const openNew = () => { setSelectedId(null); setForm(EMPTY_FORM); setQa({ qaClaimsApproved: false, qaAssetsApproved: false, qaSeoApproved: false, qaCtaApproved: false, qaTrackingApproved: false, qaNotes: "" }); setMode("new"); };
  const openDetail = (id: number) => { setSelectedId(id); setMode("detail"); };
  const saveNew = () => {
    if (!form.campaignId || !form.title) return toast.error("Campaign ID and internal page title are required.");
    create.mutate(payload);
  };
  const saveExisting = () => {
    if (selectedId === null) return;
    if (!form.campaignId || !form.title) return toast.error("Campaign ID and internal page title are required.");
    updateBrief.mutate({ id: selectedId, ...payload });
  };

  const pages = list.data ?? [];
  const counts = useMemo(() => ({
    total: pages.length,
    qa: pages.filter(page => page.status === "qa_passed").length,
    release: pages.filter(page => page.status === "release_requested").length,
  }), [pages]);
  const isOwner = user?.role === "admin";

  if (list.isLoading) return <DashboardLayout><div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;

  return <DashboardLayout><div className="mx-auto max-w-7xl space-y-6 p-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2"><LayoutTemplate className="h-6 w-6 text-primary" /><h1 className="text-2xl font-bold tracking-tight">Landing Pages Command Center</h1></div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">One protected operating record for every future Framer-hosted campaign page: brief, approved assets and claims, SEO/CTA/UTM mapping, QA, and a release request.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1.5 border-amber-300 bg-amber-50 text-amber-900"><LockKeyhole className="h-3.5 w-3.5" />Phase 1 — Internal only</Badge>
        {mode !== "registry" && <Button variant="outline" onClick={() => setMode("registry")}><ArrowLeft className="mr-2 h-4 w-4" />Registry</Button>}
        {mode === "registry" && <Button onClick={openNew}><FilePlus2 className="mr-2 h-4 w-4" />New campaign page</Button>}
      </div>
    </header>

    <Card className="border-amber-300 bg-amber-50/60"><CardContent className="flex gap-3 p-4 text-sm"><ShieldCheck className="h-5 w-5 shrink-0 text-amber-700" /><div><strong>What this does today.</strong> It stores the approved campaign brief and release readiness inside the Content Hub. It cannot connect to Framer, create an external page, publish a page, expose a checkout, or change Meta, Klaviyo, SMS, or traffic.</div></CardContent></Card>

    {mode === "registry" && <>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Campaign page records</p><p className="mt-2 text-3xl font-semibold">{counts.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">QA passed</p><p className="mt-2 text-3xl font-semibold text-emerald-700">{counts.qa}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Release requests</p><p className="mt-2 text-3xl font-semibold text-amber-700">{counts.release}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Campaign page registry</CardTitle><CardDescription>Internal records only. A release request is documentation for Phase 2, not an external publish action.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void list.refetch()} disabled={list.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${list.isFetching ? "animate-spin" : ""}`} />Refresh</Button></CardHeader>
        <CardContent>{pages.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center"><Globe2 className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">No campaign pages have been registered.</p><p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">Create the first internal brief. It will remain a Content Hub record until a later, separately approved Framer draft bridge is built.</p><Button className="mt-4" onClick={openNew}><FilePlus2 className="mr-2 h-4 w-4" />Create internal brief</Button></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="p-3">Campaign page</th><th className="p-3">Audience / ledger</th><th className="p-3">Framer plan</th><th className="p-3">Status</th><th className="p-3">Updated</th><th className="p-3" /></tr></thead><tbody>{pages.map(page => <tr className="border-b" key={page.id}><td className="p-3"><p className="font-medium">{page.title}</p><p className="font-mono text-xs text-muted-foreground">{page.campaignId}</p></td><td className="p-3"><p>{page.audienceSource || "Audience not set"}</p><p className="text-xs text-muted-foreground">{labelize(page.checkoutLedger)}{page.offerName ? ` · ${page.offerName}` : ""}</p></td><td className="p-3"><p>{page.framerProjectName || "Not planned"}</p><p className="text-xs text-muted-foreground">{page.framerTemplateKey || "Template not set"}</p></td><td className="p-3"><StatusBadge status={page.status as CommandStatus} /></td><td className="p-3 text-xs text-muted-foreground">{new Date(page.updatedAt).toLocaleString()}</td><td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => openDetail(page.id)}>Open</Button></td></tr>)}</tbody></table></div>}</CardContent>
      </Card>
    </>}

    {mode === "new" && <BriefEditor form={form} setField={setField} onSave={saveNew} saving={create.isPending} onCancel={() => setMode("registry")} title="New campaign page brief" saveLabel="Create internal brief" />}

    {mode === "detail" && <>
      {detail.isLoading || !detail.data ? <Card><CardContent className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading campaign page record…</CardContent></Card> : <>
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-5 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">{detail.data.page.title}</h2><StatusBadge status={detail.data.page.status as CommandStatus} /></div><p className="mt-1 font-mono text-xs text-muted-foreground">{detail.data.page.campaignId}</p></div><div className="text-sm text-muted-foreground">Created by {detail.data.page.createdByName || "Content Hub user"}</div></div>
        <BriefEditor form={form} setField={setField} onSave={saveExisting} saving={updateBrief.isPending} onCancel={() => setMode("registry")} title="Campaign brief and Framer handoff plan" saveLabel="Save brief" />
        <Section title="QA and release-request record" description="All five checks must be approved before an owner can record a Phase 1 release request. That request does not publish to Framer.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{([
            ["qaClaimsApproved", "Claims & disclosures"],
            ["qaAssetsApproved", "Assets"],
            ["qaSeoApproved", "SEO & canonical"],
            ["qaCtaApproved", "CTA mapping"],
            ["qaTrackingApproved", "Tracking & attribution"],
          ] as const).map(([key, label]) => <label className="flex gap-2 rounded-lg border p-3 text-sm" key={key}><input type="checkbox" checked={qa[key]} onChange={event => setQa(current => ({ ...current, [key]: event.target.checked }))} /><span><strong>{label}</strong><br/><span className="text-xs text-muted-foreground">{qa[key] ? "Approved" : "Needs review"}</span></span></label>)}</div>
          <div><Label>QA notes</Label><Textarea className="mt-1" rows={3} value={qa.qaNotes} onChange={event => setQa(current => ({ ...current, qaNotes: event.target.value }))} placeholder="Record outstanding decisions, evidence, or reviewer notes." /></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => saveQa.mutate({ id: selectedId!, ...qa })} disabled={saveQa.isPending}><ClipboardCheck className="mr-2 h-4 w-4" />{saveQa.isPending ? "Saving QA…" : "Save QA"}</Button>{detail.data.page.status === "release_requested" ? <Button variant="destructive" onClick={() => cancelRelease.mutate({ id: selectedId!, note: "Cancelled from the Landing Pages Command Center." })} disabled={!isOwner || cancelRelease.isPending}>Cancel release request</Button> : <Button onClick={() => requestRelease.mutate({ id: selectedId!, note: "Internal release request recorded. Phase 2 still requires separate approval." })} disabled={!isOwner || requestRelease.isPending || detail.data.blockers.length > 0}><Send className="mr-2 h-4 w-4" />{requestRelease.isPending ? "Requesting…" : "Request internal release"}</Button>}</div>
          {!isOwner && <p className="text-xs text-muted-foreground">Only an owner/admin may record or cancel a release request.</p>}
        </Section>
        <Card className={detail.data.blockers.length ? "border-red-200" : "border-emerald-300"}><CardHeader><CardTitle className="flex items-center gap-2">{detail.data.blockers.length ? <AlertTriangle className="h-5 w-5 text-red-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-700" />}Release readiness</CardTitle><CardDescription>These are internal completion checks only. Passing them never creates a page or initiates a Framer deployment.</CardDescription></CardHeader><CardContent>{detail.data.blockers.length ? <ul className="space-y-2 text-sm">{detail.data.blockers.map(blocker => <li className="flex gap-2" key={blocker}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />{blocker}</li>)}</ul> : <p className="flex gap-2 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />All Phase 1 readiness fields are recorded. A separate owner decision is still required before Phase 2 connects any external system.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Audit history</CardTitle><CardDescription>Internal actions are recorded here. No external API activity appears because Phase 1 does not contact Framer.</CardDescription></CardHeader><CardContent>{detail.data.audit.length ? <ol className="space-y-4">{detail.data.audit.map(event => <li className="border-l-2 border-primary/30 pl-4" key={event.id}><p className="font-medium text-sm">{labelize(event.action)}</p><p className="mt-1 text-sm text-muted-foreground">{event.note || "No note recorded."}</p><p className="mt-1 text-xs text-muted-foreground">{event.actorName || event.actorOpenId} · {new Date(event.createdAt).toLocaleString()}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">No audit events recorded.</p>}</CardContent></Card>
      </>}
    </>}
  </div></DashboardLayout>;
}

function BriefEditor({ form, setField, onSave, saving, onCancel, title, saveLabel }: { form: DraftForm; setField: <Key extends keyof DraftForm>(key: Key, value: DraftForm[Key]) => void; onSave: () => void; saving: boolean; onCancel: () => void; title: string; saveLabel: string }) {
  return <div className="space-y-4"><div className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">{title}</h2><p className="text-sm text-muted-foreground">Store an approved plan for a future Framer draft; no external destination is configured by this form.</p></div><div className="flex gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : saveLabel}</Button></div></div>
    <Section title="1. Identity and audience" description="Name the campaign and define the visitor context before any design work begins.">
      <div className="grid gap-4 md:grid-cols-2"><Field label="Campaign ID *"><Input value={form.campaignId} onChange={event => setField("campaignId", event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="e.g. agora-p2-webinar" /></Field><Field label="Internal page title *"><Input value={form.title} onChange={event => setField("title", event.target.value)} placeholder="e.g. Interconnected webinar registration" /></Field><Field label="Page owner"><Input value={form.ownerName} onChange={event => setField("ownerName", event.target.value)} placeholder="Responsible operator" /></Field><Field label="Page type"><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.pageType} onChange={event => setField("pageType", event.target.value as DraftForm["pageType"])}>{["lead_magnet", "webinar", "offer_page", "thank_you_offer", "product_bridge", "quiz", "evergreen_resource"].map(value => <option key={value} value={value}>{labelize(value)}</option>)}</select></Field><Field label="Traffic source"><Input value={form.audienceSource} onChange={event => setField("audienceSource", event.target.value)} placeholder="e.g. Meta paid social" /></Field><Field label="Audience description"><Input value={form.audienceDescription} onChange={event => setField("audienceDescription", event.target.value)} placeholder="Who will arrive and what they know" /></Field></div>
      <Field label="Message brief"><Textarea rows={5} value={form.messageBrief} onChange={event => setField("messageBrief", event.target.value)} placeholder="Core problem, message hierarchy, intended next step, and any non-negotiable language." /></Field>
    </Section>
    <Section title="2. Offer, CTA, and measurement contract" description="Record the intended ledger and destination key. This form stores identifiers only; it does not create or expose a checkout URL.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="Checkout ledger"><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.checkoutLedger} onChange={event => setField("checkoutLedger", event.target.value as DraftForm["checkoutLedger"])}><option value="none">No checkout / informational</option><option value="kajabi">Kajabi</option><option value="shopify">Shopify</option></select></Field><Field label="Offer / product name"><Input value={form.offerName} onChange={event => setField("offerName", event.target.value)} placeholder="Internal offer name" /></Field><Field label="Exact Offer / product ID"><Input value={form.exactOfferId} onChange={event => setField("exactOfferId", event.target.value)} placeholder="Verified ledger ID" /></Field><Field label="Displayed price (USD)"><Input inputMode="decimal" value={form.displayPriceUsd} onChange={event => setField("displayPriceUsd", event.target.value)} placeholder="e.g. 67.00" /></Field><Field label="CTA label"><Input value={form.ctaLabel} onChange={event => setField("ctaLabel", event.target.value)} placeholder="Button copy" /></Field><Field label="Approved CTA destination key"><Input value={form.ctaDestinationKey} onChange={event => setField("ctaDestinationKey", event.target.value)} placeholder="e.g. kajabi_agora_p67" /></Field><Field label="Page key *"><Input value={form.pageKey} onChange={event => setField("pageKey", event.target.value)} placeholder="e.g. agora-p2-webinar-reg" /></Field><Field label="UTM source"><Input value={form.utmSource} onChange={event => setField("utmSource", event.target.value)} placeholder="meta" /></Field><Field label="UTM medium"><Input value={form.utmMedium} onChange={event => setField("utmMedium", event.target.value)} placeholder="paid-social" /></Field><Field label="UTM campaign *"><Input value={form.utmCampaign} onChange={event => setField("utmCampaign", event.target.value)} placeholder="agora-p2" /></Field><Field label="UTM content"><Input value={form.utmContent} onChange={event => setField("utmContent", event.target.value)} placeholder="control" /></Field></div>
      <Field label="Upsell / post-purchase parity policy"><Textarea rows={3} value={form.upsellPolicy} onChange={event => setField("upsellPolicy", event.target.value)} placeholder="Record what must remain identical across eligible test arms." /></Field>
    </Section>
    <Section title="3. Approved evidence, assets, and disclosures" description="Keep claims and proof reviewable. Do not paste unverified testimonials or claim outcomes as fact.">
      <div className="grid gap-4 lg:grid-cols-2"><Field label="Claims / source references"><Textarea rows={6} value={form.claimReferences} onChange={event => setField("claimReferences", event.target.value)} placeholder="Internal source links, approved claim language, and reviewer references." /></Field><Field label="Approved asset references"><Textarea rows={6} value={form.assetReferences} onChange={event => setField("assetReferences", event.target.value)} placeholder="Approved image/video IDs, asset URLs, or media-vault references." /></Field></div><Field label="Required disclosure language"><Textarea rows={4} value={form.disclosureText} onChange={event => setField("disclosureText", event.target.value)} placeholder="Required medical, affiliate, consent, or promotional disclosures." /></Field>
    </Section>
    <Section title="4. SEO and future Framer handoff" description="Set SEO posture now. Framer fields remain planning placeholders until Phase 2 receives separate approval.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><Field label="SEO policy"><select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.seoPolicy} onChange={event => setField("seoPolicy", event.target.value as DraftForm["seoPolicy"])}><option value="paid_test_noindex">Paid test — noindex</option><option value="campaign_control_indexable">Campaign control — indexable</option><option value="resource_indexable">Evergreen resource — indexable</option><option value="redirect_migration">Redirect migration</option></select></Field><Field label="Canonical URL"><Input value={form.canonicalUrl} onChange={event => setField("canonicalUrl", event.target.value)} placeholder="https://…" /></Field><Field label="Planned public path"><Input value={form.plannedPublicPath} onChange={event => setField("plannedPublicPath", event.target.value)} placeholder="/offer/interconnected" /></Field><Field label="SEO title"><Input value={form.seoTitle} onChange={event => setField("seoTitle", event.target.value)} placeholder="Search title" /></Field><Field label="Framer project name"><Input value={form.framerProjectName} onChange={event => setField("framerProjectName", event.target.value)} placeholder="e.g. Urban Monk Growth" /></Field><Field label="Framer template key"><Input value={form.framerTemplateKey} onChange={event => setField("framerTemplateKey", event.target.value)} placeholder="e.g. webinar-v1" /></Field><Field label="Framer branch / staging name"><Input value={form.framerBranchName} onChange={event => setField("framerBranchName", event.target.value)} placeholder="e.g. staging-agora-p2" /></Field><Field label="Framer preview URL (Phase 2 only)"><Input value={form.framerPreviewUrl} onChange={event => setField("framerPreviewUrl", event.target.value)} placeholder="Leave blank until a separate Framer draft exists" /></Field></div>
      <Field label="Meta description"><Textarea rows={2} value={form.metaDescription} onChange={event => setField("metaDescription", event.target.value)} placeholder="Description for approved indexable pages." /></Field>
    </Section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium"><span>{label}</span><div className="mt-1">{children}</div></label>;
}
