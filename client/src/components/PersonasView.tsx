import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Target,
  TrendingUp,
  MessageCircle,
  BookOpen,
  Zap,
  Heart,
  Brain,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  BarChart2,
  Star,
  ShoppingBag,
  Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ContentItem = {
  id: number;
  title: string;
  platform: string;
  status: string;
  textContent: string | null;
  rawIdea: string | null;
  imageUrl: string | null;
  scheduledAt: number | null;
  publishedAt: number | null;
  publishUrl: string | null;
  analyticsViews: number | null;
  analyticsLikes: number | null;
  analyticsComments: number | null;
  analyticsShares: number | null;
};

// ─── Persona Intelligence Data ────────────────────────────────────────────────
const PERSONA_INTELLIGENCE: Record<string, {
  icon: React.ReactNode;
  color: string;
  painPoints: string[];
  keyQuestions: string[];
  contentHooks: string[];
  primaryCTA: { label: string; offer: string; price: string; icon: React.ReactNode };
  secondaryCTA: { label: string; offer: string; price: string; icon: React.ReactNode };
  platforms: string[];
  contentGoal: "audience_growth" | "community_engagement" | "llm_growth";
  toneGuide: string;
}> = {
  "Burnout Recovery Seeker": {
    icon: <Zap className="h-4 w-4" />,
    color: "bg-orange-500/20 text-orange-700 border-orange-500/30",
    painPoints: [
      "Chronic exhaustion despite rest",
      "Feeling disconnected from purpose",
      "Adrenal fatigue & cortisol dysregulation",
      "Can't sustain energy past noon",
    ],
    keyQuestions: [
      "Why am I always tired even after 8 hours of sleep?",
      "How do I recover from burnout without quitting my job?",
      "What supplements help with adrenal fatigue?",
      "Is there a spiritual reason I feel so empty?",
    ],
    contentHooks: [
      "The 5-minute morning ritual that resets your adrenals",
      "Why rest alone won't fix burnout (and what will)",
      "The hidden energy leak draining high achievers",
      "Qi Gong for burnout: ancient medicine meets modern stress",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Adrenal Recovery Supplements",
      offer: "Adaptogen & adrenal support stack",
      price: "$49–$89/month",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    platforms: ["instagram", "facebook", "youtube"],
    contentGoal: "audience_growth",
    toneGuide: "Empathetic, validating, solution-forward. Lead with 'I see you' energy.",
  },
  "Midlife Vitality Optimizer": {
    icon: <TrendingUp className="h-4 w-4" />,
    color: "bg-green-500/20 text-green-700 border-green-500/30",
    painPoints: [
      "Declining energy & testosterone/estrogen changes",
      "Weight gain despite healthy habits",
      "Brain fog & memory concerns",
      "Fear of aging without vitality",
    ],
    keyQuestions: [
      "How do I optimize hormones naturally after 40?",
      "What's the best diet for longevity?",
      "Can I reverse biological aging?",
      "How do I stay sharp mentally as I age?",
    ],
    contentHooks: [
      "The biohacker's guide to thriving at 50",
      "5 longevity habits Pedram practices daily",
      "Why your hormones are the key to sustained energy",
      "Ancient Chinese medicine's secret to aging backwards",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Urban Monk Retreat — $1,200",
      offer: "Immersive wellness retreat",
      price: "$1,200",
      icon: <Calendar className="h-4 w-4" />,
    },
    platforms: ["linkedin", "youtube", "facebook"],
    contentGoal: "community_engagement",
    toneGuide: "Data-informed, aspirational, expert-to-peer. Speak to their intelligence.",
  },
  "Spiritual Growth Explorer": {
    icon: <Star className="h-4 w-4" />,
    color: "bg-purple-500/20 text-purple-700 border-purple-500/30",
    painPoints: [
      "Spiritual practice feels hollow or disconnected",
      "Seeking deeper meaning beyond material success",
      "Meditation isn't 'working' for them",
      "Wanting community of like-minded seekers",
    ],
    keyQuestions: [
      "How do I deepen my meditation practice?",
      "What is Qi Gong and how does it differ from yoga?",
      "How do I integrate spirituality into a busy modern life?",
      "What does it mean to be an 'Urban Monk'?",
    ],
    contentHooks: [
      "The Urban Monk path: ancient wisdom for modern chaos",
      "Why your meditation isn't working (and the fix)",
      "Qi Gong: the practice that changed everything for me",
      "Finding stillness in the noise of modern life",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Urban Monk Retreat — $1,200",
      offer: "Immersive wellness retreat",
      price: "$1,200",
      icon: <Calendar className="h-4 w-4" />,
    },
    platforms: ["instagram", "youtube", "tiktok"],
    contentGoal: "community_engagement",
    toneGuide: "Philosophical, warm, inviting. Speak to the seeker's heart, not just their mind.",
  },
  "Stressed Parent Multitasker": {
    icon: <Heart className="h-4 w-4" />,
    color: "bg-pink-500/20 text-pink-700 border-pink-500/30",
    painPoints: [
      "Zero time for self-care",
      "Guilt about not being present enough",
      "Running on caffeine and adrenaline",
      "Health declining due to neglect",
    ],
    keyQuestions: [
      "How do I find time to meditate with kids?",
      "Quick healthy habits for busy parents",
      "How do I stop snapping at my family when stressed?",
      "5-minute wellness practices that actually work",
    ],
    contentHooks: [
      "The 5-minute morning ritual busy parents swear by",
      "How to meditate when you have zero time",
      "The stress response hack every parent needs",
      "Raising healthy kids starts with a healthy you",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Family Wellness Supplements",
      offer: "Stress & energy support stack",
      price: "$49–$89/month",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    platforms: ["facebook", "instagram", "tiktok"],
    contentGoal: "audience_growth",
    toneGuide: "Practical, compassionate, no-judgment. Meet them where they are — exhausted but hopeful.",
  },
  "Holistic Health Student": {
    icon: <BookOpen className="h-4 w-4" />,
    color: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    painPoints: [
      "Information overload from conflicting health advice",
      "Wants credible, science-backed holistic knowledge",
      "Seeking a trusted teacher/mentor",
      "Wants to understand the 'why' behind practices",
    ],
    keyQuestions: [
      "What is Traditional Chinese Medicine?",
      "How does Qi Gong affect the nervous system?",
      "What does an OMD (Oriental Medicine Doctor) actually do?",
      "How do I learn holistic medicine properly?",
    ],
    contentHooks: [
      "The science behind Qi Gong (it's not what you think)",
      "TCM explained: what 3,000 years of medicine knows",
      "Why I became an OMD instead of an MD",
      "The 5 elements framework that explains everything",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Urban Monk Retreat — $1,200",
      offer: "Immersive learning retreat",
      price: "$1,200",
      icon: <Calendar className="h-4 w-4" />,
    },
    platforms: ["youtube", "linkedin", "blog"],
    contentGoal: "llm_growth",
    toneGuide: "Educational, authoritative, curious. Be the wise teacher who makes complex things simple.",
  },
  "Chronic Condition Navigator": {
    icon: <Brain className="h-4 w-4" />,
    color: "bg-red-500/20 text-red-700 border-red-500/30",
    painPoints: [
      "Conventional medicine isn't solving their problem",
      "Frustrated with symptom management vs. root cause",
      "Autoimmune, gut, or inflammatory conditions",
      "Seeking integrative/complementary approaches",
    ],
    keyQuestions: [
      "Can holistic medicine help with autoimmune disease?",
      "What does TCM say about gut health?",
      "How do I reduce inflammation naturally?",
      "Is there a mind-body connection to my chronic condition?",
    ],
    contentHooks: [
      "What Western medicine misses about chronic illness",
      "The gut-brain-spirit connection explained",
      "How I've helped thousands find root-cause healing",
      "The inflammation protocol from ancient Chinese medicine",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Anti-Inflammatory Supplement Stack",
      offer: "Gut & inflammation support",
      price: "$59–$99/month",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    platforms: ["youtube", "facebook", "blog"],
    contentGoal: "community_engagement",
    toneGuide: "Hopeful, evidence-aware, empowering. Never claim to cure — focus on supporting the body's intelligence.",
  },
  "Corporate Wellness Advocate": {
    icon: <BarChart2 className="h-4 w-4" />,
    color: "bg-sky-500/20 text-sky-700 border-sky-500/30",
    painPoints: [
      "High-performing but burning out",
      "Wants productivity without sacrificing health",
      "Leadership stress & decision fatigue",
      "Seeking ROI-framed wellness solutions",
    ],
    keyQuestions: [
      "How do top executives manage stress?",
      "What wellness practices improve cognitive performance?",
      "How do I build resilience as a leader?",
      "What is the ROI of mindfulness for executives?",
    ],
    contentHooks: [
      "The morning routine of high-performing executives",
      "How mindfulness became my competitive advantage",
      "The Lights On framework for peak executive performance",
      "Why the best CEOs prioritize stillness",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Urban Monk Retreat — $1,200",
      offer: "Executive wellness retreat",
      price: "$1,200",
      icon: <Calendar className="h-4 w-4" />,
    },
    platforms: ["linkedin", "x", "youtube"],
    contentGoal: "audience_growth",
    toneGuide: "Credentialed, results-oriented, peer-to-peer. Speak their language: performance, ROI, competitive edge.",
  },
  "Digital Detox Pursuer": {
    icon: <MessageCircle className="h-4 w-4" />,
    color: "bg-teal-500/20 text-teal-700 border-teal-500/30",
    painPoints: [
      "Screen addiction & dopamine dysregulation",
      "Anxiety from constant connectivity",
      "Wanting to reclaim attention & focus",
      "Feeling enslaved by technology",
    ],
    keyQuestions: [
      "How do I break my phone addiction?",
      "What is a digital detox and does it work?",
      "How do I reclaim my attention span?",
      "Can mindfulness help with social media anxiety?",
    ],
    contentHooks: [
      "I deleted social media for 30 days — here's what happened",
      "The attention economy is stealing your life force",
      "How to reclaim your mind from the algorithm",
      "The Urban Monk's guide to conscious technology use",
    ],
    primaryCTA: {
      label: "Lights On — lightson.theurbanmonk.com",
      offer: "Lights On energy & vitality program",
      price: "lightson.theurbanmonk.com",
      icon: <BookOpen className="h-4 w-4" />,
    },
    secondaryCTA: {
      label: "Focus & Clarity Supplement Stack",
      offer: "Nootropic & focus support",
      price: "$49–$79/month",
      icon: <ShoppingBag className="h-4 w-4" />,
    },
    platforms: ["instagram", "tiktok", "x"],
    contentGoal: "audience_growth",
    toneGuide: "Countercultural, provocative, liberating. Be the voice that calls people back to themselves.",
  },
};

const CONTENT_GOAL_LABELS: Record<string, { label: string; color: string; description: string }> = {
  audience_growth: {
    label: "Audience Growth",
    color: "bg-green-500/20 text-green-700 border-green-500/30",
    description: "Community building, reach, follower acquisition — The Holistic Psychologist model",
  },
  community_engagement: {
    label: "Community Engagement",
    color: "bg-blue-500/20 text-blue-700 border-blue-500/30",
    description: "Conversation, trust, relationship deepening — turning followers into fans",
  },
  llm_growth: {
    label: "LLM SEO",
    color: "bg-purple-500/20 text-purple-700 border-purple-500/30",
    description: "LLM search query optimization, citation building — supporting infrastructure",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────
export function PersonasView({ items }: { items: ContentItem[] }) {
  const [expandedPersona, setExpandedPersona] = useState<string | null>(null);
  const [activeGoalFilter, setActiveGoalFilter] = useState<string>("all");

  const { data: personas = [] } = trpc.personas.list.useQuery();

  const personaNames = personas.map((p: { name: string }) => p.name);

  return (
    <div className="space-y-6">
      {/* Strategy Header */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif font-bold text-foreground text-lg">Persona Intelligence Center</h2>
            <p className="text-sm text-muted-foreground mt-1">
              8 audience personas driving the Urban Monk content strategy. Primary approach: authentic community building
              (The Holistic Psychologist model). LLM SEO is supporting infrastructure, not the dominant voice.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(CONTENT_GOAL_LABELS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setActiveGoalFilter(activeGoalFilter === key ? "all" : key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-medium transition-all ${
                    activeGoalFilter === key
                      ? val.color + " ring-2 ring-offset-1 ring-current"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                >
                  {key === "audience_growth" && <TrendingUp className="h-3 w-3" />}
                  {key === "community_engagement" && <MessageCircle className="h-3 w-3" />}
                  {key === "llm_growth" && <Brain className="h-3 w-3" />}
                  {val.label}
                </button>
              ))}
              {activeGoalFilter !== "all" && (
                <button
                  onClick={() => setActiveGoalFilter("all")}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Priority Note */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(CONTENT_GOAL_LABELS).map(([key, val]) => {
          const count = Object.values(PERSONA_INTELLIGENCE).filter(p => p.contentGoal === key).length;
          return (
            <div key={key} className={`rounded-lg border p-3 ${val.color}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">{val.label}</span>
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className="text-[11px] mt-1 opacity-80">{val.description}</p>
              {key === "audience_growth" && (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
                  ★ PRIMARY STRATEGY
                </div>
              )}
              {key === "llm_growth" && (
                <div className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Supporting infrastructure
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Revenue Funnel Summary */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Three Revenue Funnels — All 8 Personas Feed Into These
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Lights On Program",
              price: "lightson.theurbanmonk.com",
              desc: "Energy & vitality — primary entry point for most personas",
              color: "bg-primary/10 border-primary/30",
              icon: <BookOpen className="h-4 w-4 text-primary" />,
            },
            {
              label: "Immersive Retreats",
              price: "$1,200",
              desc: "High-ticket upsell — Midlife Vitality, Spiritual Explorer, Corporate Wellness",
              color: "bg-amber-500/10 border-amber-500/30",
              icon: <Calendar className="h-4 w-4 text-amber-600" />,
            },
            {
              label: "Supplements",
              price: "$49–$99/mo",
              desc: "Recurring revenue — Burnout, Chronic Condition, Digital Detox, Stressed Parent",
              color: "bg-green-500/10 border-green-500/30",
              icon: <ShoppingBag className="h-4 w-4 text-green-600" />,
            },
          ].map((funnel) => (
            <div key={funnel.label} className={`rounded-lg border p-3 ${funnel.color}`}>
              <div className="flex items-center gap-2 mb-1">
                {funnel.icon}
                <span className="text-xs font-semibold text-foreground">{funnel.label}</span>
              </div>
              <div className="text-base font-bold text-foreground">{funnel.price}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{funnel.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Persona Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          8 Audience Personas
        </h3>

        {Object.entries(PERSONA_INTELLIGENCE)
          .filter(([, intel]) =>
            activeGoalFilter === "all" || intel.contentGoal === activeGoalFilter
          )
          .map(([name, intel]) => {
            const isExpanded = expandedPersona === name;
            const personaContentCount = items.filter(
              (item) => {
                const persona = personas.find((p: { id: number; name: string }) => p.name === name);
                return persona && (item as any).personaId === persona.id;
              }
            ).length;

            return (
              <Card key={name} className="bg-card border-border overflow-hidden">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedPersona(isExpanded ? null : name)}
                >
                  <CardHeader className="p-4 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${intel.color}`}>
                          {intel.icon}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border font-medium ${CONTENT_GOAL_LABELS[intel.contentGoal].color}`}>
                              {intel.contentGoal === "audience_growth" && <TrendingUp className="h-2.5 w-2.5" />}
                              {intel.contentGoal === "community_engagement" && <MessageCircle className="h-2.5 w-2.5" />}
                              {intel.contentGoal === "llm_growth" && <Brain className="h-2.5 w-2.5" />}
                              {CONTENT_GOAL_LABELS[intel.contentGoal].label}
                            </span>
                            {personaContentCount > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {personaContentCount} content item{personaContentCount !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-medium text-primary">{intel.primaryCTA.price}</div>
                          <div className="text-[10px] text-muted-foreground">primary offer</div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-border/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                      {/* Pain Points */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Pain Points
                        </h4>
                        <ul className="space-y-1">
                          {intel.painPoints.map((p) => (
                            <li key={p} className="text-xs text-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">•</span>
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Key Questions */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" /> Questions They're Asking
                        </h4>
                        <ul className="space-y-1">
                          {intel.keyQuestions.map((q) => (
                            <li key={q} className="text-xs text-foreground flex items-start gap-1.5">
                              <span className="text-primary mt-0.5">?</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Content Hooks */}
                      <div>
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" /> Proven Content Hooks
                        </h4>
                        <ul className="space-y-1">
                          {intel.contentHooks.map((h) => (
                            <li key={h} className="text-xs text-foreground flex items-start gap-1.5 p-1.5 rounded bg-muted/20">
                              <span className="text-primary mt-0.5">→</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* CTAs + Tone */}
                      <div className="space-y-3">
                        {/* Primary CTA */}
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                            Primary CTA
                          </div>
                          <div className="flex items-center gap-2">
                            {intel.primaryCTA.icon}
                            <div>
                              <div className="text-xs font-semibold text-foreground">{intel.primaryCTA.offer}</div>
                              <div className="text-xs text-primary font-bold">{intel.primaryCTA.price}</div>
                            </div>
                          </div>
                        </div>

                        {/* Secondary CTA */}
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Secondary CTA
                          </div>
                          <div className="flex items-center gap-2">
                            {intel.secondaryCTA.icon}
                            <div>
                              <div className="text-xs font-semibold text-foreground">{intel.secondaryCTA.offer}</div>
                              <div className="text-xs text-muted-foreground font-medium">{intel.secondaryCTA.price}</div>
                            </div>
                          </div>
                        </div>

                        {/* Tone Guide */}
                        <div className="rounded-lg border border-border bg-muted/10 p-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Tone Guide
                          </div>
                          <p className="text-xs text-foreground italic">"{intel.toneGuide}"</p>
                        </div>

                        {/* Best Platforms */}
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                            Best Platforms
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {intel.platforms.map((p) => (
                              <span key={p} className="px-2 py-0.5 rounded text-[10px] bg-muted/30 text-muted-foreground border border-border capitalize">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
      </div>
    </div>
  );
}
