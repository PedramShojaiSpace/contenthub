/**
 * Medium Publisher
 *
 * Uses Medium's official Integration Token API to publish articles.
 * The canonical URL is always set to the WordPress post URL so Google
 * treats the WordPress version as the authoritative source.
 *
 * API docs: https://github.com/Medium/medium-api-docs
 *
 * Required env var: MEDIUM_INTEGRATION_TOKEN
 * Obtain from: Medium → Settings → Integration tokens
 */

export interface MediumPostInput {
  title: string;
  bodyMarkdown: string;
  canonicalUrl: string; // Always = WordPress post URL
  tags?: string[];      // Up to 5 tags
  publishStatus?: "draft" | "public" | "unlisted"; // default: "public"
}

export interface MediumPostResult {
  postId: string;
  postUrl: string;
  canonicalUrl: string;
}

function getMediumToken(): string {
  const token = process.env.MEDIUM_INTEGRATION_TOKEN;
  if (!token) {
    throw new Error(
      "MEDIUM_INTEGRATION_TOKEN is not set. Please add it via the secrets manager. " +
      "Obtain it from Medium → Settings → Integration tokens."
    );
  }
  return token;
}

/**
 * Get the authenticated Medium user's ID.
 * Required to publish posts via the API.
 */
async function getMediumUserId(token: string): Promise<string> {
  const res = await fetch("https://api.medium.com/v1/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Medium API /me failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { data?: { id?: string } };
  const userId = data?.data?.id;
  if (!userId) {
    throw new Error("Medium API /me returned no user ID");
  }
  return userId;
}

/**
 * Publish an article to Medium with a canonical URL pointing to WordPress.
 * The canonical URL tells Google that the WordPress version is the original.
 */
export async function publishToMedium(
  input: MediumPostInput
): Promise<MediumPostResult> {
  const token = getMediumToken();
  const userId = await getMediumUserId(token);

  const body = {
    title: input.title,
    contentFormat: "markdown",
    content: input.bodyMarkdown,
    canonicalUrl: input.canonicalUrl,
    tags: input.tags ?? [],
    publishStatus: input.publishStatus ?? "public",
  };

  const res = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Medium post creation failed (${res.status}): ${errBody}`);
  }

  const result = (await res.json()) as {
    data?: {
      id?: string;
      url?: string;
      canonicalUrl?: string;
    };
  };

  const postId = result?.data?.id;
  const postUrl = result?.data?.url;

  if (!postId || !postUrl) {
    throw new Error(`Medium API returned incomplete response: ${JSON.stringify(result)}`);
  }

  return {
    postId,
    postUrl,
    canonicalUrl: input.canonicalUrl,
  };
}
