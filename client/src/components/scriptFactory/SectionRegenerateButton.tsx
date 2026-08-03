/**
 * Per-section regenerate control (v2.3 Part 3).
 *
 * Hangs off each section header in the body pane via ScriptBody's
 * `sectionActions` render prop. Appears on hover on pointer devices and stays
 * permanently visible on touch, where there is no hover to reveal it — a
 * hover-only affordance would make section regeneration unreachable on a tablet.
 *
 * Like the rail's group, this never fires on one click: it opens a small dialog
 * that takes an optional instruction and states plainly that the section is
 * replaced in place and the previous wording is recoverable. That last part
 * matters — an operator who believes the old text is gone forever will not use
 * the feature on a script they like, which is exactly when it is most useful.
 */
import { useState } from "react";
import { Loader2, RotateCcw, Undo2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { SectionOutlineEntry } from "./types";

interface SectionRegenerateButtonProps {
  section: SectionOutlineEntry;
  /** True while any section regeneration is in flight. */
  pending: boolean;
  /** The section currently being regenerated, if any. */
  pendingKey: string | null;
  /** True when section_history holds a previous version of THIS section. */
  canUndo: boolean;
  onRegenerate: (sectionKey: string, instruction?: string) => void;
  onUndo: (sectionKey: string) => void;
}

export function SectionRegenerateButton({
  section,
  pending,
  pendingKey,
  canUndo,
  onRegenerate,
  onUndo,
}: SectionRegenerateButtonProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const isThisOne = pendingKey === section.sectionKey;

  /*
   * A story slot holds the operator's own case. The server refuses to regenerate
   * one; showing the button anyway would be an invitation to an error toast, so it
   * is replaced by the reason.
   */
  if (section.slotOnly) {
    return (
      <span className="text-[10px] text-muted-foreground italic" title="A story slot is your own case — regenerating it would either remove the slot or invite the model to invent a patient. Edit it directly instead.">
        yours to fill
      </span>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1">
        {canUndo && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[10px] text-muted-foreground opacity-100 md:opacity-0 md:group-hover/section:opacity-100 transition-opacity duration-150"
            disabled={pending}
            title="Put the previous wording of this section back"
            onClick={() => onUndo(section.sectionKey)}
          >
            <Undo2 className="w-3 h-3 mr-0.5" /> Undo
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[10px] text-muted-foreground opacity-100 md:opacity-0 md:group-hover/section:opacity-100 transition-opacity duration-150 hover:text-foreground"
          disabled={pending}
          title={`Rewrite just this section (${section.label})`}
          onClick={() => {
            setInstruction("");
            setOpen(true);
          }}
        >
          {isThisOne ? (
            <Loader2 className="w-3 h-3 mr-0.5 animate-spin" />
          ) : (
            <RotateCcw className="w-3 h-3 mr-0.5" />
          )}
          {isThisOne ? "Rewriting…" : "Regenerate"}
        </Button>
      </span>

      <Dialog open={open} onOpenChange={(next) => !next && setOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Regenerate “{section.label}”</DialogTitle>
            <DialogDescription className="text-xs">
              This rewrites one section of this script in place — it does not create a
              variant. The rest of the script is left untouched, timestamps are
              recalculated, and the previous wording stays recoverable with Undo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            <Label className="text-xs">What should change? (optional)</Label>
            <Textarea
              rows={3}
              className="text-xs"
              placeholder="e.g. colder open, lead with the 2 AM detail, cut the metaphor"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Left blank, the model is asked to make it materially better rather than
              merely reworded. Target length stays about {section.wordCount} words so
              the runtime does not drift.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                onRegenerate(section.sectionKey, instruction.trim() || undefined);
                setOpen(false);
              }}
            >
              {pending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
              Rewrite this section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
