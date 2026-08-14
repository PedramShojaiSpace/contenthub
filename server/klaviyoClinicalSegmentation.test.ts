import { describe, expect, it } from "vitest";
import { buildTantraQuizProfileProperties } from "./klaviyo";

describe("Tantra Klaviyo clinical segmentation payload", () => {
  it("serializes every clinical pathway field without passing raw quiz answers", () => {
    const properties = buildTantraQuizProfileProperties({
      email: "person@example.com",
      result: "tantra_her",
      gutFlag: true,
      sleepFlag: true,
      oralFlag: false,
      hormoneFlag: true,
      primaryPath: "multifactor",
      carePaths: ["intimacy", "hormone_health", "gut_health", "sleep_health"],
      clinicianFollowUp: true,
    });

    expect(properties).toMatchObject({
      tantra_quiz_result: "tantra_her",
      tantra_gut_flag: true,
      tantra_sleep_flag: true,
      tantra_oral_flag: false,
      tantra_hormone_flag: true,
      tantra_primary_care_path: "multifactor",
      tantra_care_paths: ["intimacy", "hormone_health", "gut_health", "sleep_health"],
      tantra_clinician_followup_needed: true,
    });
    expect(JSON.stringify(properties)).not.toContain("q_hormone");
  });
});
