import DashboardLayout from "@/components/DashboardLayout";
import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
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
  ChevronDown,
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
  Upload,
  FileUp,
  FileSearch,
  History,
  RotateCcw,
  ArrowUpRight,
  LayoutTemplate,
  Video,
  GitFork,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { useRef } from "react";
import ChapterEnhancementPanel, { type EnhancementDoc } from "@/components/ChapterEnhancementPanel";

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
  // JSON array of {number, title, summary} from the approved outline
  outlineJson: string | null;
  createdAt: Date;
}

interface Chapter {
  id: number;
  chapterNumber: number;
  title: string;
  content: string | null;
  wordCount: number | null;
  status: "pending" | "generating" | "complete" | "failed";
  ctaText: string | null;
  ctaUrl: string | null;
  ctaLabel: string | null;
  // Persistent per-chapter author style note
  styleNote: string | null;
}

// ─── Chapter Style Note Field ────────────────────────────────────────────────

function ChapterStyleNoteField({
  chapterId,
  chapterTitle,
  initialNote,
  onSave,
  isSaving,
}: {
  chapterId: number;
  chapterTitle: string;
  initialNote: string;
  onSave: (note: string) => void;
  isSaving: boolean;
}) {
  const [note, setNote] = useState(initialNote);
  const [dirty, setDirty] = useState(false);

  const handleChange = (val: string) => {
    setNote(val);
    setDirty(val !== initialNote);
  };

  const handleSave = () => {
    onSave(note);
    setDirty(false);
  };

  const handleClear = () => {
    setNote("");
    onSave("");
    setDirty(false);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/10">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-primary" />
          Style note
        </p>
        {initialNote && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            disabled={isSaving}
          >
            Clear
          </button>
        )}
      </div>
      <Textarea
        value={note}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={`Standing direction for "${chapterTitle}"...\ne.g. "Always open with a patient story"`}
        rows={2}
        className="text-xs resize-none"
      />
      <p className="text-[10px] text-muted-foreground">Saved here, auto-fills the Rewrite dialog each time.</p>
      {dirty && (
        <Button
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save note
        </Button>
      )}
    </div>
  );
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

interface PrefillData {
  title?: string;
  topic?: string;
  audience?: string;
  sourceNarrative?: string;
  webinarSessionId?: number;
  landingPageId?: number;
  fromLabel?: string;
}

