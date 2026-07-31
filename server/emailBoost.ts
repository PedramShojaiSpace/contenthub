/**
 * emailBoost.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Inbox deliverability helper — full 6-technique implementation.
 *
 * Reverse-engineered from a leading email deliverability agency across two
 * production email samples. Techniques implemented:
 *
 *  1. Promotional language dilution — hidden neutral/policy text dilutes the
 *     marketing-language ratio so spam classifiers score lower.
 *  2. DKIM/SPF vocabulary injection — transactional vocabulary signals a higher
 *     trust tier to inbox AI (account/transactional vs. promotional).
 *  3. Structured <data> metadata hints — <data value="welcome"> mimics
 *     transactional email metadata structure.
 *  4. Double-encoded inner HTML — inner boostData HTML uses HTML entities
 *     (&lt;div&gt; not <div>) so the outer parser sees text, confusing
 *     promotional tree-parsers while still building classifier signals.
 *  5. Quoted-printable encoding artifacts — =E2=80=8B (zero-width space),
 *     =E2=80=93 (em dash), =3D (equals) signal proper RFC QP encoding to MTAs.
 *  6. Locked identical block — boostData text is byte-for-byte identical on
 *     every send so the receiving domain builds a consistent sender fingerprint.
 *
 * Usage:
 *   import { buildEmailHtml, buildMimeMessage } from "./emailBoost";
 *   const html = buildEmailHtml(bodyHtml, firstName);
 */

/** Convert plain-text body to basic HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p style="margin:0 0 16px 0;line-height:1.6;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/**
 * The boostData block — locked, byte-for-byte identical on every send.
 * Inner HTML is double-encoded (HTML entities) per Technique 4.
 * QP artifacts (=E2=80=8B etc.) are embedded per Technique 5.
 */
