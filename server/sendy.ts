import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

export interface SendyBrand {
  id: string;
  name: string;
}

export interface SendyList {
  id: string;
  name: string;
}

export interface SendyDraftInput {
  brandId: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  title: string;
  subject: string;
  plainText: string;
  html: string;
  trackOpens: boolean;
  trackClicks: boolean;
}

function sendyBaseUrl(): string {
  if (!ENV.sendyBaseUrl || !ENV.sendyApiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sendy is not configured for this project." });
  }

  let url: URL;
  try {
    url = new URL(ENV.sendyBaseUrl);
  } catch {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The configured Sendy base URL is invalid." });
  }
  if (url.protocol !== "https:") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The Sendy installation must use HTTPS." });
  }
  return url.toString().replace(/\/$/, "");
}

function sendyEndpoint(pathname: string): string {
  return new URL(pathname, `${sendyBaseUrl()}/`).toString();
}

async function sendyPost(pathname: string, values: Record<string, string>): Promise<string> {
  const response = await fetch(sendyEndpoint(pathname), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ api_key: ENV.sendyApiKey, ...values }).toString(),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new TRPCError({
      code: response.status === 401 || response.status === 403 ? "FORBIDDEN" : "BAD_GATEWAY",
      message: `Sendy request failed (${response.status}): ${body.slice(0, 300) || "No response body"}`,
    });
  }
  if (/^(error:|invalid api key|api key not passed|no data passed)/i.test(body.trim())) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Sendy request failed: ${body.slice(0, 300)}` });
  }
  return body;
}

function normalizeCollection(body: string): Array<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "Sendy returned an unreadable list response." });
  }
  if (Array.isArray(parsed)) return parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    for (const value of [record.data, record.brands, record.lists]) {
      if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
    }
    const keyedRecords = Object.values(record).filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value));
    if (keyedRecords.length) return keyedRecords;
    return Object.entries(record)
      .filter(([, value]) => typeof value === "string")
      .map(([id, name]) => ({ id, name }));
  }
  return [];
}

function normalizeNamedCollection(body: string): SendyBrand[] {
  return normalizeCollection(body)
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "",
      name: typeof item.name === "string" ? item.name : typeof item.title === "string" ? item.title : "",
    }))
    .filter((item) => item.id && item.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSendyBrands(): Promise<SendyBrand[]> {
  return normalizeNamedCollection(await sendyPost("/api/brands/get-brands.php", {}));
}

export async function listSendyLists(brandId: string): Promise<SendyList[]> {
  const body = await sendyPost("/api/lists/get-lists.php", { brand_id: brandId, include_hidden: "no" });
  if (/^no lists found$/i.test(body.trim())) return [];
  return normalizeNamedCollection(body);
}

export function buildSendyDraftPayload(input: SendyDraftInput): Record<string, string> {
  return {
    from_name: input.fromName,
    from_email: input.fromEmail,
    reply_to: input.replyTo,
    title: input.title,
    subject: input.subject,
    plain_text: input.plainText,
    html_text: input.html,
    brand_id: input.brandId,
    track_opens: input.trackOpens ? "1" : "0",
    track_clicks: input.trackClicks ? "1" : "0",
    // Sendy's documented default is 0. Keep it explicit so this code path can never send or schedule.
    send_campaign: "0",
  };
}

export async function createSendyDraft(input: SendyDraftInput): Promise<{ message: string }> {
  const body = await sendyPost("/api/campaigns/create.php", buildSendyDraftPayload(input));
  if (!/^campaign created\.?$/i.test(body.trim())) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: `Sendy did not confirm draft creation: ${body.slice(0, 300)}` });
  }
  return { message: "Draft created in Sendy. Review the audience, exclusions, sender, previews, and test email in Sendy before any scheduling or send." };
}
