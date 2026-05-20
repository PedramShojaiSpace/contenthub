import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MessageSquare, Copy, Loader2, Clock, ChevronDown, ChevronUp, Zap, Target, Link2, ExternalLink, Tag, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "facebook", label: "Facebook" },
];

const GOALS = [
  { value: "lights_on", label: "Lights On Program" },
  { value: "upstream", label: "Upstream Program" },
  { value: "gateway_test", label: "Gateway to Health Test" },
  { value: "sleep_masterclass", label: "Restorative Sleep Masterclass" },
  { value: "lead_magnet", label: "Lead Magnet Download" },
  { value: "free_trial", label: "Free Trial / Demo" },
  { value: "consultation", label: "Book a Consultation" },
  { value: "product_purchase", label: "Product Purchase" },
];

interface DMMessage {
  delay: string;
  message: string;
  purpose: string;
  buttonText?: string | null;
  buttonUrl?: string | null;
  body?: string;
}

interface PlaybookResult {
  id: number;
  videoTopic: string;
  platform: string;
  conversionGoal: string;
  keywordTrigger: string;
  triggerKeyword: string;
  ctaLine: string;
  videoCTALine: string;
  dmSequence: DMMessage[];
  messages: Array<{ delay: string; body: string; subject: string; buttonText?: string | null; buttonUrl?: string | null }>;
  manychatSetupNotes: string;
  setupInstructions: string;
  expectedConversionRate: string;
  leadMagnetUrl?: string | null;
  createdAt: Date | string;
}

// ─── Source Tag Generator ────────────────────────────────────────────────────
// Generates a UTM-style attribution tag from keyword + platform + topic slug
// Format: organic_{platform}_{keyword}_{topicSlug}_{MMMYY}
function buildSourceTag(keyword: string, platform: string, topic: string): string {
  const now = new Date();
  const monthYear = now.toLocaleString("en-US", { month: "short", year: "2-digit" })
    .toLowerCase().replace(" ", "");
  const topicSlug = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join("_");
  return `organic_${platform}_${keyword.toLowerCase()}_${topicSlug}_${monthYear}`;
}

