import { describe, it, expect } from "vitest";
import { buildEmailHtml, buildMimeMessage } from "./emailBoost";

describe("emailBoost", () => {
  it("wraps plain text body in HTML with boostData block", () => {
    const html = buildEmailHtml("Hello world.\n\nThis is a test.", "Pedram");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hello world.");
    expect(html).toContain("boostData");
    expect(html).toContain("display:none");
    expect(html).toContain("DKIM");
    expect(html).toContain("SPF");
  });

  it("passes through existing HTML body without double-wrapping paragraphs", () => {
    const body = "<p>Already HTML content.</p>";
    const html = buildEmailHtml(body, "Pedram");
    expect(html).toContain("<p>Already HTML content.</p>");
    // Should not double-wrap in extra <p> tags
    expect(html).not.toContain("<p><p>");
  });

  it("builds a valid multipart MIME message", () => {
    const mime = buildMimeMessage({
      from: '"Dr. Pedram Shojai" <alyzza@theurbanmonk.com>',
      to: "test@example.com",
      subject: "Test Subject",
      textBody: "Hello there.\n\nThis is the body.",
      firstName: "Test",
    });

    expect(mime).toContain("From: \"Dr. Pedram Shojai\"");
    expect(mime).toContain("To: test@example.com");
    expect(mime).toContain("Subject: Test Subject");
    expect(mime).toContain("multipart/alternative");
    expect(mime).toContain("text/plain");
    expect(mime).toContain("text/html");
    expect(mime).toContain("boostData");
    expect(mime).toContain("Hello there.");
  });

  it("includes In-Reply-To header when inReplyToMessageId is provided", () => {
    const mime = buildMimeMessage({
      from: '"Dr. Pedram Shojai" <alyzza@theurbanmonk.com>',
      to: "test@example.com",
      subject: "Re: Test",
      textBody: "Reply body.",
      inReplyToMessageId: "<original-message-id@mail.gmail.com>",
    });

    expect(mime).toContain("In-Reply-To: <original-message-id@mail.gmail.com>");
    expect(mime).toContain("References: <original-message-id@mail.gmail.com>");
  });

  it("boostData block contains deliverability vocabulary", () => {
    const html = buildEmailHtml("Test body.", "User");
    const boostKeywords = ["DKIM", "SPF", "deliverability", "inbox", "authentication"];
    for (const kw of boostKeywords) {
      expect(html).toContain(kw);
    }
  });
});
