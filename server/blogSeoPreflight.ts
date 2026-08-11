export interface BlogSeoAudit {
  keywordOccurrences: number;
  keywordInFirstTwoSentences: boolean;
  keywordInSubheading: boolean;
  seoTitleStartsWithKeyword: boolean;
  seoTitleLength: number;
  metaDescriptionLength: number;
  hasCapitalizationIssue: boolean;
  issues: string[];
}

function escapedRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const headings = [...input.article.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => match[1].toLowerCase());
  const keywordOccurrences = keyword ? (article.match(keywordRegex) ?? []).length : 0;
  const keywordInFirstTwoSentences = !!keyword && opening.includes(keyword);
  const keywordInSubheading = !!keyword && headings.some((heading) => heading.includes(keyword));
  const seoTitleStartsWithKeyword = !!keyword && input.seoTitle.trim().toLowerCase().startsWith(keyword);
  const seoTitleLength = input.seoTitle.trim().length;
  const metaDescriptionLength = input.metaDescription.trim().length;
  const firstVisibleCharacter = input.article.trim().match(/[A-Za-z]/)?.[0] ?? "";
  const hasCapitalizationIssue = input.seoTitle.trim() !== toHeadlineCase(input.seoTitle)
    || headings.some((heading) => /^[a-z]/.test(heading))
    || (firstVisibleCharacter !== "" && firstVisibleCharacter !== firstVisibleCharacter.toUpperCase());
  const issues: string[] = [];

  if (!keywordInFirstTwoSentences) issues.push("Focus keyword is missing from the first two sentences.");
  if (keywordOccurrences < 8) issues.push(`Focus keyword appears ${keywordOccurrences} times; require at least 8 natural mentions.`);
  if (!keywordInSubheading) issues.push("Focus keyword is missing from an H2 or H3 subheading.");
  if (!seoTitleStartsWithKeyword) issues.push("SEO title must start with the focus keyword.");
  if (seoTitleLength === 0 || seoTitleLength > 48) issues.push("SEO title must be 1–48 characters.");
  if (metaDescriptionLength < 140 || metaDescriptionLength > 150) issues.push("Meta description must be 140–150 characters.");
  if (hasCapitalizationIssue) issues.push("SEO title, headings, and opening sentence must use normal capitalization.");

  return {
    keywordOccurrences,
    keywordInFirstTwoSentences,
    keywordInSubheading,
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
    `Use the exact focus keyword “${focusKeyword}” naturally in the first or second sentence, in at least one H2/H3, and 8–12 times in total.`,
    "Use normal headline capitalization for headings and sentences; never begin a sentence or heading with a lowercase letter.",
    "Preserve the existing article structure, internal links, outbound links, FAQ, and approximate length.",
    audit.issues.length ? `Repair these detected gaps: ${audit.issues.join(" ")}` : "Make no unnecessary changes.",
  ].join("\n");
}
