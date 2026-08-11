import { describe, expect, it } from "vitest";
import { getMessageFromFlowAction } from "./klaviyoFlowOptimizerRouter";

describe("getMessageFromFlowAction", () => {
  it("maps a Klaviyo send-email action to its managed template metadata", () => {
    const result = getMessageFromFlowAction({
      id: "114157389",
      type: "flow-action",
      attributes: {
        definition: {
          type: "send-email",
          data: {
            message: {
              id: "RVLxnm",
              name: "Email #1",
              subject_line: "Your results are in",
              template_id: "UUcvP4",
            },
          },
        },
      },
    });

    expect(result).toEqual({
      isEmail: true,
      actionName: "Email #1",
      subjectLine: "Your results are in",
      templateId: "UUcvP4",
    });
  });

  it("does not allow a non-email action into the managed email workflow", () => {
    const result = getMessageFromFlowAction({
      id: "114158922",
      type: "flow-action",
      attributes: { definition: { type: "time-delay", data: { value: 2 } } },
    });

    expect(result.isEmail).toBe(false);
    expect(result.templateId).toBe("");
  });
});
