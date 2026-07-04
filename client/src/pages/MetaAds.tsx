/**
 * Meta Ads Manager
 * Shows all Meta ad variants generated from advertorials.
 * Accessible from the Advertorial Builder via "Generate Meta Ads" button,
 * or directly from the sidebar nav.
 */
import { useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Copy,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Image,
  Target,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  archived: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  running: "Running",
  paused: "Paused",
  archived: "Archived",
};

const VARIANT_ANGLES = [
  "Pain-Point Hook",
  "Curiosity / Mechanism",
  "Authority / Social Proof",
  "Transformation Hook",
  "Direct Offer",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

function AdVariantCard({
  variant,
  angle,
  onStatusChange,
}: {
  variant: {
    id: number;
    variantNumber: number;
    primaryText: string;
    headline: string;
    description: string | null;
    callToAction: string;
    imagePrompt: string | null;
    audienceNote: string | null;
    status: string;
  };
  angle: string;
  onStatusChange: (id: number, status: string) => void;
}) {
  const [showImagePrompt, setShowImagePrompt] = useState(false);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Variant {variant.variantNumber}
          </span>
          <span className="text-xs text-zinc-500 font-medium">{angle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${STATUS_COLORS[variant.status] || STATUS_COLORS.draft}`}
          >
            {STATUS_LABELS[variant.status] || variant.status}
          </span>
          <select
            value={variant.status}
            onChange={(e) => onStatusChange(variant.id, e.target.value)}
            className="text-xs border border-zinc-200 rounded px-2 py-1 bg-white text-zinc-600 cursor-pointer"
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary text */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wide">
            <MessageSquare className="w-3.5 h-3.5" />
            Primary Text
          </div>
          <CopyButton text={variant.primaryText} />
        </div>
        <p className="text-sm text-zinc-800 leading-relaxed">{variant.primaryText}</p>
        <p className="text-xs text-zinc-400 mt-1">{variant.primaryText.length} chars</p>
      </div>

      {/* Headline + Description + CTA */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-3">
        <div>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Headline</div>
          <div className="flex items-start gap-1">
            <p className="text-sm font-semibold text-zinc-800 flex-1">{variant.headline}</p>
            <CopyButton text={variant.headline} />
          </div>
          <p className="text-xs text-zinc-400">{variant.headline.length}/40 chars</p>
        </div>
        <div>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Description</div>
          <p className="text-sm text-zinc-600">{variant.description || "—"}</p>
        </div>
        <div>
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">CTA Button</div>
          <span className="inline-block bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded">
            {variant.callToAction}
          </span>
        </div>
      </div>

      {/* Audience note */}
      {variant.audienceNote && (
        <div className="px-4 pb-3 border-t border-zinc-100 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
            <Target className="w-3.5 h-3.5" />
            Target Audience
          </div>
          <p className="text-xs text-zinc-600">{variant.audienceNote}</p>
        </div>
      )}

      {/* Image prompt (collapsible) */}
      {variant.imagePrompt && (
        <div className="px-4 pb-4 border-t border-zinc-100 pt-3">
          <button
            onClick={() => setShowImagePrompt(!showImagePrompt)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide hover:text-zinc-600 transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
            Image Prompt
            {showImagePrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showImagePrompt && (
            <div className="mt-2 bg-zinc-50 rounded p-3 flex items-start gap-2">
              <p className="text-xs text-zinc-600 leading-relaxed flex-1 font-mono">{variant.imagePrompt}</p>
              <CopyButton text={variant.imagePrompt} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MetaAds() {
  const [, params] = useRoute("/meta-ads/:advertorialId");
  const [, navigate] = useLocation();
  const advertorialId = params?.advertorialId ? parseInt(params.advertorialId) : null;

  // Fetch the advertorial details
  const { data: advertorial } = trpc.advertorial.get.useQuery(
    { id: advertorialId! },
    { enabled: !!advertorialId }
  );

  // Fetch existing ad variants
  const { data: variants, isLoading, refetch } = trpc.advertorial.listMetaAds.useQuery(
    { advertorialId: advertorialId! },
    { enabled: !!advertorialId }
  );

  // Generate new variants
  const generateMutation = trpc.advertorial.generateMetaAds.useMutation({
    onSuccess: () => {
      toast.success("5 Meta ad variants generated!");
      refetch();
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });

  // Update variant status
  const updateStatusMutation = trpc.advertorial.updateMetaAdStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  if (!advertorialId) {
    return (
      <div className="p-8 text-center text-zinc-500">
        <p>No advertorial selected. Go to the Advertorial Builder and click "Generate Meta Ads".</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/advertorial-builder")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Advertorial Builder
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate("/advertorial-builder")}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 mb-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Advertorial Builder
          </button>
          <h1 className="text-2xl font-bold text-zinc-900">Meta Ad Variants</h1>
          {advertorial && (
            <p className="text-sm text-zinc-500 mt-1 max-w-xl line-clamp-1">
              For: <span className="font-medium text-zinc-700">{advertorial.headline}</span>
            </p>
          )}
        </div>
        <Button
          onClick={() => generateMutation.mutate({ advertorialId: advertorialId! })}
          disabled={generateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {variants && variants.length > 0 ? "Regenerate 5 Variants" : "Generate 5 Variants"}
            </>
          )}
        </Button>
      </div>

      {/* Info banner */}
      {(!variants || variants.length === 0) && !isLoading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
          <strong>No ad variants yet.</strong> Click "Generate 5 Variants" to create Meta ad copy from this advertorial's messaging.
          The AI will produce 5 distinct angles: pain-point, curiosity, authority, transformation, and direct offer.
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading variants…
        </div>
      )}

      {/* Variants grid */}
      {variants && variants.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">
              {variants.length} variant{variants.length !== 1 ? "s" : ""} · Approve variants to track which are running
            </p>
            <div className="flex gap-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Approved
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Running
              </span>
            </div>
          </div>
          {variants.map((v, i) => (
            <AdVariantCard
              key={v.id}
              variant={v}
              angle={VARIANT_ANGLES[i] || `Variant ${v.variantNumber}`}
              onStatusChange={(id, status) =>
                updateStatusMutation.mutate({ id, status: status as any })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
