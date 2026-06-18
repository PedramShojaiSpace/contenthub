import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search,
  Youtube,
  Mail,
  RefreshCw,
  Archive,
  RotateCcw,
  ExternalLink,
  Plus,
  Trash2,
  Settings,
  CheckCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Users,
  Send,
} from "lucide-react";

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
  status: "new" | "engaged" | "email_found" | "converted" | "archived";
  notes: string | null;
  engagedAt: number | null;
  emailFound: string | null;
  emailConfidence: string | null;
  archivedAt: number | null;
  createdAt: Date;
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Lead["status"] }) {
  const map: Record<Lead["status"], { label: string; className: string }> = {
    new: { label: "New", className: "bg-blue-100 text-blue-700" },
    engaged: { label: "Engaged", className: "bg-amber-100 text-amber-700" },
    email_found: { label: "Email Found", className: "bg-green-100 text-green-700" },
    converted: { label: "Converted", className: "bg-purple-100 text-purple-700" },
    archived: { label: "Archived", className: "bg-gray-100 text-gray-500" },
  };
  const { label, className } = map[status] ?? map.new;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onRefresh }: { lead: Lead; onRefresh: () => void }) {
  const [showNotes, setShowNotes] = useState(false);
  const [noteText, setNoteText] = useState(lead.notes ?? "");
  const [showEmailFinder, setShowEmailFinder] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");

  const utils = trpc.useUtils();

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

  const pushToKajabi = trpc.leadScrubber.pushToKajabi.useMutation({
    onSuccess: () => {
      onRefresh();
      toast.success("Pushed to Kajabi as a tagged contact!");
    },
    onError: (err) => toast.error(`Kajabi push failed: ${err.message}`),
  });

  const findEmail = trpc.leadScrubber.findEmail.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success(data.message ?? "Email found!");
        onRefresh();
      } else {
        toast.error(data.message ?? "No email found");
      }
    },
    onError: () => toast.error("Email lookup failed"),
  });

  const keywords = (() => {
    try { return JSON.parse(lead.keywordsMatched ?? "[]") as string[]; }
    catch { return []; }
  })();

  const isArchived = lead.status === "archived";

  return (
    <div className={`bg-white border rounded-xl p-4 space-y-3 ${isArchived ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={lead.status} />
            {lead.subredditOrChannel && (
              <span className="text-xs text-gray-500 font-medium">
                {lead.source === "reddit" ? `r/${lead.subredditOrChannel}` : lead.subredditOrChannel}
              </span>
            )}
            {lead.author && (
              <span className="text-xs text-gray-400">by @{lead.author}</span>
            )}
          </div>
          {lead.title && (
            <p className="text-sm font-semibold text-gray-800 mt-1 line-clamp-2">{lead.title}</p>
          )}
        </div>
        <a
          href={lead.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-primary shrink-0"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Body */}
      <p className="text-sm text-gray-600 line-clamp-3">{lead.body}</p>

      {/* Keywords */}
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.map((kw: string) => (
            <span key={kw} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Email found */}
      {lead.emailFound && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <Mail className="w-4 h-4" />
          <span className="font-medium">{lead.emailFound}</span>
          <span className="text-xs text-green-500">({lead.emailConfidence})</span>
        </div>
      )}

      {/* Notes */}
      {lead.notes && !showNotes && (
        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">{lead.notes}</p>
      )}

      {showNotes && (
        <div className="space-y-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this lead..."
            className="text-sm min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addNote.mutate({ id: lead.id, notes: noteText })}
              disabled={addNote.isPending}
            >
              Save Note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNotes(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Email Finder inline */}
      {showEmailFinder && (
        <div className="space-y-2 border rounded-lg p-3 bg-gray-50">
          <p className="text-xs font-medium text-gray-600">Find email via Apollo</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="text-sm h-8" />
            <Input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="text-sm h-8" />
          </div>
          <Input placeholder="Domain (e.g. company.com)" value={domain} onChange={(e) => setDomain(e.target.value)} className="text-sm h-8" />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => findEmail.mutate({ firstName, lastName, domain, prospectId: lead.id })}
              disabled={findEmail.isPending || !firstName || !lastName || !domain}
            >
              {findEmail.isPending ? "Looking up..." : "Find Email"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowEmailFinder(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
        {!isArchived && (
          <>
            {lead.status === "new" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => updateStatus.mutate({ id: lead.id, status: "engaged" })}
                disabled={updateStatus.isPending}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Mark Engaged
              </Button>
            )}
            {lead.status === "engaged" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => updateStatus.mutate({ id: lead.id, status: "converted" })}
                disabled={updateStatus.isPending}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Mark Converted
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => setShowNotes(!showNotes)}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Note
            </Button>
            {!lead.emailFound && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() => setShowEmailFinder(!showEmailFinder)}
              >
                <Mail className="w-3 h-3 mr-1" />
                Find Email
              </Button>
            )}
            {lead.emailFound && lead.status !== "converted" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-green-700 border-green-300 hover:bg-green-50"
                onClick={() =>
                  pushToKajabi.mutate({
                    leadId: lead.id,
                    email: lead.emailFound!,
                    name: lead.author ?? undefined,
                    tagName: "Lead Scrubber",
                  })
                }
                disabled={pushToKajabi.isPending}
              >
                <Send className="w-3 h-3 mr-1" />
                {pushToKajabi.isPending ? "Pushing..." : "Push to Kajabi"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-gray-400 hover:text-red-500"
              onClick={() => archiveLead.mutate({ id: lead.id })}
              disabled={archiveLead.isPending}
            >
              <Archive className="w-3 h-3 mr-1" />
              Archive
            </Button>
          </>
        )}
        {isArchived && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7"
            onClick={() => restoreLead.mutate({ id: lead.id })}
            disabled={restoreLead.isPending}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restore
          </Button>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          {new Date(lead.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel() {
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordCat, setNewKeywordCat] = useState("general");
  const [newSubreddit, setNewSubreddit] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newChannelName, setNewChannelName] = useState("");

  const utils = trpc.useUtils();

  const { data: keywords = [] } = trpc.leadScrubber.listKeywords.useQuery();
  const { data: subreddits = [] } = trpc.leadScrubber.listSubreddits.useQuery();
  const { data: channels = [] } = trpc.leadScrubber.listYtChannels.useQuery();

  const addKeyword = trpc.leadScrubber.addKeyword.useMutation({
    onSuccess: () => { utils.leadScrubber.listKeywords.invalidate(); setNewKeyword(""); toast.success("Keyword added"); },
    onError: () => toast.error("Keyword already exists"),
  });
  const toggleKeyword = trpc.leadScrubber.toggleKeyword.useMutation({
    onSuccess: () => utils.leadScrubber.listKeywords.invalidate(),
  });
  const deleteKeyword = trpc.leadScrubber.deleteKeyword.useMutation({
    onSuccess: () => utils.leadScrubber.listKeywords.invalidate(),
  });
  const addSubreddit = trpc.leadScrubber.addSubreddit.useMutation({
    onSuccess: () => { utils.leadScrubber.listSubreddits.invalidate(); setNewSubreddit(""); toast.success("Subreddit added"); },
    onError: () => toast.error("Subreddit already exists"),
  });
  const toggleSubreddit = trpc.leadScrubber.toggleSubreddit.useMutation({
    onSuccess: () => utils.leadScrubber.listSubreddits.invalidate(),
  });
  const addChannel = trpc.leadScrubber.addYtChannel.useMutation({
    onSuccess: () => { utils.leadScrubber.listYtChannels.invalidate(); setNewChannelId(""); setNewChannelName(""); toast.success("Channel added"); },
    onError: () => toast.error("Channel already exists"),
  });
  const toggleChannel = trpc.leadScrubber.toggleYtChannel.useMutation({
    onSuccess: () => utils.leadScrubber.listYtChannels.invalidate(),
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Keywords */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Intent Keywords</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. burnout"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => e.key === "Enter" && newKeyword && addKeyword.mutate({ keyword: newKeyword, category: newKeywordCat })}
          />
          <Button size="sm" className="h-8" onClick={() => newKeyword && addKeyword.mutate({ keyword: newKeyword, category: newKeywordCat })}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {keywords.map((kw) => (
            <div key={kw.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
              <span className={`flex-1 ${!kw.active ? "text-gray-400 line-through" : ""}`}>{kw.keyword}</span>
              <span className="text-xs text-gray-400 mr-2">{kw.category}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleKeyword.mutate({ id: kw.id, active: !kw.active })}
                  className={`text-xs px-1.5 py-0.5 rounded ${kw.active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                >
                  {kw.active ? "ON" : "OFF"}
                </button>
                <button onClick={() => deleteKeyword.mutate({ id: kw.id })} className="text-gray-300 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subreddits */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">Subreddits</h3>
        <div className="flex gap-2">
          <Input
            placeholder="e.g. meditation"
            value={newSubreddit}
            onChange={(e) => setNewSubreddit(e.target.value)}
            className="text-sm h-8"
            onKeyDown={(e) => e.key === "Enter" && newSubreddit && addSubreddit.mutate({ subreddit: newSubreddit })}
          />
          <Button size="sm" className="h-8" onClick={() => newSubreddit && addSubreddit.mutate({ subreddit: newSubreddit })}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {subreddits.map((sub) => (
            <div key={sub.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
              <span className={`flex-1 ${!sub.active ? "text-gray-400 line-through" : ""}`}>r/{sub.subreddit}</span>
              <button
                onClick={() => toggleSubreddit.mutate({ id: sub.id, active: !sub.active })}
                className={`text-xs px-1.5 py-0.5 rounded ${sub.active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
              >
                {sub.active ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* YouTube Channels */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm text-gray-700">YouTube Channels</h3>
        <div className="space-y-2">
          <Input
            placeholder="Channel ID (UC...)"
            value={newChannelId}
            onChange={(e) => setNewChannelId(e.target.value)}
            className="text-sm h-8"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Channel name"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              className="text-sm h-8"
            />
            <Button size="sm" className="h-8" onClick={() => newChannelId && newChannelName && addChannel.mutate({ channelId: newChannelId, channelName: newChannelName })}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {channels.map((ch) => (
            <div key={ch.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
              <span className={`flex-1 ${!ch.active ? "text-gray-400 line-through" : ""}`}>{ch.channelName}</span>
              <button
                onClick={() => toggleChannel.mutate({ id: ch.id, active: !ch.active })}
                className={`text-xs px-1.5 py-0.5 rounded ${ch.active ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
              >
                {ch.active ? "ON" : "OFF"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Email Finder Tab ─────────────────────────────────────────────────────────

function EmailFinderTab() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<{ email: string | null; confidence: string | null; message: string } | null>(null);

  const findEmail = trpc.leadScrubber.findEmail.useMutation({
    onSuccess: (data) => {
      setResult({ email: data.email, confidence: data.confidence, message: data.message ?? "" });
    },
    onError: () => toast.error("Email lookup failed"),
  });

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Apollo.io Email Finder (Tier 3)</p>
        <p>Enter a person's name and their company domain to look up a verified email address. Uses Apollo's free tier (900 credits/month). Add your <code className="bg-amber-100 px-1 rounded">APOLLO_API_KEY</code> in Secrets to activate.</p>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">First Name</label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Last Name</label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Company Domain</label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com" />
        </div>
        <Button
          className="w-full"
          onClick={() => findEmail.mutate({ firstName, lastName, domain })}
          disabled={findEmail.isPending || !firstName || !lastName || !domain}
        >
          {findEmail.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Looking up...</>
          ) : (
            <><Mail className="w-4 h-4 mr-2" /> Find Email</>
          )}
        </Button>
      </div>

      {result && (
        <div className={`border rounded-xl p-4 ${result.email ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
          {result.email ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-700">Email Found</p>
              <p className="text-lg font-mono text-green-800">{result.email}</p>
              <p className="text-xs text-green-600">Confidence: {result.confidence}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-600">{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Apollo Cold Lead Search Tab ────────────────────────────────────────────

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

// ─── Reusable Kajabi Push Button ─────────────────────────────────────────────

function KajabiPushButton({ email, name, leadId }: { email: string; name?: string; leadId?: number }) {
  const pushToKajabi = trpc.leadScrubber.pushToKajabi.useMutation({
    onSuccess: () => toast.success("Pushed to Kajabi!"),
    onError: (err) => toast.error(`Kajabi push failed: ${err.message}`),
  });

  return (
    <button
      onClick={() => pushToKajabi.mutate({ email, name, leadId, tagName: "Lead Scrubber" })}
      disabled={pushToKajabi.isPending || pushToKajabi.isSuccess}
      className={`text-xs font-medium px-2 py-1 rounded border transition-colors ${
        pushToKajabi.isSuccess
          ? "text-green-700 border-green-300 bg-green-50 cursor-default"
          : "text-green-700 border-green-300 hover:bg-green-50"
      }`}
    >
      <span className="flex items-center gap-1">
        <Send className="w-3 h-3" />
        {pushToKajabi.isPending ? "Pushing..." : pushToKajabi.isSuccess ? "In Kajabi ✓" : "Push to Kajabi"}
      </span>
    </button>
  );
}

const URBAN_MONK_PERSONAS = [
  { label: "Wellness Coaches", titles: ["wellness coach", "health coach", "life coach"] },
  { label: "Meditation Teachers", titles: ["meditation teacher", "mindfulness coach", "yoga instructor"] },
  { label: "Functional Medicine", titles: ["functional medicine doctor", "integrative medicine physician", "naturopathic doctor"] },
  { label: "Biohackers / Longevity", titles: ["biohacker", "longevity coach", "anti-aging specialist"] },
  { label: "Stress & Burnout", titles: ["burnout coach", "stress management coach", "executive wellness coach"] },
  { label: "Nutritionists", titles: ["nutritionist", "dietitian", "holistic nutritionist"] },
];

function ApolloSearchTab() {
  const [titles, setTitles] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("United States");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<ApolloPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const search = trpc.leadScrubber.apolloSearchLeads.useMutation({
    onSuccess: (data) => {
      setResults(data.people as ApolloPerson[]);
      setTotal(data.total);
      setMessage(data.message ?? "");
      if (!data.success && data.message) toast.error(data.message);
    },
    onError: () => toast.error("Apollo search failed"),
  });

  const togglePersona = (personaTitles: string[]) => {
    setTitles((prev) => {
      const allIn = personaTitles.every((t) => prev.includes(t));
      if (allIn) return prev.filter((t) => !personaTitles.includes(t));
      return Array.from(new Set([...prev, ...personaTitles]));
    });
  };

  const handleSearch = (p = 1) => {
    setPage(p);
    const kwArr = keywords.trim() ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined;
    search.mutate({
      titles: titles.length ? titles : undefined,
      keywords: kwArr,
      locations: location.trim() ? [location.trim()] : undefined,
      page: p,
      perPage: 10,
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Apollo.io Cold Lead Search (Tier 3b)</p>
        <p>Search Apollo's database of 275M+ contacts by job title, keywords, and location. Results are automatically saved to your lead queue. Uses your Apollo Basic plan credits.</p>
      </div>

      {/* Persona Quick-Select */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h3 className="font-semibold text-sm text-gray-700">Target Persona</h3>
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Quick-select Urban Monk audience personas:</p>
          <div className="flex flex-wrap gap-2">
            {URBAN_MONK_PERSONAS.map((p) => {
              const active = p.titles.every((t) => titles.includes(t));
              return (
                <button
                  key={p.label}
                  onClick={() => togglePersona(p.titles)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                    active
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-primary hover:text-primary"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom title */}
        <div className="flex gap-2">
          <Input
            placeholder="Add custom job title..."
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && customTitle.trim()) {
                setTitles((prev) => Array.from(new Set([...prev, customTitle.trim()])));
                setCustomTitle("");
              }
            }}
            className="text-sm h-8"
          />
          <Button
            size="sm" className="h-8"
            onClick={() => {
              if (customTitle.trim()) {
                setTitles((prev) => Array.from(new Set([...prev, customTitle.trim()])));
                setCustomTitle("");
              }
            }}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>

        {/* Selected titles */}
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

        {/* Filters */}
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

        <Button
          className="w-full"
          onClick={() => handleSearch(1)}
          disabled={search.isPending || (!titles.length && !keywords.trim())}
        >
          {search.isPending ? (
            <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Searching Apollo...</>
          ) : (
            <><Search className="w-4 h-4 mr-2" /> Search Cold Leads</>
          )}
        </Button>
      </div>

      {/* Results */}
      {message && (
        <p className="text-sm text-gray-500">{message} {total > 10 && `(showing page ${page})`}</p>
      )}

      {results.length > 0 && (
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
                  {savedIds.includes(person.id) && (
                    <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                  )}
                  {person.linkedinUrl && (
                    <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 text-gray-400 hover:text-primary" />
                    </a>
                  )}
                </div>
              </div>
              {person.email ? (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm font-mono text-green-700">{person.email}</span>
                  {person.emailStatus && <span className="text-xs text-gray-400">({person.emailStatus})</span>}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No email in Apollo database — use Email Finder tab to look up manually</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {!savedIds.includes(person.id) && (
                  <button
                    onClick={() => setSavedIds((prev) => [...prev, person.id])}
                    className="text-xs text-primary hover:underline"
                  >
                    ✓ Mark as saved to queue
                  </button>
                )}
                {person.email && (
                  <KajabiPushButton email={person.email} name={person.name} />
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={() => handleSearch(page - 1)} disabled={page <= 1 || search.isPending}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Previous
            </Button>
            <span className="text-xs text-gray-500">Page {page}</span>
            <Button variant="outline" size="sm" onClick={() => handleSearch(page + 1)} disabled={results.length < 10 || search.isPending}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leads List ───────────────────────────────────────────────────────────────

function LeadsList({ source }: { source: "reddit" | "youtube" | "all" }) {
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = trpc.leadScrubber.listLeads.useQuery({
    source,
    status: statusFilter === "archived" ? "archived" : "active",
    page,
    pageSize,
  });

  const leads = (data?.leads ?? []) as Lead[];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const scanReddit = trpc.leadScrubber.scanReddit.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
    },
    onError: () => toast.error("Reddit scan failed"),
  });

  const scanYouTube = trpc.leadScrubber.scanYouTube.useMutation({
    onSuccess: (res) => {
      toast.success(res.message);
      refetch();
    },
    onError: () => toast.error("YouTube scan failed"),
  });

  return (
    <div className="space-y-4">
      {/* Scan controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {(source === "reddit" || source === "all") && (
          <Button
            size="sm"
            onClick={() => scanReddit.mutate({ limit: 25 })}
            disabled={scanReddit.isPending}
          >
            {scanReddit.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning Reddit...</>
            ) : (
              <><Search className="w-4 h-4 mr-2" /> Scan Reddit Now</>
            )}
          </Button>
        )}
        {(source === "youtube" || source === "all") && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => scanYouTube.mutate()}
            disabled={scanYouTube.isPending}
          >
            {scanYouTube.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Scanning YouTube...</>
            ) : (
              <><Youtube className="w-4 h-4 mr-2" /> Scan YouTube Now</>
            )}
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => { setStatusFilter("active"); setPage(1); }}
            className={`text-sm px-3 py-1 rounded-full ${statusFilter === "active" ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Active ({statusFilter === "active" ? total : "?"})
          </button>
          <button
            onClick={() => { setStatusFilter("archived"); setPage(1); }}
            className={`text-sm px-3 py-1 rounded-full ${statusFilter === "archived" ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-600"}`}
          >
            Archived
          </button>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No leads yet. Click "Scan" to find intent signals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onRefresh={refetch} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadScrubber() {
  const [activeTab, setActiveTab] = useState<"reddit" | "youtube" | "apollo" | "email" | "config">("reddit");

  const { data: stats = [] } = trpc.leadScrubber.getStats.useQuery();

  const totalNew = stats
    .filter((s) => s.status === "new")
    .reduce((acc, s) => acc + Number(s.count), 0);

  const tabs = [
    { id: "reddit" as const, label: "Reddit Leads", icon: Search },
    { id: "youtube" as const, label: "YouTube Leads", icon: Youtube },
    { id: "apollo" as const, label: "Apollo Cold Leads", icon: Users },
    { id: "email" as const, label: "Email Finder", icon: Mail },
    { id: "config" as const, label: "Configure", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Scrubber</h1>
            <p className="text-sm text-gray-500 mt-1">
              Find cold leads expressing intent on Reddit and YouTube, then look up their email via Apollo.
            </p>
          </div>
          {totalNew > 0 && (
            <Badge className="bg-primary text-white text-sm px-3 py-1">
              {totalNew} new leads
            </Badge>
          )}
        </div>

        {/* Stats row */}
        {stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["new", "engaged", "email_found", "converted", "archived"] as const).map((status) => {
              const count = stats.filter((s) => s.status === status).reduce((acc, s) => acc + Number(s.count), 0);
              const labels: Record<string, string> = { new: "New", engaged: "Engaged", email_found: "Email Found", converted: "Converted", archived: "Archived" };
              return (
                <div key={status} className="bg-white border rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{count}</p>
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
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === "reddit" && <LeadsList source="reddit" />}
          {activeTab === "youtube" && <LeadsList source="youtube" />}
          {activeTab === "apollo" && <ApolloSearchTab />}
          {activeTab === "email" && <EmailFinderTab />}
          {activeTab === "config" && <ConfigPanel />}
        </div>
      </div>
    </div>
  );
}
