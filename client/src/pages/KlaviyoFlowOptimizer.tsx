import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  Mail,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function Score({ value }: { value: number }) {
  const color = value <= 3 ? "text-emerald-700" : value <= 7 ? "text-amber-700" : "text-red-700";
  return <span className={`font-semibold ${color}`}>{value}/15</span>;
}

export default function KlaviyoFlowOptimizer() {
  const utils = trpc.useUtils();
  const { data: flows, isLoading: flowsLoading, refetch: refetchFlows } = trpc.klaviyoFlowOptimizer.listFlows.useQuery();
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data: inspection, isLoading: inspectionLoading, refetch: refetchInspection } = trpc.klaviyoFlowOptimizer.inspectFlow.useQuery(
    { flowId: selectedFlowId },
    { enabled: Boolean(selectedFlowId), staleTime: 0 }
  );
  const { data: backups, isLoading: backupsLoading } = trpc.klaviyoFlowOptimizer.listBackups.useQuery(undefined, { staleTime: 0 });

  useEffect(() => {
    if (selectedFlowId || !flows?.length) return;
    const tantra = flows.find((flow) => /tantra/i.test(flow.name));
    setSelectedFlowId(tantra?.id ?? flows[0].id);
  }, [flows, selectedFlowId]);

  const applyOptimization = trpc.klaviyoFlowOptimizer.applyOptimization.useMutation({
    onSuccess: async (data) => {
      toast.success(`Applied safely to ${data.templateName}. A backup was saved first.`);
      await Promise.all([refetchInspection(), utils.klaviyoFlowOptimizer.listBackups.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const restoreBackup = trpc.klaviyoFlowOptimizer.restoreBackup.useMutation({
    onSuccess: async () => {
      toast.success("Restored the saved Klaviyo HTML. A pre-restore snapshot was saved too.");
      await Promise.all([refetchInspection(), utils.klaviyoFlowOptimizer.listBackups.invalidate()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedFlow = useMemo(() => flows?.find((flow) => flow.id === selectedFlowId), [flows, selectedFlowId]);
  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const refresh = async () => {
    await Promise.all([refetchFlows(), selectedFlowId ? refetchInspection() : Promise.resolve(), utils.klaviyoFlowOptimizer.listBackups.invalidate()]);
  };

  return (
    <DashboardLayout>
      <main className="min-h-screen bg-background text-foreground">
        <div className="max-w-7xl mx-auto px-5 py-8 lg:px-8 space-y-6">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Klaviyo Flow Optimizer</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">Review live flow emails, clean their HTML, and keep a restore point before every change.</p>
                </div>
              </div>
            </div>
            <Button onClick={refresh} variant="outline" className="gap-2 self-start" disabled={flowsLoading || inspectionLoading}>
              <RefreshCw className="w-4 h-4" />
              Refresh from Klaviyo
            </Button>
          </header>

          <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-950 space-y-1">
                <p className="font-semibold">Backup-first, deliberate updates</p>
                <p className="text-emerald-900/80 text-xs leading-relaxed">
                  This tool only writes after you press Apply. It re-reads Klaviyo first, refuses a stale update, stores the original HTML in the Content Hub database, and offers a one-click restore path. Direct writing is enabled only for Klaviyo <strong>CODE</strong> templates; drag-and-drop templates remain review-only.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <label htmlFor="klaviyo-flow" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Klaviyo flow</label>
            <select
              id="klaviyo-flow"
              value={selectedFlowId}
              onChange={(event) => setSelectedFlowId(event.target.value)}
              disabled={flowsLoading}
              className="h-10 w-full max-w-2xl rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {!flows?.length && <option value="">{flowsLoading ? "Loading flows…" : "No accessible Klaviyo flows"}</option>}
              {flows?.map((flow) => (
                <option key={flow.id} value={flow.id}>{flow.name} · {flow.status}</option>
              ))}
            </select>
            {selectedFlow && <p className="text-xs text-muted-foreground mt-2">{selectedFlow.triggerType ?? "Unknown trigger"} · Last updated {selectedFlow.updatedAt ? new Date(selectedFlow.updatedAt).toLocaleString() : "unknown"}</p>}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Flow email review</h2>
                <p className="text-xs text-muted-foreground mt-1">The same HTML cleanup and Winning Copy Review used in the Kajabi optimizer are calculated before anything is changed.</p>
              </div>
              {inspection && <Badge variant="secondary">{inspection.messages.length} supported email{inspection.messages.length === 1 ? "" : "s"}</Badge>}
            </div>

            {inspectionLoading && <div className="rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground text-center">Reading templates and calculating safe changes…</div>}
            {!inspectionLoading && inspection && inspection.messages.length === 0 && <div className="rounded-xl border border-border bg-card p-10 text-sm text-muted-foreground text-center">No CODE-template flow emails were available for review in this flow.</div>}

            {inspection?.messages.map((message) => {
              const isExpanded = expanded.has(message.flowActionId);
              const supported = message.editorType === "CODE";
              const hasChanges = message.htmlHash !== message.optimizedHash;
              return (
                <article key={message.flowActionId} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold truncate">{message.actionName}</h3>
                        <Badge variant="secondary" className="text-xs">{message.editorType}</Badge>
                        {hasChanges ? <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{message.reductionPercent}% smaller</Badge> : <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">Already clean</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Subject: {message.subjectLine || "No subject line set"}</p>
                      <p className="text-xs text-muted-foreground mt-1 truncate">Template: {message.templateName}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button onClick={() => toggle(message.flowActionId)} variant="outline" size="sm" className="gap-1.5">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Review
                      </Button>
                      <Button
                        size="sm"
                        disabled={!supported || !hasChanges || applyOptimization.isPending}
                        className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white"
                        onClick={() => {
                          if (!window.confirm(`Apply the reviewed cleanup to “${message.actionName}”? The current HTML will be backed up first and can be restored from this page.`)) return;
                          applyOptimization.mutate({ flowId: selectedFlowId, flowActionId: message.flowActionId, expectedOriginalHash: message.htmlHash, confirm: true });
                        }}
                      >
                        <FileCheck2 className="w-4 h-4" />
                        Apply with backup
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border p-5 space-y-5 bg-muted/20">
                      {!supported && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="w-4 h-4 inline mr-1.5" />This is a {message.editorType} template. Review is available, but direct updates are intentionally blocked until its editor format is supported safely.</div>}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Original size</p><p className="font-semibold mt-1">{formatBytes(message.originalBytes)}</p></div>
                        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Optimized size</p><p className="font-semibold mt-1">{formatBytes(message.optimizedBytes)}</p></div>
                        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Promo score</p><p className="mt-1"><Score value={message.spamScore.before} /> <span className="text-muted-foreground">→</span> <Score value={message.spamScore.after} /></p></div>
                        <div className="rounded-lg border border-border bg-background p-3"><p className="text-xs text-muted-foreground">Cleanup changes</p><p className="font-semibold mt-1">{message.changes.length}</p></div>
                      </div>

                      {message.warnings.length > 0 && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">{message.warnings.map((warning) => <p key={warning}><AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />{warning}</p>)}</div>}

                      <div>
                        <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-violet-600" /><h4 className="text-sm font-semibold">Winning Copy Review</h4></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {message.copyReview.map((review) => (
                            <div key={review.name} className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex gap-2">
                              {review.status === "present" ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /> : <Sparkles className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />}
                              <div><p className="text-xs font-semibold">{review.name}</p><p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{review.detail}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div><p className="text-xs font-semibold text-muted-foreground mb-2">Original HTML</p><pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] whitespace-pre-wrap break-words">{message.html}</pre></div>
                        <div><p className="text-xs font-semibold text-emerald-700 mb-2">Reviewed optimized HTML</p><pre className="max-h-64 overflow-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[11px] whitespace-pre-wrap break-words">{message.optimizedHtml}</pre></div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-2"><RotateCcw className="w-4 h-4 text-foreground" /><div><h2 className="font-semibold">Restore points</h2><p className="text-xs text-muted-foreground mt-1">Every apply and restore creates a durable audit snapshot.</p></div></div>
            {backupsLoading && <p className="p-5 text-sm text-muted-foreground">Loading backup history…</p>}
            {!backupsLoading && !backups?.length && <p className="p-5 text-sm text-muted-foreground">No Klaviyo updates have been applied through this tool yet.</p>}
            {!!backups?.length && <div className="divide-y divide-border">
              {backups.map((backup) => (
                <div key={backup.id} className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{backup.flowName} · {backup.templateName}</p><p className="text-xs text-muted-foreground mt-1">{backup.operation} · {backup.status} · {new Date(backup.createdAt).toLocaleString()}</p></div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 self-start md:self-auto"
                    disabled={backup.status === "failed" || restoreBackup.isPending}
                    onClick={() => {
                      if (!window.confirm(`Restore the original HTML saved in backup #${backup.id} for “${backup.templateName}”? The current HTML will be snapshotted first.`)) return;
                      restoreBackup.mutate({ backupId: backup.id, confirm: true });
                    }}
                  ><RotateCcw className="w-3.5 h-3.5" />Restore this version</Button>
                </div>
              ))}
            </div>}
          </section>
        </div>
      </main>
    </DashboardLayout>
  );
}
