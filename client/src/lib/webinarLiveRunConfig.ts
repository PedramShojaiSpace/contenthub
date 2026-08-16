export type WebinarDeckProfileKey = "upstream" | "sleep";

export type WebinarDeckProfile = {
  key: WebinarDeckProfileKey;
  name: string;
  eyebrow: string;
  purpose: string;
  baseDeck: string;
  assetStatus: "verified" | "reference_needed";
  assetNote: string;
  sourceDeck: {
    slideCount: number;
    format: string;
    managedAssetPath?: string;
  };
  visualSystem: string[];
  foundationSlides: string[];
  refreshZones: Array<{
    title: string;
    guidance: string;
  }>;
};

export type WebinarIntelligenceDigest = {
  responseCount: number;
  importCount: number;
  themes: string[];
  questions: string[];
  audienceLanguage: string[];
};

export type LiveRunBrief = {
  profile: WebinarDeckProfile;
  headline: string;
  principle: string;
  refreshPlan: Array<{
    title: string;
    guidance: string;
    source: string;
  }>;
  operatorChecklist: string[];
};

export type WebinarBasePreset = {
  topic: string;
  cta: string;
};

export const WEBINAR_DECK_PROFILES: Record<WebinarDeckProfileKey, WebinarDeckProfile> = {
  upstream: {
    key: "upstream",
    name: "Upstream Masterclass",
    eyebrow: "The root-cause discovery deck",
    purpose: "A discovery-led root-cause masterclass for people who have tried everything and still do not have a map.",
    baseDeck: "UPSTREAM — Reclaiming Your Biological Agency",
    assetStatus: "verified",
    assetNote: "Verified Manus presentation project · 37-slide Upstream masterclass",
    sourceDeck: { slideCount: 37, format: "Manus presentation project" },
    visualSystem: [
      "Deep forest field with restrained radial warmth",
      "Gold rules and accents used only to direct attention",
      "Playfair Display headlines paired with quiet Inter support copy",
      "One idea per slide, with spacious evidence and offer moments",
    ],
    foundationSlides: [
      "Opening recognition and the pattern",
      "The upstream systems map and core science",
      "How the platform, tests, and clinical map fit together",
      "Offer architecture, decision point, and Q&A close",
    ],
    refreshZones: [
      {
        title: "Opening recognition",
        guidance: "Tune the first question and short story to the language respondents are already using.",
      },
      {
        title: "Symptom mirror",
        guidance: "Choose only the two most resonant symptom or system slides; leave the rest of the scientific backbone intact.",
      },
      {
        title: "Audience questions",
        guidance: "Prepare a three-question Q&A bridge that answers the most repeated questions before the offer.",
      },
      {
        title: "Invitation",
        guidance: "Adjust the invitation language and one proof point, not the offer architecture or decision flow.",
      },
    ],
  },
  sleep: {
    key: "sleep",
    name: "Deep Sleep Masterclass",
    eyebrow: "The restorative-sleep discovery deck",
    purpose: "A 57-slide live medical-education webinar that moves from the 3 AM recognition moment through gut–vagus–autonomic systems teaching to the Sleep Assessment Bundle invitation.",
    baseDeck: "The Deep Sleep Solution",
    assetStatus: "verified",
    assetNote: "Verified source deck · 57 slides · 16:9 · midnight navy and warm ivory teaching system",
    sourceDeck: {
      slideCount: 57,
      format: "PowerPoint source deck",
      managedAssetPath: "/manus-storage/Deep_Sleep_Solution_Keynote_Backup_eb71bfb7.pptx",
    },
    visualSystem: [
      "Midnight navy recognition slides alternating with warm ivory teaching slides",
      "White or navy declarative headlines with compact warm-gold eyebrows and thin divider rules",
      "Sparse system diagrams for gut, vagus, and autonomic teaching moments",
      "Measured alternation between empathy, evidence, and invitation instead of one long clinical block",
    ],
    foundationSlides: [
      "3 AM recognition, audience motivations, and the sleep-anxiety loop",
      "Gut, vagus, and autonomic-state teaching arc",
      "Hormone context and the practical next-step map",
      "Sleep Assessment Bundle offer, QR/checkout moment, and Q&A close",
    ],
    refreshZones: [
      {
        title: "3 AM recognition",
        guidance: "Keep the time-based recognition structure and update only the opening line with the room’s actual sleep language.",
      },
      {
        title: "Audience motivation mirror",
        guidance: "Keep the two-audience frame and emphasize the one motivation most visible in the Typeform themes.",
      },
      {
        title: "Systems and questions bridge",
        guidance: "Keep the gut–vagus–autonomic science intact; prepare a short bridge for the repeated questions before the invitation.",
      },
      {
        title: "Sleep Assessment Bundle invitation",
        guidance: "Tune proof language and the Q&A bridge while preserving the offer sequence, QR/checkout mechanics, and decision flow.",
      },
    ],
  },
};

