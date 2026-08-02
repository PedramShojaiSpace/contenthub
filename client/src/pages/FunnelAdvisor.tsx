import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Target,
  Zap,
  RefreshCw,
  HelpCircle,
  ArrowRight,
  Activity,
} from "lucide-react";

type DatePreset = "today" | "yesterday" | "last_7d" | "last_14d" | "last_30d" | "this_month";
type StepStatus = "green" | "yellow" | "red" | "no_data";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7d", label: "7 Days" },
  { value: "last_14d", label: "14 Days" },
  { value: "this_month", label: "MTD" },
  { value: "last_30d", label: "30 Days" },
];

const STATUS_CONFIG: Record<StepStatus, { icon: React.ElementType; color: string; bg: string; border: string; label: string }> = {
  green:   { icon: CheckCircle2,   color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200", label: "On Track"  },
  yellow:  { icon: AlertTriangle,  color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-200",   label: "Watch"     },
  red:     { icon: XCircle,        color: "text-red-600",     bg: "bg-red-50",      border: "border-red-200",     label: "Fix First" },
  no_data: { icon: HelpCircle,     color: "text-stone-400",   bg: "bg-stone-50",    border: "border-stone-200",   label: "No Data"   },
};

const HEALTH_CONFIG = {
  critical:   { label: "Critical",   color: "text-red-700",     bg: "bg-red-100",     icon: XCircle        },
  needs_work: { label: "Needs Work", color: "text-amber-700",   bg: "bg-amber-100",   icon: AlertTriangle  },
  on_track:   { label: "On Track",   color: "text-emerald-700", bg: "bg-emerald-100", icon: TrendingUp     },
  scaling:    { label: "Scaling",    color: "text-sky-700",     bg: "bg-sky-100",     icon: Zap            },
};

function formatValue(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "$") return `$${value.toFixed(2)}`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  return value.toFixed(1);
}

export default function FunnelAdvisor() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_7d");

  const { data, isLoading, refetch, isFetching } = trpc.funnelAdvisor.getAnalysis.useQuery(
    { datePreset },
    { refetchInterval: 10 * 60 * 1000, staleTime: 5 * 60 * 1000 }
  );

  const health = data ? HEALTH_CONFIG[data.overallHealth] : null;
  const HealthIcon = health?.icon ?? Activity;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Funnel Optimization Advisor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live step-by-step analysis with your #1 action to take today
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {DATE_PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                datePreset === p.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {p.label}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="ml-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" />
          Analyzing funnel data…
        </div>
      )}

      {data && (
        <>
          {/* Overall Health Banner */}
          <div className={`rounded-xl border p-4 flex items-center gap-4 ${health?.bg} border-transparent`}>
            <HealthIcon className={`w-8 h-8 flex-shrink-0 ${health?.color}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${health?.color}`}>
                  Funnel Health: {health?.label}
                </span>
                <Badge variant="outline" className="text-xs">
                  {new Date(data.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.overallHealth === "critical" && "Multiple funnel steps need immediate attention. Focus on the #1 action below."}
                {data.overallHealth === "needs_work" && "One step is dragging down your ROAS. Fix it and you'll see a significant lift."}
                {data.overallHealth === "on_track" && "Funnel is performing within range. Optimize the yellow steps to push toward scaling."}
                {data.overallHealth === "scaling" && "Funnel is healthy across all steps. Increase ad spend and monitor frequency."}
              </p>
            </div>
          </div>

          {/* #1 Action Card */}
          {data.topAction && (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-primary-foreground font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground text-base">Today's #1 Action</span>
                    <Badge
                      className={`text-xs ${
                        data.topAction.status === "red"
                          ? "bg-red-100 text-red-700 border-red-200"
                          : data.topAction.status === "yellow"
                          ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-emerald-100 text-emerald-700 border-emerald-200"
                      }`}
                      variant="outline"
                    >
                      {data.topAction.stepLabel}
                    </Badge>
                  </div>
                  <p className="text-foreground font-medium mt-2 leading-relaxed">
                    {data.topAction.recommendation}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed border-t border-border/50 pt-2">
                    <span className="font-medium text-foreground">Why this matters: </span>
                    {data.topAction.why}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step-by-Step Health Grid */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Funnel Step Health
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.steps.map((step, idx) => {
                const cfg = STATUS_CONFIG[step.status as StepStatus];
                const Icon = cfg.icon;
                const unit = step.id === "cpl" ? "$" : "%";
                const isTopPriority = step.priority === 1;

                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border} ${
                      isTopPriority ? "ring-2 ring-primary/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-foreground leading-tight">
                          {step.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isTopPriority && (
                          <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0">
                            #1
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs ${cfg.color} border-current`}
                        >
                          <Icon className="w-3 h-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Value */}
                    <div className="mt-3 flex items-end gap-3">
                      <span className={`text-2xl font-bold ${cfg.color}`}>
                        {formatValue(step.value, unit)}
                      </span>
                      <span className="text-xs text-muted-foreground mb-1">
                        Target: {step.benchmark.green}
                      </span>
                    </div>

                    {/* Tip */}
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {step.tip}
                    </p>

                    {/* Benchmark bar */}
                    {step.value !== null && (
                      <div className="mt-3">
                        <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              step.status === "green"
                                ? "bg-emerald-500"
                                : step.status === "yellow"
                                ? "bg-amber-400"
                                : "bg-red-400"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                step.id === "cpl"
                                  ? Math.max(0, 100 - ((step.value - 0) / 15) * 100)
                                  : Math.min(100, (step.value / (step.id === "crHighTicket" ? 30 : 10)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{step.benchmark.floor}</span>
                          <span>{step.benchmark.green}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ranked Action List */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              All Optimization Opportunities (Ranked)
            </h2>
            <div className="space-y-2">
              {[...data.steps]
                .sort((a, b) => a.priority - b.priority)
                .filter(s => s.status !== "green")
                .map((step, idx) => {
                  const cfg = STATUS_CONFIG[step.status as StepStatus];
                  const Icon = cfg.icon;
                  const unit = step.id === "cpl" ? "$" : "%";
                  return (
                    <div
                      key={step.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                        idx === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{step.label}</span>
                          <span className={`text-xs font-semibold ${cfg.color}`}>
                            {formatValue(step.value, unit)}
                          </span>
                          <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {step.tip}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                    </div>
                  );
                })}
              {data.steps.every(s => s.status === "green") && (
                <div className="text-center py-6 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
                  All funnel steps are green. Scale your ad spend.
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center">
            Data refreshes every 10 minutes · Last updated {new Date(data.fetchedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
