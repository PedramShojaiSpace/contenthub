/**
 * MetaCustomAudienceTab
 *
 * Displays and manages Meta Custom Audiences built from lead scraper emails.
 * Features:
 *  - Create new audience (with optional category filter)
 *  - Sync all found lead emails into an audience
 *  - View live stats (Meta count, DB count, delivery status)
 *  - Create Lookalike Audience from a seed audience
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "gut_health", label: "Gut Health" },
  { value: "sleep", label: "Sleep" },
  { value: "stress", label: "Stress / Anxiety" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "autoimmune", label: "Autoimmune" },
  { value: "biohacking", label: "Biohacking" },
  { value: "longevity", label: "Longevity" },
];

export function MetaCustomAudienceTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: audiences = [], refetch, isLoading } = trpc.metaCustomAudience.listAudiences.useQuery();
  const { data: stats = [], refetch: refetchStats } = trpc.metaCustomAudience.getAudienceStats.useQuery();

  const createMutation = trpc.metaCustomAudience.createAudience.useMutation({
    onSuccess: (d) => {
      toast.success(`✅ Audience "${d.name}" created in Meta (ID: ${d.metaAudienceId})`);
      setShowCreate(false);
      setNewName("");
      refetch();
      refetchStats();
    },
    onError: (e) => toast.error(`Create failed: ${e.message}`),
  });

  const syncMutation = trpc.metaCustomAudience.syncLeadEmails.useMutation({
    onSuccess: (d) => {
      if (d.added === 0) {
        toast.info(d.message ?? "No new emails to sync");
      } else {
        toast.success(`✅ Synced ${d.added} new emails to Meta (${d.metaReceived} received)`);
      }
      refetch();
      refetchStats();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const lookalikeMutation = trpc.metaCustomAudience.createLookalike.useMutation({
    onSuccess: (d) => {
      toast.success(`✅ Lookalike Audience created (ID: ${d.lookalikeId})`);
      refetch();
      refetchStats();
    },
    onError: (e) => toast.error(`Lookalike failed: ${e.message}`),
  });

  const statsMap = new Map(stats.map((s) => s && [s.id, s]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Meta Custom Audiences
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Build email-based Custom Audiences from Lead Scraper finds. Meta matches emails to Facebook/Instagram
            profiles and builds Lookalike Audiences for retargeting.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { refetch(); refetchStats(); }}
            className="gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-3.5 h-3.5" /> New Audience
          </Button>
        </div>
      </div>

      {/* Strategy callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-medium">The Flywheel Strategy</p>
          <p>
            Every email found by the Lead Scraper gets hashed and pushed to Meta. Meta matches it to a Facebook/Instagram
            profile and adds it to your Custom Audience. Once you hit <strong>100+ emails</strong>, create a{" "}
            <strong>1% Lookalike Audience</strong> — Meta finds millions of people who look just like your leads.
            Point your KBMO ads at the Lookalike for the lowest CPM.
          </p>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-800 text-sm">Create New Custom Audience</h3>
          <input
            placeholder="Audience name (e.g. Urban Monk — Gut Health Leads)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate({
                name: newName || `Urban Monk Leads — ${CATEGORIES.find(c => c.value === newCategory)?.label ?? newCategory}`,
                category: newCategory === "all" ? undefined : newCategory,
              })}
              disabled={createMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending ? "Creating..." : "Create in Meta"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Audience list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading audiences...</div>
      ) : audiences.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No Custom Audiences yet.</p>
          <p className="text-gray-400 text-xs mt-1">Create one above to start building your retargeting pool.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {audiences.map((audience) => {
            const stat = statsMap.get(audience.id);
            const isExpanded = expandedId === audience.id;
            return (
              <div key={audience.id} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Row header */}
                <div className="flex items-center justify-between px-4 py-3 bg-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{audience.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {audience.category && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{audience.category}</span>
                        )}
                        <span>{audience.emailCount} emails in DB</span>
                        {stat && stat.metaCountLower > 0 && (
                          <span className="text-green-700 font-medium">
                            ~{stat.metaCountLower.toLocaleString()}–{stat.metaCountUpper?.toLocaleString()} matched in Meta
                          </span>
                        )}
                        {stat && (
                          <span className={`px-1.5 py-0.5 rounded-full ${
                            stat.deliveryStatus === "This audience is ready." ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {stat.deliveryStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => syncMutation.mutate({ audienceId: audience.id, category: audience.category ?? undefined })}
                      disabled={syncMutation.isPending}
                      className="gap-1 text-xs"
                    >
                      <Zap className="w-3 h-3" />
                      {syncMutation.isPending ? "Syncing..." : "Sync Lead Emails"}
                    </Button>
                    <a
                      href={`https://www.facebook.com/adsmanager/audiences?act=${process.env.META_AD_ACCOUNT_ID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => setExpandedId(isExpanded ? null : audience.id)} className="text-gray-400">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                      <div>
                        <span className="font-medium">Meta Audience ID:</span>{" "}
                        <code className="bg-gray-100 px-1 rounded">{audience.metaAudienceId}</code>
                      </div>
                      <div>
                        <span className="font-medium">Lookalike Seed ID:</span>{" "}
                        {audience.lookalikeSeedId ? (
                          <code className="bg-green-100 text-green-700 px-1 rounded">{audience.lookalikeSeedId}</code>
                        ) : (
                          <span className="text-gray-400">Not created yet</span>
                        )}
                      </div>
                    </div>

                    {/* Lookalike creation */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => lookalikeMutation.mutate({ audienceId: audience.id, ratio: 0.01, country: "US" })}
                        disabled={lookalikeMutation.isPending || audience.emailCount < 100}
                        className="gap-1 text-xs bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Zap className="w-3 h-3" />
                        {lookalikeMutation.isPending ? "Creating..." : "Create 1% US Lookalike"}
                      </Button>
                      {audience.emailCount < 100 && (
                        <span className="text-xs text-amber-600">
                          Need {100 - audience.emailCount} more emails to unlock Lookalike
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400">
                      Lookalike Audiences require at least 100 matched emails. Meta typically matches 20–60% of uploaded emails.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Auto-add note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
        <strong>Auto-sync:</strong> Every time the Lead Scraper finds an email via Apollo, it is automatically added to
        the matching category audience (if one exists). Use <em>Sync Lead Emails</em> above to manually push all
        found emails that haven't been added yet.
      </div>
    </div>
  );
}
