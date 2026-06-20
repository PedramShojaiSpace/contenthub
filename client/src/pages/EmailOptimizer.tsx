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
  Bookmark,
  ExternalLink,
  MousePointerClick,
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

// The bookmarklet code — minified JS that runs on app.kajabi.com
// It reads TinyMCE content, POSTs to our optimizer, and injects the result back
const OPTIMIZER_API = "https://content.theurbanmonk.com/api/email-optimizer/optimize";
const OPTIMIZER_KEY = "dfagsdfghs993452345";

const bookmarkletCode = `javascript:(async function(){
  var editor=window.tinymce&&window.tinymce.activeEditor;
  if(!editor){alert('Click inside the email text area first, then run this bookmarklet.');return;}
  var html=editor.getContent();
  if(!html||html.length<10){alert('No HTML found in editor. Make sure you have a text block selected.');return;}
  var btn=document.createElement('div');
  btn.style='position:fixed;top:20px;right:20px;z-index:99999;background:#1a1a2e;color:#fbbf24;padding:12px 20px;border-radius:8px;font-family:sans-serif;font-size:14px;border:1px solid #fbbf24;box-shadow:0 4px 20px rgba(0,0,0,0.5)';
  btn.textContent='⚡ Optimizing email...';
  document.body.appendChild(btn);
  try{
    var res=await fetch('${OPTIMIZER_API}',{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Optimizer-Key':'${OPTIMIZER_KEY}'},
      body:JSON.stringify({html:html})
    });
    var data=await res.json();
    if(data.error){btn.textContent='❌ Error: '+data.error;setTimeout(function(){btn.remove()},4000);return;}
    editor.setContent(data.optimizedHtml);
    btn.style.background='#052e16';
    btn.style.borderColor='#4ade80';
    btn.style.color='#4ade80';
    btn.textContent='✅ Optimized! -'+data.reductionPercent+'% smaller. Click Save in Kajabi.';
    setTimeout(function(){btn.remove()},6000);
  }catch(e){
    btn.textContent='❌ Error: '+e.message;
    setTimeout(function(){btn.remove()},5000);
  }
})();`;

