import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { generateAllCards } from "@/components/TitleCardRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen,
  Upload,
  Sparkles,
  Download,
  Trash2,
  Image as ImageIcon,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Filter,
  Wand2,
  Quote,
  RefreshCw,
  Send,
  Hash,
  Linkedin,
  Twitter,
  Facebook,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore — deprecated but still available
  Instagram,
  Edit3,
  Check,
  X,
  Zap,
  ExternalLink,
  AlertTriangle,
  Star,
  RotateCcw,
  ThumbsDown,
  EyeOff,
  Eye,
  ArrowUpDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookStatus = "uploading" | "processing" | "ready" | "failed";
type TitleCardStatus = "pending" | "generating" | "ready" | "failed";
type SocialPlatform = "linkedin" | "x" | "meta" | "instagram_feed" | "instagram_reel" | "instagram_story";

interface Book {
  id: number;
  title: string;
  author: string | null;
  s3Url: string | null;
  wordCount: number | null;
  pageCount: number | null;
  status: BookStatus;
  createdAt: Date;
}

interface Snippet {
  id: number;
  bookId: number;
  passageText: string;
  theme: string | null;
  platform: string | null;
  chapter: string | null;
  titleCardUrl: string | null;
  titleCardLinkedinUrl: string | null;
  titleCardXUrl: string | null;
  titleCardMetaUrl: string | null;
  titleCardStatus: TitleCardStatus | null;
  titleCardInstagramFeedUrl: string | null;
  titleCardInstagramReelUrl: string | null;
  titleCardInstagramStoryUrl: string | null;
  linkedinCopy: string | null;
  xCopy: string | null;
  metaCopy: string | null;
  instagramCopy: string | null;
  instagramReelCopy: string | null;
  hashtags: string | null;
  ctaText: string | null;
  bufferSentAt: Date | null;
  savedToKanban: boolean | null;
  qualityScore: number | null;
  shareabilityType: string | null;
  publishedLinkedinAt: Date | null;
  publishedXAt: Date | null;
  publishedMetaAt: Date | null;
  publishedInstagramFeedAt: Date | null;
  publishedInstagramReelAt: Date | null;
  publishedInstagramStoryAt: Date | null;
  cardMood: string | null;
  cardFontSize: string | null;
  softRejected: boolean | null;
  createdAt: Date;
}

interface BufferChannel {
  id: string;
  platform: string;
  name: string;
  service: string;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BookStatus }) {
  const map: Record<BookStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    uploading: { label: "Uploading", variant: "secondary" },
    processing: { label: "Processing...", variant: "secondary" },
    ready: { label: "Ready", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── Upload Book Dialog ────────────────────────────────────────────────────────

function UploadBookDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const createBook = trpc.bookLibrary.createBook.useMutation();
  const processBook = trpc.bookLibrary.processBook.useMutation();

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Please provide a title and select a PDF file");
      return;
    }
    setUploading(true);
    try {
      // Step 1: Create book record in DB
      const { bookId } = await createBook.mutateAsync({ title: title.trim() });
      // Step 2: Upload PDF to S3 via server endpoint
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }
      const { s3Key, s3Url, text, pageCount } = await res.json();
      // Step 3: Process book (voice profile + snippets)
      const result = await processBook.mutateAsync({
        bookId,
        s3Key,
        s3Url,
        extractedText: text,
        pageCount,
      });
      toast.success(
        `"${title}" processed! Extracted ${result.snippetCount} quote-worthy snippets.`
      );
      setOpen(false);
      setTitle("");
      setFile(null);
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload Book
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a Book PDF</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>Book Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. The Urban Monk"
              className="mt-1"
            />
          </div>
          <div>
            <Label>PDF File</Label>
            <Input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1"
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
              </p>
            )}
          </div>
          {uploading && (
            <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Processing your book...</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Extracting text, building voice profile, and finding quote-worthy snippets. This takes 1-3 minutes.
                </p>
              </div>
            </div>
          )}
          <Button
            className="w-full gap-2"
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Upload & Process
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Snippet Social Panel ─────────────────────────────────────────────────────
// Full-featured panel: platform tabs, image preview, copy editor, Buffer push

