import { describe, it, expect } from "vitest";
import { buildEmailHtml, buildMimeMessage } from "./emailBoost";

describe("emailBoost", () => {
  it("wraps plain text body in a readable, responsive email frame", () => {
    const html = buildEmailHtml("Hello world.\n\nThis is a test.", "Pedram");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Hello world.");
    expect(html).toContain('role="presentation"');
    expect(html).toContain("background-color:#ffffff");
    expect(html).toContain('class="email-content"');
    expect(html).toContain("@media only screen and (max-width: 620px)");
    expect(html).not.toContain("box-shadow");
    expect(html).not.toContain("text-transform:uppercase");
    expect(html).not.toContain("The Urban Monk");
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
    expect(mime).not.toContain("The Urban Monk");
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

  it("does not add hidden deliverability payloads or quoted-printable artifacts", () => {
    const html = buildEmailHtml("Test body.", "User");
    expect(html).not.toContain("boostData");
    expect(html).not.toContain("=E2=80=8B");
    expect(html).not.toContain("=E2=80=93");
  });
});
