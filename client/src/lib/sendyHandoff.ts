export interface SendyCampaignHandoffInput {
  title: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  audience: string;
  html: string;
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

export function buildSendyCampaignBrief(input: SendyCampaignHandoffInput): string {
  const plainText = htmlToPlainText(input.html);
  return [
    "SENDY CAMPAIGN HANDOFF — MANUAL DRAFT ONLY",
    "",
    `Campaign title: ${input.title || "[Enter campaign title in Sendy]"}`,
    `Subject line: ${input.subject || "[Enter subject line in Sendy]"}`,
    `From name: ${input.fromName || "[Use approved Sendy sender]"}`,
    `From email: ${input.fromEmail || "[Use approved verified sender]"}`,
    `Reply-to: ${input.replyTo || "[Use approved reply-to address]"}`,
    `Audience: ${input.audience || "[Select the approved Sendy list or segment]"}`,
    "",
    "SENDY BUILD CHECKLIST",
    "1. Create a campaign draft in Sendy; do not send from this handoff.",
    "2. Confirm the approved list or segment, exclusions, and sender identity.",
    "3. Paste the HTML version below and paste the plain-text version into Sendy’s plain-text field.",
    "4. Keep Sendy unsubscribe and preference handling enabled; do not remove it from the final campaign.",
    "5. Review all links, personalize fields, preview desktop and mobile, and send a test from Sendy before any campaign is scheduled or sent.",
    "6. Confirm Sendy/Amazon SES domain authentication, bounce, complaint, and suppression handling are already configured in Sendy before delivery.",
    "",
    "PLAIN-TEXT VERSION",
    plainText || "[Paste optimized HTML above to generate a plain-text companion.]",
    "",
    "HTML VERSION",
    input.html || "[Paste optimized HTML above to include the HTML version.]",
  ].join("\n");
}

export function buildSendyFilename(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${normalized || "sendy-campaign"}-handoff.txt`;
}
