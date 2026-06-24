import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Mail,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowRight,
  MailCheck,
  PenLine,
  Bookmark,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type GeneratedEmail = {
  subjectA: string;
  subjectB: string;
  subjectC: string;
  body: string;
};

function CopyButton({ text, label, large }: { text: string; label?: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copied!` : "Copied!");
    setTimeout(() => setCopied(false), 2500);
  };
  if (large) {
    return (
      <Button
        onClick={handleCopy}
        className={`w-full transition-colors ${
          copied
            ? "bg-emerald-600 hover:bg-emerald-600 text-white"
            : "bg-stone-900 hover:bg-stone-800 text-white"
        }`}
      >
        {copied ? (
          <><Check className="w-4 h-4 mr-2" /> Copied — paste into Kajabi</>
        ) : (
          <><Copy className="w-4 h-4 mr-2" /> Copy Email Body</>
        )}
      </Button>
    );
  }
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function ResultPanel({ result, onReset }: { result: GeneratedEmail; onReset: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="font-semibold text-stone-900">Rewritten Email Ready</h2>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-stone-400 hover:text-stone-600 underline"
        >
          Rewrite another
        </button>
      </div>

      {/* Subject lines */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 space-y-3">
        <p className="text-sm font-semibold text-stone-700">
          Step 1 — Pick a subject line and copy it:
        </p>
        {[
          { label: "Option A", value: result.subjectA, note: "Curious / question-based" },
          { label: "Option B", value: result.subjectB, note: "Benefit-led" },
          { label: "Option C", value: result.subjectC, note: "Personal / story-based" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-start justify-between gap-3 rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                  {s.label}
                </span>
                <span className="text-xs text-stone-400 italic">{s.note}</span>
              </div>
              <p className="text-sm font-medium text-stone-800">{s.value}</p>
            </div>
            <CopyButton text={s.value} label={s.label} />
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100">
          <p className="text-sm font-semibold text-stone-700">
            Step 2 — Copy the email body:
          </p>
          <span className="text-xs text-stone-400">
            {result.body.split(/\s+/).length} words
          </span>
        </div>
        <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed p-4 max-h-[420px] overflow-y-auto">
          {result.body}
        </pre>
        <div className="px-4 pb-4">
          <CopyButton text={result.body} label="Email body" large />
        </div>
      </div>

      {/* Kajabi instructions */}
      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-900">
          Step 3 — Send in Kajabi:
        </p>
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-amber-800">
          <li>Email → New Broadcast → choose <strong>"Simple Text"</strong> template (Kajabi's name for plain text)</li>
          <li>Remove any button blocks — keep only the text block + mandatory footer</li>
          <li>Paste your chosen subject line into the Subject field</li>
          <li>Paste the email body into the body field</li>
          <li>Send a test to yourself first</li>
        </ol>
        <div className="rounded-lg bg-amber-100/60 border border-amber-200 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-amber-900">About the URLs in the email body</p>
          <p className="text-xs text-amber-800">
            Links appear as naked URLs (e.g. <span className="font-mono">https://...</span>) — this is intentional.
            Every email client (Gmail, Apple Mail, Outlook) auto-links them so readers can click normally.
            Using HTML anchor tags instead would add code that triggers Gmail's Promotions filter.
            <strong> Do not manually re-insert hyperlinks</strong> — the naked URL is the clickable link.
          </p>
        </div>
        <div className="rounded-lg bg-amber-100/60 border border-amber-200 px-3 py-2 space-y-1">
          <p className="text-xs font-semibold text-amber-900">Why some emails still land in Promotions</p>
          <p className="text-xs text-amber-800">
            Gmail's inbox placement is mostly driven by <strong>per-recipient history</strong>, not email content.
            A subscriber who has opened/clicked your emails before will almost always get Primary.
            A brand-new address with no history may still see Promotions on the first send — that's normal and improves over time as they engage.
            The plain text format reduces content-side risk; engagement history does the rest.
          </p>
        </div>
      </div>
    </div>
  );
}

function HistoryItem({
  item,
  onDelete,
}: {
  item: {
    id: number;
    subject: string;
    episodeTitle: string | null;
    generatedText: string;
    subjectLineA: string | null;
    subjectLineB: string | null;
    subjectLineC: string | null;
    createdAt: Date | string;
  };
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-800 truncate">
            {item.episodeTitle || item.subject}
          </p>
          <p className="text-xs text-stone-400 mt-0.5">
            {new Date(item.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1"
          >
            {expanded ? "Hide" : "View"}
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="text-stone-300 hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-stone-100 p-3 space-y-3 bg-stone-50">
          {item.subjectLineA && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Subject Lines</p>
              {[item.subjectLineA, item.subjectLineB, item.subjectLineC]
                .filter(Boolean)
                .map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm text-stone-700">
                    <span className="flex-1">{s}</span>
                    <CopyButton text={s!} />
                  </div>
                ))}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Email Body</p>
              <CopyButton text={item.generatedText} label="Email body" />
            </div>
            <pre className="text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed bg-white rounded border border-stone-200 p-3 max-h-48 overflow-y-auto">
              {item.generatedText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// The bookmarklet JS — grabs page text (including Kajabi iframe editor) and opens the rewriter
// It tries: 1) Kajabi's email body iframe, 2) visible input/textarea fields, 3) full page text
const BOOKMARKLET_CODE = `javascript:(function(){
  var text='';
  var subject='';
  // Try to grab subject line from Kajabi's subject input field
  var subjectInput=document.querySelector('input[name="subject"],input[placeholder*="subject" i],input[placeholder*="Subject" i],input[id*="subject" i]');
  if(subjectInput) subject=subjectInput.value||'';
  // Try to grab text from Kajabi's email body iframe (visual editor)
  var frames=document.querySelectorAll('iframe');
  for(var i=0;i<frames.length;i++){
    try{
      var fd=frames[i].contentDocument||frames[i].contentWindow.document;
      var ft=fd.body?fd.body.innerText:'';
      if(ft&&ft.length>text.length) text=ft;
    }catch(e){}
  }
  // Fallback: grab all textarea content
  if(!text){
    var areas=document.querySelectorAll('textarea');
    for(var j=0;j<areas.length;j++){
      if(areas[j].value.length>text.length) text=areas[j].value;
    }
  }
  // Final fallback: visible page text
  if(!text) text=document.body.innerText||'';
  // If still no subject, use page title
  if(!subject) subject=document.title||'';
  var u=encodeURIComponent(text.slice(0,8000));
  var h=encodeURIComponent(subject);
  window.open('https://content.theurbanmonk.com/plain-text-email?grab=1&text='+u+'&subject='+h,'_blank');
})();`;

function BookmarkletSection() {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(BOOKMARKLET_CODE);
    setCopied(true);
    toast.success("Bookmarklet code copied!");
    setTimeout(() => setCopied(false), 3000);
  };
  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
        <Bookmark className="w-4 h-4 text-stone-500" />
        <h2 className="font-semibold text-stone-800 text-sm">Browser Bookmarklet</h2>
        <span className="text-xs text-stone-400 ml-1">— one-click email grabber for your VA</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="text-sm text-stone-600">
          Drag the button below to your browser's bookmarks bar. Works on Gmail messages and most web pages.
        </p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <p className="text-xs text-amber-800">
            <span className="font-semibold">⚠️ Doesn't work inside Kajabi's email editor</span> — Kajabi runs its editor in a sandboxed iframe that blocks bookmarklets. Use the <strong>Manual Copy method</strong> for Kajabi: copy the email body text directly, paste it into the box above.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* The draggable bookmarklet button */}
          <a
            href={BOOKMARKLET_CODE}
            onClick={(e) => { e.preventDefault(); toast.info("Drag this button to your bookmarks bar — don't click it here."); }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 cursor-grab select-none hover:bg-emerald-100 transition-colors shrink-0"
            title="Drag me to your bookmarks bar"
          >
            📧 Grab for Rewriter
          </a>
          <div className="text-sm text-stone-500 space-y-1">
            <p className="font-medium text-stone-700">How to install (for Gmail / other pages):</p>
            <ol className="list-decimal list-inside space-y-1 text-stone-500">
              <li>Make sure your bookmarks bar is visible (Ctrl+Shift+B on Chrome)</li>
              <li>Drag the green button to your bookmarks bar</li>
              <li>When viewing a Gmail message, click the bookmark</li>
              <li>This tool opens in a new tab with the email text pre-filled</li>
            </ol>
          </div>
        </div>
        <div className="rounded-lg bg-stone-50 border border-stone-200 p-3 flex items-start gap-3">
          <p className="text-xs text-stone-500 flex-1">
            <span className="font-semibold text-stone-600">Can't drag?</span> Copy the bookmarklet code, then in Chrome go to Bookmarks → Add new bookmark → paste the code as the URL and name it "📧 Grab for Rewriter".
          </p>
          <button
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy code"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Mode = "rewrite" | "build";

export default function PlainTextEmailGenerator() {
  const [mode, setMode] = useState<Mode>("rewrite");
  const [result, setResult] = useState<GeneratedEmail | null>(null);

  // Rewrite mode state
  const [rawCopy, setRawCopy] = useState("");
  const [subjectHint, setSubjectHint] = useState("");

  // Auto-populate from bookmarklet URL params (?grab=1&text=...&subject=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("grab") === "1") {
      const text = params.get("text");
      const subject = params.get("subject");
      if (text) {
        setRawCopy(decodeURIComponent(text));
        setMode("rewrite");
        toast.success("Email text grabbed! Click \"Rewrite for Primary Inbox\" to continue.");
      }
      if (subject) setSubjectHint(decodeURIComponent(subject));
      // Clean the URL so it doesn't re-trigger on refresh
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Build mode state
  const [buildForm, setBuildForm] = useState({
    episodeTitle: "",
    episodeNumber: "",
    seriesName: "",
    episodeUrl: "",
    keyPoints: "",
    callToAction: "",
    tone: "personal" as "personal" | "educational" | "urgent",
  });

  const rewriteMutation = trpc.plainTextEmail.rewrite.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Done! Pick a subject line and copy the body.");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const generateMutation = trpc.plainTextEmail.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success("Done! Pick a subject line and copy the body.");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const { data: history, refetch: refetchHistory } = trpc.plainTextEmail.list.useQuery();
  const deleteMutation = trpc.plainTextEmail.delete.useMutation({
    onSuccess: () => { refetchHistory(); toast.success("Deleted"); },
  });

  const isPending = rewriteMutation.isPending || generateMutation.isPending;

  const handleRewrite = () => {
    if (!rawCopy.trim()) { toast.error("Please paste your email copy first"); return; }
    rewriteMutation.mutate({ rawCopy, subjectHint: subjectHint || undefined });
  };

  const handleBuild = () => {
    if (!buildForm.episodeTitle.trim()) { toast.error("Please enter the episode title"); return; }
    if (!buildForm.keyPoints.trim()) { toast.error("Please enter at least one key point"); return; }
    generateMutation.mutate({
      episodeTitle: buildForm.episodeTitle,
      episodeNumber: buildForm.episodeNumber ? parseInt(buildForm.episodeNumber) : undefined,
      seriesName: buildForm.seriesName || undefined,
      episodeUrl: buildForm.episodeUrl || undefined,
      keyPoints: buildForm.keyPoints,
      callToAction: buildForm.callToAction || undefined,
      tone: buildForm.tone,
    });
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <MailCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Plain Text Email</h1>
            <p className="text-stone-500 text-sm mt-0.5">
              Rewrite existing emails into inbox-friendly plain text — or build from scratch
            </p>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1">
          <button
            onClick={() => { setMode("rewrite"); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "rewrite"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Paste &amp; Rewrite
          </button>
          <button
            onClick={() => { setMode("build"); setResult(null); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === "build"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            <PenLine className="w-4 h-4" />
            Build from Scratch
          </button>
        </div>

        {/* Result panel — shown above the input when available, input stays visible */}
        {result && mode === "rewrite" && (
          <ResultPanel result={result} onReset={() => setResult(null)} />
        )}

        {/* Build mode result panel */}
        {result && mode === "build" && (
          <ResultPanel result={result} onReset={() => setResult(null)} />
        )}

        {mode === "rewrite" ? (
          /* ── REWRITE MODE ── */
          <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-5">
            {!result && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 flex gap-3">
                <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-800">
                  Paste any existing email — Kajabi HTML source, plain text, or a draft — and the AI rewrites it as a short, personal email that lands in Primary.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="subjectHint">
                Existing subject line{" "}
                <span className="text-stone-400 font-normal">(optional — helps preserve intent)</span>
              </Label>
              <Input
                id="subjectHint"
                placeholder="e.g. The Trouble with Toxins [Interconnected Episode 4]"
                value={subjectHint}
                onChange={(e) => setSubjectHint(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rawCopy">
                Paste your email copy here{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="rawCopy"
                rows={12}
                placeholder={`Paste anything here:\n• The full email body text from Kajabi\n• HTML source (View Source from Gmail → Show Original)\n• A draft you wrote in Google Docs\n• Even a rough outline\n\nThe AI will strip all the template junk and rewrite it as a clean, personal email.`}
                value={rawCopy}
                onChange={(e) => setRawCopy(e.target.value)}
                className="font-mono text-xs resize-y"
              />
              {rawCopy.length > 0 && (
                <p className="text-xs text-stone-400 text-right">
                  {rawCopy.length.toLocaleString()} characters pasted
                </p>
              )}
            </div>

            <Button
              onClick={handleRewrite}
              disabled={isPending || !rawCopy.trim()}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {isPending ? (
                <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Rewriting...</>
              ) : result ? (
                <><Sparkles className="w-4 h-4 mr-2" /> Rewrite Again</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Rewrite for Primary Inbox</>
              )}
            </Button>
          </div>
        ) : (
          /* ── BUILD MODE ── */
          <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-5">
            <p className="text-sm text-stone-500">
              Don't have existing copy? Describe the episode and the AI writes the email from scratch.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="episodeTitle">Episode Title <span className="text-red-500">*</span></Label>
                <Input
                  id="episodeTitle"
                  placeholder="e.g. The Trouble with Toxins"
                  value={buildForm.episodeTitle}
                  onChange={(e) => setBuildForm({ ...buildForm, episodeTitle: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="episodeNumber">Episode Number</Label>
                <Input
                  id="episodeNumber"
                  type="number"
                  placeholder="e.g. 4"
                  value={buildForm.episodeNumber}
                  onChange={(e) => setBuildForm({ ...buildForm, episodeNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="seriesName">Series Name</Label>
                <Input
                  id="seriesName"
                  placeholder="e.g. Interconnected"
                  value={buildForm.seriesName}
                  onChange={(e) => setBuildForm({ ...buildForm, seriesName: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="episodeUrl">Episode URL</Label>
                <Input
                  id="episodeUrl"
                  type="url"
                  placeholder="https://theacademy.theurbanmonk.com/..."
                  value={buildForm.episodeUrl}
                  onChange={(e) => setBuildForm({ ...buildForm, episodeUrl: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="keyPoints">
                  Key Points Covered <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="keyPoints"
                  rows={4}
                  placeholder={`What will the viewer learn? One point per line:\n- The microbiome's role in detoxification\n- Hidden toxins in the home\n- How to rebuild gut health in 2 weeks`}
                  value={buildForm.keyPoints}
                  onChange={(e) => setBuildForm({ ...buildForm, keyPoints: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Tone</Label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: "personal", label: "Personal", desc: "Like a letter from a trusted friend" },
                    { value: "educational", label: "Educational", desc: "Informative, teacher-to-student" },
                    { value: "urgent", label: "Timely", desc: "Something they need to know now" },
                  ] as const).map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setBuildForm({ ...buildForm, tone: t.value })}
                      className={`flex-1 min-w-[130px] rounded-lg border px-3 py-2 text-left transition-colors ${
                        buildForm.tone === t.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                          : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs opacity-70 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={handleBuild}
              disabled={isPending}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              {isPending ? (
                <><Sparkles className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" /> Generate Plain-Text Email</>
              )}
            </Button>
          </div>
        )}

        {/* Bookmarklet section */}
        {!result && (
          <BookmarkletSection />
        )}

        {/* History */}
        {history && history.length > 0 && !result && (
          <div className="space-y-3">
            <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">
              Recent Emails ({history.length})
            </h2>
            <div className="space-y-2">
              {history.map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  onDelete={(id) => deleteMutation.mutate({ id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