function GenerateEbookDialog({
  onSuccess,
  prefillData,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  onSuccess: () => void;
  prefillData?: PrefillData;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (controlledOnOpenChange) controlledOnOpenChange(v);
    else setInternalOpen(v);
  };
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("health-conscious adults seeking transformation");
  const [chapterCount, setChapterCount] = useState("7");
  const [ctaLinkId, setCtaLinkId] = useState<string>("");
  const [landingPageId, setLandingPageId] = useState<string>("");
  const [webinarId, setWebinarId] = useState<string>("");

  // Length and prose style
  const [lengthPreset, setLengthPreset] = useState<"concise" | "standard" | "expansive" | "immersive">("standard");
  const [proseStyle, setProseStyle] = useState<"direct" | "narrative" | "academic">("narrative");
  // Global default style note — seeded into every chapter on creation
  const [defaultStyleNote, setDefaultStyleNote] = useState("");

  // Source documents state (multiple files)
  type SourceDoc = { name: string; text: string; s3Url: string; wordCount: number };
  const [sourceDocs, setSourceDocs] = useState<SourceDoc[]>([]);
  const [sourceNarrative, setSourceNarrative] = useState("");
  const [uploadingSource, setUploadingSource] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadingSource(true);
    let successCount = 0;
    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/ebook/upload-source", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(`"${file.name}": ${err.error ?? "Upload failed"}`);
          continue;
        }
        const data = await res.json();
        setSourceDocs((prev) => [...prev, { name: file.name, text: data.text, s3Url: data.s3Url, wordCount: data.wordCount }]);
        successCount++;
      } catch (err) {
        toast.error(`"${file.name}": ${err instanceof Error ? err.message : "Upload failed"}`);
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} file${successCount > 1 ? "s" : ""} uploaded successfully`);
    }
    setUploadingSource(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeSourceDoc = (index: number) => {
    setSourceDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<"idle" | "outline" | "chapters">("idle");
  const [chaptersCompleted, setChaptersCompleted] = useState(0);
  const [totalChapters, setTotalChapters] = useState(0);
  const [failedChapters, setFailedChapters] = useState<number[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  // Outline preview state
  type OutlineChapter = { number: number; title: string; summary: string };
  const [outlinePreview, setOutlinePreview] = useState<OutlineChapter[] | null>(null);
  const [editableOutline, setEditableOutline] = useState<OutlineChapter[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Apply prefill data when dialog opens from another module
  useEffect(() => {
    if (open && prefillData) {
      if (prefillData.title) setTitle(prefillData.title);
      if (prefillData.topic) setTopic(prefillData.topic);
      if (prefillData.audience) setAudience(prefillData.audience);
      if (prefillData.sourceNarrative) setSourceNarrative(prefillData.sourceNarrative);
      if (prefillData.webinarSessionId) setWebinarId(String(prefillData.webinarSessionId));
      if (prefillData.landingPageId) setLandingPageId(String(prefillData.landingPageId));
    }
  }, [open, prefillData]);

  const { data: linkables } = trpc.ebook.getLinkableItems.useQuery();
  const previewOutlineMutation = trpc.ebook.previewOutline.useMutation();
  const generateFromApprovedOutline = trpc.ebook.generateFromApprovedOutline.useMutation();
  const createDraft = trpc.ebook.createEbookDraft.useMutation({
    onError: (err) => {
      console.error("[createEbookDraft] error:", err);
    },
  });
  const generateChapterMutation = trpc.ebook.generateChapter.useMutation({
    onError: (err) => {
      console.error("[generateChapter] error:", err);
    },
  });

  const handlePreviewOutline = async () => {
    if (!title.trim() || !topic.trim()) {
      toast.error("Please enter a title and topic");
      return;
    }
    setIsPreviewing(true);
    setLastError(null);
    try {
      const result = await previewOutlineMutation.mutateAsync({
        title: title.trim(),
        topic: topic.trim(),
        targetAudience: audience,
        chapterCount: parseInt(chapterCount),
        ...(sourceDocs.length > 0 ? {
          sourceDocumentText: sourceDocs.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.text}`).join("\n\n"),
        } : {}),
        ...(sourceNarrative.trim() ? { sourceNarrative: sourceNarrative.trim() } : {}),
      });
      setOutlinePreview(result.outline);
      setEditableOutline(result.outline.map((c) => ({ ...c })));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate outline";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleApproveOutline = async () => {
    if (!editableOutline.length) return;
    setIsGenerating(true);
    setGenerationStep("chapters");
    setChaptersCompleted(0);
    setTotalChapters(editableOutline.length);
    setFailedChapters([]);
    setLastError(null);
    try {
      const result = await generateFromApprovedOutline.mutateAsync({
        title: title.trim(),
        topic: topic.trim(),
        targetAudience: audience,
        outline: editableOutline,
        ctaBlockId: ctaLinkId ? parseInt(ctaLinkId) : undefined,
        landingPageId: landingPageId ? parseInt(landingPageId) : undefined,
        webinarSessionId: webinarId ? parseInt(webinarId) : undefined,
        ...(sourceDocs.length > 0 ? {
          sourceDocumentText: sourceDocs.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.text}`).join("\n\n"),
          sourceDocumentName: sourceDocs.map((d) => d.name).join(", "),
          sourceDocumentS3Url: sourceDocs[0].s3Url,
        } : {}),
        ...(sourceNarrative.trim() ? { sourceNarrative: sourceNarrative.trim() } : {}),
        ...(defaultStyleNote.trim() ? { defaultStyleNote: defaultStyleNote.trim() } : {}),
        lengthPreset,
        proseStyle,
        // Connection tracking: pass source IDs from cross-module feed
        ...(prefillData?.webinarSessionId ? { sourceWebinarId: prefillData.webinarSessionId } : {}),
        ...(prefillData?.landingPageId ? { sourceLandingPageId: prefillData.landingPageId } : {}),
      });
      toast.success(`E-book complete! ${result.chapterCount} chapters generated.`);
      setOpen(false);
      setTitle("");
      setTopic("");
      setSourceDocs([]);
      setSourceNarrative("");
      setOutlinePreview(null);
      setEditableOutline([]);
      setDefaultStyleNote("");
      setGenerationStep("idle");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setLastError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setIsGenerating(false);
      setGenerationStep("idle");
    }
  };

  const handleGenerate = async () => {
    if (!title.trim() || !topic.trim()) {
      toast.error("Please enter a title and topic");
      return;
    }
    setIsGenerating(true);
    setGenerationStep("outline");
    setChaptersCompleted(0);
    setFailedChapters([]);
    try {
      // Step 1: Create draft (outline only)
      const draft = await createDraft.mutateAsync({
        title: title.trim(),
        topic: topic.trim(),
        targetAudience: audience,
        chapterCount: parseInt(chapterCount),
        ctaBlockId: ctaLinkId ? parseInt(ctaLinkId) : undefined,
        landingPageId: landingPageId ? parseInt(landingPageId) : undefined,
        webinarSessionId: webinarId ? parseInt(webinarId) : undefined,
        ...(sourceDocs.length > 0 ? {
          sourceDocumentText: sourceDocs.map((d, i) => `--- Document ${i + 1}: ${d.name} ---\n${d.text}`).join("\n\n"),
          sourceDocumentName: sourceDocs.map((d) => d.name).join(", "),
          sourceDocumentS3Url: sourceDocs[0].s3Url,
        } : {}),
        ...(sourceNarrative.trim() ? { sourceNarrative: sourceNarrative.trim() } : {}),
        lengthPreset,
        proseStyle,
        // Connection tracking: pass source IDs from cross-module feed
        ...(prefillData?.webinarSessionId ? { sourceWebinarId: prefillData.webinarSessionId } : {}),
        ...(prefillData?.landingPageId ? { sourceLandingPageId: prefillData.landingPageId } : {}),
      });

      setGenerationStep("chapters");
      setTotalChapters(draft.outline.length);

      // Step 2: Generate each chapter sequentially
      const failed: number[] = [];
      for (const chapter of draft.outline) {
        try {
          await generateChapterMutation.mutateAsync({
            ebookId: draft.ebookId,
            chapterNumber: chapter.number,
            lengthPreset: draft.lengthPreset,
            proseStyle: draft.proseStyle,
          });
          setChaptersCompleted((n) => n + 1);
        } catch {
          failed.push(chapter.number);
          setFailedChapters([...failed]);
          setChaptersCompleted((n) => n + 1);
        }
      }

      if (failed.length === 0) {
        toast.success(`E-book complete! ${draft.outline.length} chapters generated.`);
      } else {
        toast.warning(`Done with ${failed.length} chapter(s) failed. You can regenerate them individually.`);
      }

      setOpen(false);
      setTitle("");
      setTopic("");
      setSourceDocs([]);
      setSourceNarrative("");
      setGenerationStep("idle");
      onSuccess();
    } catch (err) {
      console.error("[handleGenerate] caught error:", err);
      // Extract the most useful error message from tRPC or plain errors
      let msg = "Generation failed";
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        msg = (e.message as string) ||
              (e.data as Record<string, unknown>)?.message as string ||
              JSON.stringify(err);
      }
      setLastError(msg);
      toast.error(msg, { duration: 8000 });
    } finally {
      setIsGenerating(false);
      setGenerationStep("idle");
    }
  };

  // Reset all state when dialog closes so button is never stuck
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setIsGenerating(false);
      setGenerationStep("idle");
      setChaptersCompleted(0);
      setTotalChapters(0);
      setFailedChapters([]);
      setLastError(null);
      setOutlinePreview(null);
      setEditableOutline([]);
      setIsPreviewing(false);
    }
    setOpen(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="w-4 h-4" />
          Generate New E-Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-2">
            <Label>Topic / Core Message</Label>
            <Textarea
              placeholder="e.g. How to reclaim your energy and vitality using ancient wisdom and modern science..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-2">
            <Label>Target Audience</Label>
            <Input
              placeholder="e.g. busy professionals over 40 struggling with fatigue"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={isGenerating}
            />
          </div>
          <div className="space-y-2">
            <Label>Number of Chapters</Label>
            <Select value={chapterCount} onValueChange={setChapterCount} disabled={isGenerating}>
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

          {/* Length & Prose Style */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Zap className="w-4 h-4 text-primary" />
              Length &amp; Prose Style
            </div>

            {/* Length slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Chapter Length</Label>
                <span className="text-xs font-medium text-primary">
                  {lengthPreset === "concise" && "Concise · 500–700 words"}
                  {lengthPreset === "standard" && "Standard · 800–1,100 words"}
                  {lengthPreset === "expansive" && "Expansive · 1,200–1,600 words"}
                  {lengthPreset === "immersive" && "Immersive · 1,700–2,200 words"}
                </span>
              </div>
              <div className="flex gap-1">
                {(["concise", "standard", "expansive", "immersive"] as const).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLengthPreset(preset)}
                    disabled={isGenerating}
                    className={`flex-1 py-1.5 text-xs rounded border transition-colors capitalize ${
                      lengthPreset === preset
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {lengthPreset === "concise" && "Tight, punchy chapters. Great for lead magnets and quick reads."}
                {lengthPreset === "standard" && "Balanced depth. The default for most e-books."}
                {lengthPreset === "expansive" && "Rich, detailed chapters. Suitable for premium guides."}
                {lengthPreset === "immersive" && "Deep-dive chapters. Best for comprehensive books and courses."}
              </p>
            </div>

            {/* Prose style */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Prose Style</Label>
              <div className="flex gap-1">
                {([
                  { key: "direct", label: "Direct", desc: "Punchy, short paragraphs" },
                  { key: "narrative", label: "Narrative", desc: "Story-driven, flowing" },
                  { key: "academic", label: "Academic", desc: "Evidence-based, thorough" },
                ] as const).map(({ key, label, desc }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProseStyle(key)}
                    disabled={isGenerating}
                    className={`flex-1 py-1.5 px-1 text-xs rounded border transition-colors ${
                      proseStyle === key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                    }`}
                  >
                    <div className="font-medium">{label}</div>
                    <div className="opacity-70 text-[10px] leading-tight mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Default Style Note */}
            <div className="space-y-2">
              <Label htmlFor="defaultStyleNote" className="text-xs text-muted-foreground">
                Default Style Note <span className="opacity-60">(optional — seeded into every chapter)</span>
              </Label>
              <Textarea
                id="defaultStyleNote"
                placeholder="e.g. Always ground claims in clinical evidence. Open each chapter with a patient story."
                className="text-sm resize-none"
                rows={2}
                value={defaultStyleNote}
                onChange={(e) => setDefaultStyleNote(e.target.value)}
                disabled={isGenerating}
              />
            </div>
          </div>

          {/* Source Documents Upload */}
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileSearch className="w-4 h-4 text-primary" />
                Source Documents (optional)
              </div>
              {sourceDocs.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {sourceDocs.length} file{sourceDocs.length > 1 ? "s" : ""} — {sourceDocs.reduce((s, d) => s + d.wordCount, 0).toLocaleString()} words total
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Upload one or more webinar transcripts, talk notes, outlines, or reference documents. The AI will use them as the primary foundation for the e-book.
            </p>

            {/* Uploaded files list */}
            {sourceDocs.length > 0 && (
              <div className="space-y-2">
                {sourceDocs.map((doc, i) => (
                  <div key={i} className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-2.5">
                    <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.wordCount.toLocaleString()} words</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removeSourceDoc(i)}
                      disabled={isGenerating}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add more files drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              onClick={() => !uploadingSource && !isGenerating && fileInputRef.current?.click()}
            >
              {uploadingSource ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading and extracting text...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileUp className="w-6 h-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {sourceDocs.length === 0 ? "Drop files or click to browse" : "Add more files"}
                  </p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, or MD — up to 20 MB each — multiple files supported</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.text"
                multiple
                className="hidden"
                onChange={handleSourceFileUpload}
                disabled={uploadingSource || isGenerating}
              />
            </div>

            {/* Author narrative */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Your narrative / direction
              </Label>
              <Textarea
                placeholder="Tell the AI what angle to take, what to emphasize, what to leave out, or any additional context not in the document..."
                value={sourceNarrative}
                onChange={(e) => setSourceNarrative(e.target.value)}
                rows={3}
                className="text-sm"
                disabled={isGenerating}
              />
            </div>
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
                <Select value={ctaLinkId || "none"} onValueChange={(v) => setCtaLinkId(v === "none" ? "" : v)} disabled={isGenerating}>
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
                <Select value={landingPageId || "none"} onValueChange={(v) => setLandingPageId(v === "none" ? "" : v)} disabled={isGenerating}>
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
                <Select value={webinarId || "none"} onValueChange={(v) => setWebinarId(v === "none" ? "" : v)} disabled={isGenerating}>
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

          {isGenerating && (
            <div className="space-y-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {generationStep === "outline" && "Building chapter outline..."}
                {generationStep === "chapters" && `Writing chapter ${Math.min(chaptersCompleted + 1, totalChapters)} of ${totalChapters}...`}
              </div>
              {generationStep === "chapters" && totalChapters > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{chaptersCompleted} of {totalChapters} chapters complete</span>
                    <span>{Math.round((chaptersCompleted / totalChapters) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(chaptersCompleted / totalChapters) * 100}%` }}
                    />
                  </div>
                  {failedChapters.length > 0 && (
                    <p className="text-xs text-destructive">
                      Chapter(s) {failedChapters.join(", ")} failed — you can regenerate them after.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {lastError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{lastError}</span>
            </div>
          )}

          {/* ── Step 1: Preview Outline ── */}
          {!outlinePreview && !isGenerating && (
            <Button
              className="w-full gap-2"
              onClick={handlePreviewOutline}
              disabled={isPreviewing || !title.trim() || !topic.trim()}
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating outline with Claude...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Preview Outline First
                </>
              )}
            </Button>
          )}

          {/* ── Step 2: Editable Outline Preview ── */}
          {outlinePreview && !isGenerating && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Claude's Outline — Review &amp; Edit
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1 text-muted-foreground"
                  onClick={() => {
                    setOutlinePreview(null);
                    setEditableOutline([]);
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate outline
                </Button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {editableOutline.map((chapter, idx) => (
                  <div key={chapter.number} className="border rounded-lg p-3 bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">{chapter.number}.</span>
                      <Input
                        value={chapter.title}
                        onChange={(e) => {
                          const updated = [...editableOutline];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setEditableOutline(updated);
                        }}
                        className="flex-1 text-sm font-medium h-7 border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary rounded-none"
                        placeholder="Chapter title..."
                      />
                      {/* Remove chapter button — only show if more than 1 chapter */}
                      {editableOutline.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editableOutline
                              .filter((_, i) => i !== idx)
                              .map((c, i) => ({ ...c, number: i + 1 }));
                            setEditableOutline(updated);
                          }}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove this chapter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <Textarea
                      value={chapter.summary}
                      onChange={(e) => {
                        const updated = [...editableOutline];
                        updated[idx] = { ...updated[idx], summary: e.target.value };
                        setEditableOutline(updated);
                      }}
                      rows={2}
                      className="text-xs text-muted-foreground border-0 bg-transparent px-0 resize-none focus-visible:ring-0 focus-visible:border-b focus-visible:border-primary rounded-none"
                      placeholder="Chapter summary..."
                    />
                  </div>
                ))}
                {/* Add chapter button */}
                <button
                  type="button"
                  onClick={() => {
                    const nextNum = editableOutline.length + 1;
                    setEditableOutline([...editableOutline, {
                      number: nextNum,
                      title: `Chapter ${nextNum}`,
                      summary: "",
                    }]);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary rounded-lg transition-colors"
                >
                  <span className="text-base leading-none">+</span>
                  Add chapter
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Edit any title or summary above, then approve to start writing. Claude Sonnet will write each chapter using this exact outline.
              </p>
              <Button
                className="w-full gap-2"
                onClick={handleApproveOutline}
                disabled={isGenerating || editableOutline.length === 0}
              >
                <Sparkles className="w-4 h-4" />
                Approve &amp; Write All Chapters
              </Button>
            </div>
          )}

          {/* ── Generation progress ── */}
          {isGenerating && (
            <div className="space-y-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                {generationStep === "chapters" && `Writing chapter ${Math.min(chaptersCompleted + 1, totalChapters)} of ${totalChapters}...`}
              </div>
              {generationStep === "chapters" && totalChapters > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{chaptersCompleted} of {totalChapters} chapters complete</span>
                    <span>{Math.round((chaptersCompleted / totalChapters) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${(chaptersCompleted / totalChapters) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
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
  onRegenerate: (id: number, opts?: {
    instructions?: string;
    styleNotes?: string;
    enhancementInstructions?: string;
    enhancementDocs?: EnhancementDoc[];
    lengthPreset?: string;
    proseStyle?: string;
    applyToAll?: boolean;
  }) => Promise<void>;
  isLastChapter?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(chapter.content ?? "");
  const [title, setTitle] = useState(chapter.title);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  // Pre-fill from the chapter's persisted styleNote; user can override per-run
  const [regenStyleNotes, setRegenStyleNotes] = useState(chapter.styleNote ?? "");
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const versionsQuery = trpc.ebook.getChapterVersions.useQuery(
    { chapterId: chapter.id },
    { enabled: showVersionHistory }
  );
  const restoreVersion = trpc.ebook.restoreChapterVersion.useMutation({
    onSuccess: () => {
      toast.success("Chapter restored to selected version");
      setShowVersionHistory(false);
    },
    onError: (err) => toast.error(err.message),
  });

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

  const handleRegenerate = async (opts?: {
    instructions?: string;
    enhancementInstructions?: string;
    enhancementDocs?: EnhancementDoc[];
    lengthPreset?: string;
    proseStyle?: string;
    applyToAll?: boolean;
  }) => {
    setRegenerating(true);
    setShowRegenDialog(false);
    try {
      await onRegenerate(chapter.id, opts ?? {
        instructions: regenInstructions || undefined,
        styleNotes: regenStyleNotes || undefined,
      });
      setRegenInstructions("");
      setRegenStyleNotes("");
      if (!opts?.applyToAll) toast.success("Chapter regenerated");
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
          <p className="text-sm font-medium">Rewrite this chapter</p>

          {/* Style note — quick one-liner for this specific rewrite */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Style note
              <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">sent directly to Claude</span>
            </Label>
            <Input
              placeholder='e.g. "Open with a patient story" or "Make it more personal, less clinical"'
              value={regenStyleNotes}
              onChange={(e) => setRegenStyleNotes(e.target.value)}
              className="text-sm h-8"
            />
            <p className="text-[10px] text-muted-foreground">A short, specific direction Claude will apply precisely. Use this for tone, structure, or opening style.</p>
          </div>

          {/* General instructions */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Additional instructions (optional)</Label>
            <Textarea
              placeholder="e.g. Focus more on practical steps, add a specific protocol the reader can try today..."
              value={regenInstructions}
              onChange={(e) => setRegenInstructions(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleRegenerate()} className="gap-1.5">
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

      {/* Enhancement panel */}
      <ChapterEnhancementPanel
        chapterId={chapter.id}
        chapterTitle={chapter.title}
        onRegenerate={async (opts) => {
          await handleRegenerate({
            enhancementInstructions: opts.enhancementInstructions,
            enhancementDocs: opts.enhancementDocs,
            lengthPreset: opts.lengthPreset,
            proseStyle: opts.proseStyle,
            applyToAll: opts.applyToAll,
          });
        }}
        isRegenerating={regenerating}
      />

      {/* Version history */}
      <div className="border border-border rounded-lg overflow-hidden mt-4">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
          onClick={() => setShowVersionHistory((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            Version History
          </span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showVersionHistory ? "rotate-180" : ""}`} />
        </button>
        {showVersionHistory && (
          <div className="px-4 pb-4 space-y-2 border-t border-border">
            {versionsQuery.isLoading && (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading versions…
              </div>
            )}
            {versionsQuery.data && versionsQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground py-3">No saved versions yet. Versions are auto-saved before each rewrite.</p>
            )}
            {versionsQuery.data?.map((v, idx) => (
              <div key={v.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">
                    Version {versionsQuery.data!.length - idx}
                    <span className="ml-2 text-muted-foreground font-normal capitalize">{v.trigger}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.wordCount?.toLocaleString() ?? "?"} words &middot; {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 text-xs gap-1"
                  disabled={restoreVersion.isPending}
                  onClick={() => restoreVersion.mutate({ versionId: v.id })}
                >
                  {restoreVersion.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Restore
                </Button>
              </div>
            ))}
          </div>
        )}
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
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  // Regenerate outline state
  const [showRegenOutlineModal, setShowRegenOutlineModal] = useState(false);
  const [regenOutlineChapters, setRegenOutlineChapters] = useState<Array<{ number: number; title: string; summary: string }>>([]);
  const [regenOutlineLoading, setRegenOutlineLoading] = useState(false);
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
  const updateChapterStyleNote = trpc.ebook.updateChapterStyleNote.useMutation({
    onSuccess: () => utils.ebook.getEbook.invalidate({ ebookId }),
    onError: (err) => toast.error(err.message),
  });
  const previewOutline = trpc.ebook.previewOutline.useMutation({
    onSuccess: (res) => {
      setRegenOutlineChapters(res.outline);
      setRegenOutlineLoading(false);
      setShowRegenOutlineModal(true);
    },
    onError: (err) => {
      toast.error(err.message);
      setRegenOutlineLoading(false);
    },
  });
  const applyRegenOutline = trpc.ebook.updateEbookOutline.useMutation({
    onSuccess: () => {
      utils.ebook.getEbook.invalidate({ ebookId });
      setShowRegenOutlineModal(false);
      toast.success("Outline updated — chapter titles and summaries refreshed.");
    },
    onError: (err) => toast.error(err.message),
  });
  const handleRegenOutline = () => {
    if (!data) return;
    setRegenOutlineLoading(true);
    previewOutline.mutate({
      title: data.ebook.title,
      topic: data.ebook.topic,
      targetAudience: data.ebook.targetPersona ?? "health-conscious adults seeking transformation",
      chapterCount: data.chapters.length,
    });
  };
  const handleApplyRegenOutline = () => {
    applyRegenOutline.mutate({ ebookId, outline: regenOutlineChapters });
  };
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
  const [retrying, setRetrying] = useState(false);
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const regenerateAllChapters = trpc.ebook.regenerateAllChapters.useMutation({
    onSuccess: (res) => {
      utils.ebook.getEbook.invalidate({ ebookId });
      if (res.failedCount === 0) {
        toast.success(`All ${res.succeededCount} chapters regenerated with the latest voice profile!`);
      } else {
        toast.warning(`${res.succeededCount} chapters regenerated, ${res.failedCount} failed.`);
      }
      setRegeneratingAll(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setRegeneratingAll(false);
    },
  });
  const handleRegenerateAll = () => {
    if (!window.confirm(`Regenerate all ${data?.chapters.length ?? 0} chapters? This will overwrite all existing chapter content.`)) return;
    setRegeneratingAll(true);
    regenerateAllChapters.mutate({ ebookId });
  };
  const retryFailedChapters = trpc.ebook.retryFailedChapters.useMutation({
    onSuccess: (res) => {
      utils.ebook.getEbook.invalidate({ ebookId });
      if (res.failedCount === 0) {
        toast.success(`All ${res.succeededCount} failed chapter${res.succeededCount !== 1 ? "s" : ""} regenerated successfully!`);
      } else {
        toast.warning(`${res.succeededCount} chapter${res.succeededCount !== 1 ? "s" : ""} recovered, ${res.failedCount} still failed.`);
      }
      setRetrying(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setRetrying(false);
    },
  });
  const handleRetryFailed = () => {
    setRetrying(true);
    retryFailedChapters.mutate({ ebookId });
  };

  const [docxExporting, setDocxExporting] = useState(false);
  const exportDocx = trpc.ebook.exportDocx.useMutation({
    onSuccess: (res) => {
      window.open(res.docxUrl, "_blank");
      toast.success("Word document ready! Opening download...");
      setDocxExporting(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setDocxExporting(false);
    },
  });
  const handleExportDocx = () => {
    setDocxExporting(true);
    exportDocx.mutate({ ebookId });
  };
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
  const failedChapterCount = chapters.filter((c) => c.status === "failed").length;

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
              {failedChapterCount > 0 && (
                <span className="ml-2 text-destructive font-medium">
                  · {failedChapterCount} chapter{failedChapterCount !== 1 ? "s" : ""} failed
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {failedChapterCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
              onClick={handleRetryFailed}
              disabled={retrying || retryFailedChapters.isPending || regeneratingAll || regenerateAllChapters.isPending}
            >
              {retrying || retryFailedChapters.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Retry Failed ({failedChapterCount})
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRegenerateAll}
            disabled={regeneratingAll || regenerateAllChapters.isPending || retrying || retryFailedChapters.isPending}
            title="Rewrite all chapters with the current voice profile and style notes"
          >
            {regeneratingAll || regenerateAllChapters.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {regeneratingAll || regenerateAllChapters.isPending ? "Regenerating..." : "Regenerate All"}
          </Button>
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
            variant="outline"
            className="gap-1.5"
            onClick={handleExportDocx}
            disabled={docxExporting || exportDocx.isPending}
          >
            {docxExporting || exportDocx.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            .docx
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
        {/* Sidebar: Chapter list + Outline panel + Style notes */}
        <div className="col-span-3 space-y-4">
          {ebook.coverImageUrl && (
            <img
              src={ebook.coverImageUrl}
              alt="E-book cover"
              className="w-full rounded-lg shadow-md"
            />
          )}
          {ebook.pdfS3Url && (
            <a
              href={ebook.pdfS3Url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              <FileDown className="w-3.5 h-3.5" />
              Download PDF
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Chapter navigation */}
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Chapters
            </p>
            {chapters.map((chapter, idx) => {
              // Word count progress bar
              const target = ebook.wordCountTarget
                ? Math.round(ebook.wordCountTarget / chapters.length)
                : 700;
              const wc = chapter.wordCount ?? 0;
              const pct = Math.min(100, Math.round((wc / target) * 100));
              const barColor =
                pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
              return (
                <button
                  key={chapter.id}
                  onClick={() => setActiveChapter(idx)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    idx === activeChapter
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className="text-xs opacity-60 mr-0.5">{chapter.chapterNumber}.</span>
                    <span className="flex-1 truncate">{chapter.title}</span>
                    {chapter.styleNote && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" title="Has style note" />
                    )}
                  </div>
                  {/* Word count progress bar */}
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {wc > 0 ? `${wc}w` : "—"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Per-chapter style note */}
          {currentChapter && (
            <ChapterStyleNoteField
              key={currentChapter.id}
              chapterId={currentChapter.id}
              chapterTitle={currentChapter.title}
              initialNote={currentChapter.styleNote ?? ""}
              onSave={(note) =>
                updateChapterStyleNote.mutate({ chapterId: currentChapter.id, styleNote: note || null })
              }
              isSaving={updateChapterStyleNote.isPending}
            />
          )}

          {/* Outline reference panel */}
          {ebook.outlineJson && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:bg-muted/40 transition-colors"
                onClick={() => setShowOutlinePanel((v) => !v)}
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Original Outline
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOutlinePanel ? "rotate-180" : ""}`} />
              </button>
              {showOutlinePanel && (() => {
                let outline: Array<{ number: number; title: string; summary: string }> = [];
                try { outline = JSON.parse(ebook.outlineJson!); } catch { /* ignore */ }
                return (
                  <div className="border-t border-border px-3 py-2 space-y-3 max-h-72 overflow-y-auto">
                    {outline.map((ch) => (
                      <div key={ch.number} className="space-y-0.5">
                        <p className="text-xs font-medium">
                          <span className="text-muted-foreground mr-1">{ch.number}.</span>
                          {ch.title}
                        </p>
                        {ch.summary && (
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{ch.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Regenerate Outline button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs"
            onClick={handleRegenOutline}
            disabled={regenOutlineLoading || previewOutline.isPending}
          >
            {regenOutlineLoading || previewOutline.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            Regenerate Outline
          </Button>

          {/* Regenerate Outline Modal */}
          {showRegenOutlineModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base">New Outline Preview</h3>
                  <button onClick={() => setShowRegenOutlineModal(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Edit titles and summaries, then click Apply to update the ebook. Existing chapter prose is not changed.</p>
                <div className="space-y-3">
                  {regenOutlineChapters.map((ch, idx) => (
                    <div key={ch.number} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-5 shrink-0">{ch.number}.</span>
                        <input
                          className="flex-1 text-sm font-medium bg-transparent border-b border-border focus:outline-none focus:border-primary py-0.5"
                          value={ch.title}
                          onChange={(e) => {
                            const updated = [...regenOutlineChapters];
                            updated[idx] = { ...updated[idx], title: e.target.value };
                            setRegenOutlineChapters(updated);
                          }}
                        />
                      </div>
                      <textarea
                        className="w-full text-xs text-muted-foreground bg-muted/30 rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                        rows={2}
                        value={ch.summary}
                        onChange={(e) => {
                          const updated = [...regenOutlineChapters];
                          updated[idx] = { ...updated[idx], summary: e.target.value };
                          setRegenOutlineChapters(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setShowRegenOutlineModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={handleApplyRegenOutline}
                    disabled={applyRegenOutline.isPending}
                  >
                    {applyRegenOutline.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Apply to Ebook
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main: Chapter content */}
        <div className="col-span-9">
          {currentChapter && (
            <Card>
              <CardContent className="p-6">
                <ChapterEditor
                  chapter={currentChapter}
                  ebookTopic={ebook.topic}
                  isLastChapter={activeChapter === chapters.length - 1}
                  onSave={async (id, content, title) => {
                    await updateChapter.mutateAsync({ chapterId: id, content, title });
                  }}
                  onRegenerate={async (id, opts) => {
                    if (opts?.applyToAll) {
                      // Broadcast enhancement to all chapters sequentially
                      let successCount = 0;
                      let failCount = 0;
                      for (const ch of chapters) {
                        try {
                          await regenerateChapter.mutateAsync({
                            chapterId: ch.id,
                            instructions: opts.instructions,
                            styleNotes: opts.styleNotes,
                            enhancementInstructions: opts.enhancementInstructions,
                            enhancementDocs: opts.enhancementDocs,
                            lengthPreset: opts.lengthPreset as "concise" | "standard" | "expansive" | "immersive" | undefined,
                            proseStyle: opts.proseStyle as "direct" | "narrative" | "academic" | undefined,
                          });
                          successCount++;
                        } catch {
                          failCount++;
                        }
                      }
                      utils.ebook.getEbook.invalidate({ ebookId });
                      if (failCount === 0) {
                        toast.success(`All ${successCount} chapters rewritten successfully!`);
                      } else {
                        toast.warning(`${successCount} chapters rewritten, ${failCount} failed.`);
                      }
                    } else {
                      await regenerateChapter.mutateAsync({
                        chapterId: id,
                        instructions: opts?.instructions,
                        styleNotes: opts?.styleNotes,
                        enhancementInstructions: opts?.enhancementInstructions,
                        enhancementDocs: opts?.enhancementDocs,
                        lengthPreset: opts?.lengthPreset as "concise" | "standard" | "expansive" | "immersive" | undefined,
                        proseStyle: opts?.proseStyle as "direct" | "narrative" | "academic" | undefined,
                      });
                    }
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
    "Ready to go deeper? Dr. Pedram Shojai's Lights On program gives you the exact system to reclaim your energy, focus, and vitality. Visit lightson.theurbanmonk.com to get started."
  );
  const [globalCtaUrl, setGlobalCtaUrl] = useState("https://lightson.theurbanmonk.com/");
  const [globalCtaLabel, setGlobalCtaLabel] = useState("Start Lights On →");
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
                placeholder="https://lightson.theurbanmonk.com/"
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
  const [prefillDialogOpen, setPrefillDialogOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<{
    title?: string;
    topic?: string;
    audience?: string;
    sourceNarrative?: string;
    webinarSessionId?: number;
    landingPageId?: number;
    fromLabel?: string;
  } | null>(null);
  const [location] = useLocation();
  const utils = trpc.useUtils();

  // Read cross-module query params on mount and fetch pre-fill data
  const urlParams = new URLSearchParams(window.location.search);
  const fromModule = urlParams.get("from");
  const fromId = urlParams.get("id") ? Number(urlParams.get("id")) : null;

  const { data: webinarFeed } = trpc.crossModule.webinarToEbook.useQuery(
    { webinarSessionId: fromId! },
    { enabled: fromModule === "webinar" && fromId !== null }
  );
  const { data: landingPageFeed } = trpc.crossModule.landingPageToEbook.useQuery(
    { landingPageId: fromId! },
    { enabled: fromModule === "landingPage" && fromId !== null }
  );

  useEffect(() => {
    if (fromModule === "webinar" && webinarFeed) {
      setPrefillData({
        title: webinarFeed.title,
        topic: webinarFeed.webinarTopic,
        audience: webinarFeed.targetAudience,
        sourceNarrative: webinarFeed.sourceNarrative,
        webinarSessionId: webinarFeed.webinarSessionId,
        fromLabel: `Webinar: "${webinarFeed.webinarTopic}"`,
      });
      setPrefillDialogOpen(true);
      // Clean up URL params
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fromModule, webinarFeed]);

  useEffect(() => {
    if (fromModule === "landingPage" && landingPageFeed) {
      setPrefillData({
        title: landingPageFeed.title,
        topic: landingPageFeed.topic,
        audience: landingPageFeed.targetAudience,
        sourceNarrative: landingPageFeed.sourceNarrative,
        landingPageId: landingPageFeed.landingPageId,
        fromLabel: `Landing Page: "${landingPageFeed.pageTitle}"`,
      });
      setPrefillDialogOpen(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fromModule, landingPageFeed]);

  const { data: ebooks, isLoading } = trpc.ebook.listEbooks.useQuery();
  const { data: books } = trpc.bookLibrary.listBooks.useQuery();
  const deleteEbook = trpc.ebook.deleteEbook.useMutation({
    onSuccess: () => utils.ebook.listEbooks.invalidate(),
  });
  const resetStuckEbook = trpc.ebook.resetStuckEbook.useMutation({
    onSuccess: () => utils.ebook.listEbooks.invalidate(),
  });
  const retryFromList = trpc.ebook.retryFailedChapters.useMutation({
    onSuccess: () => utils.ebook.listEbooks.invalidate(),
  });
  const [resumingId, setResumingId] = useState<number | null>(null);
  const handleResume = async (e: React.MouseEvent, ebookId: number) => {
    e.stopPropagation();
    setResumingId(ebookId);
    try {
      // Step 1: reset stuck generating/pending chapters to failed
      await resetStuckEbook.mutateAsync({ ebookId });
      // Step 2: retry all failed chapters
      const result = await retryFromList.mutateAsync({ ebookId });
      if (result.succeededCount > 0) {
        toast.success(`Resumed — ${result.succeededCount} chapter${result.succeededCount !== 1 ? "s" : ""} generated`);
      } else if (result.failedCount > 0) {
        toast.error(`${result.failedCount} chapter${result.failedCount !== 1 ? "s" : ""} failed again — try once more`);
      } else {
        toast.info("No chapters needed retrying");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Resume failed");
    } finally {
      setResumingId(null);
    }
  };
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
    <DashboardLayout>
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
          <div className="flex items-center gap-2">
            <GenerateEbookDialog
              onSuccess={() => utils.ebook.listEbooks.invalidate()}
              prefillData={prefillData ?? undefined}
              open={prefillDialogOpen}
              onOpenChange={(o) => {
                setPrefillDialogOpen(o);
                if (!o) setPrefillData(null);
              }}
            />
          </div>
        </div>

        {/* Cross-module prefill confirmation banner */}
        {prefillData && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/8 border border-primary/20 text-sm">
            <GitFork className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1">
              <span className="font-medium">Pre-filled from </span>
              {prefillData.fromLabel ?? "another module"}
            </span>
            <button
              onClick={() => {
                setPrefillData(null);
                setPrefillDialogOpen(false);
                toast("Prefill cleared", { description: "Form reset to blank" });
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Undo prefill
            </button>
          </div>
        )}
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        disabled={resumingId === ebook.id}
                        onClick={(e) => handleResume(e, ebook.id)}
                      >
                        {resumingId === ebook.id ? (
                          <><Loader2 className="w-3 h-3 animate-spin" />Resuming...</>
                        ) : (
                          <><RefreshCw className="w-3 h-3" />Resume Generation</>
                        )}
                      </Button>
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
                  {/* Cross-module feed buttons */}
                  {ebook.status === "complete" && (
                    <div className="flex gap-1.5 pt-1 border-t border-border/30">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 flex-1 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/landing-pages?from=ebook&id=${ebook.id}`;
                        }}
                        title="Create a landing page using this e-book as a lead magnet"
                      >
                        <LayoutTemplate className="w-3 h-3" />
                        Landing Page
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 flex-1 text-muted-foreground hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/webinar-builder?from=ebook&id=${ebook.id}`;
                        }}
                        title="Create a webinar from this e-book's topic"
                      >
                        <Video className="w-3 h-3" />
                        Webinar
                        <ArrowUpRight className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
