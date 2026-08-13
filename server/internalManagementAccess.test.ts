import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const unauthenticatedContext = { user: null } as any;

describe("internal management procedure access", () => {
  it("rejects unauthenticated UTM history access before reading internal campaign records", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext);

    await expect(caller.utm.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.utm.getCtaUrlForLabel({ label: "Interconnected" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated Typeform response access before reading customer responses", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext);

    await expect(caller.typeform.listForms()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.typeform.getResponses({ formId: "internal-form", pageSize: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated integration-health access before testing private credentials", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext);

    await expect(caller.integrationHealth.critical()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated YouTube pipeline access before reading or changing channel operations", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext);

    await expect(caller.youtube.listTrackedChannels()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.youtube.validateApiKey()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.ytAnalytics.getChannelSummary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps the intentional public funnel and checkout entry points available without an operator session", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext);

    await expect(caller.tantraQuiz.getQuestions()).resolves.toMatchObject({ questions: expect.any(Array) });
    await expect(caller.shopify.getCheckoutUrl({
      productKey: "vibe",
      utmSource: "meta",
      utmCampaign: "public_funnel_regression",
    })).resolves.toMatchObject({ ok: true, checkoutUrl: expect.stringContaining("/cart/") });
  });
});
