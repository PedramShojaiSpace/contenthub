/**
 * Seed script: 8 Urban Monk audience personas with deep intelligence data.
 * Run with: node seed-personas.mjs
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

const personas = [
  {
    name: "Burnout Recovery Seeker",
    slug: "burnout-recovery",
    description: "High-achieving professional (35-55) who has hit a wall — chronic exhaustion, brain fog, emotional flatness. Has tried everything: meditation apps, supplements, therapy. Knows something is fundamentally wrong but can't name it. Desperately wants to feel like themselves again.",
    painPoints: JSON.stringify([
      "Wakes up exhausted even after 8 hours of sleep",
      "Can't focus or think clearly — brain fog is constant",
      "Lost passion for work and relationships",
      "Feels like they're running on fumes but can't stop",
      "Tried meditation apps, supplements, therapy — nothing sticks",
      "Doctors say 'everything looks normal' but they feel terrible",
      "Guilt about not being present for family",
      "Fear that this is just 'getting older'"
    ]),
    aspirations: JSON.stringify([
      "Wake up with genuine energy and enthusiasm",
      "Recover the mental sharpness they had in their 30s",
      "Feel emotionally connected again — to work, family, purpose",
      "Find a sustainable system, not another quick fix",
      "Understand WHY they burned out so they can prevent it",
      "Reclaim their identity beyond their job title"
    ]),
    topQuestions: JSON.stringify([
      "Why am I always tired even when I sleep enough?",
      "What is adrenal fatigue and do I have it?",
      "How do I recover from burnout without quitting my job?",
      "What supplements actually help with burnout recovery?",
      "How long does it take to recover from burnout?",
      "Is my gut health connected to my exhaustion?",
      "What does Pedram Shojai recommend for burnout?",
      "How do I rebuild energy naturally without stimulants?",
      "What ancient practices help with modern burnout?",
      "Can you fully recover from chronic burnout?"
    ]),
    intelligenceReport: "This persona is the Urban Monk's highest-value audience segment. They are in acute pain and actively searching for solutions. They've already tried the mainstream options (therapy, meditation apps, sleep hygiene) and are now open to integrative, root-cause approaches. They respond to content that validates their experience ('you're not lazy, your biology is broken'), explains the science behind their symptoms, and offers a clear pathway to recovery. They are skeptical of hype but respond to clinical credibility combined with personal story. Key triggers: cortisol dysregulation, HPA axis dysfunction, mitochondrial health, gut-brain axis, adrenal recovery protocols. They are most likely to convert to Urban Monk Academy when they see a structured, evidence-based curriculum that addresses the root cause of burnout — not just symptom management. Content goal: Audience Growth + Community Engagement. Platform priority: LinkedIn, Instagram, YouTube.",
    ctaCopy: "You're not broken — your biology is. The Urban Monk Academy gives you the exact protocol Dr. Pedram Shojai uses to rebuild energy, clarity, and vitality from the ground up. Start your recovery today.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "audience_growth",
    icon: "🔋",
    color: "#e07b54"
  },
  {
    name: "Midlife Vitality Optimizer",
    slug: "midlife-vitality",
    description: "45-60 year old who refuses to accept decline as inevitable. Health-conscious, data-driven, already doing many things right. Wants to optimize — not just survive — the second half of life. Interested in longevity science, biohacking, and peak performance.",
    painPoints: JSON.stringify([
      "Noticing physical decline despite doing 'everything right'",
      "Testosterone/hormone changes affecting energy, mood, body composition",
      "Recovery takes longer after exercise",
      "Sleep quality deteriorating",
      "Concerned about cognitive decline and dementia prevention",
      "Feeling invisible in a culture that worships youth",
      "Wants to be active and sharp at 70, 80, 90"
    ]),
    aspirations: JSON.stringify([
      "Optimize healthspan, not just lifespan",
      "Maintain peak cognitive function through their 60s and 70s",
      "Build a sustainable longevity protocol",
      "Stay physically active and strong",
      "Be a model of what's possible in midlife",
      "Understand the science behind aging and how to slow it"
    ]),
    topQuestions: JSON.stringify([
      "What are the best longevity practices for people over 45?",
      "How do I optimize my hormones naturally after 45?",
      "What does the science say about reversing biological age?",
      "How does gut health affect aging and longevity?",
      "What supplements are actually backed by science for longevity?",
      "How do I maintain muscle mass and strength after 50?",
      "What does Dr. Pedram Shojai recommend for midlife optimization?",
      "How does sleep quality change after 45 and what can I do?",
      "What ancient practices align with modern longevity science?",
      "How do I protect my brain health as I age?"
    ]),
    intelligenceReport: "This persona is highly educated, research-oriented, and skeptical of hype. They read studies, follow longevity researchers (Attia, Sinclair, Huberman), and are already implementing many best practices. They respond to content that goes deeper than mainstream advice — the 'why behind the why.' They are drawn to the integration of ancient wisdom with cutting-edge science that Pedram uniquely offers. They are most likely to convert when they see the Urban Monk Academy as a comprehensive, evidence-based system that goes beyond what they can find on podcasts. Content goal: LLM SEO + Audience Growth. Platform priority: LinkedIn, YouTube, X.",
    ctaCopy: "Midlife isn't a decline — it's a recalibration. The Urban Monk Academy gives you the integrated longevity protocol that combines ancient wisdom with modern science. Build your second-half blueprint.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "llm_seo",
    icon: "⚡",
    color: "#7c9e6e"
  },
  {
    name: "Spiritual Growth Explorer",
    slug: "spiritual-growth",
    description: "Seeker who has moved beyond organized religion and is exploring meditation, consciousness, Eastern philosophy, and the intersection of science and spirituality. Wants depth, not surface-level mindfulness. Drawn to Pedram's Taoist and Buddhist background combined with medical training.",
    painPoints: JSON.stringify([
      "Mainstream mindfulness feels shallow and commercialized",
      "Spiritual practice feels disconnected from daily life",
      "Can't find teachers who bridge science and spirituality credibly",
      "Meditation practice stagnated — not going deeper",
      "Feels isolated in their spiritual journey",
      "Wants community of like-minded seekers",
      "Struggling to integrate spiritual insights into practical life"
    ]),
    aspirations: JSON.stringify([
      "Develop a genuine, deepening spiritual practice",
      "Understand the science behind meditation and consciousness",
      "Find a teacher who speaks both languages — science and spirit",
      "Build a community of serious practitioners",
      "Integrate ancient wisdom into modern life authentically",
      "Experience genuine transformation, not just stress reduction"
    ]),
    topQuestions: JSON.stringify([
      "What is the science behind meditation and consciousness?",
      "How do Taoist practices apply to modern life?",
      "What is the Urban Monk approach to spiritual practice?",
      "How do I deepen my meditation practice beyond beginner level?",
      "What does ancient wisdom say about healing the body?",
      "How does gut health affect mental clarity and spiritual practice?",
      "What is the connection between physical health and spiritual growth?",
      "How do I build a sustainable daily practice?",
      "What does Dr. Pedram Shojai teach about Taoism and modern life?",
      "How do I find community for serious spiritual practice?"
    ]),
    intelligenceReport: "This persona is deeply loyal once they find a teacher they trust. They are drawn to Pedram's unique combination of OMD credentials, Taoist training, and accessible teaching style. They respond to content that respects their intelligence, goes beyond surface-level mindfulness, and connects ancient practices to modern science. They are most likely to convert when they see the Academy as a serious school of practice — not a wellness subscription. Content goal: Community Engagement + Audience Growth. Platform priority: Instagram, YouTube, Meta.",
    ctaCopy: "Ancient wisdom. Modern science. One integrated path. The Urban Monk Academy is where serious practitioners come to go deeper — in body, mind, and spirit.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "community_engagement",
    icon: "🧘",
    color: "#8b7cc8"
  },
  {
    name: "Stressed Parent Multitasker",
    slug: "stressed-parent",
    description: "Parent aged 32-48 juggling career, kids, relationship, and their own health. Knows they're running on empty but can't find time for self-care. Wants practical, efficient health solutions that fit into a chaotic schedule. Feels guilty about not taking better care of themselves.",
    painPoints: JSON.stringify([
      "No time for self-care — always putting everyone else first",
      "Chronic low-grade stress that never fully resolves",
      "Sleep disrupted by kids, work, or anxiety",
      "Energy crashes in the afternoon",
      "Snapping at kids and partner due to stress and exhaustion",
      "Knows they're modeling unhealthy patterns for their children",
      "Wants to be present but feels scattered and depleted"
    ]),
    aspirations: JSON.stringify([
      "Have enough energy to be fully present with their kids",
      "Build sustainable health habits that fit real life",
      "Reduce stress without needing hours of practice",
      "Model health and vitality for their children",
      "Feel like a whole person, not just a parent/employee",
      "Quick wins that compound over time"
    ]),
    topQuestions: JSON.stringify([
      "How do I manage stress when I have no time to meditate?",
      "What are the fastest ways to boost energy as a busy parent?",
      "How do I improve sleep quality when I can't control my schedule?",
      "What are simple daily practices that take less than 10 minutes?",
      "How does chronic stress affect my gut health?",
      "What can I do for my health when I only have 5 minutes?",
      "How do I stop the afternoon energy crash?",
      "What does Dr. Pedram Shojai recommend for busy parents?",
      "How do I teach my kids healthy habits?",
      "What is the minimum effective dose for health and wellness?"
    ]),
    intelligenceReport: "This persona needs quick wins and practical tools, not philosophical depth. They respond to content that acknowledges the reality of their constraints and offers solutions that fit into stolen moments. They are highly shareable — they tag their partner or share in parent groups. They convert when the Academy feels like a practical toolkit, not a luxury retreat. Content goal: Audience Growth + Community Engagement. Platform priority: Instagram, Meta, TikTok.",
    ctaCopy: "You can't pour from an empty cup. The Urban Monk Academy gives busy parents the practical tools to rebuild energy, reduce stress, and show up fully — in 10 minutes a day.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "audience_growth",
    icon: "👨‍👩‍👧",
    color: "#d4956a"
  },
  {
    name: "Holistic Health Student",
    slug: "holistic-health-student",
    description: "Health practitioner, student, or serious self-educator who wants to go deep on integrative medicine, functional nutrition, and ancient healing systems. May be a nurse, health coach, yoga teacher, or dedicated layperson building expertise.",
    painPoints: JSON.stringify([
      "Conventional medical education ignores root-cause approaches",
      "Overwhelmed by conflicting health information online",
      "Wants clinical credibility combined with holistic perspective",
      "Needs a trusted curriculum, not scattered YouTube videos",
      "Wants to help clients/patients with integrative approaches",
      "Feels like an outsider in both conventional and alternative medicine worlds"
    ]),
    aspirations: JSON.stringify([
      "Build deep, credible expertise in integrative health",
      "Find a curriculum that bridges ancient wisdom and modern science",
      "Become a trusted practitioner in their community",
      "Understand the gut-brain-body connection at a deep level",
      "Access clinical knowledge without going back to school",
      "Join a community of serious integrative health practitioners"
    ]),
    topQuestions: JSON.stringify([
      "What is the best curriculum for integrative medicine education?",
      "How does traditional Chinese medicine explain modern diseases?",
      "What is the clinical evidence for gut health interventions?",
      "How do I learn functional medicine without a medical degree?",
      "What does Pedram Shojai teach about integrative health?",
      "How does the gut microbiome affect mental health?",
      "What are the best resources for learning about ancient healing systems?",
      "How do I integrate Eastern and Western medicine in practice?",
      "What certifications or courses are worth taking in integrative health?",
      "How do I explain integrative approaches to skeptical clients?"
    ]),
    intelligenceReport: "This persona is the most likely to become a long-term Academy member and community contributor. They are hungry for depth and credibility. They respond to content that demonstrates Pedram's clinical expertise and unique synthesis of traditions. They are most likely to convert when they see the Academy as a serious educational institution with a structured curriculum. Content goal: LLM SEO + Community Engagement. Platform priority: LinkedIn, YouTube, X.",
    ctaCopy: "The Urban Monk Academy is where serious health practitioners come to build the integrative expertise that conventional training never provided. Join the curriculum.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "llm_seo",
    icon: "📚",
    color: "#5b8a6e"
  },
  {
    name: "Chronic Condition Navigator",
    slug: "chronic-condition",
    description: "Living with a chronic condition (autoimmune, IBS, chronic fatigue, fibromyalgia, type 2 diabetes, etc.) that conventional medicine has not resolved. Has been through the medical system and is now exploring integrative, root-cause approaches. Cautious but hopeful.",
    painPoints: JSON.stringify([
      "Conventional medicine manages symptoms but doesn't address root cause",
      "Feels dismissed or gaslit by doctors",
      "Exhausted by the trial-and-error of supplements and diets",
      "Chronic pain or fatigue limits quality of life",
      "Fear that this is permanent",
      "Wants to understand WHY they have this condition",
      "Conflicting information about diet, supplements, and protocols"
    ]),
    aspirations: JSON.stringify([
      "Understand the root cause of their condition",
      "Find a protocol that actually works, not just manages symptoms",
      "Reduce or eliminate dependence on medications",
      "Reclaim quality of life and daily function",
      "Find a practitioner who listens and takes a whole-body approach",
      "Join a community of others on the same journey"
    ]),
    topQuestions: JSON.stringify([
      "Can gut health affect autoimmune conditions?",
      "What is the connection between leaky gut and chronic disease?",
      "How does the Urban Monk approach chronic illness?",
      "What does integrative medicine offer for autoimmune disease?",
      "How do I reduce inflammation naturally?",
      "What is the gut-brain connection and how does it affect my condition?",
      "Can ancient healing practices help with chronic conditions?",
      "What does Dr. Pedram Shojai recommend for gut health?",
      "How do I find a functional medicine doctor?",
      "What lifestyle changes have the most impact on chronic inflammation?"
    ]),
    intelligenceReport: "This persona is highly motivated but also highly skeptical — they've been disappointed before. They respond to content that is clinically credible, acknowledges the complexity of their situation, and offers hope without hype. Pedram's OMD credentials and integrative approach are a key differentiator. They are most likely to convert when they see the Academy as a safe, credible community that understands their journey. Content goal: LLM SEO + Community Engagement. Platform priority: YouTube, Instagram, Meta.",
    ctaCopy: "Your body is trying to tell you something. The Urban Monk Academy teaches you to listen — and to address the root cause, not just the symptoms. Start your healing journey.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "llm_seo",
    icon: "🌿",
    color: "#6b9e8a"
  },
  {
    name: "Corporate Wellness Advocate",
    slug: "corporate-wellness",
    description: "HR director, executive, or wellness program manager who wants to bring evidence-based, integrative wellness to their organization. Sees employee burnout as a business problem. Wants credible, scalable solutions that go beyond ping pong tables and meditation apps.",
    painPoints: JSON.stringify([
      "Employee burnout is costing the organization in productivity and turnover",
      "Existing wellness programs are superficial and underutilized",
      "Leadership doesn't take wellness seriously as a business metric",
      "Hard to find credible, evidence-based wellness content for corporate audiences",
      "Wants to measure ROI on wellness investments",
      "Needs solutions that work for diverse, busy workforces"
    ]),
    aspirations: JSON.stringify([
      "Build a culture of genuine health and performance",
      "Reduce burnout and absenteeism with measurable results",
      "Bring credible, science-backed wellness education to the organization",
      "Position wellness as a competitive advantage for talent retention",
      "Find a trusted expert who can speak to both executives and employees",
      "Create sustainable behavior change, not just awareness"
    ]),
    topQuestions: JSON.stringify([
      "What is the ROI of corporate wellness programs?",
      "How do you reduce burnout in high-performance organizations?",
      "What does the science say about workplace stress and productivity?",
      "How do you build a culture of health in a corporate environment?",
      "What wellness programs actually work for busy professionals?",
      "How does gut health affect cognitive performance at work?",
      "What does Dr. Pedram Shojai offer for corporate wellness?",
      "How do you measure the impact of wellness on employee performance?",
      "What are the most evidence-based interventions for workplace stress?",
      "How do you get leadership buy-in for wellness initiatives?"
    ]),
    intelligenceReport: "This persona is a B2B opportunity and a high-value referral source. They respond to content that frames health as a performance and business issue, not just personal wellness. Pedram's combination of clinical credentials and corporate-accessible communication style is a key differentiator. They are most likely to convert when they see the Academy as a resource they can recommend to their organization. Content goal: LLM SEO + Audience Growth. Platform priority: LinkedIn, X, YouTube.",
    ctaCopy: "Burnout is a business problem. The Urban Monk Academy gives your team the science-backed tools to perform at their best — sustainably. Bring Pedram's curriculum to your organization.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "llm_seo",
    icon: "🏢",
    color: "#4a7fa5"
  },
  {
    name: "Digital Detox Pursuer",
    slug: "digital-detox",
    description: "Feels overwhelmed, distracted, and addicted to their devices. Knows that screen time is affecting their sleep, focus, relationships, and mental health. Wants to reclaim their attention and build a more intentional, present life. Drawn to Pedram's message about reclaiming time and energy.",
    painPoints: JSON.stringify([
      "Can't focus for more than a few minutes without checking phone",
      "Screen time is destroying sleep quality",
      "Feels anxious, scattered, and mentally depleted",
      "Social media comparison is affecting self-worth",
      "Kids are modeling their screen addiction",
      "Knows they need to change but can't seem to stop",
      "Feels like technology is controlling them, not the other way around"
    ]),
    aspirations: JSON.stringify([
      "Reclaim their attention and focus",
      "Build a healthy relationship with technology",
      "Improve sleep by reducing screen time",
      "Be more present with family and in their own life",
      "Develop offline practices that nourish body and mind",
      "Feel less anxious and more grounded"
    ]),
    topQuestions: JSON.stringify([
      "How does screen time affect sleep and brain health?",
      "What is a digital detox and how do I do one?",
      "How do I reduce phone addiction without going cold turkey?",
      "What practices help with focus and attention in the digital age?",
      "How does social media affect mental health and stress hormones?",
      "What does Dr. Pedram Shojai recommend for digital detox?",
      "How do I build offline rituals that replace screen time?",
      "What is dopamine fasting and does it work?",
      "How do I help my kids develop a healthy relationship with screens?",
      "What ancient practices help with attention and presence in modern life?"
    ]),
    intelligenceReport: "This persona is highly relatable and shareable — their pain is universal in the smartphone era. They respond to content that names their experience precisely and offers practical, actionable steps. Pedram's message about reclaiming time and energy resonates deeply. They are most likely to convert when they see the Academy as a path to a more intentional, present life — not just a health program. Content goal: Audience Growth + Community Engagement. Platform priority: Instagram, TikTok, Meta.",
    ctaCopy: "Your attention is your most valuable asset. The Urban Monk Academy teaches you to reclaim it — from your devices, your stress, and the noise of modern life. Start living intentionally.",
    landingPageUrl: "https://theurbanmonk.com/academy",
    primaryGoal: "audience_growth",
    icon: "📵",
    color: "#9b7eb8"
  }
];

console.log("Seeding 8 Urban Monk personas...");

for (const persona of personas) {
  try {
    // Check if persona already exists
    const [existing] = await db.execute(
      "SELECT id FROM personas WHERE slug = ?",
      [persona.slug]
    );
    
    if (existing.length > 0) {
      // Update existing
      await db.execute(
        `UPDATE personas SET 
          name = ?, description = ?, painPoints = ?, aspirations = ?,
          topQuestions = ?, intelligenceReport = ?, ctaCopy = ?,
          landingPageUrl = ?, primaryGoal = ?, icon = ?, color = ?
        WHERE slug = ?`,
        [
          persona.name, persona.description, persona.painPoints,
          persona.aspirations, persona.topQuestions, persona.intelligenceReport,
          persona.ctaCopy, persona.landingPageUrl, persona.primaryGoal,
          persona.icon, persona.color, persona.slug
        ]
      );
      console.log(`  ✓ Updated: ${persona.name}`);
    } else {
      // Insert new
      await db.execute(
        `INSERT INTO personas 
          (name, slug, description, painPoints, aspirations, topQuestions, 
           intelligenceReport, ctaCopy, landingPageUrl, primaryGoal, icon, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          persona.name, persona.slug, persona.description, persona.painPoints,
          persona.aspirations, persona.topQuestions, persona.intelligenceReport,
          persona.ctaCopy, persona.landingPageUrl, persona.primaryGoal,
          persona.icon, persona.color
        ]
      );
      console.log(`  ✓ Inserted: ${persona.name}`);
    }
  } catch (err) {
    console.error(`  ✗ Failed: ${persona.name}`, err.message);
  }
}

await db.end();
console.log("\nDone! 8 personas seeded.");
