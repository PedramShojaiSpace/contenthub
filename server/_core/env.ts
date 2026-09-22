export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  // Hardcoded fallback ensures GSC/YouTube OAuth callbacks work in production
  // even when the platform injects OWNER_OPEN_ID only at startup, not at request time.
  ownerOpenId: process.env.OWNER_OPEN_ID || "6Efk5Rs3uA46PG9TgoeUmf",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  ingestSecret: process.env.INGEST_SECRET ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  vidiqApiKey: process.env.VIDIQ_API_KEY ?? "",
  substackSessionCookie: process.env.SUBSTACK_SESSION_COOKIE ?? "",
  substackPublicationUrl: process.env.SUBSTACK_PUBLICATION_URL ?? "", // e.g. "drpedramshojai.substack.com"
  heygenApiKey: process.env.HEYGEN_API_KEY ?? "",
  heygenAvatarId: process.env.HEYGEN_AVATAR_ID ?? "",
  heygenVoiceId: process.env.HEYGEN_VOICE_ID ?? "",
  supadataApiKey: process.env.SUPADATA_API_KEY ?? "",
  klaviyoPrivateKey: process.env.KLAVIYO_PRIVATE_KEY ?? "",
  // Staged Kajabi → Klaviyo buyer-event bridge. The dispatch gate is disabled
  // by default until the exact $99 Upstream OCU identifier and draft Klaviyo
  // event-triggered flow have been reviewed.
  kajabiKlaviyoBuyerEventEnabled: process.env.KAJABI_KLAVIYO_BUYER_EVENT_ENABLED ?? "",
  kajabiUpstreamCourseOcuId: process.env.KAJABI_UPSTREAM_COURSE_OCU_ID ?? "",
  sendyBaseUrl: process.env.SENDY_BASE_URL ?? "",
  sendyApiKey: process.env.SENDY_API_KEY ?? "",
};
