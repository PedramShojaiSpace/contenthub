import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileText,
  Sparkles,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Download,
  Trash2,
  Loader2,
  Wand2,
  Image as ImageIcon,
  Link2,
  Edit3,
  Check,
  X,
  RefreshCw,
  AlertCircle,
  Clock,
  ExternalLink,
  FileDown,
  Zap,
} from "lucide-react";
import { Streamdown } from "streamdown";

// ─── Types ────────────────────────────────────────────────────────────────────

type EbookStatus = "outline" | "drafting" | "complete" | "failed";

interface Ebook {
  id: number;
  title: string;
  topic: string;
  targetPersona: string | null;
  status: EbookStatus;
  pdfS3Url: string | null;
  coverImageUrl: string | null;
  wordCountTarget: number | null;
  ctaBlockId: number | null;
  landingPageId: number | null;
  webinarSessionId: number | null;
  createdAt: Date;
}

interface Chapter {
  id: number;
  chapterNumber: number;
  title: string;
  content: string | null;
  wordCount: number | null;
  ctaText: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function EbookStatusBadge({ status }: { status: EbookStatus }) {
  const map: Record<EbookStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    outline: { label: "Outline", variant: "secondary" },
    drafting: { label: "Drafting...", variant: "secondary" },
    complete: { label: "Complete", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Generate E-Book Dialog ───────────────────────────────────────────────────

function GenerateEbookDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("health-conscious adults seeking transformation");
  const [chapterCount, setChapterCount] = useState("7");
  const [ctaLinkId, setCtaLinkId] = useState<string>("");
  const [landingPageId, setLandingPageId] = useState<string>("");
  const [webinarId, setWebinarId] = useState<string>("");

  const { data: linkables } = trpc.ebook.getLinkableItems.useQuery();
  const generateEbook = trpc.ebook.generateEbook.useMutation({
    onSuccess: (result) => {
      toast.success(
        `E-book generated! ${result.chapterCount} chapters, ${result.wordCount?.toLocaleString()} words.`
      );
      setOpen(false);
      setTitle("");
      setTopic("");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    if (!title.trim() || !topic.trim()) {
      toast.error("Please enter a title and topic");
      return;
    }
    generateEbook.mutate({
      title: title.trim(),
      topic: topic.trim(),
      targetAudience: audience,
      chapterCount: parseInt(chapterCount),
      ctaBlockId: ctaLinkId ? parseInt(ctaLinkId) : undefined,
      landingPageId: landingPageId ? parseInt(landingPageId) : undefined,
      webinarSessionId: webinarId ? parseInt(webinarId) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate New E-Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate E-Book in Your Voice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>E-Book Title</Label>
            <Input
              placeholder="e.g. The 5-Day Energy Reset"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={generateEbook.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Topic / Core Message</Label>
            <Textarea
              placeholder="e.g. How to reclaim your energy and vitality using ancient wisdom and modern science..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              disabled={generateEbook.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Input
              placeholder="e.g. busy professionals over 40 struggling with fatigue"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={generateEbook.isPending}
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Chapters</Label>
            <Select value={chapterCount} onValueChange={setChapterCount} disabled={generateEbook.isPending}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} chapters (~{n * 700} words)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* CTA Linking */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="w-4 h-4 text-primary" />
              Connect to Funnel (optional)
            </div>
            {linkables?.ctas && linkables.ctas.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">CTA Block</Label>
                <Select value={ctaLinkId || "none"} onValueChange={(v) => setCtaLinkId(v === "none" ? "" : v)} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a CTA..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {linkables.ctas.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {linkables?.landingPages && linkables.landingPages.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Landing Page</Label>
                <Select value={landingPageId || "none"} onValueChange={(v) => setLandingPageId(v === "none" ? "" : v)} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a landing page..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {linkables.landingPages.map((lp) => (
                      <SelectItem key={lp.id} value={String(lp.id)}>
                        {lp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {linkables?.webinars && linkables.webinars.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Webinar</Label>
                <Select value={webinarId || "none"} onValueChange={(v) => setWebinarId(v === "none" ? "" : v)} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a webinar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {linkables.webinars.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {generateEbook.isPending && (
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Generating your e-book...</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Writing chapters in your voice. This takes 1-3 minutes.
                </p>
              </div>
            </div>
          )}

          <Button
            className="w-full gap-2"
            onClick={handleGenerate}
            disabled={generateEbook.isPending || !title.trim() || !topic.trim()}
          >
            {generateEbook.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                Generate E-Book
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Chapter Editor ───────────────────────────────────────────────────────────

function ChapterEditor({
  chapter,
  ebookTopic,
  onSave,
  onRegenerate,
}: {
  chapter: Chapter;
  ebookTopic: string;
  onSave: (id: number, content: string, title: string) => Promise<void>;
  onRegenerate: (id: number, instructions?: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(chapter.content ?? "");
  const [title, setTitle] = useState(chapter.title);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [showRegenDialog, setShowRegenDialog] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(chapter.id, content, title);
      setEditing(false);
      toast.success("Chapter saved");
    } catch {
      toast.error("Failed to save chapter");
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setShowRegenDialog(false);
    try {
      await onRegenerate(chapter.id, regenInstructions || undefined);
      setRegenInstructions("");
      toast.success("Chapter regenerated");
    } catch {
      toast.error("Failed to regenerate chapter");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Chapter header */}
      <div className="flex items-center justify-between">
        {editing ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-semibold text-lg h-auto py-1"
          />
        ) : (
          <h3 className="font-semibold text-lg">{chapter.title}</h3>
        )}
        <div className="flex gap-2 shrink-0">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                <X className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowRegenDialog(true)}
                disabled={regenerating}
                className="gap-1.5 text-xs"
              >
                {regenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Rewrite
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setContent(chapter.content ?? "");
                  setTitle(chapter.title);
                  setEditing(true);
                }}
                className="gap-1.5 text-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Regen dialog */}
      {showRegenDialog && (
        <div className="border rounded-lg p-3 bg-muted/30 space-y-3">
          <p className="text-sm font-medium">Rewrite instructions (optional)</p>
          <Textarea
            placeholder="e.g. Make it more personal with a story, focus more on practical steps..."
            value={regenInstructions}
            onChange={(e) => setRegenInstructions(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRegenerate} className="gap-1.5">
              <Wand2 className="w-3.5 h-3.5" />
              Rewrite Chapter
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRegenDialog(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {editing ? (
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={20}
          className="font-mono text-sm"
        />
      ) : (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <Streamdown>{chapter.content ?? ""}</Streamdown>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        {chapter.wordCount?.toLocaleString()} words
      </div>
    </div>
  );
}

// ─── E-Book Viewer ────────────────────────────────────────────────────────────

function EbookViewer({
  ebookId,
  onBack,
}: {
  ebookId: number;
  onBack: () => void;
}) {
  const [activeChapter, setActiveChapter] = useState(0);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.ebook.getEbook.useQuery({ ebookId });
  const { data: exportData } = trpc.ebook.exportEbook.useQuery({ ebookId });
  const generateCover = trpc.ebook.generateCoverImage.useMutation({
    onSuccess: () => {
      utils.ebook.getEbook.invalidate({ ebookId });
      toast.success("Cover image generated!");
    },
    onError: (err) => toast.error(err.message),
  });
  const [showCtaPanel, setShowCtaPanel] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const updateChapter = trpc.ebook.updateChapter.useMutation({
    onSuccess: () => utils.ebook.getEbook.invalidate({ ebookId }),
  });
  const regenerateChapter = trpc.ebook.regenerateChapter.useMutation({
    onSuccess: () => {
      utils.ebook.getEbook.invalidate({ ebookId });
    },
  });
  const setChapterCta = trpc.ebook.setChapterCta.useMutation({
    onSuccess: () => {
      utils.ebook.getEbook.invalidate({ ebookId });
      toast.success("CTA saved to chapter");
    },
    onError: (err) => toast.error(err.message),
  });
  const injectCtaToAll = trpc.ebook.injectCtaToAllChapters.useMutation({
    onSuccess: (res) => {
      utils.ebook.getEbook.invalidate({ ebookId });
      toast.success(`CTA injected into ${res.updatedCount} chapters`);
    },
    onError: (err) => toast.error(err.message),
  });
  const exportPdf = trpc.ebook.exportPdf.useMutation({
    onSuccess: (res) => {
      utils.ebook.getEbook.invalidate({ ebookId });
      // Open PDF in new tab
      window.open(res.pdfUrl, "_blank");
      toast.success("PDF generated! Opening in new tab...");
      setPdfExporting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setPdfExporting(false);
    },
  });
  const { data: linkables } = trpc.ebook.getLinkableItems.useQuery();

  const handleDownload = () => {
    if (!exportData) return;
    const blob = new Blob([exportData.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportData.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setPdfExporting(true);
    exportPdf.mutate({ ebookId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { ebook, chapters } = data;
  const currentChapter = chapters[activeChapter];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            ← Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{ebook.title}</h2>
            <p className="text-sm text-muted-foreground">
              {chapters.length} chapters · ~{ebook.wordCountTarget?.toLocaleString()} words
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {!ebook.coverImageUrl && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => generateCover.mutate({ ebookId })}
              disabled={generateCover.isPending}
            >
              {generateCover.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5" />
              )}
              Generate Cover
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowCtaPanel(!showCtaPanel)}
          >
            <Zap className="w-3.5 h-3.5" />
            {showCtaPanel ? "Hide CTA Panel" : "Manage CTAs"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleDownload}
            disabled={!exportData}
          >
            <Download className="w-3.5 h-3.5" />
            .md
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={handleExportPdf}
            disabled={pdfExporting || exportPdf.isPending}
          >
            {pdfExporting || exportPdf.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            Export PDF
          </Button>
        </div>
      </div>

      {/* CTA Management Panel */}
      {showCtaPanel && (
        <CtaManagementPanel
          ebook={ebook}
          chapters={chapters}
          linkables={linkables ?? { ctas: [], landingPages: [], webinars: [] }}
          onSetChapterCta={(chapterId, ctaText, ctaUrl, ctaLabel) =>
            setChapterCta.mutate({ chapterId, ctaText, ctaUrl, ctaLabel })
          }
          onInjectAll={(ctaText, ctaUrl, ctaLabel) =>
            injectCtaToAll.mutate({ ebookId, ctaText, ctaUrl: ctaUrl ?? undefined, ctaLabel: ctaLabel ?? undefined })
          }
          isPending={setChapterCta.isPending || injectCtaToAll.isPending}
        />
      )}

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar: Chapter list */}
        <div className="col-span-3 space-y-1">
          {ebook.coverImageUrl && (
            <img
              src={ebook.coverImageUrl}
              alt="E-book cover"
              className="w-full rounded-lg mb-4 shadow-md"
            />
          )}
          {ebook.pdfS3Url && (
            <a
              href={ebook.pdfS3Url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium mb-3"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download PDF
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Chapters
          </p>
          {chapters.map((chapter, idx) => (
            <button
              key={chapter.id}
              onClick={() => setActiveChapter(idx)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                idx === activeChapter
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span className="text-xs opacity-60 mr-1.5">{chapter.chapterNumber}.</span>
              {chapter.title}
            </button>
          ))}
        </div>

        {/* Main: Chapter content */}
        <div className="col-span-9">
          {currentChapter && (
            <Card>
              <CardContent className="p-6">
                <ChapterEditor
                  chapter={currentChapter}
                  ebookTopic={ebook.topic}
                  onSave={async (id, content, title) => {
                    await updateChapter.mutateAsync({ chapterId: id, content, title });
                  }}
                  onRegenerate={async (id, instructions) => {
                    const result = await regenerateChapter.mutateAsync({
                      chapterId: id,
                      instructions,
                    });
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveChapter((p) => Math.max(0, p - 1))}
              disabled={activeChapter === 0}
              className="gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground self-center">
              {activeChapter + 1} / {chapters.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveChapter((p) => Math.min(chapters.length - 1, p + 1))}
              disabled={activeChapter === chapters.length - 1}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CTA Management Panel ───────────────────────────────────────────────────

interface LinkableItem { id: number; text?: string | null; url?: string | null; title?: string | null; }
interface Linkables { ctas: LinkableItem[]; landingPages: LinkableItem[]; webinars: LinkableItem[]; }

function CtaManagementPanel({
  ebook,
  chapters,
  linkables,
  onSetChapterCta,
  onInjectAll,
  isPending,
}: {
  ebook: Ebook;
  chapters: Chapter[];
  linkables: Linkables;
  onSetChapterCta: (chapterId: number, ctaText: string | null, ctaUrl: string | null, ctaLabel: string | null) => void;
  onInjectAll: (ctaText: string, ctaUrl: string | null, ctaLabel: string | null) => void;
  isPending: boolean;
}) {
  const [globalCtaText, setGlobalCtaText] = useState(
    "Ready to transform your health? Join Dr. Pedram Shojai at the Urban Monk Academy and get access to the full curriculum, live coaching, and a community of high-performers."
  );
  const [globalCtaUrl, setGlobalCtaUrl] = useState("https://theurbanmonk.com/academy");
  const [globalCtaLabel, setGlobalCtaLabel] = useState("Join the Urban Monk Academy →");
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [chapterCtaText, setChapterCtaText] = useState("");
  const [chapterCtaUrl, setChapterCtaUrl] = useState("");
  const [chapterCtaLabel, setChapterCtaLabel] = useState("");

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);

  const handleSelectChapter = (ch: Chapter) => {
    setSelectedChapterId(ch.id);
    setChapterCtaText(ch.ctaText ?? "");
    setChapterCtaUrl(ch.ctaUrl ?? "");
    setChapterCtaLabel(ch.ctaLabel ?? "");
  };

  const handleSelectCta = (ctaId: string) => {
    const cta = linkables.ctas.find((c) => String(c.id) === ctaId);
    if (cta) {
      setGlobalCtaText(cta.text ?? "");
      setGlobalCtaUrl(cta.url ?? "");
    }
  };

  const handleSelectLandingPage = (lpId: string) => {
    const lp = linkables.landingPages.find((l) => String(l.id) === lpId);
    if (lp) {
      setGlobalCtaLabel(`Explore ${lp.title} →`);
    }
  };

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-600" />
          CTA & Funnel Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Global CTA */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Global CTA (injected into all chapters)</p>
            {linkables.ctas.length > 0 && (
              <Select onValueChange={handleSelectCta}>
                <SelectTrigger className="w-48 h-7 text-xs">
                  <SelectValue placeholder="Load from CTA block..." />
                </SelectTrigger>
                <SelectContent>
                  {linkables.ctas.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.text?.substring(0, 40)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <Textarea
            value={globalCtaText}
            onChange={(e) => setGlobalCtaText(e.target.value)}
            rows={3}
            placeholder="CTA text shown at the end of each chapter..."
            className="text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">URL</Label>
              <Input
                value={globalCtaUrl}
                onChange={(e) => setGlobalCtaUrl(e.target.value)}
                placeholder="https://theurbanmonk.com/academy"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Button Label</Label>
              <Input
                value={globalCtaLabel}
                onChange={(e) => setGlobalCtaLabel(e.target.value)}
                placeholder="Join the Academy →"
                className="h-8 text-sm"
              />
            </div>
          </div>
          {linkables.landingPages.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Link to landing page:</Label>
              <Select onValueChange={handleSelectLandingPage}>
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue placeholder="Select landing page..." />
                </SelectTrigger>
                <SelectContent>
                  {linkables.landingPages.map((lp) => (
                    <SelectItem key={lp.id} value={String(lp.id)}>
                      {lp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            size="sm"
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => onInjectAll(globalCtaText, globalCtaUrl || null, globalCtaLabel || null)}
            disabled={isPending || !globalCtaText.trim()}
          >
            {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            Inject CTA into All Chapters
          </Button>
        </div>

        {/* Per-chapter CTA */}
        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium">Per-Chapter CTA Override</p>
          <p className="text-xs text-muted-foreground">Select a chapter to set a custom CTA that overrides the global one.</p>
          <div className="flex flex-wrap gap-1.5">
            {chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelectChapter(ch)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedChapterId === ch.id
                    ? "bg-primary text-primary-foreground"
                    : ch.ctaText
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Ch.{ch.chapterNumber}
                {ch.ctaText && <span className="ml-1 text-amber-600">●</span>}
              </button>
            ))}
          </div>
          {selectedChapter && (
            <div className="space-y-3 p-3 border rounded-lg bg-background">
              <p className="text-xs font-medium text-muted-foreground">Chapter {selectedChapter.chapterNumber}: {selectedChapter.title}</p>
              <Textarea
                value={chapterCtaText}
                onChange={(e) => setChapterCtaText(e.target.value)}
                rows={2}
                placeholder="Custom CTA text for this chapter (leave blank to use global CTA)..."
                className="text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={chapterCtaUrl}
                  onChange={(e) => setChapterCtaUrl(e.target.value)}
                  placeholder="URL"
                  className="h-8 text-sm"
                />
                <Input
                  value={chapterCtaLabel}
                  onChange={(e) => setChapterCtaLabel(e.target.value)}
                  placeholder="Button label"
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    onSetChapterCta(
                      selectedChapter.id,
                      chapterCtaText || null,
                      chapterCtaUrl || null,
                      chapterCtaLabel || null
                    )
                  }
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Chapter CTA
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    onSetChapterCta(selectedChapter.id, null, null, null)
                  }
                  disabled={isPending}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EBookGenerator() {
  const [selectedEbookId, setSelectedEbookId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: ebooks, isLoading } = trpc.ebook.listEbooks.useQuery();
  const { data: books } = trpc.bookLibrary.listBooks.useQuery();
  const deleteEbook = trpc.ebook.deleteEbook.useMutation({
    onSuccess: () => utils.ebook.listEbooks.invalidate(),
  });

  const readyBooks = books?.filter((b) => b.status === "ready") ?? [];

  const handleDelete = async (ebookId: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteEbook.mutateAsync({ ebookId });
      toast.success("E-book deleted");
      if (selectedEbookId === ebookId) setSelectedEbookId(null);
    } catch {
      toast.error("Failed to delete e-book");
    }
  };

  if (selectedEbookId) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <EbookViewer
            ebookId={selectedEbookId}
            onBack={() => setSelectedEbookId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="w-8 h-8 text-primary" />
              E-Book Generator
            </h1>
            <p className="text-muted-foreground mt-1">
              Generate full e-books in your voice, connected to your funnels
            </p>
          </div>
          <GenerateEbookDialog onSuccess={() => utils.ebook.listEbooks.invalidate()} />
        </div>

        {/* Voice profile warning */}
        {readyBooks.length === 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">No voice profile yet</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Upload your books in the{" "}
                  <a href="/book-library" className="text-primary underline">
                    Book Library
                  </a>{" "}
                  first to generate e-books in your exact voice. You can still generate e-books
                  using the default Urban Monk style.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {readyBooks.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">
                  Voice profile active — {readyBooks.length} book
                  {readyBooks.length !== 1 ? "s" : ""} indexed
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  E-books will be written in Dr. Shojai's authentic voice, learned from:{" "}
                  {readyBooks.map((b) => b.title).join(", ")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* E-book list */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : ebooks && ebooks.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-medium">No e-books yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Generate your first e-book — it will be written in your authentic voice and
                connected to your funnels
              </p>
            </div>
            <GenerateEbookDialog onSuccess={() => utils.ebook.listEbooks.invalidate()} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ebooks?.map((ebook) => (
              <Card
                key={ebook.id}
                className="group hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => ebook.status === "complete" && setSelectedEbookId(ebook.id)}
              >
                <CardContent className="p-5 space-y-3">
                  {/* Cover */}
                  {ebook.pdfS3Url ? (
                    <img
                      src={ebook.pdfS3Url}
                      alt="Cover"
                      className="w-full aspect-[2/3] object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-muted/50 rounded-md flex items-center justify-center">
                      <BookOpen className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-tight">{ebook.title}</h3>
                    <EbookStatusBadge status={ebook.status} />
                  </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{ebook.topic}</p>
                    {ebook.wordCountTarget && (
                      <p className="text-xs text-muted-foreground">
                        ~{ebook.wordCountTarget.toLocaleString()} words
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    {ebook.status === "complete" && (
                      <div className="flex items-center gap-1 text-primary text-xs font-medium">
                        View & Edit
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                    {(ebook.status === "drafting" || ebook.status === "outline") && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Generating...
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(ebook.id, ebook.title);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
