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
  FileText,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-700/50 text-zinc-300 border-zinc-600",
  approved: "bg-emerald-900/40 text-emerald-400 border-emerald-700",
  running: "bg-blue-900/40 text-blue-400 border-blue-700",
  paused: "bg-amber-900/40 text-amber-400 border-amber-700",
  archived: "bg-red-900/40 text-red-400 border-red-700",
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
      className="p-1.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
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
    <div className="rounded-xl border border-white/10 bg-[#161b22] overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-[#00d4ff] uppercase tracking-widest">
            Variant {variant.variantNumber}
          </span>
          <span className="text-xs text-gray-400 font-medium">{angle}</span>
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
            className="text-xs border border-white/10 rounded px-2 py-1 bg-[#0d1117] text-gray-300 cursor-pointer"
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary text */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <MessageSquare className="w-3.5 h-3.5" />
            Primary Text
          </div>
          <CopyButton text={variant.primaryText} />
        </div>
        <p className="text-sm text-gray-200 leading-relaxed">{variant.primaryText}</p>
        <p className="text-xs text-gray-600 mt-1">{variant.primaryText.length} chars</p>
      </div>

      {/* Headline + Description + CTA */}
      <div className="px-5 pb-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Headline</div>
          <div className="flex items-start gap-1">
            <p className="text-sm font-semibold text-white flex-1">{variant.headline}</p>
            <CopyButton text={variant.headline} />
          </div>
          <p className="text-xs text-gray-600">{variant.headline.length}/40 chars</p>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</div>
          <p className="text-sm text-gray-300">{variant.description || "—"}</p>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">CTA Button</div>
          <span className="inline-block bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded">
            {variant.callToAction}
          </span>
        </div>
      </div>

      {/* Audience note */}
      {variant.audienceNote && (
        <div className="px-5 pb-3 border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            <Target className="w-3.5 h-3.5" />
            Target Audience
          </div>
          <p className="text-xs text-gray-400">{variant.audienceNote}</p>
        </div>
      )}

      {/* Image prompt (collapsible) */}
      {variant.imagePrompt && (
        <div className="px-5 pb-4 border-t border-white/10 pt-3">
          <button
            onClick={() => setShowImagePrompt(!showImagePrompt)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-300 transition-colors"
          >
            <Image className="w-3.5 h-3.5" />
            Image Prompt
            {showImagePrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showImagePrompt && (
            <div className="mt-2 bg-white/5 rounded-lg p-3 flex items-start gap-2">
              <p className="text-xs text-gray-400 leading-relaxed flex-1 font-mono">{variant.imagePrompt}</p>
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

  // Fetch lightweight advertorial summary (headline only, no bodyHtml)
  const { data: advertorial } = trpc.advertorial.getSummary.useQuery(
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
    onError: (err) => {
      const msg = err.message?.includes('Failed query') || err.message?.includes('insert into')
        ? 'Generation failed: database error. Please try again.'
        : `Generation failed: ${err.message}`;
      toast.error(msg);
    },
  });

  // Update variant status
  const updateStatusMutation = trpc.advertorial.updateMetaAdStatus.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(`Update failed: ${err.message}`),
  });

  if (!advertorialId) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center text-gray-400 max-w-sm">
          <FileText className="w-10 h-10 mx-auto mb-4 text-gray-600" />
          <p className="text-sm mb-4">No advertorial selected. Go to the Advertorial Builder and click "Meta Ads".</p>
          <Button variant="outline" className="border-white/20 text-gray-300" onClick={() => navigate("/advertorial-builder")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Advertorial Builder
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#0d1117] text-gray-100">
      {/* Sticky header */}
      <div className="border-b border-white/10 bg-[#0d1117]/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate("/advertorial-builder")}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Advertorial Builder
            </button>
            <h1 className="text-xl font-bold text-white">Meta Ad Variants</h1>
            {advertorial && (
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl line-clamp-1">
                For: <span className="font-medium text-gray-400">{advertorial.headline}</span>
              </p>
            )}
          </div>
          <Button
            onClick={() => generateMutation.mutate({ advertorialId: advertorialId! })}
            disabled={generateMutation.isPending}
            className="bg-[#00d4ff] hover:bg-[#00b8e0] text-black font-semibold"
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
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Info banner */}
        {(!variants || variants.length === 0) && !isLoading && (
          <div className="rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-5 text-sm text-gray-300">
            <strong className="text-[#00d4ff]">No ad variants yet.</strong>{" "}
            Click "Generate 5 Variants" to create Meta ad copy from this advertorial's messaging.
            The AI will produce 5 distinct angles: pain-point, curiosity, authority, transformation, and direct offer.
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500 py-12 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading variants…
          </div>
        )}

        {/* Variants list */}
        {variants && variants.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {variants.length} variant{variants.length !== 1 ? "s" : ""} · Approve variants to track which are running
              </p>
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Approved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Running
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
    </div>
  );
}
