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
  wordCountTarget: number | null;
  createdAt: Date;
}

interface Chapter {
  id: number;
  chapterNumber: number;
  title: string;
  content: string | null;
  wordCount: number | null;
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
                <Select value={ctaLinkId} onValueChange={setCtaLinkId} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a CTA..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
                <Select value={landingPageId} onValueChange={setLandingPageId} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a landing page..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
                <Select value={webinarId} onValueChange={setWebinarId} disabled={generateEbook.isPending}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select a webinar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
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
  const updateChapter = trpc.ebook.updateChapter.useMutation({
    onSuccess: () => utils.ebook.getEbook.invalidate({ ebookId }),
  });
  const regenerateChapter = trpc.ebook.regenerateChapter.useMutation({
    onSuccess: (result) => {
      utils.ebook.getEbook.invalidate({ ebookId });
    },
  });

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
        <div className="flex gap-2">
          {!ebook.pdfS3Url && (
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
            onClick={handleDownload}
            disabled={!exportData}
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar: Chapter list */}
        <div className="col-span-3 space-y-1">
          {ebook.pdfS3Url && (
            <img
              src={ebook.pdfS3Url}
              alt="E-book cover"
              className="w-full rounded-lg mb-4 shadow-md"
            />
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
