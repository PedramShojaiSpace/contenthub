/**
 * YouTubePipeline.tsx - YouTube Operations Bible UI
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Flame, Plus, RefreshCw, Target, TrendingDown, TrendingUp,
  Tv2, Wand2, Youtube, Zap,
} from "lucide-react";

type Video = {
  id: number; title: string; videoId: string | null; pillar: string;
  primaryKeyword: string | null; status: string; publishDate: number | null;
  preTitleScore: number | null; preThumbnailScore: number | null;
  day7Ctr: number | null; day7Impressions: number | null; day7AvgViewPct: number | null;
  day7Diagnosis: string | null; day30BreakoutScore: number | null; day30Ctr: number | null;
  day30AvgViewPct: number | null; day30Impressions: number | null; day30SearchPct: number | null;
  day30Diagnosis: string | null; prescribedAction: string | null; actionApplied: boolean;
  notes: string | null; createdAt: number; updatedAt: number;
};

const PILLAR_LABELS: Record<string, string> = {
  gut_health_metabolism: "🦠 Gut & Metabolism",
  nervous_system_stress: "🧠 Nervous System",
  consciousness_longevity: "✨ Consciousness",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  scripting: { label: "Scripting", color: "bg-zinc-700 text-zinc-200" },
  qc_scoring: { label: "QC Scoring", color: "bg-yellow-900 text-yellow-200" },
  scheduled: { label: "Scheduled", color: "bg-blue-900 text-blue-200" },
  live: { label: "Live", color: "bg-green-900 text-green-200" },
  day7_review: { label: "Day 7 Review", color: "bg-orange-900 text-orange-200" },
  day30_review: { label: "Day 30 Review", color: "bg-purple-900 text-purple-200" },
  reviewed: { label: "Reviewed", color: "bg-zinc-800 text-zinc-400" },
};

const DIAGNOSIS_CONFIG: Record<string, { label: string; color: string }> = {
  thumbnail_title_problem: { label: "Thumbnail/Title Fix", color: "text-yellow-400" },
  hook_retention_problem: { label: "Hook/Retention Fix", color: "text-red-400" },
  discoverability_problem: { label: "Discoverability Fix", color: "text-blue-400" },
  marginal_underperformer: { label: "Archive & Move On", color: "text-zinc-400" },
  outperforming: { label: "Outperforming 🔥", color: "text-green-400" },
  on_track: { label: "On Track ✓", color: "text-emerald-400" },
  pending: { label: "Pending Review", color: "text-zinc-500" },
};

function DiagnosisBadge({ diagnosis }: { diagnosis: string | null }) {
  if (!diagnosis) return null;
  const cfg = DIAGNOSIS_CONFIG[diagnosis] ?? DIAGNOSIS_CONFIG.pending;
  return <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>;
}

function ScoreBadge({ score, label }: { score: number | null; label: string }) {
  if (score == null) return <span className="text-zinc-600 text-xs">—</span>;
  const color = score >= 80 ? "text-green-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  return <span className={`text-xs font-mono font-bold ${color}`}>{label}: {score}</span>;
}

function RecoveryDashboard() {
  const { data: health } = trpc.youtubePipeline.getChannelHealth.useQuery();
  const { data: queue } = trpc.youtubePipeline.getRecoveryQueue.useQuery();
  const utils = trpc.useUtils();
  const markApplied = trpc.youtubePipeline.update.useMutation({
    onSuccess: () => { utils.youtubePipeline.getRecoveryQueue.invalidate(); utils.youtubePipeline.getChannelHealth.invalidate(); toast.success("Action marked as applied"); },
  });

  const score = health?.recoveryScore ?? 50;
  const scoreColor = score >= 70 ? "text-green-400" : score >= 45 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#161b22] border border-zinc-800 rounded-xl p-5 flex flex-col items-center">
          <div className={`text-5xl font-bold ${scoreColor}`}>{score}</div>
          <div className="text-xs text-zinc-500 mt-1">Recovery Score</div>
          {health?.inDoghouse && <div className="mt-2 text-xs text-red-400 font-medium flex items-center gap-1"><AlertTriangle size={12}/> In the doghouse</div>}
        </div>
        <div className="bg-[#161b22] border border-zinc-800 rounded-xl p-5">
          <div className="text-3xl font-bold text-white">{health?.live ?? 0}</div>
          <div className="text-xs text-zinc-500 mt-1">Live / In Review</div>
        </div>
        <div className="bg-[#161b22] border border-zinc-800 rounded-xl p-5">
          <div className={`text-3xl font-bold ${(health?.avgDay7Ctr ?? 0) >= 2 ? "text-green-400" : "text-red-400"}`}>{health?.avgDay7Ctr?.toFixed(1) ?? "—"}%</div>
          <div className="text-xs text-zinc-500 mt-1">Avg Day 7 CTR</div>
          <div className="text-xs text-zinc-600 mt-1">Target: ≥ 2.0%</div>
        </div>
        <div className="bg-[#161b22] border border-zinc-800 rounded-xl p-5">
          <div className={`text-3xl font-bold ${(health?.avgDay7Retention ?? 0) >= 25 ? "text-green-400" : "text-red-400"}`}>{health?.avgDay7Retention ?? "—"}%</div>
          <div className="text-xs text-zinc-500 mt-1">Avg Day 7 Retention</div>
          <div className="text-xs text-zinc-600 mt-1">Target: ≥ 25%</div>
        </div>
      </div>

      {health?.inDoghouse && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-red-400"/><span className="text-red-300 font-semibold text-sm">Algorithm Recovery Protocol Active</span></div>
          <ol className="list-decimal list-inside space-y-1 text-zinc-400 text-xs ml-2">
            <li><strong className="text-zinc-300">Fix all videos in the recovery queue</strong> — one action per video, no simultaneous changes</li>
            <li><strong className="text-zinc-300">Publish 2 videos per week minimum</strong> — consistency signals health to the algorithm</li>
            <li><strong className="text-zinc-300">Use the Hook Scorer</strong> on every new video — target ≥ 75/100</li>
            <li><strong className="text-zinc-300">Title must name a specific health condition</strong> — never abstract ("wellness", "health journey")</li>
            <li><strong className="text-zinc-300">Thumbnail must show a human face with clear emotion</strong> — no text-only thumbnails</li>
            <li><strong className="text-zinc-300">Respond to every comment in the first 24 hours</strong> — engagement signals boost distribution</li>
          </ol>
        </div>
      )}

      {queue && queue.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2"><Flame size={14} className="text-orange-400"/>Recovery Queue ({queue.length})</h3>
          <div className="space-y-3">
            {(queue as Video[]).map((v) => (
              <div key={v.id} className="bg-[#161b22] border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{v.title}</div>
                    <div className="mt-1 flex items-center gap-3 flex-wrap">
                      <DiagnosisBadge diagnosis={v.day7Diagnosis}/>
                      {v.day7Ctr != null && <span className="text-xs text-zinc-500">CTR: {v.day7Ctr.toFixed(1)}%</span>}
                      {v.day7AvgViewPct != null && <span className="text-xs text-zinc-500">Retention: {v.day7AvgViewPct.toFixed(0)}%</span>}
                    </div>
                    {v.prescribedAction && (
                      <div className="mt-2 text-xs text-zinc-400 bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                        <span className="text-zinc-300 font-medium">Action: </span>{v.prescribedAction}
                      </div>
                    )}
                  </div>
                  <button onClick={() => markApplied.mutate({ id: v.id, actionApplied: true })} className="shrink-0 text-xs bg-green-900/50 hover:bg-green-800/50 text-green-300 border border-green-800 rounded-lg px-3 py-1.5 transition-colors">Mark Applied</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-zinc-800 rounded-xl p-6 text-center">
          <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2"/>
          <div className="text-zinc-300 text-sm font-medium">Recovery queue is clear</div>
          <div className="text-zinc-600 text-xs mt-1">All active videos are on track or have been addressed</div>
        </div>
      )}
    </div>
  );
}

function PipelineTable() {
  const { data: videos, isLoading } = trpc.youtubePipeline.list.useQuery();
  const utils = trpc.useUtils();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [day7Form, setDay7Form] = useState<Record<number, { ctr: string; impressions: string; avgViewPct: string }>>({});
  const [day30Form, setDay30Form] = useState<Record<number, { breakoutScore: string; ctr: string; avgViewPct: string; impressions: string; searchPct: string }>>({});

  const diagnoseDay7 = trpc.youtubePipeline.diagnoseDay7.useMutation({
    onSuccess: (data) => { utils.youtubePipeline.list.invalidate(); utils.youtubePipeline.getChannelHealth.invalidate(); utils.youtubePipeline.getRecoveryQueue.invalidate(); toast.success(`Day 7: ${DIAGNOSIS_CONFIG[data.diagnosis]?.label ?? data.diagnosis}`); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const diagnoseDay30 = trpc.youtubePipeline.diagnoseDay30.useMutation({
    onSuccess: (data) => { utils.youtubePipeline.list.invalidate(); utils.youtubePipeline.getChannelHealth.invalidate(); utils.youtubePipeline.getRecoveryQueue.invalidate(); toast.success(`Day 30: ${DIAGNOSIS_CONFIG[data.diagnosis]?.label ?? data.diagnosis}`); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const deleteVideo = trpc.youtubePipeline.delete.useMutation({
    onSuccess: () => { utils.youtubePipeline.list.invalidate(); toast.success("Removed"); },
  });

  if (isLoading) return <div className="text-zinc-500 text-sm p-8">Loading...</div>;
  if (!videos || videos.length === 0) return (
    <div className="text-center py-16">
      <Tv2 size={32} className="text-zinc-700 mx-auto mb-3"/>
      <div className="text-zinc-400 text-sm">No videos in pipeline yet</div>
      <div className="text-zinc-600 text-xs mt-1">Add your first video using the "Add Video" tab</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {(videos as Video[]).map((v) => {
        const isExpanded = expandedId === v.id;
        const statusCfg = STATUS_LABELS[v.status] ?? { label: v.status, color: "bg-zinc-800 text-zinc-400" };
        const d7 = day7Form[v.id] ?? { ctr: "", impressions: "", avgViewPct: "" };
        const d30 = day30Form[v.id] ?? { breakoutScore: "", ctr: "", avgViewPct: "", impressions: "", searchPct: "" };
        return (
          <div key={v.id} className="bg-[#161b22] border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-zinc-900/50 transition-colors" onClick={() => setExpandedId(isExpanded ? null : v.id)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate max-w-xs">{v.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-zinc-500">{PILLAR_LABELS[v.pillar] ?? v.pillar}</span>
                  <ScoreBadge score={v.preTitleScore} label="Title"/>
                  <ScoreBadge score={v.preThumbnailScore} label="Thumb"/>
                  {v.day7Diagnosis && v.day7Diagnosis !== "pending" && <DiagnosisBadge diagnosis={v.day7Diagnosis}/>}
                </div>
              </div>
              {isExpanded ? <ChevronUp size={16} className="text-zinc-500 shrink-0"/> : <ChevronDown size={16} className="text-zinc-500 shrink-0"/>}
            </div>
            {isExpanded && (
              <div className="border-t border-zinc-800 p-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Day 7 Metrics</div>
                  {v.day7Ctr != null ? (
                    <div className="flex gap-4 text-sm flex-wrap">
                      <span className="text-zinc-400">CTR: <span className="text-white">{v.day7Ctr.toFixed(1)}%</span></span>
                      <span className="text-zinc-400">Impressions: <span className="text-white">{v.day7Impressions?.toLocaleString()}</span></span>
                      <span className="text-zinc-400">Retention: <span className="text-white">{v.day7AvgViewPct?.toFixed(0)}%</span></span>
                      {v.day7Diagnosis && <DiagnosisBadge diagnosis={v.day7Diagnosis}/>}
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <input type="number" placeholder="CTR %" step="0.1" value={d7.ctr} onChange={(e) => setDay7Form((f) => ({ ...f, [v.id]: { ...d7, ctr: e.target.value } }))} className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                      <input type="number" placeholder="Impressions" value={d7.impressions} onChange={(e) => setDay7Form((f) => ({ ...f, [v.id]: { ...d7, impressions: e.target.value } }))} className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                      <input type="number" placeholder="Avg View %" step="0.1" value={d7.avgViewPct} onChange={(e) => setDay7Form((f) => ({ ...f, [v.id]: { ...d7, avgViewPct: e.target.value } }))} className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                      <button onClick={() => { if (!d7.ctr || !d7.impressions || !d7.avgViewPct) { toast.error("Fill in all Day 7 metrics"); return; } diagnoseDay7.mutate({ id: v.id, ctr: parseFloat(d7.ctr), impressions: parseInt(d7.impressions), avgViewPct: parseFloat(d7.avgViewPct) }); }} disabled={diagnoseDay7.isPending} className="bg-orange-900/50 hover:bg-orange-800/50 text-orange-300 border border-orange-800 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50">{diagnoseDay7.isPending ? "Diagnosing..." : "Run Day 7 Diagnosis"}</button>
                    </div>
                  )}
                  {v.prescribedAction && v.day7Diagnosis !== "on_track" && v.day7Diagnosis !== "outperforming" && (
                    <div className="mt-2 text-xs text-zinc-400 bg-zinc-900 rounded-lg p-3 border border-zinc-800"><span className="text-zinc-300 font-medium">Prescribed action: </span>{v.prescribedAction}</div>
                  )}
                </div>

                {v.day7Ctr != null && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Day 30 Metrics</div>
                    {v.day30BreakoutScore != null ? (
                      <div className="flex gap-4 text-sm flex-wrap">
                        <span className="text-zinc-400">Breakout: <span className="text-white">{v.day30BreakoutScore.toFixed(1)}x</span></span>
                        <span className="text-zinc-400">CTR: <span className="text-white">{v.day30Ctr?.toFixed(1)}%</span></span>
                        <span className="text-zinc-400">Retention: <span className="text-white">{v.day30AvgViewPct?.toFixed(0)}%</span></span>
                        <DiagnosisBadge diagnosis={v.day30Diagnosis}/>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <input type="number" placeholder="Breakout (x)" step="0.1" value={d30.breakoutScore} onChange={(e) => setDay30Form((f) => ({ ...f, [v.id]: { ...d30, breakoutScore: e.target.value } }))} className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                        <input type="number" placeholder="CTR %" step="0.1" value={d30.ctr} onChange={(e) => setDay30Form((f) => ({ ...f, [v.id]: { ...d30, ctr: e.target.value } }))} className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                        <input type="number" placeholder="Avg View %" step="0.1" value={d30.avgViewPct} onChange={(e) => setDay30Form((f) => ({ ...f, [v.id]: { ...d30, avgViewPct: e.target.value } }))} className="w-28 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                        <input type="number" placeholder="Impressions" value={d30.impressions} onChange={(e) => setDay30Form((f) => ({ ...f, [v.id]: { ...d30, impressions: e.target.value } }))} className="w-32 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                        <input type="number" placeholder="Search %" step="0.1" value={d30.searchPct} onChange={(e) => setDay30Form((f) => ({ ...f, [v.id]: { ...d30, searchPct: e.target.value } }))} className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
                        <button onClick={() => { if (!d30.breakoutScore || !d30.ctr || !d30.avgViewPct || !d30.impressions || !d30.searchPct) { toast.error("Fill in all Day 30 metrics"); return; } diagnoseDay30.mutate({ id: v.id, breakoutScore: parseFloat(d30.breakoutScore), ctr: parseFloat(d30.ctr), avgViewPct: parseFloat(d30.avgViewPct), impressions: parseInt(d30.impressions), searchPct: parseFloat(d30.searchPct) }); }} disabled={diagnoseDay30.isPending} className="bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 border border-purple-800 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50">{diagnoseDay30.isPending ? "Diagnosing..." : "Run Day 30 Diagnosis"}</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <button onClick={() => { if (confirm(`Remove "${v.title}"?`)) deleteVideo.mutate({ id: v.id }); }} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">Remove from pipeline</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AddVideoForm() {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<"gut_health_metabolism" | "nervous_system_stress" | "consciousness_longevity">("gut_health_metabolism");
  const [keyword, setKeyword] = useState("");
  const [titleScore, setTitleScore] = useState<{ score: number; feedback: string; rewrite: string | null } | null>(null);

  const create = trpc.youtubePipeline.create.useMutation({
    onSuccess: () => { utils.youtubePipeline.list.invalidate(); utils.youtubePipeline.getChannelHealth.invalidate(); setTitle(""); setKeyword(""); setTitleScore(null); toast.success("Video added to pipeline"); },
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });

  const scoreTitle = trpc.youtubePipeline.scoreTitle.useMutation({
    onSuccess: (data) => setTitleScore(data),
    onError: (e) => toast.error(`Scoring failed: ${e.message}`),
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Video Title</label>
        <div className="flex gap-2">
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); setTitleScore(null); }} placeholder="e.g., The Hidden Gut Bacteria Causing Your Brain Fog" className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
          <button onClick={() => { if (title.trim()) scoreTitle.mutate({ title: title.trim() }); }} disabled={!title.trim() || scoreTitle.isPending} className="shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl px-4 py-3 text-xs font-medium transition-colors disabled:opacity-50">{scoreTitle.isPending ? "Scoring..." : "Score Title"}</button>
        </div>
        {titleScore && (
          <div className={`mt-3 p-4 rounded-xl border ${titleScore.score >= 80 ? "bg-green-950/30 border-green-900/50" : titleScore.score >= 60 ? "bg-yellow-950/30 border-yellow-900/50" : "bg-red-950/30 border-red-900/50"}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-2xl font-bold ${titleScore.score >= 80 ? "text-green-400" : titleScore.score >= 60 ? "text-yellow-400" : "text-red-400"}`}>{titleScore.score}/100</span>
              <span className={`text-xs font-medium ${titleScore.score >= 80 ? "text-green-400" : titleScore.score >= 60 ? "text-yellow-400" : "text-red-400"}`}>{titleScore.score >= 80 ? "✓ PASS" : titleScore.score >= 60 ? "⚠ NEEDS WORK" : "✗ FAIL"}</span>
            </div>
            <p className="text-xs text-zinc-400">{titleScore.feedback}</p>
            {titleScore.rewrite && (
              <div className="mt-2">
                <div className="text-xs text-zinc-500 mb-1">Suggested rewrite:</div>
                <button onClick={() => setTitle(titleScore.rewrite!)} className="text-xs text-blue-400 hover:text-blue-300 text-left transition-colors">"{titleScore.rewrite}" <span className="text-zinc-600">(click to use)</span></button>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Content Pillar</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(PILLAR_LABELS) as [typeof pillar, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPillar(key)} className={`p-3 rounded-xl border text-xs font-medium transition-colors text-left ${pillar === key ? "bg-blue-900/40 border-blue-700 text-blue-300" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Primary Keyword (optional)</label>
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g., gut bacteria brain fog" className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
      </div>
      <button onClick={() => { if (!title.trim()) { toast.error("Enter a title"); return; } create.mutate({ title: title.trim(), pillar, primaryKeyword: keyword.trim() || undefined }); }} disabled={create.isPending || !title.trim()} className="w-full bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        <Plus size={16}/>{create.isPending ? "Adding..." : "Add to Pipeline"}
      </button>
    </div>
  );
}

function HookScorer() {
  const [hookText, setHookText] = useState("");
  const [result, setResult] = useState<{ score: number; verdict: string; issues: string[]; rewrite: string | null } | null>(null);
  const scoreHook = trpc.youtubePipeline.scoreHook.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400 space-y-1">
        <div className="text-zinc-300 font-semibold mb-2">Operations Bible: Hook Rules</div>
        <div>✓ Name a specific health condition in the FIRST sentence</div>
        <div>✓ Create a knowledge gap — viewer MUST watch to get the answer</div>
        <div>✓ Under 80 words / 35 seconds when spoken</div>
        <div>✓ End with a natural handoff line</div>
        <div>✗ NEVER start with "Today we're going to..."</div>
        <div>✗ NEVER use abstract language ("explore", "find balance")</div>
        <div>✗ NEVER summarize the video</div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Your Cold Open / Hook Script</label>
        <textarea value={hookText} onChange={(e) => { setHookText(e.target.value); setResult(null); }} placeholder="Paste your cold open script here..." rows={6} className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"/>
        <div className="flex justify-between mt-1"><span className="text-xs text-zinc-600">{hookText.split(/\s+/).filter(Boolean).length} words</span><span className="text-xs text-zinc-600">Target: ≤ 80 words</span></div>
      </div>
      <button onClick={() => { if (hookText.trim()) scoreHook.mutate({ hookScript: hookText.trim() }); }} disabled={!hookText.trim() || scoreHook.isPending} className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50">{scoreHook.isPending ? "Analyzing hook..." : "Score Hook Strength"}</button>
      {result && (
        <div className={`p-5 rounded-xl border ${result.score >= 75 ? "bg-green-950/30 border-green-900/50" : result.score >= 55 ? "bg-yellow-950/30 border-yellow-900/50" : "bg-red-950/30 border-red-900/50"}`}>
          <div className="flex items-center gap-4 mb-3">
            <span className={`text-4xl font-bold ${result.score >= 75 ? "text-green-400" : result.score >= 55 ? "text-yellow-400" : "text-red-400"}`}>{result.score}</span>
            <div><div className={`text-sm font-bold ${result.score >= 75 ? "text-green-400" : result.score >= 55 ? "text-yellow-400" : "text-red-400"}`}>{result.verdict}</div><div className="text-xs text-zinc-500">Hook Strength Score</div></div>
          </div>
          {result.issues.length > 0 && <ul className="mb-3 space-y-1">{result.issues.map((issue, i) => <li key={i} className="text-xs text-red-400">• {issue}</li>)}</ul>}
          {result.rewrite && (
            <div>
              <div className="text-xs font-semibold text-zinc-400 mb-1">Improved version:</div>
              <div className="text-sm text-zinc-300 bg-zinc-900 rounded-lg p-3 border border-zinc-800">{result.rewrite}</div>
              <button onClick={() => setHookText(result.rewrite!)} className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">Use this version →</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ColdOpenGenerator() {
  const [videoTitle, setVideoTitle] = useState("");
  const [pillar, setPillar] = useState<"gut_health_metabolism" | "nervous_system_stress" | "consciousness_longevity">("gut_health_metabolism");
  const [keyword, setKeyword] = useState("");
  const [isRetentionFix, setIsRetentionFix] = useState(false);
  const [script, setScript] = useState<string | null>(null);
  const generate = trpc.youtubePipeline.generateColdOpen.useMutation({
    onSuccess: (data) => setScript(data.script),
    onError: (e) => toast.error(`Failed: ${e.message}`),
  });
  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-400">
        <div className="text-zinc-300 font-semibold mb-1">AI Cold Open Generator</div>
        Generates a hook script following all Operations Bible rules. Toggle "Retention Fix Mode" for a more aggressive, curiosity-driven cold open for underperforming videos.
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Video Title</label>
        <input type="text" value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g., The Hidden Gut Bacteria Causing Your Brain Fog" className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Content Pillar</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(PILLAR_LABELS) as [typeof pillar, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setPillar(key)} className={`p-3 rounded-xl border text-xs font-medium transition-colors text-left ${pillar === key ? "bg-blue-900/40 border-blue-700 text-blue-300" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Primary Keyword (optional)</label>
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="e.g., gut bacteria brain fog" className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"/>
      </div>
      <label className="flex items-center gap-3 cursor-pointer">
        <div onClick={() => setIsRetentionFix(!isRetentionFix)} className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${isRetentionFix ? "bg-red-600" : "bg-zinc-700"}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isRetentionFix ? "translate-x-5" : "translate-x-0.5"}`}/>
        </div>
        <span className="text-sm text-zinc-300">Retention Fix Mode</span>
        <span className="text-xs text-zinc-600">(more aggressive hook)</span>
      </label>
      <button onClick={() => { if (!videoTitle.trim()) { toast.error("Enter a video title"); return; } generate.mutate({ videoTitle: videoTitle.trim(), pillar, primaryKeyword: keyword.trim() || undefined, isRetentionFix }); }} disabled={!videoTitle.trim() || generate.isPending} className="w-full bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 rounded-xl py-3 text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        <Wand2 size={16}/>{generate.isPending ? "Generating cold open..." : "Generate Cold Open Script"}
      </button>
      {script && (
        <div className="bg-[#161b22] border border-zinc-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Generated Cold Open</div>
            <button onClick={() => { navigator.clipboard.writeText(script); toast.success("Copied!"); }} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Copy</button>
          </div>
          <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{script}</div>
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-600">
            <span>{script.split(/\s+/).filter(Boolean).length} words</span>
            <span>~{Math.round(script.split(/\s+/).filter(Boolean).length / 2.3)}s spoken</span>
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = "recovery" | "pipeline" | "add" | "hook" | "coldopen";

export default function YouTubePipeline() {
  const [tab, setTab] = useState<Tab>("recovery");
  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "recovery", label: "Recovery Dashboard", icon: <AlertTriangle size={14}/> },
    { id: "pipeline", label: "Pipeline", icon: <Tv2 size={14}/> },
    { id: "add", label: "Add Video", icon: <Plus size={14}/> },
    { id: "hook", label: "Hook Scorer", icon: <Zap size={14}/> },
    { id: "coldopen", label: "Cold Open Generator", icon: <Wand2 size={14}/> },
  ];
  return (
    <div className="w-full min-h-screen bg-[#0d1117] text-gray-100 overflow-x-hidden">
      <div className="bg-[#0d1117]/90 backdrop-blur sticky top-0 z-10 border-b border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Youtube size={20} className="text-red-500"/>
          <div>
            <h1 className="text-lg font-bold text-white">YouTube Pipeline</h1>
            <p className="text-xs text-zinc-500">Operations Bible — Algorithm Recovery & Content QC</p>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-[#00d4ff] text-[#00d4ff]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8">
        {tab === "recovery" && <RecoveryDashboard/>}
        {tab === "pipeline" && <PipelineTable/>}
        {tab === "add" && <AddVideoForm/>}
        {tab === "hook" && <HookScorer/>}
        {tab === "coldopen" && <ColdOpenGenerator/>}
      </div>
    </div>
  );
}
