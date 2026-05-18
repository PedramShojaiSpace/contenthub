import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BookStatus = "uploading" | "processing" | "ready" | "failed";
type TitleCardStatus = "pending" | "generating" | "ready" | "failed";

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
  titleCardStatus: TitleCardStatus | null;
  savedToKanban: boolean | null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BookStatus }) {
  const map: Record<BookStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    uploading: { label: "Uploading", variant: "secondary" },
    processing: { label: "Processing", variant: "secondary" },
    ready: { label: "Ready", variant: "default" },
    failed: { label: "Failed", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ─── PDF Upload + Text Extraction ─────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  // Use pdf-parse via a FormData upload to the server
  // We'll send the file to a dedicated upload endpoint
  const formData = new FormData();
  formData.append("pdf", file);

  const response = await fetch("/api/books/extract-pdf", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("PDF extraction failed");
  }

  const data = await response.json();
  return { text: data.text, pageCount: data.pageCount };
}

// ─── Upload Book Dialog ───────────────────────────────────────────────────────

function UploadBookDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  const createBook = trpc.bookLibrary.createBook.useMutation();
  const processBook = trpc.bookLibrary.processBook.useMutation();

  const handleUpload = async () => {
    if (!title.trim() || !file) {
      toast.error("Please enter a title and select a PDF file");
      return;
    }

    setUploading(true);
    try {
      // Step 1: Create book record
      setProgress("Creating book record...");
      const { bookId } = await createBook.mutateAsync({ title: title.trim() });

      // Step 2: Upload PDF to server and extract text
      setProgress("Uploading PDF and extracting text...");
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("bookId", String(bookId));

      const uploadResp = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResp.ok) {
        throw new Error("PDF upload failed");
      }

      const uploadData = await uploadResp.json();

      // Step 3: Process book (voice profile + snippets)
      setProgress("Extracting voice profile and quotes (this takes ~30 seconds)...");
      const result = await processBook.mutateAsync({
        bookId,
        s3Key: uploadData.s3Key,
        s3Url: uploadData.s3Url,
        extractedText: uploadData.text,
        pageCount: uploadData.pageCount,
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
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload Book PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload a Book</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="book-title">Book Title</Label>
            <Input
              id="book-title"
              placeholder="e.g. The Urban Monk"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
            />
          </div>
          <div className="space-y-2">
            <Label>PDF File</Label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span className="font-medium">{file.name}</span>
                  <span className="text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Click to select a PDF file
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          {progress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {progress}
            </div>
          )}
          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={uploading || !title.trim() || !file}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Upload & Extract Quotes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Snippet Card ─────────────────────────────────────────────────────────────

function SnippetCard({
  snippet,
  onGenerateCard,
  generating,
}: {
  snippet: Snippet;
  onGenerateCard: (id: number) => void;
  generating: boolean;
}) {
  const platformColors: Record<string, string> = {
    instagram: "bg-pink-500/10 text-pink-400 border-pink-500/20",
    linkedin: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    twitter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    facebook: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    all: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };

  return (
    <Card className="group hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Title card preview */}
        {snippet.titleCardUrl ? (
          <div className="relative rounded-md overflow-hidden aspect-square bg-muted">
            <img
              src={snippet.titleCardUrl}
              alt="Title card"
              className="w-full h-full object-cover"
            />
            <a
              href={snippet.titleCardUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Download className="w-3 h-3 text-white" />
            </a>
          </div>
        ) : (
          <div className="aspect-square bg-muted/50 rounded-md flex items-center justify-center">
            <Quote className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}

        {/* Quote text */}
        <p className="text-sm leading-relaxed line-clamp-4 text-foreground/90 italic">
          "{snippet.passageText}"
        </p>

        {/* Meta */}
        <div className="flex flex-wrap gap-1.5">
          {snippet.theme && (
            <Badge variant="outline" className="text-xs capitalize">
              {snippet.theme}
            </Badge>
          )}
          {snippet.platform && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                platformColors[snippet.platform] ?? "bg-muted text-muted-foreground"
              }`}
            >
              {snippet.platform}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {snippet.titleCardStatus === "ready" ? (
            <Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
              <a href={snippet.titleCardUrl!} download target="_blank" rel="noopener noreferrer">
                <Download className="w-3 h-3" />
                Download
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={() => onGenerateCard(snippet.id)}
              disabled={generating || snippet.titleCardStatus === "generating"}
            >
              {snippet.titleCardStatus === "generating" || generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ImageIcon className="w-3 h-3" />
              )}
              {snippet.titleCardStatus === "generating" || generating
                ? "Generating..."
                : "Make Card"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
  const [generatingId, setGeneratingId] = useState<number | null>(null);

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
  const filteredSnippets = snippets.filter((s) => {
    if (themeFilter !== "all" && s.theme !== themeFilter) return false;
    if (platformFilter !== "all" && s.platform !== platformFilter) return false;
    return true;
  });

  const pendingCount = snippets.filter((s) => s.titleCardStatus === "pending").length;
  const readyCount = snippets.filter((s) => s.titleCardStatus === "ready").length;

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
              {readyCount} title cards ready
            </p>
          </div>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
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
        <span className="text-sm text-muted-foreground self-center">
          {filteredSnippets.length} snippets
        </span>
      </div>

      {/* Snippet Grid */}
      {filteredSnippets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Quote className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No snippets match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredSnippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onGenerateCard={handleGenerateCard}
              generating={generatingId === snippet.id}
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
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <BookDetailPanel
            bookId={selectedBookId}
            onBack={() => setSelectedBookId(null)}
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
              <BookOpen className="w-8 h-8 text-primary" />
              Book Library
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload your published books to extract quote cards and learn your voice
            </p>
          </div>
          <UploadBookDialog
            onSuccess={() => utils.bookLibrary.listBooks.invalidate()}
          />
        </div>

        {/* Stats bar */}
        {books && books.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{books.length}</p>
                  <p className="text-xs text-muted-foreground">Books uploaded</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {books.filter((b) => b.status === "ready").length}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready for use</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <Quote className="w-5 h-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {books
                      .filter((b) => b.status === "ready")
                      .reduce((acc, b) => acc + (b.wordCount ?? 0), 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total words indexed</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Book List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : books && books.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/30" />
            <div>
              <h3 className="text-lg font-medium">No books yet</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Upload your first book PDF to start extracting quote cards and building your voice profile
              </p>
            </div>
            <UploadBookDialog
              onSuccess={() => utils.bookLibrary.listBooks.invalidate()}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books?.map((book) => (
              <Card
                key={book.id}
                className="group hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => book.status === "ready" && setSelectedBookId(book.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{book.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {book.author ?? "Dr. Pedram Shojai"}
                      </p>
                    </div>
                    <StatusBadge status={book.status} />
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex gap-3">
                      {book.pageCount && <span>{book.pageCount} pages</span>}
                      {book.wordCount && (
                        <span>{book.wordCount.toLocaleString()} words</span>
                      )}
                    </div>
                    {book.status === "ready" && (
                      <div className="flex items-center gap-1 text-primary text-xs font-medium">
                        View snippets
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    )}
                    {(book.status === "uploading" || book.status === "processing") && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                  </div>
                  {book.status === "failed" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Processing failed — try uploading again
                    </div>
                  )}
                  {/* Delete button */}
                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
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

        {/* Voice Profile Info */}
        {books && books.filter((b) => b.status === "ready").length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-5 flex items-start gap-4">
              <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Voice Profile Active</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your voice profile has been extracted from{" "}
                  {books.filter((b) => b.status === "ready").length} book
                  {books.filter((b) => b.status === "ready").length !== 1 ? "s" : ""}. 
                  The E-Book Generator will use this profile to write in your exact voice. 
                  Upload more books to strengthen the profile.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
