import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Sparkles, CheckCircle, Clock, FileText, Copy,
  ChevronDown, ChevronUp, Layers, MessageSquare, Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type Session = {
  id: number; title: string; sessionDate: number;
  transcript: string | null; bestClipStart: number | null; bestClipEnd: number | null;
  bestClipReason: string | null; sharePostDraft: string | null;
  sharePostInstagram: string | null; sharePostLinkedin: string | null;
  sharePostFacebook: string | null; memberAskText: string | null;
  carouselSlides: Array<{ heading: string; body: string }>;
  status: string; notes: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-gray-100 text-gray-700", transcribing: "bg-yellow-100 text-yellow-700",
  clips_ready: "bg-blue-100 text-blue-700", drafting: "bg-purple-100 text-purple-700",
  ready_for_review: "bg-orange-100 text-orange-700", approved: "bg-green-100 text-green-700",
  posted: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded", transcribing: "Transcribing", clips_ready: "Transcript Ready",
  drafting: "Generating...", ready_for_review: "Ready for Review",
  approved: "Approved", posted: "Posted",
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`));
}

function SessionCard({ session, onRefresh }: { session: Session; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [transcriptText, setTranscriptText] = useState(session.transcript ?? "");
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    sharePostInstagram: session.sharePostInstagram ?? "",
    sharePostLinkedin: session.sharePostLinkedin ?? "",
    sharePostFacebook: session.sharePostFacebook ?? "",
    memberAskText: session.memberAskText ?? "",
  });

  const saveTranscript = trpc.kajabiLive.saveTranscript.useMutation({
    onSuccess: () => { toast.success("Transcript saved"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const generateContent = trpc.kajabiLive.generateContent.useMutation({
    onSuccess: () => { toast.success("Content generated!"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const updateSession = trpc.kajabiLive.update.useMutation({
    onSuccess: () => { toast.success("Saved"); onRefresh(); setEditingPost(null); },
    onError: (e) => toast.error(e.message),
  });
  const approve = trpc.kajabiLive.approve.useMutation({
    onSuccess: () => { toast.success("Session approved!"); onRefresh(); },
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

  const hasContent = session.sharePostInstagram || session.sharePostLinkedin || session.sharePostFacebook;
  const statusColor = STATUS_COLORS[session.status] ?? "bg-gray-100 text-gray-700";
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{session.title}</h3>
            <p className="text-sm text-muted-foreground">{new Date(session.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>{statusLabel}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> Step 1 — Paste Transcript
            </h4>
            <p className="text-xs text-muted-foreground mb-2">Export from Kajabi, Otter.ai, or any transcription tool and paste below.</p>
            <Textarea value={transcriptText} onChange={(e) => setTranscriptText(e.target.value)} placeholder="Paste the full call transcript here..." className="min-h-[120px] text-sm font-mono" />
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => saveTranscript.mutate({ id: session.id, transcript: transcriptText })} disabled={saveTranscript.isPending || transcriptText.length < 50}>
                {saveTranscript.isPending ? "Saving..." : "Save Transcript"}
              </Button>
              {(session.status === "clips_ready" || (session.transcript && session.transcript.length > 50)) && (
                <Button size="sm" onClick={() => generateContent.mutate({ id: session.id })} disabled={generateContent.isPending} className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  {generateContent.isPending ? "Generating..." : "Generate All Content"}
                </Button>
              )}
            </div>
          </div>

          {session.bestClipStart !== null && session.bestClipEnd !== null && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-amber-800 mb-1 flex items-center gap-2"><Clock className="w-4 h-4" /> Best Clip to Extract</h4>
              <p className="text-sm text-amber-700 font-mono">{session.bestClipStart}:00 – {session.bestClipEnd}:00</p>
              {session.bestClipReason && <p className="text-xs text-amber-600 mt-1">{session.bestClipReason}</p>}
              <p className="text-xs text-amber-600 mt-2 italic">→ Open the Kajabi recording, scrub to this timestamp, and clip it for Reels/Shorts.</p>
            </div>
          )}

          {hasContent && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Step 2 — Review & Post Social Content</h4>
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
                          <Textarea value={editValues[key as keyof typeof editValues]} onChange={(e) => setEditValues(prev => ({ ...prev, [key]: e.target.value }))} className="text-sm min-h-[80px]" />
                          <Button size="sm" className="mt-2" onClick={() => updateSession.mutate({ id: session.id, [key]: editValues[key as keyof typeof editValues] })} disabled={updateSession.isPending}>Save</Button>
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

          {session.carouselSlides && session.carouselSlides.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Step 3 — Carousel Slides</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {session.carouselSlides.map((slide, i) => (
                  <div key={i} className="bg-muted/40 rounded-lg p-3 border border-border">
                    <div className="text-xs font-bold text-primary mb-1">Slide {i + 1}</div>
                    <div className="text-sm font-semibold text-foreground mb-1">{slide.heading}</div>
                    <div className="text-xs text-muted-foreground">{slide.body}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">→ Use Creation Studio → Carousel to generate images, then push to Buffer.</p>
            </div>
          )}

          {session.memberAskText && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-green-800 mb-1 flex items-center gap-2"><Users className="w-4 h-4" /> Step 4 — Member Share Ask (Read at End of Next Call)</h4>
              <p className="text-sm text-green-700 italic">"{session.memberAskText}"</p>
              <Button size="sm" variant="ghost" className="mt-2 h-6 px-2 text-xs text-green-700" onClick={() => copyToClipboard(session.memberAskText!, "Member ask text")}>
                <Copy className="w-3 h-3 mr-1" /> Copy for Teleprompter
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            {session.status === "ready_for_review" && (
              <Button size="sm" onClick={() => approve.mutate({ id: session.id })} disabled={approve.isPending} className="gap-2">
                <CheckCircle className="w-4 h-4" /> Approve All Content
              </Button>
            )}
            {session.status === "approved" && (
              <Button size="sm" variant="outline" onClick={() => markPosted.mutate({ id: session.id })} disabled={markPosted.isPending} className="gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" /> Mark as Posted
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto" onClick={() => { if (confirm("Delete this session?")) deleteSession.mutate({ id: session.id }); }}>
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
  const [recordingUrl, setRecordingUrl] = useState("");

  const create = trpc.kajabiLive.create.useMutation({
    onSuccess: () => { toast.success("Session created"); setOpen(false); setTitle(""); setDate(new Date().toISOString().split("T")[0]); setRecordingUrl(""); onCreated(); },
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
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Q&A — Gut Health Deep Dive" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Recording URL (optional)</label>
            <Input value={recordingUrl} onChange={(e) => setRecordingUrl(e.target.value)} placeholder="https://kajabi.com/..." />
          </div>
          <Button className="w-full" onClick={() => create.mutate({ title, sessionDate: new Date(date).getTime(), recordingUrl: recordingUrl || undefined })} disabled={create.isPending || !title || !date}>
            {create.isPending ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function KajabiLiveHub() {
  const { data: sessions, isLoading, refetch } = trpc.kajabiLive.list.useQuery();
  const statusCounts = (sessions ?? []).reduce((acc, s) => { acc[s.status] = (acc[s.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Kajabi Live Hub</h1>
            <p className="text-muted-foreground mt-1">Turn your weekly live calls into social content — automatically.</p>
          </div>
          <NewSessionDialog onCreated={() => refetch()} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Sessions", value: sessions?.length ?? 0, color: "text-foreground" },
            { label: "Ready for Review", value: statusCounts["ready_for_review"] ?? 0, color: "text-orange-600" },
            { label: "Approved", value: statusCounts["approved"] ?? 0, color: "text-green-600" },
            { label: "Posted", value: statusCounts["posted"] ?? 0, color: "text-emerald-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-border rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">VA Workflow — After Every Live Call</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-muted-foreground">
            {[
              { step: "1", text: "Create session → paste transcript from Kajabi/Otter.ai" },
              { step: "2", text: "Click 'Generate All Content' → AI identifies best clip + writes all posts" },
              { step: "3", text: "Review and edit posts → Approve" },
              { step: "4", text: "Copy posts to Instagram, Facebook, LinkedIn → Mark as Posted" },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-2">
                <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">{step}</div>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}</div>
        ) : sessions?.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No live sessions yet</p>
            <p className="text-sm mt-1">Click "New Live Session" after your next Kajabi call to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions?.map(session => <SessionCard key={session.id} session={session} onRefresh={() => refetch()} />)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