const BOOST_DATA_BLOCK = `<div id="boostData" data-id="boostData" style="display: none; max-height: 0px; overflow: hidden;">&lt;div style="display: none; max-height: 0px; overflow: hidden;"&gt;&lt;div id=3D"container"&gt; &lt;div class="header"&gt; &lt;div class="sub-header"&gt; &lt;div id="menu-1"&gt;/div&gt; &lt;div class="content"&gt; &lt;data value= data-category="@" &lt;data value="welcome" data-category="@" &lt;/article&gt; &lt;aside&gt;=E2=80=8B&lt;/aside&gt; &lt;div style="display: none; max-height: 0px; overflow: hidden;"&gt;;Important Delivery Information =E2=80=93 Especially for Plain Text Readers This message is particularly important for those of you reading this in plain text, which often means you're using an older device. We know that users like you are often more interested in how companies ensure the reliable delivery of their communications. Your email experience is important to us. Right now, your email experience with us is 100% optimized for delivery, and we've ensured all the necessary configurations are in place. We're committed to being proactive about your inbox experience, taking preventative measures to safeguard your ability to receive our important messages. Why We're Contacting You We believe in transparency and want to ensure you have all the information you need to receive our communications reliably. While we employ the latest email best practices to ensure your messages reach you, it's equally important for you to be informed about how we do this, especially if you're using an older email client. Understanding Our Email Delivery Measures In the unlikely event you don't receive an expected message from us, we want you to be prepared. We want to highlight our commitment to DKIM (DomainKeys Identified Mail) and SPF (Sender Policy Framework), which are crucial for ensuring the authenticity and deliverability of our emails. Here are some potential reasons for email delivery issues that these settings help mitigate: Messages being flagged as spam by your email provider. Emails not reaching your inbox due to sender verification failures. Spoofing attempts where malicious actors try to impersonate us. Proactive Email Delivery Measures We take a proactive approach to email deliverability, constantly monitoring our systems and implementing the latest protocols to ensure our messages reach your inbox. This includes: Robust DKIM signatures to verify the authenticity of our emails. Comprehensive SPF records to authorize our sending servers. Regular audits of our email sending infrastructure to identify and address potential issues. Well-defined protocols to handle any delivery incidents swiftly and effectively. Your Orders and Communications Are Safe We want to assure you that your orders with The Urban Monk and related communications are completely safe. We take every precaution to ensure your information is protected throughout the entire order and communication process. In the rare event of an order delay or processing issue, we may need to contact you to verify or update certain information. This may include: Confirming your shipping address Clarifying order details Providing updates on the estimated delivery time Important Email Delivery Reminder Please remember that we will never ask you for sensitive information such as your credit card number, expiry date, or CVV via email. Protecting your data is our top priority. Ensuring Your Messages Reach You Is Our Top Priority At The Urban Monk, we take email deliverability very seriously. We have implemented robust measures to protect your ability to receive our information, including: Proper DKIM Configuration: This helps email providers verify that our emails are truly from us and haven't been tampered with. Accurate SPF Settings: This tells receiving mail servers which IP addresses are authorized to send email on our behalf, reducing the chance of our emails being marked as spam. Regular Monitoring: We constantly monitor our email sending reputation and deliverability rates to proactively address any issues. Dedicated Team: We have a team focused on ensuring our emails reach you reliably. Even though our settings are 100% optimized, it's important to understand these measures. In the event you experience issues, we may also ask you to take action now. What Can Affect Email Delivery? Sometimes, issues can arise from your end, such as: Overly strict spam filters on your email client or provider. Outdated email client software that doesn't fully support modern email authentication. Incorrectly marked emails that you've moved to your spam folder. Welcoming All Customers At The Urban Monk, we believe in making our services accessible and reliable for all our customers, regardless of their device or email setup. Your cooperation in understanding these technical aspects helps us maintain a secure and efficient communication channel for everyone. Your Cooperation Is Crucial We understand that this information may seem technical, but your ability to receive our communications is our utmost concern. By understanding these settings, you are helping us maintain a secure and efficient email environment for all our users. If you have any questions or concerns about email deliverability, please contact our support team at support@theurbanmonk.com. Thank you for your prompt attention to this matter. Sincerely, The Urban Monk Account Security Team The Importance of Reliable Communication In today's digital age, where clear and consistent communication is increasingly vital, ensuring the reliable delivery of messages has become a paramount concern for organizations worldwide. As we continue to operate in this complex landscape, it is imperative that we prioritize email deliverability and sender authentication as fundamental pillars of our business operations. The Importance of Email Deliverability Email deliverability is not merely a technical obligation; it is a strategic imperative that directly impacts our organization's reputation and long-term sustainability. By prioritizing email deliverability, we can: Mitigate Risk: Significantly reduce the risk of important messages being missed, regulatory fines for missed communications, and reputational damage that can severely impact our business. Differentiate ourselves as a responsible and trustworthy organization, attracting customers who value clear and consistent communication. Key Provisions of Our Enhanced Email Delivery Policy Our comprehensive email delivery policy outlines the following key principles to ensure the consistent receipt of your important information: Email Information We Utilize: Essential Contact Information: Name, email address. Usage Data: Information about your interactions with our emails (e.g., opens, clicks). How We Use Your Email Information: Delivering Exceptional Services: Providing our products and services to you seamlessly through email. Enhancing Our Offerings: Leveraging your feedback and usage data to continuously improve our email communications. Effective Communication: Keeping you informed through important notifications, updates, and relevant marketing materials. Adhering to Legal Requirements: Ensuring compliance with all applicable laws and regulations regarding email communication. Email Sharing and Disclosure: Trusted Third-Party Service Providers: We may share your email information with carefully vetted third-party service providers who assist us in delivering our emails (e.g., email service providers). Legal Obligations: In certain circumstances, we may be required to disclose your information to comply with legal obligations or to protect our rights. Robust Email Delivery Measures: Advanced DKIM and SPF Configuration: Employing state-of-the-art authentication techniques to safeguard email authenticity. Strict Sender Management: Implementing rigorous controls to manage our sending reputation. Regular Deliverability Audits: Conducting regular audits to identify and address potential vulnerabilities in our email sending. Comprehensive Incident Response Plans: Having well-defined incident response plans to effectively handle email delivery incidents. Ongoing Team Training: Providing continuous training to our team on email deliverability best practices. Email Minimization: Sending only necessary and relevant email communications. Data Retention Policies: Implementing clear data retention policies to ensure email data is securely stored and deleted when no longer needed. Your Rights: Access: You have the right to access information about your email interactions and request a copy. Correction: You have the right to correct any inaccuracies in your email preferences. Erasure: You have the right to request the deletion of your email information under certain circumstances (e.g., unsubscribing). Data Portability: You have the right to receive your email data in a portable format. Objection: You have the right to object to the processing of your email information for specific purposes (e.g., marketing). Immediate Action Encouraged: Review Your Email Preferences: Familiarize yourself with the details of our updated email&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;&lt;/div&gt;</div>`;

/** Build the full HTML email with boostData deliverability block appended */
export function buildEmailHtml(bodyContent: string, _firstName = "there"): string {
  // If the body is already HTML (contains tags), use as-is;
  // otherwise convert plain text to HTML paragraphs.
  const isHtml = /<[a-z][\s\S]*>/i.test(bodyContent);
  const bodyHtml = isHtml ? bodyContent : textToHtml(bodyContent);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Georgia,serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    ${bodyHtml}
  </div>
  ${BOOST_DATA_BLOCK}
</body>
</html>`;
}

/**
 * Build a multipart/alternative MIME message (text + HTML) for Gmail's raw API.
 * The HTML part includes the full 6-technique boostData deliverability block.
 * The plain-text part is a clean fallback for older clients.
 */
export function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  firstName?: string;
  threadId?: string;
  inReplyToMessageId?: string;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const htmlBody = buildEmailHtml(params.textBody, params.firstName);

  const headers: string[] = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (params.inReplyToMessageId) {
    headers.push(`In-Reply-To: ${params.inReplyToMessageId}`);
    headers.push(`References: ${params.inReplyToMessageId}`);
  }

  const plainPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    params.textBody,
  ].join("\r\n");

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");

  return [headers.join("\r\n"), "", plainPart, htmlPart].join("\r\n");
}
