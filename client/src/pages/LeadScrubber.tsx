/**
 * Lead Scrubber — Apollo-Only Pipeline
 *
 * All leads come exclusively from Apollo.io.
 * Every lead saved to the database MUST have an email address.
 * Target: 133 email-verified leads/day via the automated daily draw.
 *
 * Tabs:
 *  1. Pipeline    — Daily draw stats + all saved email-verified leads
 *  2. Search      — Manual Apollo search with instant email reveal
 *  3. Sequences   — AI-generated 3-email cold outreach sequences
 */

import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search,
  Mail,
  RefreshCw,
  Archive,
  RotateCcw,
  ExternalLink,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Users,
  Send,
  Sparkles,
  Copy,
  CheckCheck,
  CheckCircle,
  MessageSquare,
  Zap,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: number;
  source: "reddit" | "youtube" | "apollo";
  sourceId: string;
  title: string | null;
  body: string;
  url: string;
  author: string | null;
  subredditOrChannel: string | null;
  keywordsMatched: string | null;
  category: string | null;
  status: "new" | "engaged" | "email_found" | "converted" | "archived";
  notes: string | null;
  engagedAt: number | null;
  emailFound: string | null;
  emailConfidence: string | null;
  archivedAt: number | null;
  createdAt: Date;
};

type EmailSequence = {
  id: number;
  leadId: number;
  leadName: string | null;
  leadEmail: string | null;
  leadCompany: string | null;
  leadTitle: string | null;
  category: string | null;
  email1Subject: string | null;
  email1Body: string | null;
  email2Subject: string | null;
  email2Body: string | null;
  email3Subject: string | null;
  email3Body: string | null;
  status: "draft" | "approved" | "sent" | "replied";
  notes: string | null;
  kajabiPushed: boolean;
  kajabiPushError: string | null;
  createdAt: number;
  updatedAt: number;
};

type ApolloPerson = {
  id: string;
  name: string;
  title: string;
  email: string | null;
  emailStatus: string | null;
  linkedinUrl: string | null;
  company: string | null;
  domain: string | null;
  location: string;
};

// ─── Persona definitions ──────────────────────────────────────────────────────

const URBAN_MONK_PERSONAS = [
  { label: "Wellness Coaches", titles: ["wellness coach", "health coach", "life coach"], category: "wellness_coach" },
  { label: "Meditation Teachers", titles: ["meditation teacher", "mindfulness coach", "yoga instructor"], category: "meditation_teacher" },
  { label: "Functional Medicine", titles: ["functional medicine doctor", "integrative medicine physician", "naturopathic doctor"], category: "functional_med" },
  { label: "Biohackers / Longevity", titles: ["biohacker", "longevity coach", "anti-aging specialist"], category: "biohacker" },
  { label: "Stress & Burnout", titles: ["burnout coach", "stress management coach", "executive wellness coach"], category: "burnout" },
  { label: "Nutritionists", titles: ["nutritionist", "dietitian", "holistic nutritionist"], category: "nutritionist" },
  { label: "Medical Doctors (MDs)", titles: ["physician", "medical doctor", "internal medicine physician", "family medicine physician", "general practitioner", "integrative physician"], category: "medical_doctor" },
  { label: "Nurses & NPs", titles: ["nurse practitioner", "registered nurse", "nurse", "advanced practice nurse", "clinical nurse specialist", "holistic nurse"], category: "nurse" },
  { label: "Dentists", titles: ["dentist", "dental surgeon", "holistic dentist", "biological dentist", "oral health practitioner", "periodontist"], category: "dentist" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  if (!confidence) return null;
  const isVerified = confidence === "verified";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isVerified ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
      {isVerified ? "✓ verified" : confidence}
    </span>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">
      {category.replace(/_/g, " ")}
    </span>
  );
}

// ─── Kajabi Push Button ───────────────────────────────────────────────────────

function KajabiPushButton({ email, name, leadId, category, source }: { email: string; name?: string; leadId?: number; category?: string; source?: string }) {
  const pushToKajabi = trpc.leadScrubber.pushToKajabi.useMutation({
    onSuccess: (data) => toast.success(`Pushed to Kajabi → ${data.tag}`),
    onError: (err) => toast.error(`Kajabi push failed: ${err.message}`),
  });
  return (
    <button
      onClick={() => pushToKajabi.mutate({ email, name, leadId, category, source })}
      disabled={pushToKajabi.isPending || pushToKajabi.isSuccess}
      className={`text-xs font-medium px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
        pushToKajabi.isSuccess
          ? "text-green-700 border-green-300 bg-green-50 cursor-default"
          : "text-green-700 border-green-300 hover:bg-green-50"
      }`}
    >
      <Send className="w-3 h-3" />
      {pushToKajabi.isPending ? "Pushing..." : pushToKajabi.isSuccess ? "In Kajabi ✓" : "Push to Kajabi"}
    </button>
  );
}

// ─── Repush to Kajabi Button (for email sequences) ──────────────────────────────

