/**
 * Meta Ads Manager
 * Shows all Meta ad variants generated from advertorials.
 * Full pipeline: Generate copy → Generate image → Upload to Meta → Create PAUSED ad
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
  Rocket,
  ExternalLink,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
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

// ─── Meta Compliance Check Result Banner ────────────────────────────────────────────────────

type ComplianceResult = {
  passed: boolean;
  riskScore: number;
  blockingViolations: Array<{ ruleId: string; ruleName: string; passed: boolean; flaggedText: string | null; explanation: string }>;
  warnings: Array<{ ruleId: string; ruleName: string; passed: boolean; flaggedText: string | null; explanation: string }>;
  flaggedPhrases: string[];
  recommendation: string;
};

function ComplianceBanner({ result }: { result: ComplianceResult }) {
  const riskColor =
    result.riskScore >= 50
      ? "border-red-700 bg-red-900/20"
      : result.riskScore >= 20
      ? "border-amber-700 bg-amber-900/20"
      : "border-emerald-700 bg-emerald-900/20";

  const riskTextColor =
    result.riskScore >= 50
      ? "text-red-400"
      : result.riskScore >= 20
      ? "text-amber-400"
      : "text-emerald-400";

  const Icon = result.riskScore >= 50 ? ShieldX : result.riskScore >= 20 ? ShieldAlert : ShieldCheck;

  return (
    <div className={`rounded-lg border p-4 ${riskColor} mt-3`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${riskTextColor}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className={`text-sm font-semibold ${riskTextColor}`}>
              Risk Score: {result.riskScore}/100
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${riskColor} ${riskTextColor}`}>
              {result.passed ? "Likely Approvable" : "Likely Rejected"}
            </span>
          </div>
          <p className="text-xs text-gray-300 mb-2">{result.recommendation}</p>

          {result.blockingViolations.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-semibold text-red-400 mb-1">Blocking Violations ({result.blockingViolations.length}):</p>
              <ul className="space-y-1">
                {result.blockingViolations.map((v, i) => (
                  <li key={i} className="text-xs text-gray-300">
                    <span className="font-medium text-red-300">{v.ruleName}:</span>{" "}
                    {v.flaggedText && (
                      <span className="font-mono bg-red-900/30 px-1 rounded text-red-200">"{v.flaggedText}"</span>
                    )}
                    <span className="text-gray-400 ml-1">— {v.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.warnings.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 mb-1">Warnings ({result.warnings.length}):</p>
              <ul className="space-y-1">
                {result.warnings.map((v, i) => (
                  <li key={i} className="text-xs text-gray-300">
                    <span className="font-medium text-amber-300">{v.ruleName}:</span>{" "}
                    {v.flaggedText && (
                      <span className="font-mono bg-amber-900/30 px-1 rounded text-amber-200">"{v.flaggedText}"</span>
                    )}
                    <span className="text-gray-400 ml-1">— {v.explanation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdVariantCard({
  variant,
  angle,
  onStatusChange,
  onPushToMeta,
  isPushing,
}: {
  variant: {
    id: number;
    variantNumber: number;
    primaryText: string;
    headline: string;
    description: string | null;
    callToAction: string;
    imagePrompt: string | null;
    imageUrl: string | null;
    imageHash: string | null;
    audienceNote: string | null;
    status: string;
    metaAdId: string | null;
    metaCampaignId: string | null;
    metaPushError: string | null;
    metaPushedAt: number | null;
  };
  angle: string;
  onStatusChange: (id: number, status: string) => void;
  onPushToMeta: (variantId: number) => void;
  isPushing: boolean;
}) {
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null);
  const [showCompliance, setShowCompliance] = useState(false);

  const complianceCheckMutation = trpc.claimsReview.metaComplianceCheck.useMutation({
    onSuccess: (data) => {
      setComplianceResult(data as ComplianceResult);
      setShowCompliance(true);
    },
    onError: (err) => {
      toast.error(`Compliance check failed: ${err.message}`);
    },
  });

  const handleComplianceCheck = () => {
    complianceCheckMutation.mutate({
      adId: String(variant.id),
      adName: `Variant ${variant.variantNumber}`,
      headline: variant.headline,
      primaryText: variant.primaryText,
      description: variant.description ?? undefined,
    });
  };

  const isLiveInMeta = !!variant.metaAdId;
  const adsManagerUrl = variant.metaCampaignId
    ? `https://www.facebook.com/adsmanager/manage/campaigns?act=&campaign_ids=${variant.metaCampaignId}`
    : null;

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
          {/* Meta live badge */}
          {isLiveInMeta && (
            <a
              href={adsManagerUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border bg-emerald-900/40 text-emerald-400 border-emerald-700 hover:bg-emerald-900/60 transition-colors"
              title="View in Meta Ads Manager"
            >
              <CheckCircle2 className="w-3 h-3" />
              In Meta
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          )}
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

      {/* Image preview (if generated) */}
      {variant.imageUrl && (
        <div className="px-5 pt-4 pb-0">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" />
            Ad Image
          </div>
          <img
            src={variant.imageUrl}
            alt={`Ad variant ${variant.variantNumber} image`}
            className="w-full max-h-64 object-contain rounded-lg border border-white/10 bg-black/20"
          />
          {variant.imageHash && (
            <p className="text-xs text-gray-600 mt-1 font-mono">Hash: {variant.imageHash}</p>
          )}
        </div>
      )}

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
        <div className="px-5 pb-3 border-t border-white/10 pt-3">
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

      {/* Push error (if any) */}
      {variant.metaPushError && !isLiveInMeta && (
        <div className="px-5 pb-3 border-t border-red-900/30 pt-3">
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-mono">{variant.metaPushError}</span>
          </div>
        </div>
      )}

      {/* Compliance check section */}
      <div className="px-5 pb-3 border-t border-white/10 pt-3">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={handleComplianceCheck}
            disabled={complianceCheckMutation.isPending}
            className="border-[#1877f2]/40 text-[#1877f2] hover:bg-[#1877f2]/10 text-xs font-semibold"
          >
            {complianceCheckMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Check Meta Compliance
              </>
            )}
          </Button>
          {complianceResult && (
            <button
              onClick={() => setShowCompliance(!showCompliance)}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showCompliance ? "Hide" : "Show"} results
            </button>
          )}
          {complianceResult && (
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded border ${
                complianceResult.riskScore >= 50
                  ? "border-red-700 bg-red-900/20 text-red-400"
                  : complianceResult.riskScore >= 20
                  ? "border-amber-700 bg-amber-900/20 text-amber-400"
                  : "border-emerald-700 bg-emerald-900/20 text-emerald-400"
              }`}
            >
              Risk: {complianceResult.riskScore}/100
            </span>
          )}
        </div>
        {showCompliance && complianceResult && (
          <ComplianceBanner result={complianceResult} />
        )}
      </div>

      {/* Push to Meta button */}
      <div className="px-5 pb-4 border-t border-white/10 pt-3 flex items-center justify-between">
        {isLiveInMeta ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="font-semibold">Published as PAUSED draft in Meta Ads Manager</span>
            </div>
            {adsManagerUrl && (
              <a
                href={adsManagerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#00d4ff] hover:text-[#00b8e0] transition-colors"
              >
                View in Ads Manager
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => onPushToMeta(variant.id)}
              disabled={isPushing || !variant.imagePrompt}
              className="bg-[#1877f2] hover:bg-[#1565d8] text-white font-semibold text-xs"
            >
              {isPushing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Generating & Pushing…
                </>
              ) : (
                <>
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />
                  Generate Image + Push to Meta
                </>
              )}
            </Button>
            {!variant.imagePrompt && (
              <span className="text-xs text-gray-500">No image prompt — regenerate variants first</span>
            )}
            {variant.imageUrl && !isLiveInMeta && (
              <span className="text-xs text-gray-500">Image generated · ready to push</span>
            )}
          </div>
        )}
        {variant.metaPushedAt && (
          <span className="text-xs text-gray-600">
            Pushed {new Date(variant.metaPushedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function MetaAds() {
  const [, params] = useRoute("/meta-ads/:advertorialId");
  const [, navigate] = useLocation();
  const advertorialId = params?.advertorialId ? parseInt(params.advertorialId) : null;
  // Track which variant is currently being pushed
  const [pushingVariantId, setPushingVariantId] = useState<number | null>(null);

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

  // Generate image + push to Meta
  const pushToMetaMutation = trpc.advertorial.generateImageAndPushToMeta.useMutation({
    onSuccess: (data) => {
      setPushingVariantId(null);
      toast.success(
        <div>
          <p className="font-semibold">Ad published to Meta Ads Manager (PAUSED)</p>
          <a
            href={data.adsManagerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-xs mt-1 block"
          >
            View in Ads Manager →
          </a>
        </div>
      );
      refetch();
    },
    onError: (err) => {
      setPushingVariantId(null);
      toast.error(`Push failed: ${err.message}`);
      refetch(); // Refresh to show metaPushError
    },
  });

  const handlePushToMeta = (variantId: number) => {
    setPushingVariantId(variantId);
    pushToMetaMutation.mutate({ variantId });
  };

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
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-500 text-right hidden sm:block">
              <p>Each variant: Generate image</p>
              <p>→ Upload to Meta → Create PAUSED ad</p>
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
      </div>

      {/* Pipeline info banner */}
      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="rounded-xl border border-[#1877f2]/20 bg-[#1877f2]/5 p-4 text-xs text-gray-400 flex items-start gap-3">
          <Rocket className="w-4 h-4 text-[#1877f2] shrink-0 mt-0.5" />
          <div>
            <span className="text-gray-300 font-semibold">Full pipeline per variant: </span>
            Generate copy → AI generates ad image (anonymous health struggle, no user likeness) →
            Upload to Meta image library → Create Campaign → Ad Set → Creative → Ad — all <span className="text-amber-400 font-semibold">PAUSED</span>.
            Review in Ads Manager before activating.
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Empty state */}
        {(!variants || variants.length === 0) && !isLoading && (
          <div className="rounded-xl border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-5 text-sm text-gray-300">
            <strong className="text-[#00d4ff]">No ad variants yet.</strong>{" "}
            Click "Generate 5 Variants" to create Meta ad copy from this advertorial's messaging.
            Then use the "Generate Image + Push to Meta" button on each variant to publish a PAUSED draft ad.
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
                {variants.length} variant{variants.length !== 1 ? "s" : ""} ·{" "}
                {variants.filter((v) => v.metaAdId).length} pushed to Meta
              </p>
              <div className="flex gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> In Meta
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Paused
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
                onPushToMeta={handlePushToMeta}
                isPushing={pushingVariantId === v.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
