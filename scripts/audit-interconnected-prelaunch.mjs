import fs from "node:fs/promises";

const apiKey = process.env.KLAVIYO_PRIVATE_KEY;
if (!apiKey) throw new Error("KLAVIYO_PRIVATE_KEY is required");

const FLOW_ID = "YyFZPu";
const headers = {
  Authorization: `Klaviyo-API-Key ${apiKey}`,
  accept: "application/vnd.api+json",
  revision: "2026-07-15",
};

async function get(path) {
  const response = await fetch(`https://a.klaviyo.com/api${path}`, { headers });
  const body = await response.json();
  if (!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${JSON.stringify(body)}`);
  return body;
}

function cleanText(value = "") {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function hrefs(html = "") {
  return [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(match => match[1]);
}

function findFooterIssues(html = "") {
  const unsubscribeAt = html.search(/\{%\s*unsubscribe\s*%\}|unsubscribe_link/i);
  const addressAt = html.search(/organization\.full_address/i);
  // The approved footer pattern places the address immediately above the unsubscribe token.
  // Treat it as a body-level address only when it is materially separated from that footer token.
  const addressBeforeFooter = addressAt >= 0 && (unsubscribeAt < 0 || unsubscribeAt - addressAt > 500);
  return {
    hasUnsubscribe: unsubscribeAt >= 0,
    hasAddress: addressAt >= 0,
    addressBeforeFooter,
  };
}

function linkFindings(links, addTrackingParams) {
  const external = links.filter(link => /^https?:\/\//i.test(link));
  const malformed = external.filter(link => /\s/.test(link) || !/^https?:\/\/[^\s]+$/i.test(link));
  const noUtm = external.filter(link => !/utm_(source|medium|campaign)=/i.test(link));
  const brokenPlaceholders = external.filter(link => /example\.com|YOUR_|TODO|undefined|null/i.test(link));
  return {
    total: external.length,
    malformed,
    noUtm: addTrackingParams ? [] : noUtm,
    automaticallyTracked: Boolean(addTrackingParams),
    brokenPlaceholders,
  };
}

function contentSignals(html = "", text = "") {
  const content = `${cleanText(text)} ${cleanText(html)}`.toLowerCase();
  const signals = {
    timeSensitiveUrgency: /\b(tonight|tomorrow|midnight|final chance|last chance|ends today|ends tomorrow)\b/i.test(content),
    legacyDiscountLanguage: /\b(50% off|package discount|upstream package|upstream bundle)\b/i.test(content),
    episodeCountLanguage: /\b(10-day|10 day|episode 10|bonus episode 10)\b/i.test(content),
    regulatedClaimReview: /\b(cancer|diabetes|obesity|thyroid|anxiety|depression|ptsd|prevent(?:ed|ion)?|revers(?:e|ed|ing)|cure|heal(?:ed|ing)?|treat(?:ment|ing)?)\b/i.test(content),
  };
  return {
    ...signals,
    flags: Object.entries(signals).filter(([, value]) => value).map(([key]) => key),
  };
}

const flow = (await get(`/flows/${FLOW_ID}?additional-fields%5Bflow%5D=definition`)).data;
const emailActions = (flow.attributes.definition.actions ?? []).filter(action => action.type === "send-email");
const emailRows = [];

for (const action of emailActions) {
  const messages = (await get(`/flow-actions/${action.id}/flow-messages`)).data ?? [];
  const message = messages[0];
  if (!message) continue;
  const template = (await get(`/flow-messages/${message.id}/template`)).data;
  const actionMessage = action.data?.message ?? {};
  const footer = findFooterIssues(template.attributes.html ?? "");
  const links = linkFindings(hrefs(template.attributes.html ?? ""), actionMessage.add_tracking_params);
  const content = contentSignals(template.attributes.html ?? "", template.attributes.text ?? "");

  const concerns = [];
  if (!footer.hasUnsubscribe) concerns.push("Missing unsubscribe token/link in HTML");
  if (!footer.hasAddress) concerns.push("Missing organization address in HTML");
  if (footer.addressBeforeFooter) concerns.push("Organization address appears before footer/unsubscribe handling");
  if (links.malformed.length) concerns.push(`Malformed external link(s): ${links.malformed.join(", ")}`);
  if (links.brokenPlaceholders.length) concerns.push(`Placeholder/broken-looking link(s): ${links.brokenPlaceholders.join(", ")}`);
  if (!actionMessage.from_email) concerns.push("Missing sender email");
  if (!actionMessage.from_label) concerns.push("Missing sender name");
  if (!actionMessage.subject_line) concerns.push("Missing subject line");
  if (action.data?.status !== "draft" && action.data?.status !== "live" && action.data?.status !== "manual") concerns.push(`Unexpected action status: ${action.data?.status ?? "unknown"}`);

  emailRows.push({
    actionId: action.id,
    messageId: message.id,
    messageName: actionMessage.name ?? template.attributes.name ?? "Untitled email",
    status: action.data?.status ?? "unknown",
    subject: actionMessage.subject_line ?? "",
    previewText: actionMessage.preview_text ?? "",
    fromName: actionMessage.from_label ?? "",
    fromEmail: actionMessage.from_email ?? "",
    replyTo: actionMessage.reply_to_email ?? "",
    smartSending: Boolean(actionMessage.smart_sending_enabled),
    addTrackingParams: Boolean(actionMessage.add_tracking_params),
    templateId: template.id,
    editorType: template.attributes.editor_type ?? "unknown",
    footer,
    links,
    content,
    concerns,
    textExcerpt: cleanText(template.attributes.text || template.attributes.html).slice(0, 420),
  });
}

const summary = {
  flowId: FLOW_ID,
  flowName: flow.attributes.name,
  flowStatus: flow.attributes.status,
  emailCount: emailRows.length,
  statusCounts: Object.groupBy(emailRows, row => row.status),
  withConcerns: emailRows.filter(row => row.concerns.length).length,
  missingFooterCompliance: emailRows.filter(row => !row.footer.hasUnsubscribe || !row.footer.hasAddress || row.footer.addressBeforeFooter).length,
  malformedLinkMessages: emailRows.filter(row => row.links.malformed.length || row.links.brokenPlaceholders.length).length,
  untrackedExternalLinkMessages: emailRows.filter(row => row.links.noUtm.length).length,
  timeSensitiveUrgencyMessages: emailRows.filter(row => row.content.timeSensitiveUrgency).length,
  legacyDiscountLanguageMessages: emailRows.filter(row => row.content.legacyDiscountLanguage).length,
  episodeCountReviewMessages: emailRows.filter(row => row.content.episodeCountLanguage).length,
  regulatedClaimReviewMessages: emailRows.filter(row => row.content.regulatedClaimReview).length,
  blankPreviewTextMessages: emailRows.filter(row => !row.previewText.trim()).length,
  smartSendingDisabledMessages: emailRows.filter(row => !row.smartSending).length,
  senderConfigurationVariants: new Set(emailRows.map(row => `${row.fromName} <${row.fromEmail}> / ${row.replyTo}`)).size,
};

const report = { generatedAt: new Date().toISOString(), summary, emails: emailRows };
await fs.mkdir("docs", { recursive: true });
await fs.writeFile("docs/interconnected-prelaunch-audit.json", `${JSON.stringify(report, null, 2)}\n`);

const rows = emailRows.map(row => {
  const reviewFlags = [
    ...row.concerns,
    ...row.content.flags,
    row.links.noUtm.length ? "external-link-without-explicit-UTM" : "",
  ].filter(Boolean).join("; ") || "none";
  return `| ${row.messageName.replaceAll("|", "\\|")} | ${row.status} | ${row.subject.replaceAll("|", "\\|")} | ${row.footer.hasAddress ? "Yes" : "No"} | ${row.footer.hasUnsubscribe ? "Yes" : "No"} | ${row.links.automaticallyTracked ? "Auto" : row.links.noUtm.length ? "Review" : "No external links"} | ${reviewFlags.replaceAll("|", "\\|")} |`;
});
const auditMarkdown = `# Interconnected Pre-Launch Audit\n\nGenerated: ${report.generatedAt}\n\n## Scope\n\nThe audit reviewed ${summary.emailCount} email actions in \`${summary.flowName}\` (flow status: **${summary.flowStatus}**) without changing any Klaviyo content, status, or trigger.\n\n## Summary\n\n| Check | Result |\n|---|---:|\n| Email actions reviewed | ${summary.emailCount} |\n| Live messages | ${(summary.statusCounts.live ?? []).length} |\n| Draft messages | ${(summary.statusCounts.draft ?? []).length} |\n| Messages missing address token in HTML | ${summary.missingFooterCompliance} |\n| Messages with malformed/placeholder links | ${summary.malformedLinkMessages} |\n| Messages needing explicit UTM review | ${summary.untrackedExternalLinkMessages} |\n| Messages with time-sensitive urgency | ${summary.timeSensitiveUrgencyMessages} |\n| Messages with legacy discount language | ${summary.legacyDiscountLanguageMessages} |\n| Messages with health-claim review flags | ${summary.regulatedClaimReviewMessages} |\n\n## Message-by-Message Review\n\n| Message | Status | Subject | Address | Unsubscribe | Tracking | Review flags |\n|---|---|---|---|---|---|---|\n${rows.join("\n")}\n\n## Interpretation\n\nThe address/footer findings are structural. The urgency, legacy-offer, episode-count, and health-claim entries are **human review prompts**, not automatic compliance determinations. They identify copy that should be checked against the actual offer timing, episode count, and approved claim language before the flow is activated.\n`;
await fs.writeFile("docs/interconnected-prelaunch-audit.md", auditMarkdown);

console.log(JSON.stringify(summary, null, 2));