function RepushKajabiButton({ sequenceId, onSuccess }: { sequenceId: number; onSuccess: () => void }) {
  const repush = trpc.emailSequence.repushToKajabi.useMutation({
    onSuccess: (data) => { toast.success(`Pushed to Kajabi → ${data.tag}`); onSuccess(); },
    onError: (err) => toast.error(`Kajabi push failed: ${err.message}`),
  });
  return (
    <button
      onClick={() => repush.mutate({ sequenceId })}
      disabled={repush.isPending || repush.isSuccess}
      className={`text-xs font-medium px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
        repush.isSuccess
          ? "text-green-700 border-green-300 bg-green-50 cursor-default"
          : "text-green-700 border-green-300 hover:bg-green-50"
      }`}
    >
      <Send className="w-3 h-3" />
      {repush.isPending ? "Pushing..." : repush.isSuccess ? "In Kajabi ✓" : "Push to Kajabi"}
    </button>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onRefresh, onOpenEmailSequence }: { lead: Lead; onRefresh: () => void; onOpenEmailSequence?: (lead: Lead) => void }) {
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(lead.notes ?? "");

  const updateStatus = trpc.leadScrubber.updateLeadStatus.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Status updated"); },
    onError: () => toast.error("Failed to update status"),
  });
  const addNote = trpc.leadScrubber.addNote.useMutation({
    onSuccess: () => { onRefresh(); setShowNotes(false); toast.success("Note saved"); },
    onError: () => toast.error("Failed to save note"),
  });
  const archiveLead = trpc.leadScrubber.archiveLead.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Moved to archive"); },
    onError: () => toast.error("Failed to archive"),
  });
  const restoreLead = trpc.leadScrubber.restoreLead.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Restored"); },
    onError: () => toast.error("Failed to restore"),
  });

  const isArchived = lead.status === "archived";

  // Parse name and company from body JSON if available
  const bodyData = (() => {
    try { return JSON.parse(lead.body) as { title?: string; company?: string; location?: string; firstName?: string; lastName?: string }; }
    catch { return null; }
  })();

  const displayName = lead.author ?? "Unknown";
  const displayTitle = bodyData?.title ?? lead.title ?? "";
  const displayCompany = bodyData?.company ?? lead.subredditOrChannel ?? "";
  const displayLocation = bodyData?.location ?? "";

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${isArchived ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CategoryBadge category={lead.category} />
          </div>
          <p className="text-sm font-semibold text-gray-900">{displayName}</p>
          {displayTitle && <p className="text-xs text-gray-500">{displayTitle}</p>}
          {displayCompany && <p className="text-xs text-gray-400">{displayCompany}{displayLocation ? ` · ${displayLocation}` : ""}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.url && (
            <a href={lead.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Email — always present for Apollo leads */}
      {lead.emailFound && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <Mail className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm font-mono text-green-800 flex-1 min-w-0 truncate">{lead.emailFound}</span>
          <ConfidenceBadge confidence={lead.emailConfidence} />
        </div>
      )}

      {/* Notes */}
      {lead.notes && !showNotes && (
        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">{lead.notes}</p>
      )}
      {showNotes && (
        <div className="space-y-2">
          <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="text-sm min-h-[80px]" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => addNote.mutate({ id: lead.id, notes: noteText })} disabled={addNote.isPending}>Save Note</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNotes(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
        {!isArchived && (
          <>
            {lead.status === "new" && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: lead.id, status: "engaged" })} disabled={updateStatus.isPending}>
                <CheckCircle className="w-3 h-3 mr-1" /> Mark Engaged
              </Button>
            )}
            {lead.status === "engaged" && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => updateStatus.mutate({ id: lead.id, status: "converted" })} disabled={updateStatus.isPending}>
                <CheckCircle className="w-3 h-3 mr-1" /> Mark Converted
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowNotes(!showNotes)}>
              <MessageSquare className="w-3 h-3 mr-1" /> Note
            </Button>
            <Button
              size="sm" variant="outline" className="text-xs h-7 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
              onClick={() => onOpenEmailSequence?.(lead)}
            >
              <Sparkles className="w-3 h-3 mr-1" /> Email Sequence
            </Button>
            {lead.emailFound && lead.status !== "converted" && (
              <KajabiPushButton email={lead.emailFound} name={lead.author ?? undefined} leadId={lead.id} category={lead.category ?? undefined} source="apollo" />
            )}
            <Button size="sm" variant="ghost" className="text-xs h-7 text-gray-400 hover:text-red-500" onClick={() => archiveLead.mutate({ id: lead.id })} disabled={archiveLead.isPending}>
              <Archive className="w-3 h-3 mr-1" /> Archive
            </Button>
          </>
        )}
        {isArchived && (
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => restoreLead.mutate({ id: lead.id })} disabled={restoreLead.isPending}>
            <RotateCcw className="w-3 h-3 mr-1" /> Restore
          </Button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{new Date(lead.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

// ─── Email Sequence Modal ─────────────────────────────────────────────────────

function EmailSequenceModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const stableLeadIdRef = React.useRef<number>(lead.id > 0 ? lead.id : -(Date.now()));
  const stableLeadId = stableLeadIdRef.current;

  const [activeEmail, setActiveEmail] = useState<1 | 2 | 3>(1);
  const [drafts, setDrafts] = useState<{ email1: { subject: string; body: string }; email2: { subject: string; body: string }; email3: { subject: string; body: string } } | null>(null);
  const [sequenceId, setSequenceId] = useState<number | null>(null);
  const [sequenceStatus, setSequenceStatus] = useState<"draft" | "approved" | "sent" | "replied">("draft");
  const [copied, setCopied] = useState<number | null>(null);
  const [leadContext, setLeadContext] = useState(lead.body?.slice(0, 300) ?? "");
  const [contentHubEmailId, setContentHubEmailId] = useState<number | undefined>(undefined);
  const [contentHubEmailTitle, setContentHubEmailTitle] = useState<string | null>(null);

  const { data: hubEmails = [] } = trpc.emailSequence.listContentHubEmails.useQuery();

  const generateMutation = trpc.emailSequence.generateEmailSequence.useMutation({
    onSuccess: (data) => {
      setDrafts({
        email1: { subject: data.email1.subject, body: data.email1.body },
        email2: { subject: data.email2.subject, body: data.email2.body },
        email3: { subject: data.email3.subject, body: data.email3.body },
      });
      setSequenceId(data.sequenceId);
      setSequenceStatus("draft");
      if (data.contentHubEmailTitle) setContentHubEmailTitle(data.contentHubEmailTitle);
      toast.success("3-email sequence generated!");
    },
    onError: (e) => toast.error(`Generation failed: ${e.message}`),
  });

  const saveMutation = trpc.emailSequence.saveEmailSequence.useMutation({
    onSuccess: () => toast.success("Sequence saved"),
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const statusMutation = trpc.emailSequence.updateEmailSequenceStatus.useMutation({
    onSuccess: (_, vars) => { setSequenceStatus(vars.status); toast.success(`Marked as ${vars.status}`); },
    onError: (e) => toast.error(`Status update failed: ${e.message}`),
  });

  const approveAndSendMutation = trpc.emailSequence.approveAndSend.useMutation({
    onSuccess: (data) => {
      setSequenceStatus("approved");
      const d2 = new Date(data.email2ScheduledAt);
      const d3 = new Date(data.email3ScheduledAt);
      toast.success(`✅ Email 1 sent! Email 2 queued for ${d2.toLocaleDateString()}, Email 3 for ${d3.toLocaleDateString()}.`, { duration: 6000 });
    },
    onError: (e) => toast.error(`Send failed: ${e.message}`, { duration: 8000 }),
  });

  const { data: existingSeqs } = trpc.emailSequence.getEmailSequences.useQuery(
    { leadId: lead.id > 0 ? lead.id : undefined },
    { enabled: lead.id > 0 }
  );

  React.useEffect(() => {
    if (existingSeqs && existingSeqs.length > 0 && !drafts) {
      const seq = existingSeqs[0] as EmailSequence;
      if (seq.email1Subject) {
        setDrafts({
          email1: { subject: seq.email1Subject ?? "", body: seq.email1Body ?? "" },
          email2: { subject: seq.email2Subject ?? "", body: seq.email2Body ?? "" },
          email3: { subject: seq.email3Subject ?? "", body: seq.email3Body ?? "" },
        });
        setSequenceId(seq.id);
        setSequenceStatus(seq.status as "draft" | "approved" | "sent" | "replied");
      }
    }
  }, [existingSeqs]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = () => {
    generateMutation.mutate({
      leadId: stableLeadId > 0 ? stableLeadId : Math.abs(stableLeadId),
      leadName: lead.author ?? undefined,
      leadEmail: lead.emailFound ?? undefined,
      leadCompany: lead.subredditOrChannel ?? undefined,
      leadTitle: lead.title ?? undefined,
      category: lead.category ?? undefined,
      leadContext: leadContext || undefined,
      contentHubEmailId,
    });
  };

  const handleSave = () => {
    if (!sequenceId || !drafts) return;
    saveMutation.mutate({
      sequenceId,
      email1Subject: drafts.email1.subject, email1Body: drafts.email1.body,
      email2Subject: drafts.email2.subject, email2Body: drafts.email2.body,
      email3Subject: drafts.email3.subject, email3Body: drafts.email3.body,
    });
  };

  const handleCopy = (emailNum: 1 | 2 | 3) => {
    if (!drafts) return;
    const email = drafts[`email${emailNum}`];
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`).then(() => {
      setCopied(emailNum);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleApproveAndSend = () => {
    if (!sequenceId) return;
    if (!lead.emailFound) { toast.error("No email address on this lead."); return; }
    if (drafts) {
      saveMutation.mutate(
        { sequenceId, email1Subject: drafts.email1.subject, email1Body: drafts.email1.body, email2Subject: drafts.email2.subject, email2Body: drafts.email2.body, email3Subject: drafts.email3.subject, email3Body: drafts.email3.body },
        { onSuccess: () => approveAndSendMutation.mutate({ sequenceId: sequenceId!, overrideEmail: lead.emailFound ?? undefined }) }
      );
    } else {
      approveAndSendMutation.mutate({ sequenceId, overrideEmail: lead.emailFound ?? undefined });
    }
  };

  const currentDraft = drafts ? drafts[`email${activeEmail}`] : null;
  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-600", approved: "bg-green-100 text-green-700", sent: "bg-blue-100 text-blue-700", replied: "bg-purple-100 text-purple-700" };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            Cold Email Sequence
            {lead.author && <span className="text-gray-500 font-normal text-sm">— {lead.author}</span>}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Email confirmed */}
          {lead.emailFound && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
              <Mail className="w-4 h-4 text-green-600" />
              <span className="text-sm font-mono text-green-800">{lead.emailFound}</span>
              <ConfidenceBadge confidence={lead.emailConfidence} />
              {sequenceStatus && (
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[sequenceStatus]}`}>
                  {sequenceStatus.charAt(0).toUpperCase() + sequenceStatus.slice(1)}
                </span>
              )}
            </div>
          )}

          {/* Lead context */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
              {lead.title && <span className="italic">{lead.title}</span>}
              {lead.subredditOrChannel && <span>{lead.subredditOrChannel}</span>}
              <CategoryBadge category={lead.category} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Context for AI (lead's bio — optional)</label>
              <textarea
                value={leadContext}
                onChange={(e) => setLeadContext(e.target.value)}
                placeholder="Paste the lead's bio or any context to personalize the sequence..."
                className="w-full text-xs border rounded-lg p-2 min-h-[60px] resize-none bg-white"
              />
            </div>
          </div>

          {/* Content Hub Email Picker */}
          {hubEmails.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-indigo-500" /> Email 1 source (from Content Hub)
              </label>
              <select
                value={contentHubEmailId ?? ""}
                onChange={(e) => setContentHubEmailId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full text-sm border rounded-lg px-3 py-2 bg-white text-gray-700"
              >
                <option value="">AI picks the most relevant one automatically</option>
                {hubEmails.map((e: { id: number; title: string; preview: string }) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
              {contentHubEmailTitle && !contentHubEmailId && (
                <p className="text-xs text-indigo-600">✓ AI selected: <span className="font-medium">"{contentHubEmailTitle}"</span></p>
              )}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {generateMutation.isPending ? "Writing sequence..." : drafts ? "Regenerate Sequence" : "Generate 3-Email Sequence"}
          </button>

          {/* Email tabs */}
          {drafts && (
            <div className="space-y-3">
              <div className="flex gap-1 border-b border-gray-200">
                {([1, 2, 3] as const).map((num) => (
                  <button key={num} onClick={() => setActiveEmail(num)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeEmail === num ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                    Email {num}
                    {num === 1 && <span className="ml-1 text-xs text-indigo-400">(Content Hub)</span>}
                    {num === 2 && <span className="ml-1 text-xs text-gray-400">(Follow-up)</span>}
                    {num === 3 && <span className="ml-1 text-xs text-gray-400">(Academy Invite)</span>}
                  </button>
                ))}
              </div>
              {currentDraft && (
                <div className="space-y-3">
                  {activeEmail === 1 && contentHubEmailTitle && (
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                      <Mail className="w-3 h-3" /> From Content Hub: <strong>"{contentHubEmailTitle}"</strong>
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Subject Line</label>
                    <input
                      value={currentDraft.subject}
                      onChange={(e) => setDrafts(prev => prev ? { ...prev, [`email${activeEmail}`]: { ...prev[`email${activeEmail}`], subject: e.target.value } } : prev)}
                      className="w-full text-sm border rounded-lg px-3 py-2 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Body</label>
                    <textarea
                      value={currentDraft.body}
                      onChange={(e) => setDrafts(prev => prev ? { ...prev, [`email${activeEmail}`]: { ...prev[`email${activeEmail}`], body: e.target.value } } : prev)}
                      className="w-full text-sm border rounded-lg px-3 py-2 min-h-[200px] resize-none bg-white font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleCopy(activeEmail)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50">
                      {copied === activeEmail ? <CheckCheck className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === activeEmail ? "Copied!" : "Copy Email"}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button onClick={handleSave} disabled={saveMutation.isPending || !sequenceId} className="flex-1 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {saveMutation.isPending ? "Saving..." : "Save Edits"}
                </button>
                {sequenceStatus === "draft" && (
                  <button
                    onClick={handleApproveAndSend}
                    disabled={approveAndSendMutation.isPending || saveMutation.isPending || !sequenceId}
                    className="flex-1 py-2 text-sm font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    {approveAndSendMutation.isPending || saveMutation.isPending ? "Sending Email 1..." : "✉ Approve & Send Email 1"}
                  </button>
                )}
                {sequenceStatus === "approved" && (
                  <div className="flex-1 text-center text-xs text-green-700 bg-green-50 rounded-lg py-2 px-3">
                    ✅ Email 1 sent · Emails 2 &amp; 3 queued automatically
                  </div>
                )}
                {sequenceStatus === "approved" && lead.emailFound && (
                  <KajabiPushButton email={lead.emailFound} name={lead.author ?? undefined} leadId={lead.id > 0 ? lead.id : undefined} category={lead.category ?? undefined} source="apollo" />
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pipeline Tab ─────────────────────────────────────────────────────────────

function PipelineTab() {
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sequenceLead, setSequenceLead] = useState<Lead | null>(null);
  const pageSize = 20;

  const { data: dailyStats } = trpc.leadScrubber.getDailyStats.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: lastSyncRun, refetch: refetchLastSync } = trpc.leadScrubber.getLastSyncRun.useQuery(undefined, { refetchInterval: 120_000 });
  const { data, isLoading, refetch } = trpc.leadScrubber.listLeads.useQuery({
    source: "apollo",
    status: statusFilter === "archived" ? "archived" : "active",
    page,
    pageSize,
  });

  const leads = (data?.leads ?? []) as Lead[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Daily progress toward 133 target
  const todayCount = dailyStats?.daily?.[0]?.emailsFound ?? 0;
  const TARGET = 133;
  const progressPct = Math.min(100, Math.round((todayCount / TARGET) * 100));

  return (
    <div className="space-y-6">
      {/* Daily Draw Status */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-sm text-indigo-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              Apollo Daily Draw — Automated Pipeline
            </p>
            <p className="text-xs text-indigo-600 mt-0.5">
              Runs every day at 08:00 UTC · 9 categories · email-verified leads only · target: 133/day
            </p>
          </div>
          <div className="text-xs text-indigo-500 bg-white border border-indigo-200 rounded-lg px-3 py-1.5">
            Next run: <span className="font-semibold">08:00 UTC</span>
          </div>
        </div>

        {/* Today's progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-medium text-indigo-800">Today's emails found</span>
            <span className="font-bold text-indigo-900">{todayCount} / {TARGET}</span>
          </div>
          <div className="w-full bg-indigo-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${progressPct >= 100 ? "bg-green-500" : "bg-indigo-500"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {progressPct >= 100 && (
            <p className="text-xs text-green-700 font-medium mt-1">🎯 Daily target reached!</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white rounded-lg p-3 border border-indigo-100 text-center">
            <p className="text-2xl font-bold text-indigo-700">{dailyStats?.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Total Leads</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-100 text-center">
            <p className="text-2xl font-bold text-green-600">{dailyStats?.emailFound ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Emails Found</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-100 text-center">
            <p className="text-2xl font-bold text-blue-600">{dailyStats?.emailRevealRate ?? 0}%</p>
            <p className="text-xs text-gray-500 mt-0.5">Reveal Rate</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-purple-100 text-center">
            <p className="text-2xl font-bold text-purple-600">{dailyStats?.metaPushed ?? 0}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pushed to Meta</p>
          </div>
        </div>

        {/* Per-day breakdown */}
        {dailyStats && dailyStats.daily.length > 0 && (
          <div className="bg-white rounded-lg border border-indigo-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-indigo-50">
                  <th className="text-left px-3 py-2 text-indigo-700 font-semibold">Date</th>
                  <th className="text-right px-3 py-2 text-indigo-700 font-semibold">Leads Added</th>
                  <th className="text-right px-3 py-2 text-indigo-700 font-semibold">Emails Found</th>
                  <th className="text-right px-3 py-2 text-indigo-700 font-semibold">Reveal Rate</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.daily.map((row, i) => (
                  <tr key={row.day} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 text-gray-700 font-medium">{row.day}</td>
                    <td className="px-3 py-2 text-right text-gray-800 font-semibold">{row.count}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-semibold">{row.emailsFound}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{row.count > 0 ? Math.round((row.emailsFound / row.count) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dailyStats && dailyStats.daily.length === 0 && (
          <p className="text-xs text-indigo-500 text-center py-2">
            No draws yet — first run tomorrow at 08:00 UTC. The pipeline is set up and ready.
          </p>
        )}

        {/* Last Run Status */}
        <div className="mt-4 pt-4 border-t border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Last Run Status
            </p>
            <button
              onClick={() => refetchLastSync()}
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          {!lastSyncRun ? (
            <p className="text-xs text-indigo-400 italic">No runs recorded yet — will update after the first automated draw.</p>
          ) : (
            <div className="bg-white rounded-lg border border-indigo-100 p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Status badge */}
                <div className="flex items-center gap-2">
                  {lastSyncRun.status === "success" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Success
                    </span>
                  )}
                  {lastSyncRun.status === "partial" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2.5 py-0.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Partial
                    </span>
                  )}
                  {lastSyncRun.status === "error" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                      <AlertCircle className="w-3.5 h-3.5" /> Error
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {new Date(lastSyncRun.ranAt).toLocaleString()} · {lastSyncRun.triggeredBy === "manual" ? "Manual" : "Scheduled"}
                  </span>
                </div>
                {/* Elapsed */}
                <span className="text-xs text-gray-400">{Math.round((lastSyncRun.elapsedMs ?? 0) / 1000)}s elapsed</span>
              </div>
              {/* Stats row */}
              <div className="flex flex-wrap gap-4 mt-2.5">
                <div className="text-center">
                  <p className="text-base font-bold text-indigo-700">{lastSyncRun.totalSearched ?? 0}</p>
                  <p className="text-xs text-gray-400">Searched</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-green-600">{lastSyncRun.totalEmails ?? 0}</p>
                  <p className="text-xs text-gray-400">Emails Found</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-blue-600">{lastSyncRun.totalReveals ?? 0}</p>
                  <p className="text-xs text-gray-400">Credits Used</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-purple-600">{lastSyncRun.totalMetaPushed ?? 0}</p>
                  <p className="text-xs text-gray-400">Meta Pushed</p>
                </div>
              </div>
              {/* Error message */}
              {lastSyncRun.errorMessage && (
                <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1 border border-red-100">
                  {lastSyncRun.errorMessage}
                </p>
              )}
              {/* Category summary */}
              {lastSyncRun.categorySummary && lastSyncRun.categorySummary.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">By Category</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(lastSyncRun.categorySummary as Array<{category: string; searched: number; emails: number; reveals: number; error?: string | null}>).map((cat) => (
                      <span
                        key={cat.category}
                        className={`text-xs rounded-full px-2 py-0.5 border ${
                          cat.error
                            ? "bg-red-50 border-red-200 text-red-700"
                            : cat.emails > 0
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-gray-50 border-gray-200 text-gray-500"
                        }`}
                      >
                        {cat.category.replace(/_/g, " ")}: <strong>{cat.emails}</strong> emails
                        {cat.error && " ⚠"}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* By category */}
        {dailyStats && dailyStats.byCategory.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold text-indigo-700 mb-2">By Category</p>
            <div className="flex flex-wrap gap-2">
              {dailyStats.byCategory.map(cat => (
                <span key={cat.category} className="text-xs bg-white border border-indigo-200 rounded-full px-2.5 py-1 text-indigo-700">
                  {cat.category.replace(/_/g, " ")}: <strong>{cat.count}</strong> · <span className="text-green-600">{cat.emailsFound} emails</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lead list controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          <button onClick={() => { setStatusFilter("active"); setPage(1); }} className={`text-sm px-3 py-1 rounded-full ${statusFilter === "active" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}>
            Active ({statusFilter === "active" ? total : "?"})
          </button>
          <button onClick={() => { setStatusFilter("archived"); setPage(1); }} className={`text-sm px-3 py-1 rounded-full ${statusFilter === "archived" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-600"}`}>
            Archived
          </button>
        </div>
        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="text-sm border rounded-lg px-3 py-1.5 bg-white text-gray-700 ml-auto"
        >
          <option value="">All categories</option>
          {URBAN_MONK_PERSONAS.map(p => (
            <option key={p.category} value={p.category}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Lead cards */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-gray-500">No email-verified leads yet</p>
          <p className="text-xs mt-1">The automated draw runs daily at 08:00 UTC and will populate this list. You can also use the Search tab to pull leads manually right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onRefresh={refetch} onOpenEmailSequence={setSequenceLead} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}

      {sequenceLead && <EmailSequenceModal lead={sequenceLead} onClose={() => setSequenceLead(null)} />}
    </div>
  );
}

// ─── Manual Search Tab ────────────────────────────────────────────────────────

function SearchTab() {
  const [titles, setTitles] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("United States");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ApolloPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [sequenceApolloLead, setSequenceApolloLead] = useState<Lead | null>(null);
  const [view, setView] = useState<"search" | "saved">("saved");
  const [savedPage, setSavedPage] = useState(1);

  const { data: savedData, refetch: refetchSaved } = trpc.leadScrubber.listLeads.useQuery({
    source: "apollo",
    status: "active",
    page: savedPage,
    pageSize: 20,
  });
  const savedLeads = (savedData?.leads ?? []) as Lead[];
  const savedTotal = savedData?.total ?? 0;
  const savedTotalPages = Math.ceil(savedTotal / 20);

  const search = trpc.leadScrubber.apolloSearchLeads.useMutation({
    onSuccess: (data) => {
      setResults(data.people as ApolloPerson[]);
      setTotal(data.total);
      setMessage(data.message ?? "");
      if (!data.success && data.message) toast.error(data.message);
      else if (data.success && data.people.length > 0) { refetchSaved(); setView("search"); }
    },
    onError: () => toast.error("Apollo search failed"),
  });

  const togglePersona = (personaTitles: string[], personaCategory?: string) => {
    setTitles((prev) => {
      const allIn = personaTitles.every((t) => prev.includes(t));
      if (allIn) return prev.filter((t) => !personaTitles.includes(t));
      return Array.from(new Set([...prev, ...personaTitles]));
    });
    if (personaCategory) setSelectedCategory(personaCategory);
  };

  const handleSearch = (p = 1) => {
    setPage(p);
    const kwArr = keywords.trim() ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined;
    search.mutate({ titles: titles.length ? titles : undefined, keywords: kwArr, locations: location.trim() ? [location.trim()] : undefined, page: p, perPage: 10 });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1 flex items-center gap-2"><Search className="w-4 h-4" /> Manual Apollo Search</p>
        <p>Search Apollo's 275M+ contact database by job title and location. Results are automatically saved with email addresses revealed. Uses your Apollo Professional plan credits (4,000/mo).</p>
      </div>

      {/* Persona Quick-Select */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Target Persona</h3>
        <div className="flex flex-wrap gap-2">
          {URBAN_MONK_PERSONAS.map((p) => {
            const active = p.titles.every((t) => titles.includes(t));
            return (
              <button
                key={p.label}
                onClick={() => togglePersona(p.titles, p.category)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add custom job title..."
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && customTitle.trim()) { setTitles((prev) => Array.from(new Set([...prev, customTitle.trim()]))); setCustomTitle(""); } }}
            className="text-sm h-8"
          />
          <Button size="sm" className="h-8" onClick={() => { if (customTitle.trim()) { setTitles((prev) => Array.from(new Set([...prev, customTitle.trim()]))); setCustomTitle(""); } }}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {titles.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {titles.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {t}
                <button onClick={() => setTitles((prev) => prev.filter((x) => x !== t))} className="hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Keywords (comma-separated)</label>
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="meditation, stress, burnout" className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Location</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="United States" className="text-sm" />
          </div>
        </div>

        <Button className="w-full" onClick={() => handleSearch(1)} disabled={search.isPending || (!titles.length && !keywords.trim())}>
          {search.isPending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Searching Apollo...</> : <><Search className="w-4 h-4 mr-2" /> Search & Reveal Emails</>}
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button onClick={() => setView("saved")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === "saved" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
          Saved Leads ({savedTotal})
        </button>
        {results.length > 0 && (
          <button onClick={() => setView("search")} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${view === "search" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            Latest Search ({results.length})
          </button>
        )}
      </div>

      {view === "search" && message && <p className="text-sm text-gray-500">{message} {total > 10 && `(showing page ${page})`}</p>}

      {/* Saved leads */}
      {view === "saved" && (
        <div className="space-y-3">
          {savedLeads.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No saved leads yet. Run a search above or wait for the daily draw.</p>
            </div>
          ) : (
            savedLeads.map((lead) => <LeadCard key={lead.id} lead={lead} onRefresh={refetchSaved} onOpenEmailSequence={setSequenceApolloLead} />)
          )}
          {savedTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="outline" disabled={savedPage <= 1} onClick={() => setSavedPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm text-gray-600">Page {savedPage} of {savedTotalPages}</span>
              <Button size="sm" variant="outline" disabled={savedPage >= savedTotalPages} onClick={() => setSavedPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* Search results */}
      {view === "search" && results.length > 0 && (
        <div className="space-y-3">
          {results.map((person) => (
            <div key={person.id} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{person.name || "Unknown"}</p>
                  <p className="text-xs text-gray-500">{person.title}</p>
                  {person.company && <p className="text-xs text-gray-400">{person.company}{person.location ? ` · ${person.location}` : ""}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-green-600 font-medium">✓ Auto-saved</span>
                  {person.linkedinUrl && (
                    <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4 text-gray-400 hover:text-primary" /></a>
                  )}
                </div>
              </div>
              {person.email ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <Mail className="w-3.5 h-3.5 text-green-600" />
                  <span className="text-sm font-mono text-green-800">{person.email}</span>
                  {person.emailStatus && <span className="text-xs text-gray-400">({person.emailStatus})</span>}
                </div>
              ) : (
                <p className="text-xs text-amber-600 italic bg-amber-50 rounded-lg px-3 py-2">No email found — this lead was not saved (email-only policy)</p>
              )}
              {person.email && (
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setSequenceApolloLead({
                      id: 0, source: "apollo", sourceId: person.id, title: person.title, body: `${person.title ?? ""} at ${person.company ?? ""}`,
                      url: person.linkedinUrl ?? "", author: person.name, subredditOrChannel: person.company, keywordsMatched: null,
                      category: selectedCategory ?? null, status: "new", notes: null, engagedAt: null, emailFound: person.email,
                      emailConfidence: person.emailStatus, archivedAt: null, createdAt: new Date(),
                    })}
                    className="text-xs font-medium px-2 py-1 rounded border text-indigo-700 border-indigo-300 hover:bg-indigo-50 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Email Sequence
                  </button>
                  <KajabiPushButton email={person.email} name={person.name} category={selectedCategory} source="apollo" />
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => handleSearch(page - 1)} disabled={page <= 1 || search.isPending}><ChevronLeft className="w-4 h-4 mr-1" /> Previous</Button>
            <span className="text-xs text-gray-500">Page {page}</span>
            <Button variant="outline" size="sm" onClick={() => handleSearch(page + 1)} disabled={results.length < 10 || search.isPending}>Next <ChevronRight className="w-4 h-4 ml-1" /></Button>
          </div>
        </div>
      )}

      {sequenceApolloLead && <EmailSequenceModal lead={sequenceApolloLead} onClose={() => setSequenceApolloLead(null)} />}
    </div>
  );
}

// ─── Email Sequences Tab ──────────────────────────────────────────────────────

function SequencesTab() {
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const { data: sequences = [], isLoading, refetch } = trpc.emailSequence.getEmailSequences.useQuery({});
  const { data: gmailStatus } = trpc.backlink.getGmailStatus.useQuery();
  const { data: gmailAuthUrlData } = trpc.backlink.getGmailAuthUrl.useQuery(undefined, { enabled: gmailStatus !== undefined });

  const deleteMutation = trpc.emailSequence.deleteEmailSequence.useMutation({
    onSuccess: () => { refetch(); toast.success("Sequence deleted"); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });

  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-600", approved: "bg-green-100 text-green-700", sent: "bg-blue-100 text-blue-700", replied: "bg-purple-100 text-purple-700" };

  return (
    <div className="space-y-4">
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-800">
        <p className="font-semibold mb-1">Cold Email Sequences</p>
        <p>AI-generated 3-email sequences in Dr. Pedram's voice. Draft → Approve &amp; Send. Email 1 sends immediately and the contact is <strong>automatically pushed to Kajabi</strong>. Emails 2 &amp; 3 auto-send on Day 3 and Day 7. If the Kajabi push fails, a re-push button appears on the card.</p>
      </div>

      {gmailStatus && !gmailStatus.authorized && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Mail className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">Gmail not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">Connect Gmail to enable automatic sending as "The Urban Monk" from alyzza@theurbanmonk.com.</p>
          </div>
          <button onClick={() => { if (gmailAuthUrlData?.url) { const popup = window.open(gmailAuthUrlData.url, 'gmail_auth', 'width=600,height=700,scrollbars=yes'); const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); trpc.useUtils().backlink.getGmailStatus.invalidate(); } }, 1000); } }} className="shrink-0 px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
            Connect Gmail
          </button>
        </div>
      )}
      {gmailStatus?.authorized && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-xs text-green-800">
          <span className="text-green-500">✓</span>
          <span className="flex-1">Gmail connected — sequences will send automatically as "The Urban Monk" from alyzza@theurbanmonk.com.</span>
          <button onClick={() => { const url = gmailAuthUrlData?.url; if (url) { const popup = window.open(url, 'gmail_auth', 'width=600,height=700,scrollbars=yes'); const timer = setInterval(() => { if (popup?.closed) { clearInterval(timer); trpc.useUtils().backlink.getGmailStatus.invalidate(); } }, 1000); } }} className="shrink-0 px-2 py-1 text-xs font-medium bg-green-700 hover:bg-green-800 text-white rounded-md">
            Reconnect
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading sequences...</div>
      ) : sequences.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No sequences yet. Click "Email Sequence" on any lead card to generate one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(sequences as EmailSequence[]).map((seq) => (
            <div key={seq.id} className="bg-white border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[seq.status] ?? statusColors.draft}`}>
                      {seq.status.charAt(0).toUpperCase() + seq.status.slice(1)}
                    </span>
                    <p className="font-semibold text-gray-900 text-sm">{seq.leadName ?? "Unknown Lead"}</p>
                    {seq.leadTitle && <span className="text-xs text-gray-500">{seq.leadTitle}</span>}
                    {seq.leadCompany && <span className="text-xs text-gray-400">{seq.leadCompany}</span>}
                  </div>
                  {seq.leadEmail && (
                    <div className="flex items-center gap-1 mt-1">
                      <Mail className="w-3 h-3 text-green-500" />
                      <span className="text-xs font-mono text-green-700">{seq.leadEmail}</span>
                    </div>
                  )}
                  {seq.email1Subject && <p className="text-xs text-gray-500 mt-1 italic">Email 1: "{seq.email1Subject}"</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingLead({ id: seq.leadId, source: "apollo", sourceId: String(seq.leadId), title: seq.leadTitle, body: "", url: "", author: seq.leadName, subredditOrChannel: seq.leadCompany, keywordsMatched: null, category: seq.category, status: "new", notes: null, engagedAt: null, emailFound: seq.leadEmail, emailConfidence: null, archivedAt: null, createdAt: new Date(seq.createdAt) })}
                    className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => deleteMutation.mutate({ sequenceId: seq.id })} disabled={deleteMutation.isPending} className="text-xs text-red-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {/* Kajabi push status */}
              {seq.status !== "draft" && (
                <div className="flex items-center gap-2">
                  {seq.kajabiPushed ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <span>✓</span> In Kajabi
                    </span>
                  ) : seq.kajabiPushError ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">Kajabi push failed</span>
                      <RepushKajabiButton sequenceId={seq.id} onSuccess={refetch} />
                    </div>
                  ) : (
                    <RepushKajabiButton sequenceId={seq.id} onSuccess={refetch} />
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400">Created {new Date(seq.createdAt).toLocaleDateString()} · Updated {new Date(seq.updatedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      {editingLead && <EmailSequenceModal lead={editingLead} onClose={() => { setEditingLead(null); refetch(); }} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadScrubber() {
  const [activeTab, setActiveTab] = useState<"pipeline" | "search" | "sequences">("pipeline");

  const { data: stats = [] } = trpc.leadScrubber.getStats.useQuery();
  const totalEmailLeads = stats
    .filter((s) => s.status === "email_found")
    .reduce((acc, s) => acc + Number(s.count), 0);

  const tabs = [
    { id: "pipeline" as const, label: "Pipeline", icon: TrendingUp },
    { id: "search" as const, label: "Manual Search", icon: Search },
    { id: "sequences" as const, label: "Email Sequences", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Scrubber</h1>
            <p className="text-sm text-gray-500 mt-1">
              Apollo.io pipeline — email-verified wellness professionals · target: 133 leads/day
            </p>
          </div>
          {totalEmailLeads > 0 && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
              <Mail className="w-4 h-4 text-green-600" />
              <span className="text-sm font-bold text-green-800">{totalEmailLeads.toLocaleString()} email leads</span>
            </div>
          )}
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["email_found", "engaged", "converted", "archived"] as const).map((status) => {
              const count = stats.filter((s) => s.status === status).reduce((acc, s) => acc + Number(s.count), 0);
              const labels: Record<string, string> = { email_found: "Email Leads", engaged: "Engaged", converted: "Converted", archived: "Archived" };
              const colors: Record<string, string> = { email_found: "text-green-700", engaged: "text-amber-700", converted: "text-purple-700", archived: "text-gray-500" };
              return (
                <div key={status} className="bg-white border rounded-xl p-3 text-center">
                  <p className={`text-2xl font-bold ${colors[status]}`}>{count}</p>
                  <p className="text-xs text-gray-500">{labels[status]}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "pipeline" && <PipelineTab />}
          {activeTab === "search" && <SearchTab />}
          {activeTab === "sequences" && <SequencesTab />}
        </div>
      </div>
    </div>
  );
}