export function resolveWebinarDeckProfile(topic: string): WebinarDeckProfile {
  const normalized = topic.toLowerCase();
  return /sleep|insomnia|circadian|restorative/.test(normalized)
    ? WEBINAR_DECK_PROFILES.sleep
    : WEBINAR_DECK_PROFILES.upstream;
}

export function getWebinarBasePreset(profile: WebinarDeckProfileKey): WebinarBasePreset {
  return profile === "sleep"
    ? {
        topic: "Deep Sleep: Restore the Night, Reclaim the Day",
        cta: "Join the Deep Sleep program and begin your restorative-sleep protocol",
      }
    : {
        topic: "Upstream Health: How to Find and Fix Your Root Cause",
        cta: "Get the Upstream Bundle — $399 (test kit + course)",
      };
}

function uniqueItems(items: string[], limit: number) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

export function buildLiveRunBrief(topic: string, digest: WebinarIntelligenceDigest): LiveRunBrief {
  const profile = resolveWebinarDeckProfile(topic);
  const topTheme = digest.themes[0] ?? "the audience’s current recognition point";
  const topQuestion = digest.questions[0] ?? "the question people are most ready to ask";
  const topLanguage = digest.audienceLanguage[0] ?? "the exact language respondents use to describe the problem";

  return {
    profile,
    headline: `${profile.name}: repeat the deck, refresh the room.`,
    principle: "Keep the foundation deck stable. Use the latest Typeform intelligence to tailor only the moments that make the room feel seen.",
    refreshPlan: profile.refreshZones.map((zone, index) => ({
      title: zone.title,
      guidance: zone.guidance,
      source:
        index === 0
          ? `Lead with: ${topLanguage}`
          : index === 1
          ? `Emphasize: ${topTheme}`
          : index === 2
          ? `Prepare for: ${topQuestion}`
          : `Anchor in ${digest.responseCount || "the"} respondent${digest.responseCount === 1 ? "" : "s"}’ stated outcome.`,
    })),
    operatorChecklist: [
      `Confirm the Zoom link and the scheduled date/time for this run.`,
      `Review ${digest.importCount || "the available"} Typeform intelligence import${digest.importCount === 1 ? "" : "s"} (${digest.responseCount || 0} responses).`,
      "Refresh only the four marked zones; do not rebuild the base deck or change the core offer sequence.",
      "Keep the final Q&A open and use the prepared question bridge before the invitation.",
    ],
  };
}

export function makeIntelligenceDigest(records: Array<{
  responseCount?: number | null;
  extractedThemes?: string | null;
  extractedQuestions?: string | null;
  extractedLanguage?: string | null;
}>): WebinarIntelligenceDigest {
  const parseArray = (value?: string | null) => {
    if (!value) return [] as string[];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  };

  return {
    importCount: records.length,
    responseCount: records.reduce((sum, record) => sum + (record.responseCount ?? 0), 0),
    themes: uniqueItems(records.flatMap((record) => parseArray(record.extractedThemes)), 4),
    questions: uniqueItems(records.flatMap((record) => parseArray(record.extractedQuestions)), 3),
    audienceLanguage: uniqueItems(records.flatMap((record) => parseArray(record.extractedLanguage)), 3),
  };
}
