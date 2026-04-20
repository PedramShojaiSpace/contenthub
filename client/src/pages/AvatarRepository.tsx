import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  Sparkles,
  Plus,
  Users,
  Brain,
  Target,
  Lightbulb,
  MessageSquareQuote,
  AlertCircle,
  ShieldAlert,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  BookOpen,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AvatarProfile {
  id: number;
  productName: string;
  productSlug: string;
  productDescription: string | null;
  cumulativePainPoints: string | null;
  cumulativeMotivations: string | null;
  cumulativeLanguage: string | null;
  cumulativeObjections: string | null;
  cumulativeThemes: string | null;
  demographicPatterns: string | null;
  avatarNarrative: string | null;
  webinarBriefContext: string | null;
  totalRespondents: number | null;
  webinarCount: number | null;
  lastUpdatedAt: Date | null;
  createdAt: Date;
}

interface IntelligenceRecord {
  id: number;
  webinarSessionId: number;
  surveyType: string;
  responseCount: number | null;
  extractedAt: Date | null;
  aggregatedAt: Date | null;
  notes: string | null;
  aiSummary: string | null;
}

function parseArr(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
}

// ─── Create Profile Modal ─────────────────────────────────────────────────────
function CreateProfileForm({ onSuccess }: { onSuccess: () => void }) {
  const [productName, setProductName] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.webinarIntelligence.createAvatarProfile.useMutation({
    onSuccess: () => {
      utils.webinarIntelligence.listAvatarProfiles.invalidate();
      toast.success("Avatar profile created");
      onSuccess();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const autoSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <Card className="bg-card/60 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Avatar Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Product Name</label>
          <input
            className="w-full h-8 text-sm px-3 rounded-md border border-input bg-background"
            placeholder="e.g. Upstream Course"
            value={productName}
            onChange={(e) => {
              setProductName(e.target.value);
              setProductSlug(autoSlug(e.target.value));
            }}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Slug (auto-generated)</label>
          <input
            className="w-full h-8 text-sm px-3 rounded-md border border-input bg-background font-mono"
            placeholder="e.g. upstream-course"
            value={productSlug}
            onChange={(e) => setProductSlug(e.target.value.trim())}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
          <input
            className="w-full h-8 text-sm px-3 rounded-md border border-input bg-background"
            placeholder="e.g. 10-part docu-series on finding your health root cause"
            value={productDescription}
            onChange={(e) => setProductDescription(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() =>
            createMutation.mutate({
              productName,
              productSlug,
              productDescription: productDescription || undefined,
            })
          }
          disabled={createMutation.isPending || !productName.trim() || !productSlug.trim()}
        >
          {createMutation.isPending ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Creating…</>
          ) : (
            <><Plus className="w-4 h-4" /> Create Profile</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Aggregate Intelligence Panel ────────────────────────────────────────────
// Shown when user clicks "Add Intelligence" on a profile — lets them pick an
// extracted intelligence record to merge into this avatar profile.
function AggregatePanel({
  profile,
  onClose,
  onSuccess,
}: {
  profile: AvatarProfile;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const utils = trpc.useUtils();

  // Load all webinar sessions to find extracted records
  const { data: sessions = [] } = trpc.webinar.list.useQuery();
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);

  const { data: records = [] } = trpc.webinarIntelligence.listBySession.useQuery(
    { webinarSessionId: selectedSessionId! },
    { enabled: selectedSessionId !== null }
  );

  const extractedRecords = records.filter(
    (r: IntelligenceRecord) => r.extractedAt && !r.aggregatedAt
  );

  const aggregateMutation = trpc.webinarIntelligence.aggregateToAvatarProfile.useMutation({
    onSuccess: (data) => {
      utils.webinarIntelligence.listAvatarProfiles.invalidate();
      toast.success(
        `Intelligence merged! Profile now covers ${data.webinarCount} webinar${data.webinarCount !== 1 ? "s" : ""} and ${data.totalRespondents} respondents.`
      );
      onSuccess();
    },
    onError: (err) => toast.error(`Aggregation failed: ${err.message}`),
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Add Intelligence to "{profile.productName}"
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
            ✕ Cancel
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Select a webinar session and pick an extracted intelligence record to merge into this avatar profile.
          The AI will synthesize the new data with the existing profile.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Session selector */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Webinar Session</label>
          <select
            className="w-full h-8 text-sm px-3 rounded-md border border-input bg-background"
            value={selectedSessionId?.toString() ?? ""}
            onChange={(e) => setSelectedSessionId(Number(e.target.value) || null)}
          >
            <option value="">Choose a session…</option>
            {sessions.map((s: { id: number; topic: string; webinarDate?: string | null }) => (
              <option key={s.id} value={s.id}>
                {s.topic}{s.webinarDate ? ` — ${s.webinarDate}` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Intelligence records for selected session */}
        {selectedSessionId && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Extracted Intelligence Records
              {extractedRecords.length === 0 && records.length > 0 && (
                <span className="ml-2 text-amber-400">
                  (all records already aggregated or not yet extracted)
                </span>
              )}
            </label>
            {extractedRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No extracted records available for this session. Run "Extract Intelligence" first in Webinar Intel.
              </p>
            ) : (
              <div className="space-y-2">
                {extractedRecords.map((r: IntelligenceRecord) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 bg-card/40"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            r.surveyType === "pre_registration"
                              ? "text-blue-400 border-blue-400/40 bg-blue-400/10 text-xs"
                              : "text-emerald-400 border-emerald-400/40 bg-emerald-400/10 text-xs"
                          }
                        >
                          {r.surveyType === "pre_registration" ? "Pre-Reg" : "Post-Webinar"}
                        </Badge>
                        <span className="text-sm">{r.responseCount ?? 0} responses</span>
                      </div>
                      {r.notes && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.notes}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 h-7 text-xs"
                      onClick={() =>
                        aggregateMutation.mutate({
                          intelligenceId: r.id,
                          avatarProfileId: profile.id,
                        })
                      }
                      disabled={aggregateMutation.isPending}
                    >
                      {aggregateMutation.isPending ? (
                        <><RefreshCw className="w-3 h-3 animate-spin" /> Merging…</>
                      ) : (
                        <><Sparkles className="w-3 h-3" /> Merge Into Profile</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Avatar Profile Card ──────────────────────────────────────────────────────
function AvatarProfileCard({ profile }: { profile: AvatarProfile }) {
  const [expanded, setExpanded] = useState(false);
  const [showAggregate, setShowAggregate] = useState(false);
  const [showBriefContext, setShowBriefContext] = useState(false);

  const painPoints = parseArr(profile.cumulativePainPoints);
  const motivations = parseArr(profile.cumulativeMotivations);
  const language = parseArr(profile.cumulativeLanguage);
  const objections = parseArr(profile.cumulativeObjections);
  const themes = parseArr(profile.cumulativeThemes);

  const hasData = painPoints.length > 0 || motivations.length > 0;

  const handleCopyBrief = () => {
    if (profile.webinarBriefContext) {
      navigator.clipboard.writeText(profile.webinarBriefContext);
      toast.success("Webinar brief context copied to clipboard");
    }
  };

  return (
    <div className="space-y-3">
      <Card className="bg-card/60 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                {profile.productName}
              </CardTitle>
              {profile.productDescription && (
                <p className="text-xs text-muted-foreground mt-0.5">{profile.productDescription}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Brain className="w-3 h-3" />
                  {profile.webinarCount ?? 0} webinar{(profile.webinarCount ?? 0) !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {profile.totalRespondents ?? 0} total respondents
                </span>
                {profile.lastUpdatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(profile.lastUpdatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className="gap-1.5 shrink-0 h-8 text-xs"
              onClick={() => setShowAggregate(!showAggregate)}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {showAggregate ? "Cancel" : "Add Intelligence"}
            </Button>
          </div>
        </CardHeader>

        {hasData ? (
          <CardContent className="pt-0 space-y-4">
            {/* Avatar Narrative */}
            {profile.avatarNarrative && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">Avatar Profile</p>
                <p className="text-sm text-foreground/85 leading-relaxed italic">
                  "{profile.avatarNarrative}"
                </p>
              </div>
            )}

            {/* Demographic Patterns */}
            {profile.demographicPatterns && (
              <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Who They Are</p>
                <p className="text-sm text-foreground/80">{profile.demographicPatterns}</p>
              </div>
            )}

            {/* Themes */}
            {themes.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Recurring Themes ({themes.length})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {themes.map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-violet-500/10 text-violet-300 border-violet-500/20">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Expand toggle */}
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? "Show less" : `Show pain points, motivations, language & objections`}
            </button>

            {expanded && (
              <div className="space-y-4 pt-1">
                {/* Pain Points */}
                {painPoints.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Cumulative Pain Points ({painPoints.length})
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {painPoints.map((p, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex gap-2">
                          <span className="text-red-400 shrink-0">•</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Motivations */}
                {motivations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Why They Show Up ({motivations.length})
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {motivations.map((m, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex gap-2">
                          <span className="text-amber-400 shrink-0">•</span>{m}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Exact Language */}
                {language.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MessageSquareQuote className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Exact Language They Use ({language.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {language.map((l, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-mono"
                        >
                          "{l}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Objections */}
                {objections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Objections & Hesitations ({objections.length})
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {objections.map((o, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex gap-2">
                          <span className="text-orange-400 shrink-0">•</span>{o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Webinar Brief Context — the pre-built prompt block */}
            {profile.webinarBriefContext && (
              <div className="pt-2 border-t border-border/30">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-primary" />
                      Webinar Brief Context
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pre-built prompt block — copy and inject into your next webinar creation to instantly brief the AI on this audience.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={handleCopyBrief}
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setShowBriefContext(!showBriefContext)}
                    >
                      {showBriefContext ? "Hide" : "Preview"}
                    </Button>
                  </div>
                </div>
                {showBriefContext && (
                  <div className="bg-background/60 rounded-lg border border-border/40 p-3 max-h-[300px] overflow-y-auto">
                    <Streamdown>{profile.webinarBriefContext}</Streamdown>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="pt-0">
            <div className="py-6 text-center border border-dashed border-border/40 rounded-lg">
              <Brain className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No intelligence aggregated yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click "Add Intelligence" above to merge webinar survey data into this profile.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Aggregate Panel */}
      {showAggregate && (
        <AggregatePanel
          profile={profile}
          onClose={() => setShowAggregate(false)}
          onSuccess={() => setShowAggregate(false)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AvatarRepositoryPage() {
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: profiles = [], isLoading } = trpc.webinarIntelligence.listAvatarProfiles.useQuery();

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              Avatar Intelligence Repository
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Per-product audience profiles that compound intelligence across every webinar.
              Each time you run a webinar, merge the extracted insights here to build a richer,
              more accurate picture of who shows up and why.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            <Plus className="w-4 h-4" />
            {showCreateForm ? "Cancel" : "New Profile"}
          </Button>
        </div>

        {/* How it works */}
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-200/80 space-y-0.5">
                <p>
                  <span className="font-semibold text-amber-300">How it works:</span>{" "}
                  After each webinar, go to Webinar Intel → extract the survey intelligence → come back here and click "Add Intelligence" on the relevant product profile.
                  The AI synthesizes the new data with everything it already knows, producing a richer cumulative profile each time.
                </p>
                <p>
                  The "Webinar Brief Context" block on each profile is a pre-built prompt you can copy and inject into any new webinar creation — it instantly briefs the AI on your real audience without you having to re-explain who they are.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Form */}
        {showCreateForm && (
          <CreateProfileForm onSuccess={() => setShowCreateForm(false)} />
        )}

        {/* Profiles */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-muted/20 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : profiles.length === 0 ? (
          <Card className="bg-card/30 border-dashed border-border/40">
            <CardContent className="py-16 text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No avatar profiles yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Create a profile for each product you run webinars for (e.g. "Upstream Course", "Urban Monk Academy").
                Then merge your webinar intelligence into it after each event.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-2"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="w-4 h-4" />
                Create First Profile
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(profiles as AvatarProfile[]).map((profile) => (
              <AvatarProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
