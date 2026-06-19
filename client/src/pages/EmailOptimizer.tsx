import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Mail,
  Zap,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  FileCode2,
  BarChart3,
  Info,
} from "lucide-react";

type Severity = "ok" | "warning" | "bad";

interface SpamSignal {
  name: string;
  value: string | number;
  severity: Severity;
  tip: string;
}

interface OptResult {
  optimizedHtml: string;
  originalBytes: number;
  optimizedBytes: number;
  reductionPercent: number;
  changes: string[];
  spamScore: {
    before: number;
    after: number;
    signals: SpamSignal[];
  };
}

const severityIcon = (s: Severity) => {
  if (s === "ok") return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
  if (s === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />;
  return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
};

const severityBg = (s: Severity) => {
  if (s === "ok") return "border-green-800/40 bg-green-950/20";
  if (s === "warning") return "border-yellow-800/40 bg-yellow-950/20";
  return "border-red-800/40 bg-red-950/20";
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  return `${(b / 1024).toFixed(1)} KB`;
}

function ScoreBar({ score, max = 15 }: { score: number; max?: number }) {
  const pct = Math.min(100, Math.round((score / max) * 100));
  const color = score <= 3 ? "bg-green-500" : score <= 7 ? "bg-yellow-500" : "bg-red-500";
  const label = score <= 3 ? "Low risk" : score <= 7 ? "Moderate risk" : "High risk";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function EmailOptimizer() {
  const [inputHtml, setInputHtml] = useState("");
  const [result, setResult] = useState<OptResult | null>(null);
  const [copied, setCopied] = useState(false);

  const optimize = trpc.emailOptimizer.optimizeHtml.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Reduced by ${data.reductionPercent}% — ${data.changes.length} optimizations applied`);
    },
    onError: (err) => {
      toast.error(err.message || "Optimization failed");
    },
  });

  const handleOptimize = () => {
    if (!inputHtml.trim()) {
      toast.error("Paste your Kajabi email HTML first");
      return;
    }
    optimize.mutate({ html: inputHtml });
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.optimizedHtml);
    setCopied(true);
    toast.success("Optimized HTML copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-[#0d0d14] px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <h1 className="text-xl font-semibold text-white">Email Optimizer</h1>
            <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
              Inbox Placement
            </Badge>
          </div>
          <p className="text-sm text-white/50 ml-12">
            Paste your Kajabi email HTML, optimize it, and copy the cleaned version back into Kajabi.
            Reduces Gmail Promotions tab classification by stripping marketing template signals.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">
        {/* How it works */}
        <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-white/70 space-y-1">
              <p className="font-medium text-white/90">How to use this tool</p>
              <ol className="list-decimal list-inside space-y-1 text-white/60">
                <li>In Kajabi, open your email broadcast and click <strong className="text-white/80">Source Code</strong> (the &lt;/&gt; button in the editor toolbar)</li>
                <li>Select all the HTML and paste it below</li>
                <li>Click <strong className="text-white/80">Optimize Email</strong> — the tool removes bloat, inlines CSS, strips tracking signals</li>
                <li>Copy the optimized HTML and paste it back into Kajabi's source code view</li>
                <li>Send as normal — cleaner HTML = better inbox placement</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white/80 flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-white/40" />
              Paste Kajabi Email HTML
            </label>
            {inputHtml && (
              <span className="text-xs text-white/40">{formatBytes(new TextEncoder().encode(inputHtml).length)}</span>
            )}
          </div>
          <Textarea
            value={inputHtml}
            onChange={(e) => setInputHtml(e.target.value)}
            placeholder="Paste the full HTML source from your Kajabi email here..."
            className="h-52 font-mono text-xs bg-white/5 border-white/10 text-white/80 placeholder:text-white/25 resize-none"
          />
          <Button
            onClick={handleOptimize}
            disabled={optimize.isPending || !inputHtml.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold gap-2"
          >
            <Zap className="w-4 h-4" />
            {optimize.isPending ? "Optimizing..." : "Optimize Email"}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-center">
                <p className="text-xs text-white/40 mb-1">Original Size</p>
                <p className="text-2xl font-bold text-white">{formatBytes(result.originalBytes)}</p>
              </div>
              <div className="rounded-xl border border-green-800/40 bg-green-950/20 p-4 text-center">
                <p className="text-xs text-white/40 mb-1">Reduction</p>
                <p className="text-2xl font-bold text-green-400">-{result.reductionPercent}%</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-center">
                <p className="text-xs text-white/40 mb-1">Optimized Size</p>
                <p className="text-2xl font-bold text-white">{formatBytes(result.optimizedBytes)}</p>
              </div>
            </div>

            {/* Spam score comparison */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-white/40" />
                <h3 className="text-sm font-semibold text-white/90">Promotional Signal Score</h3>
                <span className="text-xs text-white/40">(lower is better)</span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-white/50 mb-2">Before</p>
                  <ScoreBar score={result.spamScore.before} />
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-2">After</p>
                  <ScoreBar score={result.spamScore.after} />
                </div>
              </div>

              {/* Signal breakdown */}
              <div className="space-y-2 pt-2 border-t border-white/8">
                <p className="text-xs text-white/50 font-medium">Signal Breakdown (after optimization)</p>
                {result.spamScore.signals.map((sig) => (
                  <div
                    key={sig.name}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${severityBg(sig.severity)}`}
                  >
                    {severityIcon(sig.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-white/80">{sig.name}</span>
                        <span className="text-xs text-white/50">{sig.value}</span>
                      </div>
                      <p className="text-xs text-white/45 mt-0.5">{sig.tip}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Changes applied */}
            <div className="rounded-xl border border-white/8 bg-white/4 p-5">
              <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                {result.changes.length} Optimizations Applied
              </h3>
              <ul className="space-y-1.5">
                {result.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <ArrowRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    {change}
                  </li>
                ))}
              </ul>
            </div>

            {/* Optimized HTML output */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-green-400" />
                  Optimized HTML — Copy this back into Kajabi
                </label>
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="outline"
                  className="gap-2 border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied!" : "Copy HTML"}
                </Button>
              </div>
              <Textarea
                value={result.optimizedHtml}
                readOnly
                className="h-52 font-mono text-xs bg-green-950/10 border-green-800/30 text-white/70 resize-none"
              />
              <p className="text-xs text-white/35">
                Paste this into Kajabi's email editor → click the &lt;/&gt; Source Code button → select all → paste → click Save.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
