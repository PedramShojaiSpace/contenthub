import { describe, expect, it } from "vitest";
import { buildTantraSegmentation, routeToProduct } from "./tantraQuizRouter";

describe("Tantra quiz clinical-pathway routing", () => {
  it("keeps the intimacy product route while assigning hormone responses to clinician follow-up", () => {
    const route = routeToProduct({
      q_who: "me_female",
      q_symptoms: ["low_libido"],
      q_hormone_symptoms: ["hot_flashes", "mood_changes"],
    });

    expect(route.result).toBe("tantra_her");
    expect(route.hormoneFlag).toBe(true);
    expect(route.segmentation).toMatchObject({
      primaryPath: "hormone_health",
      clinicianFollowUp: true,
    });
    expect(route.segmentation.kajabiTags).toContain("tantra-path-hormone-health");
    expect(route.segmentation.kajabiTags).toContain("tantra-clinician-follow-up");
  });

  it("does not assign a hormone pathway when the relevant response is none", () => {
    const route = routeToProduct({
      q_who: "me_male",
      q_symptoms: ["low_libido"],
      q_hormone_male: ["none"],
    });

    expect(route.hormoneFlag).toBe(false);
    expect(route.segmentation).toMatchObject({
      primaryPath: "intimacy",
      clinicianFollowUp: false,
      carePaths: ["intimacy"],
    });
  });

  it("assigns a multifactor care pathway when several clinical signals are present", () => {
    const segmentation = buildTantraSegmentation({
      hormoneFlag: true,
      gutFlag: true,
      sleepFlag: true,
      oralFlag: true,
    });

    expect(segmentation.primaryPath).toBe("multifactor");
    expect(segmentation.carePaths).toEqual([
      "intimacy",
      "hormone_health",
      "gut_health",
      "sleep_health",
      "oral_health",
    ]);
    expect(segmentation.kajabiTags).toEqual(expect.arrayContaining([
      "tantra-path-intimacy",
      "tantra-path-hormone-health",
      "tantra-path-gut-health",
      "tantra-path-sleep-health",
      "tantra-path-oral-health",
      "tantra-path-multifactor",
      "tantra-clinician-follow-up",
    ]));
  });
});
