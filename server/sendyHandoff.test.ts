import { describe, expect, it } from "vitest";
import { buildSendyCampaignBrief, buildSendyFilename, htmlToPlainText } from "../client/src/lib/sendyHandoff";

describe("Sendy manual handoff", () => {
  it("creates a copy-ready draft handoff without a send instruction", () => {
    const brief = buildSendyCampaignBrief({
      title: "Welcome sequence — day 1",
      subject: "A grounded next step",
      fromName: "Dr. Pedram",
      fromEmail: "hello@theurbanmonk.com",
      replyTo: "support@theurbanmonk.com",
      audience: "Working professionals — warm list",
      html: "<p>Hello <strong>there</strong>.</p><p>Read <a href='https://example.com'>this</a>.</p>",
    });

    expect(brief).toContain("SENDY CAMPAIGN HANDOFF — MANUAL DRAFT ONLY");
    expect(brief).toContain("Campaign title: Welcome sequence — day 1");
    expect(brief).toContain("Create a campaign draft in Sendy; do not send from this handoff.");
    expect(brief).toContain("Hello there.");
    expect(brief).toContain("<strong>there</strong>");
  });

  it("converts common HTML blocks into a readable plain-text companion", () => {
    expect(htmlToPlainText("<style>.x{color:red}</style><p>First<br>line</p><p>Second &amp; final</p>"))
      .toBe("First\nline\n\nSecond & final");
  });

  it("uses a safe campaign handoff filename", () => {
    expect(buildSendyFilename("Welcome: Day 1 / Doctors")).toBe("welcome-day-1-doctors-handoff.txt");
    expect(buildSendyFilename("   ")).toBe("sendy-campaign-handoff.txt");
  });
});
