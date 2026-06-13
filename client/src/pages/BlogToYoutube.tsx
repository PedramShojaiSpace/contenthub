import { useLocation } from "wouter";
/**
 * Blog → YouTube Backlog
 *
 * Workflow:
 * 1. Browse existing WordPress blog posts
 * 2. Add to backlog
 * 3. Generate a spoken video script
 * 4. Edit and approve the script
 * 5. Generate video package (SEO title, description, thumbnail text, VA instructions)
 * 6. Record the video, mark as recorded
 * 7. Upload to YouTube, save video ID
 * 8. Mark as live
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  BookOpen,
  Youtube,
  FileText,
  Package,
  CheckCircle2,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Loader2,
  ChevronRight,
  ClipboardList,
  Video,
  Upload,
  Info,
  ArrowLeft,
  Send,
} from "lucide-react";

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  scripted: "Scripted",
  recorded: "Recorded",
  uploaded: "Uploaded",
  live: "Live",
};

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-100 text-slate-700",
  scripted: "bg-blue-100 text-blue-700",
  recorded: "bg-amber-100 text-amber-700",
  uploaded: "bg-purple-100 text-purple-700",
  live: "bg-green-100 text-green-700",
};

const PIPELINE_STEPS = [
  { id: "backlog", label: "In Backlog", icon: BookOpen },
  { id: "scripted", label: "Script Ready", icon: FileText },
  { id: "recorded", label: "Recorded", icon: Video },
  { id: "uploaded", label: "Uploaded", icon: Upload },
  { id: "live", label: "Live", icon: CheckCircle2 },
];

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function BlogToYoutube() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<"backlog" | "browse">("backlog");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadVideoId, setUploadVideoId] = useState("");
  const [editedScript, setEditedScript] = useState("");
  const [productionNotes, setProductionNotes] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [selectedTitleIdx, setSelectedTitleIdx] = useState(0);
  const [generatedPackage, setGeneratedPackage] = useState<any>(null);
  const [blogFocusKeyword, setBlogFocusKeyword] = useState("");
  const [blogCustomInstructions, setBlogCustomInstructions] = useState("");
  const [generatedBlog, setGeneratedBlog] = useState<any>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const backlogQuery = trpc.blogToYoutube.listBacklogItems.useQuery({
    status: "all",
    limit: 200,
  });

  const browseQuery = trpc.blogToYoutube.listAvailableBlogPosts.useQuery({
    search: searchQuery || undefined,
    limit: 100,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const utils = trpc.useUtils();

  const addToBacklogMut = trpc.blogToYoutube.addToBacklog.useMutation({
    onSuccess: () => {
      toast.success("Added to backlog!");
      utils.blogToYoutube.listBacklogItems.invalidate();
      utils.blogToYoutube.listAvailableBlogPosts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const generateScriptMut = trpc.blogToYoutube.generateScript.useMutation({
    onSuccess: (data) => {
      setEditedScript(data.script);
      toast.success(`Script generated! (~${data.wordCount} words)`);
      utils.blogToYoutube.listBacklogItems.invalidate();
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          script: data.script,
          scriptWordCount: data.wordCount,
          status: "scripted",
        }));
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const updateScriptMut = trpc.blogToYoutube.updateScript.useMutation({
    onSuccess: (data) => {
      toast.success(`Script saved (${data.wordCount} words)`);
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          script: editedScript,
          scriptWordCount: data.wordCount,
        }));
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const generatePackageMut = trpc.blogToYoutube.generateVideoPackage.useMutation({
    onSuccess: (data) => {
      setGeneratedPackage(data);
      setSelectedTitleIdx(0);
      toast.success("Video package generated!");
      utils.blogToYoutube.listBacklogItems.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateNotesMut = trpc.blogToYoutube.updateProductionNotes.useMutation({
    onSuccess: () => {
      toast.success("Notes saved");
      utils.blogToYoutube.listBacklogItems.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const markUploadedMut = trpc.blogToYoutube.markVideoUploaded.useMutation({
    onSuccess: (data) => {
      toast.success("Marked as uploaded!");
      setUploadDialogOpen(false);
      setUploadVideoId("");
      utils.blogToYoutube.listBacklogItems.invalidate();
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          status: "uploaded",
          youtubeUrl: data.youtubeUrl,
        }));
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const markLiveMut = trpc.blogToYoutube.markLive.useMutation({
    onSuccess: () => {
      toast.success("Marked as live!");
      utils.blogToYoutube.listBacklogItems.invalidate();
      if (selectedItem) setSelectedItem((prev: any) => ({ ...prev, status: "live" }));
    },
    onError: (e) => toast.error(e.message),
  });

  const sendToDescriptMut = trpc.videoPipeline.startVideoJob.useMutation({
    onSuccess: () => {
      toast.success("Script sent to Descript! Check the Video Review tab in the VA Dashboard.");
    },
    onError: (e) => toast.error(`Descript error: ${e.message}`),
  });

  const generateBlogMut = trpc.blogToYoutube.generateBlogFromScript.useMutation({
    onSuccess: (data) => {
      setGeneratedBlog(data);
      toast.success("Yoast-optimized blog post generated!");
      utils.blogToYoutube.listBacklogItems.invalidate();
      if (selectedItem) {
        setSelectedItem((prev: any) => ({
          ...prev,
          generatedBlogContent: data.articleBody,
          focusKeyword: data.focusKeyword,
          metaDescription: data.metaDescription,
          seoTitle: data.title,
        }));
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteItemMut = trpc.blogToYoutube.deleteItem.useMutation({
    onSuccess: () => {
      toast.success("Removed from backlog");
      setDetailOpen(false);
      utils.blogToYoutube.listBacklogItems.invalidate();
      utils.blogToYoutube.listAvailableBlogPosts.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function openDetail(item: any) {
    setSelectedItem(item);
    setEditedScript(item.script ?? "");
    setProductionNotes(item.productionNotes ?? "");
    setBlogFocusKeyword(item.focusKeyword ?? "");
    setBlogCustomInstructions("");
    setGeneratedBlog(
      item.generatedBlogContent
        ? {
            articleBody: item.generatedBlogContent,
            title: item.seoTitle ?? item.blogTitle,
            metaDescription: item.metaDescription ?? "",
            focusKeyword: item.focusKeyword ?? "",
          }
        : null
    );
    setGeneratedPackage(
      item.videoTitle
        ? {
            titleOptions: [item.videoTitle],
            videoTitle: item.videoTitle,
            ytDescription: item.ytDescription ?? "",
            thumbnailTextOptions: item.thumbnailTextOptions
              ? JSON.parse(item.thumbnailTextOptions)
              : [],
            vaInstructions: item.vaInstructions ?? "",
          }
        : null
    );
    setSelectedTitleIdx(0);
    setDetailOpen(true);
  }

  const backlogItems = backlogQuery.data?.items ?? [];
  const browsePosts = browseQuery.data?.posts ?? [];

  // Pipeline counts
  const counts = PIPELINE_STEPS.reduce((acc, s) => {
    acc[s.id] = backlogItems.filter((i: any) => i.status === s.id).length;
    return acc;
  }, {} as Record<string, number>);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Hub
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Youtube className="w-7 h-7 text-red-500" />
            Blog → YouTube Backlog
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Turn your existing blog posts into YouTube videos — scripts, titles, descriptions, and VA instructions in one workflow.
          </p>
        </div>
        <Button
          onClick={() => setActiveTab("browse")}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Blog Posts
        </Button>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-5 gap-3">
        {PIPELINE_STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.id} className="text-center p-4">
              <Icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold">{counts[step.id] ?? 0}</div>
              <div className="text-xs text-muted-foreground">{step.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="backlog">
            <ClipboardList className="w-4 h-4 mr-2" />
            My Backlog ({backlogItems.length})
          </TabsTrigger>
          <TabsTrigger value="browse">
            <Search className="w-4 h-4 mr-2" />
            Browse Blog Posts
          </TabsTrigger>
        </TabsList>

        {/* ── Backlog Tab ── */}
        <TabsContent value="backlog" className="space-y-3 mt-4">
          {backlogQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : backlogItems.length === 0 ? (
            <Card className="p-12 text-center">
              <Youtube className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No items in backlog yet.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab("browse")}
              >
                Browse Blog Posts to Add
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {backlogItems.map((item: any) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openDetail(item)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.blogTitle}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                        <a
                          href={item.blogUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          Blog post
                        </a>
                        {item.scriptWordCount && (
                          <span>· {item.scriptWordCount} word script</span>
                        )}
                        {item.youtubeUrl && (
                          <a
                            href={item.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-1 text-red-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Youtube className="w-3 h-3" />
                            YouTube
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status] ?? ""}`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Browse Tab ── */}
        <TabsContent value="browse" className="space-y-4 mt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search blog posts by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {browseQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : browsePosts.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No blog posts match your search."
                  : "All blog posts have been added to the backlog, or no posts are synced yet."}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {browsePosts.map((post: any) => (
                <Card key={post.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{post.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {post.url}
                      </a>
                      {post.publishedAt && (
                        <span>
                          · {new Date(post.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {post.categories && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {(JSON.parse(post.categories || "[]") as string[])
                          .slice(0, 3)
                          .map((cat: string) => (
                            <Badge key={cat} variant="secondary" className="text-xs">
                              {cat}
                            </Badge>
                          ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 shrink-0"
                    disabled={addToBacklogMut.isPending}
                    onClick={() =>
                      addToBacklogMut.mutate({
                        wpPostId: post.wpPostId,
                        blogTitle: post.title,
                        blogUrl: post.url,
                        blogExcerpt: post.excerpt ?? undefined,
                        blogCategories: post.categories ?? undefined,
                      })
                    }
                  >
                    <Plus className="w-3 h-3" />
                    Add to Backlog
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  <Youtube className="w-5 h-5 text-red-500 shrink-0" />
                  <span className="truncate">{selectedItem.blogTitle}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selectedItem.status] ?? ""}`}
                  >
                    {STATUS_LABELS[selectedItem.status] ?? selectedItem.status}
                  </span>
                  <a
                    href={selectedItem.blogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View Blog Post
                  </a>
                </div>
              </DialogHeader>

              <Tabs defaultValue="script" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="script" className="flex-1">
                    <FileText className="w-4 h-4 mr-1" />
                    Script
                  </TabsTrigger>
                  <TabsTrigger value="package" className="flex-1">
                    <Package className="w-4 h-4 mr-1" />
                    Video Package
                  </TabsTrigger>
                  <TabsTrigger value="va" className="flex-1">
                    <ClipboardList className="w-4 h-4 mr-1" />
                    VA Instructions
                  </TabsTrigger>
                  <TabsTrigger value="production" className="flex-1">
                    <Video className="w-4 h-4 mr-1" />
                    Production
                  </TabsTrigger>
                  <TabsTrigger value="blog" className="flex-1">
                    <BookOpen className="w-4 h-4 mr-1" />
                    Blog Post
                  </TabsTrigger>
                </TabsList>

                {/* ── Script Tab ── */}
                <TabsContent value="script" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedItem.scriptWordCount
                        ? `${selectedItem.scriptWordCount} words · ~${Math.round(selectedItem.scriptWordCount / 130)} min`
                        : "No script yet"}
                    </div>
                    <div className="flex gap-2">
                      {editedScript && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(editedScript, "Script")}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy
                        </Button>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Custom instructions (optional)"
                          value={customInstructions}
                          onChange={(e) => setCustomInstructions(e.target.value)}
                          className="w-64 text-xs h-8"
                        />
                        <Button
                          size="sm"
                          disabled={generateScriptMut.isPending}
                          onClick={() =>
                            generateScriptMut.mutate({
                              itemId: selectedItem.id,
                              blogTitle: selectedItem.blogTitle,
                              blogUrl: selectedItem.blogUrl,
                              blogExcerpt: selectedItem.blogExcerpt ?? undefined,
                              blogCategories: selectedItem.blogCategories ?? undefined,
                              customInstructions: customInstructions || undefined,
                            })
                          }
                        >
                          {generateScriptMut.isPending ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <FileText className="w-3 h-3 mr-1" />
                          )}
                          {editedScript ? "Regenerate" : "Generate Script"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Textarea
                    value={editedScript}
                    onChange={(e) => setEditedScript(e.target.value)}
                    placeholder="Script will appear here after generation. You can edit it directly before recording."
                    className="min-h-[400px] font-mono text-sm"
                  />

                  {editedScript && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        onClick={() =>
                          updateScriptMut.mutate({
                            itemId: selectedItem.id,
                            script: editedScript,
                          })
                        }
                        disabled={updateScriptMut.isPending}
                      >
                        {updateScriptMut.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Save Script
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-400 text-red-700 hover:bg-red-50"
                        disabled={sendToDescriptMut.isPending || editedScript.length < 50}
                        onClick={() =>
                          sendToDescriptMut.mutate({
                            contentItemId: selectedItem.id,
                            scriptTitle: selectedItem.blogTitle,
                            scriptText: editedScript,
                          })
                        }
                      >
                        {sendToDescriptMut.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4 mr-2" />
                        )}
                        Send to Descript
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* ── Video Package Tab ── */}
                <TabsContent value="package" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      SEO title, YouTube description, and thumbnail text options.
                    </p>
                    <Button
                      size="sm"
                      disabled={
                        generatePackageMut.isPending ||
                        !editedScript ||
                        editedScript.length < 100
                      }
                      onClick={() =>
                        generatePackageMut.mutate({
                          itemId: selectedItem.id,
                          blogTitle: selectedItem.blogTitle,
                          blogUrl: selectedItem.blogUrl,
                          script: editedScript || selectedItem.script || "",
                          blogCategories: selectedItem.blogCategories ?? undefined,
                        })
                      }
                    >
                      {generatePackageMut.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Package className="w-3 h-3 mr-1" />
                      )}
                      {generatedPackage ? "Regenerate Package" : "Generate Video Package"}
                    </Button>
                  </div>

                  {!editedScript && !selectedItem.script && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <Info className="w-4 h-4 shrink-0" />
                      Generate a script first before creating the video package.
                    </div>
                  )}

                  {generatedPackage && (
                    <div className="space-y-4">
                      {/* Title Options */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          SEO Title Options
                        </label>
                        <div className="space-y-2">
                          {(generatedPackage.titleOptions ?? [generatedPackage.videoTitle]).map(
                            (title: string, i: number) => (
                              <div
                                key={i}
                                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                  selectedTitleIdx === i
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/50"
                                }`}
                                onClick={() => setSelectedTitleIdx(i)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{title}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                      {title.length} chars
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        copyToClipboard(title, "Title");
                                      }}
                                    >
                                      <Copy className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      {/* Thumbnail Text */}
                      {generatedPackage.thumbnailTextOptions?.length > 0 && (
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Thumbnail Text Options
                          </label>
                          <div className="flex gap-2 flex-wrap">
                            {generatedPackage.thumbnailTextOptions.map(
                              (opt: string, i: number) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-1 bg-slate-900 text-white px-3 py-1.5 rounded font-bold text-sm cursor-pointer"
                                  onClick={() => copyToClipboard(opt, "Thumbnail text")}
                                >
                                  {opt}
                                  <Copy className="w-3 h-3 opacity-60" />
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* YouTube Description */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">YouTube Description</label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(generatedPackage.ytDescription, "Description")
                            }
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Copy Description
                          </Button>
                        </div>
                        <Textarea
                          value={generatedPackage.ytDescription}
                          onChange={(e) =>
                            setGeneratedPackage((prev: any) => ({
                              ...prev,
                              ytDescription: e.target.value,
                            }))
                          }
                          className="min-h-[300px] font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* ── VA Instructions Tab ── */}
                <TabsContent value="va" className="space-y-4 mt-4">
                  {generatedPackage?.vaInstructions ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Step-by-step instructions for your VA to set up the video in YouTube Studio.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            copyToClipboard(generatedPackage.vaInstructions, "VA instructions")
                          }
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Copy All
                        </Button>
                      </div>
                      <div className="bg-slate-50 border rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
                        {generatedPackage.vaInstructions}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <Info className="w-4 h-4 shrink-0" />
                      Generate the Video Package first to get VA instructions.
                    </div>
                  )}
                </TabsContent>

                {/* ── Production Tab ── */}
                <TabsContent value="production" className="space-y-4 mt-4">
                  {/* Production Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Production Notes</label>
                    <Textarea
                      value={productionNotes}
                      onChange={(e) => setProductionNotes(e.target.value)}
                      placeholder="Notes for recording — props, B-roll ideas, lighting setup, etc."
                      className="min-h-[120px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() =>
                        updateNotesMut.mutate({
                          itemId: selectedItem.id,
                          productionNotes,
                        })
                      }
                      disabled={updateNotesMut.isPending}
                    >
                      Save Notes
                    </Button>
                  </div>

                  {/* Status Actions */}
                  <div className="border-t pt-4 space-y-3">
                    <p className="text-sm font-medium">Pipeline Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedItem.status === "scripted" && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            updateNotesMut.mutate({
                              itemId: selectedItem.id,
                              productionNotes,
                              status: "recorded",
                            })
                          }
                          disabled={updateNotesMut.isPending}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Mark as Recorded
                        </Button>
                      )}

                      {(selectedItem.status === "recorded" ||
                        selectedItem.status === "scripted") && (
                        <Button
                          onClick={() => setUploadDialogOpen(true)}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Mark as Uploaded to YouTube
                        </Button>
                      )}

                      {selectedItem.status === "uploaded" && (
                        <>
                          {selectedItem.youtubeUrl && (
                            <a
                              href={selectedItem.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline">
                                <Youtube className="w-4 h-4 mr-2 text-red-500" />
                                Open on YouTube
                              </Button>
                            </a>
                          )}
                          <Button
                            onClick={() =>
                              markLiveMut.mutate({ itemId: selectedItem.id })
                            }
                            disabled={markLiveMut.isPending}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark as Live
                          </Button>
                        </>
                      )}

                      {selectedItem.status === "live" && (
                        <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          This video is live!
                          {selectedItem.youtubeUrl && (
                            <a
                              href={selectedItem.youtubeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              Watch on YouTube
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm("Remove this item from the backlog?")) {
                          deleteItemMut.mutate({ itemId: selectedItem.id });
                        }
                      }}
                      disabled={deleteItemMut.isPending}
                    >
                      Remove from Backlog
                    </Button>
                  </div>
                </TabsContent>

                {/* ── Blog Post Tab ── */}
                <TabsContent value="blog" className="space-y-4 mt-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium mb-1">Yoast-Optimized Blog from Script</p>
                    <p className="text-xs">Generates a full 1,600–2,200 word blog post using the same Yoast SEO + readability rules as the Content Pipeline — with the YouTube video embedded at the top and internal links injected automatically.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Focus Keyword (optional)</label>
                      <Input
                        value={blogFocusKeyword}
                        onChange={(e) => setBlogFocusKeyword(e.target.value)}
                        placeholder="e.g. gut health inflammation"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Custom Instructions (optional)</label>
                      <Input
                        value={blogCustomInstructions}
                        onChange={(e) => setBlogCustomInstructions(e.target.value)}
                        placeholder="e.g. Emphasize the fasting protocol"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        generateBlogMut.mutate({
                          itemId: selectedItem.id,
                          blogTitle: selectedItem.blogTitle,
                          blogUrl: selectedItem.blogUrl,
                          script: editedScript || selectedItem.script || "",
                          youtubeVideoId: selectedItem.youtubeVideoId ?? undefined,
                          focusKeyword: blogFocusKeyword || undefined,
                          customInstructions: blogCustomInstructions || undefined,
                          publishToDraft: false,
                        })
                      }
                      disabled={generateBlogMut.isPending || !editedScript && !selectedItem.script}
                    >
                      {generateBlogMut.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
                      ) : (
                        <><BookOpen className="w-4 h-4 mr-2" />Generate Yoast Blog Post</>
                      )}
                    </Button>

                    {generatedBlog && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          generateBlogMut.mutate({
                            itemId: selectedItem.id,
                            blogTitle: selectedItem.blogTitle,
                            blogUrl: selectedItem.blogUrl,
                            script: editedScript || selectedItem.script || "",
                            youtubeVideoId: selectedItem.youtubeVideoId ?? undefined,
                            focusKeyword: blogFocusKeyword || undefined,
                            customInstructions: blogCustomInstructions || undefined,
                            publishToDraft: true,
                          })
                        }
                        disabled={generateBlogMut.isPending}
                      >
                        {generateBlogMut.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Regenerate & Publish as WP Draft
                      </Button>
                    )}

                    {!generatedBlog && selectedItem.generatedBlogContent && (
                      <Button
                        variant="outline"
                        onClick={() =>
                          generateBlogMut.mutate({
                            itemId: selectedItem.id,
                            blogTitle: selectedItem.blogTitle,
                            blogUrl: selectedItem.blogUrl,
                            script: editedScript || selectedItem.script || "",
                            youtubeVideoId: selectedItem.youtubeVideoId ?? undefined,
                            focusKeyword: blogFocusKeyword || undefined,
                            publishToDraft: true,
                          })
                        }
                        disabled={generateBlogMut.isPending}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Publish as WP Draft
                      </Button>
                    )}
                  </div>

                  {generatedBlog && (
                    <div className="space-y-3">
                      {/* SEO Metadata Summary */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                        <p className="text-sm font-semibold text-green-800">SEO Metadata</p>
                        <div className="grid grid-cols-1 gap-1 text-xs">
                          <div><span className="font-medium">Title ({generatedBlog.title?.length ?? 0} chars):</span> {generatedBlog.title}</div>
                          <div><span className="font-medium">Focus Keyword:</span> {generatedBlog.focusKeyword}</div>
                          <div><span className="font-medium">Meta Description ({generatedBlog.metaDescription?.length ?? 0} chars):</span> {generatedBlog.metaDescription}</div>
                          {generatedBlog.semanticKeywords?.length > 0 && (
                            <div><span className="font-medium">Semantic Keywords:</span> {generatedBlog.semanticKeywords.join(", ")}</div>
                          )}
                        </div>
                        {generatedBlog.wpDraftUrl && (
                          <a href={generatedBlog.wpDraftUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 underline flex items-center gap-1 mt-1">
                            <ExternalLink className="w-3 h-3" />View WordPress Draft
                          </a>
                        )}
                      </div>

                      {/* Article Preview */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Article Body</label>
                          <div className="flex gap-2">
                            <span className="text-xs text-muted-foreground">{generatedBlog.articleBody?.split(/\s+/).length ?? 0} words</span>
                            <Button size="sm" variant="outline" onClick={() => copyToClipboard(generatedBlog.articleBody, "Article")}>
                              <Copy className="w-3 h-3 mr-1" />Copy
                            </Button>
                          </div>
                        </div>
                        <Textarea
                          value={generatedBlog.articleBody ?? ""}
                          readOnly
                          className="min-h-[300px] font-mono text-xs"
                        />
                      </div>

                      {/* Publish Button */}
                      <Button
                        className="w-full"
                        onClick={() =>
                          generateBlogMut.mutate({
                            itemId: selectedItem.id,
                            blogTitle: selectedItem.blogTitle,
                            blogUrl: selectedItem.blogUrl,
                            script: editedScript || selectedItem.script || "",
                            youtubeVideoId: selectedItem.youtubeVideoId ?? undefined,
                            focusKeyword: blogFocusKeyword || undefined,
                            publishToDraft: true,
                          })
                        }
                        disabled={generateBlogMut.isPending}
                      >
                        {generateBlogMut.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing...</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-2" />Publish to WordPress as Draft</>
                        )}
                      </Button>
                    </div>
                  )}

                  {!generatedBlog && selectedItem.generatedBlogContent && (
                    <div className="bg-slate-50 border rounded-lg p-3 text-sm text-slate-600">
                      <p className="font-medium mb-1">Previously Generated Blog</p>
                      <p className="text-xs">A blog post was generated for this item. Click "Generate Yoast Blog Post" to regenerate with updated settings.</p>
                      {selectedItem.seoTitle && <p className="text-xs mt-1"><span className="font-medium">Title:</span> {selectedItem.seoTitle}</p>}
                      {selectedItem.focusKeyword && <p className="text-xs"><span className="font-medium">Focus Keyword:</span> {selectedItem.focusKeyword}</p>}
                    </div>
                  )}

                  {!generatedBlog && !selectedItem.generatedBlogContent && !editedScript && !selectedItem.script && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p>Generate a script first (Script tab), then come back here to create the Yoast-optimized blog post.</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Uploaded to YouTube</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Paste the YouTube Video ID (the part after <code>?v=</code> in the URL) to save the link.
            </p>
            <Input
              placeholder="e.g. dQw4w9WgXcQ"
              value={uploadVideoId}
              onChange={(e) => setUploadVideoId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Example: from <code>youtube.com/watch?v=dQw4w9WgXcQ</code>, the ID is <code>dQw4w9WgXcQ</code>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!uploadVideoId.trim() || markUploadedMut.isPending}
              onClick={() =>
                selectedItem &&
                markUploadedMut.mutate({
                  itemId: selectedItem.id,
                  youtubeVideoId: uploadVideoId.trim(),
                })
              }
            >
              {markUploadedMut.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
