import { describe, expect, it } from "vitest";
import {
  classifyInterconnectedCohortPath,
  dayOffsetFromLead,
  isWithinFourteenDayWindow,
} from "./interconnectedCohorts";

describe("Interconnected cohort attribution", () => {
  it("keeps Kajabi, Klaviyo/SMS, and Meta lead paths distinct", () => {
    expect(classifyInterconnectedCohortPath({ utmSource: "kajabi_page" })).toBe("kajabi_page");
    expect(classifyInterconnectedCohortPath({ utmSource: "klaviyo", utmMedium: "email" })).toBe("klaviyo_sms");
    expect(classifyInterconnectedCohortPath({ utmSource: "facebook", utmCampaign: "agora" })).toBe("meta_paid");
  });

  it("counts only purchases within the planned 14-day revenue window", () => {
    const lead = Date.UTC(2026, 7, 1);
    expect(dayOffsetFromLead(lead, lead + 86_400_000 * 5)).toBe(5);
    expect(isWithinFourteenDayWindow(lead, lead + 86_400_000 * 14)).toBe(true);
    expect(isWithinFourteenDayWindow(lead, lead + 86_400_000 * 15)).toBe(false);
  });
});
