/**
 * Seeds 25+ verbatim pain point entries from the avatar pain points and sales training documents.
 * These are real phrases from discovery call transcripts — exact language prospects use.
 * Run: node server/seedVerbatimPainPoints.mjs
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const db = await mysql.createConnection(process.env.DATABASE_URL);

const verbatimPainPoints = [
  // ── STAGE 1: Surface-Level Entry Points ─────────────────────────────────────
  {
    stage: "surface",
    category: "cognitive_decline",
    title: "Can't Remember What I Ate for Breakfast",
    description: "Prospect casually mentions serious cognitive decline — brain fog so severe they can't recall recent meals — but smiles while saying it, having normalized the symptom after years of living with it.",
    keyQuote: "Can't remember what I ate for breakfast two days ago.",
    emotionalState: "normalized_denial",
    contentHook: "If you're laughing off memory lapses, your brain is sending you a warning your doctor is missing.",
    messagingFramework: "validation",
    journeyStage: "awareness",
    topicTags: ["brain fog", "memory", "cognitive decline", "normalization"],
    severity: 8,
    frequency: 9,
  },
  {
    stage: "surface",
    category: "fatigue",
    title: "Planning the Entire Day Around Energy Levels",
    description: "Prospect has restructured their entire life to accommodate chronic fatigue — scheduling activities based on when they might have energy, avoiding spontaneous plans.",
    keyQuote: "I have to plan my entire day around my energy levels.",
    emotionalState: "resigned_adaptation",
    contentHook: "When your calendar is built around your fatigue instead of your goals, something is deeply wrong.",
    messagingFramework: "validation",
    journeyStage: "awareness",
    topicTags: ["fatigue", "energy", "daily function", "lifestyle limitation"],
    severity: 8,
    frequency: 9,
  },
  {
    stage: "surface",
    category: "medical_system_failure",
    title: "My Labs Came Back Normal",
    description: "Prospect has had extensive conventional testing, all returning 'normal' results, while they continue to feel terrible. This creates profound confusion and self-doubt.",
    keyQuote: "My doctor says my labs are normal but I feel terrible.",
    emotionalState: "confused_self_doubt",
    contentHook: "Normal labs don't mean you're healthy. They mean you haven't crossed the threshold conventional medicine is looking for — yet.",
    messagingFramework: "differentiation",
    journeyStage: "awareness",
    topicTags: ["conventional medicine", "lab tests", "misdiagnosis", "functional medicine"],
    severity: 9,
    frequency: 10,
  },
  {
    stage: "surface",
    category: "medical_system_failure",
    title: "It's Just Stress / It's In Your Head",
    description: "Prospect has been dismissed by multiple doctors who attribute real physical symptoms to psychological causes, leaving them feeling gaslit and unheard.",
    keyQuote: "They told me it's just stress, or it's in my head.",
    emotionalState: "gaslit_frustrated",
    contentHook: "You're not imagining it. And it's not just stress. Your body is trying to tell you something your doctor doesn't know how to read.",
    messagingFramework: "validation",
    journeyStage: "awareness",
    topicTags: ["dismissal", "gaslighting", "conventional medicine", "validation"],
    severity: 9,
    frequency: 9,
  },

  // ── STAGE 2: Practitioner Maze ───────────────────────────────────────────────
  {
    stage: "practitioner_maze",
    category: "solution_exhaustion",
    title: "I've Tried Everything",
    description: "Prospect has cycled through conventional medicine, functional medicine, naturopaths, chiropractors, acupuncturists, DIY protocols, supplements, and multiple diets over 5-10 years with no lasting results.",
    keyQuote: "I've tried everything — keto, paleo, supplements, three different functional medicine doctors. Nothing sticks.",
    emotionalState: "exhausted_skeptical",
    contentHook: "There's a reason nothing has worked. You've been treating symptoms. We find the root cause.",
    messagingFramework: "differentiation",
    journeyStage: "consideration",
    topicTags: ["solution exhaustion", "functional medicine", "root cause", "differentiation"],
    severity: 9,
    frequency: 10,
  },
  {
    stage: "practitioner_maze",
    category: "financial_drain",
    title: "I've Already Spent $20,000 on This",
    description: "Prospect has spent significant money on prior solutions — often $10,000-$50,000+ — and is now skeptical about investing more. The financial wound is as real as the physical one.",
    keyQuote: "I've already spent so much money on this. I don't know if I can justify spending more.",
    emotionalState: "financially_wounded_skeptical",
    contentHook: "Every dollar you've spent on the wrong approach is a dollar that didn't go toward the actual answer. Let's stop the bleeding.",
    messagingFramework: "urgency",
    journeyStage: "consideration",
    topicTags: ["cost", "investment", "skepticism", "ROI"],
    severity: 8,
    frequency: 8,
  },
  {
    stage: "practitioner_maze",
    category: "hope_erosion",
    title: "I'm Not Invested Because I've Been Let Down So Many Times",
    description: "Prospect rates their motivation at 5/10 because chronic disappointment has created a protection mechanism — they don't allow themselves to fully hope anymore.",
    keyQuote: "I guess it's a five out of ten because I've tried so many things in the past that I'm just not invested that deeply into prioritizing this because I've been let down so many times.",
    emotionalState: "protective_detachment",
    contentHook: "That 5/10 isn't apathy. It's self-protection. You've been let down before. We understand — and we can show you why this is different.",
    messagingFramework: "validation",
    journeyStage: "consideration",
    topicTags: ["hope", "skepticism", "trust", "disappointment"],
    severity: 8,
    frequency: 9,
  },
  {
    stage: "practitioner_maze",
    category: "lost_decade",
    title: "Going Back and Forth for 10 Years",
    description: "Prospect has spent a decade searching for answers, trying different practitioners and approaches, with no resolution. The time lost is as painful as the symptoms.",
    keyQuote: "He tried all sorts of different things, been going back and forth for 10 years.",
    emotionalState: "exhausted_desperate",
    contentHook: "Ten years of searching is ten years of your life. It stops here — if you're ready to find the actual answer.",
    messagingFramework: "urgency",
    journeyStage: "consideration",
    topicTags: ["time lost", "chronic illness journey", "urgency", "root cause"],
    severity: 9,
    frequency: 8,
  },

  // ── STAGE 3: Deep Pain ───────────────────────────────────────────────────────
  {
    stage: "deep_pain",
    category: "identity_erosion",
    title: "I Don't Feel Like Myself Anymore",
    description: "Prospect has lost their sense of self — the energetic, sharp, capable person they used to be. This identity loss is often more painful than the physical symptoms.",
    keyQuote: "I don't feel like myself anymore. I used to be so energetic and sharp.",
    emotionalState: "grief_identity_loss",
    contentHook: "The person you used to be isn't gone. They're being suppressed by something we can find and fix.",
    messagingFramework: "transformation",
    journeyStage: "decision",
    topicTags: ["identity", "vitality", "self-worth", "transformation"],
    severity: 10,
    frequency: 9,
  },
  {
    stage: "deep_pain",
    category: "identity_erosion",
    title: "Aging Before My Time",
    description: "Prospect feels they are experiencing accelerated aging — physically, cognitively, and emotionally — and fears this trajectory will only worsen.",
    keyQuote: "I feel like I'm aging before my time. This isn't what 55 should feel like.",
    emotionalState: "fear_grief",
    contentHook: "This isn't normal aging. Aging is supposed to be gradual. What you're experiencing is your body under siege — and it's reversible.",
    messagingFramework: "differentiation",
    journeyStage: "awareness",
    topicTags: ["aging", "vitality", "longevity", "reversal"],
    severity: 9,
    frequency: 8,
  },
  {
    stage: "deep_pain",
    category: "relationship_strain",
    title: "My Spouse Doesn't Recognize Who I've Become",
    description: "Prospect's health decline has created distance in their marriage — their partner is frustrated, worried, or no longer recognizes the person they married.",
    keyQuote: "My spouse doesn't recognize who I've become. It's putting a strain on our relationship.",
    emotionalState: "shame_grief_urgency",
    contentHook: "Your health isn't just affecting you. The people who love you are watching — and they want the real you back.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["relationships", "marriage", "identity", "urgency"],
    severity: 10,
    frequency: 7,
  },
  {
    stage: "deep_pain",
    category: "relationship_strain",
    title: "Can't Keep Up With My Kids or Grandkids",
    description: "Prospect is missing meaningful moments with their children or grandchildren because of fatigue, pain, or cognitive limitations. This is often the deepest emotional wound.",
    keyQuote: "I can't even play with my grandkids. I have to sit on the sideline and watch. That's not the grandparent I want to be.",
    emotionalState: "grief_guilt_urgency",
    contentHook: "Your grandchildren don't need a perfect grandparent. They need a present one. Let's get you back in the game.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["family", "grandchildren", "presence", "quality of life"],
    severity: 10,
    frequency: 8,
  },
  {
    stage: "deep_pain",
    category: "career_impact",
    title: "Brain Fog Is Stealing My Career Momentum",
    description: "Prospect is experiencing cognitive decline that is affecting their professional performance — decision-making, focus in meetings, fear of being 'found out' as declining.",
    keyQuote: "The brain fog is stealing my career momentum. I can't focus in meetings. I'm worried people are starting to notice.",
    emotionalState: "fear_shame_urgency",
    contentHook: "Brain fog isn't a personality flaw or a sign of weakness. It's a symptom of something measurable — and fixable.",
    messagingFramework: "authority",
    journeyStage: "awareness",
    topicTags: ["brain fog", "career", "cognitive performance", "executives"],
    severity: 9,
    frequency: 7,
  },
  {
    stage: "deep_pain",
    category: "quality_of_life",
    title: "I'm in an Awful State — This Is Debilitating",
    description: "Prospect articulates the severity of their situation in a single sentence that often gets glossed over. This is the moment to stop and dig — the deepest pain is often in these brief statements.",
    keyQuote: "I'm in an awful state. This is debilitating.",
    emotionalState: "desperation_vulnerability",
    contentHook: "When you say 'debilitating,' we hear you. That word matters. Let's talk about what that actually means for your daily life.",
    messagingFramework: "validation",
    journeyStage: "decision",
    topicTags: ["severity", "debilitation", "quality of life", "validation"],
    severity: 10,
    frequency: 6,
  },
  {
    stage: "deep_pain",
    category: "time_pressure",
    title: "I'm Not Getting Any Younger",
    description: "Prospect feels the urgency of time — they are acutely aware that every year they don't solve this is a year of vitality lost, and they fear missing the window to reclaim their health.",
    keyQuote: "I'm not getting any younger. How many good years do I have left? I want to enjoy my 60s.",
    emotionalState: "urgency_fear_grief",
    contentHook: "The window to reclaim your vitality is real — and it's still open. But it won't be forever.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["aging", "urgency", "longevity", "time pressure"],
    severity: 9,
    frequency: 9,
  },
  {
    stage: "deep_pain",
    category: "time_pressure",
    title: "It's Getting Worse Every Year",
    description: "Prospect has observed a clear downward trajectory in their health — what was once manageable has become debilitating, and they fear the next year will be worse than this one.",
    keyQuote: "It's getting worse every year. Used to be manageable, now it's debilitating. If I don't fix this now, when will I?",
    emotionalState: "fear_urgency",
    contentHook: "The trajectory matters. If it's getting worse every year, waiting another year isn't neutral — it's a choice to get worse.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["progression", "urgency", "trajectory", "worsening"],
    severity: 9,
    frequency: 8,
  },

  // ── STAGE 4: Root Cause Awareness ───────────────────────────────────────────
  {
    stage: "root_cause",
    category: "gut_dysfunction",
    title: "I Eat Healthy But Still Feel Terrible",
    description: "Prospect eats a clean diet — often paleo, keto, or AIP — but continues to feel terrible because they have underlying gut dysfunction preventing nutrient absorption.",
    keyQuote: "I eat so clean. I do everything right. I don't understand why I still feel this way.",
    emotionalState: "confused_frustrated",
    contentHook: "Eating clean is necessary but not sufficient. If your gut is broken, you can't absorb the nutrients from the cleanest diet in the world.",
    messagingFramework: "authority",
    journeyStage: "awareness",
    topicTags: ["gut health", "nutrition", "absorption", "clean eating"],
    severity: 8,
    frequency: 8,
  },
  {
    stage: "root_cause",
    category: "toxic_burden",
    title: "Could This Be Mold or Heavy Metals?",
    description: "Prospect has done enough research to suspect environmental toxins — mold, heavy metals, or biotoxins — as a root cause, but has not been able to get proper testing or confirmation.",
    keyQuote: "I've been reading about mold and heavy metals. Could that be what's causing all of this?",
    emotionalState: "curious_hopeful",
    contentHook: "You're asking the right questions. Most doctors don't test for these. We do.",
    messagingFramework: "authority",
    journeyStage: "consideration",
    topicTags: ["mold", "heavy metals", "toxins", "testing"],
    severity: 8,
    frequency: 6,
  },
  {
    stage: "root_cause",
    category: "hormonal_chaos",
    title: "My Thyroid Tests Normal But I Have Every Symptom",
    description: "Prospect has been told their thyroid is normal by conventional labs but has every classic hypothyroid symptom — fatigue, weight gain, brain fog, cold intolerance. Conventional labs use ranges too broad to catch subclinical dysfunction.",
    keyQuote: "My thyroid tests normal but I have every single symptom of thyroid problems. No one can explain it.",
    emotionalState: "confused_frustrated",
    contentHook: "Conventional thyroid testing misses 80% of thyroid dysfunction. We use a full panel that actually tells the story.",
    messagingFramework: "differentiation",
    journeyStage: "awareness",
    topicTags: ["thyroid", "hormones", "conventional medicine", "functional testing"],
    severity: 9,
    frequency: 7,
  },

  // ── OBJECTIONS (Sales Training) ──────────────────────────────────────────────
  {
    stage: "objection",
    category: "price_objection",
    title: "I Need to Think About It",
    description: "Classic delay objection that masks the real concern — usually price, spouse approval, fear of disappointment, or lack of urgency. The prospect is not saying no; they're saying they don't feel safe saying yes yet.",
    keyQuote: "I need to think about it. Can I get back to you?",
    emotionalState: "uncertain_protective",
    contentHook: "What would you need to feel confident moving forward today? Let's talk about what's holding you back.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["objection", "delay", "decision", "urgency"],
    severity: 7,
    frequency: 10,
  },
  {
    stage: "objection",
    category: "price_objection",
    title: "I Need to Talk to My Spouse",
    description: "Often a real constraint (couples make joint financial decisions) but also a delay tactic. The key is to either get the spouse on the call or understand what the spouse's concerns would be.",
    keyQuote: "I need to talk to my spouse before I can commit to anything.",
    emotionalState: "uncertain_deferring",
    contentHook: "That makes complete sense. What do you think their biggest concern would be? Let's address it now so you can have that conversation with confidence.",
    messagingFramework: "validation",
    journeyStage: "decision",
    topicTags: ["objection", "spouse", "decision", "couples"],
    severity: 7,
    frequency: 9,
  },
  {
    stage: "objection",
    category: "skepticism",
    title: "How Is This Different From Everything Else I've Tried?",
    description: "Prospect has been burned before and needs a clear, specific answer to why this approach is fundamentally different — not just better, but categorically different in methodology.",
    keyQuote: "I've heard this all before. How is this actually different from everything else I've tried?",
    emotionalState: "skeptical_guarded",
    contentHook: "The difference isn't the supplements or the diet. It's the testing. We find what's actually broken before we try to fix anything.",
    messagingFramework: "differentiation",
    journeyStage: "consideration",
    topicTags: ["differentiation", "skepticism", "methodology", "testing"],
    severity: 8,
    frequency: 9,
  },
  {
    stage: "objection",
    category: "urgency_objection",
    title: "What Happens If This Continues for Another Year?",
    description: "This is a sales question to ask the prospect — not an objection. It forces them to confront the trajectory of their health and creates urgency by making the cost of inaction visceral.",
    keyQuote: "What happens if this continues for another 6 months? Another year? What does that look like for you?",
    emotionalState: "confronting_urgency",
    contentHook: "The cost of waiting is not zero. Every month you don't address the root cause, the damage compounds.",
    messagingFramework: "urgency",
    journeyStage: "decision",
    topicTags: ["urgency", "trajectory", "cost of inaction", "decision"],
    severity: 9,
    frequency: 8,
  },
  {
    stage: "objection",
    category: "trust_objection",
    title: "I'm Afraid of Being Disappointed Again",
    description: "The deepest objection — not about price or logistics, but about emotional safety. Prospect has invested hope and money before and been let down. They are protecting themselves from another disappointment.",
    keyQuote: "I want to believe this will work. I'm just afraid of being disappointed again.",
    emotionalState: "vulnerable_protective",
    contentHook: "That fear is completely valid. You've earned it. Let me show you exactly why this is different — not with promises, but with data.",
    messagingFramework: "authority",
    journeyStage: "decision",
    topicTags: ["trust", "fear", "disappointment", "safety"],
    severity: 10,
    frequency: 8,
  },
  {
    stage: "surface",
    category: "cognitive_decline",
    title: "Embarrassed by Cognitive Decline at Work",
    description: "Prospect is experiencing cognitive decline that is visible to colleagues — forgetting names, losing train of thought mid-sentence, struggling with tasks that used to be effortless.",
    keyQuote: "I'm embarrassed. I used to be the sharpest person in the room. Now I forget names, lose my train of thought. People are starting to notice.",
    emotionalState: "shame_fear",
    contentHook: "Cognitive decline is not a character flaw. It's a physiological signal. And it's one of the most reversible things we address.",
    messagingFramework: "validation",
    journeyStage: "awareness",
    topicTags: ["brain fog", "cognitive decline", "shame", "executives"],
    severity: 9,
    frequency: 7,
  },
  {
    stage: "deep_pain",
    category: "quality_of_life",
    title: "Exhausted by Basic Tasks",
    description: "Prospect's fatigue has reached a level where ordinary daily activities — grocery shopping, cooking, cleaning — leave them depleted. They cannot imagine how they will sustain this.",
    keyQuote: "I'm exhausted by basic tasks. Going to the grocery store wipes me out for the rest of the day.",
    emotionalState: "desperation_grief",
    contentHook: "When a grocery run requires a recovery day, your body is not just tired. It's running on empty at a cellular level.",
    messagingFramework: "validation",
    journeyStage: "awareness",
    topicTags: ["fatigue", "energy", "daily function", "mitochondria"],
    severity: 9,
    frequency: 8,
  },
];

console.log(`Seeding ${verbatimPainPoints.length} verbatim pain point entries...`);

let inserted = 0;
let skipped = 0;

for (const point of verbatimPainPoints) {
  try {
    // Check if a pain point with this title already exists
    const [existing] = await db.execute(
      "SELECT id FROM avatar_pain_points WHERE title = ?",
      [point.title]
    );

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    // emotionalHook is varchar(255) — use just the key quote, truncated
    const emotionalHook = point.keyQuote.length <= 252
      ? `"${point.keyQuote}"`
      : `"${point.keyQuote.substring(0, 249)}..."`;
    // contentTopics = topic tags as comma-separated string
    const contentTopics = point.topicTags.join(", ");
    // headlineFormula = messaging framework
    const headlineFormula = point.messagingFramework;
    // exampleHeadline = content hook (repurposed)
    const exampleHeadline = point.contentHook;
    // keyQuote = verbatim quote
    const keyQuote = point.keyQuote;

    await db.execute(
      `INSERT INTO avatar_pain_points 
       (stage, category, title, description, emotionalHook, contentTopics, headlineFormula, exampleHeadline, keyQuote, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        point.stage,
        point.category,
        point.title,
        point.description,
        emotionalHook,
        contentTopics,
        headlineFormula,
        exampleHeadline,
        keyQuote,
      ]
    );
    inserted++;
  } catch (err) {
    console.error(`Error inserting "${point.title}":`, err.message);
  }
}

await db.end();
console.log(`Done. Inserted: ${inserted}, Skipped (already exist): ${skipped}`);
