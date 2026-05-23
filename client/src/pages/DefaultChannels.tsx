/**
 * Default Channels Settings
 *
 * Lets the owner set permanent default Buffer account selections per platform.
 * When the Buffer Channel Selector opens, these DB-backed defaults are pre-checked
 * instead of relying on localStorage. Changes take effect immediately.
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Music2,
  Settings2,
  CheckSquare,
  Square,
  Loader2,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-500" />,
  linkedin: <Linkedin className="h-4 w-4 text-sky-600" />,
  twitter: <Twitter className="h-4 w-4 text-slate-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-500" />,
  tiktok: <Music2 className="h-4 w-4 text-pink-400" />,
};

const SERVICE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  youtube: "YouTube",
  tiktok: "TikTok",
};

// Which platform key each service belongs to (for grouping)
const SERVICE_TO_PLATFORM: Record<string, string> = {
  instagram: "meta",
  facebook: "meta",
  tiktok: "tiktok",
  linkedin: "linkedin",
  twitter: "x",
  youtube: "youtube",
};

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta (Instagram + Facebook)",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  youtube: "YouTube",
};

const PLATFORM_ORDER = ["meta", "tiktok", "linkedin", "x", "youtube"];

// ─── Types ────────────────────────────────────────────────────────────────────

type BufferProfile = {
  id: string;
  platform: string;
  name: string;
  service: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DefaultChannels() {
  const { data: profilesData, isLoading: profilesLoading } =
    trpc.syndication.getProfiles.useQuery();

  const { data: defaultsData, isLoading: defaultsLoading } =
    trpc.syndication.getChannelDefaults.useQuery();

  const setDefaultsMutation = trpc.syndication.setChannelDefaults.useMutation();
  const utils = trpc.useUtils();

  // Local state: platform → Set of selected profile IDs
  const [selections, setSelections] = useState<Record<string, Set<string>>>({});
  const [savedPlatforms, setSavedPlatforms] = useState<Set<string>>(new Set());
  const [dirtyPlatforms, setDirtyPlatforms] = useState<Set<string>>(new Set());

  // Normalize profiles
  const profiles: BufferProfile[] = Array.isArray(profilesData)
    ? profilesData.map((p: any) => ({
        id: p.id,
        platform: p.platform ?? SERVICE_TO_PLATFORM[p.service?.toLowerCase()] ?? "other",
        name: p.name ?? p.username ?? p.id,
        service: p.service?.toLowerCase() ?? "other",
      }))
    : [];

  // Group profiles by platform
  const profilesByPlatform: Record<string, BufferProfile[]> = {};
  for (const p of profiles) {
    const platform = SERVICE_TO_PLATFORM[p.service] ?? p.platform ?? "other";
    if (!profilesByPlatform[platform]) profilesByPlatform[platform] = [];
    profilesByPlatform[platform].push(p);
  }

  // Initialise selections from DB defaults once both are loaded
  useEffect(() => {
    if (!defaultsData || profiles.length === 0) return;
    const init: Record<string, Set<string>> = {};
    for (const platform of Object.keys(profilesByPlatform)) {
      const saved: string[] = defaultsData[platform] ?? [];
      if (saved.length > 0) {
        // Keep only IDs that are still connected
        init[platform] = new Set(saved.filter((id) => profiles.some((p) => p.id === id)));
      } else {
        // No saved default → pre-select all accounts for this platform
        init[platform] = new Set(profilesByPlatform[platform].map((p) => p.id));
      }
    }
    setSelections(init);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultsData, profilesData]);

  const toggle = (platform: string, profileId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      const set = new Set(next[platform] ?? []);
      if (set.has(profileId)) set.delete(profileId);
      else set.add(profileId);
      next[platform] = set;
      return next;
    });
    setDirtyPlatforms((prev) => new Set(Array.from(prev).concat(platform)));
    setSavedPlatforms((prev) => {
      const next = new Set(Array.from(prev));
      next.delete(platform);
      return next;
    });
  };

  const toggleAll = (platform: string) => {
    const platformProfiles = profilesByPlatform[platform] ?? [];
    const current = selections[platform] ?? new Set();
    const allSelected = platformProfiles.every((p) => current.has(p.id));
    setSelections((prev) => ({
      ...prev,
      [platform]: allSelected
        ? new Set()
        : new Set(platformProfiles.map((p) => p.id)),
    }));
    setDirtyPlatforms((prev) => new Set(Array.from(prev).concat(platform)));
    setSavedPlatforms((prev) => {
      const next = new Set(Array.from(prev));
      next.delete(platform);
      return next;
    });
  };

  const savePlatform = async (platform: string) => {
    const profileIds = Array.from(selections[platform] ?? []);
    try {
      await setDefaultsMutation.mutateAsync({ platform, profileIds });
      await utils.syndication.getChannelDefaults.invalidate();
      setSavedPlatforms((prev) => new Set(Array.from(prev).concat(platform)));
      setDirtyPlatforms((prev) => {
        const next = new Set(Array.from(prev));
        next.delete(platform);
        return next;
      });
      toast.success(`Default channels saved for ${PLATFORM_LABELS[platform] ?? platform}`);
    } catch (e: any) {
      toast.error(`Failed to save: ${e.message}`);
    }
  };

  const isLoading = profilesLoading || defaultsLoading;

  const activePlatforms = [
    ...PLATFORM_ORDER.filter((p) => profilesByPlatform[p]),
    ...Object.keys(profilesByPlatform).filter((p) => !PLATFORM_ORDER.includes(p)),
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center border border-amber-200">
            <Settings2 className="h-4 w-4 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Default Buffer Channels</h1>
            <p className="text-sm text-muted-foreground">
              Set which accounts are pre-checked when you push content to Buffer.
              These are saved to the database — not just your browser.
            </p>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading connected accounts…
          </div>
        )}

        {!isLoading && activePlatforms.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center border rounded-lg bg-muted/20">
            <AlertCircle className="h-4 w-4" />
            No Buffer accounts connected. Connect accounts in Buffer first.
          </div>
        )}

        {/* Platform sections */}
        {!isLoading &&
          activePlatforms.map((platform) => {
            const platformProfiles = profilesByPlatform[platform] ?? [];
            const current = selections[platform] ?? new Set();
            const allSelected = platformProfiles.every((p) => current.has(p.id));
            const someSelected = platformProfiles.some((p) => current.has(p.id));
            const isDirty = dirtyPlatforms.has(platform);
            const isSaved = savedPlatforms.has(platform);
            const isSaving =
              setDefaultsMutation.isPending &&
              setDefaultsMutation.variables?.platform === platform;

            return (
              <div
                key={platform}
                className="border border-border rounded-xl overflow-hidden bg-card"
              >
                {/* Platform header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {PLATFORM_LABELS[platform] ?? platform}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {current.size}/{platformProfiles.length} selected
                    </Badge>
                    {isSaved && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </span>
                    )}
                    {isDirty && !isSaved && (
                      <span className="text-[10px] text-amber-600 font-medium">Unsaved changes</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => toggleAll(platform)}
                    >
                      {allSelected ? "Deselect all" : someSelected ? "Select all" : "Select all"}
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={!isDirty || isSaving}
                      onClick={() => savePlatform(platform)}
                    >
                      {isSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3" />
                      )}
                      {isSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                {/* Account list */}
                <div className="divide-y divide-border">
                  {platformProfiles.map((profile) => {
                    const isChecked = current.has(profile.id);
                    return (
                      <button
                        key={profile.id}
                        className={`flex items-center gap-3 w-full text-left px-4 py-3 transition-colors ${
                          isChecked
                            ? "bg-amber-50/60 hover:bg-amber-50"
                            : "hover:bg-muted/40"
                        }`}
                        onClick={() => toggle(platform, profile.id)}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isChecked
                              ? "bg-amber-600 border-amber-600"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Service icon */}
                        {SERVICE_ICONS[profile.service] ?? (
                          <Settings2 className="h-4 w-4 text-muted-foreground" />
                        )}

                        {/* Account name */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {profile.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {SERVICE_LABELS[profile.service] ?? profile.service} ·{" "}
                            <span className="font-mono">{profile.id.slice(-8)}</span>
                          </p>
                        </div>

                        {/* State badge */}
                        {isChecked ? (
                          <CheckSquare className="h-4 w-4 text-amber-600 shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        {/* Help note */}
        {!isLoading && activePlatforms.length > 0 && (
          <p className="text-xs text-muted-foreground text-center pb-4">
            These defaults are stored in the database and apply to all sessions.
            You can still override them per-post in the Buffer Channel Selector dialog.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
