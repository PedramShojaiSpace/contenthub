/**
 * BufferChannelSelector
 *
 * A modal dialog that shows all connected Buffer accounts as checkboxes
 * grouped by service (Instagram, Facebook, TikTok, LinkedIn, etc.).
 * The user picks exactly which accounts receive the post before it goes
 * to the Buffer queue — preventing accidental sends to all accounts.
 *
 * Selection is persisted in localStorage per platform so you don't have
 * to re-pick every time.
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Music2,
  Send,
  Loader2,
  CheckSquare,
  Square,
  AlertCircle,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Link } from "wouter";

export type BufferProfile = {
  id: string;
  platform: string;
  name: string;
  service: string;
  /** Buffer ChannelType — e.g. "page", "group", "profile". Null if not returned. */
  channelType?: string | null;
  /** True if this channel uses notification publishing (cannot auto-post). Facebook groups are always notification-only. */
  isNotificationOnly?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  profiles: BufferProfile[];
  contentPlatform: string; // e.g. "meta", "linkedin", "tiktok"
  isPushing: boolean;
  // DB-backed defaults: platform -> profileIds[]. If provided, used instead of localStorage.
  dbDefaults?: Record<string, string[]>;
  onConfirm: (params: {
    selectedIds: string[];
    channelServiceMap: Record<string, string>;
    metaPostType?: "post" | "story" | "reel";
  }) => void;
};

// Service → icon map
const SERVICE_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-500" />,
  linkedin: <Linkedin className="h-4 w-4 text-sky-600" />,
  twitter: <Twitter className="h-4 w-4 text-slate-500" />,
  youtube: <Youtube className="h-4 w-4 text-red-500" />,
  tiktok: <Music2 className="h-4 w-4 text-pink-400" />,
};

// Service → display label
const SERVICE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  twitter: "X / Twitter",
  youtube: "YouTube",
  tiktok: "TikTok",
};

// Platform → services that are "native" to this content type
// These are pre-selected by default; others are shown but unchecked
const PLATFORM_NATIVE_SERVICES: Record<string, string[]> = {
  meta: ["instagram", "facebook"],
  linkedin: ["linkedin"],
  x: ["twitter"],
  youtube: ["youtube"],
  tiktok: ["tiktok"],
};

const LS_KEY = (platform: string) => `buffer-channel-sel-${platform}`;

function loadSavedSelection(
  platform: string,
  profiles: BufferProfile[],
  dbDefaults?: Record<string, string[]>
): Set<string> {
  // 1. Use DB-backed defaults if available
  if (dbDefaults && dbDefaults[platform] && dbDefaults[platform].length > 0) {
    const validIds = dbDefaults[platform].filter((id) => profiles.some((p) => p.id === id));
    if (validIds.length > 0) return new Set(validIds);
  }
  // 2. Fall back to localStorage
  try {
    const raw = localStorage.getItem(LS_KEY(platform));
    if (raw) {
      const ids: string[] = JSON.parse(raw);
      const validIds = ids.filter((id) => profiles.some((p) => p.id === id));
      if (validIds.length > 0) return new Set(validIds);
    }
  } catch {
    // ignore parse errors
  }
  // 3. Default: pre-select native services for this platform
  const native = PLATFORM_NATIVE_SERVICES[platform] ?? [];
  const defaultIds = profiles
    .filter((p) => native.includes(p.service.toLowerCase()))
    .map((p) => p.id);
  return new Set(defaultIds);
}

