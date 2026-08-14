import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildTantraSegmentation, routeToProduct } from "./tantraQuizRouter";

describe("Tantra quiz clinical-pathway routing", () => {
  it("keeps the intimacy product route while routing hormone context into the Fit22 gut path", () => {
    const route = routeToProduct({
      q_who: "me_female",
      q_symptoms: ["low_libido"],
      q_hormone_symptoms: ["hot_flashes", "mood_changes"],
    });

    expect(route.result).toBe("tantra_her");
    expect(route.hormoneFlag).toBe(true);
    expect(route.segmentation).toMatchObject({
      primaryPath: "gut_health",
      clinicianFollowUp: true,
    });
    expect(route.segmentation.carePaths).toEqual(["intimacy", "gut_health"]);
    expect(route.segmentation.kajabiTags).toContain("tantra-path-gut-health");
    expect(route.segmentation.kajabiTags).toContain("tantra-context-hormone");
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

  it("keeps unflagged visitors on a direct intimacy recommendation", () => {
    const route = routeToProduct({
      q_who: "me_male",
      q_symptoms: ["low_libido"],
      q_hormone_male: ["none"],
    });

    expect(route.result).toBe("tantra_him");
    expect(route.segmentation).toMatchObject({
      primaryPath: "intimacy",
      clinicianFollowUp: false,
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
      "gut_health",
      "sleep_health",
      "oral_health",
    ]);
    expect(segmentation.kajabiTags).toEqual(expect.arrayContaining([
      "tantra-path-intimacy",
      "tantra-path-gut-health",
      "tantra-path-sleep-health",
      "tantra-path-oral-health",
      "tantra-context-hormone",
      "tantra-path-multifactor",
      "tantra-clinician-follow-up",
    ]));
  });

  it("keeps every clinical result narrative educational, test-oriented, and non-diagnostic", () => {
    const quizSource = readFileSync(
      resolve(import.meta.dirname, "../client/src/pages/TantraQuiz.tsx"),
      "utf8",
    );

    expect(quizSource).toContain("Fit22 gives our team a practical baseline");
    expect(quizSource).toContain("Sleep is often where the whole system tells the truth");
    expect(quizSource).toContain("nitrate–nitrite–nitric-oxide pathway");
    expect(quizSource).toContain("This quiz cannot diagnose an oral-health condition");
  });
});
