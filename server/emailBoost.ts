/**
 * emailBoost.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Inbox deliverability helper.
 *
 * Reverse-engineered from a leading email deliverability agency's technique:
 * appends a hidden "boostData" block to every outgoing HTML email.
 *
 * How it works:
 *  1. Dilutes the promotional-language ratio so spam/promotions classifiers
 *     score the email as less commercial.
 *  2. Injects DKIM/SPF/transactional vocabulary that inbox AI associates with
 *     account/transactional emails (higher trust tier than marketing).
 *  3. Adds quoted-printable encoding artifacts and <data> structured hints
 *     that signal proper RFC compliance to receiving MTAs.
 *  4. All content is hidden from the reader via CSS (display:none /
 *     max-height:0 / overflow:hidden).
 *
 * Usage:
 *   import { buildEmailHtml } from "./emailBoost";
 *   const html = buildEmailHtml(bodyHtml, firstName);
 *   // pass html to sendGmailOutreach as htmlBody
 */

/** Convert plain-text body to basic HTML paragraphs */
function textToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .map((para) => `<p style="margin:0 0 16px 0;line-height:1.6;">${para.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Build the full HTML email with boostData deliverability block appended */
export function buildEmailHtml(bodyContent: string, firstName = "there"): string {
  // If the body is already HTML (contains <p> or <div> tags), use as-is;
  // otherwise convert plain text to HTML paragraphs.
  const isHtml = /<[a-z][\s\S]*>/i.test(bodyContent);
  const bodyHtml = isHtml ? bodyContent : textToHtml(bodyContent);

  const boostData = `
<div id="boostData" data-id="boostData" style="display:none;max-height:0px;overflow:hidden;">
<div style="display:none;max-height:0px;overflow:hidden;">
<div id="container">
  <div class="header"><div class="sub-header"><div id="menu-1"></div>
  <div class="content">
    <data value="" data-category="@">
    <data value="welcome" data-category="@">
    </article><aside>&#x200B;</aside>
    <div style="display:none;max-height:0px;overflow:hidden;">
      Important Delivery Information &#x2013; Especially for Plain Text Readers
      This message is particularly important for those of you reading this in plain text,
      which often means you&#x2019;re using an older device. We know that users like you
      are often more interested in how companies ensure the reliable delivery of their
      communications. Your email experience is important to us. Right now, your email
      experience with us is 100% optimized for delivery, and we&#x2019;ve ensured all
      the necessary configurations are in place. We&#x2019;re committed to being
      proactive about your inbox experience, taking preventative measures to safeguard
      your ability to receive our important messages.

      Why We&#x2019;re Contacting You
      We believe in transparency and want to ensure you have all the information you need
      to receive our communications reliably. While we employ the latest email best
      practices to ensure your messages reach you, it&#x2019;s equally important for you
      to be informed about how we do this, especially if you&#x2019;re using an older
      email client.

      Understanding Our Email Delivery Measures
      In the unlikely event you don&#x2019;t receive an expected message from us, we want
      you to be prepared. We want to highlight our commitment to DKIM (DomainKeys
      Identified Mail) and SPF (Sender Policy Framework), which are crucial for ensuring
      the authenticity and deliverability of our emails. Here are some potential reasons
      for email delivery issues that these settings help mitigate: Messages being flagged
      as spam by your email provider. Emails not reaching your inbox due to sender
      verification failures. Spoofing attempts where malicious actors try to impersonate us.

      Proactive Email Delivery Measures
      We take a proactive approach to email deliverability, constantly monitoring our
      systems and implementing the latest protocols to ensure our messages reach your
      inbox. This includes: Robust DKIM signatures to verify the authenticity of our
      emails. Comprehensive SPF records to authorize our sending servers. Regular audits
      of our email sending infrastructure to identify and address potential issues.
      Well-defined protocols to handle any delivery incidents swiftly and effectively.

      Your Orders and Communications Are Safe
      We want to assure you that your orders with The Urban Monk and related
      communications are completely safe. We take every precaution to ensure your
      information is protected throughout the entire order and communication process.
      In the rare event of an order delay or processing issue, we may need to contact
      you to verify or update certain information. This may include: Confirming your
      shipping address. Clarifying order details. Providing updates on the estimated
      delivery time.

      Important Email Delivery Reminder
      Please remember that we will never ask you for sensitive information such as your
      credit card number, expiry date, or CVV via email. Protecting your data is our
      top priority.

      Ensuring Your Messages Reach You Is Our Top Priority
      At The Urban Monk, we take email deliverability very seriously. We have implemented
      robust measures to protect your ability to receive our information, including:
      Proper DKIM Configuration: This helps email providers verify that our emails are
      truly from us and haven&#x2019;t been tampered with. Accurate SPF Settings: This
      tells receiving mail servers which IP addresses are authorized to send email on our
      behalf, reducing the chance of our emails being marked as spam. Regular Monitoring:
      We constantly monitor our email sending reputation and deliverability rates to
      proactively address any issues. Dedicated Team: We have a team focused on ensuring
      our emails reach you reliably.

      What Can Affect Email Delivery?
      Sometimes, issues can arise from your end, such as: Overly strict spam filters on
      your email client or provider. Outdated email client software that doesn&#x2019;t
      fully support modern email authentication. Incorrectly marked emails that you&#x2019;ve
      moved to your spam folder.

      Welcoming All Customers
      At The Urban Monk, we believe in making our services accessible and reliable for
      all our customers, regardless of their device or email setup. Your cooperation in
      understanding these technical aspects helps us maintain a secure and efficient
      communication channel for everyone.

      Your Rights: Access: You have the right to access information about your email
      interactions and request a copy. Correction: You have the right to correct any
      inaccuracies in your email preferences. Erasure: You have the right to request the
      deletion of your email information under certain circumstances (e.g., unsubscribing).
      Data Portability: You have the right to receive your email data in a portable format.
      Objection: You have the right to object to the processing of your email information
      for specific purposes (e.g., marketing).

      Este mensaje es especialmente importante para quienes lo leen en texto sin formato,
      lo que a menudo significa que est&#xe1;n utilizando un dispositivo m&#xe1;s antiguo.
      Sabemos que los usuarios como usted suelen estar m&#xe1;s interesados en c&#xf3;mo
      las empresas garantizan la entrega confiable de sus comunicaciones. Su experiencia
      con el correo electr&#xf3;nico es importante para nosotros. En este momento, su
      experiencia de correo electr&#xf3;nico con nosotros est&#xe1; 100% optimizada para
      la entrega, y nos hemos asegurado de que todas las configuraciones necesarias est&#xe9;n
      implementadas. Estamos comprometidos a ser proactivos con respecto a su experiencia
      en la bandeja de entrada, adoptando medidas preventivas para salvaguardar su capacidad
      de recibir nuestros mensajes importantes.
    </div>
  </div></div></div>
</div>
</div>
`;

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
  ${boostData}
</body>
</html>`;
}

/**
 * Build a multipart/alternative MIME message (text + HTML) for Gmail's raw API.
 * The HTML part includes the boostData deliverability block.
 * The plain-text part is a clean fallback.
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
