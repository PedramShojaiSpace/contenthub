import { useState, useEffect, useRef, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Upload,
  Copy,
  CheckCircle2,
  ExternalLink,
  Zap,
  BarChart2,
  ChevronDown,
  ChevronUp,
  X,
  BookOpen,
  Video,
  FileText,
  Search,
  Database,
  Filter,
  CheckSquare,
  Square,
  Loader2,
  CopyPlus,
  ArrowUpRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Campaign = "lo" | "gut" | "sleep" | "webinar";
type Template = "optin" | "vsl" | "sales";
type Status = "draft" | "published" | "archived";

interface LandingPage {
  id: number;
  campaign: Campaign;
  slug: string;
  template: Template;
  status: Status;
  title: string;
  internalLabel?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  heroImageUrl?: string | null;
  videoEmbedCode?: string | null;
  bodyCopy?: string | null;
  optinHeadline?: string | null;
  optinButtonText?: string | null;
  optinLeadMagnet?: string | null;
  kajabiFormUrl?: string | null;
  thankYouUrl?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaSubtext?: string | null;
  testimonials?: string | null;
  facebookPixelId?: string | null;
  ga4MeasurementId?: string | null;
  customHeadScripts?: string | null;
  accentColor?: string | null;
  viewCount: number;
  optinCount: number;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPAIGN_META: Record<Campaign, { label: string; color: string; bg: string; description: string }> = {
  lo: { label: "Lights On", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", description: "Energy, focus & cellular vitality" },
  gut: { label: "Gut Health", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200", description: "Microbiome, digestion & gut-brain axis" },
  sleep: { label: "Sleep & Recovery", color: "text-blue-600", bg: "bg-blue-50 border-blue-200", description: "Deep sleep, recovery & circadian rhythm" },
  webinar: { label: "Webinar", color: "text-violet-600", bg: "bg-violet-50 border-violet-200", description: "Live & on-demand webinar registration" },
};

const TEMPLATE_META: Record<Template, { label: string; icon: React.ReactNode; description: string }> = {
  optin: { label: "Opt-in Page", icon: <BookOpen className="w-4 h-4" />, description: "Lead magnet capture with email form" },
  vsl: { label: "VSL Page", icon: <Video className="w-4 h-4" />, description: "Video sales letter with CTA below" },
  sales: { label: "Sales Page", icon: <FileText className="w-4 h-4" />, description: "Long-form sales letter with sections" },
};

const CH_DOMAIN = "ch.theurbanmonk.com";

// ── Empty form state ──────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  internalLabel: "",
  campaign: "lo" as Campaign,
  slug: "",
  template: "optin" as Template,
  headline: "",
  subheadline: "",
  heroImageUrl: "",
  videoEmbedCode: "",
  bodyCopy: "",
  optinHeadline: "",
  optinButtonText: "Yes, Send It To Me!",
  optinLeadMagnet: "",
  kajabiFormUrl: "",
  thankYouUrl: "",
  ctaText: "",
  ctaUrl: "",
  ctaSubtext: "",
  facebookPixelId: "1498608757116877",
  ga4MeasurementId: "",
  customHeadScripts: "",
  accentColor: "",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function pageUrl(campaign: Campaign, slug: string): string {
  return `https://${CH_DOMAIN}/${campaign}/${slug}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LandingPageBuilder() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const fromLpId = searchParams.get("fromLpId") ? Number(searchParams.get("fromLpId")) : null;
  const urlCampaign = searchParams.get("campaign") as Campaign | null;
  const urlTemplate = searchParams.get("template") as Template | null;

  const [view, setView] = useState<"list" | "builder" | "preview">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [fromLpPopulated, setFromLpPopulated] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    hero: true,
    optin: true,
    cta: false,
    body: false,
    testimonials: false,
    tracking: false,
    advanced: false,
  });
  const [testimonialInput, setTestimonialInput] = useState({ name: "", title: "", quote: "", avatarUrl: "" });
  type TestimonialItem = {
    name?: string; title?: string; quote: string; avatarUrl?: string;
    authorName?: string; authorTitle?: string; dateLabel?: string; category?: string; dbId?: number;
  };
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [testimonialSearch, setTestimonialSearch] = useState("");
  const [testimonialCategoryFilter, setTestimonialCategoryFilter] = useState<string>("ALL");
  const [testimonialTab, setTestimonialTab] = useState<"pick" | "manual">("pick");
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // ── Clone helper ──────────────────────────────────────────────────────────
  // Pre-fills the builder form with a copy of the source page.
  // The user reviews/adjusts slug & title, then clicks "Create Page" to save.
  function openClone(page: LandingPage) {
    // Copy all fields, clear id, append -copy to slug, reset status to draft
    const newSlug = `${page.slug}-copy`.slice(0, 80);
    setForm({
      title: `${page.title} (Copy)`,
      internalLabel: page.internalLabel || "",
      campaign: page.campaign,
      slug: newSlug,
      template: page.template,
      headline: page.headline || "",
      subheadline: page.subheadline || "",
      heroImageUrl: page.heroImageUrl || "",
      videoEmbedCode: page.videoEmbedCode || "",
      bodyCopy: page.bodyCopy || "",
      optinHeadline: page.optinHeadline || "",
      optinButtonText: page.optinButtonText || "Yes, Send It To Me!",
      optinLeadMagnet: page.optinLeadMagnet || "",
      kajabiFormUrl: page.kajabiFormUrl || "",
      thankYouUrl: page.thankYouUrl || "",
      ctaText: page.ctaText || "",
      ctaUrl: page.ctaUrl || "",
      ctaSubtext: page.ctaSubtext || "",
      facebookPixelId: page.facebookPixelId || "1498608757116877",
      ga4MeasurementId: page.ga4MeasurementId || "",
      customHeadScripts: page.customHeadScripts || "",
      accentColor: page.accentColor || "",
    });
    try {
      setTestimonials(page.testimonials ? JSON.parse(page.testimonials) : []);
    } catch {
      setTestimonials([]);
    }
    setEditingId(null); // new page, not editing existing
    setView("builder");
  }

  // ── Queries & Mutations ───────────────────────────────────────────────────

  const { data: pages = [], refetch } = trpc.hostedLp.list.useQuery();

  const createMutation = trpc.hostedLp.create.useMutation({
    onSuccess: (data) => {
      toast.success("Page created!");
      refetch();
      setEditingId(data.id);
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.hostedLp.update.useMutation({
    onSuccess: () => {
      toast.success("Page saved!");
      refetch();
      setView("list");
    },
    onError: (e) => toast.error(e.message),
  });

  const publishMutation = trpc.hostedLp.publish.useMutation({
    onSuccess: () => { toast.success("Page published! 🎉"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const unpublishMutation = trpc.hostedLp.unpublish.useMutation({
    onSuccess: () => { toast.success("Page unpublished."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.hostedLp.delete.useMutation({
    onSuccess: () => { toast.success("Page deleted."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  const generateCopyMutation = trpc.hostedLp.generateCopy.useMutation({
    onSuccess: (copy) => {
      setForm(f => ({
        ...f,
        headline: copy.headline || f.headline,
        subheadline: copy.subheadline || f.subheadline,
        bodyCopy: copy.bodyCopy || f.bodyCopy,
        optinHeadline: copy.optinHeadline || f.optinHeadline,
        optinButtonText: copy.optinButtonText || f.optinButtonText,
        ctaText: copy.ctaText || f.ctaText,
        ctaSubtext: copy.ctaSubtext || f.ctaSubtext,
      }));
      setShowAiPanel(false);
      setAiPrompt("");
      toast.success("Copy generated! Review and edit as needed.");
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Testimonials DB queries & mutations ─────────────────────────────────
  const dbTestimonialsQuery = trpc.testimonials.list.useQuery({});
  const dbTestimonials = dbTestimonialsQuery.data ?? [];

  const seedMutation = trpc.testimonials.seedLightsOn.useMutation({
    onSuccess: (r) => { toast.success(`Seeded ${r.seeded} Lights On testimonials! ${r.message}`); dbTestimonialsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const importPptxMutation = trpc.testimonials.bulkImportFromPptx.useMutation({
    onSuccess: (r) => { toast.success(`Imported ${r.imported} testimonials from PPTX!`); dbTestimonialsQuery.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const pptxFileRef = useRef<HTMLInputElement>(null);

  function handlePptxUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      importPptxMutation.mutate({ campaign: "lo", pptxBase64: base64 });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Derived: unique categories from DB testimonials
  const dbCategories = useMemo(() => {
    const cats = new Set<string>();
    dbTestimonials.forEach(t => { if (t.category) cats.add(t.category); });
    return ["ALL", ...Array.from(cats).sort()];
  }, [dbTestimonials]);

  // Derived: filtered DB testimonials
  const filteredDbTestimonials = useMemo(() => {
    return dbTestimonials.filter(t => {
      const matchCat = testimonialCategoryFilter === "ALL" || t.category === testimonialCategoryFilter;
      const q = testimonialSearch.toLowerCase();
      const matchSearch = !q ||
        (t.authorName || "").toLowerCase().includes(q) ||
        (t.quote || "").toLowerCase().includes(q) ||
        (t.category || "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [dbTestimonials, testimonialCategoryFilter, testimonialSearch]);

  // Derived: set of dbIds already added
  const addedDbIds = useMemo(() => new Set(testimonials.filter(t => t.dbId).map(t => t.dbId!)), [testimonials]);

  function toggleDbTestimonial(t: typeof dbTestimonials[0]) {
    if (addedDbIds.has(t.id)) {
      setTestimonials(prev => prev.filter(p => p.dbId !== t.id));
    } else {
      setTestimonials(prev => [...prev, {
        quote: t.quote,
        authorName: t.authorName,
        authorTitle: t.authorTitle ?? undefined,
        dateLabel: t.dateLabel ?? undefined,
        category: t.category ?? undefined,
        dbId: t.id,
      }]);
    }
  }

  const previewQuery = trpc.hostedLp.preview.useQuery(
    { id: editingId! },
    { enabled: view === "preview" && editingId !== null }
  );

  // Fetch the source landing page copy when opened with ?fromLpId= (from LandingPageGenerator)
  const fromLpQuery = trpc.landingPages.getForCHBuilder.useQuery(
    { id: fromLpId! },
    { enabled: fromLpId !== null && !fromLpPopulated, retry: 2 }
  );

  useEffect(() => {
    if (previewQuery.data?.html) {
      setPreviewHtml(previewQuery.data.html);
    }
  }, [previewQuery.data]);

  // Auto-populate form from URL params (campaign, template) — runs once on mount
  // Also auto-open builder if fromLpId is present (even before data loads)
  useEffect(() => {
    if (urlCampaign || urlTemplate) {
      setForm(f => ({
        ...f,
        ...(urlCampaign ? { campaign: urlCampaign } : {}),
        ...(urlTemplate ? { template: urlTemplate } : {}),
      }));
    }
    // If navigated here with a fromLpId, open the builder immediately so the user
    // isn't stuck on the list view while the query loads.
    if (fromLpId !== null) {
      setView("builder");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-populate form from fromLpId source page (one-time, from LandingPageGenerator)
  useEffect(() => {
    if (fromLpQuery.data && !fromLpPopulated) {
      const src = fromLpQuery.data;
      // Build a slug from the title
      const autoSlug = src.title
        ? src.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").substring(0, 60)
        : "";
      setForm(f => ({
        ...f,
        title: src.title || f.title,
        // Only set slug if the form doesn't already have one
        slug: f.slug || autoSlug,
        headline: src.headline || f.headline,
        subheadline: src.subheadline || f.subheadline,
        bodyCopy: src.bodyCopy || f.bodyCopy,
        // Use inferred campaign from the offer type unless URL param overrides
        campaign: (urlCampaign ?? src.campaign ?? f.campaign) as Campaign,
        ...(urlTemplate ? { template: urlTemplate } : {}),
      }));
      setFromLpPopulated(true);
      toast.success("Copy imported from Landing Page Generator — review and publish when ready!");
    }
  }, [fromLpQuery.data, fromLpPopulated]);

  // Handle fromLpId query error — show toast and stay in builder
  useEffect(() => {
    if (fromLpQuery.error && !fromLpPopulated && fromLpId !== null) {
      toast.error("Could not load source page copy. You can still fill in the form manually.");
      setFromLpPopulated(true); // prevent re-triggering
    }
  }, [fromLpQuery.error, fromLpPopulated, fromLpId]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setTestimonials([]);
    setEditingId(null);
    setView("builder");
  }

  function openEdit(page: LandingPage) {
    setForm({
      title: page.title || "",
      internalLabel: page.internalLabel || "",
      campaign: page.campaign,
      slug: page.slug,
      template: page.template,
      headline: page.headline || "",
      subheadline: page.subheadline || "",
      heroImageUrl: page.heroImageUrl || "",
      videoEmbedCode: page.videoEmbedCode || "",
      bodyCopy: page.bodyCopy || "",
      optinHeadline: page.optinHeadline || "",
      optinButtonText: page.optinButtonText || "Yes, Send It To Me!",
      optinLeadMagnet: page.optinLeadMagnet || "",
      kajabiFormUrl: page.kajabiFormUrl || "",
      thankYouUrl: page.thankYouUrl || "",
      ctaText: page.ctaText || "",
      ctaUrl: page.ctaUrl || "",
      ctaSubtext: page.ctaSubtext || "",
      facebookPixelId: page.facebookPixelId || "1498608757116877",
      ga4MeasurementId: page.ga4MeasurementId || "",
      customHeadScripts: page.customHeadScripts || "",
      accentColor: page.accentColor || "",
    });
    try {
      setTestimonials(page.testimonials ? JSON.parse(page.testimonials) : []);
    } catch {
      setTestimonials([]);
    }
    setEditingId(page.id);
    setView("builder");
  }

  function handleSave() {
    const payload = {
      ...form,
      testimonials,
      internalLabel: form.internalLabel || undefined,
      heroImageUrl: form.heroImageUrl || undefined,
      videoEmbedCode: form.videoEmbedCode || undefined,
      bodyCopy: form.bodyCopy || undefined,
      optinHeadline: form.optinHeadline || undefined,
      optinLeadMagnet: form.optinLeadMagnet || undefined,
      kajabiFormUrl: form.kajabiFormUrl || undefined,
      thankYouUrl: form.thankYouUrl || undefined,
      ctaText: form.ctaText || undefined,
      ctaUrl: form.ctaUrl || undefined,
      ctaSubtext: form.ctaSubtext || undefined,
      ga4MeasurementId: form.ga4MeasurementId || undefined,
      customHeadScripts: form.customHeadScripts || undefined,
      accentColor: form.accentColor || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleSection(key: string) {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function addTestimonial() {
    if (!testimonialInput.name || !testimonialInput.quote) {
      toast.error("Name and quote are required");
      return;
    }
    setTestimonials(prev => [...prev, {
      name: testimonialInput.name,
      title: testimonialInput.title || undefined,
      quote: testimonialInput.quote,
      avatarUrl: testimonialInput.avatarUrl || undefined,
    }]);
    setTestimonialInput({ name: "", title: "", quote: "", avatarUrl: "" });
  }

  function copyUrl(id: number, campaign: Campaign, slug: string) {
    navigator.clipboard.writeText(pageUrl(campaign, slug));
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  // ── Section toggle helper ─────────────────────────────────────────────────

  function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    const open = expandedSections[id];
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        >
          <span className="font-medium text-sm">{title}</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {open && <div className="p-4 space-y-4">{children}</div>}
      </div>
    );
  }

  // ── Status badge ──────────────────────────────────────────────────────────

  function StatusBadge({ status }: { status: Status }) {
    const map: Record<Status, string> = {
      draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
      published: "bg-green-100 text-green-800 border-green-200",
      archived: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status]}`}>
        {status === "published" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
        {status}
      </span>
    );
  }

  // ── Views ─────────────────────────────────────────────────────────────────

  if (view === "preview" && editingId) {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
          <Button variant="ghost" size="sm" onClick={() => setView("builder")}>
            ← Back to Editor
          </Button>
          <span className="text-sm text-muted-foreground">Live Preview</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => publishMutation.mutate({ id: editingId })} disabled={publishMutation.isPending}>
              <Zap className="w-3.5 h-3.5 mr-1.5" />
              Publish
            </Button>
          </div>
        </div>
        {previewQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading preview…</div>
        ) : (
          <iframe
            ref={previewRef}
            srcDoc={previewHtml}
            className="flex-1 w-full border-0"
            title="Landing Page Preview"
          />
        )}
      </div>
    );
  }

  if (view === "builder") {
    const isSaving = createMutation.isPending || updateMutation.isPending;
    // Show loading skeleton while fromLpId query is in-flight
    const isLoadingSource = fromLpId !== null && !fromLpPopulated && fromLpQuery.isLoading;
    if (isLoadingSource) {
      return (
        <div className="min-h-screen bg-background">
          <div className="sticky top-0 z-30 bg-card border-b px-6 py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Pages</Button>
            <div className="flex-1 min-w-0">
              <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              <div className="h-3 w-32 bg-muted animate-pulse rounded mt-1" />
            </div>
          </div>
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading copy from Landing Page Generator…
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-full bg-muted animate-pulse rounded" />
                <div className="h-8 w-3/4 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background">
        {/* Builder header */}
        <div className="sticky top-0 z-30 bg-card border-b px-6 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Pages</Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm truncate">
              {editingId ? `Editing: ${form.title || "Untitled"}` : "New Landing Page"}
            </h2>
            {form.slug && (
              <p className="text-xs text-muted-foreground">
                {CH_DOMAIN}/{form.campaign}/{form.slug}
              </p>
            )}
            {/* Source page link when opened from Landing Page Generator */}
            {fromLpId !== null && fromLpPopulated && fromLpQuery.data && (
              <a
                href={`/landing-pages?highlight=${fromLpId}`}
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
              >
                <ArrowUpRight className="w-3 h-3" />
                View source in Landing Page Generator
              </a>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {editingId && (
              <Button variant="outline" size="sm" onClick={() => setView("preview")}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Preview
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : editingId ? "Save Changes" : "Create Page"}
            </Button>
            {editingId && (
              <Button
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => publishMutation.mutate({ id: editingId })}
                disabled={publishMutation.isPending}
              >
                <Zap className="w-3.5 h-3.5 mr-1.5" />
                Publish
              </Button>
            )}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
          {/* Page identity */}
          <div className="space-y-4 p-4 border border-border rounded-lg bg-card">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Page Identity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Page Title (internal)</Label>
                <Input
                  value={form.title}
                  onChange={e => {
                    const t = e.target.value;
                    setForm(f => ({
                      ...f,
                      title: t,
                      slug: f.slug || slugify(t),
                    }));
                  }}
                  placeholder="e.g. Lights On Free Chapter Opt-in"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Campaign</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(["lo", "gut", "sleep"] as Campaign[]).map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, campaign: c }))}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${
                        form.campaign === c
                          ? `${CAMPAIGN_META[c].bg} ${CAMPAIGN_META[c].color} border-current`
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {CAMPAIGN_META[c].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Template</Label>
                <div className="space-y-1.5 mt-1">
                  {(["optin", "vsl", "sales"] as Template[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, template: t }))}
                      className={`w-full flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all text-left ${
                        form.template === t
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {TEMPLATE_META[t].icon}
                      <span>{TEMPLATE_META[t].label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <Label>URL Slug</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground shrink-0">{CH_DOMAIN}/{form.campaign}/</span>
                  <Input
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                    placeholder="lights-on-free-chapter"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI Copy Generator */}
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <span className="font-semibold text-sm text-amber-800">AI Copy Generator</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiPanel(v => !v)}
                className="text-xs text-amber-700 hover:text-amber-900 underline"
              >
                {showAiPanel ? "Hide" : "Generate copy with AI"}
              </button>
            </div>
            {showAiPanel && (
              <div className="space-y-3">
                <p className="text-xs text-amber-700">
                  Describe what this page is for in one sentence. The AI will draft headline, subheadline, body copy, opt-in text, and CTA — all in Dr. Shojai's voice.
                </p>
                <Textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={`e.g. "Free chapter opt-in for burned-out professionals who want to reclaim their energy without giving up their career"`}
                  rows={3}
                  className="bg-white text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  disabled={!aiPrompt.trim() || generateCopyMutation.isPending}
                  onClick={() => generateCopyMutation.mutate({
                    campaign: form.campaign,
                    template: form.template,
                    prompt: aiPrompt.trim(),
                  })}
                >
                  {generateCopyMutation.isPending ? (
                    <><span className="animate-spin mr-1.5">⏳</span> Generating…</>
                  ) : (
                    <><Zap className="w-3.5 h-3.5 mr-1.5" /> Generate Copy</>
                  )}
                </Button>
                <p className="text-xs text-amber-600">All fields will be filled in — you can edit anything afterwards.</p>
              </div>
            )}
          </div>

          {/* Hero section */}
          <Section id="hero" title="Hero Section">
            <div>
              <Label>Main Headline</Label>
              <Textarea
                value={form.headline}
                onChange={e => setForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="Discover the Ancient Secret to Boundless Energy…"
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Sub-headline</Label>
              <Textarea
                value={form.subheadline}
                onChange={e => setForm(f => ({ ...f, subheadline: e.target.value }))}
                placeholder="Dr. Pedram Shojai reveals the 3 root causes…"
                rows={2}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Hero Image URL</Label>
              <Input
                value={form.heroImageUrl}
                onChange={e => setForm(f => ({ ...f, heroImageUrl: e.target.value }))}
                placeholder="https://cdn.example.com/hero.jpg"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Upload to S3 first, then paste the URL here.</p>
            </div>
            <div>
              <Label>Accent Color (optional override)</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.accentColor || "#E8A020"}
                  onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <Input
                  value={form.accentColor}
                  onChange={e => setForm(f => ({ ...f, accentColor: e.target.value }))}
                  placeholder={CAMPAIGN_META[form.campaign].color.replace("text-", "#")}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          </Section>

          {/* Opt-in form (optin template) */}
          {form.template === "optin" && (
            <Section id="optin" title="Opt-in Form">
              <div>
                <Label>Opt-in Box Headline</Label>
                <Input
                  value={form.optinHeadline}
                  onChange={e => setForm(f => ({ ...f, optinHeadline: e.target.value }))}
                  placeholder="Get Your Free Guide Instantly"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Lead Magnet Name</Label>
                <Input
                  value={form.optinLeadMagnet}
                  onChange={e => setForm(f => ({ ...f, optinLeadMagnet: e.target.value }))}
                  placeholder="Lights On: The 7-Day Energy Reset Guide"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Button Text</Label>
                <Input
                  value={form.optinButtonText}
                  onChange={e => setForm(f => ({ ...f, optinButtonText: e.target.value }))}
                  placeholder="Yes, Send It To Me!"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Kajabi Form Action URL</Label>
                <Input
                  value={form.kajabiFormUrl}
                  onChange={e => setForm(f => ({ ...f, kajabiFormUrl: e.target.value }))}
                  placeholder="https://app.kajabi.com/forms/…"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  In Kajabi: Forms → your form → Embed → copy the <code>action</code> URL from the HTML.
                </p>
              </div>
              <div>
                <Label>Thank You / Redirect URL</Label>
                <Input
                  value={form.thankYouUrl}
                  onChange={e => setForm(f => ({ ...f, thankYouUrl: e.target.value }))}
                  placeholder="https://theurbanmonk.com/thank-you"
                  className="mt-1"
                />
              </div>
            </Section>
          )}

          {/* VSL embed (vsl template) */}
          {form.template === "vsl" && (
            <Section id="optin" title="Video Embed">
              <div>
                <Label>Video Embed Code</Label>
                <Textarea
                  value={form.videoEmbedCode}
                  onChange={e => setForm(f => ({ ...f, videoEmbedCode: e.target.value }))}
                  placeholder='<iframe src="https://player.vimeo.com/video/…" …></iframe>'
                  rows={4}
                  className="mt-1 font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Paste the full iframe/script embed from Vimeo, Wistia, or YouTube.</p>
              </div>
            </Section>
          )}

          {/* CTA button */}
          {(form.template === "vsl" || form.template === "sales") && (
            <Section id="cta" title="CTA Button">
              <div>
                <Label>Button Text</Label>
                <Input
                  value={form.ctaText}
                  onChange={e => setForm(f => ({ ...f, ctaText: e.target.value }))}
                  placeholder="Yes! I Want Access Now →"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Button URL</Label>
                <Input
                  value={form.ctaUrl}
                  onChange={e => setForm(f => ({ ...f, ctaUrl: e.target.value }))}
                  placeholder="https://app.kajabi.com/checkout/…"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Sub-text below button</Label>
                <Input
                  value={form.ctaSubtext}
                  onChange={e => setForm(f => ({ ...f, ctaSubtext: e.target.value }))}
                  placeholder="30-day money-back guarantee · Secure checkout"
                  className="mt-1"
                />
              </div>
            </Section>
          )}

          {/* Body copy */}
          <Section id="body" title="Body Copy (Markdown)">
            <Textarea
              value={form.bodyCopy}
              onChange={e => setForm(f => ({ ...f, bodyCopy: e.target.value }))}
              placeholder="## What You'll Discover&#10;&#10;- The #1 reason you feel exhausted by 2pm…&#10;&#10;## About Dr. Pedram Shojai…"
              rows={12}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Supports Markdown: **bold**, ## headings, - lists, etc.</p>
          </Section>

          {/* Testimonials */}
          <Section id="testimonials" title={`Testimonials (${testimonials.length} selected)`}>
            {/* Selected testimonials list */}
            {testimonials.length > 0 && (
              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Selected for this page</p>
                {testimonials.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{t.authorName || t.name || "Anonymous"}</p>
                        {t.category && (
                          <span className="text-[10px] font-bold tracking-widest uppercase text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5">{t.category}</span>
                        )}
                        {t.dateLabel && (
                          <span className="text-[10px] text-muted-foreground">{t.dateLabel}</span>
                        )}
                      </div>
                      {(t.authorTitle || t.title) && <p className="text-xs text-muted-foreground">{t.authorTitle || t.title}</p>}
                      <p className="text-sm mt-1 text-muted-foreground italic line-clamp-2">"{t.quote}"</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTestimonials(prev => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Tab switcher */}
            <div className="flex gap-1 mb-3 border-b border-border">
              <button
                type="button"
                onClick={() => setTestimonialTab("pick")}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  testimonialTab === "pick" ? "bg-background border border-b-background border-border text-foreground -mb-px" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="w-3.5 h-3.5 inline mr-1.5" />
                Pick from Library
              </button>
              <button
                type="button"
                onClick={() => setTestimonialTab("manual")}
                className={`px-3 py-1.5 text-sm font-medium rounded-t transition-colors ${
                  testimonialTab === "manual" ? "bg-background border border-b-background border-border text-foreground -mb-px" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                Add Manually
              </button>
            </div>

            {testimonialTab === "pick" && (
              <div className="space-y-3">
                {/* Seed / Import controls */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => seedMutation.mutate()}
                    disabled={seedMutation.isPending}
                  >
                    <Database className="w-3.5 h-3.5 mr-1.5" />
                    {seedMutation.isPending ? "Seeding…" : "Seed LO Testimonials"}
                  </Button>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => pptxFileRef.current?.click()}
                    disabled={importPptxMutation.isPending}
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {importPptxMutation.isPending ? "Importing…" : "Import from PPTX"}
                  </Button>
                  <input ref={pptxFileRef} type="file" accept=".pptx" className="hidden" onChange={handlePptxUpload} />
                  {dbTestimonials.length > 0 && (
                    <span className="text-xs text-muted-foreground self-center">{dbTestimonials.length} testimonials in library</span>
                  )}
                </div>

                {dbTestimonials.length > 0 && (
                  <>
                    {/* Search + Category filter */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          value={testimonialSearch}
                          onChange={e => setTestimonialSearch(e.target.value)}
                          placeholder="Search name, quote, category…"
                          className="pl-8 text-sm h-8"
                        />
                      </div>
                      <select
                        value={testimonialCategoryFilter}
                        onChange={e => setTestimonialCategoryFilter(e.target.value)}
                        className="h-8 text-sm border border-input rounded-md px-2 bg-background"
                      >
                        {dbCategories.map(c => (
                          <option key={c} value={c}>{c === "ALL" ? "All Categories" : c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Testimonials checklist */}
                    <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                      {filteredDbTestimonials.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No testimonials match your filter.</p>
                      ) : filteredDbTestimonials.map(t => {
                        const isAdded = addedDbIds.has(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleDbTestimonial(t)}
                            className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors ${
                              isAdded
                                ? "bg-amber-50 border-amber-300 hover:bg-amber-100"
                                : "bg-muted/20 border-border hover:bg-muted/40"
                            }`}
                          >
                            <span className="mt-0.5 shrink-0">
                              {isAdded
                                ? <CheckSquare className="w-4 h-4 text-amber-600" />
                                : <Square className="w-4 h-4 text-muted-foreground" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium">{t.authorName || "Anonymous"}</span>
                                {t.category && (
                                  <span className="text-[10px] font-bold tracking-widest uppercase text-amber-700 bg-amber-100 border border-amber-300 rounded px-1 py-0.5">{t.category}</span>
                                )}
                                {t.dateLabel && (
                                  <span className="text-[10px] text-muted-foreground">{t.dateLabel}</span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 italic">"{t.quote}"</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Showing {filteredDbTestimonials.length} of {dbTestimonials.length} · {addedDbIds.size} selected
                    </p>
                  </>
                )}

                {dbTestimonials.length === 0 && !dbTestimonialsQuery.isLoading && (
                  <p className="text-sm text-muted-foreground py-2">
                    No testimonials in library yet. Click "Seed LO Testimonials" to load the built-in set, or import your PPTX file.
                  </p>
                )}
              </div>
            )}

            {testimonialTab === "manual" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={testimonialInput.name}
                    onChange={e => setTestimonialInput(t => ({ ...t, name: e.target.value }))}
                    placeholder="Name *"
                  />
                  <Input
                    value={testimonialInput.title}
                    onChange={e => setTestimonialInput(t => ({ ...t, title: e.target.value }))}
                    placeholder="Title / Location"
                  />
                </div>
                <Textarea
                  value={testimonialInput.quote}
                  onChange={e => setTestimonialInput(t => ({ ...t, quote: e.target.value }))}
                  placeholder="Quote *"
                  rows={2}
                />
                <Button type="button" variant="outline" size="sm" onClick={addTestimonial}>
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Testimonial
                </Button>
              </div>
            )}
          </Section>

          {/* Tracking */}
          <Section id="tracking" title="Tracking & Analytics">
            <div>
              <Label>Facebook Pixel ID</Label>
              <Input
                value={form.facebookPixelId}
                onChange={e => setForm(f => ({ ...f, facebookPixelId: e.target.value }))}
                placeholder="1498608757116877"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>GA4 Measurement ID</Label>
              <Input
                value={form.ga4MeasurementId}
                onChange={e => setForm(f => ({ ...f, ga4MeasurementId: e.target.value }))}
                placeholder="G-XXXXXXXXXX"
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>Custom &lt;head&gt; Scripts</Label>
              <Textarea
                value={form.customHeadScripts}
                onChange={e => setForm(f => ({ ...f, customHeadScripts: e.target.value }))}
                placeholder="<!-- Any additional tracking scripts -->"
                rows={3}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </Section>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────

  const published = (pages as LandingPage[]).filter(p => p.status === "published");
  const drafts = (pages as LandingPage[]).filter(p => p.status === "draft");

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Landing Pages
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Hosted at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{CH_DOMAIN}</code>
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Page
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Campaign overview cards */}
        <div className="grid grid-cols-3 gap-4">
          {(["lo", "gut", "sleep"] as Campaign[]).map(c => {
            const campaignPages = (pages as LandingPage[]).filter(p => p.campaign === c);
            const liveCount = campaignPages.filter(p => p.status === "published").length;
            const totalViews = campaignPages.reduce((sum, p) => sum + (p.viewCount || 0), 0);
            return (
              <div key={c} className={`p-4 rounded-xl border ${CAMPAIGN_META[c].bg}`}>
                <div className={`text-sm font-semibold ${CAMPAIGN_META[c].color}`}>{CAMPAIGN_META[c].label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{CAMPAIGN_META[c].description}</div>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span><strong className="text-foreground">{liveCount}</strong> live</span>
                  <span><strong className="text-foreground">{campaignPages.length}</strong> total</span>
                  <span><strong className="text-foreground">{totalViews.toLocaleString()}</strong> views</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Domain live confirmation */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Domain Active</p>
              <p className="text-xs text-green-700 mt-0.5">
                Pages publish instantly to <a href="https://ch.theurbanmonk.com" target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-green-900">ch.theurbanmonk.com</a> with FB Pixel + GA4 baked in.
              </p>
            </div>
          </div>
        </div>

        {/* Published pages */}
        {published.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Live Pages ({published.length})
            </h2>
            <div className="space-y-3">
              {published.map(page => <PageCard key={page.id} page={page} onEdit={openEdit} onClone={openClone} onPublish={publishMutation.mutate} onUnpublish={unpublishMutation.mutate} onDelete={deleteMutation.mutate} onCopy={copyUrl} copiedUrl={copiedUrl} />)}
            </div>
          </div>
        )}

        {/* Draft pages */}
        {drafts.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Drafts ({drafts.length})
            </h2>
            <div className="space-y-3">
              {drafts.map(page => <PageCard key={page.id} page={page} onEdit={openEdit} onClone={openClone} onPublish={publishMutation.mutate} onUnpublish={unpublishMutation.mutate} onDelete={deleteMutation.mutate} onCopy={copyUrl} copiedUrl={copiedUrl} />)}
            </div>
          </div>
        )}

        {pages.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <Globe className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">No landing pages yet</p>
            <p className="text-sm mt-1">Create your first page to get started.</p>
            <Button className="mt-4" onClick={openNew}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create First Page
            </Button>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}

// ── Page Card ─────────────────────────────────────────────────────────────────

function PageCard({
  page,
  onEdit,
  onClone,
  onPublish,
  onUnpublish,
  onDelete,
  onCopy,
  copiedUrl,
}: {
  page: LandingPage;
  onEdit: (p: LandingPage) => void;
  onClone: (p: LandingPage) => void;
  onPublish: (v: { id: number }) => void;
  onUnpublish: (v: { id: number }) => void;
  onDelete: (v: { id: number }) => void;
  onCopy: (id: number, campaign: Campaign, slug: string) => void;
  copiedUrl: number | null;
}) {
  const cm = CAMPAIGN_META[page.campaign];
  const tm = TEMPLATE_META[page.template];
  const url = pageUrl(page.campaign, page.slug);

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-lg ${cm.bg} flex items-center justify-center shrink-0 border`}>
        <span className={`text-xs font-bold uppercase ${cm.color}`}>{page.campaign}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{page.title}</span>
          <StatusBadge status={page.status} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            {tm.icon}{tm.label}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <code className="text-xs text-muted-foreground truncate">{url}</code>
          <button
            type="button"
            onClick={() => onCopy(page.id, page.campaign, page.slug)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            {copiedUrl === page.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {page.status === "published" && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
        {page.status === "published" && (
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" />{(page.viewCount || 0).toLocaleString()} views</span>
            <span>{(page.optinCount || 0).toLocaleString()} opt-ins</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => onEdit(page)} title="Edit">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onClone(page)} title="Clone as new draft">
          <CopyPlus className="w-3.5 h-3.5" />
        </Button>
        {page.status === "draft" ? (
          <Button size="sm" variant="outline" className="text-green-700 border-green-300 hover:bg-green-50" onClick={() => onPublish({ id: page.id })}>
            <Zap className="w-3.5 h-3.5 mr-1" />
            Publish
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => onUnpublish({ id: page.id })}>
            Unpublish
          </Button>
        )}
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => {
          if (confirm(`Delete "${page.title}"?`)) onDelete({ id: page.id });
        }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    draft: "bg-yellow-100 text-yellow-800 border-yellow-200",
    published: "bg-green-100 text-green-800 border-green-200",
    archived: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status]}`}>
      {status === "published" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  );
}
