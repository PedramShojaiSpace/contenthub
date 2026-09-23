import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outputRoot = '/home/ubuntu/lights-on-optin/docs/interconnected-buyer-final-html-2026-09-23';
const htmlDir = join(outputRoot, 'html');
const libraryUrl = 'https://theacademy.theurbanmonk.com/library';
const courseUrl = 'https://theacademy.theurbanmonk.com/products/interconnected-series-self-guided';
const supportEmail = 'support@theurbanmonk.com';

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

const paragraph = (text) => `<p style="margin:0 0 18px;color:#263238;font-size:17px;line-height:1.65">${text}</p>`;
const cta = (label, href) => `<p style="margin:26px 0 24px;font-size:17px;line-height:1.6"><a href="${href}" style="color:#1a4b7a;text-decoration:underline;font-weight:700">${escapeHtml(label)} →</a></p>`;
const list = (items) => `<ul style="margin:0 0 22px 22px;padding:0;color:#263238;font-size:17px;line-height:1.65">${items.map((item) => `<li style="margin:0 0 8px 0">${item}</li>`).join('')}</ul>`;
const close = (text = 'Dr. Pedram Shojai') => paragraph(text);

function emailHtml(body) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#263238;background:#ffffff;padding:0;margin:0;max-width:640px"><div style="padding:24px 0 18px;border-bottom:2px solid #d9a441"><div style="font-size:22px;font-weight:700;letter-spacing:.2px;color:#1a4b7a">The Urban Monk</div></div><div style="padding:28px 0 8px">${body}</div></div>`;
}

