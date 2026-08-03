/**
 * Variant lineage block (v2.3 Part 3).
 *
 * Answers one question the workspace could not previously answer: "is this the
 * script I generated, or something derived from it?" Without this, an operator who
 * regenerates a variant and later opens it from a link has no way to tell it apart
 * from the original — and the variant's numbers would read as though they were the
 * original's.
 *
 * Family membership comes from `getScriptFamily` on the server, which resolves
 * COALESCE(variant_of_root_id, id). The client never infers the family from ids it
 * has locally, because a script's siblings may sit outside the 50-row list window.
 */
import { GitBranch } from "lucide-react";

interface FamilyMember {
  id: number;
  variantLabel: string | null;
  parentScriptId: number | null;
  status: string | null;
  wordCount: number | null;
  targetLengthMinutes: number | null;
}

interface VariantLineageProps {
  currentId: number;
  family: FamilyMember[] | undefined;
  onOpen: (id: number, title: string) => void;
}

export function VariantLineage({ currentId, family, onOpen }: VariantLineageProps) {
  // A family of one is just a script. Rendering "Variants: none" would add a row
  // that never says anything useful.
  if (!family || family.length < 2) return null;

  const root = family.find((m) => m.parentScriptId == null);
  const isVariant = family.find((m) => m.id === currentId)?.parentScriptId != null;

  return (
    <div className="border-t pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {isVariant ? "Variant of" : "Variants"}
      </p>
      <div className="space-y-1">
        {family.map((m) => {
          const isCurrent = m.id === currentId;
          const label = m.parentScriptId == null
            ? "Original"
            : m.variantLabel ?? `Variant #${m.id}`;
          return (
            <button
              key={m.id}
              disabled={isCurrent}
              onClick={() => onOpen(m.id, label)}
              className={`flex w-full items-baseline justify-between gap-2 rounded border px-2 py-1 text-left text-xs transition-colors duration-150 ${
                isCurrent
                  ? "border-primary/40 bg-primary/5 font-semibold cursor-default"
                  : "border-transparent hover:border-border hover:bg-muted/50"
              }`}
              title={isCurrent ? "You are viewing this one" : `Open ${label}`}
            >
              <span className="flex items-center gap-1 min-w-0 truncate">
                {m.parentScriptId != null && <GitBranch className="w-3 h-3 shrink-0 opacity-60" />}
                <span className="truncate">{label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground">
                {m.wordCount ? `${m.wordCount}w` : "—"}
              </span>
            </button>
          );
        })}
      </div>
      {root && isVariant && (
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Derived from #{root.id}. Its metrics are its own — they are not inherited
          from the original.
        </p>
      )}
    </div>
  );
}
