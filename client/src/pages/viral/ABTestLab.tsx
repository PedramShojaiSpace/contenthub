import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FlaskConical, Copy, Loader2, Trophy, Plus, CheckCircle2, Clock, Kanban, BarChart2, ChevronDown, ChevronUp, Star } from "lucide-react";
import { useLocation } from "wouter";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube Shorts" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X / Twitter" },
];

const VARIANT_TYPES = [
  { value: "hook", label: "Hook (opening line)" },
  { value: "cta", label: "CTA (call to action)" },
  { value: "format", label: "Format (talking head vs. text overlay)" },
  { value: "length", label: "Length (15s vs. 60s)" },
  { value: "angle", label: "Angle (fear vs. aspiration)" },
];

const HOOK_FRAMEWORKS = [
  { value: "contradiction", label: "Contradiction" },
  { value: "curiosityGap", label: "Curiosity Gap" },
  { value: "specificity", label: "Specificity" },
  { value: "socialProof", label: "Social Proof" },
  { value: "transformation", label: "Transformation" },
];

interface TestVariantRow {
  id: number;
  testName: string;
  topic: string;
  platform: string;
  variantType: string;
  variantA: string;
  variantB: string;
  variantC: string | null;
  notes: string | null;
  status: string;
  winner: string | null;
  winnerReason: string | null;
  createdAt: Date | string;
  results?: ResultRow[];
}

interface ResultRow {
  id: number;
  variantId: number;
  variant: "A" | "B" | "C";
  views: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  dmTriggers: number;
  engagementRate: number;
  accountHandle: string | null;
  notes: string | null;
  recordedAt: Date | string;
}

// Parse the notes JSON field that stores watchTimePercent and ctr
function parseResultNotes(notes: string | null): { watchTimePercent: number | null; ctr: number | null; userNotes: string | null } {
  if (!notes) return { watchTimePercent: null, ctr: null, userNotes: null };
  try {
    const parsed = JSON.parse(notes);
    return {
      watchTimePercent: parsed.watchTimePercent ?? null,
      ctr: parsed.ctr ?? null,
      userNotes: parsed.userNotes ?? null,
    };
  } catch {
    return { watchTimePercent: null, ctr: null, userNotes: notes };
  }
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-purple-100 text-purple-700 border-purple-200",
};

