/**
 * Analyze — Analog Data Library
 *
 * Keith's "Analyze" section — corpus seed for the Transcript Intelligence Engine.
 * Two tabs:
 *   1. Library — filterable table of all analog data entries
 *   2. Add Entry — form to paste and classify converting content
 *
 * QUALITY GATE: Only CONVERTING content goes in here.
 * Winning ads, converting sales pages, real customer interview transcripts, survey data.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  ChevronRight,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_TYPES = [
  { value: "sales_page", label: "Sales Page", icon: FileText, color: "bg-blue-100 text-blue-800" },
  { value: "facebook_ad", label: "Profitable Ad Copy", icon: Sparkles, color: "bg-purple-100 text-purple-800" },
  { value: "customer_interview", label: "Customer Interview", icon: MessageSquare, color: "bg-green-100 text-green-800" },
  { value: "text_survey", label: "Text Survey", icon: BookOpen, color: "bg-yellow-100 text-yellow-800" },
  { value: "vsl_script", label: "VSL Script", icon: Brain, color: "bg-red-100 text-red-800" },
  { value: "email_sequence", label: "Email Sequence", icon: FileText, color: "bg-indigo-100 text-indigo-800" },
  { value: "other", label: "Other", icon: Database, color: "bg-gray-100 text-gray-700" },
] as const;

type DataTypeValue = typeof DATA_TYPES[number]["value"];

function getTypeMeta(type: string) {
  return DATA_TYPES.find((t) => t.value === type) ?? DATA_TYPES[DATA_TYPES.length - 1];
}

// ─── Library Tab ──────────────────────────────────────────────────────────────

function LibraryTab() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<DataTypeValue | "all">("all");
  const [filterTag, setFilterTag] = useState("");
  const [viewEntry, setViewEntry] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: entries = [], isLoading } = trpc.analogData.listEntries.useQuery({
    type: filterType === "all" ? undefined : filterType,
    tag: filterTag || undefined,
    search: search || undefined,
    limit: 100,
    offset: 0,
  });

  const { data: stats } = trpc.analogData.getStats.useQuery();

  const { data: entryDetail } = trpc.analogData.getEntry.useQuery(
    { id: viewEntry! },
    { enabled: viewEntry !== null }
  );

  const deleteEntry = trpc.analogData.deleteEntry.useMutation({
    onSuccess: () => {
      toast.success("Entry deleted");
      utils.analogData.listEntries.invalidate();
      utils.analogData.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEntry = trpc.analogData.updateEntry.useMutation({
    onSuccess: () => {
      toast.success("Updated");
      utils.analogData.listEntries.invalidate();
      utils.analogData.getStats.invalidate();
      // Invalidate corpus queries so CorpusBuilder reflects the new membership immediately
      utils.corpus.listEntries.invalidate();
      utils.corpus.getStats.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="flex gap-4 flex-wrap">
          <div className="bg-white border rounded-lg px-4 py-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{stats.total} entries</span>
          </div>
          <div className="bg-white border rounded-lg px-4 py-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium">{stats.inCorpus} in corpus</span>
          </div>
          {stats.byType.map((bt) => {
            const meta = getTypeMeta(bt.type);
            return (
              <div key={bt.type} className="bg-white border rounded-lg px-4 py-3 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-sm font-medium">{bt.count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search entries..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as DataTypeValue | "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Filter by tag..."
            className="pl-9 w-[160px]"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No entries yet</p>
          <p className="text-sm mt-1">Add your first converting asset using the "Add Entry" tab</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[140px]">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[180px]">Tags</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[90px]">Corpus</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-[100px]">Added</th>
                <th className="px-4 py-3 w-[80px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entries.map((entry) => {
                const meta = getTypeMeta(entry.type);
                return (
                  <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        className="text-left font-medium hover:text-primary transition-colors flex items-center gap-1 group"
                        onClick={() => setViewEntry(entry.id)}
                      >
                        {entry.title ?? <span className="text-muted-foreground italic">Untitled</span>}
                        <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                      {entry.contentPreview && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {entry.contentPreview}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(entry.tags as string[]).slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs py-0">
                            {tag}
                          </Badge>
                        ))}
                        {(entry.tags as string[]).length > 3 && (
                          <Badge variant="outline" className="text-xs py-0">
                            +{(entry.tags as string[]).length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          updateEntry.mutate({ id: entry.id, inCorpus: !entry.inCorpus })
                        }
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          entry.inCorpus
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {entry.inCorpus ? "✓ Yes" : "No"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm("Delete this entry?")) {
                            deleteEntry.mutate({ id: entry.id });
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Entry Detail Dialog */}
      <Dialog open={viewEntry !== null} onOpenChange={(o) => !o && setViewEntry(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {entryDetail?.title ?? "Entry Detail"}
              {entryDetail && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getTypeMeta(entryDetail.type).color}`}>
                  {getTypeMeta(entryDetail.type).label}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {entryDetail && (
            <div className="space-y-4">
              {/* Tags */}
              {(entryDetail.tags as string[]).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(entryDetail.tags as string[]).map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Extracted Insights */}
              {entryDetail.extractedInsights && (
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium text-sm flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    AI-Extracted Insights
                  </h4>
                  {Object.entries(entryDetail.extractedInsights as Record<string, string[]>).map(
                    ([key, values]) =>
                      values.length > 0 && (
                        <div key={key}>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                            {key.replace(/([A-Z])/g, " $1").trim()}
                          </p>
                          <ul className="space-y-0.5">
                            {values.map((v, i) => (
                              <li key={i} className="text-sm flex items-start gap-1.5">
                                <span className="text-primary mt-0.5">•</span>
                                {v}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                  )}
                </div>
              )}

              {/* Full Content */}
              <div>
                <h4 className="font-medium text-sm mb-2">Full Content</h4>
                <div className="bg-muted/20 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-[300px] overflow-y-auto font-mono text-xs">
                  {entryDetail.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add Entry Tab ────────────────────────────────────────────────────────────

function AddEntryTab() {
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [autoTitle, setAutoTitle] = useState(true);
  const [type, setType] = useState<DataTypeValue>("other");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [personaId, setPersonaId] = useState<number | null>(null);

  const { data: personas = [] } = trpc.personas.list.useQuery();

  const addEntry = trpc.analogData.addEntry.useMutation({
    onSuccess: (data) => {
      toast.success(`Entry saved: "${data.title}"`);
      // Reset form
      setTitle("");
      setAutoTitle(true);
      setType("other");
      setTags([]);
      setTagsInput("");
      setContent("");
      setPersonaId(null);
      utils.analogData.listEntries.invalidate();
      utils.analogData.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagsInput.trim().replace(/,$/, "");
      if (val && !tags.includes(val)) {
        setTags([...tags, val]);
      }
      setTagsInput("");
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSubmit() {
    if (!content.trim() || content.trim().length < 50) {
      toast.error("Content must be at least 50 characters");
      return;
    }
    addEntry.mutate({
      title: autoTitle ? undefined : title || undefined,
      autoGenerateTitle: autoTitle || !title.trim(),
      type,
      tags,
      personaId: personaId ?? undefined,
      content: content.trim(),
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Quality Gate Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 text-sm">Quality Gate — Converting Content Only</p>
          <p className="text-amber-700 text-sm mt-1">
            Only add <strong>proven, converting content</strong>: winning ads, converting sales pages,
            real customer interview transcripts, and survey data. Do not add aspirational or untested content.
            This library seeds the Script Factory — garbage in, garbage out.
          </p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="entry-title">Title</Label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoTitle}
              onChange={(e) => setAutoTitle(e.target.checked)}
              className="rounded"
            />
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            AI auto-generate title
          </label>
        </div>
        <Input
          id="entry-title"
          placeholder={autoTitle ? "Title will be auto-generated from content..." : "Enter a descriptive title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={autoTitle}
          className={autoTitle ? "opacity-50" : ""}
        />
      </div>

      {/* Type */}
      <div className="space-y-2">
        <Label>Content Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as DataTypeValue)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATA_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                <span className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${t.color}`}>
                    {t.label}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="border rounded-md p-2 min-h-[42px] flex flex-wrap gap-1.5 focus-within:ring-1 focus-within:ring-ring">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <input
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
            placeholder={tags.length === 0 ? "Type a tag and press Enter (e.g. gut_health, Q1_2026, cold_traffic)" : "Add another tag..."}
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onKeyDown={handleAddTag}
          />
        </div>
        <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
      </div>

      {/* Persona */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          Assign to Persona (optional)
        </Label>
        <Select
          value={personaId?.toString() ?? "none"}
          onValueChange={(v) => setPersonaId(v === "none" ? null : Number(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="No persona assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No persona assigned</SelectItem>
            {personas.map((p) => (
              <SelectItem key={p.id} value={p.id.toString()}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label htmlFor="entry-content">
          Content <span className="text-muted-foreground font-normal">(paste the full text)</span>
        </Label>
        <Textarea
          id="entry-content"
          placeholder="Paste the full content here — sales page copy, ad copy, interview transcript, survey responses, VSL script, email sequence, etc."
          className="min-h-[280px] font-mono text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {content.length.toLocaleString()} characters
          {content.length > 0 && content.length < 50 && (
            <span className="text-destructive ml-2">Minimum 50 characters required</span>
          )}
        </p>
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={addEntry.isPending || content.trim().length < 50}
        className="w-full"
        size="lg"
      >
        {addEntry.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving & extracting insights...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4 mr-2" />
            Save to Library
          </>
        )}
      </Button>
      {addEntry.isPending && (
        <p className="text-xs text-muted-foreground text-center">
          AI is extracting hooks, pain points, proof elements, and conversion patterns from your content...
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyzeData() {
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Analog Data Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Corpus seed for the Transcript Intelligence Engine. Store proven, converting content
            to ground AI-generated scripts in real market data.
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="library">
          <TabsList>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Entry
            </TabsTrigger>
          </TabsList>
          <TabsContent value="library" className="mt-4">
            <LibraryTab />
          </TabsContent>
          <TabsContent value="add" className="mt-4">
            <AddEntryTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
