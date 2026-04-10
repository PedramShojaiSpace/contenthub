/**
 * Seed script: Avatar Intelligence Engine
 * Source: manus_avatar_pain_points.md + sales_team_training_document.md
 * 754 lines of avatar intelligence from real discovery call analysis by Josh Lyons
 */

import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── 1. BUYER PERSONAS ────────────────────────────────────────────────────────
const personas = [
  {
    name: "The Researcher",
    profile: "High education level (scientists, executives, professionals). Detail-oriented. Makes spreadsheets comparing options. Slow to trust. Has often self-diagnosed using PubMed and functional medicine forums. Needs data before committing.",
    communicationStyle: "Analytical, questions-heavy, wants studies and protocols. Will challenge claims. Respects intellectual honesty over enthusiasm.",
    contentNeeds: JSON.stringify([
      "Scientific explanations with citations",
      "Detailed methodology breakdowns",
      "Comparison charts vs. conventional medicine",
      "Case studies with specific data and timelines",
      "Transparent discussion of what testing reveals vs. misses",
    ]),
    salesApproach: "Give them information upfront. Answer questions thoroughly without being defensive. Don't rush them — they need to feel they arrived at the decision themselves. Provide follow-up resources. Never oversell.",
    traits: JSON.stringify([
      "Age 40-65",
      "Often has a science or medical background",
      "Has already read functional medicine books",
      "Skeptical of testimonials alone",
      "Responds to peer-reviewed citations and specific biomarkers",
      "Will spend 2-4 weeks researching before booking a call",
    ]),
  },
  {
    name: "The Desperate Seeker",
    profile: "Symptoms severely impacting daily life. Has tried 5-15+ practitioners over 5-10 years. Emotionally exhausted and guarded. Looking for hope but terrified of another disappointment. Ready to commit if they genuinely believe this will work.",
    communicationStyle: "Emotional, story-driven. Needs to feel deeply understood before they can open up. Will minimize symptoms ('I'm fine') because they've learned to cope. Often smiles while describing serious decline — dissociation from chronic disappointment.",
    contentNeeds: JSON.stringify([
      "Transformation stories from people exactly like them",
      "Empathy and validation that their symptoms are real",
      "Hope without hype — specific outcomes, not miracle claims",
      "Clear path forward with defined milestones",
      "Community proof — others who've been through the same journey",
    ]),
    salesApproach: "Listen deeply. Hold space for pain — don't rush to comfort them. The most loving thing is to let them sit in the reality of their situation for 3-5 minutes before offering hope. Build belief through specific patient stories. Never minimize their experience.",
    traits: JSON.stringify([
      "Age 45-70",
      "Has been told 'labs are normal' repeatedly",
      "Spent $10,000-$50,000+ on failed solutions",
      "Describes symptoms casually — has normalized them",
      "Partner or spouse often more concerned than they are",
      "Urgency is HIGH but masked by learned helplessness",
    ]),
  },
  {
    name: "The Skeptical Executive",
    profile: "High-performer. Time-scarce. ROI-focused. Direct communication preference. Impatient with anything that sounds 'woo-woo' or unscientific. Brain fog is affecting their career performance and they're worried about being 'found out' as declining.",
    communicationStyle: "Efficient, results-oriented, wants the bottom line fast. Will cut off long explanations. Responds to metrics, timelines, and specific outcomes. Hates vague promises.",
    contentNeeds: JSON.stringify([
      "Performance and efficiency angle — not just health",
      "Specific outcomes with timelines",
      "Time investment required (they're protective of their schedule)",
      "Concrete metrics and measurable results",
      "Executive testimonials from people in similar roles",
    ]),
    salesApproach: "Be direct and efficient. Lead with outcomes, not process. Respect their time — don't over-explain. Show results quickly. Frame health as performance optimization, not wellness. Too much empathy will lose them — they want a peer, not a therapist.",
    traits: JSON.stringify([
      "Age 45-60",
      "C-suite, senior executive, or high-earning professional",
      "Brain fog is their #1 concern — affects decision-making",
      "Worried about early retirement or being passed over",
      "Will pay a premium for speed and certainty",
      "Responds to ROI framing: cost of NOT fixing this",
    ]),
  },
  {
    name: "The Holistic Believer",
    profile: "Already deeply into natural health. Understands root cause concepts. May have practitioner fatigue from working with multiple functional medicine providers. Values the relationship with their provider as much as the protocol. Open to spiritual and energetic components.",
    communicationStyle: "Philosophical, big-picture, values authentic connection. Wants to discuss the 'why' behind the approach. Respects practitioners who honor their existing knowledge rather than dismissing it.",
    contentNeeds: JSON.stringify([
      "Philosophy and approach — the 'why' behind the methodology",
      "Practitioner credentials and depth of training",
      "Holistic integration — how physical, mental, and spiritual connect",
      "Long-term partnership framing — not just a program",
      "Values alignment — they need to trust the mission, not just the method",
    ]),
    salesApproach: "Discuss philosophy first. Show the depth and sophistication of the approach. Build relationship before pitching. Honor their existing knowledge. Frame the program as a partnership, not a transaction. Authenticity is everything — they can detect inauthenticity immediately.",
    traits: JSON.stringify([
      "Age 40-65",
      "Has worked with naturopaths, acupuncturists, energy healers",
      "Reads books like The Urban Monk, Broken Brain, etc.",
      "Values community and belonging as much as results",
      "Will refer others if they feel genuinely cared for",
      "Responds to Pedram's monk background and Taoist philosophy",
    ]),
  },
];

