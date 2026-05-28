/**
 * ContentPipeline.tsx
 *
 * A single-page dashboard showing all three content modules (Webinars, E-Books,
 * Landing Pages) side by side with "Send to →" action buttons between them.
 * Gives an at-a-glance view of the full funnel and lets you navigate to any
 * module pre-filled from any item in one click.
 *
 * Connection tracking: items that were created from another module show a
 * "linked from" badge using the real FK columns (sourceWebinarId, sourceEbookId,
 * sourceLandingPageId) — no topic-name inference.
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  FileText,
  Filter,
  GitFork,
  Globe,
  Link2,
  Video,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────

type WebinarRow = {
  id: number;
  topic: string;
  webinarDate: string | null;
  status: string | null;
  createdAt: Date | null;
};

type EbookRow = {
  id: number;
  title: string;
  topic: string;
  status: string | null;
  targetPersona: string | null;
  pdfS3Url: string | null;
  createdAt: Date | null;
  sourceWebinarId: number | null;
  sourceEbookId: number | null;
  sourceLandingPageId: number | null;
};

type LandingPageRow = {
  id: number;
  title: string;
  offer: string | null;
  personaName: string | null;
  status: string | null;
  gammaUrl: string | null;
  createdAt: Date | null;
  sourceWebinarId: number | null;
  sourceEbookId: number | null;
  sourceLandingPageId: number | null;
};

// ─── Filter options ───────────────────────────────────────────────────────────

type FilterOption = "all" | "complete" | "drafting" | "linked" | "unlinked";

const FILTER_LABELS: Record<FilterOption, string> = {
  all: "All",
  complete: "Complete",
  drafting: "Drafting",
  linked: "Linked",
  unlinked: "Unlinked",
};

// ─── Status badge helpers ─────────────────────────────────────────────────────

function statusColor(status: string | null): string {
  switch (status) {
    case "complete":
    case "published":
    case "live":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "drafting":
    case "draft":
    case "building":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "scheduled":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "failed":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

// ─── Connection badge ─────────────────────────────────────────────────────────

function LinkedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-primary/70 bg-primary/8 border border-primary/20 rounded px-1.5 py-0.5">
      <Link2 className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

// ─── Column skeleton ──────────────────────────────────────────────────────────

function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border border-border/50">
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Arrow divider ────────────────────────────────────────────────────────────

function ColumnArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2 min-w-[48px]">
      <ArrowRight className="w-5 h-5 text-primary/60" />
      <span className="text-[10px] text-muted-foreground font-medium text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

function FilterBar({
  active,
  onChange,
}: {
  active: FilterOption;
  onChange: (f: FilterOption) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {(Object.keys(FILTER_LABELS) as FilterOption[]).map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            active === f
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
        >
          {FILTER_LABELS[f]}
        </button>
      ))}
    </div>
  );
}

// ─── Webinar column ───────────────────────────────────────────────────────────

function WebinarColumn({
  webinars,
  filter,
}: {
  webinars: WebinarRow[];
  filter: FilterOption;
}) {
  const [, navigate] = useLocation();

  const filtered = webinars.filter((w) => {
    if (filter === "all") return true;
    if (filter === "complete") return w.status === "complete" || w.status === "published";
    if (filter === "drafting") return w.status === "drafting" || w.status === "draft" || w.status === "building";
    // Webinars don't have source FKs — treat them as "unlinked" for linked/unlinked filters
    if (filter === "linked") return false;
    if (filter === "unlinked") return true;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {filter === "linked" ? "No linked webinars." : "No webinar sessions yet."}
        </p>
      )}
      {filtered.map((w) => (
        <Card
          key={w.id}
          className="border border-border/60 hover:border-primary/30 transition-colors"
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {w.topic}
              </p>
              {w.status && (
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusColor(w.status)}`}
                >
                  {w.status}
                </Badge>
              )}
            </div>
            {w.webinarDate && (
              <p className="text-xs text-muted-foreground">
                {new Date(w.webinarDate).toLocaleDateString()}
              </p>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  navigate(`/ebook-generator?from=webinar&id=${w.id}`)
                }
              >
                <FileText className="w-3 h-3" />
                → E-Book
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  navigate(`/landing-pages?from=webinar&id=${w.id}`)
                }
              >
                <Globe className="w-3 h-3" />
                → Page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 ml-auto"
                onClick={() => navigate(`/webinar`)}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── E-Book column ────────────────────────────────────────────────────────────

function EBookColumn({
  ebooks,
  webinars,
  filter,
}: {
  ebooks: EbookRow[];
  webinars: WebinarRow[];
  filter: FilterOption;
}) {
  const [, navigate] = useLocation();

  const isLinked = (e: EbookRow) =>
    e.sourceWebinarId !== null || e.sourceEbookId !== null || e.sourceLandingPageId !== null;

  const filtered = ebooks.filter((e) => {
    if (filter === "all") return true;
    if (filter === "complete") return e.status === "complete";
    if (filter === "drafting") return e.status === "drafting" || e.status === "draft";
    if (filter === "linked") return isLinked(e);
    if (filter === "unlinked") return !isLinked(e);
    return true;
  });

  // Build a lookup map for webinar topics
  const webinarMap = new Map(webinars.map((w) => [w.id, w.topic]));

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {filter === "linked" ? "No linked e-books." : "No e-books yet."}
        </p>
      )}
      {filtered.map((e) => (
        <Card
          key={e.id}
          className={`border transition-colors ${
            isLinked(e)
              ? "border-primary/30 hover:border-primary/50"
              : "border-border/60 hover:border-primary/30"
          }`}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {e.title}
              </p>
              {e.status && (
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusColor(e.status)}`}
                >
                  {e.status}
                </Badge>
              )}
            </div>

            {/* Connection badges — show which source item this was fed from */}
            {e.sourceWebinarId !== null && (
              <LinkedBadge
                label={
                  webinarMap.has(e.sourceWebinarId)
                    ? `Webinar: ${webinarMap.get(e.sourceWebinarId)!.slice(0, 30)}…`
                    : `Webinar #${e.sourceWebinarId}`
                }
              />
            )}

            {e.targetPersona && !e.sourceWebinarId && (
              <p className="text-xs text-muted-foreground">
                Audience: {e.targetPersona}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  navigate(`/landing-pages?from=ebook&id=${e.id}`)
                }
              >
                <Globe className="w-3 h-3" />
                → Page
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate(`/webinar?from=ebook&id=${e.id}`)}
              >
                <Video className="w-3 h-3" />
                → Webinar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 ml-auto"
                onClick={() => navigate(`/ebook-generator`)}
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Landing Page column ──────────────────────────────────────────────────────