function saveSelection(platform: string, ids: string[]) {
  try {
    localStorage.setItem(LS_KEY(platform), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function BufferChannelSelector({
  open,
  onClose,
  profiles,
  contentPlatform,
  isPushing,
  dbDefaults,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [metaPostType, setMetaPostType] = useState<"post" | "story" | "reel">("post");

  // Load saved selection when dialog opens (DB defaults take priority over localStorage)
  useEffect(() => {
    if (open && profiles.length > 0) {
      setSelected(loadSavedSelection(contentPlatform, profiles, dbDefaults));
    }
  }, [open, contentPlatform, profiles, dbDefaults]);

  // Group profiles by service
  const grouped = profiles.reduce<Record<string, BufferProfile[]>>((acc, p) => {
    const svc = p.service.toLowerCase();
    if (!acc[svc]) acc[svc] = [];
    acc[svc].push(p);
    return acc;
  }, {});

  const serviceOrder = ["instagram", "facebook", "tiktok", "linkedin", "twitter", "youtube"];
  const sortedServices = [
    ...serviceOrder.filter((s) => grouped[s]),
    ...Object.keys(grouped).filter((s) => !serviceOrder.includes(s)),
  ];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleService = (service: string) => {
    const serviceProfiles = grouped[service] ?? [];
    const allSelected = serviceProfiles.every((p) => selected.has(p.id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        serviceProfiles.forEach((p) => next.delete(p.id));
      } else {
        serviceProfiles.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedIds = Array.from(selected);
    saveSelection(contentPlatform, selectedIds);
    const channelServiceMap: Record<string, string> = {};
    for (const p of profiles) {
      if (selected.has(p.id)) channelServiceMap[p.id] = p.service;
    }
    onConfirm({
      selectedIds,
      channelServiceMap,
      metaPostType: contentPlatform === "meta" ? metaPostType : undefined,
    });
  };

  // Check if any selected channels are notification-only (Facebook groups)
  const hasNotificationOnlySelected = profiles.some(
    (p) => selected.has(p.id) && p.isNotificationOnly
  );

  const nativeServices = PLATFORM_NATIVE_SERVICES[contentPlatform] ?? [];
  const selectedCount = selected.size;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isPushing) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-amber-600" />
            Choose Buffer Accounts
          </DialogTitle>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">
              Select which accounts this post goes to.
            </p>
            <Link
              href="/default-channels"
              className="text-[11px] text-amber-600 hover:text-amber-700 underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Edit defaults
            </Link>
          </div>
        </DialogHeader>

        {/* Warning banner when a notification-only channel (Facebook group) is selected */}
        {hasNotificationOnlySelected && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-600" />
            <span>
              <strong>Facebook Group uses notification publishing.</strong> Buffer will queue this post and send a push notification to your phone. Open the Buffer app to copy-paste it into the group manually — Meta no longer allows automatic group posting.
            </span>
          </div>
        )}

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {sortedServices.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <AlertCircle className="h-4 w-4" />
              No Buffer accounts connected
            </div>
          )}

          {sortedServices.map((service) => {
            const serviceProfiles = grouped[service];
            const isNative = nativeServices.includes(service);
            const allSelected = serviceProfiles.every((p) => selected.has(p.id));
            const someSelected = serviceProfiles.some((p) => selected.has(p.id));

            return (
              <div key={service} className="space-y-1.5">
                {/* Service header row — click to toggle all accounts in this service */}
                <button
                  className="flex items-center gap-2 w-full text-left group"
                  onClick={() => toggleService(service)}
                >
                  <div className="flex items-center gap-1.5 flex-1">
                    {SERVICE_ICONS[service] ?? <Send className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">
                      {SERVICE_LABELS[service] ?? service}
                    </span>
                    {isNative && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                        native
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {allSelected ? (
                      <CheckSquare className="h-4 w-4 text-amber-600" />
                    ) : someSelected ? (
                      <CheckSquare className="h-4 w-4 text-amber-400 opacity-60" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </div>
                </button>

                {/* Individual account checkboxes */}
                <div className="ml-6 space-y-1">
                  {serviceProfiles.map((profile) => {
                    const isChecked = selected.has(profile.id);
                    return (
                      <button
                        key={profile.id}
                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-md border transition-colors ${
                          isChecked
                            ? "bg-amber-50 border-amber-300 text-foreground"
                            : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        }`}
                        onClick={() => toggle(profile.id)}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? "bg-amber-600 border-amber-600" : "border-muted-foreground/40"
                        }`}>
                          {isChecked && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm truncate">{profile.name}</span>
                        {profile.isNotificationOnly && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-medium">
                            notify
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">
                          {profile.id.slice(-6)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Meta post type selector — shown only for meta platform */}
          {contentPlatform === "meta" && (
            <div className="pt-2 border-t border-border">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Post Type</Label>
              <Select
                value={metaPostType}
                onValueChange={(v) => setMetaPostType(v as "post" | "story" | "reel")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="post">Feed Post</SelectItem>
                  <SelectItem value="reel">Reel</SelectItem>
                  <SelectItem value="story">Story</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPushing}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            disabled={isPushing || selectedCount === 0}
            onClick={handleConfirm}
          >
            {isPushing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isPushing
              ? "Pushing…"
              : selectedCount === 0
              ? "Select an account"
              : `Push to ${selectedCount} account${selectedCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
