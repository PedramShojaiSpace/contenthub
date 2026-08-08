import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join('/home/ubuntu/lights-on-optin', '.env') });

const key = process.env.KLAVIYO_PRIVATE_KEY;

const emails = [
  {
    name: "Tantra Seq 1 — Your results are in",
    subject: "Your Tantra Vitality results are in, {{ first_name|default:'friend' }}",
    preview: "Here's what your quiz revealed — and what to do next.",
    body: `<p>{{ first_name|default:'Friend' }},</p>
<p>You just took the Tantra Vitality Quiz, and I want to make sure you actually understand what your results mean — because most people gloss over this and miss the most important part.</p>
<p>Your quiz flagged a pattern I've seen hundreds of times in clinical practice. It's not a disease. It's not a character flaw. It's a depletion signal — your body telling you that something fundamental has been running on empty for a while.</p>
<p>In Taoist medicine, we call this <em>jing</em> depletion. Jing is your foundational life essence — the deep reservoir that powers your vitality, your drive, your presence, and yes, your sexual energy. When it's full, everything works. When it's depleted, nothing does.</p>
<p>The modern world is extraordinarily good at draining it. Chronic stress, poor sleep, processed food, environmental toxins, and the relentless pace of life all pull from this reservoir without replenishing it.</p>
<p>The good news: it's replenishable. That's exactly what Tantra was designed to do.</p>
<p>I spent 10 years as a Taoist monk studying this. I've spent 25 years in clinical practice applying it. The protocol I built is the most direct path I know to restoring what's been depleted.</p>
<p><strong>Your personalized protocol is waiting:</strong></p>
{% if person.tantra_quiz_result == "tantra_her" %}
<p><a href="https://shop.theurbanmonk.com/cart/48859466268826:1" style="background:#9B59B6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Her — $185/mo →</a></p>
{% else %}
<p><a href="https://shop.theurbanmonk.com/cart/48859465842842:1" style="background:#B8860B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Him — $185/mo →</a></p>
{% endif %}
<p>More tomorrow.</p>
<p>— Dr. Pedram Shojai</p>`
  },
  {
    name: "Tantra Seq 2 — The thing nobody tells you",
    subject: "The thing nobody tells you about low energy (it's not what you think)",
    preview: "Your doctor checked your labs. They came back \"normal.\" And yet…",
    body: `<p>{{ first_name|default:'Friend' }},</p>
<p>Your labs came back normal.</p>
<p>Your doctor said you're fine. Maybe they handed you an antidepressant, or told you to sleep more, or suggested you were just stressed. And you walked out of that office feeling more alone than when you walked in.</p>
<p>I've heard this story thousands of times.</p>
<p>Here's what's actually happening: conventional medicine is extraordinarily good at finding acute disease. It is almost completely blind to the slow, systemic depletion that happens when your body's foundational systems start running below optimal.</p>
<p>The thyroid panel doesn't measure mitochondrial function. The CBC doesn't measure your jing. The testosterone panel gives you a number but doesn't tell you why it's declining or what to do about it beyond a prescription.</p>
<p>I went on a 10-year mission to find what conventional medicine was missing. I trained under masters in China. I studied functional medicine before it had a name. I built a clinical practice around the question: <em>what does the body actually need to thrive?</em></p>
<p>The answer is always the same: you have to go upstream. You have to address the root depletion before any downstream intervention will hold.</p>
<p>That's the foundation of the Tantra protocol. It's not a band-aid. It's a root-level restoration.</p>
{% if person.tantra_quiz_result == "tantra_her" %}
<p><a href="https://shop.theurbanmonk.com/cart/48859466268826:1" style="background:#9B59B6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Her — $185/mo →</a></p>
{% else %}
<p><a href="https://shop.theurbanmonk.com/cart/48859465842842:1" style="background:#B8860B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Him — $185/mo →</a></p>
{% endif %}
<p>— Dr. Pedram</p>`
  },
  {
    name: "Tantra Seq 3 — What the monastery taught me",
    subject: "What 10 years in a monastery taught me about desire",
    preview: "This isn't about sex. It's about life force.",
    body: `<p>{{ first_name|default:'Friend' }},</p>
<p>When I was training in the mountains of China, my teacher said something I've never forgotten:</p>
<p><em>"A man who has lost his desire has lost his direction. A woman who has lost her fire has lost her center. This is not a small thing."</em></p>
<p>He wasn't talking about sex in the way we talk about it in the West. He was talking about the animating force that makes you want to get out of bed in the morning. The energy that makes you curious, creative, present, and alive.</p>
<p>When that force dims, everything dims with it. Your relationships feel flat. Your work feels mechanical. You go through the motions. You wonder if this is just what getting older feels like.</p>
<p>It isn't.</p>
<p>I've worked with people in their 60s and 70s who have more vitality than most 35-year-olds I know. The difference isn't genetics. It's whether they've been tending to their foundational energy — or spending it without replenishing it.</p>
<p>The Tantra protocol addresses this at the root. The compounds we use have been studied for decades for their effects on hormonal balance, mitochondrial function, and the neuroendocrine pathways that govern your life force.</p>
<p>This isn't a stimulant. It's a restoration.</p>
{% if person.tantra_quiz_result == "tantra_her" %}
<p><a href="https://shop.theurbanmonk.com/cart/48859466268826:1" style="background:#9B59B6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Her — $185/mo →</a></p>
{% else %}
<p><a href="https://shop.theurbanmonk.com/cart/48859465842842:1" style="background:#B8860B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Him — $185/mo →</a></p>
{% endif %}
<p>— Dr. Pedram</p>`
  },
  {
    name: "Tantra Seq 4 — The patient who changed everything",
    subject: "The patient who changed how I think about this",
    preview: "He was 54. His wife had given up. Then something shifted.",
    body: `<p>{{ first_name|default:'Friend' }},</p>
<p>I want to tell you about a patient I'll call Marcus.</p>
<p>He was 54 when he came to see me. Successful by every external measure — career, family, financial security. But he told me something in our first session that I've heard in some form from nearly every person who walks through my door:</p>
<p><em>"I don't recognize myself anymore."</em></p>
<p>His energy was gone. His drive was gone. His marriage was struggling. His wife had stopped reaching for him, and he'd stopped reaching back — not out of indifference, but because the reaching felt like too much effort.</p>
<p>His labs were, of course, "normal."</p>
<p>We spent six months working upstream. Sleep, gut, stress physiology, hormonal support. The Tantra protocol was part of that foundation.</p>
<p>At month three, his wife called my office. She said: <em>"I don't know what you did, but I have my husband back."</em></p>
<p>I'm not telling you this to sell you something. I'm telling you this because I've watched this pattern resolve hundreds of times, and I want you to understand that what you're experiencing is not permanent. It's not who you are. It's a state your body has gotten into — and states can change.</p>
<p>The protocol is waiting for you.</p>
{% if person.tantra_quiz_result == "tantra_her" %}
<p><a href="https://shop.theurbanmonk.com/cart/48859466268826:1" style="background:#9B59B6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Her — $185/mo →</a></p>
{% else %}
<p><a href="https://shop.theurbanmonk.com/cart/48859465842842:1" style="background:#B8860B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Him — $185/mo →</a></p>
{% endif %}
<p>— Dr. Pedram</p>`
  },
  {
    name: "Tantra Seq 5 — Last note from me",
    subject: "Last note from me on this, {{ first_name|default:'friend' }}",
    preview: "I'm not going to keep asking. But I want you to have this before I stop.",
    body: `<p>{{ first_name|default:'Friend' }},</p>
<p>This is my last email about your Tantra Vitality results.</p>
<p>I've shared the science, the clinical stories, the philosophy behind what we built. I've given you everything I know about why this matters and what it can do.</p>
<p>At this point, you either feel the pull toward it or you don't. And I respect that completely.</p>
<p>But before I close this chapter, I want to say one more thing:</p>
<p>The people who don't act on this usually tell themselves they'll do it later. When things slow down. When they have more time. When they feel worse enough that it becomes urgent.</p>
<p>I've watched that pattern play out for 25 years. The "later" rarely comes on its own. The depletion doesn't reverse itself. And the gap between who you are now and who you could be tends to widen, not close.</p>
<p>You took the quiz. Something in you was asking a question. I'd like to help you answer it.</p>
<p>The Tantra protocol is compounded by Strive Pharmacy, prescribed through our telemedicine process, and ships discreetly to your door. The first month is the hardest — your body is learning to receive again. By month two, most people notice the shift.</p>
{% if person.tantra_quiz_result == "tantra_her" %}
<p><a href="https://shop.theurbanmonk.com/cart/48859466268826:1" style="background:#9B59B6;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Her — $185/mo →</a></p>
{% else %}
<p><a href="https://shop.theurbanmonk.com/cart/48859465842842:1" style="background:#B8860B;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Start Tantra Him — $185/mo →</a></p>
{% endif %}
<p>I hope to hear from you on the other side.</p>
<p>— Dr. Pedram Shojai</p>`
  }
];

