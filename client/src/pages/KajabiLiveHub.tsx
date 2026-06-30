import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, ExternalLink, Sparkles, CheckCircle, Loader2,
  Copy, ChevronDown, ChevronUp, Layers, MessageSquare,
  Users, Film, AlertCircle, RefreshCw,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type Session = {
  id: number; title: string; sessionDate: number;
  descriptProjectId: string | null; descriptProjectUrl: string | null;
  underlordJobId: string | null; underlordStatus: string | null;
  underlordAgentResponse: string | null; clipsApproved: boolean;
  sharePostInstagram: string | null; sharePostLinkedin: string | null;
  sharePostFacebook: string | null; memberAskText: string | null;
  carouselSlides: Array<{ heading: string; body: string }>;
  status: string; notes: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700",
  descript_linked: "bg-blue-100 text-blue-700",
  underlord_running: "bg-yellow-100 text-yellow-700",
  underlord_failed: "bg-red-100 text-red-700",
  reels_ready: "bg-purple-100 text-purple-700",
  generating_content: "bg-purple-100 text-purple-700",
  ready_for_review: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  posted: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Needs Descript ID",
  descript_linked: "Ready to Process",
  underlord_running: "Underlord Working...",
  underlord_failed: "Underlord Failed",
  reels_ready: "Reels Ready — Review in Descript",
  generating_content: "Generating Social Content...",
  ready_for_review: "Ready for Review",
  approved: "Approved",
  posted: "Posted",
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

function SessionCard({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [descriptId, setDescriptId] = useState(session.descriptProjectId ?? "");
  const [sessionSummary, setSessionSummary] = useState("");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    sharePostInstagram: session.sharePostInstagram ?? "",
    sharePostLinkedin: session.sharePostLinkedin ?? "",
    sharePostFacebook: session.sharePostFacebook ?? "",
    memberAskText: session.memberAskText ?? "",
  });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const linkDescript = trpc.kajabiLive.linkDescriptProject.useMutation({
    onSuccess: () => { toast.success("Descript project linked"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const triggerUnderlord = trpc.kajabiLive.triggerUnderlord.useMutation({
    onSuccess: () => {
      toast.success("Underlord is cutting your reels — this takes 5–15 minutes");
      onRefresh();
      startPolling();
    },
    onError: (e) => toast.error(e.message),
  });

  const checkStatus = trpc.kajabiLive.checkUnderlordStatus.useMutation({
    onSuccess: (data) => {
      if (data.isDone) {
        stopPolling();
        if (data.isSuccess) {
          toast.success("Reels are ready! Open Descript to review them.");
        } else {
          toast.error("Underlord job failed. Try again.");
        }
        onRefresh();
      }
    },
    onError: () => stopPolling(),
  });

  const approveClips = trpc.kajabiLive.approveClips.useMutation({
    onSuccess: () => { toast.success("Clips approved — generating social content..."); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const updateSession = trpc.kajabiLive.update.useMutation({
    onSuccess: () => { toast.success("Saved"); onRefresh(); setEditingPost(null); },
    onError: (e) => toast.error(e.message),
  });

  const approveContent = trpc.kajabiLive.approveContent.useMutation({
    onSuccess: () => { toast.success("Content approved!"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const markPosted = trpc.kajabiLive.markPosted.useMutation({
    onSuccess: () => { toast.success("Marked as posted!"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteSession = trpc.kajabiLive.delete.useMutation({
    onSuccess: () => { toast.success("Session deleted"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  function startPolling() {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(() => {
      checkStatus.mutate({ id: session.id });
    }, 15000);
  }

  function stopPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => {
    if (session.status === "underlord_running" && session.underlordJobId) {
      startPolling();
    }
    return () => stopPolling();
  }, [session.status, session.underlordJobId]);

  const hasContent = session.sharePostInstagram || session.sharePostLinkedin || session.sharePostFacebook;
  const statusColor = STATUS_COLORS[session.status] ?? "bg-gray-100 text-gray-700";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Film className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{session.title}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(session.sessionDate).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric", year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {session.status === "underlord_running" && (
            <Loader2 className="w-4 h-4 text-yellow-600 animate-spin" />
          )}
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-5">

          {/* Step 1: Link Descript Project */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" /> Step 1 — Link Descript Project
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              Open the Descript project for this call. Copy the project ID from the URL:{" "}
              <code className="bg-muted px-1 rounded text-xs">web.descript.com/<strong>[project-id]</strong></code>
            </p>
            <div className="flex gap-2">
              <Input
                value={descriptId}
                onChange={(e) => setDescriptId(e.target.value)}
                placeholder="e.g. e2f89ce6"
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => linkDescript.mutate({ id: session.id, descriptProjectId: descriptId })}
                disabled={linkDescript.isPending || !descriptId.trim()}
              >
                {linkDescript.isPending ? "Linking..." : "Link"}
              </Button>
            </div>
            {session.descriptProjectUrl && (
              <a
                href={session.descriptProjectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Open in Descript
              </a>
            )}
          </div>

          {/* Step 2: Trigger Underlord */}
          {session.descriptProjectId && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Step 2 — Run Underlord to Cut Reels
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Underlord will watch the recording, identify the 3 best 60–90 second moments, and create 3 new compositions named "Marketing Reel 1", "Marketing Reel 2", "Marketing Reel 3" inside the Descript project. Takes 5–15 minutes.
              </p>

              {session.status === "underlord_running" ? (
                <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <Loader2 className="w-5 h-5 text-yellow-600 animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Underlord is working...</p>
                    <p className="text-xs text-yellow-600 mt-0.5">Checking status every 15 seconds. You can close this and come back.</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => checkStatus.mutate({ id: session.id })}
                    disabled={checkStatus.isPending}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" /> Check Now
                  </Button>
                </div>
              ) : session.status === "underlord_failed" ? (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Underlord job failed</p>
                    {session.underlordAgentResponse && (
                      <p className="text-xs text-red-600 mt-0.5">{session.underlordAgentResponse}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => triggerUnderlord.mutate({ id: session.id })}
                    disabled={triggerUnderlord.isPending}
                  >
                    Retry
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => triggerUnderlord.mutate({ id: session.id })}
                  disabled={triggerUnderlord.isPending || session.status === "underlord_running"}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {triggerUnderlord.isPending ? "Starting..." : "Run Underlord — Cut Marketing Reels"}
                </Button>
              )}
            </div>
          )}

          {/* Step 3: Review in Descript + Approve */}
          {(session.status === "reels_ready" || session.clipsApproved) && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary" /> Step 3 — Review Reels in Descript, Then Approve
              </h4>

              {session.underlordAgentResponse && (
                <div className="bg-muted/40 rounded-lg p-3 mb-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Underlord summary:</p>
                  <p className="text-sm text-foreground">{session.underlordAgentResponse}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground mb-3">
                Open Descript and review the 3 "Marketing Reel" compositions. Delete any that aren't strong enough. When you're happy, come back and approve — this generates all social content.
              </p>

              {session.descriptProjectUrl && (
                <a
                  href={session.descriptProjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline mb-3"
                >
                  <ExternalLink className="w-4 h-4" /> Open Descript Project to Review Reels
                </a>
              )}

              {!session.clipsApproved && (
                <div className="space-y-2 mt-3">
                  <label className="text-xs font-medium text-foreground">
                    Optional: Notes about the best reel (helps AI write better social posts)
                  </label>
                  <Textarea
                    value={sessionSummary}
                    onChange={(e) => setSessionSummary(e.target.value)}
                    placeholder="e.g. Reel 2 was strongest — Pedram talked about the gut-brain connection and how stress kills good bacteria..."
                    className="text-sm min-h-[60px]"
                  />
                  <Button
                    onClick={() => approveClips.mutate({ id: session.id, sessionSummary: sessionSummary || undefined })}
                    disabled={approveClips.isPending}
                    className="gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {approveClips.isPending ? "Generating content..." : "Approve Reels & Generate Social Content"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Social Content */}
          {hasContent && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Step 4 — Review & Copy Social Posts
              </h4>
              <div className="space-y-3">
                {[
                  { key: "sharePostInstagram", label: "Instagram" },
                  { key: "sharePostFacebook", label: "Facebook" },
                  { key: "sharePostLinkedin", label: "LinkedIn" },
                ].map(({ key, label }) => {
                  const value = editValues[key as keyof typeof editValues] || (session as any)[key] || "";
                  const isEditing = editingPost === key;
                  return (
                    <div key={key} className="border border-border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => copyToClipboard(value, `${label} post`)}>
                            <Copy className="w-3 h-3 mr-1" /> Copy
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditingPost(isEditing ? null : key)}>
                            {isEditing ? "Cancel" : "Edit"}
                          </Button>
                        </div>
                      </div>
                      {isEditing ? (
                        <div>
                          <Textarea
                            value={editValues[key as keyof typeof editValues]}
                            onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))}
                            className="text-sm min-h-[80px]"
                          />
                          <Button
                            size="sm"
                            className="mt-2"
                            onClick={() => updateSession.mutate({ id: session.id, [key]: editValues[key as keyof typeof editValues] })}
                            disabled={updateSession.isPending}
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Carousel Slides */}
          {session.carouselSlides && session.carouselSlides.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Carousel Slide Outline
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {session.carouselSlides.map((slide, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg p-3 border border-border">
                    <div className="text-xs font-bold text-primary mb-1">Slide {i + 1}</div>
                    <div className="text-sm font-semibold text-foreground mb-1">{slide.heading}</div>
                    <div className="text-xs text-muted-foreground">{slide.body}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                → Use Creation Studio → Carousel to generate images, then push to Buffer.
              </p>
            </div>
          )}

          {/* Member Ask */}
          {session.memberAskText && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4" /> Member Share Ask — Read at End of Next Call
              </h4>
              <p className="text-sm text-green-700 italic">"{session.memberAskText}"</p>
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-6 px-2 text-xs text-green-700"
                onClick={() => copyToClipboard(session.memberAskText!, "Member ask text")}
              >
                <Copy className="w-3 h-3 mr-1" /> Copy for Teleprompter
              </Button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {session.status === "ready_for_review" && (
              <Button
                size="sm"
                onClick={() => approveContent.mutate({ id: session.id })}
                disabled={approveContent.isPending}
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Approve All Content
              </Button>
            )}
            {session.status === "approved" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markPosted.mutate({ id: session.id })}
                disabled={markPosted.isPending}
                className="gap-2"
              >
                <CheckCircle className="w-4 h-4 text-green-600" /> Mark as Posted
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive ml-auto"
              onClick={() => { if (confirm("Delete this session?")) deleteSession.mutate({ id: session.id }); }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NewSessionDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [descriptProjectId, setDescriptProjectId] = useState("");

  const create = trpc.kajabiLive.create.useMutation({
    onSuccess: () => {
      toast.success("Session created");
      setOpen(false);
      setTitle("");
      setDate(new Date().toISOString().split("T")[0]);
      setDescriptProjectId("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> New Live Session</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Kajabi Live Session</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Session Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Q&A — Gut Health Deep Dive"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Descript Project ID <span className="text-muted-foreground font-normal">(optional — can add later)</span>
            </label>
            <Input
              value={descriptProjectId}
              onChange={(e) => setDescriptProjectId(e.target.value)}
              placeholder="e.g. e2f89ce6"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Found in the Descript URL: web.descript.com/<strong>[project-id]</strong>
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => create.mutate({
              title,
              sessionDate: new Date(date).getTime(),
              descriptProjectId: descriptProjectId || undefined,
            })}
            disabled={create.isPending || !title || !date}
          >
            {create.isPending ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function KajabiLiveHub() {
  const { data: sessions, isLoading, refetch } = trpc.kajabiLive.list.useQuery();
  const statusCounts = (sessions ?? []).reduce((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kajabi Live Hub</h1>
            <p className="text-muted-foreground mt-1">
              Turn weekly live calls into marketing reels and social content — via Descript Underlord.
            </p>
          </div>
          <NewSessionDialog onCreated={() => refetch()} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Sessions", value: sessions?.length ?? 0, color: "text-foreground" },
            { label: "Reels Ready", value: statusCounts["reels_ready"] ?? 0, color: "text-purple-600" },
            { label: "Ready for Review", value: statusCounts["ready_for_review"] ?? 0, color: "text-orange-600" },
            { label: "Posted", value: statusCounts["posted"] ?? 0, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">VA Workflow — After Every Kajabi Live Call</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
            {[
              { step: "1", text: "VA uploads the Kajabi recording to Descript (as normal)" },
              { step: "2", text: "Create session here → paste the Descript project ID → click 'Run Underlord'" },
              { step: "3", text: "Underlord cuts 3 Marketing Reels inside Descript (5–15 min) → VA reviews in Descript → Approve" },
              { step: "4", text: "AI generates Instagram, Facebook, LinkedIn posts + carousel outline + member ask → Copy & post" },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">
                  {step}
                </div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sessions?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No live sessions yet</p>
            <p className="text-sm mt-1">
              After your next Kajabi call, click "New Live Session" and paste the Descript project ID.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions?.map(session => (
              <SessionCard key={session.id} session={session} onRefresh={() => refetch()} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
