import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";

type Props = {
  contentItemId: number;
  title: string;
  onSuccess?: () => void;
};

/**
 * Keith Item 5 — Submit for Review Gate
 * Moves a blog post to `pending_review` status so Pedram can approve/reject
 * it in the Review Queue before it goes live on WordPress.
 */
export function SubmitForReviewButton({ contentItemId, title, onSuccess }: Props) {
  const utils = trpc.useUtils();

  const submitMutation = trpc.blog.submitForReview.useMutation({
    onSuccess: () => {
      toast.success(`"${title}" submitted to Review Queue for approval.`);
      utils.content.list.invalidate();
      onSuccess?.();
    },
    onError: (err) => {
      toast.error("Submit failed: " + err.message);
    },
  });

  return (
    <div className="rounded-lg border border-amber-600/30 bg-amber-950/10 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-medium text-amber-400">Human Review Gate</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Submit this post to the Review Queue for Pedram's approval before it publishes to WordPress.
      </p>
      <Button
        size="sm"
        className="bg-amber-600 hover:bg-amber-700 text-white h-7 text-xs"
        disabled={submitMutation.isPending}
        onClick={() => submitMutation.mutate({ contentItemId })}
      >
        {submitMutation.isPending ? (
          <Loader2 className="w-3 h-3 animate-spin mr-1" />
        ) : (
          <Clock className="w-3 h-3 mr-1" />
        )}
        {submitMutation.isPending ? "Submitting…" : "Submit for Review"}
      </Button>
    </div>
  );
}
