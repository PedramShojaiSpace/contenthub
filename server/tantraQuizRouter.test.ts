import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTantraSegmentation, routeToProduct, TANTRA_QUIZ_QUESTIONS } from "./tantraQuizRouter";

describe("Tantra desire and vitality check-in routing", () => {
  it("routes the explicitly selected women’s pathway to Tantra Her", () => {
    const route = routeToProduct({ q_pathway: "women", q_safety: ["none"] });

    expect(route.result).toBe("tantra_her");
    expect(route.gender).toBe("female");
    expect(route.requiresClinicalReview).toBe(false);
    expect(route.segmentation).toEqual({
      primaryPath: "functional_foundations",
      carePaths: ["functional_foundations"],
      clinicianFollowUp: false,
    });
  });

  it("routes the explicitly selected men’s pathway to Tantra Him", () => {
    const route = routeToProduct({ q_pathway: "men", q_safety: ["none"] });

    expect(route.result).toBe("tantra_him");
    expect(route.gender).toBe("male");
    expect(route.requiresClinicalReview).toBe(false);
  });

  it("does not recommend a product when the visitor selects an uncertain pathway or a clinical-review answer", () => {
    const uncertainRoute = routeToProduct({ q_pathway: "not_sure", q_safety: ["none"] });
    const safetyRoute = routeToProduct({ q_pathway: "men", q_safety: ["nitrate_medication"] });

    expect(uncertainRoute.result).toBe("pending");
    expect(uncertainRoute.requiresClinicalReview).toBe(true);
    expect(safetyRoute.result).toBe("pending");
    expect(safetyRoute.segmentation.primaryPath).toBe("clinical_review");
    expect(safetyRoute.segmentation.clinicianFollowUp).toBe(true);
  });

  it("uses a five-question non-diagnostic sequence without Taoist positioning", () => {
    expect(TANTRA_QUIZ_QUESTIONS).toHaveLength(5);
    expect(TANTRA_QUIZ_QUESTIONS.map((question) => question.id)).toEqual([
      "q_pathway",
      "q_focus",
      "q_recovery",
      "q_goal",
      "q_safety",
    ]);
    expect(JSON.stringify(TANTRA_QUIZ_QUESTIONS).toLowerCase()).not.toContain("taoist");
    expect(JSON.stringify(TANTRA_QUIZ_QUESTIONS).toLowerCase()).not.toContain("diagnose");
  });

  it("keeps the server contract free of automatic CRM, outbound email, CAPI, and owner-notification side effects", () => {
    const routerSource = readFileSync(resolve(import.meta.dirname, "tantraQuizRouter.ts"), "utf8");

    expect(routerSource).not.toContain("pushTantraQuizLead");
    expect(routerSource).not.toContain("sendGmailOutreach");
    expect(routerSource).not.toContain("sendCapiEvent");
    expect(routerSource).not.toContain("notifyOwner");
    expect(routerSource).toContain("Intentionally no email, CRM, ad platform, webhook, or owner-notification side effect.");
  });

  it("marks only the safety-review answers as a clinician-review pathway", () => {
    expect(buildTantraSegmentation(["none"]).clinicianFollowUp).toBe(false);
    expect(buildTantraSegmentation(["pregnant_or_nursing"]).primaryPath).toBe("clinical_review");
    expect(buildTantraSegmentation(["not_sure"]).carePaths).toEqual(["clinical_review"]);
  });
});