function VariantRow({
  label,
  text,
  results,
  isWinner,
  hasDataDrivenWinner,
  onCopy,
  onLogResult,
  onDeclareWinner,
}: {
  label: "A" | "B" | "C";
  text: string;
  results: ResultRow[];
  isWinner: boolean;
  hasDataDrivenWinner: boolean;
  onCopy: (t: string) => void;
  onLogResult: (variant: "A" | "B" | "C", data: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    watchTimePercent?: number;
    ctr?: number;
    notes?: string;
    accountHandle?: string;
  }) => void;
  onDeclareWinner: (variant: "A" | "B" | "C") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [views, setViews] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [ctr, setCtr] = useState("");
  const [accountHandle, setAccountHandle] = useState("");
  const [userNotes, setUserNotes] = useState("");

  const latestResult = results.find((r) => r.variant === label);
  const engRate = latestResult && latestResult.views > 0
    ? (((latestResult.likes + latestResult.comments + latestResult.shares) / latestResult.views) * 100).toFixed(2)
    : null;
  const parsedNotes = latestResult ? parseResultNotes(latestResult.notes) : null;

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${isWinner ? "border-green-400 bg-green-50/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${isWinner ? "bg-green-600 text-white" : "bg-muted text-foreground"}`}>
            {label}
          </div>
          {isWinner && (
            <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
              <Trophy className="w-3 h-3 mr-1" />Winner
            </Badge>
          )}
          {isWinner && hasDataDrivenWinner && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
              <BarChart2 className="w-3 h-3 mr-1" />Data-driven
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onCopy(text)}>
          <Copy className="w-3 h-3" />
        </Button>
      </div>

      <p className="text-sm text-foreground">{text}</p>

      {latestResult && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
          <div className="bg-muted/50 rounded-lg p-1.5">
            <p className="text-sm font-bold">{latestResult.views.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-1.5">
            <p className="text-sm font-bold">{latestResult.likes.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Likes</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-1.5">
            <p className="text-sm font-bold">{latestResult.comments.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Comments</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-1.5">
            <p className="text-sm font-bold text-green-600">{engRate}%</p>
            <p className="text-xs text-muted-foreground">Eng.</p>
          </div>
          {parsedNotes?.watchTimePercent != null && (
            <div className="bg-blue-50 rounded-lg p-1.5">
              <p className="text-sm font-bold text-blue-700">{parsedNotes.watchTimePercent}%</p>
              <p className="text-xs text-muted-foreground">Watch Time</p>
            </div>
          )}
          {parsedNotes?.ctr != null && (
            <div className="bg-amber-50 rounded-lg p-1.5">
              <p className="text-sm font-bold text-amber-700">{parsedNotes.ctr}%</p>
              <p className="text-xs text-muted-foreground">CTR</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditing(!editing)}>
          {editing ? <><ChevronUp className="w-3 h-3 mr-1" />Collapse</> : latestResult ? <><BarChart2 className="w-3 h-3 mr-1" />Update Results</> : <><BarChart2 className="w-3 h-3 mr-1" />Log Results</>}
        </Button>
        {latestResult && !isWinner && (
          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => onDeclareWinner(label)}>
            <Trophy className="w-3 h-3 mr-1" />Declare Winner
          </Button>
        )}
      </div>

      {editing && (
        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Performance Data — Variant {label}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Views</Label>
              <Input value={views} onChange={(e) => setViews(e.target.value)} className="h-8 text-sm" type="number" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Likes</Label>
              <Input value={likes} onChange={(e) => setLikes(e.target.value)} className="h-8 text-sm" type="number" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comments</Label>
              <Input value={comments} onChange={(e) => setComments(e.target.value)} className="h-8 text-sm" type="number" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Shares</Label>
              <Input value={shares} onChange={(e) => setShares(e.target.value)} className="h-8 text-sm" type="number" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                Watch Time %
                <span className="text-muted-foreground font-normal">(0–100)</span>
              </Label>
              <Input value={watchTime} onChange={(e) => setWatchTime(e.target.value)} className="h-8 text-sm" type="number" placeholder="e.g. 45" min="0" max="100" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                CTR %
                <span className="text-muted-foreground font-normal">(click-through)</span>
              </Label>
              <Input value={ctr} onChange={(e) => setCtr(e.target.value)} className="h-8 text-sm" type="number" placeholder="e.g. 3.2" min="0" max="100" step="0.1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Account Handle</Label>
              <Input value={accountHandle} onChange={(e) => setAccountHandle(e.target.value)} className="h-8 text-sm" placeholder="@sub_account_1" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Input value={userNotes} onChange={(e) => setUserNotes(e.target.value)} className="h-8 text-sm" placeholder="Optional observations" />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => {
              onLogResult(label, {
                views: parseInt(views) || 0,
                likes: parseInt(likes) || 0,
                comments: parseInt(comments) || 0,
                shares: parseInt(shares) || 0,
                watchTimePercent: watchTime ? parseFloat(watchTime) : undefined,
                ctr: ctr ? parseFloat(ctr) : undefined,
                accountHandle: accountHandle || undefined,
                notes: userNotes || undefined,
              });
              setEditing(false);
            }}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />Save Performance Data
          </Button>
        </div>
      )}
    </div>
  );
}

const PLATFORM_MAP: Record<string, "meta" | "linkedin" | "x" | "youtube" | "tiktok" | "blog" | "email" | "carousel"> = {
  tiktok: "tiktok",
  instagram: "meta",
  youtube: "youtube",
  linkedin: "linkedin",
  x: "x",
};

// Determine if a test has data-driven winner (any result has watchTimePercent or ctr)
function hasDataDrivenResults(test: TestVariantRow): boolean {
  return (test.results ?? []).some((r) => {
    const parsed = parseResultNotes(r.notes);
    return parsed.watchTimePercent != null || parsed.ctr != null;
  });
}

export default function ABTestLab() {
  const [, setLocation] = useLocation();
  const [testName, setTestName] = useState("");
  const [topic, setTopic] = useState("");
  const [platform, setPlatform] = useState("tiktok");
  const [variantType, setVariantType] = useState("hook");
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [variantC, setVariantC] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const [promotedTests, setPromotedTests] = useState<Set<number>>(new Set());

  // Declare winner dialog state
  const [declareWinnerVariant, setDeclareWinnerVariant] = useState<"A" | "B" | "C" | null>(null);
  const [declareWinnerTestId, setDeclareWinnerTestId] = useState<number | null>(null);
  const [winnerReason, setWinnerReason] = useState("");
  const [winnerFramework, setWinnerFramework] = useState<string>("");

  const createMutation = trpc.viralStudio.createTestVariant.useMutation({
    onSuccess: (data: any) => {
      toast.success("Test created!");
      setSelectedTestId(data.id);
      variantsQuery.refetch();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const recordResultMutation = trpc.viralStudio.recordTestResult.useMutation({
    onSuccess: () => {
      toast.success("Performance data saved!");
      variantsQuery.refetch();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const declareWinnerMutation = trpc.viralStudio.declareTestWinner.useMutation({
    onSuccess: () => {
      toast.success("Winner declared! Use this variant on your main account.");
      setDeclareWinnerVariant(null);
      setDeclareWinnerTestId(null);
      setWinnerReason("");
      setWinnerFramework("");
      variantsQuery.refetch();
    },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const variantsQuery = trpc.viralStudio.getTestVariants.useQuery({ limit: 20, status: "all" });

  const promoteToKanbanMutation = trpc.content.createBulk.useMutation({
    onSuccess: () => {
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          <span>
            Winner promoted to Kanban!{" "}
            <button className="underline font-medium" onClick={() => setLocation("/command-center")}>
              View card →
            </button>
          </span>
        </div>,
        { duration: 6000 }
      );
      if (selectedTest) {
        setPromotedTests(prev => { const next = new Set(Array.from(prev)); next.add(selectedTest.id); return next; });
      }
    },
    onError: (err) => toast.error(`Failed to promote: ${err.message}`),
  });

  const handlePromoteWinner = (test: TestVariantRow) => {
    const winnerText = test.winner === "A" ? test.variantA
      : test.winner === "B" ? test.variantB
      : test.variantC ?? "";
    const mappedPlatform = PLATFORM_MAP[test.platform] ?? "tiktok";
    promoteToKanbanMutation.mutate({
      items: [{
        title: `[${test.platform.toUpperCase()}] ${test.testName} — Winner ${test.winner}`,
        rawIdea: winnerText,
        platform: mappedPlatform,
        status: "idea",
        textContent: `WINNING HOOK (Variant ${test.winner}):\n${winnerText}\n\nTopic: ${test.topic}\n\nTest: ${test.testName}${test.winnerReason ? `\n\nWhy it won: ${test.winnerReason}` : ""}`,
      }],
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleCreate = () => {
    if (!testName.trim() || !topic.trim() || !variantA.trim() || !variantB.trim()) {
      toast.error("Fill in test name, topic, Variant A and Variant B");
      return;
    }
    createMutation.mutate({
      testName: testName.trim(),
      topic: topic.trim(),
      platform: platform as "tiktok",
      variantType: variantType as "hook",
      variantA: variantA.trim(),
      variantB: variantB.trim(),
      variantC: variantC.trim() || undefined,
    });
  };

  const handleDeclareWinnerClick = (testId: number, variant: "A" | "B" | "C") => {
    setDeclareWinnerTestId(testId);
    setDeclareWinnerVariant(variant);
    setWinnerReason("");
    setWinnerFramework("");
  };

  const handleConfirmWinner = () => {
    if (!declareWinnerTestId || !declareWinnerVariant) return;
    declareWinnerMutation.mutate({
      variantId: declareWinnerTestId,
      winner: declareWinnerVariant,
      winnerReason: winnerReason || undefined,
      winnerFramework: winnerFramework || undefined,
    });
  };

  const allTests = (variantsQuery.data ?? []) as TestVariantRow[];
  const selectedTest = selectedTestId ? allTests.find((t) => t.id === selectedTestId) : allTests[0] ?? null;

  return (
    <div className="p-6 space-y-6">
      {/* Explainer */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-xl p-4">
        <h3 className="font-semibold text-rose-900 mb-1 flex items-center gap-2">
          <FlaskConical className="w-4 h-4" />
          Sub-Account A/B Testing Lab
        </h3>
        <p className="text-sm text-rose-700">
          Growthopia's core strategy: post the same topic with 2–3 different hooks/angles on separate test accounts, measure which performs best, then bring the winner to your main account. Log performance data (views, watch time %, CTR) to build a data-driven feedback loop that improves future hook recommendations.
        </p>
      </div>

      {/* How It Works */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { step: "1", label: "Create Test", desc: "Name your test, write 2–3 variants" },
          { step: "2", label: "Post Variants", desc: "Post each on a different sub-account" },
          { step: "3", label: "Log Results", desc: "After 48–72 hrs, log views, watch time & CTR" },
          { step: "4", label: "Use Winner", desc: "Post the winning variant on main account" },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
            <div className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.step}</div>
            <div>
              <p className="text-xs font-semibold">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Test Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-500" />
              New A/B Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Test Name *</Label>
                <Input placeholder="e.g. Gut Health Hook Test — Week 1" value={testName} onChange={(e) => setTestName(e.target.value)} className="text-sm" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Topic *</Label>
                <Textarea placeholder="e.g. The one gut health habit that changes everything" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} className="text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Testing</Label>
                <Select value={variantType} onValueChange={setVariantType}>
                  <SelectTrigger className="text-sm h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{VARIANT_TYPES.map((v) => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Variant A * <span className="text-muted-foreground">(Sub-Account 1)</span></Label>
                <Textarea placeholder="e.g. Everything your doctor told you about gut health is wrong." value={variantA} onChange={(e) => setVariantA(e.target.value)} rows={2} className="text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Variant B * <span className="text-muted-foreground">(Sub-Account 2)</span></Label>
                <Textarea placeholder="e.g. I've treated 10,000 patients. Only 1 gut habit actually moves the needle." value={variantB} onChange={(e) => setVariantB(e.target.value)} rows={2} className="text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Variant C <span className="text-muted-foreground">(Sub-Account 3 — optional)</span></Label>
                <Textarea placeholder="e.g. If you're over 40, you have a 90-day window to fix your gut before it becomes permanent." value={variantC} onChange={(e) => setVariantC(e.target.value)} rows={2} className="text-sm resize-none" />
              </div>
            </div>

            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !testName.trim() || !topic.trim() || !variantA.trim() || !variantB.trim()}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
              ) : (
                <><FlaskConical className="w-4 h-4 mr-2" />Create Test</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Active Tests */}
        <div className="space-y-4">
          {/* Test Selector */}
          {allTests.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {allTests.slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTestId(t.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    selectedTest?.id === t.id ? "bg-rose-600 text-white border-rose-600" : "border-border text-muted-foreground hover:border-rose-300"
                  }`}
                >
                  {t.testName.length > 25 ? t.testName.slice(0, 25) + "…" : t.testName}
                </button>
              ))}
            </div>
          )}

          {selectedTest ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{selectedTest.testName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{selectedTest.platform} · {selectedTest.variantType} test</p>
                </div>
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[selectedTest.status] ?? ""}`}>
                  <Clock className="w-3 h-3 mr-1" />{selectedTest.status}
                </Badge>
              </div>

              {selectedTest.winner && (
                <div className="p-3 bg-green-50 border-2 border-green-400 rounded-xl">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Trophy className="w-4 h-4 text-green-600" />
                    <p className="text-xs font-bold text-green-800">Winner: Variant {selectedTest.winner}</p>
                    {hasDataDrivenResults(selectedTest) && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                        <BarChart2 className="w-3 h-3 mr-1" />Data-driven winner
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-foreground">
                    {selectedTest.winner === "A" ? selectedTest.variantA : selectedTest.winner === "B" ? selectedTest.variantB : selectedTest.variantC ?? ""}
                  </p>
                  {selectedTest.winnerReason && <p className="text-xs text-green-700 mt-1">{selectedTest.winnerReason}</p>}
                  <div className="flex gap-2 flex-wrap mt-2">
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleCopy(selectedTest.winner === "A" ? selectedTest.variantA : selectedTest.winner === "B" ? selectedTest.variantB : selectedTest.variantC ?? "")}>
                      <Copy className="w-3 h-3 mr-1" />Copy to Main Account
                    </Button>
                    {promotedTests.has(selectedTest.id) ? (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-green-400 text-green-700" onClick={() => setLocation("/command-center")}>
                        <Kanban className="w-3 h-3 mr-1" />View in Kanban
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-primary/50 text-primary hover:bg-primary/5"
                        onClick={() => handlePromoteWinner(selectedTest)}
                        disabled={promoteToKanbanMutation.isPending}
                      >
                        {promoteToKanbanMutation.isPending ? (
                          <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Promoting...</>
                        ) : (
                          <><Kanban className="w-3 h-3 mr-1" />Promote winner to Kanban</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {(["A", "B", ...(selectedTest.variantC ? ["C"] : [])] as ("A" | "B" | "C")[]).map((label) => (
                  <VariantRow
                    key={label}
                    label={label}
                    text={label === "A" ? selectedTest.variantA : label === "B" ? selectedTest.variantB : selectedTest.variantC ?? ""}
                    results={selectedTest.results ?? []}
                    isWinner={selectedTest.winner === label}
                    hasDataDrivenWinner={hasDataDrivenResults(selectedTest)}
                    onCopy={handleCopy}
                    onLogResult={(variant, data) => recordResultMutation.mutate({ variantId: selectedTest.id, variant, ...data })}
                    onDeclareWinner={(variant) => handleDeclareWinnerClick(selectedTest.id, variant)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
              <FlaskConical className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Create a test to start tracking variant performance</p>
              <p className="text-xs text-muted-foreground mt-1">Tip: Use the Hook Generator to create 2–3 hook variants first, then paste them here</p>
            </div>
          )}
        </div>
      </div>

      {/* Declare Winner Dialog */}
      {declareWinnerVariant && declareWinnerTestId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold">Declare Variant {declareWinnerVariant} as Winner</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This will mark the test as complete and log the winning framework to improve future Hook Generator recommendations.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Why did it win? (optional)</Label>
                <Textarea
                  value={winnerReason}
                  onChange={(e) => setWinnerReason(e.target.value)}
                  placeholder="e.g. Higher watch time, more comments asking questions..."
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <Star className="w-3 h-3 text-amber-500" />
                  Hook Framework Used (optional — improves AI recommendations)
                </Label>
                <Select value={winnerFramework} onValueChange={setWinnerFramework}>
                  <SelectTrigger className="text-sm h-9">
                    <SelectValue placeholder="Select the framework this hook used..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HOOK_FRAMEWORKS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Selecting a framework feeds your win data back into the Hook Generator, so it surfaces your best-performing frameworks first.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeclareWinnerVariant(null);
                  setDeclareWinnerTestId(null);
                  setWinnerReason("");
                  setWinnerFramework("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleConfirmWinner}
                disabled={declareWinnerMutation.isPending}
              >
                {declareWinnerMutation.isPending ? (
                  <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Saving...</>
                ) : (
                  <><Trophy className="w-3 h-3 mr-1" />Confirm Winner</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tip Box */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs font-semibold text-amber-800 mb-1">Growthopia Sub-Account Strategy + Data Feedback Loop</p>
        <p className="text-xs text-amber-700">
          Create 3–5 "burner" TikTok/Instagram accounts. Post the same video with different hooks within 24 hours of each other. Wait 48–72 hours for the algorithm to distribute. Log <strong>watch time %</strong> (most important signal) and <strong>CTR</strong> alongside views. When you declare a winner, tag the hook framework — this data feeds back into the Hook Generator so your best-performing frameworks are highlighted for future sessions.
        </p>
      </div>
    </div>
  );
}
