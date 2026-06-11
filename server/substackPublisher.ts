/**
 * Substack Publisher
 *
 * Uses Substack's unofficial internal API authenticated via a pre-stored
 * session cookie (SUBSTACK_SESSION_COOKIE env var).
 *
 * The session cookie is the value of the "substack.sid" cookie from an
 * authenticated browser session. It lasts several months and can be refreshed
 * by re-extracting it from the browser when it expires.
 *
 * API flow:
 *   POST https://{pub}.substack.com/api/v1/drafts  →  creates a draft
 *   POST https://{pub}.substack.com/api/v1/posts/{id}/publish  →  publishes it
 */

import { ENV } from "./_core/env";

function getSessionCookie(): string {
  const cookie = ENV.substackSessionCookie;
  if (!cookie) {
    throw new Error(
      "SUBSTACK_SESSION_COOKIE is not set. Please add it via the secrets manager."
    );
  }
  // Ensure it's in the correct cookie header format
  if (cookie.startsWith("substack.sid=")) {
    return cookie;
  }
  return `substack.sid=${cookie}`;
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

  // Normalise: strip trailing slash, ensure https
  const pubHost = pubUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const baseUrl = `https://${pubHost}`;

  const cookie = getSessionCookie();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
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

  if (draftRes.status === 401 || draftRes.status === 403) {
    throw new Error(
      `Substack session expired or invalid (${draftRes.status}). Please refresh SUBSTACK_SESSION_COOKIE in the secrets manager.`
    );
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
 * Validate the session cookie by calling the Substack user info endpoint.
 * Returns true if the session is valid, false otherwise.
 */
export async function validateSubstackSession(): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  try {
    const cookie = getSessionCookie();
    const res = await fetch("https://substack.com/api/v1/user/login", {
      method: "GET",
      headers: {
        Cookie: cookie,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (res.ok) {
      const data = (await res.json()) as { email?: string };
      return { valid: true, email: data.email };
    }
    return { valid: false, error: `HTTP ${res.status}` };
  } catch (err: unknown) {
    return { valid: false, error: String(err) };
  }
}

/**
 * Convert a simple HTML string into Substack's ProseMirror-style JSON document.
 * Substack's draft_body field expects a JSON-stringified ProseMirror doc.
 */
function htmlToSubstackDoc(html: string): object {
  const clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

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
      content.push({ type: "paragraph", content: inlineContent });
    }
  }

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
      const text = part.replace(/<[^>]+>/g, "");
      if (text) nodes.push({ type: "text", text });
    }
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
}
