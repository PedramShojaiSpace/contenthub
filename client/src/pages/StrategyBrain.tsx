import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Facebook, Linkedin, Loader2, Megaphone, Plus, Save, Trash2, Twitter, Youtube } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type Platform = "meta" | "linkedin" | "x" | "youtube";

const PLATFORMS: { key: Platform; label: string; icon: React.ReactNode; color: string }[] = [
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin className="h-4 w-4" />, color: "text-sky-400" },
  { key: "meta", label: "Meta", icon: <Facebook className="h-4 w-4" />, color: "text-blue-400" },
  { key: "x", label: "X (Twitter)", icon: <Twitter className="h-4 w-4" />, color: "text-slate-300" },
  { key: "youtube", label: "YouTube", icon: <Youtube className="h-4 w-4" />, color: "text-red-400" },
];

const DEFAULT_VOICE_GUIDELINES: Record<Platform, string> = {
  linkedin: `AUDIENCE: Corporate executives, entrepreneurs, high-achieving professionals aged 35-55.

TONE: Professional, authoritative, data-informed. Challenges hustle culture. Bridges ancient wisdom with modern science. Direct, confident, slightly provocative. No fluff.

MESSAGING PILLARS:
- Performance optimization through biological hardware
- The gut-brain connection and its impact on executive function
- Upstream medicine (fix the root cause, not the symptom)
- The cost of ignoring your health on your career and legacy
- Ancient wisdom applied to modern high-performance life

AVOID: Corporate buzzwords, empty motivational language, anything that sounds like generic "wellness" content.`,

  meta: `AUDIENCE: Health-conscious professionals, wellness seekers, spiritual explorers aged 28-50.

TONE: Warm, relatable, inspiring, educational but accessible. Bridges science and spirituality. Personal stories welcome. Empathetic but direct.

MESSAGING PILLARS:
- Daily practices and rituals for energy and clarity
- Mindfulness and meditation in a busy world
- Gut health, sleep, and stress management
- The Urban Monk Academy as a transformation vehicle
- Personal stories of breakthrough and healing

AVOID: Preachy tone, overly clinical language, anything that alienates spiritual seekers.`,

  x: `AUDIENCE: Intellectually curious professionals, wellness enthusiasts, biohackers aged 25-45.

TONE: Sharp, punchy, thought-provoking. Challenges conventional wisdom. Mix of bold statements and nuanced insights. Conversational.

MESSAGING PILLARS:
- Contrarian health insights backed by science
- Quick actionable protocols
- The cost of ignoring your biology
- Ancient wisdom meets modern performance
- Gut-brain axis, sleep, detox

AVOID: Long explanations, corporate language, anything that can't be absorbed in 10 seconds.`,

  youtube: `AUDIENCE: Health-seekers, spiritual explorers, high-performers aged 30-55.

TONE: Educational, authoritative, warm. Pedram as the trusted guide. Mix of science and ancient wisdom. Storytelling-driven.

MESSAGING PILLARS:
- Deep dives into root-cause health
- Qi Gong, meditation, and ancient practices
- The Urban Monk Academy as the next step
- Documentary-style storytelling
- Expert interviews and case studies

AVOID: Clickbait titles, superficial content, anything that sacrifices depth for views.`,
};

