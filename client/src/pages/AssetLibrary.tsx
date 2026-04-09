import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Copy, Download, ExternalLink, Image } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Platform = "meta" | "linkedin" | "x" | "youtube" | "all";

const PLATFORM_COLORS: Record<string, string> = {
  meta: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  linkedin: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  x: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  youtube: "bg-red-500/20 text-red-300 border-red-500/30",
  all: "bg-primary/20 text-primary border-primary/30",
};

export default function AssetLibrary() {
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    prompt: string | null;
    platform: string | null;
  } | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");

  const { data: images = [] } = trpc.assets.listImages.useQuery({});

  const filtered =
    filterPlatform === "all"
      ? images
      : images.filter((img) => img.platform === filterPlatform);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copied to clipboard!");
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-serif font-bold text-foreground">Asset Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              All AI-generated images, organized and ready to use
            </p>
          </div>
          <Badge variant="outline" className="border-border text-muted-foreground">
            {images.length} images
          </Badge>
        </div>

        {/* Platform Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {["all", "linkedin", "meta", "x", "youtube"].map((p) => (
            <Button
              key={p}
              variant={filterPlatform === p ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterPlatform(p)}
              className={`h-8 text-xs capitalize ${
                filterPlatform === p
                  ? "bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "all" ? "All Platforms" : p}
            </Button>
          ))}
        </div>

        {/* Image Grid */}
        {filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-xl p-16 text-center">
            <Image className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-2">
              No images yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Generate images in the Creation Studio and they will appear here, organized by
              platform.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((img) => (
              <Card
                key={img.id}
                className="bg-card border-border overflow-hidden group cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() =>
                  setSelectedImage({
                    url: img.imageUrl,
                    prompt: img.prompt,
                    platform: img.platform,
                  })
                }
              >
                <div className="relative aspect-square">
                  <img
                    src={img.imageUrl}
                    alt={img.prompt || "Generated image"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-white/10 hover:bg-white/20 text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(img.imageUrl);
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-white/10 hover:bg-white/20 text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(img.imageUrl, "_blank");
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="p-2">
                  <div
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${PLATFORM_COLORS[img.platform || "all"]}`}
                  >
                    <span className="capitalize">{img.platform || "all"}</span>
                  </div>
                  {img.prompt && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-snug">
                      {img.prompt}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Image Detail Dialog */}
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="bg-card border-border max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-serif">Image Detail</DialogTitle>
            </DialogHeader>
            {selectedImage && (
              <div className="space-y-4">
                <img
                  src={selectedImage.url}
                  alt="Generated"
                  className="w-full rounded-lg border border-border"
                />
                {selectedImage.prompt && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Prompt</p>
                    <p className="text-sm text-foreground bg-background rounded-lg p-3 border border-border">
                      {selectedImage.prompt}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 border-border"
                    onClick={() => handleCopy(selectedImage.url)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy URL
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-border"
                    onClick={() => window.open(selectedImage.url, "_blank")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Open Full Size
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
