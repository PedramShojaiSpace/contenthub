/**
 * Substack Publisher
 *
 * Uses Substack's unofficial internal API (the same endpoints the web app uses)
 * authenticated via email/password session cookie.
 *
 * Auth flow:
 *   POST https://substack.com/api/v1/email-login  →  sets "substack.sid" cookie
 *   POST https://{pub}.substack.com/api/v1/drafts  →  creates a draft
 *   POST https://{pub}.substack.com/api/v1/posts/{id}/publish  →  publishes it
 *
 * The session cookie is cached in memory for the lifetime of the server process
 * and refreshed on 401 responses.
 */

import { ENV } from "./_core/env";

interface SubstackSession {
  cookie: string;
  expiresAt: number; // unix ms
}

let cachedSession: SubstackSession | null = null;

async function getSession(): Promise<string> {
  const now = Date.now();
  if (cachedSession && cachedSession.expiresAt > now + 60_000) {
    return cachedSession.cookie;
  }

  const email = ENV.substackEmail;
  const password = ENV.substackPassword;

  if (!email || !password) {
    throw new Error(
      "SUBSTACK_EMAIL and SUBSTACK_PASSWORD must be set in environment variables."
    );
  }

  const res = await fetch("https://substack.com/api/v1/email-login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; UrbanMonkContentHub/1.0)",
      Origin: "https://substack.com",
      Referer: "https://substack.com/sign-in",
    },
    body: JSON.stringify({ email, password, captcha_response: null }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Substack login failed (${res.status}): ${body}`);
  }

  // Extract the session cookie from Set-Cookie header
  const setCookie = res.headers.get("set-cookie") ?? "";
  const sidMatch = setCookie.match(/substack\.sid=([^;]+)/);
  if (!sidMatch) {
    throw new Error("Substack login succeeded but no session cookie was returned.");
  }

  const cookie = `substack.sid=${sidMatch[1]}`;
  // Cache for 23 hours (Substack sessions last ~24h)
  cachedSession = { cookie, expiresAt: now + 23 * 60 * 60 * 1000 };
  return cookie;
}

export interface SubstackPostInput {
  title: string;
  /** Full HTML body of the post */
  bodyHtml: string;
  /** Optional subtitle / deck */
  subtitle?: string;
  /** Whether to send as email to subscribers (default: true) */
  sendEmail?: boolean;
}

export interface SubstackPostResult {
  postId: string;
  postUrl: string;
}

/**
 * Publish a post to Substack.
 * Creates a draft then immediately publishes it.
 */
export async function publishToSubstack(
  input: SubstackPostInput
): Promise<SubstackPostResult> {
  const pubUrl = ENV.substackPublicationUrl;
  if (!pubUrl) {
    throw new Error("SUBSTACK_PUBLICATION_URL is not set.");
  }

  // Normalise: strip trailing slash, ensure no protocol prefix
  const pubHost = pubUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const baseUrl = `https://${pubHost}`;

  const cookie = await getSession();

  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; UrbanMonkContentHub/1.0)",
    Origin: baseUrl,
    Referer: `${baseUrl}/publish/post`,
    Cookie: cookie,
  };

  // Step 1: Create a draft
  const draftBody = {
    draft_title: input.title,
    draft_subtitle: input.subtitle ?? "",
    draft_body: JSON.stringify(htmlToSubstackDoc(input.bodyHtml)),
    type: "newsletter",
    draft_section_id: null,
    audience: "everyone",
  };

  const draftRes = await fetch(`${baseUrl}/api/v1/drafts`, {
    method: "POST",
    headers,
    body: JSON.stringify(draftBody),
  });

  if (draftRes.status === 401) {
    // Session expired — clear cache and retry once
    cachedSession = null;
    return publishToSubstack(input);
  }

  if (!draftRes.ok) {
    const body = await draftRes.text();
    throw new Error(`Substack draft creation failed (${draftRes.status}): ${body}`);
  }

  const draft = (await draftRes.json()) as { id: number; slug?: string };
  const draftId = draft.id;

  // Step 2: Publish the draft
  const publishBody = {
    send: input.sendEmail !== false, // default true
    share_automatically: false,
    free_unlock: false,
  };

  const publishRes = await fetch(
    `${baseUrl}/api/v1/posts/${draftId}/publish`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(publishBody),
    }
  );

  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(`Substack publish failed (${publishRes.status}): ${body}`);
  }

  const published = (await publishRes.json()) as {
    id: number;
    slug: string;
    canonical_url?: string;
  };

  const postUrl =
    published.canonical_url ?? `${baseUrl}/p/${published.slug ?? draftId}`;

  return {
    postId: String(published.id ?? draftId),
    postUrl,
  };
}

/**
 * Convert a simple HTML string into Substack's ProseMirror-style JSON document.
 * Substack's draft_body field expects a JSON-stringified ProseMirror doc.
 * This is a lightweight converter that handles the common cases produced by
 * the Content Hub blog generator (headings, paragraphs, bold, italic, links).
 */
function htmlToSubstackDoc(html: string): object {
  // Strip script/style tags for safety
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Split into block-level elements
  const blocks = clean
    .split(/(?=<h[1-6]|<p|<ul|<ol|<blockquote|<hr)/i)
    .filter(Boolean);

  const content: object[] = [];

  for (const block of blocks) {
    const tag = (block.match(/^<(\w+)/)?.[1] ?? "").toLowerCase();

    if (tag === "hr") {
      content.push({ type: "horizontal_rule" });
      continue;
    }

    const innerHtml = block
      .replace(/^<[^>]+>/, "")
      .replace(/<\/[^>]+>\s*$/, "")
      .trim();

    if (!innerHtml) continue;

    const inlineContent = parseInline(innerHtml);

    if (tag.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1], 10);
      content.push({
        type: "heading",
        attrs: { level: Math.min(level, 3) },
        content: inlineContent,
      });
    } else if (tag === "blockquote") {
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inlineContent }],
      });
    } else {
      // paragraph (default)
      content.push({ type: "paragraph", content: inlineContent });
    }
  }

  // Ensure there's at least one paragraph
  if (content.length === 0) {
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: html.replace(/<[^>]+>/g, "") }],
    });
  }

  return { type: "doc", content };
}

function parseInline(html: string): object[] {
  const nodes: object[] = [];
  // Simple regex-based inline parser for bold, italic, links
  const parts = html.split(
    /(<strong>[\s\S]*?<\/strong>|<b>[\s\S]*?<\/b>|<em>[\s\S]*?<\/em>|<i>[\s\S]*?<\/i>|<a[^>]*>[\s\S]*?<\/a>)/i
  );

  for (const part of parts) {
    if (!part) continue;

    if (/^<strong>|^<b>/i.test(part)) {
      const text = part.replace(/<\/?(?:strong|b)>/gi, "");
      nodes.push({ type: "text", text, marks: [{ type: "strong" }] });
    } else if (/^<em>|^<i>/i.test(part)) {
      const text = part.replace(/<\/?(?:em|i)>/gi, "");
      nodes.push({ type: "text", text, marks: [{ type: "em" }] });
    } else if (/^<a /i.test(part)) {
      const href = part.match(/href="([^"]+)"/)?.[1] ?? "";
      const text = part.replace(/<[^>]+>/g, "");
      nodes.push({
        type: "text",
        text,
        marks: [{ type: "link", attrs: { href, target: "_blank" } }],
      });
    } else {
      // Strip any remaining tags and treat as plain text
      const text = part.replace(/<[^>]+>/g, "");
      if (text) nodes.push({ type: "text", text });
    }
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
}
