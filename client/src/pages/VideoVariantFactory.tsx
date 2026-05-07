/**
 * Video Variant Factory
 * ─────────────────────
 * Workflow:
 *  1. Name the job
 *  2. Upload hook clips (MP4, up to 10) — each gets a "Hook N" label
 *  3. Upload body clip (MP4, exactly 1)
 *  4. Optionally upload a CTA clip
 *  5. Click "Generate Variants" — server stitches every hook+body combo
 *  6. Poll until done, then download each variant MP4
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Upload, Film, Scissors, Play, Download, Trash2,
  CheckCircle2, Clock, AlertCircle, Loader2, Plus,
  Clapperboard, Zap, History, ChevronDown, ChevronUp,
  FileVideo, RefreshCw, FlaskConical
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ClipType = "hook" | "body" | "cta";

interface UploadedClip {
  clipId: number;
  s3Url: string;
  filename: string;
  clipType: ClipType;
  clipOrder: number;
}

interface UploadingClip {
  id: string;  // temp local id
  filename: string;
  clipType: ClipType;
  clipOrder: number;
  progress: number;  // 0-100
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  switch (status) {
    case "done":      return "text-emerald-400";
    case "processing": return "text-amber-400";
    case "error":     return "text-red-400";
    default:          return "text-zinc-400";
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "done":       return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "processing": return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
    case "error":      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:           return <Clock className="w-4 h-4 text-zinc-400" />;
  }
}

function clipTypeLabel(t: ClipType, order: number) {
  if (t === "hook") return `Hook ${order}`;
  if (t === "body") return "Body";
  return "CTA";
}

function clipTypeBadgeColor(t: ClipType) {
  if (t === "hook") return "bg-violet-500/20 text-violet-300 border-violet-500/30";
  if (t === "body") return "bg-sky-500/20 text-sky-300 border-sky-500/30";
  return "bg-amber-500/20 text-amber-300 border-amber-500/30";
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function VideoVariantFactory() {
  // Read ?session=<name> URL param to pre-fill job name when arriving from Video Production Session
  const [jobName, setJobName]           = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("session") ?? "";
    } catch { return ""; }
  });
  const [activeJobId, setActiveJobId]   = useState<number | null>(null);
  const [uploadedClips, setUploadedClips] = useState<UploadedClip[]>([]);
  const [uploadingClips, setUploadingClips] = useState<UploadingClip[]>([]);
  const [showHistory, setShowHistory]   = useState(false);
  const [pollEnabled, setPollEnabled]   = useState(false);
  const hookInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const ctaInputRef  = useRef<HTMLInputElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createJobMutation   = trpc.videoVariant.createJob.useMutation();
  const startProcessingMutation = trpc.videoVariant.startProcessing.useMutation();
  const deleteClipMutation  = trpc.videoVariant.deleteClip.useMutation();
  const deleteJobMutation   = trpc.videoVariant.deleteJob.useMutation();
  const utils               = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────────────────────
  const jobQuery = trpc.videoVariant.getJob.useQuery(
    { jobId: activeJobId! },
    {
      enabled: !!activeJobId,
      refetchInterval: pollEnabled ? 3000 : false,
    }
  );

  const historyQuery = trpc.videoVariant.listJobs.useQuery(
    { limit: 20 },
    { enabled: showHistory }
  );

  // A/B tests auto-created after stitching
  const abTestsQuery = trpc.videoVariant.getLinkedABTests.useQuery(
    { jobId: activeJobId! },
    { enabled: !!activeJobId && jobQuery.data?.job?.status === "done" }
  );

  // Stop polling when job is done or errored
  useEffect(() => {
    const status = jobQuery.data?.job?.status;
    if (status === "done" || status === "error") {
      setPollEnabled(false);
    }
  }, [jobQuery.data?.job?.status]);

  // ── Create Job ─────────────────────────────────────────────────────────────
  const handleCreateJob = async () => {
    if (!jobName.trim()) {
      toast.error("Please enter a job name first");
      return;
    }
    try {
      const { jobId } = await createJobMutation.mutateAsync({ jobName: jobName.trim() });
      setActiveJobId(jobId);
      setUploadedClips([]);
      toast.success(`Job "${jobName}" created — now upload your clips`);
    } catch (err) {
      toast.error("Failed to create job");
    }
  };

  // ── Upload a clip file ─────────────────────────────────────────────────────
  const uploadClip = useCallback(async (file: File, clipType: ClipType, clipOrder: number) => {
    if (!activeJobId) return;

    const tempId = `${clipType}-${clipOrder}-${Date.now()}`;
    setUploadingClips(prev => [...prev, {
      id: tempId, filename: file.name, clipType, clipOrder, progress: 0
    }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jobId", String(activeJobId));
      formData.append("clipType", clipType);
      formData.append("clipOrder", String(clipOrder));

      // Use XMLHttpRequest for progress tracking
      const result = await new Promise<{ clipId: number; s3Url: string; filename: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadingClips(prev => prev.map(c => c.id === tempId ? { ...c, progress: pct } : c));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(JSON.parse(xhr.responseText)?.error ?? "Upload failed"));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("POST", "/api/upload/video-clip");
        xhr.withCredentials = true;
        xhr.send(formData);
      });

      setUploadingClips(prev => prev.filter(c => c.id !== tempId));
      setUploadedClips(prev => [...prev, {
        clipId: result.clipId,
        s3Url: result.s3Url,
        filename: result.filename,
        clipType,
        clipOrder,
      }]);
      toast.success(`${clipTypeLabel(clipType, clipOrder)} uploaded`);
      utils.videoVariant.getJob.invalidate({ jobId: activeJobId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadingClips(prev => prev.map(c => c.id === tempId ? { ...c, error: msg, progress: 0 } : c));
      toast.error(`Upload failed: ${msg}`);
    }
  }, [activeJobId, utils]);

  // ── Handle file input changes ──────────────────────────────────────────────
  const handleHookFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const existingHookCount = uploadedClips.filter(c => c.clipType === "hook").length
      + uploadingClips.filter(c => c.clipType === "hook").length;
    files.forEach((file, i) => uploadClip(file, "hook", existingHookCount + i + 1));
    e.target.value = "";
  };

  const handleBodyFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadClip(file, "body", 0);
    e.target.value = "";
  };

  const handleCtaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadClip(file, "cta", 0);
    e.target.value = "";
  };

  // ── Delete clip ────────────────────────────────────────────────────────────
  const handleDeleteClip = async (clipId: number) => {
    try {
      await deleteClipMutation.mutateAsync({ clipId });
      setUploadedClips(prev => prev.filter(c => c.clipId !== clipId));
      utils.videoVariant.getJob.invalidate({ jobId: activeJobId! });
      toast.success("Clip removed");
    } catch {
      toast.error("Failed to remove clip");
    }
  };

  // ── Start processing ───────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!activeJobId) return;
    const hooks = uploadedClips.filter(c => c.clipType === "hook");
    const body  = uploadedClips.filter(c => c.clipType === "body");
    if (hooks.length === 0) { toast.error("Upload at least one hook clip"); return; }
    if (body.length === 0)  { toast.error("Upload a body clip"); return; }

    try {
      await startProcessingMutation.mutateAsync({ jobId: activeJobId });
      setPollEnabled(true);
      toast.success(`Generating ${hooks.length} variant${hooks.length > 1 ? "s" : ""}…`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start";
      toast.error(msg);
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const job      = jobQuery.data?.job;
  const variants = jobQuery.data?.variants ?? [];
  // Merge server clips with locally-tracked uploaded clips.
  // Server clips are the source of truth for confirmed uploads.
  // Locally-tracked clips fill in for clips that haven't been confirmed by the server yet
  // (e.g., a body clip uploaded after hooks are already on the server).
  const serverClips = jobQuery.data?.clips ?? [];
  const serverClipIds = new Set(serverClips.map((c: any) => c.id));
  // Include local clips whose clipId is NOT yet reflected in serverClips
  const pendingLocalClips = uploadedClips.filter(
    c => !serverClips.some((sc: any) => sc.id === c.clipId)
  );
  const clips: any[] = [...serverClips, ...pendingLocalClips];
  const hookClips = clips.filter((c: any) => c.clipType === "hook");
  const bodyClips = clips.filter((c: any) => c.clipType === "body");
  const ctaClips  = clips.filter((c: any) => c.clipType === "cta");
  void serverClipIds; // suppress unused var warning
  const isProcessing = job?.status === "processing" || pollEnabled;
  const isDone       = job?.status === "done";
  const hasError     = job?.status === "error";
  const doneVariants = variants.filter(v => v.status === "done");
  const totalVariants = hookClips.length; // one per hook

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center border border-violet-500/30">
            <Clapperboard className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-100">Video Variant Factory</h1>
            <p className="text-sm text-zinc-400">Upload hooks + body → auto-stitch every combination</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          onClick={() => setShowHistory(h => !h)}
        >
          <History className="w-4 h-4 mr-2" />
          History
          {showHistory ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
        </Button>
      </div>

      {/* History panel */}
      {showHistory && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Past Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {historyQuery.isLoading ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (historyQuery.data ?? []).length === 0 ? (
              <p className="text-zinc-500 text-sm">No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {(historyQuery.data ?? []).map(j => (
                  <div key={j.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                    <div className="flex items-center gap-3">
                      {statusIcon(j.status)}
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{j.jobName}</p>
                        <p className="text-xs text-zinc-500">{j.hookCount} hooks · {j.variantCount} variants</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost" size="sm"
                        className="text-zinc-400 hover:text-zinc-200 text-xs"
                        onClick={() => {
                          setActiveJobId(j.id);
                          setJobName(j.jobName);
                          setShowHistory(false);
                          if (j.status === "processing") setPollEnabled(true);
                        }}
                      >
                        Open
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={async () => {
                          await deleteJobMutation.mutateAsync({ jobId: j.id });
                          utils.videoVariant.listJobs.invalidate();
                          if (activeJobId === j.id) { setActiveJobId(null); setUploadedClips([]); }
                          toast.success("Job deleted");
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Name the job */}
      {!activeJobId && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center font-bold">1</span>
              Name your test batch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreateJob()}
              placeholder="e.g. Week 20 — Gut Health Hooks"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
            />
            <Button
              onClick={handleCreateJob}
              disabled={!jobName.trim() || createJobMutation.isPending}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {createJobMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Job
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active job workspace */}
      {activeJobId && (
        <div className="space-y-4">
          {/* Job header */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-3">
              {statusIcon(job?.status ?? "pending")}
              <div>
                <p className="font-semibold text-zinc-100">{job?.jobName ?? jobName}</p>
                <p className="text-xs text-zinc-500">Job #{activeJobId}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(isDone || hasError) && (
                <Button
                  variant="ghost" size="sm"
                  className="text-zinc-400 hover:text-zinc-200 text-xs"
                  onClick={() => { setActiveJobId(null); setJobName(""); setUploadedClips([]); setPollEnabled(false); }}
                >
                  New Job
                </Button>
              )}
              <Badge className={`text-xs border ${statusColor(job?.status ?? "pending")}`}>
                {job?.status ?? "pending"}
              </Badge>
            </div>
          </div>

          {/* Upload zone (only when pending) */}
          {(job?.status === "pending" || !job) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Hook clips */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-violet-400" />
                    Hook Clips
                    <Badge className="ml-auto text-xs bg-violet-500/20 text-violet-300 border-violet-500/30">
                      {hookClips.length} uploaded
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-zinc-500">Upload 1–10 hook MP4s. Each becomes a separate variant.</p>
                  {hookClips.map((c: any) => (
                    <ClipRow key={c.id ?? c.clipId} clip={c} onDelete={() => handleDeleteClip(c.id ?? c.clipId)} />
                  ))}
                  {uploadingClips.filter(c => c.clipType === "hook").map(c => (
                    <UploadingRow key={c.id} clip={c} />
                  ))}
                  <input ref={hookInputRef} type="file" accept="video/mp4,.mp4" multiple className="hidden" onChange={handleHookFiles} />
                  <Button
                    variant="outline" size="sm"
                    className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    onClick={() => hookInputRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 mr-2" /> Add Hook MP4
                  </Button>
                </CardContent>
              </Card>

              {/* Body clip */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
                    <Film className="w-4 h-4 text-sky-400" />
                    Body Clip
                    <Badge className="ml-auto text-xs bg-sky-500/20 text-sky-300 border-sky-500/30">
                      {bodyClips.length > 0 ? "1 uploaded" : "required"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-zinc-500">The main content that stays the same across all variants.</p>
                  {bodyClips.map((c: any) => (
                    <ClipRow key={c.id ?? c.clipId} clip={c} onDelete={() => handleDeleteClip(c.id ?? c.clipId)} />
                  ))}
                  {uploadingClips.filter(c => c.clipType === "body").map(c => (
                    <UploadingRow key={c.id} clip={c} />
                  ))}
                  <input ref={bodyInputRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={handleBodyFile} />
                  {bodyClips.length === 0 && uploadingClips.filter(c => c.clipType === "body").length === 0 && (
                    <Button
                      variant="outline" size="sm"
                      className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                      onClick={() => bodyInputRef.current?.click()}
                    >
                      <Upload className="w-3 h-3 mr-2" /> Upload Body MP4
                    </Button>
                  )}
                  {bodyClips.length > 0 && uploadingClips.filter(c => c.clipType === "body").length === 0 && (
                    <Button
                      variant="outline" size="sm"
                      className="w-full border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-xs"
                      onClick={async () => {
                        // Delete existing body clip then open file picker
                        const existing = bodyClips[0];
                        if (existing) await handleDeleteClip(existing.id ?? existing.clipId);
                        bodyInputRef.current?.click();
                      }}
                    >
                      <RefreshCw className="w-3 h-3 mr-2" /> Replace Body Clip
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* CTA clip (optional) */}
              <Card className="bg-zinc-900 border-zinc-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-zinc-200 flex items-center gap-2">
                    <Play className="w-4 h-4 text-amber-400" />
                    CTA Clip
                    <Badge className="ml-auto text-xs bg-zinc-700 text-zinc-400 border-zinc-600">
                      optional
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-zinc-500">Optional call-to-action clip appended to every variant.</p>
                  {ctaClips.map((c: any) => (
                    <ClipRow key={c.id ?? c.clipId} clip={c} onDelete={() => handleDeleteClip(c.id ?? c.clipId)} />
                  ))}
                  {uploadingClips.filter(c => c.clipType === "cta").map(c => (
                    <UploadingRow key={c.id} clip={c} />
                  ))}
                  {ctaClips.length === 0 && uploadingClips.filter(c => c.clipType === "cta").length === 0 && (
                    <>
                      <input ref={ctaInputRef} type="file" accept="video/mp4,.mp4" className="hidden" onChange={handleCtaFile} />
                      <Button
                        variant="outline" size="sm"
                        className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        onClick={() => ctaInputRef.current?.click()}
                      >
                        <Upload className="w-3 h-3 mr-2" /> Upload CTA MP4
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Generate button */}
          {(job?.status === "pending" || !job) && (
            <div className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">
                  Ready to generate {hookClips.length > 0 ? hookClips.length : "?"} variant{hookClips.length !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {hookClips.length} hook{hookClips.length !== 1 ? "s" : ""} × 1 body
                  {ctaClips.length > 0 ? " + CTA" : ""}
                  {" "}= {hookClips.length} output MP4{hookClips.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={hookClips.length === 0 || bodyClips.length === 0 || startProcessingMutation.isPending}
                className="bg-violet-600 hover:bg-violet-500 text-white px-6"
              >
                {startProcessingMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
                  : <><Zap className="w-4 h-4 mr-2" /> Generate Variants</>
                }
              </Button>
            </div>
          )}

          {/* Processing status */}
          {isProcessing && !isDone && (
            <Card className="bg-zinc-900 border-amber-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-3">
                  <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                  <p className="text-sm font-medium text-amber-300">Stitching variants with FFmpeg…</p>
                  <Button
                    variant="ghost" size="sm"
                    className="ml-auto text-zinc-400 hover:text-zinc-200"
                    onClick={() => utils.videoVariant.getJob.invalidate({ jobId: activeJobId })}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Refresh
                  </Button>
                </div>
                <Progress
                  value={totalVariants > 0 ? (doneVariants.length / totalVariants) * 100 : 0}
                  className="h-2 bg-zinc-800"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  {doneVariants.length} of {totalVariants} variant{totalVariants !== 1 ? "s" : ""} complete
                </p>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {hasError && (
            <Card className="bg-zinc-900 border-red-500/30">
              <CardContent className="pt-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-300">Processing failed</p>
                  <p className="text-xs text-zinc-400 mt-1">{job?.errorMessage ?? "Unknown error"}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* A/B Tests auto-created badge */}
          {isDone && abTestsQuery.data && abTestsQuery.data.tests.length > 0 && (
            <Card className="bg-zinc-900 border-amber-500/30">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                      <FlaskConical className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-300">A/B Tests Created Automatically</p>
                      <p className="text-xs text-zinc-400">
                        {abTestsQuery.data.tests.length} test{abTestsQuery.data.tests.length !== 1 ? "s" : ""} created from hook pairs — track performance in the A/B Test Lab
                      </p>
                    </div>
                  </div>
                  <Link href="/viral-studio?tab=testing">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs">
                      <FlaskConical className="w-3 h-3 mr-1" /> View in A/B Test Lab →
                    </Button>
                  </Link>
                </div>
                <div className="mt-3 space-y-1">
                  {abTestsQuery.data.tests.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-800/50 rounded px-3 py-1.5">
                      <FlaskConical className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{t.testName}</span>
                      <Badge className="ml-auto text-xs bg-amber-500/20 text-amber-300 border-amber-500/30 shrink-0">{t.status}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Variants output panel */}
          {variants.length > 0 && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                  <FileVideo className="w-4 h-4 text-emerald-400" />
                  Output Variants
                  <Badge className="ml-2 text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                    {doneVariants.length} ready
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {variants.map(v => (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
                      <div className="flex items-center gap-3">
                        {statusIcon(v.status)}
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{v.variantLabel}</p>
                          {v.status === "error" && (
                            <p className="text-xs text-red-400">{v.errorMessage}</p>
                          )}
                        </div>
                      </div>
                      {v.status === "done" && v.s3Url && (
                        <a
                          href={v.s3Url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                            <Download className="w-3 h-3 mr-1" /> Download MP4
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClipRow({ clip, onDelete }: { clip: any; onDelete: () => void }) {
  const ct: ClipType = clip.clipType;
  const order: number = clip.clipOrder ?? 0;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <Badge className={`text-xs border shrink-0 ${clipTypeBadgeColor(ct)}`}>
        {clipTypeLabel(ct, order)}
      </Badge>
      <span className="text-xs text-zinc-300 truncate flex-1">{clip.filename}</span>
      <button onClick={onDelete} className="text-zinc-500 hover:text-red-400 transition-colors shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function UploadingRow({ clip }: { clip: UploadingClip }) {
  return (
    <div className="p-2 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
      <div className="flex items-center gap-2">
        <Badge className={`text-xs border shrink-0 ${clipTypeBadgeColor(clip.clipType)}`}>
          {clipTypeLabel(clip.clipType, clip.clipOrder)}
        </Badge>
        <span className="text-xs text-zinc-400 truncate flex-1">{clip.filename}</span>
        {clip.error
          ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
          : <Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />
        }
      </div>
      {!clip.error && (
        <Progress value={clip.progress} className="h-1 bg-zinc-700" />
      )}
      {clip.error && (
        <p className="text-xs text-red-400">{clip.error}</p>
      )}
    </div>
  );
}
