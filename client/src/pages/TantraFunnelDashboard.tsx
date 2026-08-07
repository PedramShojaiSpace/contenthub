import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArrowDown, Users, Mail, ShoppingCart, TrendingDown } from "lucide-react";

function pct(num: number, den: number) {
  if (!den) return "—";
  return ((num / den) * 100).toFixed(1) + "%";
}

function FunnelStep({
  label,
  value,
  total,
  color,
  sublabel,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  sublabel?: string;
}) {
  const rate = total ? (value / total) * 100 : 0;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white/60 text-sm font-medium uppercase tracking-wider">{label}</span>
        <span className="text-2xl font-bold text-white">{value.toLocaleString()}</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2 mb-2">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${Math.min(rate, 100)}%`, background: color }}
        />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{sublabel ?? `${pct(value, total)} of started`}</span>
        <span style={{ color }} className="font-semibold">{pct(value, total)}</span>
      </div>
    </div>
  );
}

export default function TantraFunnelDashboard() {
  const { isAuthenticated, loading } = useAuth();
  const { data, isLoading, refetch } = trpc.tantraQuiz.getFunnelStats.useQuery(undefined, {
    refetchInterval: 60_000,
    enabled: isAuthenticated,
  });

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="text-white/40">Loading…</div></div>;
  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const t = data?.totals;
  const started = Number(t?.started ?? 0);
  const completed = Number(t?.completed ?? 0);
  const emailCaptured = Number(t?.emailCaptured ?? 0);
  const kajabiTagged = Number(t?.kajabiTagged ?? 0);
  const tantraHim = Number(t?.tantraHim ?? 0);
  const tantraHer = Number(t?.tantraHer ?? 0);
  const gutFlag = Number(t?.gutFlag ?? 0);
  const sleepFlag = Number(t?.sleepFlag ?? 0);
  const oralFlag = Number(t?.oralFlag ?? 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tantra Quiz Funnel</h1>
          <p className="text-white/40 text-sm mt-1">Click → Start → Complete → Email → Purchase</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:text-white/70 transition-colors"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-center py-20">Loading stats…</div>
      ) : (
        <>
          {/* Funnel Steps */}
          <div className="grid grid-cols-1 gap-3 mb-8">
            <FunnelStep label="Quiz Started" value={started} total={started} color="#6366f1" sublabel="All sessions" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Quiz Completed" value={completed} total={started} color="#8b5cf6" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Email Captured" value={emailCaptured} total={started} color="#a78bfa" />
            <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-white/20" /></div>
            <FunnelStep label="Kajabi Tagged (in sequence)" value={kajabiTagged} total={started} color="#c4b5fd" />
          </div>

          {/* Split stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[#111] border border-white/10 rounded-xl p-5">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Recommendation Split</div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-3xl font-bold text-blue-400">{tantraHim}</div>
                  <div className="text-white/40 text-xs mt-1">Tantra Him</div>
                </div>
                <div className="text-white/20 text-2xl mb-1">vs</div>
                <div>
                  <div className="text-3xl font-bold text-purple-400">{tantraHer}</div>
                  <div className="text-white/40 text-xs mt-1">Tantra Her</div>
                </div>
              </div>
            </div>
            <div className="bg-[#111] border border-white/10 rounded-xl p-5">
              <div className="text-white/50 text-xs uppercase tracking-wider mb-3">Upsell Flags</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Gut Test</span>
                  <span className="text-amber-400 font-semibold">{gutFlag} ({pct(gutFlag, emailCaptured)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Sleep Test</span>
                  <span className="text-amber-400 font-semibold">{sleepFlag} ({pct(sleepFlag, emailCaptured)})</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Oral Test</span>
                  <span className="text-amber-400 font-semibold">{oralFlag} ({pct(oralFlag, emailCaptured)})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Drop-off summary */}
          <div className="bg-[#111] border border-amber-500/20 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 text-sm font-semibold uppercase tracking-wider">Drop-off Analysis</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-white/40 text-xs mb-1">Start → Complete</div>
                <div className="text-white font-bold">{pct(completed, started)}</div>
                <div className="text-red-400 text-xs">{(started - completed).toLocaleString()} dropped off</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Complete → Email</div>
                <div className="text-white font-bold">{pct(emailCaptured, completed)}</div>
                <div className="text-red-400 text-xs">{(completed - emailCaptured).toLocaleString()} dropped off</div>
              </div>
              <div>
                <div className="text-white/40 text-xs mb-1">Email → Tagged</div>
                <div className="text-white font-bold">{pct(kajabiTagged, emailCaptured)}</div>
                <div className="text-red-400 text-xs">{(emailCaptured - kajabiTagged).toLocaleString()} dropped off</div>
              </div>
            </div>
          </div>

          {/* Recent completions */}
          <div className="bg-[#111] border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-white/50" />
              <span className="text-white/50 text-sm font-semibold uppercase tracking-wider">Recent Completions</span>
            </div>
            {data?.recent?.length === 0 ? (
              <div className="text-white/30 text-sm text-center py-6">No completions yet — ads just launched</div>
            ) : (
              <div className="space-y-2">
                {data?.recent?.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <div className="text-white text-sm font-medium">{lead.name ?? "Anonymous"}</div>
                      <div className="text-white/40 text-xs">{lead.email}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-semibold ${lead.result === "tantra_him" ? "text-blue-400" : "text-purple-400"}`}>
                        {lead.result === "tantra_him" ? "Tantra Him" : lead.result === "tantra_her" ? "Tantra Her" : lead.result}
                      </div>
                      <div className="text-white/30 text-xs">
                        {lead.emailCapturedAt ? new Date(lead.emailCapturedAt).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
