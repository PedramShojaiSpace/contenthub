export const TANTRA_CONTENT_SOURCES = [
  { key: "considering-divorce", label: "Considering Divorce", path: "/tantra/considering-divorce", mediaId: "sq3dol4frw" },
  { key: "king-and-queen", label: "The King and the Queen", path: "/tantra/king-and-queen", mediaId: "onvqm5rc7p" },
  { key: "sex-is-the-flower", label: "Sex Is the Flower", path: "/tantra/sex-is-the-flower", mediaId: "093er5q16m" },
  { key: "why-he-stopped", label: "Why He Stopped Wanting To", path: "/tantra/why-he-stopped", mediaId: "kcvtkpe34a" },
  { key: "love-bank", label: "The Love Bank", path: "/tantra/love-bank", mediaId: "w2aws6tqfv" },
  { key: "why-she-stopped", label: "Why She Stopped Wanting To", path: "/tantra/why-she-stopped", mediaId: "zpqgfbnjp1" },
  { key: "female-orgasm", label: "The Female Orgasm", path: "/tantra/female-orgasm", mediaId: "1foy9s4idy" },
] as const;

export type TantraContentSourceKey = (typeof TANTRA_CONTENT_SOURCES)[number]["key"];

export const TANTRA_CONTENT_SOURCE_KEYS = TANTRA_CONTENT_SOURCES.map((source) => source.key) as [
  TantraContentSourceKey,
  ...TantraContentSourceKey[],
];

export const TANTRA_CONTENT_EVENT_TYPES = [
  "page_view",
  "video_play",
  "video_25",
  "video_50",
  "video_75",
  "video_complete",
  "quiz_cta",
] as const;

export type TantraContentEventType = (typeof TANTRA_CONTENT_EVENT_TYPES)[number];

export function getTantraContentSource(key: string | null | undefined) {
  return TANTRA_CONTENT_SOURCES.find((source) => source.key === key) ?? null;
}