export default function EmailOptimizer() {
  const [inputHtml, setInputHtml] = useState("");
  const [result, setResult] = useState<OptResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookmarklet" | "manual">("bookmarklet");

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

  const handleCopyBookmarklet = async () => {
    await navigator.clipboard.writeText(bookmarkletCode);
    toast.success("Bookmarklet code copied — paste it as a bookmark URL");
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
            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
              Kajabi Integration
            </Badge>
          </div>
          <p className="text-sm text-white/50 ml-12">
            Strips marketing template signals from Kajabi emails so they land in the Primary inbox instead of Promotions.
            Two modes: one-click bookmarklet (recommended) or manual copy-paste.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-8 space-y-8">

        {/* Tab switcher */}
        <div className="flex gap-2 border-b border-white/8 pb-0">
          <button
            onClick={() => setActiveTab("bookmarklet")}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === "bookmarklet"
                ? "border-amber-400 text-amber-400 bg-amber-500/5"
                : "border-transparent text-white/50 hover:text-white/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <MousePointerClick className="w-4 h-4" />
              One-Click Bookmarklet
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs ml-1">Recommended</Badge>
            </span>
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === "manual"
                ? "border-amber-400 text-amber-400 bg-amber-500/5"
                : "border-transparent text-white/50 hover:text-white/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4" />
              Manual Copy-Paste
            </span>
          </button>
        </div>

        {/* BOOKMARKLET TAB */}
        {activeTab === "bookmarklet" && (
          <div className="space-y-6">
            {/* What is a bookmarklet */}
            <div className="rounded-xl border border-amber-800/30 bg-amber-950/15 p-5">
              <div className="flex gap-3">
                <Bookmark className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white/90">What is a bookmarklet?</p>
                  <p className="text-sm text-white/60">
                    A bookmarklet is a browser bookmark that runs JavaScript instead of opening a URL.
                    When you click it while editing a Kajabi email, it automatically reads the email HTML,
                    sends it to our optimizer, and injects the cleaned version back — all in under 2 seconds.
                    No copy-paste needed. This is the same approach used by tools like EmoMarketing.
                  </p>
                </div>
              </div>
            </div>

            {/* Step-by-step install */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
                Install the Bookmarklet (one-time setup)
              </h2>

              <div className="grid grid-cols-2 gap-4">
                {/* Method A: Drag */}
                <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-3">
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Method A — Drag to Bookmarks Bar</p>
                  <p className="text-xs text-white/55">
                    Make sure your bookmarks bar is visible (Ctrl+Shift+B on Chrome/Edge, Cmd+Shift+B on Mac).
                    Then drag the button below directly to your bookmarks bar.
                  </p>
                  <div className="flex justify-center py-2">
                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                    <a
                      href={bookmarkletCode}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition-colors cursor-grab active:cursor-grabbing select-none"
                      onClick={(e) => { e.preventDefault(); toast.info("Drag this button to your bookmarks bar — don't click it here"); }}
                      draggable
                    >
                      <Zap className="w-4 h-4" />
                      ⚡ Optimize Kajabi Email
                    </a>
                  </div>
                  <p className="text-xs text-white/35 text-center">← Drag this to your bookmarks bar</p>
                </div>

                {/* Method B: Manual */}
                <div className="rounded-xl border border-white/8 bg-white/4 p-5 space-y-3">
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Method B — Create Manually</p>
                  <ol className="text-xs text-white/55 space-y-1.5 list-decimal list-inside">
                    <li>Click the button below to copy the bookmarklet code</li>
                    <li>Right-click your bookmarks bar → <strong className="text-white/70">Add bookmark</strong></li>
                    <li>Name it <strong className="text-white/70">"⚡ Optimize Kajabi Email"</strong></li>
                    <li>In the URL field, paste the copied code</li>
                    <li>Click Save</li>
                  </ol>
                  <Button
                    onClick={handleCopyBookmarklet}
                    size="sm"
                    variant="outline"
                    className="w-full gap-2 border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Bookmarklet Code
                  </Button>
                </div>
              </div>
            </div>

            {/* How to use */}
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">2</span>
                Use It Every Time You Send an Email
              </h2>

              <div className="rounded-xl border border-white/8 bg-white/4 p-5">
                <ol className="space-y-3">
                  {[
                    { step: "Open your Kajabi email broadcast or sequence email", detail: "Go to Marketing → Email Campaigns → your email" },
                    { step: "Click into a text block to make it active", detail: "The TinyMCE editor toolbar should appear above the text area" },
                    { step: "Click '⚡ Optimize Kajabi Email' in your bookmarks bar", detail: "A status badge will appear in the top-right corner of your screen" },
                    { step: "Wait 1–2 seconds for the green confirmation", detail: "The email content is automatically replaced with the optimized version" },
                    { step: "Click Save in Kajabi, then send as normal", detail: "That's it — the email is now stripped of promotional signals" },
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-white/10 text-white/50 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                      <div>
                        <p className="text-sm text-white/80">{item.step}</p>
                        <p className="text-xs text-white/40 mt-0.5">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* What it does */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">3</span>
                What the Optimizer Does
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { title: "CSS Inlining", desc: "Converts <style> blocks to inline styles — Gmail strips external CSS entirely" },
                  { title: "Class & ID Removal", desc: "Strips class=\"\" and id=\"\" — the #1 signal Gmail uses to identify marketing templates" },
                  { title: "Tracking Pixel Removal", desc: "Removes 1×1 tracking images and pixels with track/pixel/open in the URL" },
                  { title: "Data Attribute Cleanup", desc: "Removes all data-* attributes Kajabi injects for its own internal tracking" },
                  { title: "Non-ASCII Normalization", desc: "Converts smart quotes, em dashes, ellipses to plain ASCII characters" },
                  { title: "HTML Minification", desc: "Collapses whitespace, removes comments — typically 40–65% size reduction" },
                ].map((item) => (
                  <div key={item.title} className="rounded-lg border border-white/8 bg-white/3 p-3">
                    <p className="text-xs font-semibold text-amber-400/80 mb-1">{item.title}</p>
                    <p className="text-xs text-white/50">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Important notes */}
            <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-white/70 space-y-1">
                  <p className="font-medium text-white/90">Important notes</p>
                  <ul className="text-xs text-white/55 space-y-1 list-disc list-inside">
                    <li>The bookmarklet works on the <strong className="text-white/70">Visual Editor</strong> in Kajabi. Make sure you click into a text block first.</li>
                    <li>Kajabi only allows certain HTML tags in emails (<code className="text-amber-400/70">p, a, strong, em, img, br, h1–h3, span, li, ul, ol</code>). The optimizer respects this whitelist.</li>
                    <li>The bookmarklet connects to <strong className="text-white/70">content.theurbanmonk.com</strong> — it will only work when that server is running.</li>
                    <li>Always preview your email in Kajabi after optimizing to confirm the visual layout is unchanged.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Link to Kajabi */}
            <div className="flex gap-3">
              <a
                href="https://app.kajabi.com/admin/last_site/marketing/email_campaigns"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/60 text-sm hover:text-white hover:border-white/30 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open Kajabi Email Campaigns
              </a>
            </div>
          </div>
        )}

        {/* MANUAL TAB */}
        {activeTab === "manual" && (
          <div className="space-y-6">
            {/* How it works */}
            <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-white/70 space-y-1">
                  <p className="font-medium text-white/90">Manual workflow</p>
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
        )}
      </div>
    </div>
  );
}
