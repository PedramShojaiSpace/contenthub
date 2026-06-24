import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";

interface Submission {
  id: number;
  missionId: string;
  missionTitle: string;
  status: "draft" | "submitted";
  findings: Record<string, string>;
  recommendation: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
  researcherId: number;
  researcherName: string;
}

function StatusBadge({ status }: { status: "draft" | "submitted" }) {
  if (status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
        ✓ Submitted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
      ✏️ Draft
    </span>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const [expanded, setExpanded] = useState(false);
  const stepKeys = Object.keys(submission.findings).sort();

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-lg font-semibold text-foreground">{submission.missionTitle}</span>
          <StatusBadge status={submission.status} />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0 ml-2">
          {submission.submittedAt && (
            <span>{new Date(submission.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          )}
          <span className="text-base">{expanded ? "▲" : "▼"}</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border p-4 space-y-4">
          {stepKeys.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Research Findings</h4>
              <div className="space-y-3">
                {stepKeys.map((key, idx) => {
                  const value = submission.findings[key];
                  if (!value || !value.trim()) return null;
                  return (
                    <div key={key} className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Step {idx + 1} ({key})</p>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {submission.recommendation && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Final Recommendation</h4>
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-4">
                <p className="text-sm text-emerald-100 leading-relaxed whitespace-pre-wrap">{submission.recommendation}</p>
              </div>
            </div>
          )}
          {stepKeys.length === 0 && !submission.recommendation && (
            <p className="text-sm text-muted-foreground italic">No content saved yet.</p>
          )}
          <p className="text-xs text-muted-foreground">Last updated: {new Date(submission.updatedAt).toLocaleString()}</p>
        </div>
      )}
    </div>
  );
}

function ResearcherSection({ name, submissions }: { name: string; submissions: Submission[] }) {
  const submitted = submissions.filter((s) => s.status === "submitted").length;
  const total = submissions.length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold text-lg shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{name}</h3>
          <p className="text-sm text-muted-foreground">{submitted} submitted · {total - submitted} in progress · {total} total</p>
        </div>
      </div>
      <div className="ml-13 space-y-2 pl-4 border-l-2 border-emerald-800/30">
        {submissions.map((s) => <SubmissionCard key={s.id} submission={s} />)}
      </div>
    </div>
  );
}

export default function KidsReview() {
  const { user, loading: authLoading } = useAuth();
  const { data: submissions, isLoading, error } = trpc.kidsResearch.getAllSubmissions.useQuery(
    undefined,
    { enabled: !!user && user.role === "admin" }
  );

  const byResearcher: Record<string, Submission[]> = {};
  if (submissions) {
    for (const s of submissions as Submission[]) {
      if (!byResearcher[s.researcherName]) byResearcher[s.researcherName] = [];
      byResearcher[s.researcherName].push(s);
    }
  }

  const researcherNames = Object.keys(byResearcher).sort();
  const totalSubmitted = (submissions as Submission[] | undefined)?.filter((s) => s.status === "submitted").length ?? 0;
  const totalDrafts = (submissions as Submission[] | undefined)?.filter((s) => s.status === "draft").length ?? 0;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔬</span>
            <h1 className="text-2xl font-bold text-foreground">Kids Research Portal</h1>
          </div>
          <p className="text-muted-foreground text-sm">Review your researchers' mission submissions.</p>
        </div>

        {submissions && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{researcherNames.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Researchers</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{totalSubmitted}</p>
              <p className="text-xs text-muted-foreground mt-1">Submitted</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{totalDrafts}</p>
              <p className="text-xs text-muted-foreground mt-1">In Progress</p>
            </div>
          </div>
        )}

        {(authLoading || isLoading) && (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading submissions...</span>
          </div>
        )}

        {!authLoading && user && user.role !== "admin" && (
          <div className="text-center py-16">
            <p className="text-2xl mb-2">🔒</p>
            <p className="text-muted-foreground">This page is for Dad only.</p>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <p className="text-destructive text-sm">Error loading submissions: {error.message}</p>
          </div>
        )}

        {!isLoading && !error && submissions && submissions.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">🗺️</p>
            <p className="text-lg font-semibold text-foreground">No missions started yet</p>
            <p className="text-muted-foreground text-sm">Share the research portal link with your kids to get started.</p>
            <div className="mt-4 bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground font-mono">/kids-research</div>
          </div>
        )}

        {!isLoading && !error && researcherNames.length > 0 && (
          <div className="space-y-8">
            {researcherNames.map((name) => (
              <ResearcherSection key={name} name={name} submissions={byResearcher[name]} />
            ))}
          </div>
        )}

        {!isLoading && (
          <div className="bg-muted/20 border border-border rounded-lg p-4 text-sm">
            <p className="font-semibold text-foreground mb-1">📎 Kids Portal Link</p>
            <p className="text-muted-foreground">
              Share this URL with your researchers:{" "}
              <span className="font-mono text-foreground bg-muted px-1 py-0.5 rounded">
                {window.location.origin}/kids-research
              </span>
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
