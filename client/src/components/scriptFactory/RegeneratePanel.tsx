/**
 * Regenerate group — the workspace rail's action block (v2.3 Part 3).
 *
 * Style contract inherited from MetadataRail: a quiet facts column, full-width
 * outline buttons, small caps section label, no card-in-card nesting.
 *
 * The rule this file exists to enforce: NOTHING HERE RUNS ON ONE CLICK.
 * Every action opens a confirm dialog that states the parameters the new script
 * will use, highlights the one that changed, and names what will be reused. A
 * regeneration costs real model spend and produces a row the operator then has to
 * reconcile; a mis-click that silently starts one is a worse failure than an extra
 * dialog. The spec asks for this explicitly.
 *
 * The diff shown here is computed CLIENT-SIDE for preview only. The server
 * recomputes it from the frozen params and returns the authoritative version,
 * which is what the result toast reports — so a preview that is somehow wrong
 * cannot become the record of what happened.
 */
import { useState } from "react";
import { AlertTriangle, Copy, GitBranch, Loader2, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Only the fields a variant may change — mirrors `scriptVariantOverrides`. */
export interface VariantOverrides {
  personaId?: number;
  targetLengthMinutes?: 10 | 15 | 20;
  storyMode?: "brief" | "composite" | "none";
  ctaOverride?: string;
}

/** The frozen params of the source script, as persisted at generation time. */
export interface FrozenParams {
  personaId: number | null;
  targetLengthMinutes: number | null;
  storyMode: string | null;
  offerTier: string | null;
  ctaOverride: string | null;
  researchJobId: number | null;
  format: string;
  topic: string;
}

interface RegeneratePanelProps {
  scriptId: number;
  /** NULL for pre-v2.3 scripts — the panel then explains why it is disabled. */
  frozen: FrozenParams | null | undefined;
  personas: { id: number; name: string }[];
  pending: boolean;
  /** Set while a regeneration is in flight, so the dialog can name the action. */
  pendingLabel: string | null;
  onRegenerateVariant: (overrides: VariantOverrides) => void;
  onRegenerateAsNew: (overrides: VariantOverrides) => void;
}

type Mode = "length" | "persona" | "params" | "asNew";

const MODE_TITLES: Record<Mode, string> = {
  length: "Regenerate at a different length",
  persona: "Regenerate for a different persona",
  params: "Regenerate with changed parameters",
  asNew: "Regenerate as a new script",
};

export function RegeneratePanel({
  frozen,
  personas,
  pending,
  pendingLabel,
  onRegenerateVariant,
  onRegenerateAsNew,
}: RegeneratePanelProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState<VariantOverrides>({});

  const open = (m: Mode) => {
    setDraft({});
    setMode(m);
  };

  /*
   * A pre-v2.3 script cannot be regenerated: `generation_params` is NULL, so the
   * settings that produced it were never recorded. The server refuses this too —
   * this is not the guard, it is the EXPLANATION, given before the click so the
   * operator is not sent to an error toast to find out.
   */
  if (!frozen) {
    return (
      <div className="border-t pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Regenerate
        </p>
        <div className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-800">
          <AlertTriangle className="w-3 h-3 mt-px shrink-0" />
          <span>
            Unavailable for this script. It was generated before variant tracking
            existed, so the exact settings behind it were never recorded — a
            regeneration would quietly reset the story mode, offer tier and custom
            close to defaults.
          </span>
        </div>
      </div>
    );
  }

  const currentPersona = personas.find((p) => p.id === frozen.personaId)?.name ?? "—";
  const isLongForm = frozen.format === "youtube_script";

  /** Preview rows for the confirm dialog: label, value, changed-flag. */
  const previewRows = (): { label: string; value: string; changed: boolean }[] => {
    const nextLen = draft.targetLengthMinutes ?? frozen.targetLengthMinutes ?? null;
    const nextPersonaId = draft.personaId ?? frozen.personaId ?? null;
    const nextStory = draft.storyMode ?? frozen.storyMode ?? "brief";
    const nextCta = draft.ctaOverride ?? frozen.ctaOverride ?? null;
    return [
      { label: "Topic", value: frozen.topic, changed: false },
      { label: "Format", value: frozen.format, changed: false },
      {
        label: "Length",
        value: nextLen ? `${nextLen} min` : "—",
        changed: nextLen !== (frozen.targetLengthMinutes ?? null),
      },
      {
        label: "Persona",
        value: personas.find((p) => p.id === nextPersonaId)?.name ?? "—",
        changed: nextPersonaId !== (frozen.personaId ?? null),
      },
      {
        label: "Story mode",
        value: String(nextStory),
        changed: String(nextStory) !== String(frozen.storyMode ?? "brief"),
      },
      { label: "Offer tier", value: frozen.offerTier ?? "—", changed: false },
      {
        label: "Custom close",
        value: nextCta ? `${nextCta.slice(0, 40)}${nextCta.length > 40 ? "…" : ""}` : "—",
        changed: (nextCta ?? null) !== (frozen.ctaOverride ?? null),
      },
    ];
  };

  const rows = previewRows();
  const changedCount = rows.filter((r) => r.changed).length;

  const confirm = () => {
    if (!mode) return;
    if (mode === "asNew") onRegenerateAsNew(draft);
    else onRegenerateVariant(draft);
    setMode(null);
  };

  return (
    <>
      <div className="border-t pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Regenerate
        </p>
        {isLongForm && (
          <Button size="sm" variant="outline" className="w-full justify-start" disabled={pending} onClick={() => open("length")}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Different length
          </Button>
        )}
        <Button size="sm" variant="outline" className="w-full justify-start" disabled={pending} onClick={() => open("persona")}>
          <Users className="w-3.5 h-3.5 mr-1.5" /> Different persona
        </Button>
        <Button size="sm" variant="outline" className="w-full justify-start" disabled={pending} onClick={() => open("params")}>
          <GitBranch className="w-3.5 h-3.5 mr-1.5" /> Change parameters
        </Button>
        <Button size="sm" variant="outline" className="w-full justify-start" disabled={pending} onClick={() => open("asNew")}>
          <Copy className="w-3.5 h-3.5 mr-1.5" /> Regenerate as new
        </Button>
        {pending && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            {pendingLabel ?? "Regenerating…"}
          </p>
        )}
      </div>

      <Dialog open={mode !== null} onOpenChange={(next) => !next && setMode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{mode ? MODE_TITLES[mode] : ""}</DialogTitle>
            <DialogDescription className="text-xs">
              {mode === "asNew"
                ? "The result will be a separate original, not filed under this script."
                : "The result will be filed as a variant of this script, so the Library keeps showing one row."}
            </DialogDescription>
          </DialogHeader>

          {/* ── Controls, per mode ─────────────────────────────────────────── */}
          <div className="space-y-3">
            {(mode === "length" || mode === "params" || mode === "asNew") && isLongForm && (
              <div className="space-y-1">
                <Label className="text-xs">Target length</Label>
                <Select
                  value={String(draft.targetLengthMinutes ?? frozen.targetLengthMinutes ?? "")}
                  onValueChange={(v) => setDraft((d) => ({ ...d, targetLengthMinutes: Number(v) as 10 | 15 | 20 }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Unchanged" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(mode === "persona" || mode === "params" || mode === "asNew") && (
              <div className="space-y-1">
                <Label className="text-xs">Persona</Label>
                <Select
                  value={String(draft.personaId ?? frozen.personaId ?? "")}
                  onValueChange={(v) => setDraft((d) => ({ ...d, personaId: Number(v) }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={currentPersona} />
                  </SelectTrigger>
                  <SelectContent>
                    {personas.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(mode === "params" || mode === "asNew") && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Story mode</Label>
                  <Select
                    value={String(draft.storyMode ?? frozen.storyMode ?? "brief")}
                    onValueChange={(v) => setDraft((d) => ({ ...d, storyMode: v as VariantOverrides["storyMode"] }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="brief">brief — leave a slot for your own case</SelectItem>
                      <SelectItem value="composite">composite — labelled composite narrative</SelectItem>
                      <SelectItem value="none">none — no story, more teaching</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Custom close (optional)</Label>
                  <Textarea
                    rows={2}
                    className="text-xs"
                    placeholder={frozen.ctaOverride ?? "Leave blank to keep the current close"}
                    value={draft.ctaOverride ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, ctaOverride: e.target.value || undefined }))}
                  />
                </div>
              </>
            )}
          </div>

          {/* ── The parameter set, with changes highlighted ─────────────────── */}
          <div className="rounded border bg-muted/30 p-2.5 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Will generate with
            </p>
            {rows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground shrink-0">{r.label}</span>
                <span
                  className={`text-right min-w-0 truncate ${
                    r.changed ? "font-semibold text-amber-700" : ""
                  }`}
                >
                  {r.value}
                  {r.changed && <span className="ml-1 text-[10px] uppercase">changed</span>}
                </span>
              </div>
            ))}
            {/*
              Stated plainly because it is the difference between a 10-second action
              and a multi-minute one, and because reusing the research is what keeps
              a variant comparable with its source.
            */}
            <p className="pt-1.5 text-[11px] leading-snug text-muted-foreground border-t mt-1.5">
              {frozen.researchJobId
                ? `Reuses research job #${frozen.researchJobId} — no new research will be run, and no research credits are spent.`
                : "This script has no research job attached, so the variant will be generated ungrounded, exactly as this one was."}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending} onClick={confirm}>
              {pending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              {changedCount === 0
                ? "Run again with the same settings"
                : `Regenerate with ${changedCount} change${changedCount === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
