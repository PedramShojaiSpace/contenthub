/**
 * Script Factory — Phase E
 *
 * Corpus-grounded script generation with [VERIFIED] tags.
 * Tabs: Generate, Library, Stats
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "../components/DashboardLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMATS = [
  { value: "youtube_script", label: "YouTube Script" },
  { value: "short_form", label: "Short-Form (60–90s)" },
  { value: "email", label: "Email" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "sales_page_section", label: "Sales Page Section" },
  { value: "podcast_outline", label: "Podcast Outline" },
] as const;

const PATTERN_TYPES = [
  "hook", "pain_point", "proof_element", "objection_handler", "cta",
  "story_structure", "key_phrase", "transformation_arc", "authority_signal",
  "social_proof", "open_loop",
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  archived: "bg-gray-100 text-gray-600",
};

const FORMAT_LABELS: Record<string, string> = {
  youtube_script: "YouTube Script",
  short_form: "Short-Form",
  email: "Email",
  ad_copy: "Ad Copy",
  sales_page_section: "Sales Page",
  podcast_outline: "Podcast Outline",
};

// ─── Verified tag renderer ────────────────────────────────────────────────────

function renderScriptWithTags(scriptBody: string): React.ReactNode {
  // Split on [VERIFIED] and [HOOK], [PAIN], etc. structure tags
  const parts = scriptBody.split(/(\[VERIFIED\]|\[[A-Z_]+\])/g);
  return parts.map((part, i) => {
    if (part === "[VERIFIED]") {
      return (
        <span key={i} className="inline-flex items-center gap-0.5 text-green-700 font-semibold text-xs bg-green-50 border border-green-200 rounded px-1 py-0.5 mx-0.5">
          <ShieldCheck className="w-3 h-3" /> VERIFIED
        </span>
      );
    }
    if (/^\[[A-Z_]+\]$/.test(part)) {
      return (
        <span key={i} className="inline-block text-primary font-bold text-xs bg-primary/10 rounded px-1.5 py-0.5 mx-0.5 my-1">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Generate Tab ─────────────────────────────────────────────────────────────

function GenerateTab() {
  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState<string>("youtube_script");
  const [minEff, setMinEff] = useState(0.5);
  const [topPerType, setTopPerType] = useState(3);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "hook", "pain_point", "proof_element", "cta", "transformation_arc",
  ]);
  const [result, setResult] = useState<{
    id: number; title: string; scriptBody: string;
    verifiedCount: number; totalElements: number; verificationPct: number;
    patternsUsed: number; corpusEntriesUsed: number;
  } | null>(null);

  const generate = trpc.scriptFactory.generate.useMutation({
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Script generated! ${data.verificationPct}% verified.`);
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.scriptBody);
    toast.success("Script copied to clipboard.");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Config */}
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> Script Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Topic / Brief</label>
              <Textarea
                placeholder="e.g. 'Why most people can't sleep despite being exhausted — and the ancient practice that fixes it in 7 days'"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Be specific. The more context, the better the corpus match.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Format</label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Pattern Types to Include
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PATTERN_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      selectedTypes.includes(type)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {type.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Min Pattern Effectiveness: <span className="text-primary font-bold">{(minEff * 100).toFixed(0)}%</span>
              </label>
              <Slider min={0} max={1} step={0.05} value={[minEff]} onValueChange={([v]) => setMinEff(v)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Top Patterns Per Type: <span className="text-primary font-bold">{topPerType}</span>
              </label>
              <Slider min={1} max={5} step={1} value={[topPerType]} onValueChange={([v]) => setTopPerType(v)} />
            </div>

            <Button
              className="w-full"
              disabled={generate.isPending || topic.trim().length < 10 || selectedTypes.length === 0}
              onClick={() => generate.mutate({
                topic,
                format: format as any,
                patternTypes: selectedTypes,
                minPatternEffectiveness: minEff,
                topPatternsPerType: topPerType,
                useCorpusSearch: true,
              })}
            >
              {generate.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Script</>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>How [VERIFIED] works:</strong> The LLM draws from your proven patterns and corpus excerpts.
          Every element it borrows is tagged <code className="bg-amber-100 px-1 rounded">[VERIFIED]</code>.
          Aim for &gt;40% verification coverage on key structural elements.
        </div>
      </div>

      {/* Right: Result */}
      <div className="space-y-4">
        {generate.isPending && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Pulling patterns from corpus and generating script…</p>
          </div>
        )}

        {result && !generate.isPending && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{result.title}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      {result.verificationPct}% verified
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {result.verifiedCount} verified / {result.totalElements} elements
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {result.patternsUsed} patterns · {result.corpusEntriesUsed} corpus entries
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <ClipboardCopy className="w-3.5 h-3.5 mr-1" /> Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono max-h-[500px] overflow-y-auto">
                {renderScriptWithTags(result.scriptBody)}
              </div>
            </CardContent>
          </Card>
        )}

        {!result && !generate.isPending && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3 border-2 border-dashed rounded-lg">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="text-sm">Fill in the brief and click Generate Script.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const [filterFormat, setFilterFormat] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [viewScript, setViewScript] = useState<{
    id: number; title: string; topic: string; format: string;
    scriptBody: string; verifiedCount: number; totalElements: number;
    verificationPct: number | null; status: string; notes: string | null;
  } | null>(null);

  const { data: scripts = [], isLoading, refetch } = trpc.scriptFactory.list.useQuery({
    format: filterFormat,
    status: filterStatus,
    limit: 50,
    offset: 0,
  });

  const updateScript = trpc.scriptFactory.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Script updated."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteScript = trpc.scriptFactory.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("Script deleted."); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={filterFormat} onValueChange={setFilterFormat}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All formats" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
        </Button>

        <span className="text-sm text-muted-foreground ml-auto">{scripts.length} scripts</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No scripts yet. Use the Generate tab to create your first script.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) => (
            <div key={s.id} className="border rounded-lg p-4 bg-card flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{s.title}</span>
                  <Badge className={`text-xs ${STATUS_COLORS[s.status]}`}>{s.status}</Badge>
                  <Badge variant="outline" className="text-xs">{FORMAT_LABELS[s.format] ?? s.format}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{s.topic}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-green-700 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {s.verificationPct != null ? `${s.verificationPct.toFixed(0)}%` : "—"} verified
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setViewScript(s as any)}>
                  View
                </Button>
                {s.status === "draft" && (
                  <Button variant="ghost" size="sm" className="text-green-700"
                    onClick={() => updateScript.mutate({ id: s.id, status: "approved" })}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteScript.mutate({ id: s.id })}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewScript} onOpenChange={(open) => !open && setViewScript(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="pr-8">{viewScript?.title}</DialogTitle>
          </DialogHeader>
          {viewScript && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-xs ${STATUS_COLORS[viewScript.status]}`}>{viewScript.status}</Badge>
                <Badge variant="outline" className="text-xs">{FORMAT_LABELS[viewScript.format] ?? viewScript.format}</Badge>
                <Badge className="text-xs bg-green-100 text-green-800">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {viewScript.verificationPct != null ? `${viewScript.verificationPct.toFixed(0)}%` : "—"} verified
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{viewScript.topic}</p>
              <div className="bg-muted/30 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {renderScriptWithTags(viewScript.scriptBody)}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(viewScript.scriptBody);
                  toast.success("Copied to clipboard.");
                }}>
                  <ClipboardCopy className="w-3.5 h-3.5 mr-1" /> Copy Script
                </Button>
                {viewScript.status === "draft" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      updateScript.mutate({ id: viewScript.id, status: "approved" });
                      setViewScript({ ...viewScript, status: "approved" });
                    }}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: stats, isLoading } = trpc.scriptFactory.getStats.useQuery();

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-primary">{stats?.total ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Total Scripts</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-green-600">{stats?.approved ?? 0}</div>
          <div className="text-sm text-muted-foreground mt-1">Approved Scripts</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-3xl font-bold text-primary">
            {stats?.avgVerificationPct != null ? `${stats.avgVerificationPct.toFixed(0)}%` : "—"}
          </div>
          <div className="text-sm text-muted-foreground mt-1">Avg Verification %</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScriptFactory() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Script Factory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generate corpus-grounded scripts. Every element drawn from proven content is tagged{" "}
            <span className="inline-flex items-center gap-0.5 text-green-700 font-semibold text-xs bg-green-50 border border-green-200 rounded px-1 py-0.5">
              <ShieldCheck className="w-3 h-3" /> VERIFIED
            </span>.
          </p>
        </div>

        <Tabs defaultValue="generate">
          <TabsList>
            <TabsTrigger value="generate">
              <Wand2 className="w-4 h-4 mr-1.5" /> Generate
            </TabsTrigger>
            <TabsTrigger value="library">
              <FileText className="w-4 h-4 mr-1.5" /> Library
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-1.5" /> Stats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-4">
            <GenerateTab />
          </TabsContent>
          <TabsContent value="library" className="mt-4">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="stats" className="mt-4">
            <StatsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