const emails = [
  {
    number: '01',
    filename: '01-access-delivery.html',
    internalTitle: '01 - Access Delivery (transactional review)',
    timing: 'Immediately / Day 0',
    subject: 'Your Interconnected access is ready',
    preview: 'Start with the series when you are ready.',
    ctaDestination: libraryUrl,
    body: () => [
      paragraph(`You’re in. Thank you for investing in your health—and in getting real answers instead of more noise.`),
      paragraph(`Your Interconnected access is ready in your library. Start with the full series, move at your own pace, and come back whenever you need to.`),
      list([
        `Your paid Interconnected library`,
        `The complete Interconnected series`,
        `A place to return to as you make sense of what applies to you`,
      ]),
      paragraph(`A word before you dive in: don’t try to do all of it tonight. Start with one episode. Notice the one idea that lands. That is enough for today.`),
      paragraph(`Questions or trouble getting in? Reply here or write us at <a href="mailto:${supportEmail}" style="color:#1a4b7a;text-decoration:underline">${supportEmail}</a>—a real person will help.`),
      cta('Open my Interconnected library', libraryUrl),
      close('To your health,<br>Dr. Pedram Shojai'),
    ].join(''),
  },
  {
    number: '02',
    filename: '02-day-1-start-small.html',
    internalTitle: '02 - Day 1 Start Small',
    timing: 'Day 1, 8:00 AM PDT',
    subject: 'Start with one episode—not everything',
    preview: 'The goal is not to finish it. It is to notice one thing.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`Yesterday you got access to the full series. Today, forget most of it.`),
      paragraph(`The fastest way to turn a good resource into background noise is to try to absorb everything at once. You do not need a perfect plan. You need one honest observation.`),
      paragraph(`Choose the first episode. Watch it without trying to take perfect notes. When something feels familiar, pause and write one sentence about it.`),
      paragraph(`That one sentence is enough to begin.`),
      cta('Start with Interconnected', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '03',
    filename: '03-day-1-paid-orientation.html',
    internalTitle: '03 - Day 1 Orientation',
    timing: 'Day 1, 9:00 AM PDT',
    subject: 'How to get more from every episode',
    preview: 'One useful note beats an hour of passive watching.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`There is a difference between watching something and using it.`),
      paragraph(`As you move through the series, keep one page open beside you. Each time an idea makes you think, “that might be me,” write it down. Not a summary. Just the pattern that felt personal.`),
      paragraph(`By the end, you will have a short, honest list of questions and observations that are actually yours. That is more useful than trying to remember every fact.`),
      cta('Continue with the series', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '04',
    filename: '04-day-3-series-activation.html',
    internalTitle: '04 - Day 3 Series Activation',
    timing: 'Day 3, 8:00 AM PDT',
    subject: 'Watch less, notice more',
    preview: 'A slower approach can create a more useful map.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`Most health content is consumed quickly and forgotten just as quickly. Interconnected will be more useful if you give it enough room to become part of your own observation.`),
      paragraph(`When you watch the next episode, look for one practical idea that feels manageable this week. You are not trying to overhaul your life. You are building a map, one useful signal at a time.`),
      paragraph(`The work becomes more valuable when it is connected to your real days—not just your screen.`),
      cta('Open the next episode', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '05',
    filename: '05-day-6-one-change.html',
    internalTitle: '05 - Day 6 One Change',
    timing: 'Day 6, 8:00 AM PDT',
    subject: 'Pick one thing this week',
    preview: 'Not fifty changes. One change worth protecting.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`You have watched, noticed, and started to see a few patterns. Now choose one small change you are genuinely willing to protect for the next seven days.`),
      paragraph(`One. Something you can actually keep.`),
      paragraph(`It might be the first meal of the day. It might be making one evening calmer. It might be choosing one food habit to pay closer attention to. Keep it simple enough that you can notice what happens.`),
      paragraph(`Consistency beats intensity. Every time.`),
      cta('Return to the series', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '06',
    filename: '06-day-9-patterns.html',
    internalTitle: '06 - Day 9 Pattern Mapping',
    timing: 'Day 9, 8:00 AM PDT',
    subject: 'Turn what you are noticing into a useful question',
    preview: 'You do not need to guess. Start by observing more clearly.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`The series can give you a smart starting point. Your job is not to diagnose yourself from a screen. It is to notice what is true in your own life and turn it into a better question.`),
      paragraph(`Look back at the notes you have made so far. Is there a pattern around food, energy, sleep, stress, or digestion that shows up more than once?`),
      paragraph(`Write it as a plain question. Then continue with the next episode with that question in mind. Clear observation is a far better place to start than a hunch.`),
      cta('Keep mapping your patterns', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '07',
    filename: '07-day-13-connect-the-dots.html',
    internalTitle: '07 - Day 13 Connect the Dots',
    timing: 'Day 13, 8:00 AM PDT',
    subject: 'Connect the dots without forcing an answer',
    preview: 'A useful health map starts with better questions.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`A couple of weeks in, you may have more questions than answers. That is not failure. It is usually a sign that you are paying closer attention.`),
      paragraph(`Go back to the thread you noticed on Day 1. What has the series helped you see more clearly? What still feels uncertain?`),
      paragraph(`Keep the question open long enough to learn from it. You do not have to force a conclusion before you have enough information.`),
      cta('Continue Interconnected', courseUrl),
      close(),
    ].join(''),
  },
  {
    number: '08',
    filename: '08-day-17-keep-it-simple.html',
    internalTitle: '08 - Day 17 Keep It Simple',
    timing: 'Day 17, 8:00 AM PDT',
    subject: 'You do not need a perfect plan',
    preview: 'The next useful step is the one you can actually take.',
    ctaDestination: courseUrl,
    body: () => [
      paragraph(`There is no universal right way to use a resource like this. The useful next step is the one that fits where you are right now.`),
      paragraph(`If you are making steady changes and noticing momentum, keep going. If you are stuck, return to the episode or idea that felt most personal and simplify the next move.`),
      paragraph(`The point is not to be impressive. The point is to be honest, consistent, and curious enough to keep learning.`),
      cta('Revisit your Interconnected library', libraryUrl),
      close(),
    ].join(''),
  },
  {
    number: '09',
    filename: '09-day-24-reengagement.html',
    internalTitle: '09 - Day 24 Re-engagement',
    timing: 'Day 24, 8:00 AM PDT',
    subject: 'One small change, protected',
    preview: 'Coming back counts. You are not behind.',
    ctaDestination: libraryUrl,
    body: () => [
      paragraph(`If the last couple of weeks got busy and the series slipped down your list, that is normal. You are not behind. The work is simply coming back.`),
      paragraph(`Do not reopen everything. Do not restart the whole plan. Come back to one question:`),
      paragraph(`<em>What is one small change I am willing to protect for the next seven days?</em>`),
      paragraph(`Protect one thing for a week and you rebuild the muscle that makes the rest possible.`),
      cta('Reopen my library', libraryUrl),
      close(),
    ].join(''),
  },
  {
    number: '10',
    filename: '10-day-30-progress-review.html',
    internalTitle: '10 - Day 30 Progress Review',
    timing: 'Day 30, 8:00 AM PDT',
    subject: 'A month in—look back before you look forward',
    preview: 'Notice what has shifted, then choose one next step.',
    ctaDestination: libraryUrl,
    body: () => [
      paragraph(`It has been about a month since you started. Before anything else, look back.`),
      paragraph(`What is different? Maybe it is obvious. Maybe it is subtle. You may have more energy, a clearer sense of your own patterns, or simply a better question than you had thirty days ago. All of that counts.`),
      paragraph(`The first month is where you prove to yourself that change is possible. The months after are where it becomes part of how you live.`),
      paragraph(`Keep going at a pace you can sustain. Your library is there whenever you are ready to return.`),
      cta('Continue with Interconnected', libraryUrl),
      close('To your health,<br>Dr. Pedram Shojai'),
    ].join(''),
  },
];

const manifestRows = emails.map((email) => `| ${email.number} | ${email.internalTitle} | ${email.timing} | ${email.subject} | ${email.preview} | ${email.filename} |`).join('\n');
const readme = `# Jim’s Paste-Ready Kajabi Buyer Email Packet\n\n**Created:** 23 September 2026  \n**Purpose:** Replace the entire body of each draft Kajabi buyer email with a finished, direct-link version.\n\n## What has been fixed\n\nAll ten HTML files use only real, full destinations. This packet contains **no raw placeholder tokens**, no empty links, no relative URLs, and no old $199 testing CTA. The old testing/Upstream recovery copy has been removed because the live $99 Upstream OCU checkout page is an OCU-only page whose public copy does not match this $67 buyer sequence.\n\nThe buyer sequence is now a clean **access and engagement** sequence. The Kajabi checkout continues to own the native $99 Upstream OCU. A later Klaviyo buyer-lifecycle flow can add the approved Upstream follow-up once its dedicated buyer-safe destination and flow are live.\n\n## Jim’s exact job\n\n1. Open only **[DRAFT] Interconnected Paid Buyer Lifecycle — $67 + $99** in Kajabi. Do not activate it, add subscribers, or attach a trigger.\n2. For each row below, open the matching Kajabi email and set the **internal title**, **subject**, and **preview text** exactly as shown.\n3. Click **Edit content**, select the main text block, and open the **source-code / HTML** editor.\n4. Select everything inside that source field and paste the complete matching file from the HTML folder.\n5. Apply/save the source block, then save the message. Reopen it and verify the visible body is correct.\n6. Send an internal test. In the received email—not only the Kajabi editor—click every link.\n7. Report the ten test results, but do not turn on the sequence.\n\n## Message map\n\n| # | Kajabi internal title | Current timing—do not change | Subject | Preview text | Paste this file |\n|---:|---|---|---|---|---|\n${manifestRows}\n\n## Destination audit\n\n| Link purpose | Exact destination |\n|---|---|\n| Buyer library | ${libraryUrl} |\n| Entitled paid series | ${courseUrl} |\n| Support | mailto:${supportEmail} |\n\n## Final quality check\n\n- Every visible CTA opens the intended destination from the received test email.\n- The support address opens a new email addressed to ${supportEmail}.\n- No raw HTML, unresolved token, old $199 testing language, testing-product CTA, webinar CTA, companion-guide promise, protocol promise, masterclass promise, or community promise remains.\n- Kajabi footer and unsubscribe controls remain present.\n- The buyer course route is checked with an entitled buyer after sign-in.\n- The sequence remains at **0 subscribers** and **0 subscriber triggers** pending owner approval.\n\n## Important\n\nThis packet deliberately does not promote the $99 Upstream Course through a follow-up email. The current $99 offer is configured as a Kajabi one-click upsell, and its accessible checkout page uses different buyer context and copy. Do not reuse it in this fulfillment sequence until the dedicated buyer follow-up page and Klaviyo lifecycle are approved.\n`;

await rm(outputRoot, { recursive: true, force: true });
await mkdir(htmlDir, { recursive: true });
for (const email of emails) {
  await writeFile(join(htmlDir, email.filename), emailHtml(email.body()), 'utf8');
}
await writeFile(join(outputRoot, 'README-START-HERE.md'), readme, 'utf8');
await writeFile(join(outputRoot, 'manifest.json'), JSON.stringify({
  createdAt: new Date().toISOString(),
  package: 'Interconnected Buyer Email — Final Paste-Ready HTML',
  status: 'draft-only; do not activate or enroll',
  messages: emails.map(({ body, ...rest }) => rest),
}, null, 2), 'utf8');
console.log(JSON.stringify({ outputRoot, htmlCount: emails.length, files: emails.map(({ filename }) => filename) }, null, 2));
