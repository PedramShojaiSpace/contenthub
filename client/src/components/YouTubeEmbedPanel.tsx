import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Youtube,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  SkipForward,
} from "lucide-react";

type VideoResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  url: string;
};

type Props = {
  contentItemId: number;
  title: string;
  focusKeyword?: string | null;
  embeddedYoutubeVideoId?: string | null;
  embeddedYoutubeEmbedStatus?: string | null;
  wpPostId?: number | null;
  onEmbedSuccess?: () => void;
};

export function YouTubeEmbedPanel({
  contentItemId,
  title,
  focusKeyword,
  embeddedYoutubeVideoId,
  embeddedYoutubeEmbedStatus,
  wpPostId,
  onEmbedSuccess,
}: Props) {
  const { toast } = useToast();
  const [query, setQuery] = useState(focusKeyword ?? title.slice(0, 60));
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const utils = trpc.useUtils();

  const searchMutation = trpc.blog.findMatchingVideo.useMutation({
    onSuccess: (data) => {
      setVideos(data.videos as VideoResult[]);
      setHasSearched(true);
      if (!data.found) {
        toast.info("No matching videos found — try a different search term.");
      }
    },
    onError: (err) => toast.error("Search failed: " + err.message),
  });

  const embedMutation = trpc.blog.embedYouTubeVideo.useMutation({
    onSuccess: (_data) => {
      toast.success("YouTube video embedded into the WordPress post!");
      utils.blog.listPendingReview.invalidate();
      onEmbedSuccess?.();
    },
    onError: (err) => toast.error("Embed failed: " + err.message),
  });

  const skipMutation = trpc.blog.skipYouTubeEmbed.useMutation({
    onSuccess: () => {
      toast.info("Skipped — this post will not have a YouTube embed.");
      onEmbedSuccess?.();
    },
    onError: (err) => toast.error("Failed: " + err.message),
  });

  // Already embedded
  if (embeddedYoutubeEmbedStatus === "embedded" && embeddedYoutubeVideoId) {
    return (
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
        <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-sm font-medium">YouTube video embedded</span>
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${embeddedYoutubeVideoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
        >
          <ExternalLink className="w-3 h-3" />
          youtube.com/watch?v={embeddedYoutubeVideoId}
        </a>
      </div>
    );
  }

  // Skipped
  if (embeddedYoutubeEmbedStatus === "skipped") {
    return (
      <div className="rounded-lg border border-muted bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <SkipForward className="w-3 h-3" />
          YouTube embed skipped for this post
        </p>
      </div>
    );
  }

  if (!wpPostId) {
    return (
      <div className="rounded-lg border border-muted bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          Publish to WordPress first to enable YouTube embed automation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Youtube className="w-4 h-4 text-red-500" />
        <span className="text-sm font-medium">YouTube Embed Automation</span>
        <Badge variant="outline" className="text-xs">Item 6</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Find a matching video from Pedram's channel and embed it into the live WordPress post.
      </p>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search query (e.g. gut health, Qigong, sleep)"
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && query.trim()) {
              searchMutation.mutate({ contentItemId, searchQuery: query.trim() });
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={searchMutation.isPending || !query.trim()}
          onClick={() => searchMutation.mutate({ contentItemId, searchQuery: query.trim() })}
        >
          {searchMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Results */}
      {hasSearched && videos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No matching videos found on Pedram's channel. Try a different search term.
        </p>
      )}

      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video) => (
            <Card key={video.videoId} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-24 h-14 object-cover rounded flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium line-clamp-2">{video.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{video.channelTitle}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
                        disabled={embedMutation.isPending}
                        onClick={() =>
                          embedMutation.mutate({
                            contentItemId,
                            videoId: video.videoId,
                            videoTitle: video.title,
                          })
                        }
                      >
                        {embedMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        ) : (
                          <Youtube className="w-3 h-3 mr-1" />
                        )}
                        Embed This
                      </Button>
                      <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Watch
                      </a>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Skip option */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground w-full"
        disabled={skipMutation.isPending}
        onClick={() => skipMutation.mutate({ contentItemId })}
      >
        <SkipForward className="w-3 h-3 mr-1" />
        Skip — no YouTube embed for this post
      </Button>
    </div>
  );
}
