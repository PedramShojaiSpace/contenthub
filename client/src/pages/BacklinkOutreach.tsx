import { useLocation } from "wouter";
/**
 * Backlink Outreach Engine
 *
 * Three-panel workflow:
 *   1. Discover — search for prospects by keyword via DataForSEO SERP
 *   2. Review Queue — approve or reject discovered prospects, add contact info
 *   3. Email Drafting — generate AI outreach emails, review, copy, and mark as sent
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  Send,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trophy,
  Link2,
  BarChart3,
  Globe,
  Pencil,
  Zap,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProspectStatus =
  | "discovered"
  | "approved"
  | "rejected"
  | "emailed"
  | "followed_up"
  | "followed_up_2"
  | "responded"
  | "won"
  | "lost";

type OutreachType = "guest_post" | "resource_page" | "broken_link";

interface Prospect {
  id: number;
  domain: string;
  pageUrl: string;
  pageTitle: string | null;
  domainAuthority: number | null;
  organicTraffic: number | null;
  topicRelevance: string | null;
  discoveryKeyword: string | null;
  outreachType: OutreachType;
  contactEmail: string | null;
  contactName: string | null;
  contactPageUrl: string | null;
  status: ProspectStatus;
  ownerNotes: string | null;
  discoveredAt: Date;
  approvedAt: Date | null;
  firstEmailSentAt: Date | null;
  wonAt: Date | null;
  placedLinkUrl: string | null;
  linkAnchorText: string | null;
  linkIsLive: boolean | null;
  linkLastCheckedAt: Date | null;
}

interface BacklinkEmail {
  id: number;
  prospectId: number;
  emailType: "initial" | "follow_up_1" | "follow_up_2" | "custom";
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent" | "bounced";
  sentAt: Date | null;
  createdAt: Date;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProspectStatus }) {
  const map: Record<ProspectStatus, { label: string; className: string }> = {
    discovered: { label: "Discovered", className: "bg-slate-100 text-slate-700" },
    approved: { label: "Approved", className: "bg-blue-100 text-blue-700" },
    rejected: { label: "Rejected", className: "bg-red-100 text-red-600" },
    emailed: { label: "Emailed", className: "bg-amber-100 text-amber-700" },
    followed_up: { label: "Follow-up 1", className: "bg-orange-100 text-orange-700" },
    followed_up_2: { label: "Follow-up 2", className: "bg-orange-200 text-orange-800" },
    responded: { label: "Responded", className: "bg-purple-100 text-purple-700" },
    won: { label: "Won ✓", className: "bg-green-100 text-green-700" },
    lost: { label: "Lost", className: "bg-gray-100 text-gray-500" },
  };
  const { label, className } = map[status] ?? map.discovered;
  return <Badge className={`text-xs font-medium ${className}`}>{label}</Badge>;
}

// ─── Prospect Card ────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  onApprove,
  onReject,
  onDraftEmail,
  onEditContact,
  onMarkWon,
  onMarkStatus,
  onCheckLink,
  checkingLinkId,
}: {
  prospect: Prospect;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onDraftEmail: (prospect: Prospect) => void;
  onEditContact: (prospect: Prospect) => void;
  onMarkWon: (prospect: Prospect) => void;
  onMarkStatus: (prospect: Prospect) => void;
  onCheckLink: (prospect: Prospect) => void;
  checkingLinkId: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://${prospect.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-sm text-primary hover:underline flex items-center gap-1"
              >
                <Globe className="w-3.5 h-3.5" />
                {prospect.domain}
                <ExternalLink className="w-3 h-3" />
              </a>
              <StatusBadge status={prospect.status} />
              <Badge variant="outline" className="text-xs capitalize">
                {prospect.outreachType.replace("_", " ")}
              </Badge>
            </div>

            <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
              {prospect.domainAuthority !== null && (
                <span className="flex items-center gap-1">
                  <BarChart3 className="w-3 h-3" />
                  DA {prospect.domainAuthority}
                </span>
              )}
              {prospect.organicTraffic !== null && (
                <span>{prospect.organicTraffic.toLocaleString()} mo. visits</span>
              )}
              {prospect.topicRelevance && (
                <span className="text-primary/70">"{prospect.topicRelevance}"</span>
              )}
            </div>

            {prospect.pageTitle && (
              <p className="text-xs text-muted-foreground mt-1 truncate max-w-lg">
                {prospect.pageTitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {prospect.status === "discovered" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                  onClick={() => onApprove(prospect.id)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => onReject(prospect.id)}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {(prospect.status === "approved" || prospect.status === "emailed" || prospect.status === "followed_up" || prospect.status === "followed_up_2" || prospect.status === "responded") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => onEditContact(prospect)}
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Contact
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs bg-primary"
                  onClick={() => onDraftEmail(prospect)}
                >
                  <Mail className="w-3.5 h-3.5 mr-1" />
                  Draft Email
                </Button>
              </>
            )}
            {(prospect.status === "responded") && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                onClick={() => onMarkWon(prospect)}
              >
                <Trophy className="w-3.5 h-3.5 mr-1" />
                Mark Won
              </Button>
            )}
            {prospect.status === "won" && (
              <Button
                size="sm"
                variant="outline"
                className={`h-7 text-xs ${
                  prospect.linkIsLive === false
                    ? "text-red-600 border-red-200 hover:bg-red-50"
                    : prospect.linkIsLive === true
                    ? "text-green-700 border-green-200 hover:bg-green-50"
                    : "text-muted-foreground"
                }`}
                onClick={() => onCheckLink(prospect)}
                disabled={checkingLinkId === prospect.id}
              >
                {checkingLinkId === prospect.id ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : prospect.linkIsLive === false ? (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                )}
                {prospect.linkIsLive === false ? "Link Removed!" : prospect.linkIsLive === true ? "Link Live ✓" : "Check Link"}
              </Button>
            )}
            {(prospect.status === "emailed" || prospect.status === "followed_up" || prospect.status === "followed_up_2") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => onMarkStatus(prospect)}
              >
                Update Status
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Page URL: </span>
              <a href={prospect.pageUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
                {prospect.pageUrl}
              </a>
            </div>
            {prospect.contactEmail && (
              <div>
                <span className="font-medium text-foreground">Contact: </span>
                {prospect.contactName && `${prospect.contactName} — `}
                <a href={`mailto:${prospect.contactEmail}`} className="text-primary hover:underline">
                  {prospect.contactEmail}
                </a>
              </div>
            )}
            {prospect.ownerNotes && (
              <div>
                <span className="font-medium text-foreground">Notes: </span>
                {prospect.ownerNotes}
              </div>
            )}
            {prospect.placedLinkUrl && (
              <div>
                <span className="font-medium text-foreground">Link placed: </span>
                <a href={prospect.placedLinkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {prospect.placedLinkUrl}
                </a>
                {prospect.linkAnchorText && ` (anchor: "${prospect.linkAnchorText}")`}
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Discovered: </span>
              {new Date(prospect.discoveredAt).toLocaleDateString()}
              {prospect.firstEmailSentAt && (
                <> · <span className="font-medium text-foreground">Emailed: </span>{new Date(prospect.firstEmailSentAt).toLocaleDateString()}</>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Email Draft Dialog ───────────────────────────────────────────────────────

function EmailDraftDialog({
  prospect,
  onClose,
}: {
  prospect: Prospect | null;
  onClose: () => void;
}) {
  const [emailType, setEmailType] = useState<"initial" | "follow_up_1" | "follow_up_2">("initial");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [activeEmailId, setActiveEmailId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: gmailStatus, refetch: refetchGmailStatus } = trpc.backlink.getGmailStatus.useQuery();
  const { data: gmailAuthUrlData } = trpc.backlink.getGmailAuthUrl.useQuery(undefined, { enabled: gmailStatus !== undefined });

  const { data: emails } = trpc.backlink.listEmails.useQuery(
    { prospectId: prospect?.id ?? 0 },
    { enabled: !!prospect }
  );

  const draftMutation = trpc.backlink.draftEmail.useMutation({
    onSuccess: (email) => {
      setEditedSubject(email.subject);
      setEditedBody(email.body);
      setActiveEmailId(email.id);
      utils.backlink.listEmails.invalidate({ prospectId: prospect?.id });
      toast.success("Email drafted — review and edit below");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEmailMutation = trpc.backlink.updateEmail.useMutation({
    onSuccess: () => {
      utils.backlink.listEmails.invalidate({ prospectId: prospect?.id });
      toast.success("Email saved");
    },
  });

  const markSentMutation = trpc.backlink.markEmailSent.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      toast.success("Marked as sent — prospect status updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const sendEmailMutation = trpc.backlink.sendEmail.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      utils.backlink.listEmails.invalidate({ prospectId: prospect?.id });
      toast.success("✅ Email sent via Gmail! Prospect status updated.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDraft = () => {
    if (!prospect) return;
    draftMutation.mutate({ prospectId: prospect.id, emailType });
  };

  const handleSaveEdits = () => {
    if (!activeEmailId) return;
    updateEmailMutation.mutate({ id: activeEmailId, subject: editedSubject, body: editedBody });
  };

  const handleApproveAndSend = async () => {
    if (!activeEmailId) return;
    // First save any edits, then approve, then send
    await updateEmailMutation.mutateAsync({ id: activeEmailId, subject: editedSubject, body: editedBody, status: "approved" });
    sendEmailMutation.mutate({ emailId: activeEmailId });
  };

  const handleCopy = () => {
    const text = `Subject: ${editedSubject}\n\n${editedBody}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleMarkSent = () => {
    if (!prospect || !activeEmailId) return;
    markSentMutation.mutate({
      emailId: activeEmailId,
      prospectId: prospect.id,
      emailType,
    });
  };

  const loadEmail = (email: BacklinkEmail) => {
    setEditedSubject(email.subject);
    setEditedBody(email.body);
    setActiveEmailId(email.id);
    setEmailType(email.emailType === "custom" ? "initial" : email.emailType);
  };

  if (!prospect) return null;

  const isSending = sendEmailMutation.isPending || updateEmailMutation.isPending;

  return (
    <Dialog open={!!prospect} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            Outreach Email — {prospect.domain}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Gmail status banner */}
          {gmailStatus && !gmailStatus.authorized && (
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-amber-900">Gmail not connected</p>
                <p className="text-xs text-amber-700">Connect Gmail to send directly from Alyzza's account, or use Copy + send manually.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => {
                  if (!gmailAuthUrlData?.url) { toast.error("Could not get Gmail auth URL"); return; }
                  const popup = window.open(gmailAuthUrlData.url, 'gmail_auth', 'width=600,height=700,scrollbars=yes');
                  const timer = setInterval(() => {
                    if (popup?.closed) {
                      clearInterval(timer);
                      utils.backlink.getGmailStatus.invalidate();
                      refetchGmailStatus();
                    }
                  }, 1000);
                }}
              >
                Connect Gmail
              </Button>
            </div>
          )}

          {/* Existing drafts */}
          {emails && emails.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Previous drafts:</p>
              <div className="flex flex-wrap gap-2">
                {emails.map((e: BacklinkEmail) => (
                  <Button
                    key={e.id}
                    size="sm"
                    variant={activeEmailId === e.id ? "default" : "outline"}
                    className="h-7 text-xs"
                    onClick={() => loadEmail(e)}
                  >
                    {e.emailType.replace("_", " ")}
                    {e.status === "sent" && " ✓"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Generate new draft */}
          <div className="flex gap-2">
            <Select value={emailType} onValueChange={(v) => setEmailType(v as typeof emailType)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="initial">Initial Outreach</SelectItem>
                <SelectItem value="follow_up_1">Follow-up #1</SelectItem>
                <SelectItem value="follow_up_2">Follow-up #2</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="h-9 text-sm flex-1"
              onClick={handleDraft}
              disabled={draftMutation.isPending}
            >
              {draftMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Drafting…</>
              ) : (
                <><Mail className="w-4 h-4 mr-2" />Generate Draft</>
              )}
            </Button>
          </div>

          {/* Email editor */}
          {(editedSubject || editedBody) && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Subject</label>
                <Input
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Body</label>
                <Textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  className="mt-1 text-sm min-h-[280px] font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex gap-2 pt-1 flex-wrap">
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleSaveEdits} disabled={updateEmailMutation.isPending}>
                  Save Edits
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleCopy}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>
                {gmailStatus?.authorized ? (
                  <Button
                    size="sm"
                    className="h-8 text-xs ml-auto bg-green-600 hover:bg-green-700"
                    onClick={handleApproveAndSend}
                    disabled={isSending || !activeEmailId || !prospect.contactEmail}
                    title={!prospect.contactEmail ? "Add contact email first" : ""}
                  >
                    {isSending ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Sending…</>
                    ) : (
                      <><Send className="w-3.5 h-3.5 mr-1.5" />Send via Gmail</>
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-xs ml-auto bg-green-600 hover:bg-green-700"
                    onClick={handleMarkSent}
                    disabled={markSentMutation.isPending || !activeEmailId}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Mark as Sent
                  </Button>
                )}
              </div>

              {!prospect.contactEmail && (
                <p className="text-xs text-amber-600">
                  ⚠️ No contact email set. Add it via the Edit Contact button before sending.
                </p>
              )}
              {!gmailStatus?.authorized && (
                <p className="text-xs text-muted-foreground">
                  Tip: Copy the email, send it from Gmail manually, then click "Mark as Sent" to update the pipeline.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Contact Edit Dialog ──────────────────────────────────────────────────────

function ContactEditDialog({
  prospect,
  onClose,
}: {
  prospect: Prospect | null;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(prospect?.contactEmail ?? "");
  const [name, setName] = useState(prospect?.contactName ?? "");
  const [contactPage, setContactPage] = useState(prospect?.contactPageUrl ?? "");
  const [notes, setNotes] = useState(prospect?.ownerNotes ?? "");
  const utils = trpc.useUtils();

  const updateMutation = trpc.backlink.updateContact.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      toast.success("Contact info saved");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!prospect) return null;

  return (
    <Dialog open={!!prospect} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Contact Info — {prospect.domain}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contact Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 text-sm" placeholder="Editor name (optional)" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Email Address</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 text-sm" placeholder="editor@example.com" type="email" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Contact Page URL</label>
            <Input value={contactPage} onChange={(e) => setContactPage(e.target.value)} className="mt-1 text-sm" placeholder="https://example.com/contact" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 text-sm min-h-[80px]" placeholder="Any notes about this prospect…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate({
              id: prospect.id,
              contactEmail: email || undefined,
              contactName: name || undefined,
              contactPageUrl: contactPage || undefined,
              ownerNotes: notes || undefined,
            })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mark Won Dialog ──────────────────────────────────────────────────────────

function MarkWonDialog({
  prospect,
  onClose,
}: {
  prospect: Prospect | null;
  onClose: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const utils = trpc.useUtils();

  const updateMutation = trpc.backlink.updateProspectStatus.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      toast.success("🎉 Backlink won! Added to your link portfolio.");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!prospect) return null;

  return (
    <Dialog open={!!prospect} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Mark Backlink as Won
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Record where the link was placed on <strong>{prospect.domain}</strong>.
          </p>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Page URL where link was placed</label>
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className="mt-1 text-sm" placeholder="https://example.com/blog/post" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Anchor text used</label>
            <Input value={anchorText} onChange={(e) => setAnchorText(e.target.value)} className="mt-1 text-sm" placeholder="The Urban Monk" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => updateMutation.mutate({
              id: prospect.id,
              status: "won",
              placedLinkUrl: linkUrl || undefined,
              linkAnchorText: anchorText || undefined,
            })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Win"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Status Update Dialog ─────────────────────────────────────────────────────

function StatusUpdateDialog({
  prospect,
  onClose,
}: {
  prospect: Prospect | null;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<ProspectStatus>(prospect?.status ?? "emailed");
  const utils = trpc.useUtils();

  const updateMutation = trpc.backlink.updateProspectStatus.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      toast.success("Status updated");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!prospect) return null;

  return (
    <Dialog open={!!prospect} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Update Status — {prospect.domain}</DialogTitle>
        </DialogHeader>
        <Select value={status} onValueChange={(v) => setStatus(v as ProspectStatus)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="emailed">Emailed</SelectItem>
            <SelectItem value="followed_up">Followed Up #1</SelectItem>
            <SelectItem value="followed_up_2">Followed Up #2</SelectItem>
            <SelectItem value="responded">Responded</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => updateMutation.mutate({ id: prospect.id, status })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BacklinkOutreach() {
  const [, navigate] = useLocation();
  const [keyword, setKeyword] = useState("");
  const [outreachType, setOutreachType] = useState<OutreachType>("guest_post");
  const [activeTab, setActiveTab] = useState("discover");
  const [filterStatus, setFilterStatus] = useState<ProspectStatus | "all">("all");

  // Dialog state
  const [emailProspect, setEmailProspect] = useState<Prospect | null>(null);
  const [contactProspect, setContactProspect] = useState<Prospect | null>(null);
  const [wonProspect, setWonProspect] = useState<Prospect | null>(null);
  const [statusProspect, setStatusProspect] = useState<Prospect | null>(null);
  const [checkingLinkId, setCheckingLinkId] = useState<number | null>(null);
  const [bulkDiscovering, setBulkDiscovering] = useState(false);

  const utils = trpc.useUtils();

  const { data: gmailStatus, refetch: refetchGmailStatus } = trpc.backlink.getGmailStatus.useQuery();
  const { data: gmailAuthUrlData } = trpc.backlink.getGmailAuthUrl.useQuery(undefined, { enabled: gmailStatus !== undefined });
  const { data: stats } = trpc.backlink.getStats.useQuery();
  const { data: prospects, isLoading: loadingProspects } = trpc.backlink.listProspects.useQuery({
    status: filterStatus === "all" ? undefined : filterStatus,
    limit: 100,
  });

  const bulkDiscoverMutation = trpc.backlink.bulkDiscoverProspects.useMutation({
    onSuccess: (result) => {
      setBulkDiscovering(false);
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      toast.success(
        `Bulk discovery complete: ${result.totalAdded} new prospects across ${suggestedKeywords.length} keywords${result.totalSkipped > 0 ? ` (${result.totalSkipped} duplicates skipped)` : ""}`
      );
      if (result.totalAdded > 0) setActiveTab("review");
    },
    onError: (e) => {
      setBulkDiscovering(false);
      toast.error(e.message);
    },
  });

  const checkLinkMutation = trpc.backlink.checkLinkLive.useMutation({
    onSuccess: (result, variables) => {
      setCheckingLinkId(null);
      utils.backlink.listProspects.invalidate();
      if (result.linkFound) {
        toast.success(`✅ Backlink is live (HTTP ${result.httpStatus})`);
      } else {
        toast.error(`⚠️ Backlink not found — may have been removed (HTTP ${result.httpStatus})`);
      }
    },
    onError: (e) => {
      setCheckingLinkId(null);
      toast.error(e.message);
    },
  });

  const handleBulkDiscover = () => {
    setBulkDiscovering(true);
    bulkDiscoverMutation.mutate({ keywords: suggestedKeywords, outreachType });
  };

  const handleCheckLink = (prospect: Prospect) => {
    if (!prospect.placedLinkUrl) {
      toast.error("No placed link URL recorded — mark the prospect as Won first and enter the link URL");
      return;
    }
    setCheckingLinkId(prospect.id);
    checkLinkMutation.mutate({ prospectId: prospect.id });
  };

  const discoverMutation = trpc.backlink.discoverProspects.useMutation({
    onSuccess: (result) => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      if (result.added === 0) {
        toast.info(`No new prospects found (${result.skipped} already in pipeline)`);
      } else {
        toast.success(`Found ${result.added} new prospects${result.skipped > 0 ? ` (${result.skipped} already known)` : ""}`);
        setActiveTab("review");
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const approveMutation = trpc.backlink.approveProspect.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
      toast.success("Prospect approved — draft an email when ready");
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.backlink.rejectProspect.useMutation({
    onSuccess: () => {
      utils.backlink.listProspects.invalidate();
      utils.backlink.getStats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDiscover = () => {
    if (!keyword.trim()) {
      toast.error("Enter a keyword to search");
      return;
    }
    discoverMutation.mutate({ keyword: keyword.trim(), outreachType });
  };

  // Suggested keywords based on Pedram's content
  const suggestedKeywords = [
    "gut health tips",
    "how to reduce stress naturally",
    "sleep optimization",
    "mindfulness for busy professionals",
    "integrative medicine",
    "longevity diet",
    "cortisol and stress",
    "taoist wellness",
    "urban monk lifestyle",
    "detox for beginners",
  ];

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Hub
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link2 className="w-6 h-6 text-primary" />
            Backlink Outreach Engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find relevant sites, draft personalized outreach emails, and build domain authority.
          </p>
        </div>

        {/* Gmail connect banner */}
        {gmailStatus && !gmailStatus.authorized && (
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900">Connect Gmail to send outreach directly</p>
              <p className="text-xs text-blue-700 mt-0.5">Authorize Alyzza's Gmail account to send emails from within this tool. Emails appear to come from Dr. Pedram Shojai.</p>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (!gmailAuthUrlData?.url) { toast.error("Could not get Gmail auth URL"); return; }
                const popup = window.open(gmailAuthUrlData.url, 'gmail_auth', 'width=600,height=700,scrollbars=yes');
                const timer = setInterval(() => {
                  if (popup?.closed) {
                    clearInterval(timer);
                    utils.backlink.getGmailStatus.invalidate();
                    refetchGmailStatus();
                  }
                }, 1000);
              }}
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              Connect Gmail
            </Button>
          </div>
        )}
        {gmailStatus?.authorized && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <p className="text-xs text-green-800 font-medium flex-1">Gmail connected — emails will be sent directly from Alyzza's account</p>
            <button
              onClick={() => {
                const url = gmailAuthUrlData?.url;
                if (!url) { toast.error("Could not get Gmail auth URL"); return; }
                const popup = window.open(url, 'gmail_auth', 'width=600,height=700,scrollbars=yes');
                const timer = setInterval(() => {
                  if (popup?.closed) {
                    clearInterval(timer);
                    utils.backlink.getGmailStatus.invalidate();
                    refetchGmailStatus();
                  }
                }, 1000);
              }}
              className="shrink-0 px-2 py-1 text-xs font-medium bg-green-700 hover:bg-green-800 text-white rounded-md"
            >
              Reconnect
            </button>
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Discovered", value: stats.discovered, color: "text-slate-600" },
              { label: "Approved", value: stats.approved, color: "text-blue-600" },
              { label: "Rejected", value: stats.rejected, color: "text-red-500" },
              { label: "Emailed", value: stats.emailed, color: "text-amber-600" },
              { label: "Follow-ups", value: stats.followed_up, color: "text-orange-600" },
              { label: "Responded", value: stats.responded, color: "text-purple-600" },
              { label: "Won 🎉", value: stats.won, color: "text-green-600" },
            ].map((s) => (
              <Card key={s.label} className="border border-border/40">
                <CardContent className="p-3 text-center">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full max-w-sm">
            <TabsTrigger value="discover">
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="review">
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              Pipeline
              {stats && stats.discovered > 0 && (
                <Badge className="ml-1.5 h-4 text-[10px] bg-primary text-primary-foreground px-1">
                  {stats.discovered}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Discover Tab ── */}
          <TabsContent value="discover" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Find Link Prospects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter a keyword your target audience searches for. The system will find the top-ranking sites for that keyword — these are your best prospects for guest posts and resource page links.
                </p>

                <div className="flex gap-2">
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="e.g. gut health tips, stress relief, sleep optimization"
                    className="flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleDiscover()}
                  />
                  <Select value={outreachType} onValueChange={(v) => setOutreachType(v as OutreachType)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest_post">Guest Post</SelectItem>
                      <SelectItem value="resource_page">Resource Page</SelectItem>
                      <SelectItem value="broken_link">Broken Link</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleDiscover} disabled={discoverMutation.isPending} className="shrink-0">
                    {discoverMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching…</>
                    ) : (
                      <><Search className="w-4 h-4 mr-2" />Find Prospects</>
                    )}
                  </Button>
                </div>

                {/* Bulk discover button */}
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-900">Bulk Discovery</p>
                    <p className="text-xs text-amber-700">Search all 10 suggested keywords at once and deduplicate results automatically.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100"
                    onClick={handleBulkDiscover}
                    disabled={bulkDiscovering || bulkDiscoverMutation.isPending}
                  >
                    {bulkDiscovering || bulkDiscoverMutation.isPending ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Discovering…</>
                    ) : (
                      <><Zap className="w-3.5 h-3.5 mr-1.5" />Discover All Topics</>
                    )}
                  </Button>
                </div>

                {/* Suggested keywords */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Suggested keywords for your niche:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedKeywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => setKeyword(kw)}
                        className="text-xs px-2.5 py-1 rounded-full border border-border/60 hover:border-primary hover:text-primary transition-colors bg-muted/30"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>

                {/* How it works */}
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold">How this works:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Enter a keyword → system finds top 15 sites ranking for it</li>
                    <li>Sites are scored by domain authority and organic traffic</li>
                    <li>Go to Pipeline tab → approve the best prospects</li>
                    <li>Add contact email (find it on their site's Contact page)</li>
                    <li>Generate a personalized AI email → copy → send from Gmail</li>
                    <li>Mark as Sent → follow up in 7 days if no reply</li>
                    <li>When they say yes → mark as Won and record the link</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Pipeline Tab ── */}
          <TabsContent value="review" className="space-y-4 mt-4">
            {/* Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">Filter:</p>
              {(["all", "discovered", "approved", "emailed", "followed_up", "responded", "won", "lost"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors capitalize ${
                    filterStatus === s
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 hover:border-primary hover:text-primary"
                  }`}
                >
                  {s === "all" ? "All Active" : s.replace("_", " ")}
                  {s !== "all" && stats && (
                    <span className="ml-1 opacity-70">
                      ({s === "followed_up" ? stats.followed_up : (stats as Record<string, number>)[s] ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Prospect list */}
            {loadingProspects ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !prospects || prospects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Link2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No prospects yet</p>
                <p className="text-sm mt-1">Use the Discover tab to find your first prospects.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(prospects as Prospect[]).map((p) => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    onApprove={(id) => approveMutation.mutate({ id })}
                    onReject={(id) => rejectMutation.mutate({ id })}
                    onDraftEmail={setEmailProspect}
                    onEditContact={setContactProspect}
                    onMarkWon={setWonProspect}
                    onMarkStatus={setStatusProspect}
                    onCheckLink={handleCheckLink}
                    checkingLinkId={checkingLinkId}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <EmailDraftDialog prospect={emailProspect} onClose={() => setEmailProspect(null)} />
      <ContactEditDialog prospect={contactProspect} onClose={() => setContactProspect(null)} />
      <MarkWonDialog prospect={wonProspect} onClose={() => setWonProspect(null)} />
      <StatusUpdateDialog prospect={statusProspect} onClose={() => setStatusProspect(null)} />
    </DashboardLayout>
  );
}
