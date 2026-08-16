/**
 * ManyChat Setup Wizard
 * Gives the VA a step-by-step checklist to configure the keyword trigger,
 * message sequence, and Kajabi opt-in link in ManyChat — no guesswork.
 *
 * Accepts URL params from the DM Playbook:
 *   ?keyword=MONK&platform=instagram&url=https://...&topic=...
 * Or the VA can fill in the fields manually.
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, Copy, ExternalLink, Zap, MessageSquare,
  Link2, Settings, ChevronDown, ChevronUp, AlertCircle, ArrowLeft
} from "lucide-react";
import { getHubPublicHref } from "@/lib/hubRouteResolver";

// ── Types ──────────────────────────────────────────────────────────────────────

interface WizardStep {
  id: string;
  phase: string;
  title: string;
  detail: string;
  action?: { label: string; url?: string; copy?: string };
  warning?: string;
  screenshot?: string; // future: path to annotated screenshot
}

// ── Step generator ─────────────────────────────────────────────────────────────

function buildSteps(keyword: string, platform: string, kajabiUrl: string, topic: string): WizardStep[] {
  const kw = keyword.toUpperCase() || "MONK";
  const platformLabel = platform.charAt(0).toUpperCase() + platform.slice(1);
  const url = kajabiUrl || "YOUR_KAJABI_URL";
  const topicLabel = topic || "your video topic";

  return [
    // ── Phase 1: Account Setup ────────────────────────────────────────────────
    {
      id: "login",
      phase: "1. Account Setup",
      title: "Log in to ManyChat",
      detail: `Go to app.manychat.com and sign in. Make sure you are in the correct ${platformLabel} account for Dr. Pedram Shojai / The Urban Monk.`,
      action: { label: "Open ManyChat", url: "https://app.manychat.com" },
    },
    {
      id: "connect_page",
      phase: "1. Account Setup",
      title: `Confirm ${platformLabel} page is connected`,
      detail: `In ManyChat, go to Settings → Channels and verify that the ${platformLabel} account is connected and active. If it shows "Disconnected", click Reconnect and follow the prompts.`,
      action: { label: "Go to Settings → Channels", url: "https://app.manychat.com/settings/channels" },
      warning: platform === "instagram"
        ? "Instagram requires a Business or Creator account connected to a Facebook Page. Personal accounts will not work."
        : platform === "tiktok"
        ? "TikTok DM automation requires a TikTok Business account. Verify this before proceeding."
        : undefined,
    },

    // ── Phase 2: Create the Automation ────────────────────────────────────────
    {
      id: "new_flow",
      phase: "2. Create the Automation",
      title: "Create a new Flow",
      detail: `In ManyChat, click "New Flow" (or "Automation → New Automation"). Name it exactly: "${topicLabel} — ${kw} Keyword". This name will help you find it later.`,
      action: { label: "Go to Automation", url: "https://app.manychat.com/automation" },
    },
    {
      id: "keyword_trigger",
      phase: "2. Create the Automation",
      title: `Set the keyword trigger to "${kw}"`,
      detail: `In the Flow editor, click "Add Trigger" → select "Comment/Story Reply" (for ${platformLabel}). Under "Keywords", type exactly: ${kw}\n\nSet the match type to "Is" (exact match). This fires the DM only when someone comments the exact word ${kw}.`,
      action: { label: "Copy keyword", copy: kw },
      warning: `Use EXACT MATCH, not "Contains". "Contains" will fire on any comment that includes the letters — which causes spam complaints.`,
    },
    {
      id: "message_1",
      phase: "2. Create the Automation",
      title: "Add Message 1 — Immediate delivery (0 second delay)",
      detail: `Add the first message block. Set delay to "Send immediately" (0 seconds).\n\nPaste the Message 1 copy from the DM Playbook. Then add a Button below the text:\n  • Button label: "Get Access Now"\n  • Button type: "URL"\n  • URL: ${url}\n\nThis is the Kajabi opt-in link. When the viewer taps the button, they land on your Kajabi page.`,
      action: { label: "Copy Kajabi URL", copy: url },
      warning: url === "YOUR_KAJABI_URL"
        ? "You have not entered a Kajabi URL. Go back to the DM Playbook, paste your Kajabi opt-in URL, and regenerate — or enter it in the field at the top of this wizard."
        : undefined,
    },
    {
      id: "message_2",
      phase: "2. Create the Automation",
      title: "Add Message 2 — Value follow-up (24 hour delay)",
      detail: `Click the "+" after Message 1 to add a new step. Set the delay to "24 hours".\n\nPaste the Message 2 copy from the DM Playbook. No button needed for this message — it is a pure value add that warms the relationship before the soft pitch.`,
    },
    {
      id: "message_3",
      phase: "2. Create the Automation",
      title: "Add Message 3 — Soft offer (48 hour delay)",
      detail: `Add another step after Message 2. Set the delay to "24 hours" (this fires 24 hours after Message 2, which is 48 hours after the trigger).\n\nPaste the Message 3 copy from the DM Playbook. Add a Button:\n  • Button label: "Join the Academy"\n  • Button type: "URL"\n  • URL: ${url}\n\nThis is the conversion message. The viewer has had two touchpoints and is now ready for the offer.`,
      action: { label: "Copy Kajabi URL", copy: url },
    },

    // ── Phase 3: Test the Flow ─────────────────────────────────────────────────
    {
      id: "test_flow",
      phase: "3. Test Before Publishing",
      title: "Use ManyChat's built-in Test feature",
      detail: `Before publishing, click the "Test Flow" button (top right of the Flow editor). ManyChat will send the sequence to your own ${platformLabel} account so you can verify:\n  ✓ Message 1 arrives immediately with the correct Kajabi URL button\n  ✓ Message 2 is queued for 24 hours\n  ✓ Message 3 is queued for 48 hours\n  ✓ The {{first_name}} placeholder resolves to your name`,
      warning: "Do NOT skip testing. A broken link in Message 1 means zero opt-ins from the automation.",
    },
    {
      id: "check_optin_url",
      phase: "3. Test Before Publishing",
      title: "Verify the Kajabi opt-in URL works",
      detail: `Open the Kajabi URL in a private/incognito browser window and confirm:\n  ✓ The page loads correctly\n  ✓ The opt-in form is visible\n  ✓ Submitting the form adds the contact to Kajabi (check your Kajabi contacts list)\n\nIf the page is not live yet, do not publish the ManyChat flow until it is.`,
      action: url !== "YOUR_KAJABI_URL" ? { label: "Open Kajabi URL", url } : undefined,
    },

    // ── Phase 4: Publish ──────────────────────────────────────────────────────
    {
      id: "publish",
      phase: "4. Publish",
      title: "Publish the Flow",
      detail: `Once testing passes, click "Publish" in the top-right corner of the Flow editor. The flow status should change from "Draft" to "Active".\n\nManyChat will now automatically send the DM sequence to anyone who comments "${kw}" on any ${platformLabel} post or reel.`,
    },
    {
      id: "post_video",
      phase: "4. Publish",
      title: `Post the video and say "${kw}" in the caption`,
      detail: `After publishing the flow, post the video for "${topicLabel}".\n\nIn the video caption, add: "Comment ${kw} below and I'll send it to you!"\n\nThis is the CTA that drives comments → triggers ManyChat → delivers the Kajabi opt-in link.`,
      action: { label: `Copy caption CTA`, copy: `Comment ${kw} below and I'll send it to you!` },
    },

    // ── Phase 5: Monitor ──────────────────────────────────────────────────────
    {
      id: "monitor",
      phase: "5. Monitor Results",
      title: "Check ManyChat Analytics after 24 hours",
      detail: `In ManyChat, go to Automation → your flow → Analytics. Check:\n  • Triggered: how many people commented the keyword\n  • Delivered: how many received Message 1\n  • Clicked: how many tapped the Kajabi button\n  • Opt-in rate: check Kajabi for new contacts added\n\nIf Triggered > 0 but Clicked = 0, the button URL may be broken — go back and fix it.`,
      action: { label: "Go to ManyChat Analytics", url: "https://app.manychat.com/automation" },
    },
    {
      id: "utm_tracking",
      phase: "5. Monitor Results",
      title: "Add UTM parameters to the Kajabi URL for tracking",
      detail: `For precise tracking in Google Analytics / Kajabi, append UTM parameters to the Kajabi URL in ManyChat:\n\n${url}?utm_source=${platform}&utm_medium=manychat_dm&utm_campaign=${kw.toLowerCase()}&utm_content=message1\n\nThis lets you see in Kajabi and GA4 exactly how many opt-ins came from this specific keyword automation.`,
      action: {
        label: "Copy UTM URL",
        copy: `${url !== "YOUR_KAJABI_URL" ? url : "YOUR_KAJABI_URL"}?utm_source=${platform}&utm_medium=manychat_dm&utm_campaign=${kw.toLowerCase()}&utm_content=message1`,
      },
    },
  ];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ManyChatWizard() {
  const [location] = useLocation();

  // Parse URL params passed from DM Playbook
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const [keyword, setKeyword] = useState(params.get("keyword") ?? "");
  const [platform, setPlatform] = useState(params.get("platform") ?? "instagram");
  const [kajabiUrl, setKajabiUrl] = useState(params.get("url") ?? "");
  const [topic, setTopic] = useState(params.get("topic") ?? "");
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(["1. Account Setup", "2. Create the Automation"]));
  const [configOpen, setConfigOpen] = useState(!params.get("keyword"));

  const steps = buildSteps(keyword, platform, kajabiUrl, topic);

  // Group steps by phase
  const phases = Array.from(new Set(steps.map((s) => s.phase)));

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase);
      else next.add(phase);
      return next;
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const totalSteps = steps.length;
  const doneSteps = completedSteps.size;
  const pct = Math.round((doneSteps / totalSteps) * 100);

  const phaseSteps = (phase: string) => steps.filter((s) => s.phase === phase);
  const phaseDone = (phase: string) => phaseSteps(phase).every((s) => completedSteps.has(s.id));

  return (
    <DashboardLayout>
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href={getHubPublicHref("/viral-studio")}>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </a>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-500" />
              ManyChat Setup Wizard
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Step-by-step VA guide to wire the keyword trigger and DM sequence in ManyChat.
          </p>
        </div>
        {/* Progress */}
        <div className="shrink-0 text-right">
          <div className="text-2xl font-bold text-violet-600">{pct}%</div>
          <div className="text-xs text-muted-foreground">{doneSteps}/{totalSteps} steps</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div
          className="bg-violet-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Config panel */}
      <Card className="border-violet-200">
        <CardHeader
          className="pb-2 cursor-pointer"
          onClick={() => setConfigOpen(!configOpen)}
        >
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-500" />
              Playbook Settings
              {keyword && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-200 ml-1">{keyword}</Badge>
              )}
              {kajabiUrl && (
                <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                  <Link2 className="w-2.5 h-2.5 mr-1" />URL set
                </Badge>
              )}
            </span>
            {configOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </CardTitle>
        </CardHeader>
        {configOpen && (
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground">
              These values are pre-filled from the DM Playbook. Edit them here if needed — the wizard steps update automatically.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Keyword Trigger</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                  placeholder="MONK"
                  className="text-sm font-mono uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Platform</Label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="w-3 h-3 text-orange-500" />
                  Kajabi Opt-in URL
                </Label>
                <Input
                  type="url"
                  value={kajabiUrl}
                  onChange={(e) => setKajabiUrl(e.target.value)}
                  placeholder="https://app.kajabi.com/your-optin-page"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Video Topic</Label>
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. The one gut health habit that changes everything"
                  className="text-sm"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Missing URL warning */}
      {!kajabiUrl && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            <strong>Kajabi URL not set.</strong> Go back to the DM Playbook, paste your Kajabi opt-in URL, and click "Open ManyChat Setup Wizard" — or enter it in the Playbook Settings above. The wizard will update automatically.
          </p>
        </div>
      )}

      {/* Steps by phase */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const isExpanded = expandedPhases.has(phase);
          const isDone = phaseDone(phase);
          const pSteps = phaseSteps(phase);
          const pDone = pSteps.filter((s) => completedSteps.has(s.id)).length;

          return (
            <div key={phase} className="border border-border rounded-xl overflow-hidden">
              {/* Phase header */}
              <button
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isDone ? "bg-green-50" : "bg-muted/30 hover:bg-muted/50"}`}
                onClick={() => togglePhase(phase)}
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm font-semibold ${isDone ? "text-green-700" : "text-foreground"}`}>{phase}</span>
                  <Badge variant="outline" className="text-xs">{pDone}/{pSteps.length}</Badge>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Phase steps */}
              {isExpanded && (
                <div className="divide-y divide-border">
                  {pSteps.map((step, idx) => {
                    const done = completedSteps.has(step.id);
                    return (
                      <div
                        key={step.id}
                        className={`px-4 py-4 transition-colors ${done ? "bg-green-50/50" : "bg-background"}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Checkbox */}
                          <button
                            onClick={() => toggleStep(step.id)}
                            className="mt-0.5 shrink-0"
                            aria-label={done ? "Mark incomplete" : "Mark complete"}
                          >
                            {done ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground hover:text-violet-500 transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-muted-foreground">Step {idx + 1}</span>
                              {done && <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Done</Badge>}
                            </div>
                            <p className={`text-sm font-semibold mb-1.5 ${done ? "line-through text-muted-foreground" : ""}`}>
                              {step.title}
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                              {step.detail}
                            </p>

                            {/* Warning */}
                            {step.warning && (
                              <div className="mt-2 flex items-start gap-1.5 p-2 bg-amber-50 border border-amber-200 rounded-md">
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800">{step.warning}</p>
                              </div>
                            )}

                            {/* Action button */}
                            {step.action && (
                              <div className="mt-2">
                                {step.action.url ? (
                                  <a href={step.action.url} target="_blank" rel="noopener noreferrer">
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                                      <ExternalLink className="w-3 h-3" />
                                      {step.action.label}
                                    </Button>
                                  </a>
                                ) : step.action.copy ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1.5"
                                    onClick={() => handleCopy(step.action!.copy!)}
                                  >
                                    <Copy className="w-3 h-3" />
                                    {step.action.label}
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion banner */}
      {pct === 100 && (
        <div className="p-4 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl text-white text-center">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
          <p className="font-bold text-lg">ManyChat is live!</p>
          <p className="text-sm text-green-100 mt-1">
            The keyword trigger is active. Every comment of "{keyword || "MONK"}" will now automatically deliver the Kajabi opt-in link via DM.
          </p>
        </div>
      )}

      {/* Back to DM Playbook */}
      <div className="text-center pt-2">
        <a href={getHubPublicHref("/viral-studio")}>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to Viral Studio
          </Button>
        </a>
      </div>
    </div>
    </DashboardLayout>
  );
}
