import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  FileText,
  Search,
  AlertCircle,
  Youtube,
  ExternalLink,
  Loader2,
  ChevronRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";

type ReviewItem = {
  id: number;
  title: string;
  platform: string;
  status: string;
  focusKeyword?: string | null;
  textContent?: string | null;
  imageUrl?: string | null;
  ctaBannerUrl?: string | null;
  yoastSeoTitle?: string | null;
  yoastMetaDescription?: string | null;
  reviewNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export default function ReviewQueue() {
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [embedSearchOpen, setEmbedSearchOpen] = useState(false);
  const [embedItem, setEmbedItem] = useState<ReviewItem | null>(null);

  const utils = trpc.useUtils();

  const { data: queueData, isLoading } = trpc.blog.listPendingReview.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const approveMutation = trpc.blog.approveForPublish.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Post approved — moved to Approved, ready to publish to WordPress.");
      utils.blog.listPendingReview.invalidate();
      setApproveOpen(false);
      setSelectedItem(null);
    },
    onError: (err) => toast.error("Approval failed: " + err.message),
  });

  const rejectMutation = trpc.blog.rejectReview.useMutation({
    onSuccess: () => {
      toast.success("Post sent back to Drafting with your feedback.");
      utils.blog.listPendingReview.invalidate();
      setRejectOpen(false);
      setRejectNotes("");
      setSelectedItem(null);
    },
    onError: (err) => toast.error("Rejection failed: " + err.message),
  });

  const items: ReviewItem[] = (queueData?.items ?? []) as ReviewItem[];

  const wordCount = (text: string) =>
    text
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .filter(Boolean).length;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              Review Queue
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Blog posts awaiting your approval before publishing to WordPress
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-3 py-1">
            {items.length} pending
          </Badge>
        </div>

        {/* Empty state */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading review queue...
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold">All clear!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                No posts are waiting for review. When a blog post is submitted for review, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <Card key={item.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <FileText className="w-5 h-5 text-amber-500" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {item.focusKeyword && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Search className="w-3 h-3" />
                                {item.focusKeyword}
                              </span>
                            )}
                            {item.textContent && (
                              <span className="text-xs text-muted-foreground">
                                {wordCount(item.textContent).toLocaleString()} words
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Submitted {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                            </span>
                          </div>

                          {/* SEO fields preview */}
                          <div className="mt-2 space-y-1">
                            {item.yoastSeoTitle && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                SEO: {item.yoastSeoTitle}
                              </p>
                            )}
                            {item.yoastMetaDescription && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {item.yoastMetaDescription}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setPreviewOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => {
                              setSelectedItem(item);
                              setRejectNotes("");
                              setRejectOpen(true);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setSelectedItem(item);
                              setApproveNotes("");
                              setApproveOpen(true);
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </div>

                      {/* CTA banner thumbnail */}
                      {item.ctaBannerUrl && (
                        <div className="mt-3">
                          <img
                            src={item.ctaBannerUrl}
                            alt="CTA Banner"
                            className="h-16 rounded object-cover border border-border"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Preview Dialog ── */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {selectedItem?.title}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {/* SEO fields */}
                {(selectedItem?.yoastSeoTitle || selectedItem?.yoastMetaDescription) && (
                  <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm text-blue-700 dark:text-blue-300">SEO Fields</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1">
                      {selectedItem?.yoastSeoTitle && (
                        <p className="text-sm"><span className="font-medium">Title:</span> {selectedItem.yoastSeoTitle} ({selectedItem.yoastSeoTitle.length} chars)</p>
                      )}
                      {selectedItem?.yoastMetaDescription && (
                        <p className="text-sm"><span className="font-medium">Meta:</span> {selectedItem.yoastMetaDescription} ({selectedItem.yoastMetaDescription.length} chars)</p>
                      )}
                      {selectedItem?.focusKeyword && (
                        <p className="text-sm"><span className="font-medium">Focus:</span> {selectedItem.focusKeyword}</p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Article body */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 rounded-lg p-4 border">
                    {selectedItem?.textContent ?? "(No content)"}
                  </pre>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200"
                onClick={() => {
                  setPreviewOpen(false);
                  setRejectNotes("");
                  setRejectOpen(true);
                }}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setPreviewOpen(false);
                  setApproveNotes("");
                  setApproveOpen(true);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Approve Dialog ── */}
        <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                Approve Post
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Approving <span className="font-medium text-foreground">"{selectedItem?.title}"</span> will move it to the Approved column where it can be published to WordPress.
              </p>
              <Textarea
                placeholder="Optional: Add approval notes (e.g. 'Great article, publish as-is')"
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                disabled={approveMutation.isPending}
                onClick={() => {
                  if (!selectedItem) return;
                  approveMutation.mutate({
                    contentItemId: selectedItem.id,
                    reviewNotes: approveNotes || undefined,
                  });
                }}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reject Dialog ── */}
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                Reject & Send Back
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Rejecting <span className="font-medium text-foreground">"{selectedItem?.title}"</span> will move it back to Drafting with your feedback.
              </p>
              <Textarea
                placeholder="Required: Explain what needs to be changed (e.g. 'Tone is too clinical, needs more Pedram voice. Add a Qigong tip.')"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={4}
              />
              {rejectNotes.trim().length === 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Feedback is required when rejecting a post
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={rejectMutation.isPending || rejectNotes.trim().length === 0}
                onClick={() => {
                  if (!selectedItem || !rejectNotes.trim()) return;
                  rejectMutation.mutate({
                    contentItemId: selectedItem.id,
                    reviewNotes: rejectNotes.trim(),
                  });
                }}
              >
                {rejectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1" />
                )}
                Reject & Send Back
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
