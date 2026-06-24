import { useState } from "react";
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
  AlertCircle,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type GeneratedEmail = {
  subjectA: string;
  subjectB: string;
  subjectC: string;
  body: string;
};

function DeliverabilityTips() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
          <Info className="w-4 h-4" />
          Why plain text beats Kajabi templates for inbox delivery
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-amber-600" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-600" />
        )}
      </button>
      {open && (
        <div className="mt-3 text-sm text-amber-900 space-y-2">
          <p>
            Your Kajabi "Encore" template sends <strong>80 images</strong> (74
            invisible spacers), <strong>177 CSS classes</strong>, and a{" "}
            <strong>76 KB file</strong> — Gmail's machine learning recognizes
            this pattern instantly as a marketing newsletter and routes it to
            Promotions.
          </p>
          <p>
            A plain-text email with one link, under 250 words, and no images
            looks exactly like a personal email from a friend. Gmail routes
            those to Primary.
          </p>
          <p className="font-medium">
            How to send this in Kajabi: Create a new email → choose "Plain
            Text" template → paste the body → paste your chosen subject line →
            send.
          </p>
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(label ? `${label} copied!` : "Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-medium transition-colors"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function SubjectLineCard({
  label,
  subject,
  note,
}: {
  label: string;
  subject: string;
  note: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-white p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
            {label}
          </span>
          <span className="text-xs text-stone-400 italic">{note}</span>
        </div>
        <p className="text-sm font-medium text-stone-800 break-words">
          {subject}
        </p>
      </div>
      <CopyButton text={subject} label={label} />
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
    pte_createdAt: Date;
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
            {new Date(item.pte_createdAt).toLocaleDateString("en-US", {
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
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
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
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                Subject Lines
              </p>
              {[item.subjectLineA, item.subjectLineB, item.subjectLineC]
                .filter(Boolean)
                .map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm text-stone-700"
                  >
                    <span className="flex-1">{s}</span>
                    <CopyButton text={s!} />
                  </div>
                ))}
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
                Email Body
              </p>
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

export default function PlainTextEmailGenerator() {
  const [form, setForm] = useState({
    episodeTitle: "",
    episodeNumber: "",
    seriesName: "",
    episodeUrl: "",
    keyPoints: "",
    callToAction: "",
    tone: "personal" as "personal" | "educational" | "urgent",
  });
  const [result, setResult] = useState<GeneratedEmail | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const generateMutation = trpc.plainTextEmail.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSelectedSubject(data.subjectA);
      toast.success("Email generated! Choose a subject line and copy the body.");
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err.message}`);
    },
  });

  const { data: history, refetch: refetchHistory } =
    trpc.plainTextEmail.list.useQuery();

  const deleteMutation = trpc.plainTextEmail.delete.useMutation({
    onSuccess: () => {
      refetchHistory();
      toast.success("Deleted");
    },
  });

  const handleGenerate = () => {
    if (!form.episodeTitle.trim()) {
      toast.error("Please enter the episode title");
      return;
    }
    if (!form.keyPoints.trim()) {
      toast.error("Please enter at least one key point from the episode");
      return;
    }
    generateMutation.mutate({
      episodeTitle: form.episodeTitle,
      episodeNumber: form.episodeNumber
        ? parseInt(form.episodeNumber)
        : undefined,
      seriesName: form.seriesName || undefined,
      episodeUrl: form.episodeUrl || undefined,
      keyPoints: form.keyPoints,
      callToAction: form.callToAction || undefined,
      tone: form.tone,
    });
  };

  const [bodyCopied, setBodyCopied] = useState(false);
  const handleCopyBody = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.body);
    setBodyCopied(true);
    toast.success("Email body copied — paste into Kajabi's plain-text editor");
    setTimeout(() => setBodyCopied(false), 3000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-emerald-700" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">
              Plain Text Email Generator
            </h1>
          </div>
          <p className="text-stone-500 text-sm ml-12">
            Generate inbox-friendly emails that land in Primary, not Promotions
          </p>
        </div>

        <DeliverabilityTips />

        {/* Form */}
        <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-5">
          <h2 className="font-semibold text-stone-800">Episode Details</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="episodeTitle">
                Episode Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="episodeTitle"
                placeholder="e.g. The Trouble with Toxins"
                value={form.episodeTitle}
                onChange={(e) =>
                  setForm({ ...form, episodeTitle: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="episodeNumber">Episode Number</Label>
              <Input
                id="episodeNumber"
                type="number"
                placeholder="e.g. 4"
                value={form.episodeNumber}
                onChange={(e) =>
                  setForm({ ...form, episodeNumber: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seriesName">Series Name</Label>
              <Input
                id="seriesName"
                placeholder="e.g. Interconnected"
                value={form.seriesName}
                onChange={(e) =>
                  setForm({ ...form, seriesName: e.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="episodeUrl">Episode URL</Label>
              <Input
                id="episodeUrl"
                type="url"
                placeholder="https://theacademy.theurbanmonk.com/..."
                value={form.episodeUrl}
                onChange={(e) =>
                  setForm({ ...form, episodeUrl: e.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="keyPoints">
                Key Points Covered <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="keyPoints"
                rows={4}
                placeholder={`What will the viewer learn? Enter each point on a new line:\n- The microbiome's role in detoxification\n- Hidden toxins in the home\n- How to rebuild gut health in 2 weeks`}
                value={form.keyPoints}
                onChange={(e) =>
                  setForm({ ...form, keyPoints: e.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="callToAction">Call to Action</Label>
              <Input
                id="callToAction"
                placeholder="e.g. Watch Episode 4 (leave blank for default)"
                value={form.callToAction}
                onChange={(e) =>
                  setForm({ ...form, callToAction: e.target.value })
                }
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <Label>Tone</Label>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    {
                      value: "personal",
                      label: "Personal",
                      desc: "Like a letter from a trusted friend",
                    },
                    {
                      value: "educational",
                      label: "Educational",
                      desc: "Informative, teacher-to-student",
                    },
                    {
                      value: "urgent",
                      label: "Timely",
                      desc: "Something they need to know now",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm({ ...form, tone: t.value })}
                    className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 text-left transition-colors ${
                      form.tone === t.value
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
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {generateMutation.isPending ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Plain-Text Email
              </>
            )}
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-emerald-600" />
              <h2 className="font-semibold text-emerald-900">
                Email Generated
              </h2>
            </div>

            {/* Subject line picker */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">
                Step 1 — Choose a subject line (click to select, then copy):
              </p>
              <div className="space-y-2">
                <SubjectLineCard
                  label="Option A"
                  subject={result.subjectA}
                  note="Curious / question-based"
                />
                <SubjectLineCard
                  label="Option B"
                  subject={result.subjectB}
                  note="Benefit-led"
                />
                <SubjectLineCard
                  label="Option C"
                  subject={result.subjectC}
                  note="Personal / story-based"
                />
              </div>
            </div>

            {/* Body */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-stone-700">
                Step 2 — Copy the email body:
              </p>
              <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100 bg-stone-50">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {result.body.split(/\s+/).length} words ·{" "}
                    {Math.ceil(result.body.split(/\s+/).length / 200)} min read
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCopyBody}
                    className={`text-xs h-7 px-3 ${
                      bodyCopied
                        ? "bg-emerald-600 text-white"
                        : "bg-stone-800 text-white hover:bg-stone-900"
                    }`}
                  >
                    {bodyCopied ? (
                      <>
                        <Check className="w-3 h-3 mr-1" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" /> Copy Body
                      </>
                    )}
                  </Button>
                </div>
                <pre className="text-sm text-stone-800 whitespace-pre-wrap font-sans leading-relaxed p-4 max-h-96 overflow-y-auto">
                  {result.body}
                </pre>
              </div>
            </div>

            {/* Kajabi instructions */}
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600 space-y-1">
              <p className="font-medium text-stone-800">
                Step 3 — Send in Kajabi:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-stone-600">
                <li>
                  In Kajabi → Email → New Broadcast → choose{" "}
                  <strong>"Plain Text"</strong> template
                </li>
                <li>Paste your chosen subject line into the Subject field</li>
                <li>Paste the email body into the body field</li>
                <li>
                  Send a test to yourself first — it should land in Primary
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* History */}
        {history && history.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-stone-800">
              Previously Generated ({history.length})
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
