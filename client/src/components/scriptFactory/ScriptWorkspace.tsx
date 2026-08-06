/**
 * Script workspace — the full-screen container that replaces the v2.2 detail
 * modal (v2.3 Part 1).
 *
 * Style contract: a three-pane editor shell, not a dialog with more content in
 * it. Chrome is deliberately thin so the script itself is the loudest thing on
 * screen: 200px outline rail, fluid body, 260px facts rail, one header strip.
 * Motion is limited to the dialog's own 200ms fade — panes do not animate,
 * because an operator opening this is mid-task and any transition here reads as
 * lag.
 *
 * Data rules this file honours:
 *  - `sections` come from the server and are never re-derived here
 *  - the active section is tracked by IntersectionObserver over the rendered
 *    section elements, so the outline follows real scroll position rather than
 *    a guess
 *  - selecting a section scrolls to it and writes `?section=<key>` so a
 *    specific beat is linkable
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MetadataRail } from "./MetadataRail";
import type { SellDensityRailReport } from "./MetadataRail";
import { ScriptBody } from "./ScriptBody";
import { SectionNavigator } from "./SectionNavigator";
import type { SectionOutlineEntry } from "./types";

interface ScriptWorkspaceProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the header while `scriptFactory.get` is still in flight. */
  fallbackTitle?: string;
  script:
    | ({
        id: number;
        title: string;
        topic: string;
        format: string;
        scriptBody: string | null;
        status: string | null;
        createdAt: Date | string;
        verifiedCount: number | null;
        totalElements: number | null;
        verificationPct: number | null;
        wordCount: number | null;
        targetLengthMinutes: number | null;
        researchJobId: number | null;
        productionScriptId: number | null;
        sections?: SectionOutlineEntry[];
      })
    | null
    | undefined;
  claimsStatus?: { status: string; flagCount: number } | null;
  /**
   * v2.4 — the resolved sell style of the open script, and its density report.
   *
   * Both are supplied by the page rather than derived here, and the three-state
   * contract of `sellDensity` (undefined / null / object) is passed through
   * UNCHANGED. Collapsing undefined to null on the way past would erase the
   * difference between "no report exists for this script" and "the lint did not
   * apply", which is the distinction the rail exists to show.
   */
  ctaStyle?: string | null;
  sellDensity?: SellDensityRailReport | null;
  /** Deep-linked section to land on, read from the URL by the caller. */
  initialSectionKey?: string | null;
  statusColors: Record<string, string>;
  formatLabels: Record<string, string>;
  isLegacyMetric: (createdAt: Date | string) => boolean;
  sendToProductionPending: boolean;
  onSendToProduction: () => void;
  onApprove: () => void;
  onArchive: () => void;
  onDelete: () => void;
  /**
   * v2.3 Part 3 — composed in by the page, which owns the mutations.
   *
   * The workspace stays a layout shell: it knows where the Regenerate group and
   * the per-section control go, not how they run. One `regenerateSlot` node is
   * passed to BOTH the desktop rail and the mobile Sheet so the two cannot drift.
   */
  regenerateSlot?: React.ReactNode;
  /** Variant lineage block for the rail (parent / sibling variants). */
  lineageSlot?: React.ReactNode;
  /** Per-section action, rendered in each section header in the body pane. */
  sectionActions?: (section: SectionOutlineEntry) => React.ReactNode;
}

