import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  Trophy,
  BarChart2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  TrendingUp,
  Percent,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TestStatus = "draft" | "running" | "paused" | "concluded";

interface AbTest {
  id: number;
  name: string;
  description: string | null;
  pageUrl: string | null;
  status: TestStatus;
  minExposures: number;
  significanceThreshold: string;
  winnerVariantId: number | null;
  startedAt: number | null;
  concludedAt: number | null;
  createdAt: number;
}

interface AbVariant {
  id: number;
  testId: number;
  name: string;
  description: string | null;
  isControl: boolean;
  weight: number;
  headline: string | null;
  ctaText: string | null;
}

interface VariantStats {
  variantId: number;
  name: string;
  isControl: boolean;
  exposures: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
  revenuePerExposure: number;
}

interface SignificanceResult {
  controlId: number;
  treatmentId: number;
  zScore: number;
  pValue: number;
  confidence: number;
  isSignificant: boolean;
  relativeLift: number;
  hasEnoughData: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: TestStatus) {
  const map: Record<TestStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-zinc-700 text-zinc-200" },
    running: { label: "Running", className: "bg-emerald-700 text-emerald-100" },
    paused: { label: "Paused", className: "bg-amber-700 text-amber-100" },
    concluded: { label: "Concluded", className: "bg-blue-700 text-blue-100" },
  };
  const { label, className } = map[status] ?? map.draft;
  return <Badge className={`text-xs ${className}`}>{label}</Badge>;
}

function confidenceBadge(sig: SignificanceResult) {
  if (!sig.hasEnoughData) {
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-400">
        <Clock className="w-3 h-3" /> Collecting data…
      </span>
    );
  }
  if (sig.isSignificant) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold">
        <CheckCircle2 className="w-3 h-3" />
        {(sig.confidence * 100).toFixed(1)}% confidence — significant
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-amber-400">
      <AlertCircle className="w-3 h-3" />
      {(sig.confidence * 100).toFixed(1)}% confidence — not yet significant
    </span>
  );
}

// ─── Create Test Modal ────────────────────────────────────────────────────────

function CreateTestModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [minExposures, setMinExposures] = useState(300);
  const [threshold, setThreshold] = useState(0.95);

  const createTest = trpc.abTest.createTest.useMutation({
    onSuccess: (data) => {
      toast.success("Test created");
      onCreated(data.testId);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold text-white">New A/B Test</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Test name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lights On headline test"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Page URL</label>
            <Input
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="https://theurbanmonk.com/lights-on"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you testing and why?"
              className="bg-zinc-800 border-zinc-700 text-white resize-none"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Min exposures per variant</label>
              <Input
                type="number"
                value={minExposures}
                onChange={(e) => setMinExposures(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Significance threshold</label>
              <Input
                type="number"
                step="0.01"
                min="0.8"
                max="0.99"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">Cancel</Button>
          <Button
            onClick={() => createTest.mutate({ name, description, pageUrl, minExposures, significanceThreshold: threshold })}
            disabled={!name || createTest.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {createTest.isPending ? "Creating…" : "Create Test"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Variant Modal ────────────────────────────────────────────────────────

function AddVariantModal({ testId, onClose }: { testId: number; onClose: () => void }) {
  const [name, setName] = useState("");
  const [isControl, setIsControl] = useState(false);
  const [weight, setWeight] = useState(50);
  const [headline, setHeadline] = useState("");
  const [ctaText, setCtaText] = useState("");
  const utils = trpc.useUtils();

  const createVariant = trpc.abTest.createVariant.useMutation({
    onSuccess: () => {
      toast.success("Variant added");
      utils.abTest.getTest.invalidate({ testId });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-lg space-y-4">
        <h2 className="text-lg font-semibold text-white">Add Variant</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Variant name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Control, Variant B"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Headline copy</label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="The headline shown to this variant"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">CTA button text</label>
            <Input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="e.g. Start Your Journey"
              className="bg-zinc-800 border-zinc-700 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Traffic weight (%)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isControl}
                  onChange={(e) => setIsControl(e.target.checked)}
                  className="w-4 h-4"
                />
                This is the control
              </label>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-zinc-400">Cancel</Button>
          <Button
            onClick={() => createVariant.mutate({ testId, name, isControl, weight, headline, ctaText })}
            disabled={!name || createVariant.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {createVariant.isPending ? "Adding…" : "Add Variant"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Test Detail ──────────────────────────────────────────────────────────────

function TestDetail({ testId, onBack }: { testId: number; onBack: () => void }) {
  const [showAddVariant, setShowAddVariant] = useState(false);
  const utils = trpc.useUtils();

  const { data: testData, isLoading: testLoading } = trpc.abTest.getTest.useQuery({ testId });
  const { data: results, isLoading: resultsLoading } = trpc.abTest.getResults.useQuery({ testId });

  const updateStatus = trpc.abTest.updateTestStatus.useMutation({
    onSuccess: () => {
      utils.abTest.getTest.invalidate({ testId });
      utils.abTest.getResults.invalidate({ testId });
      utils.abTest.listTests.invalidate();
      toast.success("Status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const promoteWinner = trpc.abTest.promoteWinner.useMutation({
    onSuccess: () => {
      utils.abTest.getResults.invalidate({ testId });
      utils.abTest.listTests.invalidate();
      toast.success("Winner promoted — test concluded");
    },
    onError: (e) => toast.error(e.message),
  });

  if (testLoading) return <div className="text-zinc-400 p-8">Loading…</div>;
  if (!testData) return <div className="text-zinc-400 p-8">Test not found</div>;

  const { test, variants } = testData;
  const stats: VariantStats[] = results?.stats ?? [];
  const significance: SignificanceResult[] = results?.significance ?? [];

  const getStatForVariant = (id: number) => stats.find((s) => s.variantId === id);
  const getSigForVariant = (id: number) => significance.find((s) => s.treatmentId === id);

  return (
    <div className="space-y-6">
      {showAddVariant && (
        <AddVariantModal testId={testId} onClose={() => setShowAddVariant(false)} />
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} className="text-zinc-400 px-2">
          ← Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">{test.name}</h2>
            {statusBadge(test.status as TestStatus)}
          </div>
          {test.pageUrl && (
            <p className="text-xs text-zinc-500 mt-0.5">{test.pageUrl}</p>
          )}
        </div>
        <div className="flex gap-2">
          {test.status === "draft" && (
            <Button
              size="sm"
              onClick={() => updateStatus.mutate({ testId, status: "running" })}
              disabled={variants.length < 2 || updateStatus.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-3 h-3 mr-1" /> Start Test
            </Button>
          )}
          {test.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateStatus.mutate({ testId, status: "paused" })}
              disabled={updateStatus.isPending}
              className="border-zinc-600 text-zinc-300"
            >
              <Pause className="w-3 h-3 mr-1" /> Pause
            </Button>
          )}
          {test.status === "paused" && (
            <Button
              size="sm"
              onClick={() => updateStatus.mutate({ testId, status: "running" })}
              disabled={updateStatus.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Play className="w-3 h-3 mr-1" /> Resume
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddVariant(true)}
            className="border-zinc-600 text-zinc-300"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Variant
          </Button>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Exposures</p>
          <p className="text-2xl font-bold text-white">
            {stats.reduce((a, s) => a + s.exposures, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <p className="text-xs text-zinc-400 mb-1">Total Conversions</p>
          <p className="text-2xl font-bold text-white">
            {stats.reduce((a, s) => a + s.conversions, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <p className="text-xs text-zinc-400 mb-1">Min Exposures Required</p>
          <p className="text-2xl font-bold text-white">{test.minExposures.toLocaleString()}</p>
          <p className="text-xs text-zinc-500">per variant</p>
        </div>
      </div>

      {/* Variant results */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Variants</h3>
        {variants.length === 0 && (
          <div className="text-zinc-500 text-sm py-4 text-center border border-dashed border-zinc-700 rounded-lg">
            No variants yet — add at least 2 to start the test
          </div>
        )}
        {variants.map((v: AbVariant) => {
          const stat = getStatForVariant(v.id);
          const sig = getSigForVariant(v.id);
          const isWinner = test.winnerVariantId === v.id;
          const minMet = (stat?.exposures ?? 0) >= test.minExposures;

          return (
            <div
              key={v.id}
              className={`bg-zinc-800/50 border rounded-xl p-4 ${
                isWinner
                  ? "border-emerald-500"
                  : v.isControl
                  ? "border-zinc-600"
                  : "border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{v.name}</span>
                    {v.isControl && (
                      <Badge className="bg-zinc-700 text-zinc-300 text-xs">Control</Badge>
                    )}
                    {isWinner && (
                      <Badge className="bg-emerald-700 text-emerald-100 text-xs flex items-center gap-1">
                        <Trophy className="w-3 h-3" /> Winner
                      </Badge>
                    )}
                  </div>
                  {v.headline && (
                    <p className="text-sm text-zinc-400 mt-1 italic">"{v.headline}"</p>
                  )}
                  {v.ctaText && (
                    <p className="text-xs text-zinc-500 mt-0.5">CTA: {v.ctaText}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Traffic weight</p>
                  <p className="text-sm font-medium text-zinc-300">{v.weight}%</p>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Users className="w-3 h-3" /> Exposures
                  </p>
                  <p className={`text-sm font-semibold ${minMet ? "text-white" : "text-zinc-400"}`}>
                    {(stat?.exposures ?? 0).toLocaleString()}
                    {!minMet && (
                      <span className="text-xs text-zinc-500 ml-1">
                        / {test.minExposures}
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conversions
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {(stat?.conversions ?? 0).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <Percent className="w-3 h-3" /> Conv. Rate
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {stat ? (stat.conversionRate * 100).toFixed(2) : "0.00"}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Rev / Exposure
                  </p>
                  <p className="text-sm font-semibold text-white">
                    ${stat ? (stat.revenuePerExposure / 100).toFixed(2) : "0.00"}
                  </p>
                </div>
              </div>

              {/* Significance row (treatments only) */}
              {!v.isControl && sig && (
                <div className="flex items-center justify-between border-t border-zinc-700 pt-3">
                  <div className="flex items-center gap-4">
                    {confidenceBadge(sig)}
                    {sig.hasEnoughData && (
                      <span className="text-xs text-zinc-400">
                        Lift: {sig.relativeLift >= 0 ? "+" : ""}
                        {sig.relativeLift.toFixed(1)}%
                      </span>
                    )}
                  </div>
                  {sig.isSignificant && !isWinner && test.status !== "concluded" && (
                    <Button
                      size="sm"
                      onClick={() => promoteWinner.mutate({ testId, variantId: v.id })}
                      disabled={promoteWinner.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      <Trophy className="w-3 h-3 mr-1" /> Promote Winner
                    </Button>
                  )}
                </div>
              )}

              {/* Progress bar toward min exposures */}
              {!minMet && (
                <div className="mt-3">
                  <div className="w-full bg-zinc-700 rounded-full h-1.5">
                    <div
                      className="bg-violet-500 h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((stat?.exposures ?? 0) / test.minExposures) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    {Math.round(((stat?.exposures ?? 0) / test.minExposures) * 100)}% to minimum
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Integration snippet */}
      <div className="bg-zinc-800/30 border border-zinc-700 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Integration Snippet</h3>
        <p className="text-xs text-zinc-500 mb-2">
          Call this from your landing page to get the sticky variant assignment:
        </p>
        <pre className="text-xs text-emerald-400 bg-zinc-900 rounded p-3 overflow-x-auto">
{`// On page load — pass a stable visitor ID (from cookie)
const result = await trpc.abTest.assignVariant.mutate({
  testId: ${testId},
  visitorId: getVisitorId(), // stable cookie-based ID
  utmSource: new URLSearchParams(location.search).get('utm_source') ?? undefined,
});
// result.headline, result.ctaText, result.isControl

// On purchase / email capture:
await trpc.abTest.recordConversion.mutate({
  testId: ${testId},
  visitorId: getVisitorId(),
  conversionType: 'purchase',
  revenueCents: orderTotalCents,
});`}
        </pre>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AbTests() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: tests, isLoading } = trpc.abTest.listTests.useQuery();

  if (selectedTestId !== null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white p-6">
        <TestDetail
          testId={selectedTestId}
          onBack={() => setSelectedTestId(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {showCreate && (
        <CreateTestModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            utils.abTest.listTests.invalidate();
            setSelectedTestId(id);
          }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <FlaskConical className="w-6 h-6 text-violet-400" />
            <h1 className="text-2xl font-bold">A/B Tests</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Two-proportion z-test engine · 300-exposure minimum · Auto-promote on significance
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" /> New Test
        </Button>
      </div>

      {/* Test list */}
      {isLoading ? (
        <div className="text-zinc-400">Loading…</div>
      ) : !tests || tests.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-700 rounded-xl">
          <FlaskConical className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 mb-2">No tests yet</p>
          <p className="text-zinc-600 text-sm mb-4">
            Create your first test to start optimizing your landing pages
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" /> Create First Test
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(tests as AbTest[]).map((test) => (
            <button
              key={test.id}
              onClick={() => setSelectedTestId(test.id)}
              className="w-full text-left bg-zinc-800/50 border border-zinc-700 hover:border-zinc-500 rounded-xl p-4 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart2 className="w-5 h-5 text-violet-400 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{test.name}</span>
                      {statusBadge(test.status as TestStatus)}
                      {test.winnerVariantId && (
                        <Badge className="bg-emerald-700 text-emerald-100 text-xs flex items-center gap-1">
                          <Trophy className="w-3 h-3" /> Winner found
                        </Badge>
                      )}
                    </div>
                    {test.pageUrl && (
                      <p className="text-xs text-zinc-500 mt-0.5">{test.pageUrl}</p>
                    )}
                    {test.description && (
                      <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{test.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <p className="text-xs text-zinc-500">Significance target</p>
                    <p className="text-sm font-medium text-zinc-300">
                      {(Number(test.significanceThreshold) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500">Min exposures</p>
                    <p className="text-sm font-medium text-zinc-300">{test.minExposures}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
