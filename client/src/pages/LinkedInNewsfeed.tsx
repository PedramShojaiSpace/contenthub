/**
 * LinkedInNewsfeed.tsx — Doovo replacement.
 *
 * v135 changes:
 *   - X toggle moved to Pending cards and detail dialog (set before approving)
 *   - includeX preference passed through approveArticle and stored in DB
 *   - Approved tab pre-fills X toggle from stored includeX preference
 *   - Buffer push no longer sends standalone imageUrl (fixes URL preview being overridden)
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  ThumbsUp,
  X,
  RotateCcw,
  ExternalLink,
  Copy,
  Check,
  Newspaper,
  Loader2,
  Send,
  Twitter,
} from "lucide-react";
import { toast } from "sonner";

// ─── Topic colour map ──────────────────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  integrative_medicine: "bg-emerald-100 text-emerald-800 border-emerald-200",
  longevity: "bg-violet-100 text-violet-800 border-violet-200",
  gut_health: "bg-amber-100 text-amber-800 border-amber-200",
  sleep_science: "bg-blue-100 text-blue-800 border-blue-200",
  mental_health: "bg-rose-100 text-rose-800 border-rose-200",
  cardiometabolic: "bg-red-100 text-red-800 border-red-200",
  consciousness: "bg-indigo-100 text-indigo-800 border-indigo-200",
  enlightenment: "bg-yellow-100 text-yellow-800 border-yellow-200",
  metaphysics: "bg-purple-100 text-purple-800 border-purple-200",
};

const TOPIC_LABELS: Record<string, string> = {
  integrative_medicine: "Integrative Medicine",
  longevity: "Longevity",
  gut_health: "Gut Health",
  sleep_science: "Sleep Science",
  mental_health: "Mental Health",
  cardiometabolic: "Cardiometabolic",
  consciousness: "Consciousness",
  enlightenment: "Enlightenment",
  metaphysics: "Metaphysics",
};

// ─── Article type ──────────────────────────────────────────────────────────────

interface Article {
  id: number;
  title: string;
  source: string | null;
  url: string;
  imageUrl: string | null;
  description: string | null;
  commentary: string | null;
  xVersion: string | null;
  topic: string | null;
  status: "pending" | "approved" | "dismissed";
  fetchedAt: Date;
  approvedAt: Date | null;
  contentItemId: number | null;
  bufferSentAt: Date | null;
  xSentAt: Date | null;
  includeX: boolean | null;
}

// ─── Pending article card (with X toggle) ─────────────────────────────────────

function ArticleCard({
  article,
  onApprove,
  onDismiss,
  onRegenerate,
  onOpenDetail,
}: {
  article: Article;
  onApprove: (id: number, includeX: boolean) => void;
  onDismiss: (id: number) => void;
  onRegenerate: (id: number) => void;
  onOpenDetail: (article: Article) => void;
}) {
  const [includeX, setIncludeX] = useState(false);
  const topicKey = article.topic ?? "";
  const topicColor = TOPIC_COLORS[topicKey] ?? "bg-slate-100 text-slate-700 border-slate-200";
  const topicLabel = TOPIC_LABELS[topicKey] ?? topicKey;

  const commentaryPreview = article.commentary
    ? article.commentary.slice(0, 200) + (article.commentary.length > 200 ? "…" : "")
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="p-4 pb-2 flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <Badge variant="outline" className={`text-xs font-medium shrink-0 ${topicColor}`}>
            {topicLabel}
          </Badge>
          <Badge variant="outline" className="text-xs text-slate-500 shrink-0">
            {article.source ?? "Unknown"}
          </Badge>
        </div>
        <h3
          className="font-semibold text-slate-900 text-sm leading-snug mb-2 cursor-pointer hover:text-blue-700 line-clamp-3"
          onClick={() => onOpenDetail({ ...article, includeX })}
        >
          {article.title}
        </h3>
        {commentaryPreview ? (
          <p
            className="text-xs text-slate-600 leading-relaxed cursor-pointer line-clamp-3"
            onClick={() => onOpenDetail({ ...article, includeX })}
          >
            {commentaryPreview}
          </p>
        ) : (
          <p className="text-xs text-slate-400 italic">No commentary yet — click Regen</p>
        )}
      </div>

      {/* Footer with X toggle + actions */}
      <div className="p-3 pt-2 border-t border-slate-100 space-y-2">
        {/* X toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeX}
            onChange={(e) => setIncludeX(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-slate-800"
          />
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Twitter size={11} className="text-slate-600" />
            Also push to X when approving
          </span>
        </label>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
            title="Open article"
          >
            <ExternalLink size={13} />
          </a>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-slate-500 hover:text-slate-700 h-7 px-2"
            onClick={() => onRegenerate(article.id)}
            title="Regenerate commentary"
          >
            <RotateCcw size={12} className="mr-1" />
            Regen
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
            onClick={() => onDismiss(article.id)}
          >
            <X size={12} className="mr-1" />
            Skip
          </Button>
          <Button
            size="sm"
            className={`text-xs h-7 px-3 text-white ${
              includeX ? "bg-slate-800 hover:bg-slate-900" : "bg-blue-600 hover:bg-blue-700"
            }`}
            onClick={() => onApprove(article.id, includeX)}
          >
            <ThumbsUp size={12} className="mr-1" />
            {includeX ? "Approve + X" : "Approve"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Approved article card ─────────────────────────────────────────────────────

function ApprovedArticleCard({
  article,
  onPushToBuffer,
  onOpenDetail,
  isPushing,
}: {
  article: Article;
  onPushToBuffer: (id: number, includeX: boolean, customImageUrl?: string) => void;
  onOpenDetail: (article: Article) => void;
  isPushing: boolean;
}) {
  // Pre-fill from stored preference
  const [includeX, setIncludeX] = useState(article.includeX ?? false);
  // Custom thumbnail image URL — pre-filled with article's own image if available
  const [customImageUrl, setCustomImageUrl] = useState(article.imageUrl ?? "");
  const topicKey = article.topic ?? "";

  return (
    <div className="bg-white border border-emerald-200 rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div
        className="p-4 pb-2 flex-1 cursor-pointer"
        onClick={() => onOpenDetail(article)}
      >
        <div className="flex items-start gap-2 mb-2 flex-wrap">
          <Badge variant="outline" className={`text-xs shrink-0 ${TOPIC_COLORS[topicKey] ?? ""}`}>
            {TOPIC_LABELS[topicKey] ?? topicKey}
          </Badge>
          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50 shrink-0">
            ✓ Approved
          </Badge>
          {article.bufferSentAt && (
            <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50 shrink-0">
              ✓ LinkedIn
            </Badge>
          )}
          {article.xSentAt && (
            <Badge variant="outline" className="text-xs text-slate-700 border-slate-300 bg-slate-50 shrink-0">
              ✓ X
            </Badge>
          )}
        </div>
        <h3 className="font-semibold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">
          {article.title}
        </h3>
        <p className="text-xs text-slate-500 mb-1">{article.source}</p>
        {article.commentary && (
          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {article.commentary.slice(0, 160)}…
          </p>
        )}
      </div>

      {/* Buffer push footer */}
      <div className="p-3 pt-2 border-t border-slate-100">
        {article.bufferSentAt ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-600 flex items-center gap-1">
              <Check size={12} />
              Sent to Buffer
              {article.xSentAt && <span className="ml-1 text-slate-500">+ X</span>}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={13} />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Custom thumbnail image URL */}
            <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
              <label className="text-xs text-slate-500 font-medium">Image for link card (optional)</label>
              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder="https://... (leave blank for no image)"
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
              />
            </div>
            <label
              className="flex items-center gap-2 cursor-pointer select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={includeX}
                onChange={(e) => setIncludeX(e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-slate-800"
              />
              <span className="text-xs text-slate-600 flex items-center gap-1">
                <Twitter size={11} className="text-slate-700" />
                Also share to X/Twitter
              </span>
            </label>
            <div className="flex items-center gap-2">
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-slate-600 p-1 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={13} />
              </a>
              <Button
                size="sm"
                className={`flex-1 text-xs h-7 text-white ${
                  includeX ? "bg-slate-800 hover:bg-slate-900" : "bg-[#2C4BFF] hover:bg-[#1a35e0]"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPushToBuffer(article.id, includeX, customImageUrl || undefined);
                }}
                disabled={isPushing}
              >
                {isPushing ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Send size={12} className="mr-1" />
                )}
                {isPushing
                  ? "Pushing…"
                  : includeX
                  ? "Push to LinkedIn + X"
                  : "Push to Buffer"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail dialog ─────────────────────────────────────────────────────────────

function ArticleDetailDialog({
  article,
  open,
  onClose,
  onApprove,
  onDismiss,
  onRegenerate,
  onCommentaryChange,
  onXVersionChange,
  onPushToBuffer,
  isPushing,
}: {
  article: Article | null;
  open: boolean;
  onClose: () => void;
  onApprove: (id: number, includeX: boolean) => void;
  onDismiss: (id: number) => void;
  onRegenerate: (id: number) => void;
  onCommentaryChange: (id: number, text: string) => void;
  onXVersionChange: (id: number, text: string) => void;
  onPushToBuffer: (id: number, includeX: boolean, customImageUrl?: string) => void;
  isPushing: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // Initialize from article's stored preference or default false
  const [includeX, setIncludeX] = useState(article?.includeX ?? false);
  // Custom thumbnail image URL — pre-filled with article's own image if available
  const [customImageUrl, setCustomImageUrl] = useState(article?.imageUrl ?? "");

  const getXVersion = trpc.newsfeed.getXVersion.useMutation({
    onSuccess: (data, variables) => {
      onXVersionChange(variables.id, data.xVersion);
    },
    onError: (err) => toast.error(`X version generation failed: ${err.message}`),
  });

  const shortenXMutation = trpc.newsfeed.shortenXVersion.useMutation({
    onSuccess: (data, variables) => {
      onXVersionChange(variables.id, data.xVersion);
      toast.success("X post shortened — check the character count above");
    },
    onError: (err) => toast.error(`Shorten failed: ${err.message}`),
  });

  if (!article) return null;

  const handleCopy = () => {
    if (article.commentary) {
      navigator.clipboard.writeText(article.commentary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Twitter wraps all URLs to 23 chars (t.co). Use t.co-aware count for the limit check.
  const tcoAwareCount = (text: string) => {
    const urlRegex = /https?:\/\/\S+/g;
    const TCO_LEN = 23;
    return text.replace(urlRegex, (url) => "x".repeat(Math.min(url.length, TCO_LEN))).length;
  };
  const rawXText = article.xVersion ?? "";
  const charCount = tcoAwareCount(rawXText);
  const charColor =
    charCount > 280 ? "text-red-600" : charCount > 260 ? "text-amber-600" : "text-slate-400";

  const handleXToggle = (checked: boolean) => {
    setIncludeX(checked);
    if (checked && !article.xVersion) {
      getXVersion.mutate({ id: article.id });
    }
  };

  const hostname = (() => {
    try { return new URL(article.url).hostname.replace("www.", ""); } catch { return article.url; }
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold leading-snug pr-6">
            {article.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${TOPIC_COLORS[article.topic ?? ""] ?? ""}`}>
              {TOPIC_LABELS[article.topic ?? ""] ?? article.topic}
            </Badge>
            <Badge variant="outline" className="text-xs text-slate-500">
              {article.source}
            </Badge>
            {article.bufferSentAt && (
              <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 bg-blue-50">
                ✓ LinkedIn Buffer {new Date(article.bufferSentAt).toLocaleDateString()}
              </Badge>
            )}
            {article.xSentAt && (
              <Badge variant="outline" className="text-xs text-slate-700 border-slate-300 bg-slate-50">
                ✓ X {new Date(article.xSentAt).toLocaleDateString()}
              </Badge>
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Read article <ExternalLink size={11} />
            </a>
          </div>

          {/* Description */}
          {article.description && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 leading-relaxed">
              {article.description}
            </div>
          )}

          {/* Link preview card — shows what will be attached to the LinkedIn post */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
            <div className="flex items-stretch">
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt=""
                  className="w-24 h-24 object-cover shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="p-3 flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
                  {article.source ?? "Article"}
                </p>
                <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 mb-1">
                  {article.title}
                </p>
                {article.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {article.description.slice(0, 180)}
                  </p>
                )}
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1.5"
                >
                  {hostname} <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-blue-50 border-t border-blue-100">
              <p className="text-xs text-blue-700 flex items-center gap-1.5">
                <ExternalLink size={10} />
                Article URL attached as LinkedIn link preview card — image shown inside the card, not as a separate attachment
              </p>
            </div>
          </div>

          {/* LinkedIn commentary editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                LinkedIn Commentary (Pedram's Voice)
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-slate-500"
                  onClick={() => onRegenerate(article.id)}
                >
                  <RotateCcw size={11} className="mr-1" />
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-slate-500"
                  onClick={handleCopy}
                >
                  {copied ? <Check size={11} className="mr-1 text-green-600" /> : <Copy size={11} className="mr-1" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <Textarea
              value={article.commentary ?? ""}
              onChange={(e) => onCommentaryChange(article.id, e.target.value)}
              className="text-sm min-h-[200px] font-mono leading-relaxed resize-none"
              placeholder="Commentary will appear here after generation…"
            />
          </div>

          {/* X/Twitter toggle — available for both pending and approved (not yet pushed) */}
          {!article.bufferSentAt && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeX}
                    onChange={(e) => handleXToggle(e.target.checked)}
                    className="w-4 h-4 rounded accent-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                    <Twitter size={14} className="text-slate-700" />
                    Also share to X/Twitter
                  </span>
                </label>
                {includeX && article.xVersion && (
                  <span className={`text-xs font-mono ${charColor}`}>
                    {charCount}/280
                  </span>
                )}
              </div>

              {includeX && (
                <div className="p-3">
                  {getXVersion.isPending ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 py-4 justify-center">
                      <Loader2 size={14} className="animate-spin" />
                      Generating X version…
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-slate-500 mb-1.5">
                        Condensed ≤280-char version for X/Twitter (auto-generated, editable):
                      </p>
                      <Textarea
                        value={article.xVersion ?? ""}
                        onChange={(e) => onXVersionChange(article.id, e.target.value)}
                        className={`text-sm min-h-[100px] font-mono leading-relaxed resize-none ${
                          charCount > 280 ? "border-red-400 focus:ring-red-400" : ""
                        }`}
                        placeholder="X version will appear here…"
                      />
                      {charCount > 280 && (
                        <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between gap-3">
                          <p className="text-xs text-red-700">
                            <strong>{charCount}/280</strong> characters (t.co-aware) — post is too long to publish.
                            Edit the text above or use AI to shorten it automatically.
                          </p>
                          <button
                            type="button"
                            onClick={() => shortenXMutation.mutate({ id: article.id, currentText: rawXText })}
                            disabled={shortenXMutation.isPending}
                            className="shrink-0 inline-flex items-center gap-1 text-xs font-medium bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded disabled:opacity-50"
                          >
                            {shortenXMutation.isPending ? (
                              <><Loader2 size={11} className="animate-spin" /> Shortening…</>
                            ) : (
                              <>✂ AI Shorten</>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Phone-frame X post preview */}
                      {rawXText && (
                        <div className="mt-3">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1.5 font-medium">Preview — how it will look on X</p>
                          {/* Phone frame */}
                          <div className="mx-auto w-[260px] rounded-[2rem] border-2 border-slate-300 bg-slate-100 shadow-md overflow-hidden">
                            {/* Status bar */}
                            <div className="bg-slate-800 px-4 py-1.5 flex justify-between items-center">
                              <span className="text-[9px] text-slate-300 font-medium">9:41</span>
                              <div className="flex gap-1">
                                <div className="w-3 h-1.5 rounded-sm bg-slate-400" />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              </div>
                            </div>
                            {/* X app chrome */}
                            <div className="bg-black px-3 py-2 flex items-center gap-2 border-b border-slate-800">
                              <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                                <Twitter size={10} className="text-white" />
                              </div>
                              <span className="text-[10px] text-slate-300 font-semibold">X</span>
                            </div>
                            {/* Tweet card */}
                            <div className="bg-black p-3">
                              {/* Author row */}
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] text-white font-bold">PS</span>
                                </div>
                                <div>
                                  <p className="text-[10px] text-white font-semibold leading-none">Dr. Pedram Shojai</p>
                                  <p className="text-[9px] text-slate-500 leading-none mt-0.5">@PedramShojai</p>
                                </div>
                              </div>
                              {/* Tweet text — URLs rendered in sky-blue, rest in white */}
                              <p className="text-[11px] text-white leading-relaxed whitespace-pre-wrap break-words">
                                {(() => {
                                  const urlRegex = /(https?:\/\/\S+)/g;
                                  const parts = rawXText.split(urlRegex);
                                  return parts.map((part, i) =>
                                    urlRegex.test(part) ? (
                                      <span key={i} className="text-sky-400">
                                        {part.length > 30 ? part.slice(0, 27) + "…" : part}
                                      </span>
                                    ) : (
                                      <span key={i}>{part}</span>
                                    )
                                  );
                                })()}
                              </p>
                              {/* Link card */}
                              {article.url && (
                                <div className="mt-2 rounded-xl border border-slate-700 overflow-hidden">
                                  {article.imageUrl && (
                                    <img
                                      src={article.imageUrl}
                                      alt=""
                                      className="w-full h-16 object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  )}
                                  <div className="px-2 py-1.5 bg-slate-900">
                                    <p className="text-[9px] text-slate-400 truncate">{(() => { try { return new URL(article.url).hostname.replace("www.", ""); } catch { return article.url; } })()}</p>
                                    <p className="text-[10px] text-white font-medium leading-tight line-clamp-2">{article.title}</p>
                                  </div>
                                </div>
                              )}
                              {/* Engagement row */}
                              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-800">
                                {["Reply", "Repost", "Like", "Bookmark"].map((a) => (
                                  <span key={a} className="text-[9px] text-slate-600">{a}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {!includeX && (
                <div className="px-3 py-2 text-xs text-slate-400">
                  Enable to simultaneously push a condensed version to X/Twitter alongside LinkedIn.
                </div>
              )}
            </div>
          )}

          {/* Already pushed to X */}
          {article.xSentAt && (
            <div className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-200">
              <Twitter size={14} />
              Pushed to X on {new Date(article.xSentAt).toLocaleString()}
            </div>
          )}

          {/* Actions */}
          {article.status === "pending" && (
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { onDismiss(article.id); onClose(); }}
              >
                <X size={14} className="mr-1.5" />
                Skip Article
              </Button>
              <Button
                className={`flex-1 text-white ${
                  includeX ? "bg-slate-800 hover:bg-slate-900" : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={() => { onApprove(article.id, includeX); onClose(); }}
              >
                <ThumbsUp size={14} className="mr-1.5" />
                {includeX ? "Approve + X" : "Approve → LinkedIn Kanban"}
              </Button>
            </div>
          )}

          {article.status === "approved" && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
                <Check size={14} />
                Approved — moved to LinkedIn Kanban in Command Center
                {article.contentItemId && (
                  <span className="text-xs text-emerald-600">(Card #{article.contentItemId})</span>
                )}
              </div>
              {article.bufferSentAt ? (
                <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
                  <Check size={14} />
                  Pushed to LinkedIn Buffer on {new Date(article.bufferSentAt).toLocaleString()}
                </div>
              ) : (
                <>
                  {/* Custom thumbnail image URL */}
                  <div className="space-y-1 mb-2">
                    <label className="text-xs text-slate-500 font-medium">Image for link card (optional)</label>
                    <input
                      type="url"
                      value={customImageUrl}
                      onChange={(e) => setCustomImageUrl(e.target.value)}
                      placeholder="https://... (paste your own image URL, or leave blank)"
                      className="w-full text-sm border border-slate-200 rounded px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                    />
                    <p className="text-xs text-slate-400">Image travels inside the LinkedIn link preview card. Leave blank to use the article's own OG image.</p>
                  </div>
                  <Button
                    className={`w-full text-white ${
                      includeX ? "bg-slate-800 hover:bg-slate-900" : "bg-[#2C4BFF] hover:bg-[#1a35e0]"
                    }`}
                    onClick={() => onPushToBuffer(article.id, includeX, customImageUrl || undefined)}
                    disabled={isPushing || (includeX && charCount > 280)}
                  >
                    {isPushing ? (
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                    ) : (
                      <Send size={14} className="mr-1.5" />
                    )}
                    {isPushing
                      ? "Pushing to Buffer…"
                      : includeX
                      ? "Push to LinkedIn + X"
                      : "Push to LinkedIn Buffer Queue"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LinkedInNewsfeed() {
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "dismissed">("pending");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [localCommentary, setLocalCommentary] = useState<Record<number, string>>({});
  const [localXVersion, setLocalXVersion] = useState<Record<number, string>>({});
  const [pushingId, setPushingId] = useState<number | null>(null);

  const { data: articles = [], refetch: refetchArticles, isLoading } = trpc.newsfeed.getArticles.useQuery({
    topic: topicFilter === "all" ? undefined : topicFilter,
    status: activeTab,
    limit: 100,
  });

  const { data: topics = [] } = trpc.newsfeed.getTopics.useQuery();

  const refreshMutation = trpc.newsfeed.refreshFeed.useMutation({
    onSuccess: (data) => {
      toast.success(`Feed refreshed — ${data.inserted} new articles added`);
      refetchArticles();
    },
    onError: (err) => toast.error(`Refresh failed: ${err.message}`),
  });

  const approveMutation = trpc.newsfeed.approveArticle.useMutation({
    onSuccess: (data) => {
      if (data.xContentItemId) {
        toast.success(`Approved! LinkedIn card #${data.contentItemId} + X card #${data.xContentItemId} created in Command Center`);
      } else {
        toast.success(`Approved! LinkedIn card #${data.contentItemId} created in Command Center`);
      }
      refetchArticles();
    },
    onError: (err) => toast.error(`Approve failed: ${err.message}`),
  });

  const dismissMutation = trpc.newsfeed.dismissArticle.useMutation({
    onSuccess: () => refetchArticles(),
    onError: (err) => toast.error(`Dismiss failed: ${err.message}`),
  });

  const regenMutation = trpc.newsfeed.regenerateCommentary.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Commentary regenerated");
      setLocalCommentary((prev) => ({ ...prev, [variables.id]: data.commentary }));
      if (data.xVersion) {
        setLocalXVersion((prev) => ({ ...prev, [variables.id]: data.xVersion! }));
      }
      refetchArticles();
    },
    onError: (err) => toast.error(`Regeneration failed: ${err.message}`),
  });

  const bufferMutation = trpc.newsfeed.pushToBuffer.useMutation({
    onMutate: (variables) => setPushingId(variables.id),
    onSuccess: (data, variables) => {
      if (data.xPushed) {
        toast.success("Pushed to LinkedIn + X!");
      } else if (data.xError) {
        toast.success("Pushed to LinkedIn Buffer!");
        toast.warning(`X push skipped: ${data.xError}`);
      } else {
        toast.success("Commentary queued in LinkedIn Buffer with article link preview!");
      }
      setPushingId(null);
      refetchArticles();
      if (selectedArticle?.id === variables.id) {
        setSelectedArticle((prev) =>
          prev
            ? {
                ...prev,
                bufferSentAt: new Date(),
                xSentAt: data.xPushed ? new Date() : prev.xSentAt,
              }
            : prev
        );
      }
    },
    onError: (err) => {
      toast.error(`Buffer push failed: ${err.message}`);
      setPushingId(null);
    },
  });

  const mergedArticles: Article[] = articles.map((a) => ({
    ...a,
    commentary: localCommentary[a.id] ?? a.commentary,
    xVersion: localXVersion[a.id] ?? a.xVersion,
  }));

  const pendingCount = mergedArticles.filter((a) => a.status === "pending").length;
  const approvedCount = mergedArticles.filter((a) => a.status === "approved").length;

  const handleCommentaryChange = (id: number, text: string) => {
    setLocalCommentary((prev) => ({ ...prev, [id]: text }));
    if (selectedArticle?.id === id) {
      setSelectedArticle((prev) => (prev ? { ...prev, commentary: text } : prev));
    }
  };

  const handleXVersionChange = (id: number, text: string) => {
    setLocalXVersion((prev) => ({ ...prev, [id]: text }));
    if (selectedArticle?.id === id) {
      setSelectedArticle((prev) => (prev ? { ...prev, xVersion: text } : prev));
    }
  };

  const handleOpenDetail = (article: Article) => {
    setSelectedArticle({
      ...article,
      commentary: localCommentary[article.id] ?? article.commentary,
      xVersion: localXVersion[article.id] ?? article.xVersion,
    });
  };

  const handleApprove = (id: number, includeX: boolean) => {
    approveMutation.mutate({ id, includeX });
  };

  const handlePushToBuffer = (id: number, includeX: boolean, customImageUrl?: string) => {
    bufferMutation.mutate({ id, includeX, customImageUrl });
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Newspaper size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">LinkedIn Newsfeed</h1>
              <p className="text-xs text-slate-500">
                Google News + PubMed → Pedram's voice → LinkedIn (link preview) + optional X → Buffer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="All topics" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All topics</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              onClick={() => refreshMutation.mutate({ topic: topicFilter === "all" ? undefined : topicFilter })}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? (
                <Loader2 size={13} className="mr-1.5 animate-spin" />
              ) : (
                <RefreshCw size={13} className="mr-1.5" />
              )}
              {refreshMutation.isPending ? "Fetching…" : "Refresh Feed"}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
            <TabsList className="bg-white border border-slate-200 h-9">
              <TabsTrigger value="pending" className="text-xs">
                Pending
                {pendingCount > 0 && (
                  <span className="ml-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved" className="text-xs">
                Approved
                {approvedCount > 0 && (
                  <span className="ml-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {approvedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="dismissed" className="text-xs">
                Dismissed
              </TabsTrigger>
            </TabsList>

            {/* Pending tab */}
            <TabsContent value="pending" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Newspaper size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No articles yet</p>
                  <p className="text-slate-400 text-sm mt-1 mb-4">
                    Click "Refresh Feed" to discover articles from Google News and PubMed
                  </p>
                  <Button
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => refreshMutation.mutate({})}
                    disabled={refreshMutation.isPending}
                  >
                    {refreshMutation.isPending ? (
                      <Loader2 size={13} className="mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw size={13} className="mr-1.5" />
                    )}
                    {refreshMutation.isPending ? "Fetching articles…" : "Refresh Feed Now"}
                  </Button>
                  {refreshMutation.isPending && (
                    <p className="text-xs text-slate-400 mt-2">
                      Fetching articles and generating commentary — this takes ~30–60 seconds…
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {mergedArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      onApprove={handleApprove}
                      onDismiss={(id) => dismissMutation.mutate({ id })}
                      onRegenerate={(id) => regenMutation.mutate({ id })}
                      onOpenDetail={handleOpenDetail}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Approved tab */}
            <TabsContent value="approved" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ThumbsUp size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No approved articles yet</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Approved articles appear here and in the LinkedIn Kanban column
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-3 text-xs text-blue-700">
                    <Send size={14} className="shrink-0" />
                    <span>
                      <strong>{mergedArticles.filter((a) => a.bufferSentAt).length}</strong> of{" "}
                      <strong>{mergedArticles.length}</strong> pushed to LinkedIn Buffer.
                      {" "}<strong>{mergedArticles.filter((a) => a.xSentAt).length}</strong> also pushed to X.
                      {mergedArticles.filter((a) => !a.bufferSentAt).length > 0 && (
                        <> <strong>{mergedArticles.filter((a) => !a.bufferSentAt).length}</strong> ready to push.</>
                      )}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                    {mergedArticles.map((article) => (
                      <ApprovedArticleCard
                        key={article.id}
                        article={article}
                        onPushToBuffer={handlePushToBuffer}
                        onOpenDetail={handleOpenDetail}
                        isPushing={pushingId === article.id}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Dismissed tab */}
            <TabsContent value="dismissed" className="mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              ) : mergedArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <X size={40} className="text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">No dismissed articles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {mergedArticles.map((article) => (
                    <div key={article.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 opacity-60">
                      <h3 className="font-semibold text-slate-700 text-sm leading-snug mb-1 line-clamp-2">
                        {article.title}
                      </h3>
                      <p className="text-xs text-slate-400">{article.source}</p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Detail dialog */}
      <ArticleDetailDialog
        article={selectedArticle}
        open={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        onApprove={handleApprove}
        onDismiss={(id) => dismissMutation.mutate({ id })}
        onRegenerate={(id) => regenMutation.mutate({ id })}
        onCommentaryChange={handleCommentaryChange}
        onXVersionChange={handleXVersionChange}
        onPushToBuffer={handlePushToBuffer}
        isPushing={pushingId === (selectedArticle?.id ?? -1)}
      />
    </DashboardLayout>
  );
}