function PlatformStrategyTab({ platform }: { platform: Platform }) {
  const utils = trpc.useUtils();
  const { data: strategy } = trpc.strategy.get.useQuery({ platform });
  const upsertMutation = trpc.strategy.upsert.useMutation({
    onSuccess: () => {
      utils.strategy.get.invalidate({ platform });
      toast.success("Strategy saved");
    },
    onError: () => toast.error("Failed to save strategy"),
  });

  const [voiceGuidelines, setVoiceGuidelines] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");

  useEffect(() => {
    if (strategy) {
      setVoiceGuidelines(strategy.voiceGuidelines ?? DEFAULT_VOICE_GUIDELINES[platform] ?? "");
      setPromptTemplate(strategy.promptTemplate ?? "");
    } else {
      setVoiceGuidelines(DEFAULT_VOICE_GUIDELINES[platform] ?? "");
      setPromptTemplate("");
    }
  }, [strategy, platform]);

  const handleSave = () => {
    upsertMutation.mutate({ platform, voiceGuidelines, promptTemplate });
  };

  return (
    <div className="space-y-6 pt-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Voice & Audience Guidelines</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            These guidelines are injected into every AI generation for this platform.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={voiceGuidelines}
            onChange={(e) => setVoiceGuidelines(e.target.value)}
            rows={14}
            className="bg-background border-border resize-none text-sm font-mono"
            placeholder="Define your voice, audience, tone, and messaging pillars..."
          />
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-foreground">Custom Prompt Template (optional)</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Override the default generation prompt for this platform. Use <code className="bg-muted px-1 rounded text-xs">{"{{topic}}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{{voice}}"}</code>, <code className="bg-muted px-1 rounded text-xs">{"{{cta}}"}</code> as placeholders.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            rows={6}
            className="bg-background border-border resize-none text-sm font-mono"
            placeholder="Leave blank to use the default prompt template..."
          />
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={upsertMutation.isPending}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
      >
        {upsertMutation.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save Strategy
      </Button>
    </div>
  );
}

interface CtaBlock {
  id: number;
  label: string;
  topic: string;
  keywords: string | null;
  ctaText: string;
  url: string | null;
  isDefault: boolean | null;
}

interface CtaLibraryTabProps {
  editing: Partial<CtaBlock> | null;
  setEditing: (val: Partial<CtaBlock> | null) => void;
}

function CtaLibraryTab({ editing, setEditing }: CtaLibraryTabProps) {
  const utils = trpc.useUtils();
  const { data: ctaBlocks, isLoading } = trpc.cta.list.useQuery();
  const upsertMutation = trpc.cta.upsert.useMutation({
    onSuccess: () => {
      utils.cta.list.invalidate();
      toast.success("CTA saved");
      setEditing(null);
    },
    onError: () => toast.error("Failed to save CTA"),
  });
  const deleteMutation = trpc.cta.delete.useMutation({
    onSuccess: () => {
      utils.cta.list.invalidate();
      toast.success("CTA deleted");
    },
    onError: () => toast.error("Failed to delete CTA"),
  });

  const handleEdit = (block: CtaBlock) => {
    // keywords is stored as JSON array string in DB — convert to comma-separated for the form
    let keywordsDisplay = block.keywords ?? "";
    try {
      const parsed = JSON.parse(keywordsDisplay);
      if (Array.isArray(parsed)) keywordsDisplay = parsed.join(", ");
    } catch {
      // already plain text, use as-is
    }
    setEditing({ ...block, keywords: keywordsDisplay });
  };

  const handleNew = () => {
    setEditing({ label: "", topic: "", keywords: "", ctaText: "", url: "", isDefault: false });
  };

  const handleSave = () => {
    if (!editing?.label || !editing?.ctaText) {
      toast.error("Label and CTA text are required");
      return;
    }
    upsertMutation.mutate({
      id: editing.id,
      label: editing.label,
      topic: editing.topic ?? "",
      keywords: (editing.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean),
      ctaText: editing.ctaText,
      url: editing.url ?? "",
      isDefault: editing.isDefault ?? false,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 flex flex-row items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-foreground">CTA Library</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each CTA block is auto-selected based on content topic. <strong>Lights On</strong> is the default for all content.
              Topic-specific CTAs override the default when keywords match.
            </p>
          </div>
          <Button size="sm" onClick={handleNew} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add CTA
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(ctaBlocks ?? []).map((block) => (
            <div
              key={block.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{block.label}</span>
                  {block.isDefault && (
                    <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-400 bg-amber-500/10">
                      Default
                    </Badge>
                  )}
                  {block.topic && (
                    <Badge variant="outline" className="text-xs border-teal-500/50 text-teal-400 bg-teal-500/10">
                      {block.topic}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{block.ctaText}</p>
                {block.keywords && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Keywords: {(() => {
                      try {
                        const parsed = JSON.parse(block.keywords);
                        return Array.isArray(parsed) ? parsed.join(", ") : block.keywords;
                      } catch { return block.keywords; }
                    })()}
                  </p>
                )}
                {block.url && (
                  <p className="text-xs text-primary/70 mt-0.5 truncate">{block.url}</p>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(block as CtaBlock); }}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </Button>
                {!block.isDefault && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteMutation.mutate({ id: block.id }); }}
                    disabled={deleteMutation.isPending}
                    className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {(ctaBlocks ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No CTA blocks yet. Click "Add CTA" to create your first one.
            </p>
          )}
        </CardContent>
      </Card>

      {editing && (
        <Card className="bg-card border-primary/30 border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">
              {editing.id ? "Edit CTA Block" : "New CTA Block"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label *</Label>
                <Input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. Lights On Course"
                  className="bg-background border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Topic Category</Label>
                <Input
                  value={editing.topic ?? ""}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                  placeholder="e.g. sleep, gut, detox"
                  className="bg-background border-border text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Keywords (comma-separated — triggers this CTA when content matches)
              </Label>
              <Input
                value={editing.keywords ?? ""}
                onChange={(e) => setEditing({ ...editing, keywords: e.target.value })}
                placeholder="e.g. sleep, insomnia, circadian, rest, melatonin"
                className="bg-background border-border text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CTA Text * (what gets injected into content)</Label>
              <Textarea
                value={editing.ctaText ?? ""}
                onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })}
                rows={4}
                placeholder="e.g. Ready to reclaim your energy? Join the Lights On course at lightson.theurbanmonk.com and get the exact protocols Dr. Pedram Shojai uses with his patients."
                className="bg-background border-border resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URL</Label>
              <Input
                value={editing.url ?? ""}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                placeholder="https://lightson.theurbanmonk.com"
                className="bg-background border-border text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={editing.isDefault ?? false}
                onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="isDefault" className="text-xs text-muted-foreground cursor-pointer">
                Set as default CTA (used when no topic keywords match)
              </Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={upsertMutation.isPending}
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                {upsertMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save CTA
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function StrategyBrain() {
  // Lift editing state to parent so it survives Radix TabsContent remounts
  const [ctaEditing, setCtaEditing] = useState<Partial<CtaBlock> | null>(null);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Strategy Brain</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define your voice, audience, and messaging pillars for each platform. These guidelines
            power every AI generation.
          </p>
        </div>

        <Tabs defaultValue="linkedin">
          <TabsList className="bg-muted/30 border border-border">
            {PLATFORMS.map((p) => (
              <TabsTrigger
                key={p.key}
                value={p.key}
                className="data-[state=active]:bg-card data-[state=active]:text-foreground"
              >
                <span className={`mr-1.5 ${p.color}`}>{p.icon}</span>
                {p.label}
              </TabsTrigger>
            ))}
            <TabsTrigger
              value="cta"
              className="data-[state=active]:bg-card data-[state=active]:text-foreground"
            >
              <Megaphone className="h-4 w-4 mr-1.5 text-amber-400" />
              CTA Library
            </TabsTrigger>
          </TabsList>

          {PLATFORMS.map((p) => (
            <TabsContent key={p.key} value={p.key}>
              <PlatformStrategyTab platform={p.key} />
            </TabsContent>
          ))}

          <TabsContent value="cta">
            <CtaLibraryTab editing={ctaEditing} setEditing={setCtaEditing} />
          </TabsContent>
        </Tabs>

        {/* Edit form rendered OUTSIDE tabs so it survives tab remounts */}
        {ctaEditing && (
          <CtaEditForm editing={ctaEditing} setEditing={setCtaEditing} />
        )}
      </div>
    </DashboardLayout>
  );
}

interface CtaEditFormProps {
  editing: Partial<CtaBlock>;
  setEditing: (val: Partial<CtaBlock> | null) => void;
}

function CtaEditForm({ editing, setEditing }: CtaEditFormProps) {
  const utils = trpc.useUtils();
  const upsertMutation = trpc.cta.upsert.useMutation({
    onSuccess: () => {
      utils.cta.list.invalidate();
      toast.success("CTA saved");
      setEditing(null);
    },
    onError: () => toast.error("Failed to save CTA"),
  });

  const handleSave = () => {
    if (!editing?.label || !editing?.ctaText) {
      toast.error("Label and CTA text are required");
      return;
    }
    upsertMutation.mutate({
      id: editing.id,
      label: editing.label,
      topic: editing.topic ?? "",
      keywords: (editing.keywords ?? "").split(",").map((k) => k.trim()).filter(Boolean),
      ctaText: editing.ctaText,
      url: editing.url ?? "",
      isDefault: editing.isDefault ?? false,
    });
  };

  return (
    <Card className="bg-card border-primary/30 border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">
          {editing.id ? `Edit CTA Block — ${editing.label}` : "New CTA Block"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label *</Label>
            <Input
              value={editing.label ?? ""}
              onChange={(e) => setEditing({ ...editing, label: e.target.value })}
              placeholder="e.g. Lights On Course"
              className="bg-background border-border text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Topic Category</Label>
            <Input
              value={editing.topic ?? ""}
              onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
              placeholder="e.g. sleep, gut, detox"
              className="bg-background border-border text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Keywords (comma-separated — triggers this CTA when content matches)
          </Label>
          <Input
            value={editing.keywords ?? ""}
            onChange={(e) => setEditing({ ...editing, keywords: e.target.value })}
            placeholder="e.g. sleep, insomnia, circadian, rest, melatonin"
            className="bg-background border-border text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">CTA Text * (what gets injected into content)</Label>
          <Textarea
            value={editing.ctaText ?? ""}
            onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })}
            rows={4}
            placeholder="e.g. Ready to reclaim your energy? Join the Lights On course at lightson.theurbanmonk.com and get the exact protocols Dr. Pedram Shojai uses with his patients."
            className="bg-background border-border resize-none text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input
            value={editing.url ?? ""}
            onChange={(e) => setEditing({ ...editing, url: e.target.value })}
            placeholder="https://lightson.theurbanmonk.com"
            className="bg-background border-border text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDefaultEdit"
            checked={editing.isDefault ?? false}
            onChange={(e) => setEditing({ ...editing, isDefault: e.target.checked })}
            className="rounded border-border"
          />
          <Label htmlFor="isDefaultEdit" className="text-xs text-muted-foreground cursor-pointer">
            Set as default CTA (used when no topic keywords match)
          </Label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {upsertMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save CTA
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
