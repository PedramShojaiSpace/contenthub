export type TantraContentAd = {
  id: string;
  label: "A" | "B" | "C";
  adName: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: "LEARN_MORE";
  destinationUrl: string;
};

export type TantraContentAdVariant = {
  slug: string;
  title: string;
  pageTitle: string;
  imageUrl: string;
  destinationBaseUrl: string;
  ads: TantraContentAd[];
};

const DESTINATION_BASE = "https://content.theurbanmonk.com/tantra";
const CAMPAIGN = "tantra_content_education";

function trackedUrl(slug: string, label: "A" | "B" | "C") {
  return `${DESTINATION_BASE}/${slug}?utm_source=meta&utm_medium=paid_social&utm_campaign=${CAMPAIGN}&utm_content=${slug}_${label.toLowerCase()}`;
}

function ad(
  slug: string,
  label: "A" | "B" | "C",
  headline: string,
  primaryText: string,
  description: string
): TantraContentAd {
  return {
    id: `${slug}-${label.toLowerCase()}`,
    label,
    adName: `DRAFT — Content — ${slug} — ${label}`,
    headline,
    primaryText,
    description,
    cta: "LEARN_MORE",
    destinationUrl: trackedUrl(slug, label),
  };
}

export const TANTRA_CONTENT_AD_VARIANTS: TantraContentAdVariant[] = [
  {
    slug: "considering-divorce",
    title: "Considering Divorce?",
    pageTitle: "Considering Divorce? Read This First",
    imageUrl: "/manus-storage/tantra_card_divorce_c8e88f45.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/considering-divorce`,
    ads: [
      ad("considering-divorce", "A", "Before a Big Relationship Decision", "Some relationships enter a hard season when pressure, fatigue, and disconnection stack up. This short educational film explores what can be rebuilt before a difficult season becomes a final decision.", "A short Urban Monk relationship-education film."),
      ad("considering-divorce", "B", "The Distance Didn’t Arrive All at Once", "Distance in a relationship is rarely one event. It is often the accumulation of stress, missed conversations, and years of putting connection last. There can still be a path back to the relationship worth protecting.", "A practical conversation about connection and repair."),
      ad("considering-divorce", "C", "A Conversation Worth Having First", "Before making a major relationship decision, it can help to understand the pressures that quietly erode closeness—and the practices couples use to rebuild a shared sense of safety and warmth.", "Watch the free educational film."),
    ],
  },
  {
    slug: "king-and-queen",
    title: "The King and the Queen",
    pageTitle: "The King and the Queen",
    imageUrl: "/manus-storage/tantra_card_king_queen_0577b598.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/king-and-queen`,
    ads: [
      ad("king-and-queen", "A", "The Atmosphere of a Home Is Built", "Every home has an emotional atmosphere. The relationships at its center shape how stress is carried, how conflict is repaired, and how much warmth is available when life gets demanding.", "A short Urban Monk film on relationship leadership."),
      ad("king-and-queen", "B", "Connection Is a Daily Practice", "A strong partnership is not built by avoiding every hard moment. It is built through the small rituals of attention, respect, and repair that help two people come back to one another.", "Explore the King and Queen framework."),
      ad("king-and-queen", "C", "What Holds a Family Together", "The Taoist tradition offers a simple observation: the relationship at the center of a home sets the field for everyone inside it. This film explores how couples can consciously tend that field.", "Watch the free educational film."),
    ],
  },
  {
    slug: "sex-is-the-flower",
    title: "Sex Is the Flower",
    pageTitle: "Sex Is the Flower",
    imageUrl: "/manus-storage/tantra_card_flower_35c224e6.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/sex-is-the-flower`,
    ads: [
      ad("sex-is-the-flower", "A", "Intimacy Is a Barometer, Not the Whole Story", "Closeness is often the flower of many systems working together: health, energy, communication, time, tenderness, and the willingness to meet in the middle. This film explores the full picture.", "A relationship-education film from The Urban Monk."),
      ad("sex-is-the-flower", "B", "A More Complete View of Connection", "The usual conversation about intimacy is too narrow. Couples can support connection by caring for the body, the nervous system, the relationship, and the small moments that make desire feel safe again.", "Watch the free educational film."),
      ad("sex-is-the-flower", "C", "Start at the Root, Not the Symptom", "When closeness changes, the answer is rarely one quick fix. A better question is: what would help two people feel more present, more energized, and more available to each other?", "Explore a whole-person approach to connection."),
    ],
  },
  {
    slug: "why-he-stopped",
    title: "Why He Stopped Wanting To",
    pageTitle: "Why He Stopped Wanting To",
    imageUrl: "/manus-storage/tantra_card_why_he_dd95c5cb.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/why-he-stopped`,
    ads: [
      ad("why-he-stopped", "A", "When Desire Changes, the Conversation Can Change Too", "Stress, sleep, health, work, and relationship patterns can all influence a man’s experience of desire. This short film offers a more useful conversation than blame, shame, or resignation.", "A practical Urban Monk conversation about connection."),
      ad("why-he-stopped", "B", "The Missing Layer in the Desire Conversation", "Many conversations stop at a single explanation. A more complete view looks at the body, the nervous system, the relationship, and the daily pressures that can make connection feel out of reach.", "Watch the free educational film."),
      ad("why-he-stopped", "C", "A Path Back to Presence", "Connection often improves when a couple has language for what is happening and a practical way to come back to one another. This film explores the first steps of that conversation.", "Learn more from The Urban Monk."),
    ],
  },
  {
    slug: "love-bank",
    title: "The Love Bank",
    pageTitle: "The Love Bank",
    imageUrl: "/manus-storage/tantra_card_love_bank_946bb051.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/love-bank`,
    ads: [
      ad("love-bank", "A", "The Love Bank: Why Small Moments Matter", "A relationship carries difficult seasons more gracefully when it has a reserve of warmth, play, affection, and goodwill. This film explores how couples build that reserve before life gets hard.", "A short Urban Monk film on relationship resilience."),
      ad("love-bank", "B", "Build the Reserve Before the Rough Patch", "Life brings deadlines, parenting, health concerns, and hard conversations. The couples who weather them best often share one thing: they keep investing in connection while things are still good.", "Watch the free educational film."),
      ad("love-bank", "C", "The Practice of a Longer Fuse", "Warmth is not sentimental. It is practical. Small moments of attention and closeness can create more patience, more generosity, and more room to repair when a rough day arrives.", "Explore the Love Bank framework."),
    ],
  },
  {
    slug: "why-she-stopped",
    title: "Why She Stopped Wanting To",
    pageTitle: "Why She Stopped Wanting To",
    imageUrl: "/manus-storage/tantra_card_why_she_b5328ed5.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/why-she-stopped`,
    ads: [
      ad("why-she-stopped", "A", "The Conversation Behind Changing Desire", "Changing desire can reflect a complicated mix of life stage, health, stress, relationship dynamics, and the invisible labor many women carry. This film makes space for a more compassionate conversation.", "A relationship-education film from The Urban Monk."),
      ad("why-she-stopped", "B", "Life Pressure Has a Relationship Cost", "Work, caregiving, parenting, changing hormones, sleep, and chronic stress can all affect how available a person feels for connection. A couple can learn to name the pressure—and respond together.", "Watch the free educational film."),
      ad("why-she-stopped", "C", "A More Complete Map of Intimacy", "Intimacy thrives when pleasure, communication, safety, time, and mutual attention are part of the conversation. This film explores practical ways couples can begin returning to those foundations.", "Explore the Urban Monk relationship framework."),
    ],
  },
  {
    slug: "female-orgasm",
    title: "The Female Orgasm",
    pageTitle: "The Female Orgasm: The Missing Ingredient in Western Sexuality",
    imageUrl: "/manus-storage/tantra_card_female_orgasm_3cadbc10.jpg",
    destinationBaseUrl: `${DESTINATION_BASE}/female-orgasm`,
    ads: [
      ad("female-orgasm", "A", "The Missing Conversation in Western Intimacy", "Western culture often teaches people to rush through intimacy without giving enough language to pleasure, attention, communication, and mutual presence. This educational film opens a more complete conversation.", "A free Urban Monk relationship-education film."),
      ad("female-orgasm", "B", "A Relationship Skill Worth Learning", "Tantric traditions treat sensual attention and mutual presence as learnable relationship skills. This film explores why those skills matter for connection, trust, and a more alive partnership.", "Watch the free educational film."),
      ad("female-orgasm", "C", "Sensuality, Communication, and Connection", "Many couples have never been given practical language for what creates safety, pleasure, and genuine connection. This film offers a respectful starting point for learning together.", "Explore a more complete intimacy conversation."),
    ],
  },
];

export const TANTRA_CONTENT_AD_TOTAL = TANTRA_CONTENT_AD_VARIANTS.reduce((total, variant) => total + variant.ads.length, 0);