function buildTaggedUrl(baseUrl: string, sourceTag: string): string {
  if (!baseUrl) return "";
  try {
    const url = new URL(baseUrl);
    url.searchParams.set("utm_source", "organic_social");
    url.searchParams.set("utm_medium", "dm_automation");
    url.searchParams.set("utm_campaign", sourceTag);
    return url.toString();
  } catch {
    // If URL parsing fails, append as query string
    const sep = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${sep}utm_source=organic_social&utm_medium=dm_automation&utm_campaign=${encodeURIComponent(sourceTag)}`;
  }
}

function normalizeResult(raw: any): PlaybookResult {
  // Normalize both the old shape (dmSequence) and new shape (messages[])
  const msgs: DMMessage[] = raw.dmSequence ?? (raw.messages ?? []).map((m: any) => ({
    delay: m.delay ?? "Immediate",
    message: m.body ?? m.message ?? "",
    purpose: m.subject ?? m.purpose ?? "",
    buttonText: m.buttonText ?? null,
    buttonUrl: m.buttonUrl ?? null,
  }));
  return {
    ...raw,
    keywordTrigger: raw.keywordTrigger ?? raw.triggerKeyword ?? "",
    ctaLine: raw.ctaLine ?? raw.videoCTALine ?? "",
    dmSequence: msgs,
    manychatSetupNotes: raw.manychatSetupNotes ?? raw.setupInstructions ?? "",
  };
}

function MessageBubble({ msg, index, onCopy }: { msg: DMMessage; index: number; onCopy: (t: string) => void }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-violet-100 border border-violet-200 flex items-center justify-center shrink-0 mt-1">
        <span className="text-xs font-bold text-violet-700">{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs text-violet-600 border-violet-200">{msg.delay}</Badge>
          <span className="text-xs text-muted-foreground">{msg.purpose}</span>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-lg rounded-tl-none p-3 relative">
          <p className="text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
          {msg.buttonText && msg.buttonUrl && (
            <div className="mt-2 pt-2 border-t border-violet-200">
              <a
                href={msg.buttonUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-700 font-medium hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                {msg.buttonText}
              </a>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-5 w-5"
            onClick={() => onCopy(msg.message)}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DMPlaybook() {
  const [videoTopic, setVideoTopic] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [conversionGoal, setConversionGoal] = useState("academy_signup");
  const [offerDetails, setOfferDetails] = useState("");
  const [kajabiUrl, setKajabiUrl] = useState("");
  const [result, setResult] = useState<PlaybookResult | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [tagCopied, setTagCopied] = useState(false);
  const [taggedUrlCopied, setTaggedUrlCopied] = useState(false);

  const generateMutation = trpc.viralStudio.generateDMPlaybook.useMutation({
    onSuccess: (data) => {
      setResult(normalizeResult(data));
      toast.success("DM Playbook generated!");
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const historyQuery = trpc.viralStudio.getRecentPlaybooks.useQuery({ limit: 10 });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const handleCopyTag = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const handleCopyAll = () => {
    if (!result) return;
    const full = [
      `KEYWORD TRIGGER: ${result.keywordTrigger}`,
      `CTA LINE (add to video): "${result.ctaLine}"`,
      result.leadMagnetUrl ? `KAJABI OPT-IN URL: ${result.leadMagnetUrl}` : "",
      ``,
      `DM SEQUENCE:`,
      ...result.dmSequence.map((m, i) => `Message ${i + 1} (${m.delay}):\n${m.message}${m.buttonUrl ? `\n→ Button: ${m.buttonText} — ${m.buttonUrl}` : ""}`),
      ``,
      `SETUP NOTES:\n${result.manychatSetupNotes}`,
    ].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(full);
    toast.success("Full playbook copied!");
  };

  const handleGenerate = () => {
    const url = kajabiUrl.trim() || undefined;
    generateMutation.mutate({
      videoTopic: videoTopic.trim(),
      triggerKeyword: conversionGoal === "lights_on" ? "LIGHTSON" : conversionGoal === "upstream" ? "UPSTREAM" : conversionGoal === "gateway_test" ? "TEST" : conversionGoal === "sleep_masterclass" ? "SLEEP" : "LEARN",
      leadMagnet: offerDetails.trim() || "Lights On — Dr. Pedram Shojai's energy & vitality program at lightson.theurbanmonk.com",
      leadMagnetUrl: url,
      platform: platform as "instagram",
    });
  };

  // Build wizard URL params from current result
  const wizardParams = result
    ? `?keyword=${encodeURIComponent(result.keywordTrigger)}&platform=${encodeURIComponent(result.platform ?? platform)}&url=${encodeURIComponent(result.leadMagnetUrl ?? kajabiUrl ?? "")}&topic=${encodeURIComponent(result.videoTopic ?? videoTopic)}`
    : "";

  return (
    <div className="p-6 space-y-6">
      {/* Explainer */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <h3 className="font-semibold text-violet-900 mb-1 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          DM Automation Playbook Generator
        </h3>
        <p className="text-sm text-violet-700">
          Generate a complete ManyChat-ready DM automation playbook for any video: keyword trigger, CTA line to say in the video, and a 3-message DM sequence that converts viewers into Academy members. Paste your Kajabi opt-in URL so Message 1 delivers the right link automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-500" />
              Playbook Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Video Topic *</Label>
              <Input
                placeholder="e.g. The one gut health habit that changes everything"
                value={videoTopic}
                onChange={(e) => setVideoTopic(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Conversion Goal</Label>
              <Select value={conversionGoal} onValueChange={setConversionGoal}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GOALS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kajabi URL — the key new field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-orange-500" />
                Kajabi Opt-in URL
                <span className="text-muted-foreground font-normal">(Message 1 delivery link)</span>
              </Label>
              <Input
                type="url"
                placeholder="https://app.kajabi.com/your-optin-page"
                value={kajabiUrl}
                onChange={(e) => setKajabiUrl(e.target.value)}
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Paste the Kajabi landing page URL where viewers opt in. This becomes the button link in Message 1.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Offer Details <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Lights On — Dr. Pedram Shojai's energy & vitality system at lightson.theurbanmonk.com"
                value={offerDetails}
                onChange={(e) => setOfferDetails(e.target.value)}
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !videoTopic.trim()}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating playbook...</>
              ) : (
                <><MessageSquare className="w-4 h-4 mr-2" />Generate DM Playbook</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Keyword Trigger */}
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Keyword Trigger</p>
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-green-700" onClick={() => handleCopy(result.keywordTrigger)}>
                    <Copy className="w-3 h-3 mr-1" />Copy
                  </Button>
                </div>
                <div className="bg-white border border-green-200 rounded-lg px-4 py-3 text-center">
                  <span className="text-2xl font-bold text-green-700 tracking-wide">{result.keywordTrigger}</span>
                </div>
                <p className="text-xs text-green-600 mt-2">Set this as the ManyChat keyword trigger. Tell viewers to comment this word.</p>
              </div>

              {/* Source Tag Generator */}
              {(result.leadMagnetUrl || kajabiUrl) && (() => {
                const baseUrl = result.leadMagnetUrl ?? kajabiUrl;
                const sourceTag = buildSourceTag(
                  result.keywordTrigger,
                  result.platform ?? platform,
                  result.videoTopic ?? videoTopic
                );
                const taggedUrl = buildTaggedUrl(baseUrl, sourceTag);
                return (
                  <div className="space-y-2">
                    {/* Raw Kajabi URL */}
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          Kajabi Opt-in URL (base)
                        </p>
                        <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-orange-700"
                          onClick={() => handleCopy(baseUrl)}>
                          <Copy className="w-3 h-3 mr-1" />Copy
                        </Button>
                      </div>
                      <p className="text-xs font-mono text-foreground break-all">{baseUrl}</p>
                    </div>

                    {/* Source Attribution Tag */}
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Tag className="w-3 h-3" />
                          Attribution Source Tag
                        </p>
                        <Button
                          variant="ghost" size="sm"
                          className={`h-5 text-xs px-1.5 transition-colors ${tagCopied ? "text-green-600" : "text-teal-700"}`}
                          onClick={() => handleCopyTag(sourceTag, setTagCopied)}
                        >
                          {tagCopied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {tagCopied ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                      <div className="bg-white border border-teal-200 rounded-lg px-3 py-2">
                        <code className="text-xs text-teal-800 font-mono break-all">{sourceTag}</code>
                      </div>
                      <p className="text-xs text-teal-600 mt-1.5">
                        This tag is auto-generated from your keyword, platform, topic, and month. Paste it as <code className="bg-teal-100 px-1 rounded">utm_campaign</code> in your Kajabi URL or CRM.
                      </p>
                    </div>

                    {/* Tagged URL (ready to paste into ManyChat) */}
                    <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5">
                          <Tag className="w-3 h-3" />
                          Tagged URL — Paste into ManyChat Message 1
                        </p>
                        <Button
                          variant="ghost" size="sm"
                          className={`h-5 text-xs px-1.5 transition-colors ${taggedUrlCopied ? "text-green-600" : "text-violet-700"}`}
                          onClick={() => handleCopyTag(taggedUrl, setTaggedUrlCopied)}
                        >
                          {taggedUrlCopied ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {taggedUrlCopied ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                      <div className="bg-white border border-violet-200 rounded-lg px-3 py-2">
                        <code className="text-xs text-violet-800 font-mono break-all">{taggedUrl}</code>
                      </div>
                      <p className="text-xs text-violet-600 mt-1.5">
                        Use this URL in ManyChat Message 1 instead of the plain Kajabi URL. Every lead that enters through this playbook will be tagged in your CRM — clean attribution, no guesswork.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* CTA Line */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Say This in Your Video
                  </p>
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1.5 text-amber-700" onClick={() => handleCopy(result.ctaLine)}>
                    <Copy className="w-3 h-3 mr-1" />Copy
                  </Button>
                </div>
                <p className="text-sm font-medium text-foreground italic">"{result.ctaLine}"</p>
              </div>

              {/* DM Sequence */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-500" />
                    DM Sequence ({result.dmSequence.length} messages)
                  </p>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopyAll}>
                    <Copy className="w-3 h-3 mr-1" />Copy Full Playbook
                  </Button>
                </div>
                <div className="space-y-4">
                  {result.dmSequence.map((msg, i) => (
                    <MessageBubble key={i} msg={msg} index={i} onCopy={handleCopy} />
                  ))}
                </div>
              </div>

              {/* Setup Notes */}
              {result.manychatSetupNotes && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 mb-2">ManyChat Setup Notes</p>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{result.manychatSetupNotes}</p>
                </div>
              )}

              {/* Expected Conversion */}
              {result.expectedConversionRate && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                    <Target className="w-4 h-4 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">Expected Conversion Rate</p>
                    <p className="text-sm font-medium">{result.expectedConversionRate}</p>
                  </div>
                </div>
              )}

              {/* ManyChat Wizard CTA */}
              <div className="p-4 bg-gradient-to-r from-violet-600 to-purple-600 rounded-xl text-white">
                <p className="text-sm font-semibold mb-1">Ready to wire this in ManyChat?</p>
                <p className="text-xs text-violet-200 mb-3">
                  The Setup Wizard gives your VA a step-by-step checklist to configure the keyword trigger, delays, and message blocks — no guesswork.
                </p>
                <Link href={`/manychat-wizard${wizardParams}`}>
                  <Button size="sm" className="bg-white text-violet-700 hover:bg-violet-50 font-semibold">
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Open ManyChat Setup Wizard
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-xl text-center p-6">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Enter a video topic and your Kajabi opt-in URL to generate a complete DM automation playbook</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {historyQuery.data && historyQuery.data.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <button
              className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
              onClick={() => setHistoryOpen(!historyOpen)}
            >
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Playbooks ({historyQuery.data.length})
              {historyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {historyOpen && (
              <div className="space-y-2">
                {historyQuery.data.map((r: any) => (
                  <div
                    key={r.id}
                    className="border border-border rounded-lg p-3 hover:border-violet-300 cursor-pointer transition-colors"
                    onClick={() => setResult(normalizeResult(r))}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs capitalize">{r.platform}</Badge>
                      <Badge variant="outline" className="text-xs text-green-600 border-green-200">{r.triggerKeyword}</Badge>
                      {r.leadMagnetUrl && (
                        <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                          <Link2 className="w-2.5 h-2.5 mr-1" />Kajabi URL
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{r.videoTopic}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(r.createdAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