const wrapper = (body, subject, preview) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;padding:40px 48px;">
<p style="font-size:12px;color:#999;margin-bottom:32px;display:none">${preview}</p>
${body}
<hr style="border:none;border-top:1px solid #eee;margin:40px 0">
<p style="font-size:11px;color:#aaa;text-align:center">
Dr. Pedram Shojai · The Urban Monk · <a href="{{ unsubscribe_url }}" style="color:#aaa">Unsubscribe</a>
</p>
</div></body></html>`;

const created = [];
for (const email of emails) {
  const html = wrapper(email.body, email.subject, email.preview);
  const resp = await fetch('https://a.klaviyo.com/api/templates/', {
    method: 'POST',
    headers: {
      'Authorization': `Klaviyo-API-Key ${key}`,
      'revision': '2024-02-15',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        type: 'template',
        attributes: {
          name: email.name,
          html: html
        }
      }
    })
  });
  const data = await resp.json();
  if (data.data?.id) {
    created.push({ name: email.name, id: data.data.id, subject: email.subject });
    console.log(`✅ Created: ${email.name} → ID: ${data.data.id}`);
  } else {
    console.log(`❌ Failed: ${email.name}`, JSON.stringify(data));
  }
}

console.log('\n=== TEMPLATE IDs FOR FLOW BUILDER ===');
created.forEach((t, i) => console.log(`Email ${i+1}: ${t.id} — ${t.name}`));