function SnippetSocialPanel({
  snippet,
  bookId,
  onClose,
}: {
  snippet: Snippet;
  bookId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>("linkedin");
  const [editingCopy, setEditingCopy] = useState(false);
  const [editedCopy, setEditedCopy] = useState("");
  const [editingQuote, setEditingQuote] = useState(false);
  const [correctedQuote, setCorrectedQuote] = useState(snippet.passageText);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const { data: channels } = trpc.bookLibrary.getBufferChannels.useQuery();

  const regenerate = trpc.bookLibrary.regenerateTitleCard.useMutation({
    onSuccess: (res) => {
      utils.bookLibrary.getBook.invalidate({ bookId });
      toast.success(`${res.platform} title card regenerated!`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateCopy = trpc.bookLibrary.generateSocialCopy.useMutation({
    onSuccess: () => {
      utils.bookLibrary.getBook.invalidate({ bookId });
      toast.success("Social copy generated for all platforms!");
    },
    onError: (err) => toast.error(err.message),
  });

  const pushToBuffer = trpc.bookLibrary.pushSnippetToBuffer.useMutation({
    onSuccess: (res) => {
      utils.bookLibrary.getBook.invalidate({ bookId });
      toast.success(`Pushed to Buffer! ID: ${res.bufferId ?? "queued"}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const hashtags: string[] = (() => {
    try { return JSON.parse(snippet.hashtags ?? "[]"); } catch { return []; }
  })();

  const platformConfig = {
    linkedin: {
      label: "LinkedIn",
      icon: Linkedin,
      copy: snippet.linkedinCopy,
      imageUrl: snippet.titleCardLinkedinUrl ?? snippet.titleCardUrl,
      color: "text-blue-500",
      charLimit: 3000,
      imageFormat: "1200×627",
      aspectClass: "aspect-video",
    },
    x: {
      label: "X / Twitter",
      icon: Twitter,
      copy: snippet.xCopy,
      imageUrl: snippet.titleCardXUrl ?? snippet.titleCardUrl,
      color: "text-sky-400",
      charLimit: 280,
      imageFormat: "1600×900",
      aspectClass: "aspect-video",
    },
    meta: {
      label: "Meta",
      icon: Facebook,
      copy: snippet.metaCopy,
      imageUrl: snippet.titleCardMetaUrl ?? snippet.titleCardUrl,
      color: "text-indigo-400",
      charLimit: 2200,
      imageFormat: "1080×1080",
      aspectClass: "aspect-square",
    },
    instagram_feed: {
      label: "IG Feed",
      icon: Instagram,
      copy: snippet.instagramCopy,
      imageUrl: snippet.titleCardInstagramFeedUrl ?? snippet.titleCardUrl,
      color: "text-pink-500",
      charLimit: 2200,
      imageFormat: "1080×1080",
      aspectClass: "aspect-square",
    },
    instagram_reel: {
      label: "IG Reel",
      icon: Instagram,
      copy: snippet.instagramReelCopy,
      imageUrl: snippet.titleCardInstagramReelUrl ?? snippet.titleCardUrl,
      color: "text-fuchsia-500",
      charLimit: 300,
      imageFormat: "1080×1920",
      aspectClass: "aspect-[9/16] max-h-64",
    },
    instagram_story: {
      label: "IG Story",
      icon: Instagram,
      copy: snippet.instagramCopy,
      imageUrl: snippet.titleCardInstagramStoryUrl ?? snippet.titleCardUrl,
      color: "text-rose-500",
      charLimit: 2200,
      imageFormat: "1080×1920",
      aspectClass: "aspect-[9/16] max-h-64",
    },
  };

  const current = platformConfig[activePlatform];
  const currentCopy = editingCopy ? editedCopy : (current.copy ?? "");
  const charCount = currentCopy.length;
  const overLimit = charCount > current.charLimit;

  // Per-platform published state — used to lock the Push button and show status
  const platformPublishedAt: Record<SocialPlatform, Date | null> = {
    linkedin: snippet.publishedLinkedinAt ?? null,
    x: snippet.publishedXAt ?? null,
    meta: snippet.publishedMetaAt ?? null,
    instagram_feed: snippet.publishedInstagramFeedAt ?? null,
    instagram_reel: snippet.publishedInstagramReelAt ?? null,
    instagram_story: snippet.publishedInstagramStoryAt ?? null,
  };
  const isCurrentPlatformPublished = !!platformPublishedAt[activePlatform];

  const handleStartEdit = () => {
    setEditedCopy(current.copy ?? "");
    setEditingCopy(true);
  };

  const handlePush = () => {
    if (isCurrentPlatformPublished) {
      toast.error(`Already published to ${current.label}. Use Buffer to reschedule if needed.`);
      return;
    }
    if (selectedChannels.length === 0) {
      toast.error("Select at least one Buffer channel");
      return;
    }
    pushToBuffer.mutate({
      snippetId: snippet.id,
      platform: activePlatform,
      channelIds: selectedChannels,
      copyOverride: editingCopy ? editedCopy : undefined,
    });
  };

  // Filter channels by active platform
  const platformChannels = (channels ?? []).filter((c: BufferChannel) => {
    if (activePlatform === "linkedin") return c.service?.toLowerCase() === "linkedin";
    if (activePlatform === "x") return c.service?.toLowerCase() === "twitter" || c.service?.toLowerCase() === "x";
    if (activePlatform === "meta") return c.service?.toLowerCase() === "facebook";
    if (activePlatform === "instagram_feed" || activePlatform === "instagram_reel" || activePlatform === "instagram_story") {
      return c.service?.toLowerCase() === "instagram";
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b">
          <div className="flex-1 pr-4">
            {editingQuote ? (
              <div className="space-y-2">
                <Textarea
                  value={correctedQuote}
                  onChange={(e) => setCorrectedQuote(e.target.value)}
                  rows={3}
                  className="text-sm font-medium italic"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setEditingQuote(false)} className="gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    Done
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCorrectedQuote(snippet.passageText); setEditingQuote(false); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-sm italic text-foreground/80 leading-relaxed flex-1">
                  "{correctedQuote}"
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 h-6 w-6 p-0"
                  onClick={() => setEditingQuote(true)}
                  title="Fix typos in quote"
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {snippet.theme && <span className="capitalize">{snippet.theme}</span>}
              {snippet.chapter && <span> · {snippet.chapter}</span>}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Action bar */}
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => generateCopy.mutate({ snippetId: snippet.id })}
              disabled={generateCopy.isPending}
            >
              {generateCopy.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {snippet.linkedinCopy ? "Regenerate Copy" : "Generate Copy + Hashtags"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => regenerate.mutate({
                snippetId: snippet.id,
                correctedText: correctedQuote !== snippet.passageText ? correctedQuote : undefined,
                platform: activePlatform === "x" ? "x" : activePlatform,
              })}
              disabled={regenerate.isPending}
            >
              {regenerate.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Regenerate Image
            </Button>
          </div>

          {/* Platform Tabs */}
          <Tabs value={activePlatform} onValueChange={(v) => { setActivePlatform(v as SocialPlatform); setEditingCopy(false); }}>
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="linkedin" className="gap-1 text-xs px-1.5">
                <Linkedin className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">LinkedIn</span>
              </TabsTrigger>
              <TabsTrigger value="x" className="gap-1 text-xs px-1.5">
                <Twitter className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">X</span>
              </TabsTrigger>
              <TabsTrigger value="meta" className="gap-1 text-xs px-1.5">
                <Facebook className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Meta</span>
              </TabsTrigger>
              <TabsTrigger value="instagram_feed" className="gap-1 text-xs px-1.5">
                <Instagram className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Feed</span>
              </TabsTrigger>
              <TabsTrigger value="instagram_reel" className="gap-1 text-xs px-1.5">
                <Instagram className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Reel</span>
              </TabsTrigger>
              <TabsTrigger value="instagram_story" className="gap-1 text-xs px-1.5">
                <Instagram className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline">Story</span>
              </TabsTrigger>
            </TabsList>

            {(["linkedin", "x", "meta", "instagram_feed", "instagram_reel", "instagram_story"] as SocialPlatform[]).map((platform) => {
              const cfg = platformConfig[platform];
              const platformCopy = platform === activePlatform && editingCopy ? editedCopy : (cfg.copy ?? "");
              return (
                <TabsContent key={platform} value={platform} className="mt-4">
                  <div className="grid grid-cols-5 gap-5">
                    {/* Image preview */}
                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Image · {cfg.imageFormat}
                        </p>
                        {cfg.imageUrl && (
                          <a
                            href={cfg.imageUrl}
                            download
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            Save
                          </a>
                        )}
                      </div>
                      {cfg.imageUrl ? (
                        <div className={`rounded-lg overflow-hidden bg-muted ${cfg.aspectClass}`}>
                          <img
                            src={cfg.imageUrl}
                            alt={`${cfg.label} title card`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`rounded-lg bg-muted/50 flex flex-col items-center justify-center gap-2 ${cfg.aspectClass}`}>
                          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                          <p className="text-xs text-muted-foreground text-center px-2">
                            No image yet.<br />Click "Regenerate Image"
                          </p>
                        </div>
                      )}
                      {snippet.bufferSentAt && (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Pushed {new Date(snippet.bufferSentAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Copy editor */}
                    <div className="col-span-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Post Copy
                        </p>
                        {platformCopy && !editingCopy && (
                          <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={handleStartEdit}>
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </Button>
                        )}
                        {editingCopy && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs" onClick={() => setEditingCopy(false)}>
                              <Check className="w-3 h-3" />
                              Done
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs text-muted-foreground" onClick={() => { setEditingCopy(false); }}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>

                      {platformCopy ? (
                        editingCopy ? (
                          <div className="space-y-1.5">
                            <Textarea
                              value={editedCopy}
                              onChange={(e) => setEditedCopy(e.target.value)}
                              rows={platform === "linkedin" ? 10 : 6}
                              className="text-sm font-mono"
                            />
                            <div className={`text-xs text-right ${overLimit ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              {charCount} / {cfg.charLimit}
                              {overLimit && " — over limit!"}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-muted/30 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {platformCopy}
                          </div>
                        )
                      ) : (
                        <div className="bg-muted/20 rounded-lg p-4 text-center text-sm text-muted-foreground border border-dashed">
                          <Sparkles className="w-5 h-5 mx-auto mb-2 opacity-40" />
                          Click "Generate Copy + Hashtags" to create platform-optimized post copy
                        </div>
                      )}

                      {/* Hashtags */}
                      {hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          {hashtags.slice(0, 8).map((tag) => (
                            <span key={tag} className="text-xs text-primary/80 bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* CTA */}
                      {snippet.ctaText && (
                        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                          <Zap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            {snippet.ctaText}
                            {(platform === "instagram_feed" || platform === "instagram_reel" || platform === "instagram_story") && (
                              <span className="ml-1 text-amber-600/70">(sent as first comment — link in bio)</span>
                            )}
                          </p>
                        </div>
                      )}

                      {/* Buffer channels + push */}
                      <div className="border-t pt-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Send className="w-3 h-3" />
                          Push to Buffer
                        </p>
                        {/* Published state banner — prevents double-posting */}
                        {platform === activePlatform && isCurrentPlatformPublished && (
                          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              Already published to {cfg.label} on{" "}
                              {platformPublishedAt[platform as SocialPlatform]?.toLocaleDateString()}.
                              To re-post, manage it directly in Buffer.
                            </p>
                          </div>
                        )}
                        {platformChannels.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No {cfg.label} channels connected in Buffer.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {platformChannels.map((ch: BufferChannel) => (
                              <label key={ch.id} className={`flex items-center gap-2 cursor-pointer ${platform === activePlatform && isCurrentPlatformPublished ? "opacity-50 pointer-events-none" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedChannels.includes(ch.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedChannels((prev) => [...prev, ch.id]);
                                    } else {
                                      setSelectedChannels((prev) => prev.filter((id) => id !== ch.id));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm">{ch.name}</span>
                                <span className="text-xs text-muted-foreground capitalize">({ch.service})</span>
                              </label>
                            ))}
                            <Button
                              size="sm"
                              className="gap-1.5 mt-2 bg-[#3d5a80] hover:bg-[#2e4461] text-white"
                              onClick={handlePush}
                              disabled={
                                pushToBuffer.isPending ||
                                selectedChannels.length === 0 ||
                                !platformCopy ||
                                overLimit ||
                                (platform === activePlatform && isCurrentPlatformPublished)
                              }
                            >
                              {pushToBuffer.isPending ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : platform === activePlatform && isCurrentPlatformPublished ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              {pushToBuffer.isPending
                                ? "Pushing..."
                                : platform === activePlatform && isCurrentPlatformPublished
                                ? "Published ✓"
                                : `Push to Buffer (${selectedChannels.length})`}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── Snippet Card ─────────────────────────────────────────────────────────────

function SnippetCard({
  snippet,
  bookId,
  bookTitle,
  onGenerateCard,
  generating,
  onSoftReject,
  isHiddenView,
}: {
  snippet: Snippet;
  bookId: number;
  bookTitle: string;
  onGenerateCard: (id: number) => void;
  generating: boolean;
  onSoftReject: (id: number, rejected: boolean) => void;
  isHiddenView: boolean;
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string>(snippet.cardMood ?? "forest_dark");
  const [selectedFontSize, setSelectedFontSize] = useState<string>(snippet.cardFontSize ?? "medium");
  const [isClientGenerating, setIsClientGenerating] = useState(false);
  const [clientProgress, setClientProgress] = useState<{ done: number; total: number } | null>(null);
  const utils = trpc.useUtils();

  const updateStyle = trpc.bookLibrary.updateSnippetStyle.useMutation({
    onSuccess: () => utils.bookLibrary.getBook.invalidate({ bookId }),
  });

  const getCardBackground = trpc.bookLibrary.getCardBackground.useMutation();
  const saveCardUrls = trpc.bookLibrary.saveCardUrls.useMutation();

  const handleGenerateAllCards = useCallback(async () => {
    setIsClientGenerating(true);
    setClientProgress({ done: 0, total: 6 });
    try {
      // Step 1: Get AI background from server (also returns the real book title)
      const { backgroundUrl, bookTitle: serverBookTitle } = await getCardBackground.mutateAsync({
        snippetId: snippet.id,
        mood: selectedMood as "forest_dark" | "stone_gray" | "ink_black" | "warm_amber",
      });

      // Step 2: Render all 6 platform cards in the browser and upload to S3
      // Use server-returned bookTitle as authoritative source (fallback to prop)
      // Guard: only use serverBookTitle if it's a non-empty string
      const resolvedBookTitle = (serverBookTitle && serverBookTitle.trim().length > 0)
        ? serverBookTitle
        : (bookTitle && bookTitle.trim().length > 0 ? bookTitle : "The Urban Monk");
      const urls = await generateAllCards({
        quoteText: snippet.passageText,
        authorName: "Dr. Pedram Shojai",
        bookTitle: resolvedBookTitle,
        brandName: "The Urban Monk",
        backgroundUrl: backgroundUrl ?? null,
        mood: selectedMood as "forest_dark" | "stone_gray" | "ink_black" | "warm_amber",
        fontSize: selectedFontSize as "large" | "medium" | "small",
        onProgress: (done, total) => setClientProgress({ done, total }),
      });

      // Step 3: Persist the URLs in the DB
      const result = await saveCardUrls.mutateAsync({
        snippetId: snippet.id,
        urls: {
          linkedin:        urls.linkedin        ?? null,
          x:               urls.x               ?? null,
          meta:            urls.meta            ?? null,
          instagram_feed:  urls.instagram_feed  ?? null,
          instagram_reel:  urls.instagram_reel  ?? null,
          instagram_story: urls.instagram_story ?? null,
        },
      });

      toast.success(`Generated ${result.generated}/6 platform cards!`);
      utils.bookLibrary.getBook.invalidate({ bookId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Card generation failed";
      toast.error(msg);
    } finally {
      setIsClientGenerating(false);
      setClientProgress(null);
    }
  }, [snippet.id, snippet.passageText, bookTitle, selectedMood, selectedFontSize, bookId]);

  const hasCopy = snippet.linkedinCopy || snippet.xCopy || snippet.metaCopy;
  const hasAnyCard = snippet.titleCardUrl || snippet.titleCardLinkedinUrl || snippet.titleCardXUrl;
  const isGenerating = generating || snippet.titleCardStatus === "generating" || isClientGenerating;

  // Per-platform published state map
  const publishedMap: Record<string, boolean> = {
    linkedin: !!snippet.publishedLinkedinAt,
    x: !!snippet.publishedXAt,
    meta: !!snippet.publishedMetaAt,
    instagram_feed: !!snippet.publishedInstagramFeedAt,
    instagram_reel: !!snippet.publishedInstagramReelAt,
    instagram_story: !!snippet.publishedInstagramStoryAt,
  };
  const publishedCount = Object.values(publishedMap).filter(Boolean).length;

  return (
    <>
      <Card
        className={`group hover:border-primary/30 transition-colors cursor-pointer ${
          snippet.softRejected ? "opacity-60 border-dashed" : ""
        }`}
        onClick={() => !isHiddenView && setShowPanel(true)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Title card preview — shows default (meta/square) card or placeholder */}
          {snippet.titleCardUrl ? (
            <div className="relative rounded-md overflow-hidden aspect-square bg-muted">
              <img
                src={snippet.titleCardUrl}
                alt="Title card"
                className="w-full h-full object-cover"
              />
              {/* Published platform dots */}
              {publishedCount > 0 && (
                <div className="absolute top-2 left-2 flex gap-1">
                  {publishedMap.linkedin && <div className="w-2 h-2 rounded-full bg-blue-500" title="Published to LinkedIn" />}
                  {publishedMap.x && <div className="w-2 h-2 rounded-full bg-sky-400" title="Published to X" />}
                  {publishedMap.meta && <div className="w-2 h-2 rounded-full bg-indigo-400" title="Published to Meta" />}
                  {(publishedMap.instagram_feed || publishedMap.instagram_reel || publishedMap.instagram_story) && (
                    <div className="w-2 h-2 rounded-full bg-pink-500" title="Published to Instagram" />
                  )}
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isHiddenView && (
                  <a
                    href={snippet.titleCardUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-black/60 rounded-full p-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="w-3 h-3 text-white" />
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-square bg-muted/50 rounded-md flex items-center justify-center">
              <Quote className="w-8 h-8 text-muted-foreground/30" />
            </div>
          )}

          {/* Quote text */}
          <p className="text-sm leading-relaxed line-clamp-3 text-foreground/90 italic">
            "{snippet.passageText}"
          </p>

          {/* Meta */}
          <div className="flex flex-wrap gap-1.5">
            {snippet.theme && (
              <Badge variant="outline" className="text-xs capitalize">
                {snippet.theme}
              </Badge>
            )}
            {snippet.qualityScore != null && (
              <Badge
                variant="outline"
                className={`text-xs gap-1 ${
                  snippet.qualityScore >= 9
                    ? "text-amber-500 border-amber-500/30 bg-amber-500/10"
                    : snippet.qualityScore >= 7
                    ? "text-emerald-500 border-emerald-500/30"
                    : "text-muted-foreground"
                }`}
                title={`Quality score: ${snippet.qualityScore}/10`}
              >
                <Star className="w-2.5 h-2.5" />
                {snippet.qualityScore}/10
              </Badge>
            )}
            {snippet.shareabilityType && (
              <Badge variant="outline" className="text-xs capitalize text-violet-400 border-violet-500/30">
                {snippet.shareabilityType}
              </Badge>
            )}
            {hasCopy && (
              <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-500/30">
                <Sparkles className="w-2.5 h-2.5" />
                Copy ready
              </Badge>
            )}
          </div>

          {/* Style selectors — mood and font size */}
          <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            <Select
              value={selectedMood}
              onValueChange={(v) => {
                setSelectedMood(v);
                updateStyle.mutate({ snippetId: snippet.id, mood: v as "forest_dark" | "stone_gray" | "ink_black" | "warm_amber" });
              }}
            >
              <SelectTrigger className="h-6 text-xs w-[110px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="forest_dark">🌲 Forest Dark</SelectItem>
                <SelectItem value="stone_gray">🪨 Stone Gray</SelectItem>
                <SelectItem value="ink_black">🖤 Ink Black</SelectItem>
                <SelectItem value="warm_amber">🔥 Warm Amber</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={selectedFontSize}
              onValueChange={(v) => {
                setSelectedFontSize(v);
                updateStyle.mutate({ snippetId: snippet.id, fontSize: v as "large" | "medium" | "small" });
              }}
            >
              <SelectTrigger className="h-6 text-xs w-[80px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="small">Small</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions — Generate All Cards at snippet level, then Review & Publish */}
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {!hasAnyCard ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs"
                onClick={handleGenerateAllCards}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ImageIcon className="w-3 h-3" />
                )}
                {isClientGenerating && clientProgress
                  ? `${clientProgress.done}/${clientProgress.total} cards...`
                  : isGenerating
                  ? "Generating..."
                  : "Generate All Cards"}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-xs"
                  onClick={() => setShowPanel(true)}
                >
                  <Send className="w-3 h-3" />
                  {publishedCount > 0 ? `Review (${publishedCount}/6 published)` : "Review & Publish"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs px-2"
                  title="Regenerate all platform cards with current style"
                  onClick={handleGenerateAllCards}
                  disabled={isGenerating}
                >
                  {isClientGenerating && clientProgress
                    ? <span className="text-xs">{clientProgress.done}/{clientProgress.total}</span>
                    : isGenerating
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <RotateCcw className="w-3 h-3" />}
                </Button>
              </>
            )}
          </div>

          {/* Soft-reject / restore button */}
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 gap-1 text-xs px-2 ${
                snippet.softRejected
                  ? "text-emerald-600 hover:text-emerald-700"
                  : "text-muted-foreground hover:text-destructive"
              }`}
              title={snippet.softRejected ? "Restore snippet" : "Hide snippet (soft reject)"}
              onClick={() => onSoftReject(snippet.id, !snippet.softRejected)}
            >
              {snippet.softRejected ? (
                <><Eye className="w-3 h-3" /> Restore</>
              ) : (
                <><ThumbsDown className="w-3 h-3" /> Hide</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {showPanel && (
        <SnippetSocialPanel
          snippet={snippet}
          bookId={bookId}
          onClose={() => setShowPanel(false)}
        />
      )}
    </>
  );
}

// ─── Book Detail Panel ────────────────────────────────────────────────────────

function BookDetailPanel({
  bookId,
  onBack,
}: {
  bookId: number;
  onBack: () => void;
}) {
  const [themeFilter, setThemeFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("score_desc");
  const [showHidden, setShowHidden] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [confirmReExtract, setConfirmReExtract] = useState(false);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bookLibrary.getBook.useQuery({ bookId });
  const generateCard = trpc.bookLibrary.generateTitleCard.useMutation({
    onSuccess: () => utils.bookLibrary.getBook.invalidate({ bookId }),
  });
  const generateAll = trpc.bookLibrary.generateAllTitleCards.useMutation({
    onSuccess: (result) => {
      toast.success(`Generated ${result.generated} title cards`);
      utils.bookLibrary.getBook.invalidate({ bookId });
    },
  });
  const softReject = trpc.bookLibrary.softRejectSnippet.useMutation({
    onSuccess: () => utils.bookLibrary.getBook.invalidate({ bookId }),
    onError: (err) => toast.error(err.message),
  });

  const reExtract = trpc.bookLibrary.reExtractSnippets.useMutation({
    onSuccess: (result) => {
      toast.success(`Re-extraction complete! ${result.snippetCount} quality snippets found.`);
      utils.bookLibrary.getBook.invalidate({ bookId });
      setConfirmReExtract(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setConfirmReExtract(false);
    },
  });

  const handleGenerateCard = async (snippetId: number) => {
    setGeneratingId(snippetId);
    try {
      await generateCard.mutateAsync({ snippetId });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      toast.error(msg);
    } finally {
      setGeneratingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const { book, snippets } = data;

  const allThemes = snippets.map((s) => s.theme).filter(Boolean) as string[];
  const themes = allThemes.filter((v, i, a) => a.indexOf(v) === i);
  const hiddenCount = snippets.filter((s) => s.softRejected).length;

  const filteredSnippets = snippets
    .filter((s) => {
      if (!showHidden && s.softRejected) return false;
      if (showHidden && !s.softRejected) return false;
      if (themeFilter !== "all" && s.theme !== themeFilter) return false;
      if (platformFilter !== "all" && s.platform !== platformFilter) return false;
      if (minScore > 0 && (s.qualityScore ?? 0) < minScore) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case "score_desc":
          return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
        case "score_asc":
          return (a.qualityScore ?? 0) - (b.qualityScore ?? 0);
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

  const pendingCount = snippets.filter((s) => s.titleCardStatus === "pending").length;
  const readyCount = snippets.filter((s) => s.titleCardStatus === "ready").length;
  const publishedCount = snippets.filter((s) => s.bufferSentAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            ← Back
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{book.title}</h2>
            <p className="text-sm text-muted-foreground">
              {book.wordCount?.toLocaleString()} words · {snippets.length} snippets ·{" "}
              {readyCount} cards ready · {publishedCount} pushed to Buffer
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => generateAll.mutate({ bookId })}
              disabled={generateAll.isPending}
            >
              {generateAll.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              Generate All Cards ({pendingCount})
            </Button>
          )}
          {/* Re-extract: purge old snippets and run the two-stage quality pipeline */}
          {!confirmReExtract ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => setConfirmReExtract(true)}
              disabled={reExtract.isPending}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Re-extract Snippets
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-xs text-amber-400">This will delete all {snippets.length} existing snippets and re-run the quality pipeline.</span>
              <Button
                size="sm"
                variant="destructive"
                className="h-6 text-xs px-2"
                onClick={() => reExtract.mutate({ bookId })}
                disabled={reExtract.isPending}
              >
                {reExtract.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={() => setConfirmReExtract(false)}
                disabled={reExtract.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters + Sort */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={themeFilter} onValueChange={setThemeFilter}>
            <SelectTrigger className="w-40 h-8 text-sm">
              <SelectValue placeholder="All themes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All themes</SelectItem>
              {themes.map((t) => (
                <SelectItem key={t!} value={t!} className="capitalize">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="twitter">Twitter/X</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
          </SelectContent>
        </Select>
        {/* Sort order */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score_desc">Highest Score First</SelectItem>
              <SelectItem value="score_asc">Lowest Score First</SelectItem>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Minimum quality score slider */}
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {minScore === 0 ? "All scores" : `${minScore}+`}
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-24 accent-amber-500 cursor-pointer"
            title={`Minimum quality score: ${minScore === 0 ? "show all" : minScore + "+"}`}
          />
          {minScore > 0 && (
            <button
              onClick={() => setMinScore(0)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Reset score filter"
            >
              ✕
            </button>
          )}
        </div>
        {/* Show/hide rejected snippets */}
        <Button
          variant={showHidden ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1.5 text-sm"
          onClick={() => setShowHidden((v) => !v)}
        >
          {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showHidden
            ? `Showing ${hiddenCount} hidden`
            : hiddenCount > 0
            ? `Hidden (${hiddenCount})`
            : "No hidden"}
        </Button>
        <span className="text-sm text-muted-foreground self-center ml-auto">
          {filteredSnippets.length} snippets
        </span>
      </div>

      {/* Snippet Grid */}
      {filteredSnippets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Quote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{showHidden ? "No hidden snippets" : "No snippets match your filters"}</p>
          {!showHidden && minScore > 0 && (
            <p className="text-sm mt-1 text-amber-500">
              Score floor is set to {minScore}+. Try lowering it to see more snippets.
            </p>
          )}
          {showHidden && hiddenCount === 0 && (
            <p className="text-sm mt-1">Use the thumbs-down button on any snippet to hide it here.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredSnippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet as Snippet}
              bookId={bookId}
              bookTitle={book.title}
              onGenerateCard={handleGenerateCard}
              generating={generatingId === snippet.id}
              onSoftReject={(id, rejected) => softReject.mutate({ snippetId: id, softRejected: rejected })}
              isHiddenView={showHidden}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookLibrary() {
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: books, isLoading } = trpc.bookLibrary.listBooks.useQuery();
  const deleteBook = trpc.bookLibrary.deleteBook.useMutation({
    onSuccess: () => utils.bookLibrary.listBooks.invalidate(),
  });

  const handleDelete = async (bookId: number, title: string) => {
    if (!confirm(`Delete "${title}" and all its snippets? This cannot be undone.`)) return;
    try {
      await deleteBook.mutateAsync({ bookId });
      toast.success("Book deleted");
      if (selectedBookId === bookId) setSelectedBookId(null);
    } catch {
      toast.error("Failed to delete book");
    }
  };

  if (selectedBookId) {
    return (
      <BookDetailPanel
        bookId={selectedBookId}
        onBack={() => setSelectedBookId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Book Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upload your books to extract quote cards and generate social media content
          </p>
        </div>
        <UploadBookDialog onSuccess={() => utils.bookLibrary.listBooks.invalidate()} />
      </div>

      {/* Books grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !books || books.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">No books yet</p>
          <p className="text-sm mt-1">Upload a PDF to extract quote-worthy snippets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((book) => (
            <Card
              key={book.id}
              className="hover:border-primary/30 transition-colors cursor-pointer group"
              onClick={() => book.status === "ready" && setSelectedBookId(book.id)}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">{book.title}</h3>
                      {book.author && (
                        <p className="text-xs text-muted-foreground">{book.author}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={book.status as BookStatus} />
                </div>

                <div className="flex gap-4 text-xs text-muted-foreground">
                  {book.wordCount && <span>{book.wordCount.toLocaleString()} words</span>}
                  {book.pageCount && <span>{book.pageCount} pages</span>}
                </div>

                <div className="flex items-center justify-between">
                  {book.status === "ready" ? (
                    <div className="flex items-center gap-1 text-primary text-sm font-medium">
                      View Snippets
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  ) : book.status === "processing" ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Processing...
                    </div>
                  ) : book.status === "failed" ? (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3 h-3" />
                      Processing failed
                    </div>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1 ml-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(book.id, book.title);
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
  );
}
