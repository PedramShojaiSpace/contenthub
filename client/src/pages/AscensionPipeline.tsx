import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  TrendingUp,
  Users,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  DollarSign,
  Bell,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt$ = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

const fmtDate = (ms: number | null | undefined) =>
  ms ? new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const STAGE_COLORS: Record<string, string> = {
  lights_on: "bg-amber-100 text-amber-800 border-amber-200",
  retreat_eligible: "bg-emerald-100 text-emerald-800 border-emerald-200",
  retreat_registered: "bg-blue-100 text-blue-800 border-blue-200",
  lapsed: "bg-red-100 text-red-800 border-red-200",
};

const STAGE_LABELS: Record<string, string> = {
  lights_on: "Lights On",
  retreat_eligible: "Retreat Eligible",
  retreat_registered: "Retreat Registered",
  lapsed: "Lapsed",
};

const AVATAR_LABELS: Record<string, string> = {
  burned_out_executive: "Burned-Out Executive",
  stressed_parent: "Stressed Parent",
  wellness_seeker: "Wellness Seeker",
  performance_optimizer: "Performance Optimizer",
};

// ─── Add Member Form ──────────────────────────────────────────────────────────
function AddMemberForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [kajabiId, setKajabiId] = useState("");

  const upsert = trpc.ascension.upsertMember.useMutation({
    onSuccess: () => {
      toast.success("Member added to ascension pipeline");
      setEmail(""); setName(""); setAvatar(""); setKajabiId("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <h4 className="font-medium text-sm">Add / Update Member</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Email *</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="member@example.com" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Avatar Type</Label>
          <Select value={avatar} onValueChange={setAvatar}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select avatar" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(AVATAR_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Kajabi Contact ID</Label>
          <Input value={kajabiId} onChange={e => setKajabiId(e.target.value)} placeholder="Optional" className="h-8 text-sm" />
        </div>
      </div>
      <Button
        size="sm"
        disabled={!email || upsert.isPending}
        onClick={() => upsert.mutate({
          email,
          name: name || undefined,
          avatarType: avatar as any || undefined,
          kajabiContactId: kajabiId || undefined,
        })}
      >
        {upsert.isPending ? "Saving…" : "Save Member"}
      </Button>
    </div>
  );
}

// ─── Create Retreat Form ──────────────────────────────────────────────────────
function CreateRetreatForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState("");

  const create = trpc.ascension.createRetreat.useMutation({
    onSuccess: () => {
      toast.success("Retreat created");
      setTitle(""); setLocation(""); setEventDate(""); setEarlyBirdDeadline("");
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <h4 className="font-medium text-sm">Create Retreat Event</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Title *</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Urban Monk Spring Retreat 2026" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Location</Label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Sedona, AZ" className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Event Date *</Label>
          <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Early Bird Deadline</Label>
          <Input type="date" value={earlyBirdDeadline} onChange={e => setEarlyBirdDeadline(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="text-xs text-muted-foreground pt-4">
          Pricing: <strong>$850</strong> early bird · <strong>$1,250</strong> standard · Min 100 capacity
        </div>
      </div>
      <Button
        size="sm"
        disabled={!title || !eventDate || create.isPending}
        onClick={() => create.mutate({
          title,
          location: location || undefined,
          eventDate: new Date(eventDate).getTime(),
          earlyBirdDeadline: earlyBirdDeadline ? new Date(earlyBirdDeadline).getTime() : undefined,
        })}
      >
        {create.isPending ? "Creating…" : "Create Retreat"}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AscensionPipeline() {
  const [renewalWindow, setRenewalWindow] = useState(30);
  const [retreatTakeRate, setRetreatTakeRate] = useState(30);
  const [yearsToProject, setYearsToProject] = useState(3);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateRetreat, setShowCreateRetreat] = useState(false);
  const [memberStageFilter, setMemberStageFilter] = useState<"all" | "lights_on" | "retreat_eligible" | "retreat_registered" | "lapsed">("all");

  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } = trpc.ascension.getPipelineStats.useQuery();
  const { data: renewalQueue, isLoading: renewalLoading } = trpc.ascension.getRenewalQueue.useQuery({ windowDays: renewalWindow });
  const { data: members, isLoading: membersLoading } = trpc.ascension.listMembers.useQuery({ stage: memberStageFilter, limit: 100 });
  const { data: retreats, isLoading: retreatsLoading } = trpc.ascension.listRetreats.useQuery();
  const { data: ltv } = trpc.ascension.getLtvProjection.useQuery({ retreatTakeRatePct: retreatTakeRate, yearsToProject });

  const triggerReminders = trpc.ascension.triggerRenewalReminders.useMutation({
    onSuccess: (d) => {
      toast.success(`Renewal reminders sent: ${d.sent} of ${d.total} members tagged in Kajabi`);
      utils.ascension.getRenewalQueue.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const recordRenewal = trpc.ascension.recordRenewal.useMutation({
    onSuccess: (d) => {
      toast.success(`Renewal recorded — new stage: ${STAGE_LABELS[d.newStage] ?? d.newStage}`);
      utils.ascension.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const promoteStage = trpc.ascension.promoteStage.useMutation({
    onSuccess: () => {
      toast.success("Stage updated");
      utils.ascension.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRetreatStatus = trpc.ascension.updateRetreatStatus.useMutation({
    onSuccess: () => {
      toast.success("Retreat status updated");
      utils.ascension.listRetreats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const refreshAll = () => utils.ascension.invalidate();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ascension Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Lights On ($369/yr) → Retreat Eligible → Retreat ($850–$1,250) · 2 retreats/year
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddMember(!showAddMember)}>
            <Plus className="w-4 h-4 mr-1" /> Add Member
          </Button>
        </div>
      </div>

      {/* Add Member Form */}
      {showAddMember && (
        <AddMemberForm onSuccess={() => { setShowAddMember(false); refreshAll(); }} />
      )}

      {/* Pipeline Scorecards */}
      {statsLoading ? (
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-amber-700">Lights On</span>
                <Users className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-900">{stats.byStage.lights_on}</div>
              <div className="text-xs text-amber-600 mt-1">{fmt$(stats.annualRenewalRevenueCents)}/yr renewal revenue</div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200 bg-emerald-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-emerald-700">Retreat Eligible</span>
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-900">{stats.byStage.retreat_eligible}</div>
              <div className="text-xs text-emerald-600 mt-1">{fmt$(stats.retreatEvRevenueCents)} EV at 30% take</div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-700">Retreat Registered</span>
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-900">{stats.byStage.retreat_registered}</div>
              <div className="text-xs text-blue-600 mt-1">{fmt$(stats.totalRetreatRevenueCents)} collected</div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-700">Lapsed</span>
                <AlertCircle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-900">{stats.byStage.lapsed}</div>
              <div className="text-xs text-red-600 mt-1">{stats.renewalDueSoon} renewal due in 30d</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Total Revenue Summary */}
      {stats && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <div className="text-xs text-muted-foreground">Total Collected</div>
                <div className="text-xl font-bold">{fmt$(stats.totalPaidCents)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Annual Renewal Run Rate</div>
                <div className="text-xl font-bold text-amber-700">{fmt$(stats.annualRenewalRevenueCents)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retreat Revenue (Paid)</div>
                <div className="text-xl font-bold text-blue-700">{fmt$(stats.totalRetreatRevenueCents)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retreat EV (30% take)</div>
                <div className="text-xl font-bold text-emerald-700">{fmt$(stats.retreatEvRevenueCents)}</div>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                Lights On: {fmt$(stats.lightsOnAnnualCents)}/yr · Early Bird: {fmt$(stats.retreatEarlyBirdCents)} · Standard: {fmt$(stats.retreatStandardCents)}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="renewal">
        <TabsList>
          <TabsTrigger value="renewal">Renewal Queue</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="retreats">Retreats</TabsTrigger>
          <TabsTrigger value="ltv">LTV Projector</TabsTrigger>
        </TabsList>

        {/* ── Renewal Queue ── */}
        <TabsContent value="renewal" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Window:</span>
              <div className="flex gap-2">
                {[7, 14, 30, 60, 90].map(d => (
                  <Button
                    key={d}
                    variant={renewalWindow === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRenewalWindow(d)}
                  >
                    {d}d
                  </Button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => triggerReminders.mutate()}
              disabled={triggerReminders.isPending}
            >
              <Bell className="w-4 h-4 mr-1" />
              {triggerReminders.isPending ? "Sending…" : "Send Kajabi Reminders"}
            </Button>
          </div>

          {renewalLoading ? (
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          ) : renewalQueue ? (
            <div className="space-y-4">
              {renewalQueue.overdue.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Overdue ({renewalQueue.overdue.length})
                  </h3>
                  <div className="space-y-2">
                    {renewalQueue.overdue.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50">
                        <div>
                          <div className="font-medium text-sm">{m.name ?? m.email}</div>
                          <div className="text-xs text-muted-foreground">{m.email} · Due: {fmtDate(m.renewalDueDate)}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => recordRenewal.mutate({ memberId: m.id })}>
                            Record Renewal
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600" onClick={() => promoteStage.mutate({ memberId: m.id, newStage: "lapsed" })}>
                            Mark Lapsed
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Due in {renewalWindow} days ({renewalQueue.dueSoon.length}) — {fmt$(renewalQueue.potentialRenewalRevenueCents)} potential
                </h3>
                {renewalQueue.dueSoon.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
                    No renewals due in this window
                  </div>
                ) : (
                  <div className="space-y-2">
                    {renewalQueue.dueSoon.map(m => (
                      <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">{m.name ?? m.email}</div>
                          <div className="text-xs text-muted-foreground">
                            {m.email} · Due: {fmtDate(m.renewalDueDate)} · Renewals: {m.renewalCount}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.renewalReminderSentAt ? (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Reminded
                            </Badge>
                          ) : null}
                          <Button size="sm" variant="outline" onClick={() => recordRenewal.mutate({ memberId: m.id })}>
                            Record Renewal
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Filter:</span>
            <div className="flex gap-2 flex-wrap">
              {(["all", "lights_on", "retreat_eligible", "retreat_registered", "lapsed"] as const).map(s => (
                <Button
                  key={s}
                  variant={memberStageFilter === s ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMemberStageFilter(s)}
                >
                  {s === "all" ? "All" : STAGE_LABELS[s]}
                </Button>
              ))}
            </div>
          </div>

          {membersLoading ? (
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          ) : members && members.length === 0 ? (
            <div className="text-sm text-muted-foreground p-8 border rounded-lg text-center">
              No members yet. Add members manually or sync from Kajabi.
            </div>
          ) : (
            <div className="space-y-2">
              {members?.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-sm">{m.name ?? m.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.email}
                        {m.avatarType ? ` · ${AVATAR_LABELS[m.avatarType] ?? m.avatarType}` : ""}
                        {m.renewalCount > 0 ? ` · ${m.renewalCount} renewal${m.renewalCount > 1 ? "s" : ""}` : ""}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs border ${STAGE_COLORS[m.stage] ?? ""}`}>
                      {STAGE_LABELS[m.stage] ?? m.stage}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{fmt$(m.totalPaidCents)}</div>
                    {m.stage === "retreat_eligible" && (
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => promoteStage.mutate({ memberId: m.id, newStage: "retreat_registered" })}>
                        Register for Retreat
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Retreats ── */}
        <TabsContent value="retreats" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">2 retreats/year · Min 100 capacity · Early bird $850 · Standard $1,250</p>
            <Button size="sm" onClick={() => setShowCreateRetreat(!showCreateRetreat)}>
              <Plus className="w-4 h-4 mr-1" /> Create Retreat
            </Button>
          </div>

          {showCreateRetreat && (
            <CreateRetreatForm onSuccess={() => { setShowCreateRetreat(false); utils.ascension.listRetreats.invalidate(); }} />
          )}

          {retreatsLoading ? (
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          ) : retreats && retreats.length === 0 ? (
            <div className="text-sm text-muted-foreground p-8 border rounded-lg text-center">
              No retreats scheduled yet.
            </div>
          ) : (
            <div className="space-y-3">
              {retreats?.map(r => {
                const now = Date.now();
                const isEarlyBird = r.earlyBirdDeadline ? now < r.earlyBirdDeadline : false;
                const currentPrice = isEarlyBird ? r.earlyBirdPriceCents : r.standardPriceCents;
                const fillPct = Math.round((r.registeredCount / r.capacityMax) * 100);

                return (
                  <Card key={r.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold">{r.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {r.location ?? "Location TBD"} · {fmtDate(r.eventDate)}
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-sm">
                            <span className={isEarlyBird ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
                              {isEarlyBird ? `Early Bird: ${fmt$(r.earlyBirdPriceCents)}` : `Standard: ${fmt$(r.standardPriceCents)}`}
                            </span>
                            {r.earlyBirdDeadline && isEarlyBird && (
                              <span className="text-xs text-muted-foreground">Early bird ends {fmtDate(r.earlyBirdDeadline)}</span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2 text-sm">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${fillPct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{r.registeredCount}/{r.capacityMax} registered ({fillPct}%)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${r.status === "open" || r.status === "early_bird" ? "bg-emerald-100 text-emerald-800" : r.status === "closed" ? "bg-red-100 text-red-800" : "bg-muted text-muted-foreground"}`}>
                            {r.status}
                          </Badge>
                          <Select
                            value={r.status}
                            onValueChange={(v) => updateRetreatStatus.mutate({ retreatId: r.id, status: v as any })}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["upcoming", "open", "early_bird", "closed", "completed"].map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── LTV Projector ── */}
        <TabsContent value="ltv" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Retreat Take Rate: {retreatTakeRate}%</Label>
                <p className="text-xs text-muted-foreground mb-2">% of retreat-eligible members who attend a retreat</p>
                <Slider
                  value={[retreatTakeRate]}
                  onValueChange={([v]) => setRetreatTakeRate(v)}
                  min={5} max={80} step={5}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Projection Window: {yearsToProject} year{yearsToProject > 1 ? "s" : ""}</Label>
                <p className="text-xs text-muted-foreground mb-2">How far out to project revenue</p>
                <Slider
                  value={[yearsToProject]}
                  onValueChange={([v]) => setYearsToProject(v)}
                  min={1} max={5} step={1}
                  className="w-full"
                />
              </div>
            </div>

            {ltv && (
              <div className="space-y-3">
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Active Members</span>
                      <span className="font-medium">{ltv.activeMembers}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Retreat Eligible</span>
                      <span className="font-medium">{ltv.retreatEligible}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between text-sm">
                      <span className="text-muted-foreground">Annual Renewal Revenue</span>
                      <span className="font-semibold text-amber-700">{fmt$(ltv.annualRenewalRevenueCents)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Retreat Revenue/Year ({retreatTakeRate}% take)</span>
                      <span className="font-semibold text-blue-700">{fmt$(ltv.retreatRevenuePerYearCents)}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="font-semibold">{yearsToProject}-Year Projection</span>
                      <span className="font-bold text-xl text-primary">{fmt$(ltv.projectedRevenueCents)}</span>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground">
                  Lights On: {fmt$(ltv.lightsOnAnnualCents)}/yr · Early Bird: {fmt$(ltv.retreatEarlyBirdCents)} · Standard: {fmt$(ltv.retreatStandardCents)} · 2 retreats/year
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
