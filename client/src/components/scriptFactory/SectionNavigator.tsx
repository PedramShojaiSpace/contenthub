/**
 * Section navigator — the workspace's left rail (v2.3 Part 1).
 *
 * Style contract for this file: this is an internal operator tool, not a
 * marketing surface. It follows the Google Docs outline pattern the spec asks
 * for — dense, quiet, monospaced timings, no decoration that competes with the
 * script text in the centre pane. Active state is a left border plus a tinted
 * background, never a colour-only cue.
 *
 * It renders whatever `sections` the SERVER sent and derives nothing from the
 * script text itself. An unfamiliar tag therefore appears as an ordinary row
 * rather than breaking the rail (spec: resilience).
 *
 * No per-section grounding marker is drawn here — see the note at the bottom of
 * the row body for why the server's `grounded` flag is not trustworthy on a
 * SAVED script.
 */
import { Clock, MessageSquareQuote } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SectionOutlineEntry } from "./types";

interface SectionNavigatorProps {
  sections: SectionOutlineEntry[];
  /** sectionKey of the section currently in view. */
  activeKey: string | null;
  onSelect: (sectionKey: string) => void;
}

export function SectionNavigator({ sections, activeKey, onSelect }: SectionNavigatorProps) {
  if (sections.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground leading-relaxed">
        No structure tags found in this script, so there is no outline to show.
        The full text is on the right.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: the rail collapses to a dropdown (spec). */}
      <div className="md:hidden p-3 border-b">
        <Select value={activeKey ?? sections[0].sectionKey} onValueChange={onSelect}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Jump to section" />
          </SelectTrigger>
          <SelectContent>
            {sections.map((s) => (
              <SelectItem key={s.sectionKey} value={s.sectionKey}>
                {s.startLabel} · {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: sticky outline. */}
      <nav
        aria-label="Script sections"
        className="hidden md:block overflow-y-auto h-full py-2"
      >
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Outline · {sections.length} sections
        </p>
        <ul>
          {sections.map((s) => {
            const active = s.sectionKey === activeKey;
            return (
              <li key={s.sectionKey}>
                <button
                  onClick={() => onSelect(s.sectionKey)}
                  aria-current={active ? "true" : undefined}
                  className={`w-full text-left px-3 py-1.5 border-l-2 transition-colors duration-150 ${
                    active
                      ? "border-l-primary bg-primary/5"
                      : "border-l-transparent hover:bg-muted/60"
                  }`}
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {s.startLabel}
                    </span>
                    <span className={`text-xs truncate ${active ? "font-semibold" : ""}`}>
                      {s.label}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 mt-0.5 pl-[38px]">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {s.wordCount}w
                    </span>
                    {/*
                      Story-slot sections get their own marker (spec): the word
                      count there is a 200-word ALLOWANCE for copy the operator
                      has not written yet, not text that exists. Showing it
                      unmarked would read as 200 words of finished script.
                    */}
                    {s.slotOnly && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1"
                        title="Story slot — you paste a real case here. The word count is a 200-word allowance, not written copy."
                      >
                        <MessageSquareQuote className="w-2.5 h-2.5" /> slot
                      </span>
                    )}
                    {/*
                      Deliberately NO per-section grounding marker.

                      `[VERIFIED]` is stripped from the body before the row is
                      saved (scriptFactoryRouter step 5b writes the "clean
                      version"), so `grounded` recomputed from a stored body is
                      false for EVERY section — including the twelve that the
                      generation-time metric counted as grounded. Drawing it
                      would put "no section grounded" next to a rail badge
                      correctly reading "12 of 14 sections grounded", and the
                      operator would have to guess which one lied. The persisted
                      script-level counts are the trustworthy numbers; they stay
                      in the metadata rail alone.
                    */}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-3 pt-3 mt-1 border-t text-[10px] text-muted-foreground flex items-start gap-1 leading-snug">
          <Clock className="w-3 h-3 mt-px shrink-0" />
          <span>Times assume 145 wpm and match the stamps in the script.</span>
        </p>
      </nav>
    </>
  );
}
