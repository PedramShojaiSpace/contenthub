import { useState } from "react";
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

const BOOKS = [
  "The Urban Monk",
  "Exhausted to Energized",
  "Becoming a Superhuman",
  "The Art of Stopping Time",
  "Fast This Way",
  "Grow a Pair",
  "The Longevity Paradox",
  "Custom / Paste Below",
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
  const [selectedBook, setSelectedBook] = useState(BOOKS[0]);
  const [sourceTitle, setSourceTitle] = useState("");
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["tiktok", "instagram", "youtube", "linkedin"]);
  const [result, setResult] = useState<RepurposeResult | null>(null);
  const [sentPlatforms, setSentPlatforms] = useState<Set<string>>(new Set());
  const [sendingPlatform, setSendingPlatform] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [allSaved, setAllSaved] = useState(false);

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
    if (!content.trim()) { toast.error("Paste your content first"); return; }
    if (platforms.length === 0) { toast.error("Select at least one platform"); return; }
    const title = sourceType === "book_chapter" && selectedBook !== "Custom / Paste Below"
      ? selectedBook
      : sourceTitle || undefined;
    generateMutation.mutate({
      sourceType: sourceType as "book_chapter",
      sourceTitle: title ?? "",
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
          Paste any chapter, transcript, or article and get platform-optimized short-form video scripts for every channel simultaneously. This is the highest-leverage feature — your 8 books contain hundreds of viral video ideas waiting to be unlocked.
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
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sourceType === "book_chapter" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Book</Label>
                <Select value={selectedBook} onValueChange={setSelectedBook}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOOKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Content to Repurpose *</Label>
              <Textarea
                placeholder="Paste a chapter excerpt, podcast transcript, blog post, or any long-form content here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="text-sm resize-none font-mono"
              />
              <p className="text-xs text-muted-foreground">{content.length} characters</p>
            </div>

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
            <>
              {/* Save all to Command Center CTA */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 min-w-0">
                  <Kanban className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {allSaved ? "All posts saved to Kanban!" : `${result.posts.length} posts ready`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {allSaved
                        ? "Find them in the Idea column of the Command Center"
                        : "Save all as draft cards in the Command Center Kanban"}
                    </p>
                  </div>
                </div>
                {allSaved ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-xs"
                    onClick={() => setLocation("/")}
                  >
                    <Kanban className="w-3.5 h-3.5 mr-1.5" />
                    View Kanban
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="shrink-0 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleSaveAllToKanban}
                    disabled={isSavingAll || createBulkMutation.isPending}
                  >
                    {isSavingAll ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving...</>
                    ) : (
                      <><Kanban className="w-3.5 h-3.5 mr-1.5" />Save all to Command Center</>
                    )}
                  </Button>
                )}
              </div>

              {/* Key Insights */}
              {result.keyInsights?.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-700 mb-2">Key Insights Extracted</p>
                  <ul className="space-y-1">
                    {result.keyInsights.map((insight, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {insight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quotable Lines */}
              {result.quotableLines?.length > 0 && (
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                  <p className="text-xs font-semibold text-violet-700 mb-2">Quotable Lines</p>
                  <div className="space-y-1.5">
                    {result.quotableLines.map((line, i) => (
                      <div key={i} className="flex items-start justify-between gap-2">
                        <p className="text-xs text-foreground italic">"{line}"</p>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => handleCopy(`"${line}"`)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Posts */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">{result.posts.length} Platform Posts</p>
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
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
              <RefreshCw className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Paste content from your books or podcasts to generate platform-ready posts</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {historyQuery.data && historyQuery.data.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Recent Repurposing Sessions</h3>
            </div>
            <div className="space-y-2">
              {historyQuery.data.map((r: unknown) => {
                const parsed = r as RepurposeResult;
                return (
                  <HistoryItem key={parsed.id} r={parsed} onCopy={handleCopy} />
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Separate component to avoid hooks-in-map issue
function HistoryItem({ r, onCopy }: { r: RepurposeResult; onCopy: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Badge variant="outline" className="text-xs shrink-0">{r.sourceType}</Badge>
          <span className="text-sm font-medium truncate">{r.sourceTitle ?? "Untitled"}</span>
          <Badge variant="secondary" className="text-xs shrink-0">{r.posts?.length ?? 0} posts</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && r.posts && (
        <div className="px-4 pb-4 border-t border-border space-y-2 mt-3">
          {r.posts.map((post, i) => (
            <PostCard key={i} post={post} onCopy={onCopy} />
          ))}
        </div>
      )}
    </div>
  );
}
