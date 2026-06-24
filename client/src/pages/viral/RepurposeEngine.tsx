import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { RefreshCw, Copy, Clock, ChevronDown, ChevronUp, Loader2, BookOpen, Kanban, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

const SOURCE_TYPES = [
  { value: "book_chapter", label: "Book Chapter" },
  { value: "podcast_transcript", label: "Podcast Transcript" },
  { value: "blog_post", label: "Blog Post / Article" },
  { value: "interview", label: "Interview / Q&A" },
  { value: "speech", label: "Speech / Talk" },
];

// Map repurpose platform names to Kanban platform enum values
const PLATFORM_MAP: Record<string, "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel"> = {
  tiktok: "tiktok",
  instagram: "meta",
  youtube: "youtube",
  linkedin: "linkedin",
  x: "x",
};

interface RepurposedPost {
  platform: string;
  hook: string;
  script: string;
  caption: string;
  hashtags: string[];
}

interface RepurposeResult {
  id: number;
  sourceType: string;
  sourceTitle: string | null;
  posts: RepurposedPost[];
  keyInsights: string[];
  quotableLines: string[];
  createdAt: Date | string;
}

function PostCard({
  post,
  onCopy,
  onSendToKanban,
  isSending,
  isSent,
}: {
  post: RepurposedPost;
  onCopy: (t: string) => void;
  onSendToKanban?: () => void;
  isSending?: boolean;
  isSent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const platformColors: Record<string, string> = {
    tiktok: "bg-pink-100 text-pink-700 border-pink-200",
    instagram: "bg-purple-100 text-purple-700 border-purple-200",
    youtube: "bg-red-100 text-red-700 border-red-200",
    linkedin: "bg-blue-100 text-blue-700 border-blue-200",
    x: "bg-gray-100 text-gray-700 border-gray-200",
  };
  const color = platformColors[post.platform] ?? "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className={`text-xs capitalize shrink-0 ${color}`}>{post.platform}</Badge>
          <span className="text-sm truncate text-muted-foreground">{post.hook}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSendToKanban && (
            <button
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                isSent
                  ? "bg-green-100 text-green-700 border-green-300"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-primary"
              }`}
              onClick={(e) => { e.stopPropagation(); if (!isSent) onSendToKanban(); }}
              disabled={isSending || isSent}
            >
              {isSent ? (
                <><CheckCircle2 className="w-3 h-3" />Saved</>
              ) : isSending ? (
                <><Loader2 className="w-3 h-3 animate-spin" />Saving...</>
              ) : (
                <><Kanban className="w-3 h-3" />Save to Kanban</>
              )}
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border space-y-3">
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">Hook</p>
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => onCopy(post.hook)}>
                <Copy className="w-3 h-3 mr-1" />Copy
              </Button>
            </div>
            <p className="text-sm font-medium text-foreground">{post.hook}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">Script</p>
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => onCopy(post.script)}>
                <Copy className="w-3 h-3 mr-1" />Copy
              </Button>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap font-mono">
              {post.script}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">Caption</p>
              <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5" onClick={() => onCopy(post.caption + "\n\n" + post.hashtags.join(" "))}>
                <Copy className="w-3 h-3 mr-1" />Copy with hashtags
              </Button>
            </div>
            <p className="text-sm text-foreground">{post.caption}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {post.hashtags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs text-blue-600 border-blue-200">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RepurposeEngine() {
  const [, setLocation] = useLocation();
  const [sourceType, setSourceType] = useState("book_chapter");

  // DB-driven book/chapter selection
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  const [sourceTitle, setSourceTitle] = useState("");
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram", "youtube", "linkedin"]);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [sentPlatforms, setSentPlatforms] = useState<Set<string>>(new Set());
  const [sendingPlatform, setSendingPlatform] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

  // Load uploaded books from DB (only when source type is book_chapter)
  const booksQuery = trpc.bookLibrary.listBooksForRepurpose.useQuery(undefined, {
    enabled: sourceType === "book_chapter",
  });

  // Auto-select first book when list loads
  useEffect(() => {
    if (booksQuery.data && booksQuery.data.length > 0 && selectedBookId === null) {
      setSelectedBookId(booksQuery.data[0].id);
    }
  }, [booksQuery.data, selectedBookId]);

  // Load chapters for selected book
  const chaptersQuery = trpc.bookLibrary.getBookChapters.useQuery(
    { bookId: selectedBookId! },
    { enabled: sourceType === "book_chapter" && selectedBookId !== null }
  );

  // Reset chapter + content when book changes
  useEffect(() => {
    setSelectedChapter(null);
    setContent("");
    setSourceTitle("");
  }, [selectedBookId]);

  // Auto-select first chapter when list loads
  useEffect(() => {
    if (chaptersQuery.data && chaptersQuery.data.length > 0 && selectedChapter === null) {
      setSelectedChapter(chaptersQuery.data[0]);
    }
  }, [chaptersQuery.data, selectedChapter]);

  // Fetch chapter text when chapter is selected
  const chapterTextQuery = trpc.bookLibrary.getChapterText.useQuery(
    { bookId: selectedBookId!, chapter: selectedChapter! },
    { enabled: sourceType === "book_chapter" && selectedBookId !== null && selectedChapter !== null }
  );

  // Auto-fill content textarea when chapter text loads
  useEffect(() => {
    if (chapterTextQuery.data) {
      setContent(chapterTextQuery.data.text);
      setSourceTitle(`${chapterTextQuery.data.bookTitle} — ${chapterTextQuery.data.chapter}`);
    }
  }, [chapterTextQuery.data]);

  const generateMutation = trpc.viralStudio.repurposeContent.useMutation({
    onSuccess: (data) => {
      setResult(data as unknown as RepurposeResult);
      setSentPlatforms(new Set());
      setAllSaved(false);
      toast.success(`${(data as unknown as RepurposeResult).posts.length} posts generated!`);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const createBulkMutation = trpc.content.createBulk.useMutation({
    onSuccess: (data) => {
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <span>
            {data.created} draft cards created in Command Center!{" "}
            <button
              className="underline font-medium"
              onClick={() => setLocation("/")}
            >
              View Kanban →
            </button>
          </span>
        </div>,
        { duration: 6000 }
      );
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const historyQuery = trpc.viralStudio.getRecentRepurposeJobs.useQuery({ limit: 10 });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const togglePlatform = (p: string) => {
    setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleGenerate = () => {
    if (!content.trim()) { toast.error("Select a chapter or paste content first"); return; }
    if (platforms.length === 0) { toast.error("Select at least one platform"); return; }
    generateMutation.mutate({
      sourceType: sourceType as "book_chapter",
      sourceTitle: sourceTitle || "",
      sourceText: content.trim(),
      targetPlatforms: platforms as ["tiktok"],
    });
  };

  const handleSaveOneToKanban = async (post: RepurposedPost) => {
    if (!result) return;
    setSendingPlatform(post.platform);
    try {
      const mappedPlatform = PLATFORM_MAP[post.platform] ?? "tiktok";
      const hookSafe = post.hook ?? "";
      const title = `[${post.platform.toUpperCase()}] ${result.sourceTitle ?? "Repurposed"} — ${hookSafe.slice(0, 60)}`;
      const textContent = `${hookSafe}\n\n${post.script ?? ""}\n\n---\nCaption:\n${post.caption ?? ""}\n\n${(post.hashtags ?? []).join(" ")}`;
      await createBulkMutation.mutateAsync({
        items: [{ title, rawIdea: hookSafe, platform: mappedPlatform, status: "idea", textContent }],
      });
      setSentPlatforms(prev => { const next = new Set(Array.from(prev)); next.add(post.platform); return next; });
    } finally {
      setSendingPlatform(null);
    }
  };

  const handleSaveAllToKanban = async () => {
    if (!result || result.posts.length === 0) return;
    setIsSavingAll(true);
    try {
      const items = result.posts.map((post) => {
        const mappedPlatform = PLATFORM_MAP[post.platform] ?? "tiktok";
        const hookSafe2 = post.hook ?? "";
        const title = `[${post.platform.toUpperCase()}] ${result.sourceTitle ?? "Repurposed"} — ${hookSafe2.slice(0, 60)}`;
        const textContent = `${hookSafe2}\n\n${post.script ?? ""}\n\n---\nCaption:\n${post.caption ?? ""}\n\n${(post.hashtags ?? []).join(" ")}`;
        return { title, rawIdea: hookSafe2, platform: mappedPlatform, status: "idea" as const, textContent };
      });
      await createBulkMutation.mutateAsync({ items });
      setSentPlatforms(new Set(result.posts.map(p => p.platform)));
      setAllSaved(true);
    } finally {
      setIsSavingAll(false);
    }
  };

  const PLATFORM_OPTIONS = ["tiktok", "instagram", "youtube", "linkedin", "x"];

  return (
    <div className="p-6 space-y-6">
      {/* Explainer */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-semibold text-green-900 mb-1 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          Turn Your Books &amp; Podcasts Into Viral Content
        </h3>
        <p className="text-sm text-green-700">
          Select a book and chapter — the content loads automatically. Then hit Repurpose to generate platform-optimized scripts for every channel simultaneously.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-green-500" />
              Source Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Source Type</Label>
              <Select value={sourceType} onValueChange={(v) => { setSourceType(v); setContent(""); setSourceTitle(""); }}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Book + Chapter dropdowns — only for book_chapter source type */}
            {sourceType === "book_chapter" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Book</Label>
                  {booksQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading books...
                    </div>
                  ) : booksQuery.data && booksQuery.data.length > 0 ? (
                    <Select
                      value={selectedBookId?.toString() ?? ""}
                      onValueChange={(v) => setSelectedBookId(Number(v))}
                    >
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select a book" /></SelectTrigger>
                      <SelectContent>
                        {booksQuery.data.map((b) => (
                          <SelectItem key={b.id} value={b.id.toString()}>{b.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      No books uploaded yet. Go to <strong>Book Library</strong> to upload your books first.
                    </p>
                  )}
                </div>

                {selectedBookId !== null && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Chapter</Label>
                    {chaptersQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading chapters...
                      </div>
                    ) : chaptersQuery.data && chaptersQuery.data.length > 0 ? (
                      <Select
                        value={selectedChapter ?? ""}
                        onValueChange={(v) => setSelectedChapter(v)}
                      >
                        <SelectTrigger className="text-sm"><SelectValue placeholder="Select a chapter" /></SelectTrigger>
                        <SelectContent>
                          {chaptersQuery.data.map((ch) => (
                            <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No chapters found — paste content below manually.
                      </p>
                    )}
                    {chapterTextQuery.isLoading && (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading chapter text...
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Content textarea */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Content to Repurpose *
                {sourceType === "book_chapter" && selectedChapter && (
                  <span className="ml-2 text-green-600 font-normal">— auto-loaded from {selectedChapter}</span>
                )}
              </Label>
              <Textarea
                placeholder={
                  sourceType === "book_chapter"
                    ? "Select a book and chapter above to auto-load the content, or paste manually here..."
                    : "Paste a podcast transcript, blog post, or any long-form content here..."
                }
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="text-sm resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">{content.length} characters</p>
            </div>

            {/* Platform toggles */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Output Platforms</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      platforms.includes(p)
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-background text-muted-foreground border-border hover:border-green-400"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !content.trim() || platforms.length === 0}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Repurposing content...</>
              ) : (
                <><RefreshCw className="w-4 h-4 mr-2" />Repurpose into {platforms.length} Platform{platforms.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {result.posts.length} Posts Generated
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs h-7 ${allSaved ? "text-green-600 border-green-300" : ""}`}
                    onClick={handleSaveAllToKanban}
                    disabled={isSavingAll || allSaved}
                  >
                    {allSaved ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" />All Saved</>
                    ) : isSavingAll ? (
                      <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</>
                    ) : (
                      <><Kanban className="w-3 h-3 mr-1" />Save All to Kanban</>
                    )}
                  </Button>
                </div>
                {result.sourceTitle && (
                  <p className="text-xs text-muted-foreground">Source: {result.sourceTitle}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {result.posts.map((post, i) => (
                  <PostCard
                    key={i}
                    post={post}
                    onCopy={handleCopy}
                    onSendToKanban={() => handleSaveOneToKanban(post)}
                    isSending={sendingPlatform === post.platform}
                    isSent={sentPlatforms.has(post.platform)}
                  />
                ))}

                {result.keyInsights && result.keyInsights.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Key Insights</p>
                      <ul className="space-y-1">
                        {result.keyInsights.map((insight, i) => (
                          <li key={i} className="text-xs text-foreground flex gap-2">
                            <span className="text-green-500 shrink-0">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {result.quotableLines && result.quotableLines.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Quotable Lines</p>
                      <div className="space-y-2">
                        {result.quotableLines.map((line, i) => (
                          <div key={i} className="flex items-start gap-2 group">
                            <p className="text-xs italic text-foreground flex-1">"{line}"</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-xs px-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              onClick={() => handleCopy(`"${line}"`)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <RefreshCw className="w-8 h-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No content repurposed yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Select a book chapter or paste content, then click Repurpose
                </p>
              </CardContent>
            </Card>
          )}

          {/* History */}
          {historyQuery.data && historyQuery.data.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Jobs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {historyQuery.data.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0 cursor-pointer hover:text-green-600 transition-colors"
                    onClick={() => setResult(job as RepurposeResult)}
                  >
                    <span className="truncate text-muted-foreground max-w-[200px]">
                      {job.sourceTitle || job.sourceType}
                    </span>
                    <span className="shrink-0 text-muted-foreground/60 ml-2">
                      {job.posts?.length ?? 0} posts
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
