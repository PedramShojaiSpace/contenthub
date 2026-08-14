import { describe, expect, it } from "vitest";
import { buildTantraQuizCapiEvents } from "./tantraQuizMeta";

describe("Tantra quiz CAPI event builder", () => {
  it("emits neutral standard events without quiz-result or health data", () => {
    const events = buildTantraQuizCapiEvents({
      email: "person@example.com",
      eventSourceUrl: "https://content.theurbanmonk.com/quiz/tantra",
      completionEventId: "completion-1",
      leadEventId: "lead-1",
      fbp: "fb.1.example",
      fbc: "fb.1.click",
      utmCampaign: "tantra_content_divorce",
      utmSource: "meta",
    });

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.eventName)).toEqual(["CompleteRegistration", "Lead"]);
    expect(events.every((event) => event.contentName === "Tantra Quiz")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("gender");
    expect(JSON.stringify(events)).not.toContain("result");
    expect(JSON.stringify(events)).not.toContain("flag");
  });
});
