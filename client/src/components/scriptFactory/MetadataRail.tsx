/**
 * Metadata rail — the workspace's right pane (v2.3 Part 1).
 *
 * Style contract: a quiet facts column. Grouped rows, label left in muted
 * small caps, value right. No card-in-card nesting. Every badge and every
 * action here is carried over from the v2.2 detail modal with its wording and
 * behaviour intact, because operators already read these numbers a specific
 * way and changing the phrasing would change what they believe.
 *
 * Honesty rules preserved verbatim from v2.2:
 *  - grounding reads "N of M sections grounded" when M > 0, never a bare %
 *  - pre-v2.2 rows are marked "(legacy)" with the incompatibility explained
 *  - the claims badge is sourced from the claims table, never mirrored
 */
import { CheckCircle2, Loader2, MessageSquareQuote, ShieldCheck, Trash2, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SectionOutlineEntry } from "./types";

interface ClaimsStatus {
  status: string;
  flagCount: number;
}

interface MetadataRailProps {
  script: {
    id: number;
    status: string | null;
    format: string;
    topic: string;
    createdAt: Date | string;
    verifiedCount: number | null;
    totalElements: number | null;
    verificationPct: number | null;
    wordCount: number | null;
    targetLengthMinutes: number | null;
    researchJobId: number | null;
    productionScriptId: number | null;
  };
  sections: SectionOutlineEntry[];
  claimsStatus?: ClaimsStatus | null;
  statusColors: Record<string, string>;
  formatLabels: Record<string, string>;
  isLegacyMetric: (createdAt: Date | string) => boolean;
  sendToProductionPending: boolean;
  onSendToProduction: () => void;
  onApprove: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /**
   * v2.3 Part 3 — the Regenerate group, injected rather than built here.
   *
   * MetadataRail stays a presentational facts column: it holds no mutation, no
   * tRPC call and no knowledge of variants. The panel is composed in by the
   * workspace, which is also what lets the mobile Sheet and the desktop rail
   * share one instance of it instead of two diverging copies.
   */
  regenerateSlot?: React.ReactNode;
  /** v2.3 Part 3 — variant lineage summary, shown above Actions when present. */
  lineage?: React.ReactNode;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-xs text-right min-w-0">{children}</span>
    </div>
  );
}

export function MetadataRail({
  script,
  sections,
  claimsStatus,
  statusColors,
  formatLabels,
  isLegacyMetric,
  sendToProductionPending,
  onSendToProduction,
  onApprove,
  onArchive,
  onDelete,
  regenerateSlot,
  lineage,
}: MetadataRailProps) {
  const legacy = isLegacyMetric(script.createdAt);
  const slotCount = sections.filter((s) => s.slotOnly).length;
  const runtime = sections.length > 0 ? sections[sections.length - 1] : null;

  return (
    <div className="h-full overflow-y-auto p-4 space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Status
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge className={`text-xs ${statusColors[script.status ?? "draft"]}`}>
            {script.status ?? "draft"}
          </Badge>
          {script.researchJobId != null && (
            <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs">
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> Researched
            </Badge>
          )}
          {script.productionScriptId != null && (
            <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
              In Production →
            </Badge>
          )}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Grounding
        </p>
        {/*
          Rendered as a block, not a <Badge>: "12 of 14 sections grounded" is
          longer than a badge's single line and was clipping mid-word inside the
          260px rail. A grounding number that reads as "12 of 14 sect…" is worse
          than no number, because the operator fills in the rest themselves.
        */}
        <div
          className="flex items-start gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs leading-snug text-green-700"
          title={
            legacy
              ? "Legacy metric: this script predates v2.2. Its number divided [VERIFIED] tags by ALL bracketed tags, so structure labels diluted it. Not comparable with newer scripts."
              : "Section instances containing at least one [VERIFIED] element. Story-slot-only sections are excluded."
          }
        >
          <ShieldCheck className="w-3 h-3 mt-px shrink-0" />
          <span>
            {(script.totalElements ?? 0) > 0
              ? `${script.verifiedCount ?? 0} of ${script.totalElements} sections grounded`
              : `${script.verificationPct ?? 0}% verified`}
            {legacy && <span className="ml-1 opacity-70">(legacy)</span>}
          </span>
        </div>
        {claimsStatus && (
          <button
            onClick={() => {
              window.location.href = "/claims-review";
            }}
            className={`mt-1.5 block w-full text-left text-xs px-2 py-1 rounded border transition-colors duration-150 ${
              claimsStatus.flagCount > 0
                ? "bg-amber-50 text-amber-800 border-amber-200 hover:border-amber-400"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400"
            }`}
            title="Open the Claims Review queue"
          >
            Claims review: {String(claimsStatus.status).replace(/_/g, " ")}
            {claimsStatus.flagCount > 0 ? ` (${claimsStatus.flagCount} flags)` : ""}
          </button>
        )}
      </div>

      <div className="border-t pt-3">
        <Row label="Format">{formatLabels[script.format] ?? script.format}</Row>
        <Row label="Sections">{sections.length}</Row>
        {slotCount > 0 && (
          <Row label="Story slots">
            <span
              className="inline-flex items-center gap-0.5 text-amber-700"
              title="Sections that are an operator story slot only. Their word counts are allowances, not written copy."
            >
              <MessageSquareQuote className="w-3 h-3" /> {slotCount}
            </span>
          </Row>
        )}
        <Row label="Words">
          {script.wordCount != null && script.wordCount > 0 ? script.wordCount : "—"}
        </Row>
        <Row label="Target">
          {script.targetLengthMinutes ? `${script.targetLengthMinutes} min` : "—"}
        </Row>
        {runtime && (
          <Row label="Last cue">
            <span className="font-mono tabular-nums">{runtime.startLabel}</span>
          </Row>
        )}
        <Row label="Created">{new Date(script.createdAt).toLocaleDateString()}</Row>
        <Row label="Script id">
          <span className="font-mono">#{script.id}</span>
        </Row>
      </div>

      {lineage}

      <div className="border-t pt-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Actions
        </p>
        {script.status === "approved" &&
          (script.productionScriptId ? (
            <Button
              size="sm"
              variant="outline"
              className="w-full border-blue-400 text-blue-700"
              onClick={() => {
                window.location.href = `/script-library?scriptId=${script.productionScriptId}`;
              }}
            >
              In Production →
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={sendToProductionPending}
              onClick={onSendToProduction}
            >
              {sendToProductionPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5 mr-1" />
              )}
              Send to Production
            </Button>
          ))}
        {script.status !== "approved" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-green-400 text-green-700"
            onClick={onApprove}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
          </Button>
        )}
        {script.status !== "archived" && (
          <Button size="sm" variant="outline" className="w-full" onClick={onArchive}>
            Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="w-full border-red-300 text-red-600"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
        </Button>
      </div>

      {regenerateSlot}
    </div>
  );
}