export function ScriptWorkspace({
  open,
  onClose,
  fallbackTitle,
  script,
  claimsStatus,
  ctaStyle,
  sellDensity,
  initialSectionKey,
  statusColors,
  formatLabels,
  isLegacyMetric,
  sendToProductionPending,
  onSendToProduction,
  onApprove,
  onArchive,
  onDelete,
  regenerateSlot,
  lineageSlot,
  sectionActions,
}: ScriptWorkspaceProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const deepLinkDone = useRef(false);

  const sections = useMemo<SectionOutlineEntry[]>(() => script?.sections ?? [], [script?.sections]);

  /**
   * Scroll a section into view inside the body pane and write the URL.
   *
   * Positioning is computed against the scroll container rather than delegated
   * to `scrollIntoView`: this pane sits inside a dialog, and scrollIntoView
   * there also nudges the ancestor page, which shifted the whole dialog and left
   * the target section short of the top. `scrollTop` arithmetic touches only the
   * container.
   */
  const goToSection = useCallback(
    (sectionKey: string, pushUrl = true, behavior: ScrollBehavior = "smooth") => {
      const root = scrollRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-section-key="${sectionKey}"]`);
      if (root && el) {
        root.scrollTo({ top: el.offsetTop - root.offsetTop - 8, behavior });
      }
      setActiveKey(sectionKey);
      if (pushUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("section", sectionKey);
        window.history.replaceState({}, "", url);
      }
    },
    []
  );

  // Deep link: land on ?section=<key> once the body has actually rendered.
  // Guarded by a ref so a later re-render cannot yank the operator back to the
  // linked section after they have scrolled away.
  useEffect(() => {
    if (!open) {
      deepLinkDone.current = false;
      setActiveKey(null);
      return;
    }
    if (deepLinkDone.current || sections.length === 0) return;
    deepLinkDone.current = true;
    const target = initialSectionKey && sections.some((s) => s.sectionKey === initialSectionKey)
      ? initialSectionKey
      : sections[0].sectionKey;
    /*
     * Two frames, and `auto` rather than `smooth`.
     *
     * One frame was not enough: the section elements exist but the dialog is
     * still settling its own size on the first frame, so `offsetTop` is measured
     * against a layout that is about to change and the jump lands short. A
     * smooth animation on first paint also reads as the page drifting on its
     * own — a deep link should simply START at the linked section.
     */
    requestAnimationFrame(() =>
      requestAnimationFrame(() => goToSection(target, !!initialSectionKey, "auto"))
    );
  }, [open, sections, initialSectionKey, goToSection]);

  // Active-section tracking. Observing against the scroll container with a top
  // bias means the highlighted row is the section the operator is reading, not
  // whichever one happens to touch the viewport edge.
  useEffect(() => {
    const root = scrollRef.current;
    if (!open || !root || sections.length === 0) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-section-key]"));
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const key = visible[0]?.target.getAttribute("data-section-key");
        if (key) setActiveKey(key);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: 0 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [open, sections]);

  const title = script?.title ?? fallbackTitle ?? "Script";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton
        className="w-[96vw] max-w-[96vw] h-[93vh] p-0 gap-0 flex flex-col overflow-hidden sm:max-w-[96vw]"
      >
        {/* Header strip — one line, so the script starts as high as possible. */}
        <div className="flex items-center gap-3 px-4 h-12 border-b shrink-0 pr-12">
          <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
          {script && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline">
              {script.topic}
            </span>
          )}
          {/* Mobile: the facts rail becomes a bottom sheet (spec). */}
          {script && (
            <div className="ml-auto lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline">
                    <PanelRightOpen className="w-3.5 h-3.5 mr-1" /> Details
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[75vh]">
                  <SheetTitle className="px-4 pt-4 text-sm">Script details</SheetTitle>
                  <MetadataRail
                    script={script}
                    sections={sections}
                    claimsStatus={claimsStatus}
                    statusColors={statusColors}
                    formatLabels={formatLabels}
                    isLegacyMetric={isLegacyMetric}
                    sendToProductionPending={sendToProductionPending}
                    onSendToProduction={onSendToProduction}
                    onApprove={onApprove}
                    onArchive={onArchive}
                    onDelete={onDelete}
                    regenerateSlot={regenerateSlot}
                    lineage={lineageSlot}
                    ctaStyle={ctaStyle}
                    sellDensity={sellDensity}
                  />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>

        {!script ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Loading script…
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            <aside className="md:w-[200px] md:shrink-0 md:border-r bg-muted/20 min-h-0">
              <SectionNavigator
                sections={sections}
                activeKey={activeKey}
                onSelect={(key) => goToSection(key)}
              />
            </aside>

            <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
              {!script.scriptBody ? (
                <p className="p-6 text-sm text-muted-foreground flex items-start gap-2">
                  <Info className="w-4 h-4 mt-px shrink-0" />
                  This script row has no body text saved.
                </p>
              ) : (
                <ScriptBody
                  scriptBody={script.scriptBody}
                  sections={sections}
                  sectionActions={sectionActions}
                />
              )}
            </div>

            <aside className="hidden lg:block w-[260px] shrink-0 border-l bg-muted/20 min-h-0">
              <MetadataRail
                script={script}
                sections={sections}
                claimsStatus={claimsStatus}
                statusColors={statusColors}
                formatLabels={formatLabels}
                isLegacyMetric={isLegacyMetric}
                sendToProductionPending={sendToProductionPending}
                onSendToProduction={onSendToProduction}
                onApprove={onApprove}
                onArchive={onArchive}
                onDelete={onDelete}
                regenerateSlot={regenerateSlot}
                lineage={lineageSlot}
                ctaStyle={ctaStyle}
                sellDensity={sellDensity}
              />
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
