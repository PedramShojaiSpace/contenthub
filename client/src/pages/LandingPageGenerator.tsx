/**
 * Landing Page Generator
 *
 * Flow:
 *   1. Pick avatar (persona) — 8 Urban Monk personas
 *   2. Pick offer — Upstream, Lights On, Gateway to Health Test, Sleep Masterclass, Supplements, Free Guide, Custom
 *   3. Enter content angle / key message
 *   4. Click "Generate Copy" → LLM writes full landing page copy (preview shown)
 *   5. Edit copy if needed
 *   6. Click "Publish to Gamma" → sends to Gamma API (MANUAL TRIGGER ONLY)
 *   7. Poll for completion → show Gamma URL
 *
 * Gamma publish is NEVER automatic — always requires explicit button press.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertCircle,
  ArrowLeft,
  BarChart2,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Columns2,
  Copy,
  ExternalLink,
  Eye,
  FlaskConical,
  Globe,
  Heart,
  Link,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
  Video,
  Zap,
  GitFork,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";


// ─── Persona data ─────────────────────────────────────────────────────────────

type PersonaKey =
  | "Burnout Recovery Seeker"
  | "Midlife Vitality Optimizer"
  | "Spiritual Growth Explorer"
  | "Stressed Parent Multitasker"
  | "Holistic Health Student"
  | "Chronic Condition Navigator"
  | "Corporate Wellness Advocate"
  | "Digital Detox Pursuer";

const PERSONAS: {
  name: PersonaKey;
  icon: React.ReactNode;
  color: string;
  tagline: string;
  painPoints: string[];
  aspirations: string[];
  bestOffer: string;
  contentHooks: string[];
}[] = [
  {
    name: "Burnout Recovery Seeker",
    icon: <Zap className="h-5 w-5" />,
    color: "border-orange-300 bg-orange-50 hover:bg-orange-100",
    tagline: "Exhausted high-achiever seeking sustainable energy",
    painPoints: [
      "Chronic exhaustion despite rest",
      "Adrenal fatigue & cortisol dysregulation",
      "Disconnected from purpose",
      "Can't sustain energy past noon",
    ],
    aspirations: [
      "Sustainable energy without stimulants",
      "Reconnect with purpose and vitality",
      "Heal the nervous system naturally",
    ],
    bestOffer: "lights_on_webinar",
    contentHooks: [
      "The 5-minute morning ritual that resets your adrenals",
      "Why rest alone won't fix burnout (and what will)",
      "The hidden energy leak draining high achievers",
      "Qi Gong for burnout: ancient medicine meets modern stress",
    ],
  },
  {
    name: "Midlife Vitality Optimizer",
    icon: <TrendingUp className="h-5 w-5" />,
    color: "border-green-300 bg-green-50 hover:bg-green-100",
    tagline: "40-55 professional optimizing health for longevity",
    painPoints: [
      "Declining energy & hormonal changes",
      "Weight gain despite healthy habits",
      "Brain fog & memory concerns",
      "Fear of aging without vitality",
    ],
    aspirations: [
      "Optimize hormones naturally",
      "Reverse biological aging",
      "Maintain peak performance into 60s",
    ],
    bestOffer: "upstream_bundle",
    contentHooks: [
      "The biohacker's guide to thriving at 50",
      "5 longevity habits Pedram practices daily",
      "Why your hormones are the key to sustained energy",
      "Ancient Chinese medicine's secret to aging backwards",
    ],
  },
  {
    name: "Spiritual Growth Explorer",
    icon: <Star className="h-5 w-5" />,
    color: "border-purple-300 bg-purple-50 hover:bg-purple-100",
    tagline: "Seeker integrating ancient wisdom into modern life",
    painPoints: [
      "Spiritual practice feels hollow",
      "Meditation isn't 'working'",
      "Seeking deeper meaning beyond material success",
      "Wanting community of like-minded seekers",
    ],
    aspirations: [
      "Deepen meditation and Qi Gong practice",
      "Find authentic spiritual community",
      "Integrate wisdom into daily life",
    ],
    bestOffer: "upstream_course",
    contentHooks: [
      "The Urban Monk path: ancient wisdom for modern chaos",
      "Why your meditation isn't working (and the fix)",
      "Qi Gong: the practice that changed everything for me",
      "Finding stillness in the noise of modern life",
    ],
  },
  {
    name: "Stressed Parent Multitasker",
    icon: <Heart className="h-5 w-5" />,
    color: "border-pink-300 bg-pink-50 hover:bg-pink-100",
    tagline: "Overwhelmed parent running on empty",
    painPoints: [
      "Zero time for self-care",
      "Running on caffeine and adrenaline",
      "Guilt about not being present",
      "Health declining due to neglect",
    ],
    aspirations: [
      "5-minute practices that actually work",
      "More patience and presence with family",
      "Sustainable energy without burnout",
    ],
    bestOffer: "deep_sleep_webinar",
    contentHooks: [
      "The 5-minute morning ritual busy parents swear by",
      "How to meditate when you have zero time",
      "The stress response hack every parent needs",
      "Raising healthy kids starts with a healthy you",
    ],
  },
  {
    name: "Holistic Health Student",
    icon: <BookOpen className="h-5 w-5" />,
    color: "border-blue-300 bg-blue-50 hover:bg-blue-100",
    tagline: "Curious learner seeking credible holistic knowledge",
    painPoints: [
      "Information overload from conflicting advice",
      "Wants science-backed holistic knowledge",
      "Seeking a trusted teacher/mentor",
      "Wants to understand the 'why'",
    ],
    aspirations: [
      "Master TCM and integrative medicine",
      "Find a credible teacher to follow",
      "Build a complete wellness framework",
    ],
    bestOffer: "upstream_course",
    contentHooks: [
      "The science behind Qi Gong (it's not what you think)",
      "TCM explained: what 3,000 years of medicine knows",
      "Why I became an OMD instead of an MD",
      "The 5 elements framework that explains everything",
    ],
  },
  {
    name: "Chronic Condition Navigator",
    icon: <Brain className="h-5 w-5" />,
    color: "border-red-300 bg-red-50 hover:bg-red-100",
    tagline: "Frustrated patient seeking root-cause healing",
    painPoints: [
      "Conventional medicine isn't solving the problem",
      "Frustrated with symptom management",
      "Autoimmune, gut, or inflammatory conditions",
      "Seeking integrative approaches",
    ],
    aspirations: [
      "Find root-cause healing",
      "Reduce inflammation naturally",
      "Understand the mind-body connection",
    ],
    bestOffer: "interconnected_screening",
    contentHooks: [
      "What Western medicine misses about chronic illness",
      "The gut-brain-spirit connection explained",
      "How I've helped thousands find root-cause healing",
      "The inflammation protocol from ancient Chinese medicine",
    ],
  },
  {
    name: "Corporate Wellness Advocate",
    icon: <BarChart2 className="h-5 w-5" />,
    color: "border-sky-300 bg-sky-50 hover:bg-sky-100",
    tagline: "High-performing executive optimizing for longevity",
    painPoints: [
      "High-performing but burning out",
      "Leadership stress & decision fatigue",
      "Wants productivity without sacrificing health",
      "Seeking ROI-framed wellness solutions",
    ],
    aspirations: [
      "Peak cognitive performance",
      "Build resilience as a leader",
      "Competitive edge through wellness",
    ],
    bestOffer: "explorer_tier",
    contentHooks: [
      "The morning routine of high-performing executives",
      "How mindfulness became my competitive advantage",
      "The Lights On framework for peak executive performance",
      "Why the best CEOs prioritize stillness",
    ],
  },
  {
    name: "Digital Detox Pursuer",
    icon: <MessageCircle className="h-5 w-5" />,
    color: "border-teal-300 bg-teal-50 hover:bg-teal-100",
    tagline: "Screen-addicted professional reclaiming attention",
    painPoints: [
      "Screen addiction & dopamine dysregulation",
      "Anxiety from constant connectivity",
      "Wanting to reclaim attention & focus",
      "Feeling enslaved by technology",
    ],
    aspirations: [
      "Break free from phone addiction",
      "Reclaim deep focus and presence",
      "Live intentionally with technology",
    ],
    bestOffer: "lights_on_webinar",
    contentHooks: [
      "I deleted social media for 30 days — here's what happened",
      "The attention economy is stealing your life force",
      "How to reclaim your mind from the algorithm",
      "The Urban Monk's guide to conscious technology use",
    ],
  },
];

// ─── Offer data ───────────────────────────────────────────────────────────────

const OFFERS = [
  {
    id: "upstream_bundle",
    label: "Upstream Course + KBMO FIT22",
    price: "$399",
    url: "https://upstream.theurbanmonk.com/",
    icon: <FlaskConical className="h-5 w-5" />,
    description: "Upstream Course + KBMO FIT22 food sensitivity test — the complete diagnostic path to root cause health",
    color: "border-amber-300 bg-amber-50 hover:bg-amber-100",
  },
  {
    id: "upstream_course",
    label: "The Upstream Course",
    price: "$299",
    url: "https://upstream.theurbanmonk.com/",
    icon: <BookOpen className="h-5 w-5" />,
    description: "10-part docu-series + bonuses — the DIY path to upstream health. $299.",
    color: "border-green-300 bg-green-50 hover:bg-green-100",
  },
  {
    id: "explorer_tier",
    label: "The Explorer Tier",
    price: "Tier",
    url: "https://go.theurbanmonk.com/explore-tier",
    icon: <Zap className="h-5 w-5" />,
    description: "KBMO FIT 176 + GI Map + oral biome testing — full diagnostic picture",
    color: "border-blue-300 bg-blue-50 hover:bg-blue-100",
  },
  {
    id: "lights_on_webinar",
    label: "Lights On Course",
    price: "Free",
    url: "https://lightson.theurbanmonk.com/",
    icon: <Star className="h-5 w-5" />,
    description: "Free webinar — 'Something Has Been Stolen From You' — energy & vitality",
    color: "border-yellow-300 bg-yellow-50 hover:bg-yellow-100",
  },
  {
    id: "deep_sleep_webinar",
    label: "Deep Sleep Solution Webinar",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/dss-webinar-kajabi",
    icon: <Heart className="h-5 w-5" />,
    description: "Free webinar — science-backed sleep restoration protocol",
    color: "border-indigo-300 bg-indigo-50 hover:bg-indigo-100",
  },
  {
    id: "homesick_screening",
    label: "Homesick Home Free Screening",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/SqueezePage",
    icon: <Users className="h-5 w-5" />,
    description: "Free documentary screening — the environmental toxin conversation",
    color: "border-teal-300 bg-teal-50 hover:bg-teal-100",
  },
  {
    id: "interconnected_screening",
    label: "Interconnected Series Re-Screening",
    price: "Free",
    url: "https://theacademy.theurbanmonk.com/ic-interconnected-free-screening-Meta",
    icon: <Globe className="h-5 w-5" />,
    description: "Free docu-series — the gut-brain-immune connection story",
    color: "border-purple-300 bg-purple-50 hover:bg-purple-100",
  },
  {
    id: "kbmo_testing",
    label: "KBMO Testing",
    price: "$299",
    url: "https://theacademy.theurbanmonk.com/interconnected-kbmo-webinar-299",
    icon: <ShoppingBag className="h-5 w-5" />,
    description: "KBMO FIT22 food sensitivity + gut permeability test — $299",
    color: "border-orange-300 bg-orange-50 hover:bg-orange-100",
  },
  {
    id: "gateway_to_health",
    label: "Gateway to Health — Free Screening",
    price: "Free",
    url: "https://www.gatewaytohealth.com/gatewaytohealth",
    icon: <TrendingUp className="h-5 w-5" />,
    description: "Free screening — the gateway series for cold audiences",
    color: "border-rose-300 bg-rose-50 hover:bg-rose-100",
  },
  {
    id: "custom",
    label: "Custom Offer",
    price: "Custom",
    url: "",
    icon: <Target className="h-5 w-5" />,
    description: "Define your own offer label and description",
    color: "border-gray-300 bg-gray-50 hover:bg-gray-100",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type LandingPageRecord = {
  id: number;
  title: string;
  personaName: string | null;
  offer: string;
  copyBody: string | null;
  gammaUrl: string | null;
  gammaGenerationId: string | null;
  status: "draft" | "generating" | "published" | "failed";
  errorMessage: string | null;
  createdAt: Date;
};

// ─── Polling hook ─────────────────────────────────────────────────────────────

function useGammaPoll(
  pageId: number | null,
  enabled: boolean,
  onComplete: (gammaUrl: string) => void,
  onFailed: (error: string) => void
) {
  const utils = trpc.useUtils();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !pageId) return;

    pollRef.current = setInterval(async () => {
      try {
        const result = await utils.landingPages.pollGamma.fetch({ id: pageId });
        if (result.status === "completed" && result.gammaUrl) {
          clearInterval(pollRef.current!);
          onComplete(result.gammaUrl);
        } else if (result.status === "failed") {
          clearInterval(pollRef.current!);
          onFailed(result.error ?? "Generation failed");
        }
      } catch {
        // Network error — keep polling
      }
    }, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, pageId]);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LandingPageGenerator() {
  const [, navigate] = useLocation();

  // Cross-module pre-fill from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const fromModule = urlParams.get("from");
  const fromId = urlParams.get("id") ? Number(urlParams.get("id")) : null;

  const { data: webinarFeed } = trpc.crossModule.webinarToLandingPage.useQuery(
    { webinarSessionId: fromId! },
    { enabled: fromModule === "webinar" && fromId !== null }
  );
  const { data: ebookFeed } = trpc.crossModule.ebookToLandingPage.useQuery(
    { ebookId: fromId! },
    { enabled: fromModule === "ebook" && fromId !== null }
  );

  // Step state
  const [step, setStep] = useState<"configure" | "preview" | "history">("configure");
  const [prefillLabel, setPrefillLabel] = useState<string | null>(null);

  // Form state
  const [selectedPersona, setSelectedPersona] = useState<(typeof PERSONAS)[0] | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<string>("upstream_bundle");
  const [customOfferLabel, setCustomOfferLabel] = useState("");
  const [contentAngle, setContentAngle] = useState("");

  // Generated copy state
  const [generatedPageId, setGeneratedPageId] = useState<number | null>(null);
  const [editableCopy, setEditableCopy] = useState("");
  const [pageTitle, setPageTitle] = useState("");

  // Gamma publish state
  const [isPolling, setIsPolling] = useState(false);
  const [gammaUrl, setGammaUrl] = useState<string | null>(null);
  const [gammaError, setGammaError] = useState<string | null>(null);

  // A/B variant state
  const [showVariantPanel, setShowVariantPanel] = useState(false);
  const [selectedVariantAngle, setSelectedVariantAngle] = useState<"fear" | "aspiration" | "authority" | "curiosity">("aspiration");

  // UTM builder state
  const [showUtmPanel, setShowUtmPanel] = useState(false);
  const [utmSource, setUtmSource] = useState("");
  const [utmMedium, setUtmMedium] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [utmContent, setUtmContent] = useState("");

  // Variant comparison state
  const [compareIds, setCompareIds] = useState<[number | null, number | null]>([null, null]);
  const [showCompareView, setShowCompareView] = useState(false);

  // tRPC
  const { data: pages, refetch: refetchPages } = trpc.landingPages.list.useQuery();
  const generateCopyMutation = trpc.landingPages.generateCopy.useMutation();
  const updateCopyMutation = trpc.landingPages.updateCopy.useMutation();
  const publishToGammaMutation = trpc.landingPages.publishToGamma.useMutation();
  const deleteMutation = trpc.landingPages.delete.useMutation();
  const generateVariantMutation = trpc.landingPages.generateVariant.useMutation();

  // Poll for Gamma completion
  useGammaPoll(
    generatedPageId,
    isPolling,
    (url) => {
      setGammaUrl(url);
      setIsPolling(false);
      toast.success("Landing page published to Gamma!", { duration: 5000 });
      refetchPages();
    },
    (error) => {
      setGammaError(error);
      setIsPolling(false);
      toast.error(`Gamma generation failed: ${error}`);
      refetchPages();
    }
  );

  // Apply cross-module prefill data when feed arrives
  useEffect(() => {
    if (fromModule === "webinar" && webinarFeed) {
      setContentAngle(webinarFeed.contentAngle);
      setSelectedOffer("lights_on_webinar");
      setPrefillLabel(`Webinar: "${webinarFeed.webinarTopic}"`);
      // Auto-select best persona: try to match personaName hint from webinar session,
      // otherwise fall back to "Burnout Recovery Seeker" (best fit for Lights On webinar)
      if (!selectedPersona) {
        const hint = (webinarFeed.personaName ?? "").toLowerCase();
        const matched = hint
          ? PERSONAS.find((p) => p.name.toLowerCase().includes(hint) || hint.includes(p.name.toLowerCase().split(" ")[0]))
          : null;
        setSelectedPersona(matched ?? PERSONAS.find((p) => p.name === "Burnout Recovery Seeker") ?? PERSONAS[0]);
      }
      // NOTE: Do NOT clear URL params here — keep them until the user generates copy
      // so that sourceWebinarId is still available in handleGenerateCopy
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromModule, webinarFeed]);

  useEffect(() => {
    if (fromModule === "ebook" && ebookFeed) {
      setContentAngle(ebookFeed.contentAngle);
      setSelectedOffer("custom");
      setCustomOfferLabel(ebookFeed.offerCustomLabel ?? `Free E-Book: ${ebookFeed.ebookTitle}`);
      setPrefillLabel(`E-Book: "${ebookFeed.ebookTitle}"`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fromModule, ebookFeed]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerateCopy = async () => {
    if (!selectedPersona) {
      toast.error("Please select an avatar first");
      return;
    }
    if (!contentAngle.trim()) {
      toast.error("Please enter a content angle / key message");
      return;
    }
    if (selectedOffer === "custom" && !customOfferLabel.trim()) {
      toast.error("Please enter a custom offer label");
      return;
    }

    try {
      const result = await generateCopyMutation.mutateAsync({
        personaName: selectedPersona.name,
        personaPainPoints: selectedPersona.painPoints.join("; "),
        personaAspirations: selectedPersona.aspirations.join("; "),
        offer: selectedOffer as "upstream_bundle" | "upstream_course" | "explorer_tier" | "lights_on_webinar" | "deep_sleep_webinar" | "homesick_screening" | "interconnected_screening" | "kbmo_testing" | "gateway_health" | "custom",
        offerCustomLabel: selectedOffer === "custom" ? customOfferLabel : undefined,
        contentAngle: contentAngle.trim(),
        // Connection tracking: pass source IDs from cross-module feed
        ...(fromModule === "webinar" && fromId ? { sourceWebinarId: fromId } : {}),
        ...(fromModule === "ebook" && fromId ? { sourceEbookId: fromId } : {}),
      });

      setGeneratedPageId(result.id);
      setEditableCopy(result.copyBody);
      setPageTitle(result.title);
      setGammaUrl(null);
      setGammaError(null);
      setIsPolling(false);
      setStep("preview");
      // Now that copy is generated and sourceWebinarId has been captured, clear URL params
      window.history.replaceState({}, "", window.location.pathname);
      toast.success("Copy generated! Review and edit before publishing to Gamma.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Copy generation failed");
    }
  };

  const handleSaveCopy = async () => {
    if (!generatedPageId) return;
    try {
      await updateCopyMutation.mutateAsync({
        id: generatedPageId,
        copyBody: editableCopy,
        title: pageTitle,
      });
      toast.success("Copy saved");
    } catch {
      toast.error("Failed to save copy");
    }
  };

  const handlePublishToGamma = async () => {
    if (!generatedPageId) return;

    // Save latest edits first
    await handleSaveCopy();

    try {
      await publishToGammaMutation.mutateAsync({ id: generatedPageId });
      setIsPolling(true);
      setGammaError(null);
      toast.info("Gamma generation started — polling for completion (this takes 30-60 seconds)...");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start Gamma generation");
    }
  };

  const handleGenerateVariant = async () => {
    if (!generatedPageId) return;
    // Save latest edits first so the variant is based on current copy
    await handleSaveCopy();
    try {
      const result = await generateVariantMutation.mutateAsync({
        id: generatedPageId,
        variantAngle: selectedVariantAngle,
      });
      // Load the new variant into the preview
      setGeneratedPageId(result.id);
      setEditableCopy(result.copyBody);
      setPageTitle(result.title);
      setGammaUrl(null);
      setGammaError(null);
      setIsPolling(false);
      setShowVariantPanel(false);
      refetchPages();
      toast.success(`${selectedVariantAngle.charAt(0).toUpperCase() + selectedVariantAngle.slice(1)}-angle variant created! Review before publishing.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Variant generation failed");
    }
  };

  const handleGoToCreationStudio = (personaName?: string | null, offer?: string | null) => {
    // Build query params to pre-fill Creation Studio
    const params = new URLSearchParams();
    if (personaName) params.set("persona", personaName);
    if (offer) params.set("offer", offer);
    navigate(`/studio?${params.toString()}`);
  };

  const handleDeletePage = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("Landing page deleted");
      refetchPages();
      if (generatedPageId === id) {
        setGeneratedPageId(null);
        setEditableCopy("");
        setPageTitle("");
        setGammaUrl(null);
        setStep("configure");
      }
    } catch {
      toast.error("Failed to delete");
    }
  };

  const handleLoadPage = (page: LandingPageRecord) => {
    setGeneratedPageId(page.id);
    setEditableCopy(page.copyBody ?? "");
    setPageTitle(page.title);
    setGammaUrl(page.gammaUrl);
    setGammaError(page.errorMessage);
    setIsPolling(page.status === "generating");
    setStep("preview");
  };

  // ─── UTM helpers ────────────────────────────────────────────────────────────

  const buildUtmUrl = (base: string) => {
    if (!base) return "";
    const params = new URLSearchParams();
    if (utmSource.trim()) params.set("utm_source", utmSource.trim());
    if (utmMedium.trim()) params.set("utm_medium", utmMedium.trim());
    if (utmCampaign.trim()) params.set("utm_campaign", utmCampaign.trim());
    if (utmContent.trim()) params.set("utm_content", utmContent.trim());
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const UTM_PRESETS = [
    { label: "Instagram Reel", source: "instagram", medium: "reel", content: "reel" },
    { label: "LinkedIn Post", source: "linkedin", medium: "post", content: "organic" },
    { label: "YouTube Desc", source: "youtube", medium: "description", content: "video" },
    { label: "Email", source: "email", medium: "newsletter", content: "cta" },
    { label: "TikTok Bio", source: "tiktok", medium: "bio", content: "bio" },
  ];

  const applyUtmPreset = (preset: typeof UTM_PRESETS[0]) => {
    setUtmSource(preset.source);
    setUtmMedium(preset.medium);
    setUtmContent(preset.content);
    // Auto-fill campaign from page title slug if empty
    if (!utmCampaign.trim() && pageTitle) {
      setUtmCampaign(
        pageTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .slice(0, 40)
      );
    }
  };

  // ─── Compare helpers ─────────────────────────────────────────────────────────

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev[0] === id) return [null, prev[1]];
      if (prev[1] === id) return [prev[0], null];
      if (prev[0] === null) return [id, prev[1]];
      if (prev[1] === null) return [prev[0], id];
      // Both slots full — replace slot 0
      return [id, prev[1]];
    });
  };

  const isSelectedForCompare = (id: number) => compareIds[0] === id || compareIds[1] === id;

  // Word-level diff: returns array of {text, type: 'same'|'added'|'removed'}
  const diffWords = (a: string, b: string) => {
    const wordsA = a.split(/(\s+)/);
    const wordsB = b.split(/(\s+)/);
    // Simple LCS-based diff
    const result: { text: string; type: "same" | "added" | "removed" }[] = [];
    let i = 0, j = 0;
    // Build LCS table
    const m = Math.min(wordsA.length, 200); // cap for performance
    const n = Math.min(wordsB.length, 200);
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let r = 1; r <= m; r++) {
      for (let c = 1; c <= n; c++) {
        dp[r][c] = wordsA[r - 1] === wordsB[c - 1] ? dp[r - 1][c - 1] + 1 : Math.max(dp[r - 1][c], dp[r][c - 1]);
      }
    }
    // Traceback
    let r = m, c = n;
    const ops: { text: string; type: "same" | "added" | "removed" }[] = [];
    while (r > 0 || c > 0) {
      if (r > 0 && c > 0 && wordsA[r - 1] === wordsB[c - 1]) {
        ops.unshift({ text: wordsA[r - 1], type: "same" });
        r--; c--;
      } else if (c > 0 && (r === 0 || dp[r][c - 1] >= dp[r - 1][c])) {
        ops.unshift({ text: wordsB[c - 1], type: "added" });
        c--;
      } else {
        ops.unshift({ text: wordsA[r - 1], type: "removed" });
        r--;
      }
    }
    // Append remaining words beyond cap
    for (let k = m; k < wordsA.length; k++) ops.push({ text: wordsA[k], type: "removed" });
    for (let k = n; k < wordsB.length; k++) ops.push({ text: wordsB[k], type: "added" });
    return ops;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden h-screen">
        {/* Header */}
        <div className="border-b border-[oklch(0.88_0.02_80)] bg-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[oklch(0.25_0.03_60)] flex items-center gap-2">
              <Globe className="h-5 w-5 text-[oklch(0.55_0.12_50)]" />
              Landing Page Generator
            </h1>
            <p className="text-sm text-[oklch(0.3_0.03_60)] mt-0.5">
              Pick an avatar + offer → AI writes copy in Pedram's voice → publish to Gamma
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("history")}
              className="border-[oklch(0.88_0.02_80)]"
            >
              <Eye className="h-4 w-4 mr-1.5" />
              History ({pages?.length ?? 0})
            </Button>
            <Button
              size="sm"
              onClick={() => { setStep("configure"); setGeneratedPageId(null); setEditableCopy(""); setGammaUrl(null); }}
              className="bg-[oklch(0.65_0.12_50)] hover:bg-[oklch(0.58_0.12_50)] text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Page
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Cross-module prefill confirmation banner */}
          {prefillLabel && (
            <div className="flex items-center gap-3 px-4 py-3 mb-4 rounded-lg bg-[oklch(0.65_0.12_50)]/10 border border-[oklch(0.65_0.12_50)]/20 text-sm">
              <GitFork className="w-4 h-4 text-[oklch(0.55_0.12_50)] shrink-0" />
              <span className="flex-1">
                <span className="font-medium">Pre-filled from </span>
                {prefillLabel}
              </span>
              <button
                onClick={() => {
                  setPrefillLabel(null);
                  setContentAngle("");
                  setSelectedOffer("upstream_bundle");
                  setCustomOfferLabel("");
                  toast("Prefill cleared", { description: "Form reset to blank" });
                }}
                className="text-xs text-[oklch(0.45_0.03_60)] hover:text-[oklch(0.25_0.03_60)] underline underline-offset-2"
              >
                Undo prefill
              </button>
            </div>
          )}
          {/* ── CONFIGURE STEP ── */}
          {step === "configure" && (
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Step 1: Avatar */}
              <section>
                <h2 className="text-base font-semibold text-[oklch(0.25_0.03_60)] mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[oklch(0.65_0.12_50)] text-white text-xs flex items-center justify-center font-bold">1</span>
                  Choose Your Avatar
                </h2>
                <p className="text-sm text-[oklch(0.3_0.03_60)] mb-4 ml-8">
                  Who is this landing page speaking to? The copy will be written specifically for their pain points and language.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.name}
                      onClick={() => setSelectedPersona(persona)}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        selectedPersona?.name === persona.name
                          ? "border-[oklch(0.65_0.12_50)] bg-[oklch(0.65_0.12_50)]/10 shadow-sm"
                          : `${persona.color} border`
                      }`}
                    >
                      {selectedPersona?.name === persona.name && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-[oklch(0.55_0.12_50)]" />
                      )}
                      <div className="text-[oklch(0.45_0.12_50)] mb-2">{persona.icon}</div>
                      <div className="font-medium text-xs text-[oklch(0.25_0.03_60)] leading-tight mb-1">
                        {persona.name}
                      </div>
                      <div className="text-[10px] text-[oklch(0.3_0.03_60)] leading-tight">
                        {persona.tagline}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected persona detail */}
                {selectedPersona && (
                  <div className="mt-3 p-3 rounded-lg bg-white border border-[oklch(0.88_0.02_80)] ml-0">
                    <div className="text-xs font-medium text-[oklch(0.3_0.03_60)] mb-1">Pain points the copy will address:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPersona.painPoints.map((p) => (
                        <Badge key={p} variant="outline" className="text-[10px] border-[oklch(0.88_0.02_80)] text-[oklch(0.3_0.03_60)]">
                          {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Step 2: Offer */}
              <section>
                <h2 className="text-base font-semibold text-[oklch(0.25_0.03_60)] mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[oklch(0.65_0.12_50)] text-white text-xs flex items-center justify-center font-bold">2</span>
                  Select the Offer
                </h2>
                <p className="text-sm text-[oklch(0.3_0.03_60)] mb-4 ml-8">
                  What are you selling? The copy structure, CTA, and urgency will be tailored to this offer.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {OFFERS.map((offer) => (
                    <button
                      key={offer.id}
                      onClick={() => setSelectedOffer(offer.id)}
                      className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                        selectedOffer === offer.id
                          ? "border-[oklch(0.65_0.12_50)] bg-[oklch(0.65_0.12_50)]/10 shadow-sm"
                          : `${offer.color} border`
                      }`}
                    >
                      {selectedOffer === offer.id && (
                        <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-[oklch(0.55_0.12_50)]" />
                      )}
                      <div className="text-[oklch(0.45_0.12_50)] mb-2">{offer.icon}</div>
                      <div className="font-semibold text-xs text-[oklch(0.25_0.03_60)] mb-0.5">{offer.label}</div>
                      <div className="text-[10px] font-medium text-[oklch(0.55_0.12_50)] mb-1">{offer.price}</div>
                      <div className="text-[10px] text-[oklch(0.3_0.03_60)] leading-tight">{offer.description}</div>
                    </button>
                  ))}
                </div>

                {selectedOffer === "custom" && (
                  <div className="mt-3 ml-0">
                    <Label className="text-xs text-[oklch(0.3_0.03_60)]">Custom Offer Label</Label>
                    <Input
                      value={customOfferLabel}
                      onChange={(e) => setCustomOfferLabel(e.target.value)}
                      placeholder="e.g. The Urban Monk Masterclass — $497"
                      className="mt-1 text-sm border-[oklch(0.88_0.02_80)]"
                    />
                  </div>
                )}
              </section>

              {/* Step 3: Content Angle */}
              <section>
                <h2 className="text-base font-semibold text-[oklch(0.25_0.03_60)] mb-1 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[oklch(0.65_0.12_50)] text-white text-xs flex items-center justify-center font-bold">3</span>
                  Content Angle / Key Message
                </h2>
                <p className="text-sm text-[oklch(0.3_0.03_60)] mb-4 ml-8">
                  What's the core insight or hook this page leads with? This shapes the entire narrative arc.
                </p>
                <div className="space-y-2">
                  <Textarea
                    value={contentAngle}
                    onChange={(e) => setContentAngle(e.target.value)}
                    placeholder={
                      selectedPersona
                        ? `e.g. "${selectedPersona.contentHooks?.[0] ?? "The hidden reason your health isn't improving despite doing everything right"}"` 
                        : "e.g. The hidden reason your health isn't improving despite doing everything right..."
                    }
                    className="min-h-[80px] text-sm border-[oklch(0.88_0.02_80)] resize-none"
                  />
                  {selectedPersona && (
                    <div className="text-xs text-[oklch(0.3_0.03_60)]">
                      Suggested hooks for {selectedPersona.name}:
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {selectedPersona.contentHooks.map((hook: string) => (
                          <button
                            key={hook}
                            onClick={() => setContentAngle(hook)}
                            className="px-2 py-0.5 rounded-full bg-[oklch(0.93_0.02_80)] border border-[oklch(0.88_0.02_80)] text-[10px] text-[oklch(0.3_0.03_60)] hover:bg-[oklch(0.88_0.02_80)] transition-colors"
                          >
                            {hook}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Generate button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleGenerateCopy}
                  disabled={generateCopyMutation.isPending || !selectedPersona || !contentAngle.trim()}
                  className="bg-[oklch(0.65_0.12_50)] hover:bg-[oklch(0.58_0.12_50)] text-white px-8 py-2.5 text-sm font-semibold"
                >
                  {generateCopyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Writing copy in Pedram's voice...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Landing Page Copy
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── PREVIEW / EDIT STEP ── */}
          {step === "preview" && (
            <div className="max-w-5xl mx-auto space-y-4">
              {/* Toolbar */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setStep("configure")}
                  className="flex items-center gap-1.5 text-sm text-[oklch(0.3_0.03_60)] hover:text-[oklch(0.25_0.03_60)] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to configure
                </button>
                <div className="flex items-center gap-2">
                  {/* A/B Variant button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVariantPanel((v) => !v)}
                    disabled={generateVariantMutation.isPending}
                    className="border-[oklch(0.88_0.02_80)] text-[oklch(0.3_0.03_60)]"
                    title="Generate an A/B variant with a different persuasion angle"
                  >
                    <FlaskConical className="h-4 w-4 mr-1.5" />
                    A/B Variant
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveCopy}
                    disabled={updateCopyMutation.isPending}
                    className="border-[oklch(0.88_0.02_80)]"
                  >
                    {updateCopyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save Edits"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePublishToGamma}
                    disabled={publishToGammaMutation.isPending || isPolling || !!gammaUrl}
                    className="bg-[oklch(0.45_0.18_280)] hover:bg-[oklch(0.38_0.18_280)] text-white font-semibold"
                  >
                    {isPolling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating in Gamma...
                      </>
                    ) : publishToGammaMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : gammaUrl ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Published to Gamma
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Publish to Gamma
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      handleSaveCopy();
                      const params = new URLSearchParams();
                      if (generatedPageId) params.set("fromLpId", String(generatedPageId));
                      // Infer campaign from offer so CH builder pre-selects the right campaign
                      const offerCampaignMap: Record<string, string> = {
                        lights_on_webinar: "lo", upstream_bundle: "lo", upstream_course: "lo", explorer_tier: "lo",
                        deep_sleep_webinar: "sleep",
                        kbmo_testing: "gut", gateway_health: "gut",
                        homesick_screening: "webinar", interconnected_screening: "webinar",
                      };
                      const campaign = offerCampaignMap[selectedOffer] ?? "lo";
                      params.set("campaign", campaign);
                      params.set("template", "optin");
                      navigate(`/ch-pages?${params.toString()}`);
                    }}
                    className="bg-[oklch(0.45_0.18_140)] hover:bg-[oklch(0.38_0.18_140)] text-white font-semibold"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Publish to CH Pages
                  </Button>
                </div>
              </div>

              {/* A/B Variant panel */}
              {showVariantPanel && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold text-sm text-amber-900 flex items-center gap-2">
                      <FlaskConical className="h-4 w-4" />
                      Generate A/B Variant
                    </div>
                    <button onClick={() => setShowVariantPanel(false)} className="text-amber-600 hover:text-amber-800 text-xs">
                      ✕ Close
                    </button>
                  </div>
                  <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                    Rewrites the current copy with a different persuasion angle. Saves as a new draft — your original is preserved.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                    {([
                      { id: "aspiration" as const, label: "Aspiration", desc: "Best possible future", emoji: "✨" },
                      { id: "fear" as const, label: "Fear", desc: "Cost of inaction", emoji: "⚠️" },
                      { id: "authority" as const, label: "Authority", desc: "Credentials & proof", emoji: "🎓" },
                      { id: "curiosity" as const, label: "Curiosity", desc: "Surprising insight", emoji: "🔍" },
                    ]).map((angle) => (
                      <button
                        key={angle.id}
                        onClick={() => setSelectedVariantAngle(angle.id)}
                        className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                          selectedVariantAngle === angle.id
                            ? "border-amber-500 bg-amber-100"
                            : "border-amber-200 bg-white hover:border-amber-300"
                        }`}
                      >
                        <div className="text-base mb-0.5">{angle.emoji}</div>
                        <div className="text-xs font-semibold text-amber-900">{angle.label}</div>
                        <div className="text-[10px] text-amber-700">{angle.desc}</div>
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleGenerateVariant}
                    disabled={generateVariantMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-sm"
                  >
                    {generateVariantMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating variant...</>
                    ) : (
                      <><FlaskConical className="h-4 w-4 mr-2" />Generate {selectedVariantAngle.charAt(0).toUpperCase() + selectedVariantAngle.slice(1)} Variant</>
                    )}
                  </Button>
                </div>
              )}

              {/* Gamma result banner */}
              {gammaUrl && (
                <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-sm text-green-800">Landing page published to Gamma!</div>
                      <a
                        href={gammaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-700 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        {gammaUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { navigator.clipboard.writeText(gammaUrl); toast.success("URL copied!"); }}
                      className="border-green-300 text-green-700 hover:bg-green-100"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      Copy URL
                    </Button>
                    <a href={gammaUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open in Gamma
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {/* Gamma error banner */}
              {gammaError && !gammaUrl && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-sm text-red-800">Gamma generation failed</div>
                    <div className="text-xs text-red-700 mt-0.5">{gammaError}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePublishToGamma}
                    className="ml-auto border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                    Retry
                  </Button>
                </div>
              )}

              {/* Polling indicator */}
              {isPolling && !gammaUrl && (
                <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-violet-600 animate-spin shrink-0" />
                  <div className="text-sm text-violet-800">
                    Gamma is generating your landing page... This typically takes 30–90 seconds. Polling every 5 seconds.
                  </div>
                </div>
              )}

              {/* CH Pages info banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <Globe className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-emerald-800">Also available: Publish to CH Pages</div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Host this page on <span className="font-mono">ch.theurbanmonk.com</span> with FB Pixel + GA4 baked in — no Gamma credits needed.
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    handleSaveCopy();
                    const params = new URLSearchParams();
                    if (generatedPageId) params.set("fromLpId", String(generatedPageId));
                    const offerCampaignMap2: Record<string, string> = {
                      lights_on_webinar: "lo", upstream_bundle: "lo", upstream_course: "lo", explorer_tier: "lo",
                      deep_sleep_webinar: "sleep",
                      kbmo_testing: "gut", gateway_health: "gut",
                      homesick_screening: "webinar", interconnected_screening: "webinar",
                    };
                    params.set("campaign", offerCampaignMap2[selectedOffer] ?? "lo");
                    params.set("template", "optin");
                    navigate(`/ch-pages?${params.toString()}`);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                >
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  Open CH Builder
                </Button>
              </div>

              {/* Two-column layout: edit + info */}
              <div className="grid grid-cols-3 gap-4">
                {/* Copy editor */}
                <div className="col-span-2">
                  <Card className="border-[oklch(0.88_0.02_80)] bg-white">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-[oklch(0.3_0.03_60)] uppercase tracking-wide">
                          Page Title
                        </Label>
                      </div>
                      <Input
                        value={pageTitle}
                        onChange={(e) => setPageTitle(e.target.value)}
                        className="text-sm font-medium border-[oklch(0.88_0.02_80)] mt-1"
                        placeholder="Page title..."
                      />
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <Label className="text-xs font-semibold text-[oklch(0.3_0.03_60)] uppercase tracking-wide mb-2 block">
                        Landing Page Copy (Markdown)
                      </Label>
                      <Textarea
                        value={editableCopy}
                        onChange={(e) => setEditableCopy(e.target.value)}
                        className="min-h-[600px] text-sm font-mono border-[oklch(0.88_0.02_80)] resize-none leading-relaxed"
                        placeholder="AI-generated copy will appear here..."
                      />
                      <div className="flex justify-between items-center mt-2 text-xs text-[oklch(0.4_0.03_60)]">
                        <span>{editableCopy.split(/\s+/).filter(Boolean).length} words</span>
                        <span>{editableCopy.length} characters</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar info */}
                <div className="space-y-3">
                  {/* Publish info */}
                  <Card className="border-[oklch(0.88_0.02_80)] bg-white">
                    <CardContent className="p-4 space-y-3">
                      <div className="text-xs font-semibold text-[oklch(0.3_0.03_60)] uppercase tracking-wide">
                        Publish Options
                      </div>
                      <div className="text-xs text-[oklch(0.3_0.03_60)] font-medium mt-1">Gamma (AI-designed)</div>
                      <div className="text-xs text-[oklch(0.3_0.03_60)] leading-relaxed">
                        Sends copy to Gamma API. Uses Gamma credits. ~30–90 sec.
                      </div>
                      <div className="text-xs text-[oklch(0.3_0.03_60)] font-medium mt-2">CH Pages (self-hosted)</div>
                      <div className="text-xs text-[oklch(0.3_0.03_60)] leading-relaxed">
                        Hosts at <span className="font-mono text-[10px]">ch.theurbanmonk.com</span> with FB Pixel + GA4. Instant, no credits.
                      </div>
                    </CardContent>
                  </Card>

                  {/* Page details */}
                  <Card className="border-[oklch(0.88_0.02_80)] bg-white">
                    <CardContent className="p-4 space-y-2">
                      <div className="text-xs font-semibold text-[oklch(0.3_0.03_60)] uppercase tracking-wide mb-2">
                        Page Details
                      </div>
                      {selectedPersona && (
                        <div className="flex items-start gap-2">
                          <Users className="h-3.5 w-3.5 text-[oklch(0.3_0.03_60)] mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[10px] text-[oklch(0.4_0.03_60)]">Avatar</div>
                            <div className="text-xs font-medium text-[oklch(0.35_0.03_60)]">{selectedPersona.name}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Target className="h-3.5 w-3.5 text-[oklch(0.3_0.03_60)] mt-0.5 shrink-0" />
                        <div>
                          <div className="text-[10px] text-[oklch(0.4_0.03_60)]">Offer</div>
                          <div className="text-xs font-medium text-[oklch(0.35_0.03_60)]">
                            {OFFERS.find((o) => o.id === selectedOffer)?.label ?? selectedOffer}
                          </div>
                        </div>
                      </div>
                      {contentAngle && (
                        <div className="flex items-start gap-2">
                          <Sparkles className="h-3.5 w-3.5 text-[oklch(0.3_0.03_60)] mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[10px] text-[oklch(0.4_0.03_60)]">Content Angle</div>
                            <div className="text-xs text-[oklch(0.3_0.03_60)] leading-tight">{contentAngle}</div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Creation Studio deep-link */}
                  <Card className="border-[oklch(0.88_0.02_80)] bg-[oklch(0.97_0.02_160)]">
                    <CardContent className="p-4">
                      <div className="text-xs font-semibold text-[oklch(0.35_0.08_160)] mb-1.5 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Create Supporting Content
                      </div>
                      <p className="text-[10px] text-[oklch(0.45_0.05_160)] leading-relaxed mb-2.5">
                        Generate social posts, emails, and video scripts that drive traffic to this landing page.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => handleGoToCreationStudio(selectedPersona?.name, selectedOffer)}
                        className="w-full bg-[oklch(0.50_0.12_160)] hover:bg-[oklch(0.43_0.12_160)] text-white text-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                        Open Creation Studio
                      </Button>
                    </CardContent>
                  </Card>

                  {/* UTM Builder */}
                  <Card className="border-[oklch(0.88_0.02_80)] bg-white">
                    <CardContent className="p-4">
                      <button
                        onClick={() => setShowUtmPanel((v) => !v)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-[oklch(0.35_0.03_60)] uppercase tracking-wide mb-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <Link className="h-3.5 w-3.5" />
                          UTM Link Builder
                        </span>
                        {showUtmPanel ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      {!showUtmPanel && (
                        <p className="text-[10px] text-[oklch(0.4_0.03_60)]">Track which posts drive traffic to this page.</p>
                      )}
                      {showUtmPanel && (
                        <div className="space-y-2 mt-2">
                          {/* Presets */}
                          <div className="flex flex-wrap gap-1">
                            {UTM_PRESETS.map((p) => (
                              <button
                                key={p.label}
                                onClick={() => applyUtmPreset(p)}
                                className="px-2 py-0.5 rounded-full bg-[oklch(0.93_0.02_80)] border border-[oklch(0.88_0.02_80)] text-[10px] text-[oklch(0.3_0.03_60)] hover:bg-[oklch(0.88_0.02_80)] transition-colors"
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          {/* Fields */}
                          <div className="space-y-1.5">
                            {([
                              { label: "Source", value: utmSource, set: setUtmSource, placeholder: "instagram" },
                              { label: "Medium", value: utmMedium, set: setUtmMedium, placeholder: "reel" },
                              { label: "Campaign", value: utmCampaign, set: setUtmCampaign, placeholder: "burnout-academy" },
                              { label: "Content", value: utmContent, set: setUtmContent, placeholder: "reel" },
                            ] as const).map((field) => (
                              <div key={field.label} className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[oklch(0.3_0.03_60)] w-14 shrink-0">{field.label}</span>
                                <Input
                                  value={field.value}
                                  onChange={(e) => field.set(e.target.value)}
                                  placeholder={field.placeholder}
                                  className="h-6 text-[10px] border-[oklch(0.88_0.02_80)] px-2"
                                />
                              </div>
                            ))}
                          </div>
                          {/* Generated URLs */}
                          {gammaUrl && (
                            <div className="mt-2 space-y-1.5">
                              <div className="text-[10px] font-semibold text-[oklch(0.3_0.03_60)] uppercase tracking-wide">Tagged URL</div>
                              <div className="flex items-start gap-1.5">
                                <div className="flex-1 min-w-0 text-[10px] text-[oklch(0.3_0.03_60)] bg-[oklch(0.95_0.01_80)] rounded p-1.5 font-mono break-all leading-relaxed">
                                  {buildUtmUrl(gammaUrl)}
                                </div>
                                <button
                                  onClick={() => { navigator.clipboard.writeText(buildUtmUrl(gammaUrl!)); toast.success("UTM URL copied!"); }}
                                  className="shrink-0 p-1 rounded hover:bg-[oklch(0.90_0.02_80)] text-[oklch(0.3_0.03_60)] transition-colors"
                                  title="Copy tagged URL"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                          {!gammaUrl && (
                            <p className="text-[10px] text-[oklch(0.4_0.03_60)] italic mt-1">Publish to Gamma first to generate tagged URLs.</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tips */}
                  <Card className="border-[oklch(0.88_0.02_80)] bg-amber-50">
                    <CardContent className="p-4">
                      <div className="text-xs font-semibold text-amber-800 mb-2">Editing Tips</div>
                      <ul className="text-[10px] text-amber-700 space-y-1.5 leading-relaxed">
                        <li>• Edit the headline (first # line) to be punchier</li>
                        <li>• Replace the sample testimonials with real ones</li>
                        <li>• Add Pedram's real credentials where marked</li>
                        <li>• Adjust the price/CTA to match your current offer</li>
                        <li>• Save edits before publishing to Gamma</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ── HISTORY STEP ── */}
          {step === "history" && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-[oklch(0.25_0.03_60)]">
                    Landing Page History ({pages?.length ?? 0})
                  </h2>
                  {(compareIds[0] !== null || compareIds[1] !== null) && (
                    <p className="text-xs text-[oklch(0.3_0.03_60)] mt-0.5">
                      {compareIds[0] !== null && compareIds[1] !== null
                        ? "2 pages selected — ready to compare"
                        : "1 page selected — select one more to compare"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {compareIds[0] !== null && compareIds[1] !== null && (
                    <Button
                      size="sm"
                      onClick={() => setShowCompareView(true)}
                      className="bg-[oklch(0.45_0.18_280)] hover:bg-[oklch(0.38_0.18_280)] text-white"
                    >
                      <Columns2 className="h-4 w-4 mr-1.5" />
                      Compare Selected
                    </Button>
                  )}
                  {(compareIds[0] !== null || compareIds[1] !== null) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setCompareIds([null, null]); setShowCompareView(false); }}
                      className="border-[oklch(0.88_0.02_80)] text-xs"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Clear
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setStep("configure")}
                    className="bg-[oklch(0.65_0.12_50)] hover:bg-[oklch(0.58_0.12_50)] text-white"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Page
                  </Button>
                </div>
              </div>

              {!pages || pages.length === 0 ? (
                <div className="text-center py-16 text-[oklch(0.4_0.03_60)]">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <div className="font-medium">No landing pages yet</div>
                  <div className="text-sm mt-1">Generate your first landing page above</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(pages as LandingPageRecord[]).slice().reverse().map((page) => (
                    <Card key={page.id} className="border-[oklch(0.88_0.02_80)] bg-white hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-sm text-[oklch(0.25_0.03_60)] truncate">
                                {page.title}
                              </span>
                              <Badge
                                className={`text-[10px] shrink-0 ${
                                  page.status === "published"
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : page.status === "generating"
                                    ? "bg-violet-100 text-violet-700 border-violet-200"
                                    : page.status === "failed"
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                }`}
                                variant="outline"
                              >
                                {page.status === "generating" && <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />}
                                {page.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[oklch(0.3_0.03_60)]">
                              {page.personaName && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {page.personaName}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {OFFERS.find((o) => o.id === page.offer)?.label ?? page.offer}
                              </span>
                              <span>{new Date(page.createdAt).toLocaleDateString()}</span>
                            </div>
                            {page.gammaUrl && (
                              <a
                                href={page.gammaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-violet-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View on Gamma
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleCompare(page.id)}
                              className={`text-xs transition-colors ${
                                isSelectedForCompare(page.id)
                                  ? "border-violet-400 bg-violet-50 text-violet-700 hover:bg-violet-100"
                                  : "border-[oklch(0.88_0.02_80)] text-[oklch(0.3_0.03_60)] hover:bg-[oklch(0.95_0.01_80)]"
                              }`}
                              title="Select for side-by-side comparison"
                            >
                              <Columns2 className="h-3.5 w-3.5 mr-1" />
                              {isSelectedForCompare(page.id) ? "Selected" : "Compare"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleGoToCreationStudio(page.personaName, page.offer)}
                              className="border-[oklch(0.88_0.02_80)] text-[oklch(0.45_0.08_160)] hover:bg-[oklch(0.95_0.03_160)] text-xs"
                              title="Create supporting social content for this landing page"
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1" />
                              Content
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadPage(page)}
                              className="border-[oklch(0.88_0.02_80)] text-xs"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              Open
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/ebook-generator?from=landingPage&id=${page.id}`)}
                              className="border-[oklch(0.88_0.02_80)] text-[oklch(0.45_0.08_280)] hover:bg-[oklch(0.95_0.03_280)] text-xs"
                              title="Create an e-book using this landing page's offer and audience"
                            >
                              <BookOpen className="h-3.5 w-3.5 mr-1" />
                              E-Book
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/webinar-builder?from=landingPage&id=${page.id}`)}
                              className="border-[oklch(0.88_0.02_80)] text-[oklch(0.45_0.08_30)] hover:bg-[oklch(0.95_0.03_30)] text-xs"
                              title="Create a webinar from this landing page's offer and audience"
                            >
                              <Video className="h-3.5 w-3.5 mr-1" />
                              Webinar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePage(page.id)}
                              disabled={deleteMutation.isPending}
                              className="border-red-200 text-red-600 hover:bg-red-50 text-xs"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── COMPARE VIEW OVERLAY ── */}
      {showCompareView && compareIds[0] !== null && compareIds[1] !== null && (() => {
        const pageA = (pages as LandingPageRecord[] | undefined)?.find((p) => p.id === compareIds[0]);
        const pageB = (pages as LandingPageRecord[] | undefined)?.find((p) => p.id === compareIds[1]);
        if (!pageA || !pageB) return null;
        const diffResult = diffWords(pageA.copyBody ?? "", pageB.copyBody ?? "");
        return (
          <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b border-[oklch(0.88_0.02_80)] px-6 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <Columns2 className="h-5 w-5 text-violet-600" />
                <span className="font-semibold text-sm text-[oklch(0.25_0.03_60)]">Side-by-Side Comparison</span>
                <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                  {diffResult.filter((d) => d.type !== "same").length} differences
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => { handleLoadPage(pageA); setShowCompareView(false); }}
                  className="bg-[oklch(0.65_0.12_50)] hover:bg-[oklch(0.58_0.12_50)] text-white text-xs"
                >
                  Open Original
                </Button>
                <Button
                  size="sm"
                  onClick={() => { handleLoadPage(pageB); setShowCompareView(false); }}
                  className="bg-[oklch(0.45_0.18_280)] hover:bg-[oklch(0.38_0.18_280)] text-white text-xs"
                >
                  Open Variant
                </Button>
                <button
                  onClick={() => setShowCompareView(false)}
                  className="p-1.5 rounded hover:bg-[oklch(0.93_0.02_80)] text-[oklch(0.3_0.03_60)] transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Metadata row */}
            <div className="bg-[oklch(0.97_0.01_80)] border-b border-[oklch(0.88_0.02_80)] px-6 py-2 grid grid-cols-2 gap-4 shrink-0">
              {[pageA, pageB].map((p, idx) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${idx === 0 ? "bg-[oklch(0.65_0.12_50)]" : "bg-violet-500"}`} />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-[oklch(0.25_0.03_60)] truncate">{p.title}</div>
                    <div className="flex items-center gap-2 text-[10px] text-[oklch(0.3_0.03_60)] mt-0.5">
                      {p.personaName && <span>{p.personaName}</span>}
                      <span>·</span>
                      <span>{OFFERS.find((o) => o.id === p.offer)?.label ?? p.offer}</span>
                      <span>·</span>
                      <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                      <Badge
                        variant="outline"
                        className={`text-[9px] ml-1 ${
                          p.status === "published" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"
                        }`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Two-column diff body */}
            <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-[oklch(0.88_0.02_80)]">
              {/* Left: original */}
              <div className="overflow-y-auto p-5">
                <div className="text-[10px] font-semibold text-[oklch(0.65_0.12_50)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[oklch(0.65_0.12_50)]" />
                  Original
                </div>
                <pre className="text-xs text-[oklch(0.35_0.03_60)] whitespace-pre-wrap font-mono leading-relaxed">
                  {diffResult.map((token, i) => (
                    token.type === "removed" ? (
                      <mark key={i} className="bg-red-100 text-red-800 rounded-sm px-0.5">{token.text}</mark>
                    ) : token.type === "added" ? null : (
                      <span key={i}>{token.text}</span>
                    )
                  ))}
                </pre>
              </div>
              {/* Right: variant */}
              <div className="overflow-y-auto p-5">
                <div className="text-[10px] font-semibold text-violet-600 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-violet-500" />
                  Variant
                </div>
                <pre className="text-xs text-[oklch(0.35_0.03_60)] whitespace-pre-wrap font-mono leading-relaxed">
                  {diffResult.map((token, i) => (
                    token.type === "added" ? (
                      <mark key={i} className="bg-green-100 text-green-800 rounded-sm px-0.5">{token.text}</mark>
                    ) : token.type === "removed" ? null : (
                      <span key={i}>{token.text}</span>
                    )
                  ))}
                </pre>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white border-t border-[oklch(0.88_0.02_80)] px-6 py-2 flex items-center gap-4 text-[10px] text-[oklch(0.3_0.03_60)] shrink-0">
              <span className="flex items-center gap-1.5">
                <mark className="bg-red-100 text-red-800 rounded-sm px-1">removed</mark>
                Text only in original
              </span>
              <span className="flex items-center gap-1.5">
                <mark className="bg-green-100 text-green-800 rounded-sm px-1">added</mark>
                Text only in variant
              </span>
              <span className="ml-auto text-[oklch(0.4_0.03_60)]">
                Showing first 200 words of diff — scroll to see full copy
              </span>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
