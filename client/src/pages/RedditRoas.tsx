import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Link2,
  MessageSquare,
  Plus,
  Copy,
  ExternalLink,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Minus,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtRoas(roas: number | null) {
  if (roas === null) return "—";
  return `${roas.toFixed(2)}x`;
}

function roasColor(roas: number | null) {
  if (roas === null) return "text-muted-foreground";
  if (roas >= 2) return "text-emerald-400";
  if (roas >= 1) return "text-amber-400";
  return "text-red-400";
}

function sourceLabel(source: string) {
  if (source === "redrover") return { label: "RedRover", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
  if (source === "pedram") return { label: "Pedram", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
  return { label: "VA", color: "bg-slate-500/20 text-slate-300 border-slate-500/30" };
}

// ─── New Campaign Dialog ───────────────────────────────────────────────────────

function NewCampaignDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [source, setSource] = useState<"redrover" | "va" | "pedram">("redrover");
  const [skuLabel, setSkuLabel] = useState("");
  const [monthlySpend, setMonthlySpend] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = trpc.redditRoas.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign created");
      setOpen(false);
      setName(""); setSource("redrover"); setSkuLabel(""); setMonthlySpend(""); setUtmCampaign(""); setNotes("");
      onCreated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast.error("Campaign name required");
    if (!utmCampaign.trim()) return toast.error("UTM campaign slug required");
    createMutation.mutate({
      name: name.trim(),
      source,
      skuLabel: skuLabel.trim() || undefined,
      monthlySpendCents: Math.round(parseFloat(monthlySpend || "0") * 100),
      utmCampaign: utmCampaign.trim().toLowerCase().replace(/\s+/g, "-"),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1f2e] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">New Reddit Campaign</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Campaign Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RedRover Gut Health Q3" className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Source</label>
            <Select value={source} onValueChange={(v) => setSource(v as any)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                <SelectItem value="redrover">RedRover (Agency)</SelectItem>
                <SelectItem value="va">In-House VA</SelectItem>
                <SelectItem value="pedram">Pedram (Direct)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">SKU / Product Label</label>
            <Input value={skuLabel} onChange={e => setSkuLabel(e.target.value)} placeholder="e.g. SymbioFit Gut Test $399" className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Monthly Spend ($)</label>
            <Input type="number" value={monthlySpend} onChange={e => setMonthlySpend(e.target.value)} placeholder="e.g. 1800" className="bg-white/5 border-white/10 text-white" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">UTM Campaign Slug <span className="text-white/40">(lowercase, no spaces)</span></label>
            <Input value={utmCampaign} onChange={e => setUtmCampaign(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="e.g. gut-health-q3-redrover" className="bg-white/5 border-white/10 text-white font-mono text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Notes</label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contract terms, target subreddits, etc." className="bg-white/5 border-white/10 text-white" />
          </div>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
            {createMutation.isPending ? "Creating..." : "Create Campaign"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Generate Link Dialog ──────────────────────────────────────────────────────

function GenerateLinkDialog({ campaignId, utmCampaign, onGenerated }: { campaignId: number; utmCampaign: string; onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [destinationBase, setDestinationBase] = useState("https://theurbanmonkstore.myshopify.com/products/");
  const [subreddit, setSubreddit] = useState("");
  const [postType, setPostType] = useState<"question" | "comment" | "direct_post">("direct_post");
  const [postedBy, setPostedBy] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const generateMutation = trpc.redditRoas.generateLink.useMutation({
    onSuccess: (data) => {
      setGeneratedUrl(data.destinationUrl);
      onGenerated();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      toast.success("UTM link copied!");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setGeneratedUrl(null); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-white/10 text-white/70 hover:text-white gap-1.5 text-xs">
          <Link2 className="w-3 h-3" /> Generate Link
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#1a1f2e] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Generate UTM Tracking Link</DialogTitle>
        </DialogHeader>
        {!generatedUrl ? (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Destination URL (product page)</label>
              <Input value={destinationBase} onChange={e => setDestinationBase(e.target.value)} className="bg-white/5 border-white/10 text-white text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Subreddit</label>
                <Input value={subreddit} onChange={e => setSubreddit(e.target.value)} placeholder="r/GutHealth" className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Post Type</label>
                <Select value={postType} onValueChange={(v) => setPostType(v as any)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                    <SelectItem value="direct_post">Direct Post</SelectItem>
                    <SelectItem value="question">Question Seed</SelectItem>
                    <SelectItem value="comment">Comment Reply</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Posted By (VA name or "RedRover")</label>
              <Input value={postedBy} onChange={e => setPostedBy(e.target.value)} placeholder="e.g. Maria-VA2 or RedRover" className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="bg-white/5 rounded p-3 text-xs text-white/50">
              UTM tags auto-applied: <span className="text-white/70 font-mono">utm_source=reddit&utm_medium=organic&utm_campaign={utmCampaign}&utm_content=[auto]</span>
            </div>
            <Button onClick={() => generateMutation.mutate({ campaignId, destinationBase, subreddit: subreddit || undefined, postType, postedBy: postedBy || undefined })}
              disabled={generateMutation.isPending || !destinationBase}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white">
              {generateMutation.isPending ? "Generating..." : "Generate Tracking Link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-3">
              <p className="text-xs text-emerald-400 mb-2 font-medium">✓ Tracking link generated — copy and use in your Reddit post</p>
              <p className="text-xs font-mono text-white/80 break-all">{generatedUrl}</p>
            </div>
            <Button onClick={handleCopy} className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2">
              <Copy className="w-4 h-4" /> Copy Link
            </Button>
            <p className="text-xs text-white/40 text-center">When a customer clicks this link and purchases, the sale will be automatically attributed to this campaign.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({ stat, onRefresh }: { stat: any; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const { campaign, totalRevenueCents, totalConversions, totalPosts, spendDollars, revenueDollars, roas, bestLink, recentConversions } = stat;
  const src = sourceLabel(campaign.source);

  const linksQuery = trpc.redditRoas.listLinks.useQuery(
    { campaignId: campaign.id },
    { enabled: expanded }
  );

  const updateLink = trpc.redditRoas.updateLink.useMutation({
    onSuccess: () => { linksQuery.refetch(); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  const updateCampaign = trpc.redditRoas.updateCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign updated"); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${src.color}`}>{src.label}</span>
            {campaign.skuLabel && <span className="text-xs text-white/50">{campaign.skuLabel}</span>}
            {!campaign.active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">Ended</span>}
          </div>
          <h3 className="font-semibold text-white truncate">{campaign.name}</h3>
          <p className="text-xs text-white/40 font-mono mt-0.5">utm_campaign={campaign.utmCampaign}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-2xl font-bold ${roasColor(roas)}`}>{fmtRoas(roas)}</p>
          <p className="text-xs text-white/40">ROAS</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
        {[
          { label: "Revenue", value: fmt$(totalRevenueCents) },
          { label: "Spend/mo", value: `$${spendDollars.toLocaleString()}` },
          { label: "Orders", value: totalConversions },
          { label: "Posts", value: totalPosts },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2 text-center">
            <p className="text-sm font-semibold text-white">{value}</p>
            <p className="text-xs text-white/40">{label}</p>
          </div>
        ))}
      </div>

      {/* ROAS bar */}
      {roas !== null && (
        <div className="px-4 py-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white/5 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${roas >= 2 ? "bg-emerald-500" : roas >= 1 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, (roas / 4) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-white/40">Target: 2.0x</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2 border-t border-white/5 flex items-center gap-2 flex-wrap">
        <GenerateLinkDialog campaignId={campaign.id} utmCampaign={campaign.utmCampaign} onGenerated={onRefresh} />
        <Button size="sm" variant="ghost" className="text-white/50 hover:text-white text-xs" onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide Posts" : `View ${totalPosts} Posts`}
        </Button>
        {campaign.active && (
          <Button size="sm" variant="ghost" className="text-red-400/60 hover:text-red-400 text-xs ml-auto"
            onClick={() => updateCampaign.mutate({ id: campaign.id, active: false })}>
            End Campaign
          </Button>
        )}
      </div>

      {/* Expanded posts list */}
      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-2">
          {linksQuery.isLoading && <p className="text-xs text-white/40">Loading posts...</p>}
          {linksQuery.data?.length === 0 && (
            <p className="text-xs text-white/40 text-center py-4">No posts yet. Generate a tracking link above to start tracking.</p>
          )}
          {linksQuery.data?.map((link) => (
            <div key={link.id} className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-white/50">{link.subreddit || "—"}</span>
                    <span className="text-xs text-white/30">{link.postType?.replace("_", " ")}</span>
                    {link.postedBy && <span className="text-xs text-white/30">by {link.postedBy}</span>}
                  </div>
                  <p className="text-xs font-mono text-white/40 truncate mt-0.5">{link.destinationUrl}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-emerald-400">{fmt$(link.revenueAttributedCents || 0)}</p>
                  <p className="text-xs text-white/40">{link.conversionCount || 0} orders</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {link.redditPostUrl ? (
                  <a href={link.redditPostUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Post
                  </a>
                ) : (
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="Paste Reddit post URL after posting"
                      className="bg-white/5 border-white/10 text-white text-xs h-7 w-64"
                      onBlur={(e) => {
                        if (e.target.value) {
                          updateLink.mutate({ id: link.id, redditPostUrl: e.target.value, postedAt: Date.now() });
                        }
                      }}
                    />
                  </div>
                )}
                <Button size="sm" variant="ghost" className="text-white/30 hover:text-white h-6 px-2"
                  onClick={() => { navigator.clipboard.writeText(link.destinationUrl); toast.success("UTM link copied"); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RedditRoas() {
  const [tab, setTab] = useState("dashboard");

  const dashQuery = trpc.redditRoas.getDashboard.useQuery({});
  const conversionsQuery = trpc.redditRoas.listConversions.useQuery({ limit: 50 });

  const refresh = () => { dashQuery.refetch(); conversionsQuery.refetch(); };

  const dash = dashQuery.data;

  return (
    <div className="min-h-screen bg-[#0d1117] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reddit ROAS Tracker</h1>
          <p className="text-sm text-white/50 mt-0.5">Direct attribution from Reddit posts to Shopify purchases</p>
        </div>
        <NewCampaignDialog onCreated={refresh} />
      </div>

      {/* Overall stats */}
      {dash && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: "Overall ROAS", value: fmtRoas(dash.overallRoas), color: roasColor(dash.overallRoas), icon: <TrendingUp className="w-4 h-4" /> },
            { label: "Total Revenue", value: fmt$(dash.totalRevenueCents), color: "text-emerald-400", icon: <DollarSign className="w-4 h-4" /> },
            { label: "Total Spend", value: fmt$(dash.totalSpendCents), color: "text-white", icon: <DollarSign className="w-4 h-4" /> },
            { label: "Total Orders", value: dash.totalConversions, color: "text-white", icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "Total Posts", value: dash.totalPosts, color: "text-white", icon: <MessageSquare className="w-4 h-4" /> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-white/40 mb-2">{icon}<span className="text-xs">{label}</span></div>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white/5 border border-white/10 mb-6">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white/60">Campaigns</TabsTrigger>
          <TabsTrigger value="conversions" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white/60">Conversions</TabsTrigger>
          <TabsTrigger value="subreddits" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white/60">By Subreddit</TabsTrigger>
          <TabsTrigger value="setup" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white text-white/60">Setup Guide</TabsTrigger>
        </TabsList>

        {/* Campaigns tab */}
        <TabsContent value="dashboard">
          {dashQuery.isLoading && <p className="text-white/40 text-sm">Loading campaigns...</p>}
          {dash?.campaignStats.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm mt-1">Create your first campaign to start tracking Reddit ROAS</p>
            </div>
          )}
          <div className="space-y-4">
            {dash?.campaignStats.map((stat) => (
              <CampaignCard key={stat.campaign.id} stat={stat} onRefresh={refresh} />
            ))}
          </div>
        </TabsContent>

        {/* Conversions tab */}
        <TabsContent value="conversions">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-semibold text-white">Recent Reddit-Attributed Orders</h3>
              <p className="text-xs text-white/40 mt-0.5">Orders where utm_source=reddit was detected at checkout</p>
            </div>
            {conversionsQuery.data?.length === 0 && (
              <div className="p-8 text-center text-white/30">
                <p>No conversions recorded yet</p>
                <p className="text-xs mt-1">Conversions appear automatically when Shopify orders contain Reddit UTM parameters</p>
              </div>
            )}
            <div className="divide-y divide-white/5">
              {conversionsQuery.data?.map((conv) => (
                <div key={conv.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">Order #{conv.shopifyOrderNumber || conv.shopifyOrderId}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${conv.attributionType === "direct" ? "bg-emerald-500/20 text-emerald-400" : conv.attributionType === "probabilistic" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
                        {conv.attributionType}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5 font-mono">
                      {conv.utmCampaign} / {conv.utmContent || "—"}
                    </p>
                    {conv.customerEmail && <p className="text-xs text-white/30">{conv.customerEmail}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-semibold text-emerald-400">{fmt$(conv.orderTotalCents)}</p>
                    <p className="text-xs text-white/40">{conv.orderCreatedAt ? new Date(conv.orderCreatedAt).toLocaleDateString() : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Subreddits tab */}
        <TabsContent value="subreddits">
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/5">
              <h3 className="font-semibold text-white">Revenue by Subreddit</h3>
              <p className="text-xs text-white/40 mt-0.5">Which subreddits are driving the most attributed revenue</p>
            </div>
            {(!dash?.topSubreddits || dash.topSubreddits.length === 0) && (
              <div className="p-8 text-center text-white/30">
                <p>No subreddit data yet</p>
              </div>
            )}
            <div className="divide-y divide-white/5">
              {dash?.topSubreddits.map((sub, i) => {
                const maxRev = dash.topSubreddits[0]?.revenueCents || 1;
                return (
                  <div key={sub.subreddit} className="p-4 flex items-center gap-4">
                    <span className="text-white/30 text-sm w-6 text-right">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{sub.subreddit}</span>
                        <span className="text-sm font-semibold text-emerald-400">{fmt$(sub.revenueCents)}</span>
                      </div>
                      <div className="bg-white/5 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(sub.revenueCents / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Setup Guide tab */}
        <TabsContent value="setup">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 max-w-2xl">
            <div>
              <h3 className="font-semibold text-white text-lg mb-1">How Attribution Works</h3>
              <p className="text-sm text-white/60">Every Reddit post gets a unique UTM-tagged link. When a customer clicks it and buys, the order is automatically matched to the post and campaign.</p>
            </div>

            <div className="space-y-4">
              {[
                {
                  step: "1",
                  title: "Create a Campaign",
                  desc: "One campaign per SKU per source (e.g. 'RedRover Gut Test Q3'). Set the monthly spend so ROAS calculates correctly.",
                },
                {
                  step: "2",
                  title: "Generate a Tracking Link",
                  desc: "For each Reddit post, click 'Generate Link'. Enter the product URL and subreddit. You get a unique UTM URL — use this as the link in the post.",
                },
                {
                  step: "3",
                  title: "Post & Record",
                  desc: "After posting, paste the Reddit post URL into the link record. This lets you track upvotes and comments alongside revenue.",
                },
                {
                  step: "4",
                  title: "Automatic Attribution",
                  desc: "When a Shopify order comes in with utm_source=reddit, it is automatically matched to the campaign and post via utm_content. No manual entry needed.",
                },
                {
                  step: "5",
                  title: "Review ROAS Monthly",
                  desc: "At the end of each month, compare Revenue vs. Spend per campaign. Target: 2.0x ROAS minimum. Below 1.5x = renegotiate or exit.",
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex gap-4">
                  <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">{step}</div>
                  <div>
                    <p className="font-medium text-white text-sm">{title}</p>
                    <p className="text-xs text-white/50 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">RedRover Requirement</p>
                  <p className="text-xs text-amber-300/70 mt-1">Before RedRover posts a single link, send them the UTM-tagged URLs generated here. They must use your tracking links — not their own — so conversions flow into this dashboard. This is non-negotiable for ROAS accountability.</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
