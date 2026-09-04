import { protectedProcedure, router } from "./_core/trpc";
import { getAgoraPriceTestDraftReadiness } from "./agoraPriceTest";

/**
 * The price-test route is read-only by design. It exposes readiness and
 * blockers for operator QA but contains no offer, traffic, or price mutation.
 */
export const agoraPriceTestRouter = router({
  getDraftReadiness: protectedProcedure.query(() => getAgoraPriceTestDraftReadiness()),
});

