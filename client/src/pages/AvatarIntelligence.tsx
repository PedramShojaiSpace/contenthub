import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Users,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  Search,
  Brain,
  Heart,
  TrendingUp,
  Zap,
  ChevronDown,
  ChevronUp,
  Quote,
} from "lucide-react";

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  surface: { label: "Surface Pain", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: Zap },
  practitioner_maze: { label: "Practitioner Maze", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: AlertTriangle },
  deep_pain: { label: "Deep Pain", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: Heart },
  root_cause: { label: "Root Cause", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: Brain },
};

// ── Pain Point Card ───────────────────────────────────────────────────────────
function PainPointCard({ pp }: { pp: any }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STAGE_CONFIG[pp.stage] || STAGE_CONFIG.surface;
  const Icon = cfg.icon;

  return (
    <Card className={`border ${cfg.bg} transition-all`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0 mt-0.5`} />
            <CardTitle className="text-sm font-semibold text-foreground leading-tight">{pp.title}</CardTitle>
          </div>
          <Badge variant="outline" className={`text-xs ${cfg.color} border-current flex-shrink-0`}>
            {cfg.label}
          </Badge>
        </div>
        {pp.category && (
          <p className="text-xs text-muted-foreground ml-6">{pp.category}</p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {pp.description && (
          <p className="text-xs text-foreground/80 leading-relaxed">{pp.description}</p>
        )}
        {pp.emotionalHook && (
          <div className="bg-white/60 rounded p-2 border border-current/10">
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Emotional Hook</p>
            <p className="text-xs italic text-foreground/90">{pp.emotionalHook}</p>
          </div>
        )}
        {pp.keyQuote && (
          <div className="flex gap-1.5">
            <Quote className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground italic">"{pp.keyQuote}"</p>
          </div>
        )}
        {(pp.headlineFormula || pp.contentTopics) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Less" : "More details"}
          </button>
        )}
        {expanded && (
          <div className="space-y-2 pt-1 border-t border-current/10">
            {pp.headlineFormula && (
              <div>
                <p className="text-xs font-medium text-foreground/70">Headline Formula</p>
                <p className="text-xs text-foreground/80">{pp.headlineFormula}</p>
                {pp.exampleHeadline && (
                  <p className="text-xs text-primary mt-0.5">e.g. "{pp.exampleHeadline}"</p>
                )}
              </div>
            )}
            {pp.contentTopics && (
              <div>
                <p className="text-xs font-medium text-foreground/70">Content Topics</p>
                <p className="text-xs text-foreground/80">{pp.contentTopics}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Persona Card ──────────────────────────────────────────────────────────────
function PersonaCard({ persona }: { persona: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="border border-border hover:border-primary/30 transition-all">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{persona.name}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {persona.profile && (
          <p className="text-xs text-foreground/80 leading-relaxed">
            {expanded ? persona.profile : `${persona.profile.slice(0, 200)}${persona.profile.length > 200 ? "…" : ""}`}
          </p>
        )}
        {persona.communicationStyle && (
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Communication Style</p>
            <p className="text-xs text-foreground/80">{persona.communicationStyle}</p>
          </div>
        )}
        {persona.buyingTriggers && (
          <div>
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Buying Triggers</p>
            <p className="text-xs text-foreground/80">{persona.buyingTriggers}</p>
          </div>
        )}
        {persona.profile && persona.profile.length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-primary hover:underline"
          >
            {expanded ? "Show less" : "Show full profile"}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Framework Card ────────────────────────────────────────────────────────────
function FrameworkCard({ fw }: { fw: any }) {
  const USE_CASE_COLORS: Record<string, string> = {
    "cold_audience": "bg-blue-50 text-blue-700 border-blue-200",
    "warm_audience": "bg-green-50 text-green-700 border-green-200",
    "hot_audience": "bg-red-50 text-red-700 border-red-200",
    "objection_handling": "bg-orange-50 text-orange-700 border-orange-200",
    "all": "bg-purple-50 text-purple-700 border-purple-200",
  };
  const colorClass = USE_CASE_COLORS[fw.useCase] || "bg-muted text-muted-foreground border-border";

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <CardTitle className="text-sm font-semibold">{fw.name}</CardTitle>
          </div>
          {fw.useCase && (
            <Badge variant="outline" className={`text-xs ${colorClass} flex-shrink-0`}>
              {fw.useCase.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {fw.structure && (
          <div className="bg-muted/40 rounded p-2">
            <p className="text-xs font-medium text-foreground/70 mb-1">Structure</p>
            <p className="text-xs text-foreground/80 whitespace-pre-line">{fw.structure}</p>
          </div>
        )}
        {fw.emotionalJob && (
          <div>
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Emotional Job</p>
            <p className="text-xs text-foreground/80 italic">{fw.emotionalJob}</p>
          </div>
        )}
        {fw.exampleOpener && (
          <div className="border-l-2 border-primary/30 pl-2">
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Example Opener</p>
            <p className="text-xs text-foreground/80">"{fw.exampleOpener}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Objection Card ────────────────────────────────────────────────────────────
function ObjectionCard({ obj }: { obj: any }) {
  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <CardTitle className="text-sm font-semibold text-foreground">"{obj.objection}"</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {obj.underlyingFear && (
          <div className="bg-amber-50 border border-amber-100 rounded p-2">
            <p className="text-xs font-medium text-amber-700 mb-0.5">Underlying Fear</p>
            <p className="text-xs text-amber-800">{obj.underlyingFear}</p>
          </div>
        )}
        {obj.responseFramework && (
          <div>
            <p className="text-xs font-medium text-foreground/70 mb-0.5">Response Framework</p>
            <p className="text-xs text-foreground/80 whitespace-pre-line">{obj.responseFramework}</p>
          </div>
        )}
        {obj.bridgeStatement && (
          <div className="border-l-2 border-emerald-300 pl-2">
            <p className="text-xs font-medium text-emerald-700 mb-0.5">Bridge Statement</p>
            <p className="text-xs text-foreground/80 italic">"{obj.bridgeStatement}"</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AvatarIntelligence() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");

  const { data: stats } = trpc.avatar.getStats.useQuery();
  const { data: painPoints = [], isLoading: ppLoading } = trpc.avatar.listPainPoints.useQuery();
  const { data: personas = [], isLoading: personasLoading } = trpc.avatar.listPersonas.useQuery();
  const { data: frameworks = [], isLoading: fwLoading } = trpc.avatar.listFrameworks.useQuery();
  const { data: objections = [], isLoading: objLoading } = trpc.avatar.listObjections.useQuery();

  const filteredPainPoints = painPoints.filter((pp: any) => {
    const matchesSearch =
      !search ||
      pp.title?.toLowerCase().includes(search.toLowerCase()) ||
      pp.description?.toLowerCase().includes(search.toLowerCase()) ||
      pp.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "all" || pp.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <DashboardLayout>
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Avatar Intelligence Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Derived from hundreds of real discovery call transcripts and sales team training. Every AI-generated piece of content is automatically enriched with this intelligence.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Pain Points", value: stats.totalPainPoints, icon: AlertTriangle, color: "text-red-600" },
            { label: "Buyer Personas", value: stats.totalPersonas, icon: Users, color: "text-blue-600" },
            { label: "Messaging Frameworks", value: stats.totalFrameworks, icon: MessageSquare, color: "text-purple-600" },
            { label: "Objection Handlers", value: stats.totalObjections, icon: ShieldCheck, color: "text-amber-600" },
          ].map((s) => (
            <Card key={s.label} className="border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Journey Stage Map */}
      {stats && stats.stageBreakdown.length > 0 && (
        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Customer Journey Map
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex gap-2 flex-wrap">
              {stats.stageBreakdown.map((s: any) => {
                const cfg = STAGE_CONFIG[s.stage] || STAGE_CONFIG.surface;
                const Icon = cfg.icon;
                return (
                  <div key={s.stage} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${cfg.bg}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <div>
                      <p className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</p>
                      <p className="text-xs text-muted-foreground">{s.count} pain points</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3 italic">
              The AI selects the most relevant pain points for each topic and injects them into every generated script, blog post, social caption, and landing page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="pain-points">
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="pain-points">Pain Points</TabsTrigger>
          <TabsTrigger value="personas">Personas</TabsTrigger>
          <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
          <TabsTrigger value="objections">Objections</TabsTrigger>
        </TabsList>

        {/* Pain Points Tab */}
        <TabsContent value="pain-points" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search pain points…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {["all", "surface", "practitioner_maze", "deep_pain", "root_cause"].map((stage) => {
                const cfg = stage === "all" ? null : STAGE_CONFIG[stage];
                return (
                  <button
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      stageFilter === stage
                        ? "bg-primary text-primary-foreground border-primary"
                        : cfg
                        ? `${cfg.bg} ${cfg.color} border-current/30`
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {stage === "all" ? "All Stages" : cfg?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {ppLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : filteredPainPoints.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No pain points match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPainPoints.map((pp: any) => (
                <PainPointCard key={pp.id} pp={pp} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Personas Tab */}
        <TabsContent value="personas" className="mt-4">
          {personasLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {personas.map((p: any) => (
                <PersonaCard key={p.id} persona={p} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Frameworks Tab */}
        <TabsContent value="frameworks" className="mt-4">
          {fwLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {frameworks.map((fw: any) => (
                <FrameworkCard key={fw.id} fw={fw} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Objections Tab */}
        <TabsContent value="objections" className="mt-4">
          {objLoading ? (
            <div className="grid grid-cols-1 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {objections.map((o: any) => (
                <ObjectionCard key={o.id} obj={o} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </DashboardLayout>
  );
}
