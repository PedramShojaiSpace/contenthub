/**
 * InterconnectedThankYouSplitter.tsx
 *
 * 50/50 A/B splitter for the Interconnected Thank You page.
 * - Reads/writes a visitor ID from localStorage for sticky assignment
 * - Calls trpc.abTest.assignVariant to get a server-side sticky variant
 * - Renders Version A (hobj7srg3q) or Version B (10cdtpm3il) based on assignment
 * - Records a "purchase" conversion when the OTO checkout URL is clicked
 *
 * Test ID is seeded via the DB seed script (see scripts/seed-ty-abtest.mjs).
 * The test name is "Interconnected TY Page — Video A vs B".
 */

import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import InterconnectedThankYou from "./InterconnectedThankYou";
import InterconnectedThankYouB from "./InterconnectedThankYouB";

// The A/B test ID seeded in the database (confirmed: test ID 1)
const TY_AB_TEST_ID = 1;

function getOrCreateVisitorId(): string {
  const key = "ty_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function getVariantCookie(): string | null {
  return localStorage.getItem("ty_ab_variant");
}

function setVariantCookie(variant: string) {
  localStorage.setItem("ty_ab_variant", variant);
}

export default function InterconnectedThankYouSplitter() {
  const [variant, setVariant] = useState<"A" | "B" | null>(null);
  const [visitorId] = useState(() => getOrCreateVisitorId());
  const assignCalled = useRef(false);

  const assignMutation = trpc.abTest.assignVariant.useMutation({
    onSuccess: (data) => {
      const v = data.isControl ? "A" : "B";
      setVariantCookie(v);
      setVariant(v);
    },
    onError: () => {
      // Fallback: use cached variant or random 50/50
      const cached = getVariantCookie();
      if (cached === "A" || cached === "B") {
        setVariant(cached);
      } else {
        const fallback = Math.random() < 0.5 ? "A" : "B";
        setVariantCookie(fallback);
        setVariant(fallback);
      }
    },
  });

  useEffect(() => {
    if (assignCalled.current) return;
    assignCalled.current = true;

    // Check for cached sticky assignment first (avoids flash)
    const cached = getVariantCookie();
    if (cached === "A" || cached === "B") {
      setVariant(cached);
      return;
    }

    // Get UTM params for attribution
    const params = new URLSearchParams(window.location.search);
    assignMutation.mutate({
      testId: TY_AB_TEST_ID,
      visitorId,
      utmSource: params.get("utm_source") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
    });
  }, []);

  // Show nothing briefly while assigning (avoids flash of wrong variant)
  // Falls back quickly due to localStorage cache on repeat visits
  if (variant === null) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020d18",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
    );
  }

  if (variant === "B") {
    return <InterconnectedThankYouB />;
  }

  return <InterconnectedThankYou />;
}
