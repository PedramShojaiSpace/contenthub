import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  Layers,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Download,
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

interface BulkEmailEntry {
  id: string;
  label: string;
  html: string;
}

interface BulkResult extends OptResult {
  label: string;
  success: boolean;
  error: string | null;
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

let idCounter = 0;
const newEntry = (label = "", html = ""): BulkEmailEntry => ({
  id: `entry-${++idCounter}`,
  label,
  html,
});

export default function EmailOptimizer() {
  const [inputHtml, setInputHtml] = useState("");
  const [result, setResult] = useState<OptResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookmarklet" | "manual" | "bulk">("bookmarklet");

  // Bulk state
  const [bulkEntries, setBulkEntries] = useState<BulkEmailEntry[]>([newEntry("Welcome Email", ""), newEntry("Day 3 Follow-up", "")]);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  const optimize = trpc.emailOptimizer.optimizeHtml.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Reduced by ${data.reductionPercent}% — ${data.changes.length} optimizations applied`);
    },
    onError: (err) => {
      toast.error(err.message || "Optimization failed");
    },
  });

  const bulkOptimize = trpc.emailOptimizer.bulkOptimize.useMutation({
    onSuccess: (data) => {
      setBulkResults(data.results as BulkResult[]);
      const successCount = data.results.filter((r) => r.success).length;
      const failCount = data.results.length - successCount;
      if (failCount === 0) {
        toast.success(`All ${successCount} emails optimized successfully`);
      } else {
        toast.warning(`${successCount} optimized, ${failCount} failed`);
      }
    },
    onError: (err) => {
      toast.error(err.message || "Bulk optimization failed");
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

  const handleBulkOptimize = () => {
    const validEntries = bulkEntries.filter((e) => e.label.trim() && e.html.trim());
    if (validEntries.length === 0) {
      toast.error("Add at least one email with a label and HTML content");
      return;
    }
    setBulkResults(null);
    bulkOptimize.mutate({
      emails: validEntries.map((e) => ({ label: e.label.trim(), html: e.html.trim() })),
    });
  };

  const addEntry = () => setBulkEntries((prev) => [...prev, newEntry()]);
  const removeEntry = (id: string) => setBulkEntries((prev) => prev.filter((e) => e.id !== id));
  const updateEntry = (id: string, field: "label" | "html", value: string) =>
    setBulkEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  const toggleExpand = (label: string) =>
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const copyBulkResult = async (html: string, label: string) => {
    await navigator.clipboard.writeText(html);
    toast.success(`Copied "${label}" — paste into Kajabi`);
  };

  const downloadAllResults = () => {
    if (!bulkResults) return;
    const content = bulkResults
      .filter((r) => r.success)
      .map((r) => `<!-- ===== ${r.label} ===== -->\n${r.optimizedHtml}`)
      .join("\n\n");
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kajabi-optimized-sequence-emails.html";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded all optimized emails");
  };

  const validBulkCount = bulkEntries.filter((e) => e.label.trim() && e.html.trim()).length;

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
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs ml-1">Broadcasts</Badge>
            </span>
          </button>
          <button
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              activeTab === "bulk"
                ? "border-amber-400 text-amber-400 bg-amber-500/5"
                : "border-transparent text-white/50 hover:text-white/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Bulk Sequence Optimizer
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs ml-1">Automations</Badge>
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
              Single Email
            </span>
          </button>
        </div>

        {/* BOOKMARKLET TAB */}
        {activeTab === "bookmarklet" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-amber-800/30 bg-amber-950/15 p-5">
              <div className="flex gap-3">
                <Bookmark className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white/90">What is a bookmarklet?</p>
                  <p className="text-sm text-white/60">
                    A bookmarklet is a browser bookmark that runs JavaScript instead of opening a URL.
                    When you click it while editing a Kajabi email, it automatically reads the email HTML,
                    sends it to our optimizer, and injects the cleaned version back — all in under 2 seconds.
                    No copy-paste needed. <strong className="text-amber-400">Best for broadcast emails you send manually.</strong>
                  </p>
                  <p className="text-sm text-white/50">
                    For automation/sequence emails, use the <button onClick={() => setActiveTab("bulk")} className="text-purple-400 underline underline-offset-2">Bulk Sequence Optimizer</button> tab instead.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">1</span>
                Install the Bookmarklet (one-time setup)
              </h2>

              <div className="grid grid-cols-2 gap-4">
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

            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold">2</span>
                Use It Every Time You Send a Broadcast Email
              </h2>

              <div className="rounded-xl border border-white/8 bg-white/4 p-5">
                <ol className="space-y-3">
                  {[
                    { step: "Open your Kajabi email broadcast", detail: "Go to Marketing → Email Campaigns → your email" },
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

            <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-white/70 space-y-1">
                  <p className="font-medium text-white/90">Important notes</p>
                  <ul className="text-xs text-white/55 space-y-1 list-disc list-inside">
                    <li>The bookmarklet works on the <strong className="text-white/70">Visual Editor</strong> in Kajabi. Make sure you click into a text block first.</li>
                    <li>The bookmarklet connects to <strong className="text-white/70">content.theurbanmonk.com</strong> — it will only work when that server is running.</li>
                    <li>Always preview your email in Kajabi after optimizing to confirm the visual layout is unchanged.</li>
                    <li>For automation/sequence emails that fire automatically, use the <button onClick={() => setActiveTab("bulk")} className="text-purple-400 underline underline-offset-2">Bulk Sequence Optimizer</button> tab.</li>
                  </ul>
                </div>
              </div>
            </div>

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

        {/* BULK SEQUENCE OPTIMIZER TAB */}
        {activeTab === "bulk" && (
          <div className="space-y-6">
            {/* Explanation */}
            <div className="rounded-xl border border-purple-800/30 bg-purple-950/15 p-5">
              <div className="flex gap-3">
                <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white/90">Bulk Sequence Email Optimizer</p>
                  <p className="text-sm text-white/60">
                    Kajabi automation emails fire automatically — there is no "send" button to click before they go out.
                    The solution is a <strong className="text-white/80">one-time cleanup session</strong>: paste the HTML from each
                    automation email here, optimize them all at once, then paste the cleaned versions back into Kajabi.
                    Once saved, those emails stay optimized permanently — they fire clean every time.
                  </p>
                  <div className="flex gap-6 pt-1">
                    <div className="text-xs text-white/50">
                      <span className="text-purple-400 font-semibold">Step 1</span> — Go to each Kajabi sequence email → click the <code className="bg-white/10 px-1 rounded">&lt;/&gt;</code> Source Code button → copy all HTML
                    </div>
                    <div className="text-xs text-white/50">
                      <span className="text-purple-400 font-semibold">Step 2</span> — Paste each email below with a label → click Optimize All
                    </div>
                    <div className="text-xs text-white/50">
                      <span className="text-purple-400 font-semibold">Step 3</span> — Copy each result back into Kajabi → Save
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Email entry list */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white/90">
                  Sequence Emails to Optimize
                  <span className="ml-2 text-white/40 font-normal">({validBulkCount} ready)</span>
                </h2>
                <Button
                  onClick={addEntry}
                  size="sm"
                  variant="outline"
                  className="gap-2 border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
                >
                  <Plus className="w-4 h-4" />
                  Add Email
                </Button>
              </div>

              <div className="space-y-3">
                {bulkEntries.map((entry, idx) => (
                  <div key={entry.id} className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-white/30 w-5 text-center shrink-0">{idx + 1}</span>
                      <Input
                        value={entry.label}
                        onChange={(e) => updateEntry(entry.id, "label", e.target.value)}
                        placeholder='e.g. "Welcome Email", "Day 3 Follow-up", "Abandoned Cart #1"'
                        className="flex-1 h-8 text-sm bg-white/5 border-white/10 text-white/80 placeholder:text-white/25"
                      />
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="p-1.5 rounded-md text-white/30 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Remove this email"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Textarea
                      value={entry.html}
                      onChange={(e) => updateEntry(entry.id, "html", e.target.value)}
                      placeholder="Paste the HTML source code from this Kajabi sequence email here..."
                      className="h-32 font-mono text-xs bg-white/5 border-white/10 text-white/70 placeholder:text-white/20 resize-none"
                    />
                    {entry.html && (
                      <p className="text-xs text-white/30">{formatBytes(new TextEncoder().encode(entry.html).length)}</p>
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleBulkOptimize}
                disabled={bulkOptimize.isPending || validBulkCount === 0}
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold gap-2 px-6"
              >
                <Zap className="w-4 h-4" />
                {bulkOptimize.isPending
                  ? `Optimizing ${validBulkCount} emails...`
                  : `Optimize All ${validBulkCount} Email${validBulkCount !== 1 ? "s" : ""}`}
              </Button>
            </div>

            {/* Bulk Results */}
            {bulkResults && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    Optimization Complete — {bulkResults.filter((r) => r.success).length} of {bulkResults.length} emails optimized
                  </h2>
                  <Button
                    onClick={downloadAllResults}
                    size="sm"
                    variant="outline"
                    className="gap-2 border-white/15 text-white/70 hover:text-white hover:border-white/30 bg-transparent"
                  >
                    <Download className="w-4 h-4" />
                    Download All as HTML
                  </Button>
                </div>

                {/* Summary row */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-center">
                    <p className="text-xs text-white/40 mb-1">Emails Processed</p>
                    <p className="text-2xl font-bold text-white">{bulkResults.length}</p>
                  </div>
                  <div className="rounded-xl border border-green-800/40 bg-green-950/20 p-4 text-center">
                    <p className="text-xs text-white/40 mb-1">Avg. Reduction</p>
                    <p className="text-2xl font-bold text-green-400">
                      -{Math.round(bulkResults.filter(r => r.success).reduce((acc, r) => acc + r.reductionPercent, 0) / Math.max(1, bulkResults.filter(r => r.success).length))}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/4 p-4 text-center">
                    <p className="text-xs text-white/40 mb-1">Total Size Saved</p>
                    <p className="text-2xl font-bold text-white">
                      {formatBytes(bulkResults.filter(r => r.success).reduce((acc, r) => acc + (r.originalBytes - r.optimizedBytes), 0))}
                    </p>
                  </div>
                </div>

                {/* Individual results */}
                <div className="space-y-3">
                  {bulkResults.map((res) => (
                    <div
                      key={res.label}
                      className={`rounded-xl border ${res.success ? "border-white/8 bg-white/3" : "border-red-800/40 bg-red-950/15"}`}
                    >
                      {/* Result header */}
                      <div className="flex items-center gap-3 p-4">
                        {res.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="flex-1 text-sm font-medium text-white/90">{res.label}</span>
                        {res.success && (
                          <>
                            <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
                              -{res.reductionPercent}% smaller
                            </Badge>
                            <Badge className="bg-white/8 text-white/50 border-white/10 text-xs">
                              {res.changes.length} changes
                            </Badge>
                            <Button
                              onClick={() => copyBulkResult(res.optimizedHtml, res.label)}
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold gap-1.5 h-7 px-3"
                            >
                              <Copy className="w-3 h-3" />
                              Copy HTML
                            </Button>
                            <button
                              onClick={() => toggleExpand(res.label)}
                              className="p-1.5 rounded-md text-white/40 hover:text-white/70 transition-colors"
                            >
                              {expandedResults.has(res.label) ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          </>
                        )}
                        {!res.success && (
                          <span className="text-xs text-red-400">{res.error}</span>
                        )}
                      </div>

                      {/* Expanded result details */}
                      {res.success && expandedResults.has(res.label) && (
                        <div className="border-t border-white/8 p-4 space-y-4">
                          {/* Score comparison */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-white/40 mb-2">Promotional Signal Score — Before</p>
                              <ScoreBar score={res.spamScore.before} />
                            </div>
                            <div>
                              <p className="text-xs text-white/40 mb-2">Promotional Signal Score — After</p>
                              <ScoreBar score={res.spamScore.after} />
                            </div>
                          </div>

                          {/* Changes */}
                          <div>
                            <p className="text-xs text-white/50 font-medium mb-2">Optimizations Applied</p>
                            <ul className="space-y-1">
                              {res.changes.map((change, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-white/55">
                                  <ArrowRight className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                  {change}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Optimized HTML preview */}
                          <div className="space-y-2">
                            <p className="text-xs text-white/50 font-medium">Optimized HTML</p>
                            <Textarea
                              value={res.optimizedHtml}
                              readOnly
                              className="h-36 font-mono text-xs bg-green-950/10 border-green-800/30 text-white/60 resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Instructions for pasting back */}
                <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-white/70 space-y-1">
                      <p className="font-medium text-white/90">How to paste back into Kajabi</p>
                      <ol className="text-xs text-white/55 space-y-1 list-decimal list-inside">
                        <li>Click <strong className="text-white/70">Copy HTML</strong> next to the email you want to update</li>
                        <li>In Kajabi, open that sequence email → click the <code className="bg-white/10 px-1 rounded">&lt;/&gt;</code> Source Code button</li>
                        <li>Select all existing content (Ctrl+A / Cmd+A) and paste the optimized HTML</li>
                        <li>Click OK, then Save the email</li>
                        <li>Repeat for each email in the sequence</li>
                      </ol>
                      <p className="text-xs text-white/40 pt-1">
                        Once saved, the automation fires the optimized HTML every time — no further action needed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MANUAL SINGLE EMAIL TAB */}
        {activeTab === "manual" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-blue-800/30 bg-blue-950/20 p-4">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-sm text-white/70 space-y-1">
                  <p className="font-medium text-white/90">Manual single-email workflow</p>
                  <ol className="list-decimal list-inside space-y-1 text-white/60">
                    <li>In Kajabi, open your email and click <strong className="text-white/80">Source Code</strong> (the &lt;/&gt; button)</li>
                    <li>Select all the HTML and paste it below</li>
                    <li>Click <strong className="text-white/80">Optimize Email</strong></li>
                    <li>Copy the optimized HTML and paste it back into Kajabi's source code view</li>
                    <li>Send as normal</li>
                  </ol>
                </div>
              </div>
            </div>

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

            {result && (
              <div className="space-y-6 animate-in fade-in duration-300">
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