console.log("Seeding avatar personas...");
for (const p of personas) {
  await conn.execute(
    `INSERT INTO avatar_personas (name, profile, communicationStyle, contentNeeds, salesApproach, traits) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE profile=VALUES(profile)`,
    [p.name, p.profile, p.communicationStyle, p.contentNeeds, p.salesApproach, p.traits]
  );
}
console.log(`✓ ${personas.length} personas seeded`);

// ─── 2. MESSAGING FRAMEWORKS ──────────────────────────────────────────────────
const frameworks = [
  {
    name: "The Validation Message",
    structure: "You're not crazy → There's a reason → We can find it",
    example: "If you've been told your labs are 'normal' but you feel anything but normal, you're not imagining it. Conventional testing misses 90% of the root causes of chronic fatigue, brain fog, and hormonal issues. Our comprehensive testing reveals what standard doctors never look for — and finally gives you the answers you've been searching for.",
    useCase: "awareness",
    emotionalJob: "Validate their experience, dissolve shame, establish authority as the one who finally understands",
  },
  {
    name: "The Differentiation Message",
    structure: "Others treat symptoms → We find root cause → This is why you haven't healed",
    example: "Most practitioners — even functional medicine practitioners — focus on managing symptoms. We go deeper. Our testing protocol identifies the specific toxins, infections, deficiencies, and imbalances driving your symptoms. It's not about trying another supplement stack. It's about understanding YOUR unique biology and addressing the root cause so you finally heal.",
    useCase: "consideration",
    emotionalJob: "Separate from the noise, explain why past attempts failed, build confidence in a different approach",
  },
  {
    name: "The Urgency Message",
    structure: "Time is passing → Symptoms worsen → Window of opportunity closing",
    example: "Every year you wait, your symptoms don't just persist — they worsen. The inflammation becomes chronic. The imbalances become entrenched. Your body's ability to heal diminishes. If you've been putting off addressing this 'until things get worse,' they already are worse. The question isn't whether to address this. It's whether you'll do it now or wish you had started sooner.",
    useCase: "decision",
    emotionalJob: "Create urgency without fear-mongering. Make inaction feel more painful than action.",
  },
  {
    name: "The Transformation Message",
    structure: "Where you are → Where you could be → What's possible when root cause is addressed",
    example: "Imagine waking up with energy. Walking into a meeting with a clear, sharp mind. Playing with your grandkids without needing a nap afterward. Having the libido you had 10 years ago. This isn't wishful thinking — it's what happens when you address root cause dysfunction instead of masking symptoms. Our patients don't just 'manage' their conditions. They reclaim their lives.",
    useCase: "awareness,consideration",
    emotionalJob: "Paint the future self vividly. Make the transformation feel real and achievable, not aspirational.",
  },
  {
    name: "The Authority Message",
    structure: "What your doctor doesn't test → Why it matters → What we do instead",
    example: "Standard blood panels test for disease, not dysfunction. They're designed to catch catastrophic failure — not the subtle imbalances that steal your energy, fog your mind, and age you prematurely. Our advanced testing looks at 150+ biomarkers your doctor has never ordered: organic acids, heavy metals, mycotoxins, advanced thyroid panels, gut microbiome analysis. This is why our patients finally get answers after years of being told 'everything looks fine.'",
    useCase: "consideration,decision",
    emotionalJob: "Establish Pedram as the expert who operates at a different level. Justify the investment through superior methodology.",
  },
];

