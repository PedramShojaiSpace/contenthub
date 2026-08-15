export type InterconnectedFunnelPath = "kajabi" | "ko_klaviyo";

const KO_KLAVIYO_MESSAGE_KEYS: Record<string, string> = {
  // Verified against the active Interconnected Day 0 email action.
  XzP5hq: "ko_d00_offer",
};

export function canonicalKoKlaviyoMessageKey(messageId: string): string | null {
  return KO_KLAVIYO_MESSAGE_KEYS[messageId] ?? null;
}

export function isIsolatedEmailAttribution(params: {
  funnelPath?: string;
  messageKey?: string;
  utmSource: string;
}): params is { funnelPath: InterconnectedFunnelPath; messageKey: string; utmSource: string } {
  if (!params.funnelPath && !params.messageKey) return true;
  if (!params.messageKey || !/^[a-z0-9_-]{3,128}$/i.test(params.messageKey)) return false;
  const source = params.utmSource.toLowerCase();
  return (params.funnelPath === "kajabi" && source === "kajabi")
    || (params.funnelPath === "ko_klaviyo" && source === "klaviyo");
}
