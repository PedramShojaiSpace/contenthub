/**
 * PipelineStatusBadge — shows live video pipeline status for a script by title.
 * Polls every 30s while in-progress. Renders nothing if no job exists yet.
 */
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle2, AlertCircle, Video, ExternalLink } from "lucide-react";

const IN_PROGRESS = new Set(["pending", "rendering", "importing", "editing", "uploading"]);

const META: Record<string, { label: string; cls: string }> = {
  pending:           { label: "Queued",               cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  rendering:         { label: "HeyGen Rendering…",    cls: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  importing:         { label: "Importing to Descript…", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  editing:           { label: "Adding B-roll…",       cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  ready_for_review:  { label: "Ready for VA Review",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  approved:          { label: "VA Approved",          cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  uploading:         { label: "Uploading to YouTube…", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  uploaded_unlisted: { label: "On YouTube (unlisted)", cls: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  published:         { label: "Published on YouTube", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  failed:            { label: "Pipeline Failed",      cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  rejected:          { label: "Rejected",             cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function PipelineStatusBadge({ scriptTitle }: { scriptTitle: string }) {
  const { data: job } = trpc.videoPipeline.getJobByTitle.useQuery(
    { title: scriptTitle },
    {
      refetchInterval: (q) => {
        const s = q.state.data?.status;
        return s && IN_PROGRESS.has(s) ? 30_000 : false;
      },
      staleTime: 20_000,
    }
  );

  if (!job) return null;

  const m = META[job.status] ?? { label: job.status, cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
  const spinning = IN_PROGRESS.has(job.status);

  return (
    <div className="flex items-center gap-2 flex-wrap mt-1.5">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${m.cls}`}>
        {spinning ? <Loader2 className="w-3 h-3 animate-spin" /> : job.status === "failed" || job.status === "rejected" ? <AlertCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
        {m.label}
      </span>
      {(job.status === "published" || job.status === "uploaded_unlisted") && job.youtubeVideoId && (
        <a href={`https://www.youtube.com/watch?v=${job.youtubeVideoId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2">
          <ExternalLink className="w-3 h-3" /> Watch on YouTube
        </a>
      )}
      {job.status === "ready_for_review" && (
        <a href="/va-dashboard"
          className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2">
          <Video className="w-3 h-3" /> Review in VA Dashboard →
        </a>
      )}
      {job.status === "failed" && job.errorMessage && (
        <span className="text-xs text-red-400/70 truncate max-w-xs" title={job.errorMessage}>
          {job.errorMessage.substring(0, 80)}
        </span>
      )}
    </div>
  );
}
