/**
 * Script body — the workspace's centre pane (v2.3 Part 1).
 *
 * Style contract: comfortable reading measure, section headers visually
 * distinct from prose, inline [VERIFIED] and structure chips preserved exactly
 * as the previous modal rendered them so nothing an operator recognises
 * changes meaning.
 *
 * Splitting is done on the SERVER-supplied `charStart` offsets. This file
 * contains no regex over section tags — that is deliberate (v2.3 Part 1,
 * Option A: the server is the single parser). If `sections` is empty the whole
 * body renders as one unsectioned block, which is also the tagless-script case.
 */
import React from "react";
import { MessageSquareQuote, ShieldCheck } from "lucide-react";
import type { SectionOutlineEntry } from "./types";

/** Preserved verbatim from the previous modal so inline chips look identical. */
function renderWithTags(text: string): React.ReactNode {
  const parts = text.split(/(\[VERIFIED\]|\[[A-Z_]+\])/g);
  return parts.map((part, i) => {
    if (part === "[VERIFIED]") {
      return (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 text-green-700 font-semibold text-xs bg-green-50 border border-green-200 rounded px-1 py-0.5 mx-0.5"
        >
          <ShieldCheck className="w-3 h-3" /> VERIFIED
        </span>
      );
    }
    if (/^\[[A-Z_]+\]$/.test(part)) {
      return (
        <span key={i} className="inline-block text-primary font-bold text-xs bg-primary/10 rounded px-1.5 py-0.5 mx-0.5 my-1">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

interface ScriptBodyProps {
  scriptBody: string;
  sections: SectionOutlineEntry[];
  /** Rendered to the right of each section header — Part 3 hangs actions here. */
  sectionActions?: (section: SectionOutlineEntry) => React.ReactNode;
}

export function ScriptBody({ scriptBody, sections, sectionActions }: ScriptBodyProps) {
  const body = scriptBody ?? "";

  if (sections.length === 0) {
    return (
      <article className="px-6 py-5">
        <div className="max-w-[68ch] text-sm leading-7 whitespace-pre-wrap font-mono">
          {renderWithTags(body)}
        </div>
      </article>
    );
  }

  // Anything before the first tag (a stray preamble) must still be shown —
  // dropping text silently would be worse than showing it unlabelled.
  const preamble = body.slice(0, sections[0].charStart);

  return (
    <article className="px-6 py-5">
      {preamble.trim() && (
        <div className="max-w-[68ch] text-sm leading-7 whitespace-pre-wrap font-mono mb-6 text-muted-foreground">
          {renderWithTags(preamble)}
        </div>
      )}

      {sections.map((s, i) => {
        const end = i + 1 < sections.length ? sections[i + 1].charStart : body.length;
        // charEnd is just past the tag itself; the tag is rendered by the header
        // below, so the prose starts after it and is not duplicated.
        const text = body.slice(s.charEnd, end);
        return (
          <section
            key={s.sectionKey}
            id={`section-${s.sectionKey}`}
            data-section-key={s.sectionKey}
            className="group/section scroll-mt-4 mb-7"
          >
            <header className="flex items-center gap-2 mb-2 pb-1.5 border-b">
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {s.startLabel}
              </span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                {s.label}
              </h3>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {s.wordCount}w
              </span>
              {s.slotOnly && (
                <span
                  className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1"
                  title="Story slot — paste a real case here. The 200-word count is an allowance, not written copy."
                >
                  <MessageSquareQuote className="w-2.5 h-2.5" /> story slot
                </span>
              )}
              {sectionActions && <span className="ml-auto">{sectionActions(s)}</span>}
            </header>
            <div className="max-w-[68ch] text-sm leading-7 whitespace-pre-wrap font-mono">
              {renderWithTags(text)}
            </div>
          </section>
        );
      })}
    </article>
  );
}
