export interface BlogSeoAudit {
  keywordOccurrences: number;
  keywordInFirstTwoSentences: boolean;
  keywordInSubheading: boolean;
  keywordSubheadingCount: number;
  transitionWordRate: number;
  seoTitleStartsWithKeyword: boolean;
  seoTitleLength: number;
  metaDescriptionLength: number;
  hasCapitalizationIssue: boolean;
  issues: string[];
}

function escapedRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const TRANSITION_WORDS = [
  "however", "therefore", "as a result", "in addition", "furthermore", "meanwhile", "for example", "in contrast", "consequently", "first", "second", "third", "finally", "in fact", "specifically", "most importantly", "in other words", "that said", "even so", "because of this", "at the same time", "to be clear", "in practice", "over time", "in short", "additionally", "moreover", "notably", "instead", "still", "yet", "thus", "hence", "indeed", "otherwise", "likewise", "similarly", "afterward", "previously", "ultimately", "essentially", "particularly", "importantly", "fortunately", "unfortunately", "surprisingly", "although", "because", "since", "while", "when", "after", "before", "once", "unless", "until", "despite", "rather than", "not only", "as long as", "as soon as",
];

function calculateTransitionWordRate(article: string) {
  const prose = article
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "")
    .replace(/[*_`>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = prose.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length >= 20);
  if (!sentences.length) return 0;
  const marker = new RegExp(`\\b(?:${TRANSITION_WORDS.map(escapedRegex).join("|")})\\b`, "i");
  return (sentences.filter((sentence) => marker.test(sentence)).length / sentences.length) * 100;
}

export function toHeadlineCase(value: string) {
  const minorWords = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on", "or", "per", "the", "to", "vs", "via"]);
  return value
    .trim()
    .toLowerCase()
    .split(/(\s+)/)
    .map((token, index, all) => {
      if (/^\s+$/.test(token)) return token;
      const wordIndex = all.slice(0, index + 1).filter((part) => !/^\s+$/.test(part)).length;
      const totalWords = all.filter((part) => !/^\s+$/.test(part)).length;
      if (wordIndex !== 1 && wordIndex !== totalWords && minorWords.has(token)) return token;
      return token.replace(/^\w/, (letter) => letter.toUpperCase());
    })
    .join("");
}

export function auditBlogSeo(input: {
  article: string;
  focusKeyword: string;
  seoTitle: string;
  metaDescription: string;
}): BlogSeoAudit {
  const keyword = input.focusKeyword.trim().toLowerCase();
  const article = input.article.toLowerCase();
  const keywordRegex = new RegExp(escapedRegex(keyword), "g");
  const opening = input.article.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").toLowerCase();
  const rawHeadings = [...input.article.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].trim());
  const headings = rawHeadings.map((heading) => heading.toLowerCase());
  const keywordOccurrences = keyword ? (article.match(keywordRegex) ?? []).length : 0;
  const keywordInFirstTwoSentences = !!keyword && opening.includes(keyword);
  const keywordSubheadingCount = keyword ? headings.filter((heading) => heading.includes(keyword)).length : 0;
  const keywordInSubheading = keywordSubheadingCount > 0;
  const transitionWordRate = calculateTransitionWordRate(input.article);
  const seoTitleStartsWithKeyword = !!keyword && input.seoTitle.trim().toLowerCase().startsWith(keyword);
  const seoTitleLength = input.seoTitle.trim().length;
  const metaDescriptionLength = input.metaDescription.trim().length;
  const firstVisibleCharacter = input.article.trim().match(/[A-Za-z]/)?.[0] ?? "";
  const hasCapitalizationIssue = input.seoTitle.trim() !== toHeadlineCase(input.seoTitle)
    || rawHeadings.some((heading) => /^[a-z]/.test(heading))
    || (firstVisibleCharacter !== "" && firstVisibleCharacter !== firstVisibleCharacter.toUpperCase());
  const issues: string[] = [];

  if (!keywordInFirstTwoSentences) issues.push("Focus keyword is missing from the first two sentences.");
  if (keywordOccurrences < 8) issues.push(`Focus keyword appears ${keywordOccurrences} times; require at least 8 natural mentions.`);
  if (keywordSubheadingCount < 2) issues.push(`Focus keyword appears in ${keywordSubheadingCount} H2/H3 subheading(s); require at least 2.`);
  if (!seoTitleStartsWithKeyword) issues.push("SEO title must start with the focus keyword.");
  if (seoTitleLength === 0 || seoTitleLength > 48) issues.push("SEO title must be 1–48 characters.");
  if (metaDescriptionLength < 120 || metaDescriptionLength > 135) issues.push("Meta description must be 120–135 characters for safe Yoast snippet display.");
  if (transitionWordRate < 32) issues.push(`Transition-word coverage is ${transitionWordRate.toFixed(1)}%; require at least 32%.`);
  if (hasCapitalizationIssue) issues.push("SEO title, headings, and opening sentence must use normal capitalization.");

  return {
    keywordOccurrences,
    keywordInFirstTwoSentences,
    keywordInSubheading,
    keywordSubheadingCount,
    transitionWordRate,
    seoTitleStartsWithKeyword,
    seoTitleLength,
    metaDescriptionLength,
    hasCapitalizationIssue,
    issues,
  };
}

export function buildSeoRepairInstructions(audit: BlogSeoAudit, focusKeyword: string) {
  return [
    "Return only a revised Markdown article. Preserve every existing valid URL and the article’s substantive claims; do not add unverified citations, statistics, or medical promises.",
    `Use the exact focus keyword “${focusKeyword}” naturally in the first or second sentence, in at least two H2/H3 headings, and 8–12 times in total.`,
    "Use transition words or phrases in at least 32% of prose sentences, while keeping the writing natural and avoiding repetitive sentence openings.",
    "Use normal headline capitalization for headings and sentences; never begin a sentence or heading with a lowercase letter.",
    "Preserve the existing article structure, internal links, outbound links, FAQ, and approximate length.",
    audit.issues.length ? `Repair these detected gaps: ${audit.issues.join(" ")}` : "Make no unnecessary changes.",
  ].join("\n");
}
