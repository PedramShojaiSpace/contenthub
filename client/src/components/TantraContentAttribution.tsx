import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MouseEvent } from "react";
import { trpc } from "@/lib/trpc";
import type { TantraContentEventType, TantraContentSourceKey } from "@shared/tantraContentAttribution";

type WistiaVideo = {
  bind: (eventType: string, handler: (...args: any[]) => void) => void;
};

type WistiaQueueEntry = {
  id?: string;
  onReady?: (video: WistiaVideo) => void;
  revoke?: WistiaQueueEntry;
};

declare global {
  interface Window {
    _wq?: WistiaQueueEntry[];
  }
}

const VISITOR_STORAGE_KEY = "um_tantra_content_visitor_id";

function getOrCreateVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;
  const visitorId = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  return visitorId;
}

function ensureWistiaApi() {
  if (document.querySelector('script[data-um-wistia-api="true"]')) return;
  const script = document.createElement("script");
  script.src = "https://fast.wistia.com/assets/external/E-v1.js";
  script.async = true;
  script.dataset.umWistiaApi = "true";
  document.head.appendChild(script);
}

function eventDedupeKey(sourcePage: TantraContentSourceKey, eventType: TantraContentEventType) {
  return `um_tantra_content_event:${sourcePage}:${eventType}`;
}

export function useTantraContentAttribution({
  sourcePage,
  videoId,
}: {
  sourcePage: TantraContentSourceKey;
  videoId: string;
}) {
  const trackEvent = trpc.tantraContentAttribution.trackEvent.useMutation();
  const visitorId = useMemo(() => getOrCreateVisitorId(), []);
  const sourcePageRef = useRef(sourcePage);
  sourcePageRef.current = sourcePage;

  const report = useCallback((eventType: TantraContentEventType, dedupe = true) => {
    const key = eventDedupeKey(sourcePageRef.current, eventType);
    if (dedupe && window.sessionStorage.getItem(key)) return;
    if (dedupe) window.sessionStorage.setItem(key, "1");
    trackEvent.mutate({ sourcePage: sourcePageRef.current, eventType, visitorId });
  }, [trackEvent, visitorId]);

  useEffect(() => {
    report("page_view", false);
    ensureWistiaApi();
    window._wq = window._wq ?? [];
    const config: WistiaQueueEntry = {
      id: videoId,
      onReady(video) {
        video.bind("play", () => report("video_play"));
        video.bind("percentwatchedchanged", (percent: number, lastPercent: number) => {
          if (percent >= 0.25 && lastPercent < 0.25) report("video_25");
          if (percent >= 0.5 && lastPercent < 0.5) report("video_50");
          if (percent >= 0.75 && lastPercent < 0.75) report("video_75");
        });
        video.bind("end", () => report("video_complete"));
      },
    };
    window._wq.push(config);
    return () => window._wq?.push({ revoke: config });
  }, [report, videoId]);

  const quizUrl = useMemo(() => {
    const query = new URLSearchParams(window.location.search);
    const quizQuery = new URLSearchParams();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid"]) {
      const value = query.get(key);
      if (value) quizQuery.set(key, value);
    }
    quizQuery.set("tantra_source_page", sourcePage);
    quizQuery.set("tantra_source_visitor", visitorId);
    return `/quiz/tantra?${quizQuery.toString()}`;
  }, [sourcePage, visitorId]);

  const onQuizCta = useCallback(async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const key = eventDedupeKey(sourcePage, "quiz_cta");
    if (!window.sessionStorage.getItem(key)) {
      window.sessionStorage.setItem(key, "1");
      try {
        await trackEvent.mutateAsync({ sourcePage, eventType: "quiz_cta", visitorId });
      } catch {
        // Attribution must never block the visitor from reaching the quiz.
      }
    }
    window.location.assign(quizUrl);
  }, [quizUrl, sourcePage, trackEvent, visitorId]);

  return { quizUrl, onQuizCta };
}
