import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Zap,
  Shield,
  TrendingUp,
  MessageSquare,
  Hash,
  Info,
} from "lucide-react";

// ─── Phase badge colors ───────────────────────────────────────────────────────
const phaseBadge: Record<string, { label: string; className: string }> = {
  warmup: { label: "Warmup", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  active: { label: "Active", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  paused: { label: "Paused", className: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  retired: { label: "Retired", className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

// ─── Task type labels ─────────────────────────────────────────────────────────
const taskTypeLabel: Record<string, { label: string; icon: React.ReactNode }> = {
  upvote_session: { label: "Upvote Session", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  comment: { label: "Comment", icon: <MessageSquare className="h-3.5 w-3.5" /> },
  question_post: { label: "Question Post", icon: <Hash className="h-3.5 w-3.5" /> },
  non_um_share: { label: "Non-UM Share", icon: <ExternalLink className="h-3.5 w-3.5" /> },
};

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${color}`}>
      <div className="opacity-70">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

// ─── Persona card ─────────────────────────────────────────────────────────────
function PersonaCard({ personaId }: { personaId: number }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.redditPersonas.getPersona.useQuery({ personaId });

  const generateContent = trpc.redditPersonas.generateWarmupContent.useMutation({
    onSuccess: () => {
      utils.redditPersonas.getPersona.invalidate({ personaId });
      toast.success("Content generated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const completeTask = trpc.redditPersonas.completeWarmupTask.useMutation({
    onSuccess: () => {
      utils.redditPersonas.getPersona.invalidate({ personaId });
      utils.redditPersonas.getDashboardStats.invalidate();
      toast.success("Task marked complete!");
    },
    onError: (e) => toast.error(e.message),
  });

  const markPosted = trpc.redditPersonas.markPosted.useMutation({
    onSuccess: () => {
      utils.redditPersonas.getPersona.invalidate({ personaId });
      utils.redditPersonas.getDashboardStats.invalidate();
      toast.success("Post marked as posted!");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePersona = trpc.redditPersonas.updatePersona.useMutation({
    onSuccess: () => {
      utils.redditPersonas.getPersona.invalidate({ personaId });
      utils.redditPersonas.listPersonas.invalidate();
      utils.redditPersonas.getDashboardStats.invalidate();
      toast.success("Persona updated!");
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePersona = trpc.redditPersonas.deletePersona.useMutation({
    onSuccess: () => {
      utils.redditPersonas.listPersonas.invalidate();
      utils.redditPersonas.getDashboardStats.invalidate();
      toast.success("Persona deleted.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="rounded-lg border border-border bg-[#161b22] p-4 animate-pulse h-24" />;
  }

  const { persona, warmupTasks, postQueue } = data;
  const now = Date.now();
  const accountAgeMs = persona.accountCreatedAt ? now - persona.accountCreatedAt : now - persona.createdAt;
  const accountAgeDays = Math.floor(accountAgeMs / 86400000);
  const warmupDayProgress = Math.min(accountAgeDays, 30);
  const progressPct = Math.round((warmupDayProgress / 30) * 100);

  const todayTasks = warmupTasks.filter(t => {
    const taskDate = new Date(t.scheduledFor);
    const today = new Date();
    return (
      t.status === "pending" &&
      taskDate.getFullYear() === today.getFullYear() &&
      taskDate.getMonth() === today.getMonth() &&
      taskDate.getDate() === today.getDate()
    );
  });

  const pendingTasks = warmupTasks.filter(t => t.status === "pending" && t.scheduledFor <= now);
  const completedTasks = warmupTasks.filter(t => t.status === "completed");
  const readyPosts = postQueue.filter(p => p.status === "ready");
  const queuedPosts = postQueue.filter(p => p.status === "queued");

  const phase = phaseBadge[persona.phase] || phaseBadge.warmup;

  return (
    <div className="rounded-lg border border-border bg-[#161b22] overflow-hidden">
      {/* Card header */}
      <div
        className="p-4 cursor-pointer flex items-center gap-3 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
          {persona.username.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">u/{persona.username}</span>
            <Badge className={`text-[10px] px-1.5 py-0 border ${phase.className}`}>{phase.label}</Badge>
            <span className="text-xs text-muted-foreground">VA: {persona.vaName} (Slot {persona.accountSlot})</span>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-muted-foreground">
              <span className="text-white font-medium">{persona.karma}</span> karma
            </span>
            <span className="text-xs text-muted-foreground">
              Day <span className="text-white font-medium">{warmupDayProgress}</span>/30
            </span>
            {todayTasks.length > 0 && (
              <span className="text-xs text-yellow-400 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {todayTasks.length} task{todayTasks.length > 1 ? "s" : ""} today
              </span>
            )}
            {readyPosts.length > 0 && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Zap className="h-3 w-3" /> {readyPosts.length} ready to post
              </span>
            )}
          </div>
          {/* Progress bar */}
          {persona.phase === "warmup" && (
            <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden w-full max-w-xs">
              <div
                className="h-full bg-yellow-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border">
          <Tabs defaultValue="warmup" className="p-4">
            <TabsList className="bg-white/5 mb-4">
              <TabsTrigger value="warmup">Warmup Tasks ({pendingTasks.length} pending)</TabsTrigger>
              <TabsTrigger value="queue">Post Queue ({postQueue.length})</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Warmup tasks tab */}
            <TabsContent value="warmup" className="space-y-3">
              {pendingTasks.length === 0 && completedTasks.length > 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  All warmup tasks complete! {persona.karma >= 50 ? "Account is ready to go active." : `Needs ${50 - persona.karma} more karma to go active.`}
                </div>
              )}
              {pendingTasks.slice(0, 10).map((task) => (
                <div key={task.id} className="rounded-md border border-border bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {taskTypeLabel[task.taskType]?.icon}
                          {taskTypeLabel[task.taskType]?.label}
                        </span>
                        <span className="text-xs text-primary">r/{task.subreddit}</span>
                        <span className="text-xs text-muted-foreground">Day {task.dayNumber}</span>
                      </div>
                      {task.instructions && (
                        <p className="text-xs text-muted-foreground mb-2">{task.instructions}</p>
                      )}
                      {task.content && task.content !== "[AI will generate comment content when you click \"Generate Content\" for this task]" && task.content !== "[AI will generate question content when you click \"Generate Content\" for this task]" && (
                        <div className="bg-black/30 rounded p-2 text-xs text-white/80 whitespace-pre-wrap mb-2">
                          {task.content}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {(task.taskType === "comment" || task.taskType === "question_post") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => generateContent.mutate({ taskId: task.id })}
                        disabled={generateContent.isPending}
                      >
                        {generateContent.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Zap className="h-3 w-3 mr-1" />}
                        Generate Content
                      </Button>
                    )}
                    {task.content && task.taskType !== "upvote_session" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(task.content || "");
                          toast.success("Copied!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white ml-auto"
                      onClick={() => completeTask.mutate({ taskId: task.id })}
                      disabled={completeTask.isPending}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                    </Button>
                  </div>
                </div>
              ))}
              {pendingTasks.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">+{pendingTasks.length - 10} more tasks scheduled ahead</p>
              )}
            </TabsContent>

            {/* Post queue tab */}
            <TabsContent value="queue" className="space-y-3">
              {postQueue.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No posts in queue. Add content from the Content Hub.
                </div>
              )}
              {postQueue.map((post) => (
                <div key={post.id} className={`rounded-md border p-3 ${post.status === "ready" ? "border-green-500/30 bg-green-500/5" : post.status === "posted" ? "border-white/10 bg-white/5 opacity-60" : "border-border bg-white/5"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{post.postTitle}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-primary">r/{post.subreddit}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${post.status === "ready" ? "bg-green-500/20 text-green-400" : post.status === "posted" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {post.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {post.disclosureText && (
                    <div className="flex items-start gap-1.5 mb-2 p-2 bg-orange-500/10 rounded border border-orange-500/20">
                      <Shield className="h-3.5 w-3.5 text-orange-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-orange-300">{post.disclosureText}</p>
                    </div>
                  )}
                  <div className="bg-black/30 rounded p-2 text-xs text-white/70 whitespace-pre-wrap max-h-32 overflow-y-auto mb-2">
                    {post.postBody}
                  </div>
                  {post.status !== "posted" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(post.postBody);
                          toast.success("Post body copied!");
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1" /> Copy Post
                      </Button>
                      {post.status === "ready" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => markPosted.mutate({ queueItemId: post.id })}
                          disabled={markPosted.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Posted
                        </Button>
                      )}
                    </div>
                  )}
                  {post.status === "queued" && (
                    <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Waiting for warmup completion + 50 karma
                    </p>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* Settings tab */}
            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Current Karma</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      defaultValue={persona.karma}
                      className="h-8 text-sm bg-black/30"
                      id={`karma-${persona.id}`}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs shrink-0"
                      onClick={() => {
                        const val = parseInt((document.getElementById(`karma-${persona.id}`) as HTMLInputElement)?.value || "0");
                        updatePersona.mutate({ personaId: persona.id, karma: val });
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Phase</Label>
                  <Select
                    defaultValue={persona.phase}
                    onValueChange={(v) => updatePersona.mutate({ personaId: persona.id, phase: v as any })}
                  >
                    <SelectTrigger className="h-8 text-sm bg-black/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="warmup">Warmup</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Credential Infrastructure Section */}
              <div className="border border-amber-500/30 rounded-lg p-3 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">🔐 Credential Infrastructure</span>
                  <span className="text-xs text-amber-400/70">(owner-controlled)</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Persona Email</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        defaultValue={persona.personaEmail ?? ""}
                        placeholder="maria@mariawellness.com"
                        className="h-8 text-sm bg-black/30"
                        id={`email-${persona.id}`}
                      />
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs shrink-0"
                        onClick={() => {
                          const val = (document.getElementById(`email-${persona.id}`) as HTMLInputElement)?.value;
                          updatePersona.mutate({ personaId: persona.id, personaEmail: val });
                        }}
                      >Save</Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Persona Domain</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        defaultValue={persona.personaDomain ?? ""}
                        placeholder="mariawellness.com"
                        className="h-8 text-sm bg-black/30"
                        id={`domain-${persona.id}`}
                      />
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs shrink-0"
                        onClick={() => {
                          const val = (document.getElementById(`domain-${persona.id}`) as HTMLInputElement)?.value;
                          updatePersona.mutate({ personaId: persona.id, personaDomain: val });
                        }}
                      >Save</Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Proxy IP</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        defaultValue={persona.proxyIp ?? ""}
                        placeholder="104.28.x.x"
                        className="h-8 text-sm bg-black/30"
                        id={`proxy-${persona.id}`}
                      />
                      <Button
                        size="sm" variant="outline" className="h-8 text-xs shrink-0"
                        onClick={() => {
                          const val = (document.getElementById(`proxy-${persona.id}`) as HTMLInputElement)?.value;
                          updatePersona.mutate({ personaId: persona.id, proxyIp: val });
                        }}
                      >Save</Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Credentials Held By</Label>
                    <Select
                      defaultValue={persona.credentialsHeldBy ?? "owner"}
                      onValueChange={(v) => updatePersona.mutate({ personaId: persona.id, credentialsHeldBy: v as "owner" | "va" })}
                    >
                      <SelectTrigger className="h-8 text-sm bg-black/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">✅ Owner (Pedram) — secure</SelectItem>
                        <SelectItem value="va">⚠️ VA — insecure, fix ASAP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-amber-400/60">Email password must be held by owner only. VA gets Reddit login only. One domain per persona — never share a domain across personas.</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Backstory</Label>
                <div className="bg-black/30 rounded p-2 text-xs text-white/70 whitespace-pre-wrap">{persona.backstory}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Reddit Bio</Label>
                <div className="bg-black/30 rounded p-2 text-xs text-white/70">{persona.bio}</div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="h-8 text-xs"
                onClick={() => {
                  if (confirm(`Delete persona u/${persona.username}? This cannot be undone.`)) {
                    deletePersona.mutate({ personaId: persona.id });
                  }
                }}
              >
                Delete Persona
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

// ─── Add persona dialog ───────────────────────────────────────────────────────
function AddPersonaDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [vaName, setVaName] = useState("");
  const [slot, setSlot] = useState("1");
  const [username, setUsername] = useState("");

  const createPersona = trpc.redditPersonas.createPersona.useMutation({
    onSuccess: (data) => {
      toast.success(`Persona u/${data.username} created with 30-day warmup schedule!`);
      setOpen(false);
      setVaName("");
      setSlot("1");
      setUsername("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Persona
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#161b22] border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Create Reddit Persona</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-sm mb-1.5 block">VA Name</Label>
            <Input
              placeholder="e.g. Maria, Ana, Joy"
              value={vaName}
              onChange={e => setVaName(e.target.value)}
              className="bg-black/30"
            />
            <p className="text-xs text-muted-foreground mt-1">The VA's real name (for internal tracking only)</p>
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">Account Slot</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="bg-black/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Slot 1 (Primary account)</SelectItem>
                <SelectItem value="2">Slot 2 (Secondary account)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm mb-1.5 block">Reddit Username (optional)</Label>
            <Input
              placeholder="Leave blank for AI suggestion"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="bg-black/30"
            />
            <p className="text-xs text-muted-foreground mt-1">If blank, AI will suggest a wellness-themed username</p>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
            <p className="text-xs text-yellow-300 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              AI will generate a persona backstory and 30-day warmup schedule. The VA must create the Reddit account manually before starting warmup tasks.
            </p>
          </div>
          <Button
            className="w-full"
            onClick={() => createPersona.mutate({ vaName, accountSlot: parseInt(slot), username: username || undefined })}
            disabled={!vaName || createPersona.isPending}
          >
            {createPersona.isPending ? (
              <><RefreshCw className="h-4 w-4 animate-spin mr-2" /> Generating backstory + schedule…</>
            ) : (
              <><Plus className="h-4 w-4 mr-2" /> Create Persona</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pedram's account setup panel ────────────────────────────────────────────
function PedramAccountPanel() {
  return (
    <Card className="bg-[#161b22] border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          u/PedramShojai — Official Brand Presence Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
          <p className="text-blue-300 text-xs flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Security note:</strong> Pedram's account should NEVER be accessed by VAs. It is the official brand account for AMAs, direct engagement, and verified presence only. VAs use their own personas.</span>
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommended Setup Steps</h4>

          <div className="space-y-2">
            {[
              { step: "1", title: "Complete the profile", desc: "Add professional headshot, full bio mentioning OMD credentials, author of 'Urban Monk' and 'Exhausted to Energized', link to theurbanmonk.com" },
              { step: "2", title: "Verify with Reddit", desc: "Apply for verified status if eligible. Add flair in relevant subreddits as 'Dr. Pedram Shojai, OMD'" },
              { step: "3", title: "Post an intro AMA", desc: "Post 'I'm Dr. Pedram Shojai, OMD — author, filmmaker, and founder of The Urban Monk. AMA about functional medicine, longevity, and ancient wisdom.' in r/FunctionalMedicine, r/longevity, r/Biohackers" },
              { step: "4", title: "Engage authentically", desc: "Reply to 3-5 comments per week in target subreddits. Never hard-sell. Share insights from your books and clinical experience." },
              { step: "5", title: "Coordinate with VA strategy", desc: "VAs should NOT tag or reference Pedram's account in their posts. The two strategies run in parallel, not together." },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{item.step}</div>
                <div>
                  <p className="text-white font-medium text-xs">{item.title}</p>
                  <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Subreddits for Pedram</h4>
          <div className="flex flex-wrap gap-1.5">
            {["FunctionalMedicine", "longevity", "Biohackers", "Meditation", "Ayurveda", "HolisticHealth", "guthealth"].map(sub => (
              <Badge key={sub} variant="outline" className="text-[10px] text-primary border-primary/30">r/{sub}</Badge>
            ))}
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded p-3">
          <p className="text-orange-300 text-xs">
            <strong>FTC Disclosure reminder:</strong> Even Pedram's own account must disclose when sharing Urban Monk Academy or supplement links: "I'm the founder of The Urban Monk Academy — sharing this because I believe in it."
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function RedditPersonas() {
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.redditPersonas.getDashboardStats.useQuery();
  const { data: personas, isLoading: personasLoading } = trpc.redditPersonas.listPersonas.useQuery();

  const handlePersonaCreated = () => {
    utils.redditPersonas.listPersonas.invalidate();
    utils.redditPersonas.getDashboardStats.invalidate();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Hash className="h-6 w-6 text-primary" />
            Reddit Persona Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage 6 VA Reddit personas (3 VAs × 2 accounts). 30-day warmup → active posting with FTC disclosure.
          </p>
        </div>
        <AddPersonaDialog onCreated={handlePersonaCreated} />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Personas" value={stats?.totalPersonas ?? "—"} icon={<Users className="h-5 w-5" />} color="border-border bg-[#161b22]" />
        <StatCard label="In Warmup" value={stats?.warmupCount ?? "—"} icon={<Clock className="h-5 w-5 text-yellow-400" />} color="border-yellow-500/20 bg-yellow-500/5" />
        <StatCard label="Active" value={stats?.activeCount ?? "—"} icon={<CheckCircle2 className="h-5 w-5 text-green-400" />} color="border-green-500/20 bg-green-500/5" />
        <StatCard label="Total Karma" value={stats?.totalKarma ?? "—"} icon={<TrendingUp className="h-5 w-5 text-blue-400" />} color="border-blue-500/20 bg-blue-500/5" />
        <StatCard label="Ready to Post" value={stats?.readyToPost ?? "—"} icon={<Zap className="h-5 w-5 text-primary" />} color="border-primary/20 bg-primary/5" />
      </div>

      {/* FTC disclosure reminder */}
      <div className="flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
        <Shield className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
        <div className="text-xs text-orange-300">
          <strong>FTC Disclosure required on ALL Urban Monk posts:</strong> "Disclosure: I work with The Urban Monk team and genuinely find this content valuable." — This is automatically included in all AI-generated post queue items.
        </div>
      </div>

      {/* Persona cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          VA Personas ({personas?.length ?? 0}/6)
        </h2>
        {personasLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-lg border border-border bg-[#161b22] animate-pulse" />)}
          </div>
        )}
        {!personasLoading && personas?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No personas yet. Create up to 6 (3 VAs × 2 accounts each).</p>
            <p className="text-xs mt-1 opacity-60">Each persona gets an AI-generated backstory and 30-day warmup schedule.</p>
          </div>
        )}
        {personas?.map(persona => (
          <PersonaCard key={persona.id} personaId={persona.id} />
        ))}
      </div>

      {/* Pedram's account setup */}
      <PedramAccountPanel />
    </div>
  );
}
