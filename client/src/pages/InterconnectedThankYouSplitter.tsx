/**
 * InterconnectedThankYouSplitter.tsx
 *
 * SPLIT TEST ARCHITECTURE:
 *
 * SPLIT 1 — Landing Page (Curt's front-end split, externally managed):
 *   /interconnected   → Page A  (tagged pageVariant='A' on form submit)
 *   /interconnected-b → Page B  (tagged pageVariant='B' on form submit)
 *   Curt controls which ads point where. We do NOT redirect between them.
 *   The landing page variant is stored in localStorage as 'ic_lp_variant'
 *   by the static pages on form submit, so we can read it here.
 *
 * SPLIT 2 — Thank You Page (our back-end split, server-managed):
 *   /interconnected/thank-you → this splitter assigns 50/50 to TY-A or TY-B
 *   Variant A: Wistia hobj7srg3q  |  Variant B: Wistia 10cdtpm3il
 *   Assignment is sticky via localStorage 'ty_ab_variant'.
 *   Landing page variant is passed to assignVariant so we can cross-tabulate:
 *   LP-A→TY-A, LP-A→TY-B, LP-B→TY-A, LP-B→TY-B conversion rates.
 *
 * The A/B test ID in the DB is 1 ("Interconnected TY Page — Video A vs B").
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

function getCachedTyVariant(): "A" | "B" | null {
  const v = localStorage.getItem("ty_ab_variant");
  return v === "A" || v === "B" ? v : null;
}

function setCachedTyVariant(variant: "A" | "B") {
  localStorage.setItem("ty_ab_variant", variant);
}

/**
 * Read which landing page variant the visitor came from.
 * The static pages (A and B) write 'ic_lp_variant' to localStorage on form submit.
 * Falls back to 'unknown' if not set (e.g. direct navigation to /thank-you).
 */
function getLandingPageVariant(): "A" | "B" | "unknown" {
  const v = localStorage.getItem("ic_lp_variant");
  return v === "A" || v === "B" ? v : "unknown";
}

export default function InterconnectedThankYouSplitter() {
  const [tyVariant, setTyVariant] = useState<"A" | "B" | null>(null);
  const [visitorId] = useState(() => getOrCreateVisitorId());
  const assignCalled = useRef(false);

  const assignMutation = trpc.abTest.assignVariant.useMutation({
    onSuccess: (data) => {
      const v: "A" | "B" = data.isControl ? "A" : "B";
      setCachedTyVariant(v);
      setTyVariant(v);
    },
    onError: () => {
      // Fallback: use cached variant or random 50/50
      const cached = getCachedTyVariant();
      if (cached) {
        setTyVariant(cached);
      } else {
        const fallback: "A" | "B" = Math.random() < 0.5 ? "A" : "B";
        setCachedTyVariant(fallback);
        setTyVariant(fallback);
      }
    },
  });

  useEffect(() => {
    if (assignCalled.current) return;
    assignCalled.current = true;

    // Use cached sticky assignment to avoid flash on repeat visits
    const cached = getCachedTyVariant();
    if (cached) {
      setTyVariant(cached);
      return;
    }

    // Get UTM params + landing page variant for cross-split attribution
    const params = new URLSearchParams(window.location.search);
    const lpVariant = getLandingPageVariant();

    assignMutation.mutate({
      testId: TY_AB_TEST_ID,
      visitorId,
      // Pass UTM context
      utmSource: params.get("utm_source") ?? undefined,
      utmCampaign: params.get("utm_campaign") ?? undefined,
      // Pass landing page variant so we can cross-tabulate LP-A/B × TY-A/B
      // stored in metadata field if the abTest router supports it
      utmContent: lpVariant !== "unknown" ? `lp_${lpVariant}` : undefined,
    });
  }, []);

  // Blank dark screen while assigning (avoids flash of wrong variant)
  if (tyVariant === null) {
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

  if (tyVariant === "B") {
    return <InterconnectedThankYouB />;
  }

  return <InterconnectedThankYou />;
}
