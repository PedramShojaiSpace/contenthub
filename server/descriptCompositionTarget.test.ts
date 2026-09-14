import { describe, expect, it } from "vitest";
import {
  extractDescriptCompositionId,
  getDescriptFailureMessage,
  isDescriptResultFailure,
  type DescriptJobStatusResponse,
} from "./descriptClient";
import { buildUnderlordPrompt } from "./brollPromptGenerator";

function status(overrides: Partial<DescriptJobStatusResponse> = {}): DescriptJobStatusResponse {
  return {
    job_id: "job-1",
    job_type: "agent",
    job_state: "stopped",
    created_at: "2026-09-13T00:00:00Z",
    drive_id: "drive-1",
    ...overrides,
  };
}

describe("Descript composition targeting", () => {
  it("extracts the target composition from an agent response", () => {
    expect(extractDescriptCompositionId(status({
      result: {
        status: "success",
        agent_response: '<target compositionId="composition-123" targetType="composition">Video</target>',
      },
    }))).toBe("composition-123");
  });

  it("prefers a structured created composition", () => {
    expect(extractDescriptCompositionId(status({
      result: {
        status: "success",
        created_compositions: [{ id: "composition-structured", name: "Video" }],
        agent_response: '<target compositionId="composition-tagged">Video</target>',
      },
    }))).toBe("composition-structured");
  });

  it("treats provider error results as failures and exposes the provider message", () => {
    const response = status({ result: { status: "error", error_message: "Composition is empty." } });
    expect(isDescriptResultFailure(response)).toBe(true);
    expect(getDescriptFailureMessage(response, "unknown")).toBe("Composition is empty.");
  });

  it("does not ask for a presenter or avatar in Descript-only narration prompts", () => {
    const prompt = buildUnderlordPrompt({
      topic: "nature and anxiety",
      sceneDirections: [],
      hasPexelsFootage: false,
      hasPresenterVideo: false,
    });

    expect(prompt).toContain("Preserve the existing AI narration");
    expect(prompt).toContain("Do not look for, create, or assign a presenter");
    expect(prompt).not.toContain("PRESENTER OVERLAY");
  });
});