function LandingPageColumn({
  landingPages,
  webinars,
  ebooks,
  filter,
}: {
  landingPages: LandingPageRow[];
  webinars: WebinarRow[];
  ebooks: EbookRow[];
  filter: FilterOption;
}) {
  const [, navigate] = useLocation();

  const isLinked = (p: LandingPageRow) =>
    p.sourceWebinarId !== null || p.sourceEbookId !== null || p.sourceLandingPageId !== null;

  const filtered = landingPages.filter((p) => {
    if (filter === "all") return true;
    if (filter === "complete") return p.status === "published" || p.status === "complete";
    if (filter === "drafting") return p.status === "draft" || p.status === "drafting";
    if (filter === "linked") return isLinked(p);
    if (filter === "unlinked") return !isLinked(p);
    return true;
  });

  // Build lookup maps
  const webinarMap = new Map(webinars.map((w) => [w.id, w.topic]));
  const ebookMap = new Map(ebooks.map((e) => [e.id, e.title]));

  return (
    <div className="flex flex-col gap-3">
      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          {filter === "linked" ? "No linked landing pages." : "No landing pages yet."}
        </p>
      )}
      {filtered.map((p) => (
        <Card
          key={p.id}
          className={`border transition-colors ${
            isLinked(p)
              ? "border-primary/30 hover:border-primary/50"
              : "border-border/60 hover:border-primary/30"
          }`}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {p.title}
              </p>
              {p.status && (
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${statusColor(p.status)}`}
                >
                  {p.status}
                </Badge>
              )}
            </div>

            {/* Connection badges */}
            <div className="flex flex-wrap gap-1">
              {p.sourceWebinarId !== null && (
                <LinkedBadge
                  label={
                    webinarMap.has(p.sourceWebinarId)
                      ? `Webinar: ${webinarMap.get(p.sourceWebinarId)!.slice(0, 25)}…`
                      : `Webinar #${p.sourceWebinarId}`
                  }
                />
              )}
              {p.sourceEbookId !== null && (
                <LinkedBadge
                  label={
                    ebookMap.has(p.sourceEbookId)
                      ? `E-Book: ${ebookMap.get(p.sourceEbookId)!.slice(0, 25)}…`
                      : `E-Book #${p.sourceEbookId}`
                  }
                />
              )}
              {p.sourceLandingPageId !== null && (
                <LinkedBadge label={`Variant of #${p.sourceLandingPageId}`} />
              )}
            </div>

            {p.personaName && !isLinked(p) && (
              <p className="text-xs text-muted-foreground">
                Persona: {p.personaName}
              </p>
            )}

            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  navigate(`/ebook-generator?from=landingPage&id=${p.id}`)
                }
              >
                <FileText className="w-3 h-3" />
                → E-Book
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() =>
                  navigate(`/webinar?from=landingPage&id=${p.id}`)
                }
              >
                <Video className="w-3 h-3" />
                → Webinar
              </Button>
              {p.gammaUrl && (
                <a
                  href={p.gammaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto"
                >
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ContentPipeline() {
  const { data, isLoading } = trpc.crossModule.getPipelineView.useQuery();
  const [activeFilter, setActiveFilter] = useState<FilterOption>("all");

  const webinars = (data?.webinars ?? []) as WebinarRow[];
  const ebooks = (data?.ebooks ?? []) as EbookRow[];
  const landingPages = (data?.landingPages ?? []) as LandingPageRow[];

  const webinarCount = webinars.length;
  const ebookCount = ebooks.length;
  const pageCount = landingPages.length;

  // Count linked items for the "Linked" filter badge
  const linkedEbooks = ebooks.filter(
    (e) => e.sourceWebinarId !== null || e.sourceEbookId !== null || e.sourceLandingPageId !== null
  ).length;
  const linkedPages = landingPages.filter(
    (p) => p.sourceWebinarId !== null || p.sourceEbookId !== null || p.sourceLandingPageId !== null
  ).length;
  const totalLinked = linkedEbooks + linkedPages;

  return (
    <DashboardLayout>
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <GitFork className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Content Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Your full funnel at a glance — click any arrow to feed content between modules
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex gap-4 flex-wrap items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Video className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{webinarCount}</span> webinar{webinarCount !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{ebookCount}</span> e-book{ebookCount !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{pageCount}</span> landing page{pageCount !== 1 ? "s" : ""}
        </div>
        {totalLinked > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">{totalLinked}</span> linked item{totalLinked !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <FilterBar active={activeFilter} onChange={setActiveFilter} />

      {/* Three-column pipeline */}
      <div className="flex gap-0 items-start overflow-x-auto pb-4">
        {/* Webinar column */}
        <div className="flex-1 min-w-[260px]">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3 pt-0 px-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-6 h-6 rounded bg-violet-100 flex items-center justify-center">
                  <Video className="w-3.5 h-3.5 text-violet-600" />
                </div>
                Webinars
                <Badge variant="secondary" className="ml-auto text-xs">
                  {webinarCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <ColumnSkeleton />
              ) : (
                <WebinarColumn webinars={webinars} filter={activeFilter} />
              )}
            </CardContent>
          </Card>
        </div>

        <ColumnArrow label="feeds" />

        {/* E-Book column */}
        <div className="flex-1 min-w-[260px]">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3 pt-0 px-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                </div>
                E-Books
                <Badge variant="secondary" className="ml-auto text-xs">
                  {ebookCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <ColumnSkeleton />
              ) : (
                <EBookColumn ebooks={ebooks} webinars={webinars} filter={activeFilter} />
              )}
            </CardContent>
          </Card>
        </div>

        <ColumnArrow label="feeds" />

        {/* Landing Page column */}
        <div className="flex-1 min-w-[260px]">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3 pt-0 px-0">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                Landing Pages
                <Badge variant="secondary" className="ml-auto text-xs">
                  {pageCount}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {isLoading ? (
                <ColumnSkeleton />
              ) : (
                <LandingPageColumn
                  landingPages={landingPages}
                  webinars={webinars}
                  ebooks={ebooks}
                  filter={activeFilter}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Empty state */}
      {!isLoading && webinarCount === 0 && ebookCount === 0 && pageCount === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <GitFork className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Your pipeline is empty</p>
          <p className="text-sm mt-1">
            Create a webinar, e-book, or landing page to see them here.
          </p>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
