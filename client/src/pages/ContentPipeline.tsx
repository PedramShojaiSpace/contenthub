/**
 * ContentPipeline.tsx
 *
 * A single-page dashboard showing all three content modules (Webinars, E-Books,
 * Landing Pages) side by side with "Send to →" action buttons between them.
 * Gives an at-a-glance view of the full funnel and lets you navigate to any
 * module pre-filled from any item in one click.
 */
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
  GitFork,
  Globe,
  Video,
} from "lucide-react";
import { useLocation } from "wouter";

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
    default:
      return "bg-muted text-muted-foreground border-border";
  }
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

// ─── Webinar column ───────────────────────────────────────────────────────────

function WebinarColumn({
  webinars,
}: {
  webinars: Array<{
    id: number;
    topic: string;
    webinarDate: string | null;
    status: string | null;
    createdAt: Date | null;
  }>;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-3">
      {webinars.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No webinar sessions yet.
        </p>
      )}
      {webinars.map((w) => (
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
}: {
  ebooks: Array<{
    id: number;
    title: string;
    topic: string;
    status: string | null;
    targetPersona: string | null;
    pdfS3Url: string | null;
    createdAt: Date | null;
  }>;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-3">
      {ebooks.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No e-books yet.
        </p>
      )}
      {ebooks.map((e) => (
        <Card
          key={e.id}
          className="border border-border/60 hover:border-primary/30 transition-colors"
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
            {e.targetPersona && (
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
}: {
  landingPages: Array<{
    id: number;
    title: string;
    offer: string | null;
    personaName: string | null;
    status: string | null;
    gammaUrl: string | null;
    createdAt: Date | null;
  }>;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="flex flex-col gap-3">
      {landingPages.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No landing pages yet.
        </p>
      )}
      {landingPages.map((p) => (
        <Card
          key={p.id}
          className="border border-border/60 hover:border-primary/30 transition-colors"
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
            {p.personaName && (
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

  const webinarCount = data?.webinars.length ?? 0;
  const ebookCount = data?.ebooks.length ?? 0;
  const pageCount = data?.landingPages.length ?? 0;

  return (
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
      <div className="flex gap-4 flex-wrap">
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
      </div>

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
                <WebinarColumn webinars={data?.webinars ?? []} />
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
                <EBookColumn ebooks={data?.ebooks ?? []} />
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
                <LandingPageColumn landingPages={data?.landingPages ?? []} />
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
  );
}