console.log("Seeding messaging frameworks...");
for (const f of frameworks) {
  await conn.execute(
    `INSERT INTO avatar_messaging_frameworks (name, structure, example, useCase, emotionalJob) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE structure=VALUES(structure)`,
    [f.name, f.structure, f.example, f.useCase, f.emotionalJob]
  );
}
console.log(`✓ ${frameworks.length} messaging frameworks seeded`);

// ─── 3. OBJECTIONS ────────────────────────────────────────────────────────────
const objections = [
  {
    objection: "I've tried everything",
    underlyingFear: "I don't want to be disappointed again. I've invested time, money, and hope into solutions that failed. Another failure would be devastating.",
    responseFramework: "Acknowledge the exhaustion and disappointment first — don't rush past it. Then highlight what makes this approach structurally different (testing vs. guessing). Show proof of results with 'tried everything' patients specifically. Shift the frame from 'trying another thing' to 'finally understanding the root cause.'",
    contentExample: "'I've Tried Everything' — Why Our Patients Say That Before They Find Us (And Why They Don't Say It After)",
    keyInsight: "They've been burned by solutions that addressed symptoms, not causes. The key is to make them understand that previous failures were diagnostic failures, not personal failures.",
  },
  {
    objection: "It's too expensive",
    underlyingFear: "What if I invest and it doesn't work? I've already spent $10,000-$50,000 on failed solutions. I can't afford another disappointment — financially or emotionally.",
    responseFramework: "Reframe as investment vs. expense. Calculate the cost of the current path: ongoing medical bills, lost productivity, diminished quality of life, and the compounding cost of inaction. Show long-term ROI. Address the real fear (will this work?) before the financial objection. When they truly believe in the outcome, they find the money.",
    contentExample: "The Real Cost of Chronic Illness: Why Waiting to Invest in Your Health Is the Most Expensive Decision You'll Make",
    keyInsight: "From sales training: 'There's a lot to be said for the broke leads wouldn't be broke if I was on the phone with them.' It's not about money — it's about certainty in the outcome. Certainty creates resourcefulness.",
  },
  {
    objection: "How is this different from what I've already tried?",
    underlyingFear: "How do I know you're not just like everyone else? I've heard 'root cause' before. I've tried functional medicine before. What makes this actually different?",
    responseFramework: "Acknowledge competitors by category (not by name-bashing). Highlight specific methodology differences: the depth of testing, the integration of Eastern and Western medicine, Pedram's unique background as both a doctor and a monk. Let results speak — specific patient transformations, not generic claims.",
    contentExample: "What Makes Our Approach Different: A Transparent Comparison (And Why Most Functional Medicine Misses the Mark)",
    keyInsight: "The differentiation isn't just clinical — it's philosophical. Pedram's Taoist background and understanding of the whole person (body, mind, spirit) is genuinely different from a practitioner who just orders more tests.",
  },
  {
    objection: "I need to think about it",
    underlyingFear: "Multiple fears layered: fear of commitment, need for spouse approval, financial concerns, skepticism that this will work, fear of being judged if they fail again.",
    responseFramework: "Isolate the real objection — 'I need to think about it' is never the real objection. Ask: 'Of course. What specifically would you need to think through?' Then address that specific concern. Create a safe space for the real truth. Don't let them leave without clarity on what's actually holding them back.",
    contentExample: "How to Know If You're Ready for Functional Medicine (And What to Do If You're Not Sure)",
    keyInsight: "From sales training: 'Confused buyers do not buy.' If they say they need to think about it, something in the pitch created confusion. The job is to find and resolve that confusion on the call, not schedule a follow-up.",
  },
];

