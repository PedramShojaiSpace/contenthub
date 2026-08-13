export type CopyReviewStatus = "present" | "consider";

export interface CopyPatternReview {
  name: string;
  status: CopyReviewStatus;
  detail: string;
}

function toPlainText(html: string): string {
  return html
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Review an email against the recurring patterns observed in the supplied
 * winning variants. This is coaching guidance, not a deliverability score or
 * a claim that any one pattern causes performance.
 */
export function reviewWinningCopyPatterns(html: string): CopyPatternReview[] {
  const text = toPlainText(html);
  const opening = text.slice(0, 550);
  const linkCount = (html.match(/<a\b/gi) || []).length;
  const firstLink = html.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  const firstLinkText = firstLink ? toPlainText(firstLink[1]) : "";
  const firstCtaPosition = firstLinkText ? text.indexOf(firstLinkText) : -1;
  const finalQuarter = text.slice(Math.floor(text.length * 0.72));

  const hasSpecificScene = /\b(dinner|meeting|meetings|call|calls|table|bed|morning|drive|office|kitchen|room|family|kids|work)\b/i.test(opening)
    && /\b(you|your|you're|you've)\b/i.test(opening);
  const hasReframe = /\b(not (?:a |an |because)|does(?:n't| not) mean|isn't .*?(?:problem|verdict)|it's .*?(?:signal|wiring|biology|pattern)|rather than)\b/i.test(text);
  const teachesBeforeAsk = firstCtaPosition >= 220;
  const hasFocusedCta = linkCount >= 1 && linkCount <= 3;
  const hasHumanClose = /\b(reply|tell me|write back|let me know|hit reply)\b/i.test(finalQuarter);

  return [
    {
      name: "Specific lived-experience opening",
      status: hasSpecificScene ? "present" : "consider",
      detail: hasSpecificScene
        ? "The opening anchors the topic in a recognizable moment, a recurring pattern in the winning examples."
        : "Consider opening with a concrete moment the reader recognizes before naming the health topic.",
    },
    {
      name: "Shame-releasing reframe",
      status: hasReframe ? "present" : "consider",
      detail: hasReframe
        ? "The draft reframes the problem without blaming the reader."
        : "Consider a gentle reframe: what feels like a character flaw may have an understandable mechanism or pattern.",
    },
    {
      name: "Teach before the ask",
      status: teachesBeforeAsk ? "present" : "consider",
      detail: teachesBeforeAsk
        ? "The first call to action follows useful context rather than appearing immediately."
        : "Consider giving the reader more context, explanation, or empathy before the first call to action.",
    },
    {
      name: "Focused next step",
      status: hasFocusedCta ? "present" : "consider",
      detail: hasFocusedCta
        ? "The email keeps the reader’s action set focused."
        : "Use one primary action and, at most, a small supporting action so the reader knows what to do next.",
    },
    {
      name: "Human invitation to reply",
      status: hasHumanClose ? "present" : "consider",
      detail: hasHumanClose
        ? "The close creates a low-pressure continuation of the conversation without a second sales pitch."
        : "Consider a brief invitation to reply or share a reaction, rather than adding a P.S. sales pitch.",
    },
  ];
}
