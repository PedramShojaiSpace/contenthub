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
  FileVideo, RefreshCw, FlaskConical, FolderDown,
  Share2, Megaphone, Send, ExternalLink
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

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

  // ── Output path state ──────────────────────────────────────────────────────
  const [outputPath, setOutputPath]     = useState<"none" | "buffer" | "meta">("none");
  // Buffer syndication
  const [bufferCaption, setBufferCaption] = useState("");
  const [bufferCtaUrl, setBufferCtaUrl]   = useState("");
  // Meta Ads
  const [metaAdAccountId, setMetaAdAccountId] = useState("");
  const [metaPageId, setMetaPageId]           = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaAdName, setMetaAdName]           = useState("");
  const [outputResults, setOutputResults]     = useState<{ label: string; success: boolean; error?: string; videoId?: string; creativeId?: string }[]>([]);
  const hookInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);
  const ctaInputRef  = useRef<HTMLInputElement>(null);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createJobMutation   = trpc.videoVariant.createJob.useMutation();
  const startProcessingMutation = trpc.videoVariant.startProcessing.useMutation();
  const deleteClipMutation  = trpc.videoVariant.deleteClip.useMutation();
  const deleteJobMutation   = trpc.videoVariant.deleteJob.useMutation();
  const syndicateToBufferMutation = trpc.videoVariant.syndicateToBuffer.useMutation();
  const uploadToMetaMutation      = trpc.videoVariant.uploadToMetaAds.useMutation();
  const saveMetaCredentialsMutation = trpc.videoVariant.saveMetaCredentials.useMutation();

  // Load saved Meta credentials on mount and auto-fill fields
  const { data: savedMetaCreds } = trpc.videoVariant.getMetaCredentials.useQuery(undefined, {
    staleTime: Infinity,
  });
  useEffect(() => {
    if (savedMetaCreds) {
      if (savedMetaCreds.metaAdAccountId) setMetaAdAccountId(savedMetaCreds.metaAdAccountId);
      if (savedMetaCreds.metaPageId) setMetaPageId(savedMetaCreds.metaPageId);
      if (savedMetaCreds.metaAccessToken) setMetaAccessToken(savedMetaCreds.metaAccessToken);
    }
  }, [savedMetaCreds]);
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
  // Serialization ref: queue of pending uploads to prevent concurrent state races
  const uploadQueueRef = useRef<Promise<void>>(Promise.resolve());

  const uploadClip = useCallback(async (file: File, clipType: ClipType, clipOrder: number) => {
    if (!activeJobId) return;
    // Chain this upload onto the previous one so state mutations are sequential
    uploadQueueRef.current = uploadQueueRef.current.then(() =>
      _doUploadClip(file, clipType, clipOrder)
    );
    return uploadQueueRef.current;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, utils]);

  const _doUploadClip = async (file: File, clipType: ClipType, clipOrder: number) => {
    if (!activeJobId) return;

    const tempId = `${clipType}-${clipOrder}-${Date.now()}`;
    setUploadingClips(prev => [...prev, {
      id: tempId, filename: file.name, clipType, clipOrder, progress: 0
    }]);

    try {
      // ── Chunked upload (bypasses Cloud Run 32 MB gateway limit) ──────────────
      // Slice the file into 4 MB chunks, send each one individually, then
      // call /finalize so the server reassembles and uploads to S3 in background.
      const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB — well under Cloud Run 32 MB gateway limit
      const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const sendChunk = (chunkIndex: number): Promise<void> => {
        return new Promise((resolve, reject) => {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const blob = file.slice(start, end);

          const fd = new FormData();
          fd.append("chunk", blob, file.name);
          fd.append("uploadId", uploadId);
          fd.append("chunkIndex", String(chunkIndex));
          fd.append("totalChunks", String(totalChunks));
          fd.append("jobId", String(activeJobId));
          fd.append("clipType", clipType);
          fd.append("clipOrder", String(clipOrder));

          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              // Overall progress = chunks done + fraction of current chunk
              // Reserve last 10% for server-side S3 processing
              const chunksDone = chunkIndex / totalChunks;
              const chunkFraction = (e.loaded / e.total) / totalChunks;
              const pct = Math.round((chunksDone + chunkFraction) * 90);
              setUploadingClips(prev => prev.map(c =>
                c.id === tempId ? { ...c, progress: Math.min(pct, 90) } : c
              ));
            }
          });
          xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
              resolve();
            } else {
              // Try to parse JSON error from server; fall back to raw text for gateway errors
              let errMsg = `Chunk ${chunkIndex} failed (${xhr.status})`;
              try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed?.error) errMsg = parsed.error;
              } catch {
                // Gateway returned HTML/text — show first 120 chars for diagnosis
                const raw = xhr.responseText?.slice(0, 120).trim();
                if (raw) errMsg = `Gateway error (${xhr.status}): ${raw}`;
              }
              reject(new Error(errMsg));
            }
          });
          xhr.addEventListener("error", () => reject(new Error(`Network error on chunk ${chunkIndex}`)));
          xhr.addEventListener("timeout", () => reject(new Error(`Chunk ${chunkIndex} timed out`)));
          xhr.open("POST", "/api/upload/video-chunk");
          xhr.withCredentials = true;
          xhr.timeout = 5 * 60 * 1000; // 5 min per chunk
          xhr.send(fd);
        });
      };

      // Send chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        await sendChunk(i);
      }

      // All chunks received — tell server to reassemble and upload to S3
      setUploadingClips(prev => prev.map(c =>
        c.id === tempId ? { ...c, progress: 92 } : c
      ));

      const finalizeRes = await fetch("/api/upload/video-chunk/finalize", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          jobId: activeJobId,
          clipType,
          clipOrder,
          filename: file.name,
          totalChunks,
        }),
      });

      if (!finalizeRes.ok) {
        const errJson = await finalizeRes.json().catch(() => ({}));
        throw new Error(errJson?.error ?? `Finalize failed (${finalizeRes.status})`);
      }

      // Server accepted — show 95% while S3 upload finishes in background
      setUploadingClips(prev => prev.map(c =>
        c.id === tempId ? { ...c, progress: 95 } : c
      ));

      // Poll every 2s for up to 5 minutes until the clip appears in the server list
      const maxWaitMs = 5 * 60 * 1000;
      const pollInterval = 2000;
      const startTime = Date.now();
      let found = false;

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise(r => setTimeout(r, pollInterval));
        const freshData = await utils.videoVariant.getJob.fetch({ jobId: activeJobId });
        const serverClips: any[] = freshData?.clips ?? [];
        // Match on BOTH clipType AND clipOrder for all types to avoid false positives.
        // For body clips, clipOrder is 0; for hooks it's 1-based; for cta it's 1-based.
        const newClip = serverClips.find((c: any) =>
          c.clipType === clipType &&
          c.clipOrder === clipOrder
        );
        if (newClip) {
          found = true;
          setUploadingClips(prev => prev.filter(c => c.id !== tempId));
          utils.videoVariant.getJob.invalidate({ jobId: activeJobId });
          toast.success(`${clipTypeLabel(clipType, clipOrder)} ready`);
          break;
        }
      }

      if (!found) {
        setUploadingClips(prev => prev.map(c =>
          c.id === tempId
            ? { ...c, error: "Processing timed out — please try again", progress: 0 }
            : c
        ));
        toast.error("Clip processing timed out. Please try again.");
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setUploadingClips(prev => prev.map(c => c.id === tempId ? { ...c, error: msg, progress: 0 } : c));
      toast.error(`Upload failed: ${msg}`);
    }
  };

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

  const handleCtaFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const existingCtaCount = clips.filter((c: any) => c.clipType === "cta").length
      + uploadingClips.filter(c => c.clipType === "cta").length;
    files.forEach((file, i) => uploadClip(file, "cta", existingCtaCount + i + 1));
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
    // Use the merged clips list (server + pending local) so the Generate button
    // works even if the body clip was just uploaded and is still being processed
    if (hookClips.length === 0) { toast.error("Upload at least one hook clip"); return; }
    if (bodyClips.length === 0) { toast.error("Upload a body clip"); return; }

    try {
      await startProcessingMutation.mutateAsync({ jobId: activeJobId });
      setPollEnabled(true);
      toast.success(`Generating ${hookClips.length} variant${hookClips.length > 1 ? "s" : ""}…`);
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
  // Full combinatorial count: N hooks × M CTAs (or N×1 if no CTAs)
  const ctaCount = Math.max(ctaClips.length, 1);
  const totalVariants = hookClips.length * ctaCount;

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
                  <p className="text-xs text-zinc-500">Upload 1–5 CTA MP4s. Each CTA is paired with every hook (N hooks × M CTAs = N×M variants).</p>
                  {ctaClips.map((c: any) => (
                    <ClipRow key={c.id ?? c.clipId} clip={c} onDelete={() => handleDeleteClip(c.id ?? c.clipId)} />
                  ))}
                  {uploadingClips.filter(c => c.clipType === "cta").map(c => (
                    <UploadingRow key={c.id} clip={c} />
                  ))}
                  <input ref={ctaInputRef} type="file" accept="video/mp4,.mp4" multiple className="hidden" onChange={handleCtaFiles} />
                  <Button
                    variant="outline" size="sm"
                    className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    onClick={() => ctaInputRef.current?.click()}
                  >
                    <Upload className="w-3 h-3 mr-2" /> {ctaClips.length === 0 ? "Upload CTA MP4" : "Add Another CTA"}
                  </Button>
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
                  {ctaClips.length > 0 ? ` × ${ctaClips.length} CTA${ctaClips.length !== 1 ? "s" : ""}` : ""}
                  {" "}= {totalVariants} output MP4{totalVariants !== 1 ? "s" : ""}
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={hookClips.length === 0 || bodyClips.length === 0 || startProcessingMutation.isPending}
                className="bg-violet-600 hover:bg-violet-500 text-white px-6"
              >
                {startProcessingMutation.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Starting…</>
                  : <><Zap className="w-4 h-4 mr-2" /> Generate All {totalVariants > 0 ? totalVariants : ""} Variants</>
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
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="text-base text-zinc-200 flex items-center gap-2">
                    <FileVideo className="w-4 h-4 text-emerald-400" />
                    Output Variants
                    <Badge className="ml-2 text-xs bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                      {doneVariants.length} ready
                    </Badge>
                  </CardTitle>
                  {doneVariants.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs"
                      onClick={() => {
                        doneVariants.forEach((v, i) => {
                          if (v.s3Url) {
                            setTimeout(() => {
                              const a = document.createElement("a");
                              a.href = v.s3Url!;
                              a.download = `${v.variantLabel.replace(/[^a-z0-9]+/gi, "-")}.mp4`;
                              a.target = "_blank";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }, i * 800);
                          }
                        });
                        toast.success(`Downloading ${doneVariants.length} variants…`);
                      }}
                    >
                      <FolderDown className="w-3 h-3 mr-1" /> Download All ({doneVariants.length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Variant list */}
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
                        <a href={v.s3Url} download target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
                            <Download className="w-3 h-3 mr-1" /> MP4
                          </Button>
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                {/* Two-path output selector */}
                {doneVariants.length > 0 && (
                  <div className="border-t border-zinc-800 pt-4 space-y-4">
                    <p className="text-sm font-semibold text-zinc-200">Send Variants To…</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setOutputPath(outputPath === "buffer" ? "none" : "buffer")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          outputPath === "buffer"
                            ? "border-sky-500/60 bg-sky-500/10"
                            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Share2 className="w-4 h-4 text-sky-400" />
                          <span className="text-sm font-medium text-zinc-200">Buffer</span>
                          <Badge className="ml-auto text-xs bg-sky-500/20 text-sky-300 border-sky-500/30">Organic</Badge>
                        </div>
                        <p className="text-xs text-zinc-500">Schedule all variants as video posts across your social channels. Best for ManyChat keyword-reply CTAs.</p>
                      </button>
                      <button
                        onClick={() => setOutputPath(outputPath === "meta" ? "none" : "meta")}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          outputPath === "meta"
                            ? "border-blue-500/60 bg-blue-500/10"
                            : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Megaphone className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-zinc-200">Meta Ads</span>
                          <Badge className="ml-auto text-xs bg-blue-500/20 text-blue-300 border-blue-500/30">Paid</Badge>
                        </div>
                        <p className="text-xs text-zinc-500">Upload all variants to Meta Ads Manager as AdCreatives. Ready to attach to ad sets and go live immediately.</p>
                      </button>
                    </div>

                    {/* Buffer config panel */}
                    {outputPath === "buffer" && (
                      <div className="p-4 rounded-xl bg-sky-500/5 border border-sky-500/20 space-y-3">
                        <p className="text-xs font-semibold text-sky-300 uppercase tracking-wide">Buffer Syndication</p>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Caption (applies to all variants)</label>
                          <Textarea
                            value={bufferCaption}
                            onChange={e => setBufferCaption(e.target.value)}
                            placeholder="Write your caption here… or leave blank to use the job name"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm resize-none"
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">CTA URL (optional — added as first comment on Instagram)</label>
                          <Input
                            value={bufferCtaUrl}
                            onChange={e => setBufferCtaUrl(e.target.value)}
                            placeholder="https://urbanmonkacademy.com/join"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
                          />
                        </div>
                        <p className="text-xs text-zinc-500">Channels are pulled from your Buffer connection. All {doneVariants.length} variants will be queued simultaneously.</p>
                        {outputResults.length > 0 && (
                          <div className="space-y-1">
                            {outputResults.map((r, i) => (
                              <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded ${
                                r.success ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                              }`}>
                                {r.success ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{r.label}</span>
                                {r.error && <span className="ml-auto shrink-0 text-red-400">{r.error}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          className="w-full bg-sky-600 hover:bg-sky-500 text-white"
                          disabled={syndicateToBufferMutation.isPending}
                          onClick={async () => {
                            if (!activeJobId) return;
                            try {
                              setOutputResults([]);
                              const res = await syndicateToBufferMutation.mutateAsync({
                                jobId: activeJobId,
                                channelIds: [], // Buffer uses all connected channels when empty
                                caption: bufferCaption,
                                ctaUrl: bufferCtaUrl || undefined,
                              });
                              setOutputResults(res.results.map(r => ({ label: r.label, success: r.success, error: r.error })));
                              toast.success(`${res.successCount}/${res.totalVariants} variants sent to Buffer`);
                            } catch (err: any) {
                              toast.error(err.message ?? "Buffer syndication failed");
                            }
                          }}
                        >
                          {syndicateToBufferMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending to Buffer…</>
                            : <><Send className="w-4 h-4 mr-2" /> Send All {doneVariants.length} Variants to Buffer</>}
                        </Button>
                      </div>
                    )}

                    {/* Meta Ads config panel */}
                    {outputPath === "meta" && (
                      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                        <p className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Meta Ads Manager</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Ad Account ID</label>
                            <Input
                              value={metaAdAccountId}
                              onChange={e => setMetaAdAccountId(e.target.value)}
                              placeholder="act_123456789"
                              className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-zinc-400 mb-1 block">Facebook Page ID</label>
                            <Input
                              value={metaPageId}
                              onChange={e => setMetaPageId(e.target.value)}
                              placeholder="123456789"
                              className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Access Token</label>
                          <Input
                            value={metaAccessToken}
                            onChange={e => setMetaAccessToken(e.target.value)}
                            placeholder="EAAxxxxxxx…"
                            type="password"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 mb-1 block">Ad Name Prefix (optional)</label>
                          <Input
                            value={metaAdName}
                            onChange={e => setMetaAdName(e.target.value)}
                            placeholder="UM-GutHealth-W20"
                            className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-zinc-500">
                            Each variant is uploaded as an AdVideo and an AdCreative is created automatically.
                            You can then attach them to any ad set in Ads Manager and go live.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-3 shrink-0 border-zinc-600 text-zinc-400 hover:text-zinc-200 text-xs"
                            disabled={saveMetaCredentialsMutation.isPending || !metaAdAccountId || !metaPageId || !metaAccessToken}
                            onClick={async () => {
                              try {
                                await saveMetaCredentialsMutation.mutateAsync({
                                  metaAdAccountId,
                                  metaPageId,
                                  metaAccessToken,
                                });
                                toast.success("Meta credentials saved — they will pre-fill next time");
                              } catch (err: any) {
                                toast.error(err.message ?? "Failed to save credentials");
                              }
                            }}
                          >
                            {saveMetaCredentialsMutation.isPending
                              ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving…</>
                              : <><CheckCircle2 className="w-3 h-3 mr-1" /> Save Credentials</>}
                          </Button>
                        </div>
                        {outputResults.length > 0 && (
                          <div className="space-y-1">
                            {outputResults.map((r, i) => (
                              <div key={i} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded ${
                                r.success ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"
                              }`}>
                                {r.success ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
                                <span className="truncate">{r.label}</span>
                                {r.success && r.videoId && (
                                  <a
                                    href={`https://business.facebook.com/adsmanager/manage/ads`}
                                    target="_blank" rel="noopener noreferrer"
                                    className="ml-auto shrink-0 flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                  >
                                    <ExternalLink className="w-3 h-3" /> Ads Manager
                                  </a>
                                )}
                                {r.error && <span className="ml-auto shrink-0 text-red-400 truncate max-w-[200px]">{r.error}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                          disabled={uploadToMetaMutation.isPending || !metaAdAccountId || !metaPageId || !metaAccessToken}
                          onClick={async () => {
                            if (!activeJobId) return;
                            try {
                              setOutputResults([]);
                              const res = await uploadToMetaMutation.mutateAsync({
                                jobId: activeJobId,
                                adAccountId: metaAdAccountId,
                                pageId: metaPageId,
                                accessToken: metaAccessToken,
                                adName: metaAdName,
                              });
                              setOutputResults(res.results.map(r => ({ label: r.label, success: r.success, error: r.error, videoId: r.videoId, creativeId: r.creativeId })));
                              toast.success(`${res.successCount}/${res.totalVariants} variants uploaded to Meta Ads Manager`);
                            } catch (err: any) {
                              toast.error(err.message ?? "Meta upload failed");
                            }
                          }}
                        >
                          {uploadToMetaMutation.isPending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading to Meta…</>
                            : <><Megaphone className="w-4 h-4 mr-2" /> Upload All {doneVariants.length} to Meta Ads Manager</>}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