console.log("Seeding objections...");
for (const o of objections) {
  await conn.execute(
    `INSERT INTO avatar_objections (objection, underlyingFear, responseFramework, contentExample, keyInsight) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE underlyingFear=VALUES(underlyingFear)`,
    [o.objection, o.underlyingFear, o.responseFramework, o.contentExample, o.keyInsight]
  );
}
console.log(`✓ ${objections.length} objections seeded`);

// ─── 4. PAIN POINTS ───────────────────────────────────────────────────────────
const painPoints = [
  // STAGE 1: SURFACE (what they say first)
  {
    stage: "surface",
    category: "Physical Symptoms",
    title: "Chronic Fatigue & No Energy",
    description: "The most common entry point. They describe exhaustion that sleep doesn't fix, needing to plan their entire day around energy levels, and being too tired for basic tasks like grocery shopping. They've normalized this — often smiling while describing debilitating fatigue.",
    emotionalHook: "Validation + Hope + Authority",
    contentTopics: JSON.stringify([
      "The Real Reason You're Always Tired (It's Not What You Think)",
      "Why Sleep Doesn't Fix Your Fatigue (And What Actually Does)",
      "Adrenal Fatigue vs. Mitochondrial Dysfunction: What Your Doctor Isn't Testing",
    ]),
    headlineFormula: "The Real Reason You're [Symptom] (It's Not What You Think)",
    exampleHeadline: "The Real Reason You're Always Exhausted (It's Not Stress or Poor Sleep)",
    keyQuote: "The prospect was smiling whilst talking about his endless symptoms. Prospects shouldn't be smiling while they're telling you, 'I can't even remember what I ate for breakfast two days ago.'",
  },
  {
    stage: "surface",
    category: "Physical Symptoms",
    title: "Brain Fog & Memory Issues",
    description: "Can't remember what they ate for breakfast. Struggling to focus in meetings. Worried about being 'found out' as cognitively declining. For executives, this is career-threatening. For parents, it means not being present for their kids.",
    emotionalHook: "Validation + Urgency + Authority",
    contentTopics: JSON.stringify([
      "Brain Fog After 40: The Gut Connection No One Talks About",
      "Why Your Memory Is Getting Worse (And It's Not Alzheimer's)",
      "The Executive's Guide to Clearing Brain Fog Without Medication",
    ]),
    headlineFormula: "Why Your [Cognitive Symptom] Is Getting Worse (And It's Not [Common Assumption])",
    exampleHeadline: "Why Your Brain Fog Is Getting Worse (And It's Not Just Aging)",
    keyQuote: "You finally break free from the brain fog that's stolen your career momentum and relationships.",
  },
  {
    stage: "surface",
    category: "Physical Symptoms",
    title: "Gut & Digestive Issues",
    description: "Bloating, IBS, food sensitivities, unpredictable digestion. Often told 'it's just stress' by conventional doctors. Many have tried elimination diets with limited results. The gut connection to their other symptoms (brain fog, fatigue, mood) is unknown to them.",
    emotionalHook: "Education + Aha Moment + Hope",
    contentTopics: JSON.stringify([
      "The Hidden Cause of Your Digestive Issues (It's Not What You're Eating)",
      "Leaky Gut: The Root of 90% of Chronic Health Issues",
      "Why Your Elimination Diet Isn't Working",
    ]),
    headlineFormula: "The Hidden [Body System] Problem Causing Your [Symptom]",
    exampleHeadline: "The Hidden Gut Problem Causing Your Brain Fog, Fatigue, and Weight Gain",
    keyQuote: null,
  },
  {
    stage: "surface",
    category: "Physical Symptoms",
    title: "Weight Gain & Inability to Lose Weight",
    description: "Despite eating 'healthy' and exercising, they can't lose weight or keep gaining. Conventional advice (eat less, move more) has failed them. Often have undiagnosed thyroid dysfunction, insulin resistance, or gut dysbiosis driving the issue.",
    emotionalHook: "Not Your Fault + There's a Reason + We Do It Differently",
    contentTopics: JSON.stringify([
      "Why You Can't Lose Weight Despite Doing Everything Right",
      "The Thyroid-Weight Connection Your Doctor Is Missing",
      "Why Keto Didn't Work for You (The Real Reason)",
    ]),
    headlineFormula: "Tried [Popular Solution] and Still [Symptom]? Here's Why",
    exampleHeadline: "Tried Keto, Paleo, and Intermittent Fasting and Still Can't Lose Weight? Here's Why",
    keyQuote: null,
  },
  // STAGE 2: PRACTITIONER MAZE
  {
    stage: "practitioner_maze",
    category: "Failed Solutions",
    title: "Normal Labs, Abnormal Life",
    description: "Blood tests come back 'normal' but they feel terrible. Told 'it's just stress' or 'it's in your head.' This is the most common source of frustration and the most powerful differentiator for advanced functional testing.",
    emotionalHook: "Validation + Authority + Differentiation",
    contentTopics: JSON.stringify([
      "Why Your Thyroid Labs Are 'Normal' But You Feel Terrible",
      "What Your Doctor Isn't Testing (And Why It Matters)",
      "The Problem with 'Normal' Lab Ranges (And What Optimal Actually Looks Like)",
    ]),
    headlineFormula: "Why Your [Test] Is 'Normal' But You Feel [Symptom]",
    exampleHeadline: "Why Your Labs Are 'Normal' But You Feel Terrible (The Testing Gap No One Talks About)",
    keyQuote: "Multiple doctors who 'couldn't find anything wrong.' Blood tests that came back 'normal.' Told 'it's just stress' or 'it's in your head.'",
  },
  {
    stage: "practitioner_maze",
    category: "Failed Solutions",
    title: "The Supplement Graveyard",
    description: "Spent thousands on supplements that didn't work. Have tried every trending protocol — keto, paleo, AIP, carnivore, detox cleanses, fasting. Each one worked briefly or not at all. Now skeptical of anything that sounds like 'another supplement stack.'",
    emotionalHook: "Not Your Fault + Differentiation + Root Cause Education",
    contentTopics: JSON.stringify([
      "Why Your Supplements Aren't Working (The Absorption Problem)",
      "5 Reasons Your Last Functional Medicine Protocol Failed",
      "The Problem with Symptom-Based Treatment (And What Actually Works)",
    ]),
    headlineFormula: "Why [Popular Solution] Isn't Working for You (The Real Reason)",
    exampleHeadline: "Why Your Supplements Aren't Working (And It's Not the Brand)",
    keyQuote: "This guy on this phone, on this call. The guy was lost. He tried all sorts of different things, been going back and forth for 10 years.",
  },
  // STAGE 3: DEEP PAIN
  {
    stage: "deep_pain",
    category: "Identity Erosion",
    title: "I Don't Feel Like Myself Anymore",
    description: "The deepest pain point. They used to be active, sharp, energetic, present. Now they feel like a diminished version of themselves. Embarrassed by cognitive decline. Ashamed of weight gain. Spouse and kids notice the change. They've dissociated from the emotional impact to cope.",
    emotionalHook: "Deep Validation + Future Self Vision + Transformation",
    contentTopics: JSON.stringify([
      "Reclaiming the Person You Used to Be (A Root Cause Story)",
      "When Your Body Betrays You: The Identity Crisis of Chronic Illness",
      "From Diminished to Fully Alive: What's Actually Possible",
    ]),
    headlineFormula: "How [Person Like Them] Went from [Bad State] to [Good State] in [Timeframe]",
    exampleHeadline: "How a 52-Year-Old Executive Went from Brain Fog and Burnout to Sharp, Energized, and Present Again",
    keyQuote: "Prospects shouldn't be smiling. They should be in guilt. They should be in shame. They should be in pain that this is very fucking serious.",
  },
  {
    stage: "deep_pain",
    category: "Relationship Strain",
    title: "Can't Show Up for the People I Love",
    description: "Can't play with grandkids. Missing important moments due to fatigue. Partner frustrated by their limitations. Sexual dysfunction straining the relationship. Feel like a burden. Declining social invitations because symptoms are unpredictable. Losing friendships.",
    emotionalHook: "Empathy + Specific Transformation + Future Vision",
    contentTopics: JSON.stringify([
      "How to Show Up for Your Kids When You Have No Energy",
      "The Marriage Strain of Chronic Illness (And How We Saved Ours)",
      "Reclaiming Your Sex Life After Hormonal Decline",
    ]),
    headlineFormula: "How [Person Like Them] Went from [Relationship Problem] to [Relationship Transformation]",
    exampleHeadline: "How One Couple Saved Their Marriage After Chronic Illness Nearly Destroyed It",
    keyQuote: "The husband-wife dynamic where wife is concerned but husband is in denial, smiling through symptoms. This creates relationship tension that goes unaddressed.",
  },
  {
    stage: "deep_pain",
    category: "Career & Performance",
    title: "Brain Fog Is Killing My Career",
    description: "Can't focus in meetings. Worried about being 'found out' as declining. Passed over for promotions. Fear of losing job due to performance. For executives, this is the most urgent pain point — they've built their identity around performance and can't afford to lose it.",
    emotionalHook: "Urgency + Performance Framing + Specific ROI",
    contentTopics: JSON.stringify([
      "Executive Performance Despite Brain Fog: A Recovery Story",
      "The Hidden Cost of Brain Fog: What Cognitive Decline Is Really Costing Your Career",
      "How to Protect Your Career While Healing Your Brain",
    ]),
    headlineFormula: "What [Symptom] Is Really Costing You (Beyond the Health Impact)",
    exampleHeadline: "What Brain Fog Is Really Costing You (It's Not Just Your Health — It's Your Career)",
    keyQuote: "Brain fog affecting decision-making. Can't focus in meetings. Worry about being 'found out' as declining.",
  },
  {
    stage: "deep_pain",
    category: "Time Pressure",
    title: "How Many Good Years Do I Have Left?",
    description: "Age factor creates urgency. 'I'm not getting any younger.' 'I want to enjoy my 50s/60s/70s.' Fear of missing grandchildren growing up. Want to travel while still able. Symptoms are worsening year over year. The window of healing feels like it's closing.",
    emotionalHook: "Urgency + Future Vision + Permission to Act Now",
    contentTopics: JSON.stringify([
      "How Many Good Years Do You Have Left? (And What to Do About It)",
      "The Compounding Cost of Waiting: Why Inaction Is the Riskiest Choice",
      "What Happens to Your Body If You Don't Address This in the Next Year",
    ]),
    headlineFormula: "What Happens If [Symptom] Continues for Another [Timeframe]?",
    exampleHeadline: "What Happens to Your Body If You Don't Address Your Fatigue and Brain Fog in the Next 12 Months?",
    keyQuote: "What happens if this continues for another 6 months? Another year?",
  },
  // STAGE 4: ROOT CAUSE (education layer)
  {
    stage: "root_cause",
    category: "Gut Dysfunction",
    title: "Leaky Gut: The Root of Everything",
    description: "Leaky gut (intestinal permeability) allows toxins, undigested food particles, and bacteria to enter the bloodstream, triggering systemic inflammation. This drives brain fog, fatigue, autoimmune conditions, skin issues, and hormonal imbalances. Most practitioners never test for it.",
    emotionalHook: "Education + Aha Moment + Authority",
    contentTopics: JSON.stringify([
      "Leaky Gut: The Root of 90% of Chronic Health Issues",
      "The Gut-Brain Axis: Why Your Digestive Issues Cause Brain Fog",
      "What Is Intestinal Permeability and Why Does It Matter?",
    ]),
    headlineFormula: "The [Root Cause] Connection: Why Your [Symptom] Is Actually a [Body System] Problem",
    exampleHeadline: "The Gut-Brain Connection: Why Your Brain Fog Is Actually a Digestive Problem",
    keyQuote: null,
  },
  {
    stage: "root_cause",
    category: "Toxic Burden",
    title: "Heavy Metals & Environmental Toxins",
    description: "Heavy metal accumulation (mercury, lead, arsenic), mold exposure, and environmental toxins disrupt thyroid function, mitochondrial energy production, and neurological health. Standard doctors never test for these. They're often the missing piece after years of failed protocols.",
    emotionalHook: "Education + Aha Moment + Urgency",
    contentTopics: JSON.stringify([
      "How Heavy Metals Destroy Your Thyroid (Even When Labs Look Normal)",
      "The Mold-Hormone Connection: A Hidden Epidemic",
      "Are Environmental Toxins Making You Sick? What to Test For",
    ]),
    headlineFormula: "How [Hidden Toxin] Is Destroying Your [Body System] (Even When Your Labs Look Normal)",
    exampleHeadline: "How Mold Exposure Is Destroying Your Hormones (Even If You Feel Fine)",
    keyQuote: null,
  },
  {
    stage: "root_cause",
    category: "Hormonal Chaos",
    title: "Thyroid & Cortisol Dysfunction",
    description: "Thyroid dysfunction is massively underdiagnosed because conventional labs only test TSH, missing T3, T4, reverse T3, and antibodies. Cortisol dysregulation (adrenal fatigue) from chronic stress depletes energy, disrupts sleep, and drives weight gain. Sex hormone imbalances affect mood, libido, and cognitive function.",
    emotionalHook: "Authority + Validation + Education",
    contentTopics: JSON.stringify([
      "Why Your Thyroid Labs Are 'Normal' But You Feel Terrible",
      "Why Stress Isn't Your Real Problem (Cortisol Dysfunction Explained)",
      "Hormone Imbalance Symptoms Women Over 50 Ignore",
    ]),
    headlineFormula: "Why Your [Hormone] Is [Problem] Even When Your Doctor Says You're Fine",
    exampleHeadline: "Why Your Thyroid Is Failing Even When Your Doctor Says Your Labs Are Normal",
    keyQuote: null,
  },
];

console.log("Seeding pain points...");
for (const p of painPoints) {
  await conn.execute(
    `INSERT INTO avatar_pain_points (stage, category, title, description, emotionalHook, contentTopics, headlineFormula, exampleHeadline, keyQuote) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE description=VALUES(description)`,
    [p.stage, p.category, p.title, p.description, p.emotionalHook, p.contentTopics, p.headlineFormula, p.exampleHeadline, p.keyQuote || null]
  );
}
console.log(`✓ ${painPoints.length} pain points seeded`);

await conn.end();
console.log("\n✅ Avatar Intelligence Engine seeded successfully!");
console.log(`   ${personas.length} buyer personas`);
console.log(`   ${frameworks.length} messaging frameworks`);
console.log(`   ${objections.length} objection handlers`);
console.log(`   ${painPoints.length} pain point entries across 4 journey stages`);
