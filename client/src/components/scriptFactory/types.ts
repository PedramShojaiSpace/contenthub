/**
 * Shared types for the v2.3 script workspace.
 *
 * `SectionOutlineEntry` mirrors the server payload from
 * `buildSectionOutline()` in server/scriptFactoryRouter.ts. It is declared
 * structurally here rather than imported because the client has no path alias
 * to `server/` — importing it would pull `db`, `env` and the LLM client into
 * the browser bundle. The server remains the ONLY parser of section tags
 * (v2.3 Part 1, Option A); this type is a read-only description of what it
 * sends, never a second implementation of the parsing rules.
 */
export interface SectionOutlineEntry {
  index: number;
  tag: string;
  /** Human label, recurrence-numbered: "Teach 3". */
  label: string;
  /** Slug shared by navigator anchors, deep links, and Part 3 regenerateSection. */
  sectionKey: string;
  charStart: number;
  charEnd: number;
  wordCount: number;
  startSeconds: number;
  /** m:ss, floored — matches the stamps written into the body. */
  startLabel: string;
  grounded: boolean;
  /** Section is nothing but an operator story slot. */
  slotOnly: boolean;
}

/** The subset of `scriptFactory.get` the workspace consumes. */
export interface WorkspaceScript {
  id: number;
  title: string;
  topic: string;
  format: string;
  scriptBody: string | null;
  status: string | null;
  notes: string | null;
  createdAt: Date | string;
  verifiedCount: number | null;
  totalElements: number | null;
  verificationPct: number | null;
  wordCount: number | null;
  targetLengthMinutes: number | null;
  personaId: number | null;
  researchJobId: number | null;
  productionScriptId: number | null;
  analogDataEntryIds?: unknown;
  patternComposition?: unknown;
  sections: SectionOutlineEntry[];
}
