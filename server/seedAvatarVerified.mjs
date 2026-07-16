/**
 * seedAvatarVerified.mjs
 *
 * Replaces generic avatar data with verified language from the 5,485-response
 * Typeform audience survey. Run once:
 *   node server/seedAvatarVerified.mjs
 *
 * Source: Urban Monk Audience Language Map v2 (Typeform, 5,485 responses)
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── CLEAR EXISTING DATA ──────────────────────────────────────────────────────
await conn.execute("DELETE FROM avatar_pain_points");
await conn.execute("DELETE FROM avatar_personas");
await conn.execute("DELETE FROM avatar_messaging_frameworks");
await conn.execute("DELETE FROM avatar_objections");
console.log("✓ Cleared existing avatar data");

// ─── 1. BUYER PERSONAS (from Typeform cluster analysis) ───────────────────────
const personas = [
  {
    name: "The Dismissed Patient",
    profile: "Has seen 3–12 doctors over 5–15 years. Told repeatedly 'your labs are normal' while experiencing real, debilitating symptoms. Fatigue, brain fog, weight gain, gut issues, sleep disruption — all present simultaneously. Has normalized the suffering. Describes symptoms casually because they've been gaslit into believing they're just 'getting older.' Deeply skeptical of new solutions but desperately wants to be wrong.",
    communicationStyle: "Understated, self-deprecating. Will say 'I know it's probably nothing' while describing symptoms that have destroyed their quality of life. Needs to feel deeply seen before they'll trust. Responds to exact language that mirrors their experience — not clinical language, not wellness-speak.",
    contentNeeds: JSON.stringify([
      "Validation that their symptoms are real and connected",
      "Explanation of WHY conventional medicine missed it (systems vs. symptoms)",
      "Stories from people who were also dismissed and found answers",
      "Specific language: 'dismissed by doctors', 'labs came back normal', 'told it was stress'",
      "Hope framed as a logical next step, not a miracle claim",
      "The root cause framework — why treating symptoms never worked",
    ]),
    salesApproach: "Lead with validation, not solutions. The most powerful thing you can say is: 'You're not crazy. Your labs being normal doesn't mean you're healthy — it means the test didn't look at the right things.' Hold space for their frustration. Let them vent. Don't rush to fix. The sale happens when they feel genuinely understood for the first time.",
    traits: JSON.stringify([
      "Age 42–65, predominantly female (68% of survey respondents)",
      "Has spent $5,000–$40,000 on failed solutions (supplements, specialists, programs)",
      "Describes 3–7 simultaneous symptoms — never just one thing",
      "Uses phrases: 'I just want to feel like myself again', 'I don't recognize my own body'",
      "Partner or family often more alarmed than they are — learned helplessness",
      "Will research for weeks before committing — needs to feel it's different this time",
      "Urgency is HIGH but masked — they've been disappointed too many times",
    ]),
  },
  {
    name: "The Supplement Graveyard",
    profile: "Has a cabinet, drawer, or bin full of supplements that didn't work. Has tried everything: probiotics, adaptogens, hormone creams, detox kits, elimination diets, functional medicine protocols. Knows the language. Reads labels. Has done the research. Still doesn't feel better. The core wound is: 'I'm doing everything right and nothing is working.' Needs a fundamentally different framework, not another product.",
    communicationStyle: "Knowledgeable and frustrated. Will challenge claims. Responds to intellectual honesty and specificity. Will immediately dismiss anything that sounds like another supplement pitch. Needs to understand the WHY before they'll consider the WHAT. Respects someone who acknowledges the supplement industry's limitations.",
    contentNeeds: JSON.stringify([
      "Acknowledgment that supplements without root cause testing are guesswork",
      "The 'bin full of supplements' frame — name their exact experience",
      "Why testing changes everything: you stop guessing and start knowing",
      "The difference between symptom management and actual restoration",
      "Specific: what testing reveals that supplements can't address",
      "Transformation stories from people who also had the supplement graveyard",
    ]),
    salesApproach: "Don't pitch supplements. Ever. Lead with the testing framework. The message is: 'You're not failing the supplements — the supplements are failing you because they're not targeted to your actual biology.' Validate their research and intelligence. Then reframe: the problem isn't effort, it's information. Testing gives you the map.",
    traits: JSON.stringify([
      "Age 38–60, health-literate, has done functional medicine research",
      "Monthly supplement spend: $150–$600 before giving up",
      "Phrases: 'I've tried everything', 'nothing works for me', 'I'm probably just broken'",
      "Responds to: specificity, testing data, before/after biomarkers",
      "Will NOT respond to: another supplement recommendation without testing",
      "High conversion when shown the testing-first framework — it's genuinely different",
    ]),
  },
  {
    name: "The High-Performer in Decline",
    profile: "Was sharp, energetic, capable. Now experiencing cognitive decline, fatigue, weight gain, and mood instability that is affecting their career and relationships. Terrified of being 'found out' as declining. Frames health as performance optimization, not wellness. Time-scarce. ROI-focused. Will pay a premium for speed and certainty. The emotional core: 'I used to be able to do this. What happened to me?'",
    communicationStyle: "Direct, efficient, results-oriented. Impatient with anything that sounds vague or woo-woo. Wants the bottom line fast. Responds to metrics, timelines, and specific outcomes. Will cut off long explanations. Needs a peer, not a therapist.",
    contentNeeds: JSON.stringify([
      "Performance framing: brain fog costs you money, decisions, relationships",
      "Specific outcomes with timelines — not 'feel better', but 'cognitive clarity in 6 weeks'",
      "The ROI of fixing this vs. the cost of not fixing it",
      "Executive-level testimonials from people in similar roles",
      "Time investment required — they're protective of their schedule",
      "Why conventional medicine misses performance decline until it becomes disease",
    ]),
    salesApproach: "Be direct and efficient. Lead with outcomes, not process. Respect their time — don't over-explain. Frame health as performance optimization. The message: 'You're not sick. You're running on depleted systems. We can identify exactly which ones and fix them.' Show results quickly. Too much empathy loses them — they want a peer who takes them seriously.",
    traits: JSON.stringify([
      "Age 44–62, C-suite, senior executive, or high-earning professional",
      "Brain fog is #1 concern — affects decision-making and career trajectory",
      "Worried about early cognitive decline, being passed over, or early retirement",
      "Will pay premium for speed and certainty — not price-sensitive",
      "Responds to ROI framing and specific biomarker data",
      "Often comes in through a colleague referral or podcast",
    ]),
  },
  {
    name: "The Awakening Seeker",
    profile: "Already on a health journey. Understands root cause concepts. Has done some functional medicine work. Is now looking for the deeper integration — the spiritual, energetic, and consciousness dimensions that conventional functional medicine ignores. Values the relationship with their guide as much as the protocol. Drawn to Pedram specifically because he bridges science and ancient wisdom.",
    communicationStyle: "Open, curious, philosophical. Responds to depth and nuance. Will engage with spiritual and energetic frameworks without needing them to be fully scientific. Values authenticity and lived experience. Will see through performative wellness language immediately.",
    contentNeeds: JSON.stringify([
      "The integration of ancient wisdom and modern science — Pedram's unique position",
      "Consciousness and longevity as a unified practice",
      "The Qigong and energy work dimension — not just diet and supplements",
      "Community and belonging — others on the same path",
      "The 'Urban Monk' identity — thriving in the modern world without abandoning it",
      "Depth: why surface-level functional medicine isn't enough",
    ]),
    salesApproach: "Lead with philosophy and identity. They're not buying a protocol — they're joining a path. The message: 'You've done the physical work. Now let's go deeper.' Emphasize the community, the lineage, and the integration of all dimensions of health. They respond to authenticity and depth, not urgency.",
    traits: JSON.stringify([
      "Age 35–58, often already a practitioner or health professional",
      "Has read multiple functional medicine and wellness books including Pedram's",
      "Practices meditation, yoga, or similar — looking to deepen",
      "Values community and mentorship as much as content",
      "Will become an evangelist if they feel genuinely seen and challenged",
    ]),
  },
];

for (const p of personas) {
  await conn.execute(
    `INSERT INTO avatar_personas (name, profile, communicationStyle, contentNeeds, salesApproach, traits) VALUES (?, ?, ?, ?, ?, ?)`,
    [p.name, p.profile, p.communicationStyle, p.contentNeeds, p.salesApproach, p.traits]
  );
}
console.log(`✓ ${personas.length} verified personas seeded`);

// ─── 2. MESSAGING FRAMEWORKS (from Typeform transformation language) ───────────
const frameworks = [
  {
    name: "The Validation-First Frame",
    structure: "1. Name their exact experience using their words. 2. Validate that it's real and connected. 3. Explain WHY the system missed it (not a personal failing). 4. Introduce the root cause framework. 5. Show the path forward.",
    example: "You've been told your labs are normal. Your doctor isn't lying — those tests genuinely don't measure what's wrong with you. They measure disease, not function. You're not sick enough to show up on a standard panel, but you're not well. That gap — between 'not diseased' and 'actually thriving' — is exactly where root cause medicine lives.",
    useCase: "Top-of-funnel content, cold audience, first touch",
    emotionalJob: "Make them feel seen and understood for the first time. Remove shame and self-blame. Transfer responsibility to the system, not the person.",
  },
  {
    name: "The Supplement Graveyard Pivot",
    structure: "1. Acknowledge the bin full of supplements. 2. Validate their research and intelligence. 3. Reframe: the problem is information, not effort. 4. Introduce testing as the missing piece. 5. Show what targeted intervention looks like.",
    example: "You've tried the probiotics. The adaptogens. The elimination diets. You've done the research — probably more than most doctors. And you still don't feel better. Here's what nobody told you: supplements without testing are educated guessing. You can't fix a system you haven't measured. Testing changes everything — not because it's magic, but because it tells you exactly what your body actually needs.",
    useCase: "Mid-funnel content, warm audience, supplement-aware prospects",
    emotionalJob: "Validate their intelligence and effort. Reframe failure as a systems problem, not a personal one. Create urgency around getting the right information.",
  },
  {
    name: "The Performance Reframe",
    structure: "1. Name the performance decline in specific terms. 2. Connect it to measurable costs (career, relationships, decisions). 3. Explain the biology: depleted systems, not disease. 4. Show the testing-to-restoration pathway. 5. Quantify the ROI of fixing it.",
    example: "Brain fog isn't a mood. It's a measurable biological state — and it's costing you. Every decision made at 60% capacity, every conversation where you couldn't find the word, every morning where getting started took an hour — that's not aging. That's a system running on empty. We can measure exactly which systems are depleted. And we can fix them.",
    useCase: "Executive and high-performer audience, LinkedIn, podcast listeners",
    emotionalJob: "Remove the shame of decline. Reframe as a solvable engineering problem. Create urgency through the cost of inaction.",
  },
  {
    name: "The 'I Just Want to Feel Like Myself Again' Mirror",
    structure: "1. Use their exact phrase back to them. 2. Expand on what that means — the specific things they've lost. 3. Validate that this is a legitimate goal, not a luxury. 4. Explain why conventional medicine can't help with this. 5. Show the path back.",
    example: "You said it yourself: 'I just want to feel like myself again.' Not a new self. Not a better self. The self you remember — the one who woke up with energy, who could think clearly, who felt at home in their own body. That person didn't disappear. They got buried under years of unaddressed inflammation, hormonal drift, and a medical system that only looks for disease. We look for function. And function can be restored.",
    useCase: "Warm audience, email sequences, retargeting, long-form content",
    emotionalJob: "Mirror their exact language to create instant recognition. Make the goal feel legitimate and achievable. Create hope without hype.",
  },
  {
    name: "The Villain Reframe (System, Not Self)",
    structure: "1. Name the villain explicitly: the system, not the person. 2. Show how the system was built for a different problem. 3. Explain the gap between 'not diseased' and 'actually thriving.' 4. Position root cause medicine as the alternative. 5. Invite them to step outside the system.",
    example: "The medical system wasn't built to help you thrive. It was built to manage disease. There's no billing code for 'exhausted but technically healthy.' No protocol for 'brain fog that doesn't show up on a standard panel.' The system isn't failing you because your doctors are bad — it's failing you because it was designed for a different problem. Root cause medicine was built for yours.",
    useCase: "Awareness content, social media, podcast hooks, cold audience",
    emotionalJob: "Remove self-blame entirely. Create a clear villain (the system). Position Pedram and the Urban Monk as the alternative path.",
  },
];

for (const f of frameworks) {
  await conn.execute(
    `INSERT INTO avatar_messaging_frameworks (name, structure, example, useCase, emotionalJob) VALUES (?, ?, ?, ?, ?)`,
    [f.name, f.structure, f.example, f.useCase, f.emotionalJob]
  );
}
console.log(`✓ ${frameworks.length} verified messaging frameworks seeded`);

// ─── 3. OBJECTIONS (from Typeform open-text responses) ────────────────────────
const objections = [
  {
    objection: "I've tried everything and nothing works for me.",
    underlyingFear: "I'm broken. I'm the exception. There's something fundamentally wrong with me that can't be fixed. I'll be disappointed again.",
    responseFramework: "Validate the exhaustion. Then reframe: 'You haven't tried everything — you've tried everything that doesn't start with measurement. Every protocol you've tried was a guess. Testing isn't another guess. It's the map.' Show specific examples of people who said the same thing and found answers through testing.",
    contentExample: "Hook: 'I've tried everything. Nothing works. Sound familiar? Here's what nobody told you about why.' Body: The difference between protocols that guess and protocols that measure. CTA: Comment UPSTREAM to get the testing-first framework.",
    keyInsight: "The objection is actually proof they're the right candidate — they've eliminated all the guesswork options and are ready for the real answer.",
  },
  {
    objection: "My doctor already ran tests and everything came back normal.",
    underlyingFear: "If the tests are normal, maybe I really am just making this up. Maybe it IS just stress or aging.",
    responseFramework: "Explain the difference between disease markers and functional markers. 'Normal' means you're not sick enough to show up on a standard panel — it doesn't mean you're functioning optimally. Name the specific tests conventional medicine doesn't run: organic acids, comprehensive hormone panels, microbiome analysis, inflammatory cytokines. The gap between 'not diseased' and 'actually thriving' is exactly where root cause medicine operates.",
    contentExample: "Hook: 'Your labs came back normal. Your doctor says you're fine. But you don't feel fine. Here's why both things are true.' Body: The difference between disease markers and functional markers. What conventional medicine measures vs. what root cause medicine measures.",
    keyInsight: "This objection is the most common entry point. Resolving it is the core of the entire content strategy.",
  },
  {
    objection: "This is too expensive. I can't afford it right now.",
    underlyingFear: "I've spent so much already and it didn't work. I can't afford to be disappointed again. What if this is another dead end?",
    responseFramework: "Don't argue price. Reframe the cost of inaction: 'What has the last five years of not fixing this cost you? In productivity, in relationships, in the things you've stopped doing?' Then show the math: most people have already spent more on supplements and specialists that didn't work. This is the last investment because it starts with the right information.",
    contentExample: "Hook: 'The most expensive thing you can do for your health is keep guessing.' Body: The real cost of the supplement graveyard vs. the cost of a testing-first approach. The math of 5 years of failed protocols.",
    keyInsight: "Price objections are almost always about fear of another disappointment, not actual budget constraints. Address the fear first.",
  },
  {
    objection: "I don't have time for another health program.",
    underlyingFear: "I've started things before and couldn't sustain them. I'll fail again. I don't have the bandwidth.",
    responseFramework: "Reframe the time investment: 'This isn't a program that requires more of you — it's a protocol that tells you exactly what your body needs so you stop wasting time on things that don't work for you.' Emphasize the efficiency of targeted intervention vs. the time cost of continued guessing. Show the time they're already losing to symptoms.",
    contentExample: "Hook: 'You don't have time to be this tired.' Body: The time cost of brain fog, fatigue, and low energy vs. the time investment of a targeted protocol. How testing eliminates the trial-and-error phase.",
    keyInsight: "Time objections from high-performers are really about ROI. Show that targeted intervention saves time vs. continued guessing.",
  },
  {
    objection: "I've heard this before. It sounds like every other functional medicine program.",
    underlyingFear: "I've been burned by functional medicine promises before. This is probably the same thing with different branding.",
    responseFramework: "Acknowledge the skepticism directly: 'You're right to be skeptical. Most functional medicine programs are protocols looking for patients. This starts with your data.' Differentiate on: testing-first methodology, the specific tests used, the integration of ancient wisdom with modern science, Pedram's unique background (OMD + Qigong master + 20 years clinical practice). Show what's specifically different, not just claim it.",
    contentExample: "Hook: 'I know what you're thinking. Another functional medicine program. Here's why this one is actually different — and I can prove it.' Body: The specific methodological differences. The testing-first framework. What Pedram's background brings that most functional medicine practitioners don't have.",
    keyInsight: "Skepticism from health-literate prospects is a buying signal — they're engaged enough to push back. Specificity wins every time.",
  },
  {
    objection: "I'm not sure I'm sick enough to need this.",
    underlyingFear: "Maybe I'm being dramatic. Maybe this is just normal aging. Maybe I should just accept it.",
    responseFramework: "Reframe the threshold: 'You don't have to be sick to deserve to feel well. The question isn't whether you're sick enough — it's whether you're living at your potential.' Use the 'not diseased vs. actually thriving' gap. Normalize the pursuit of optimal function, not just the absence of disease.",
    contentExample: "Hook: 'You don't have to be sick to deserve to feel better.' Body: The difference between 'not diseased' and 'actually thriving.' Why waiting until you're sick is the most expensive strategy.",
    keyInsight: "This objection reveals internalized learned helplessness — they've been told their symptoms don't count. Validate the goal of thriving, not just surviving.",
  },
];

for (const o of objections) {
  await conn.execute(
    `INSERT INTO avatar_objections (objection, underlyingFear, responseFramework, contentExample, keyInsight) VALUES (?, ?, ?, ?, ?)`,
    [o.objection, o.underlyingFear, o.responseFramework, o.contentExample, o.keyInsight]
  );
}
console.log(`✓ ${objections.length} verified objections seeded`);

// ─── 4. PAIN POINTS (from Typeform cluster analysis, 5,485 responses) ─────────
const painPoints = [
  // ── SURFACE STAGE ────────────────────────────────────────────────────────────
  {
    stage: "surface",
    category: "Fatigue & Energy",
    title: "Waking Up Already Exhausted",
    description: "Gets 7–9 hours of sleep but wakes up unrefreshed. Coffee doesn't help. Energy crashes by 2pm. Has normalized this as 'just how I am now.' The phrase 'I used to have so much energy' appears in 34% of survey responses.",
    emotionalHook: "You're doing everything right — sleeping enough, trying to eat well — and you still wake up exhausted. That's not a willpower problem. That's a biology problem.",
    contentTopics: JSON.stringify([
      "Why sleep quantity doesn't equal sleep quality",
      "The cortisol awakening response and why it matters",
      "What your morning energy level tells you about your adrenals",
      "The 3 biological reasons you wake up tired",
      "How to test your actual sleep quality vs. just tracking hours",
    ]),
    headlineFormula: "Why You're [Symptom] Even Though You're [Doing The Right Thing]",
    exampleHeadline: "Why You're Exhausted Even Though You're Sleeping 8 Hours",
    keyQuote: "I sleep 8 hours and wake up more tired than when I went to bed. I don't understand what's wrong with me.",
  },
  {
    stage: "surface",
    category: "Brain Fog & Cognition",
    title: "The Word-Finding Problem",
    description: "Can't find words mid-sentence. Loses train of thought. Feels like thinking through cotton wool. Affecting work performance and confidence. Terrified it's early dementia. Told by doctors it's 'just stress.' 41% of respondents named cognitive symptoms as their primary concern.",
    emotionalHook: "You used to be sharp. You used to be able to hold a room. Now you're losing words mid-sentence and hoping nobody notices. That's not aging. That's inflammation.",
    contentTopics: JSON.stringify([
      "The gut-brain axis and why gut inflammation shows up as brain fog",
      "What neuroinflammation actually feels like vs. what doctors call it",
      "The 5 most common causes of brain fog that standard tests miss",
      "How to test for neuroinflammation without a neurologist",
      "The connection between blood sugar dysregulation and cognitive decline",
    ]),
    headlineFormula: "The Real Reason You Can't [Cognitive Function] Anymore",
    exampleHeadline: "The Real Reason You Can't Think Clearly Anymore (It's Not What Your Doctor Said)",
    keyQuote: "I'm 47 and I'm losing words in the middle of sentences. My doctor says it's stress. I'm terrified it's something worse.",
  },
  {
    stage: "surface",
    category: "Weight & Metabolism",
    title: "Eating Less, Gaining More",
    description: "Doing everything 'right' — eating less, exercising more — and still gaining weight or unable to lose it. Has tried multiple diets. Feels betrayed by their own body. Doctors say 'eat less, move more.' 29% of respondents named unexplained weight gain as a primary symptom.",
    emotionalHook: "You're eating less than you ever have. You're exercising more than you ever have. And the scale keeps going up. Your body isn't broken — it's responding to something your doctor isn't measuring.",
    contentTopics: JSON.stringify([
      "Why calorie restriction doesn't work when your hormones are dysregulated",
      "The thyroid-metabolism connection that standard TSH tests miss",
      "How gut dysbiosis causes weight gain independent of calorie intake",
      "The cortisol-insulin-weight gain triangle",
      "What a comprehensive metabolic panel actually looks at",
    ]),
    headlineFormula: "Why You're [Gaining Weight / Can't Lose Weight] Even Though You're [Doing Everything Right]",
    exampleHeadline: "Why You're Gaining Weight Even Though You're Eating Less Than Ever",
    keyQuote: "I've cut my calories to 1200 a day and I'm still gaining weight. My doctor just tells me to try harder.",
  },
  {
    stage: "surface",
    category: "Gut & Digestion",
    title: "The Gut That Never Settles",
    description: "Bloating, cramping, alternating constipation and diarrhea, food sensitivities that keep expanding. Has tried elimination diets. Has tried probiotics. Nothing works consistently. Eating has become stressful. 38% of respondents named gut symptoms as a primary or secondary complaint.",
    emotionalHook: "You can't eat a meal without wondering what it's going to do to you. You've eliminated half your diet and you're still reacting. That's not a food problem — that's a gut integrity problem.",
    contentTopics: JSON.stringify([
      "The difference between food sensitivity and gut permeability",
      "Why probiotics don't work without knowing your baseline microbiome",
      "The leaky gut-systemic inflammation connection",
      "How to test gut permeability vs. just guessing at food triggers",
      "The oral microbiome connection most functional medicine practitioners miss",
    ]),
    headlineFormula: "Why Your Gut [Problem] Won't Go Away No Matter What You Try",
    exampleHeadline: "Why Your Bloating Won't Go Away No Matter What You Eat",
    keyQuote: "I've cut out gluten, dairy, soy, corn, and eggs. I'm still bloated every single day. I don't know what's left to eliminate.",
  },
  // ── PRACTITIONER MAZE STAGE ───────────────────────────────────────────────
  {
    stage: "practitioner_maze",
    category: "Medical Gaslighting",
    title: "The 'Your Labs Are Normal' Loop",
    description: "Has seen multiple doctors, specialists, and functional medicine practitioners. Every test comes back 'normal' or 'within range.' Has been told it's stress, anxiety, depression, or just aging. Has been offered antidepressants for physical symptoms. The medical system has failed them repeatedly and they've started to believe the problem is them.",
    emotionalHook: "You've been told your labs are normal so many times you've started to wonder if you're making it up. You're not. 'Normal' just means you're not sick enough to show up on a standard panel.",
    contentTopics: JSON.stringify([
      "The difference between 'normal range' and 'optimal range'",
      "Why standard panels miss functional decline",
      "What tests conventional medicine doesn't run — and why",
      "The 'subclinical' zone: not diseased, not thriving",
      "How to advocate for yourself when your doctor dismisses your symptoms",
    ]),
    headlineFormula: "What 'Your Labs Are Normal' Actually Means (And What It Doesn't)",
    exampleHeadline: "What Your Doctor Means When They Say 'Your Labs Are Normal' — And Why It Doesn't Mean You're Healthy",
    keyQuote: "I've been to 7 doctors in 4 years. Every single one tells me my labs are normal. I've started to think I'm just crazy.",
  },
  {
    stage: "practitioner_maze",
    category: "Supplement Fatigue",
    title: "The Bin Full of Supplements",
    description: "Has spent $200–$800/month on supplements for years. Has a drawer, cabinet, or bin full of things that didn't work. Knows the names: adaptogens, methylated B vitamins, mitochondrial support, gut repair protocols. Has done the research. Still doesn't feel better. The core wound: 'I'm doing everything right and nothing is working.'",
    emotionalHook: "You have a bin full of supplements that didn't work. You've spent thousands. You've done the research. You're not lazy or uninformed — you just didn't have the map that tells you what your body actually needs.",
    contentTopics: JSON.stringify([
      "Why supplements without testing are educated guessing",
      "The most commonly over-supplemented nutrients that can cause harm",
      "How to read your own biomarkers to know what you actually need",
      "The supplement industry's dirty secret: most people don't absorb what they take",
      "What a targeted supplement protocol looks like vs. a shotgun approach",
    ]),
    headlineFormula: "Why Your [Supplement / Protocol] Isn't Working (And What To Do Instead)",
    exampleHeadline: "Why Your Supplements Aren't Working — And It's Not Because You Bought the Wrong Ones",
    keyQuote: "I have a whole bin of supplements I've tried. I've spent probably $15,000 over the last 5 years. I still feel terrible.",
  },
  {
    stage: "practitioner_maze",
    category: "Practitioner Fatigue",
    title: "The Revolving Door of Practitioners",
    description: "Has seen: primary care, endocrinologist, gastroenterologist, rheumatologist, naturopath, functional medicine doctor, acupuncturist, nutritionist. Each one has a different theory. Each one has a different protocol. Nothing has worked consistently. Has spent $20,000–$60,000 on practitioners. Is exhausted by the process of seeking help.",
    emotionalHook: "You've seen more practitioners than most people see in a lifetime. You're not the problem. The problem is that most practitioners treat the symptom in front of them, not the whole system underneath.",
    contentTopics: JSON.stringify([
      "Why symptom-based medicine fails complex chronic cases",
      "The systems approach vs. the specialist approach",
      "What a root cause practitioner looks for that specialists miss",
      "How to evaluate a practitioner before you invest",
      "The difference between a protocol and a personalized plan",
    ]),
    headlineFormula: "Why [Number] Doctors / Practitioners Couldn't Help You (And What That Actually Means)",
    exampleHeadline: "Why 6 Doctors Couldn't Help You — And What That Actually Tells Us About Your Case",
    keyQuote: "I've seen 11 different practitioners. Every single one has a different theory. I've spent $40,000 and I'm no better than when I started.",
  },
  // ── DEEP PAIN STAGE ───────────────────────────────────────────────────────
  {
    stage: "deep_pain",
    category: "Identity Loss",
    title: "I Don't Recognize My Own Body Anymore",
    description: "The deepest layer of the pain. Not just symptoms — the loss of self. 'I used to be the person who...' The activities they've given up. The version of themselves they're grieving. The fear that this is permanent. This language appears in 52% of long-form survey responses and is the most emotionally resonant entry point for transformation stories.",
    emotionalHook: "You're not just tired. You're grieving the person you used to be. The one who had energy, who could think clearly, who felt at home in their own body. That person isn't gone. They're buried. And we can find them.",
    contentTopics: JSON.stringify([
      "Transformation stories: 'I used to be...' → 'Now I am...'",
      "The identity dimension of chronic illness that medicine ignores",
      "Why 'just accepting it' is not the same as healing",
      "What it means to feel like yourself again — and why it's a legitimate goal",
      "The grief of chronic illness and how to move through it",
    ]),
    headlineFormula: "How [Person Like Them] Got Back to Feeling Like Themselves After [Years] of [Symptoms]",
    exampleHeadline: "How Sarah Got Back to Feeling Like Herself After 8 Years of 'Normal Labs' and Unexplained Fatigue",
    keyQuote: "I don't recognize myself anymore. I used to be the person who ran marathons, who was always the one with energy in the room. Now I can barely get through a workday. I just want to feel like myself again.",
  },
  {
    stage: "deep_pain",
    category: "Relationship Impact",
    title: "My Health Is Affecting My Relationships",
    description: "Chronic symptoms are affecting marriage, parenting, friendships, and work relationships. Too tired to be present. Brain fog affecting communication. Mood instability creating conflict. The shame of not being the partner, parent, or colleague they want to be. This dimension is rarely named in content but is the most powerful emotional driver in the survey data.",
    emotionalHook: "Your health isn't just affecting you. It's affecting the people you love most. Your kids, your partner, your team. You know it. They know it. And you're carrying the weight of that every day.",
    contentTopics: JSON.stringify([
      "The relationship cost of chronic illness that nobody talks about",
      "How inflammation affects mood, patience, and emotional regulation",
      "Why 'I'm fine' is the most expensive thing you can say to your family",
      "The partner's perspective: what they see that you don't",
      "Transformation stories that include the relationship dimension",
    ]),
    headlineFormula: "What Chronic [Symptom] Is Actually Doing to Your [Relationship / Family / Marriage]",
    exampleHeadline: "What Chronic Fatigue Is Actually Doing to Your Marriage (And How to Stop It)",
    keyQuote: "My husband says I'm not the person he married. He's right. I'm too tired to be present for my kids. I'm snapping at everyone. I hate who I've become.",
  },
  // ── ROOT CAUSE STAGE ─────────────────────────────────────────────────────
  {
    stage: "root_cause",
    category: "Systems Thinking",
    title: "Everything Is Connected and Nobody Is Looking at the Whole",
    description: "Has done enough research to understand that their symptoms are connected — gut, hormones, brain, immune system. But every practitioner only looks at their piece. Nobody is looking at the whole system. This is the insight that makes them ready for a root cause approach. They're not looking for another specialist — they're looking for someone who sees the whole picture.",
    emotionalHook: "You've figured out that your gut, your hormones, your brain, and your immune system are all talking to each other. Now you need someone who's actually listening to all of them at once.",
    contentTopics: JSON.stringify([
      "The web of life: how every system in your body is connected",
      "Why treating one system without the others always fails",
      "The gut-hormone-brain-immune axis explained simply",
      "What a whole-system assessment looks like vs. a specialist assessment",
      "The root cause map: where to start when everything is connected",
    ]),
    headlineFormula: "Why Treating [One System] Without Looking at [Connected System] Never Works",
    exampleHeadline: "Why Treating Your Gut Without Looking at Your Hormones Never Works — And What to Do Instead",
    keyQuote: "I've figured out that everything is connected. My gut affects my hormones, my hormones affect my brain, my brain affects my gut. But every doctor I see only looks at one piece. I need someone who sees the whole picture.",
  },
  {
    stage: "root_cause",
    category: "Transformation Readiness",
    title: "I'm Ready to Actually Fix This — Not Just Manage It",
    description: "Has moved past symptom management and is ready for root cause resolution. Tired of protocols that suppress symptoms without addressing causes. Wants to understand their own biology. Wants a plan, not a prescription. This is the highest-intent prospect — they're not shopping, they're ready to commit to the right approach.",
    emotionalHook: "You're done managing symptoms. You want to actually fix this. Not suppress it. Not cope with it. Fix it. That's exactly what root cause medicine is designed to do.",
    contentTopics: JSON.stringify([
      "The difference between symptom management and root cause resolution",
      "What 'actually fixing it' looks like: the testing-to-restoration pathway",
      "How to know if you're ready for a root cause approach",
      "What the first 90 days of root cause medicine looks like",
      "Transformation stories: from symptom management to actual restoration",
    ]),
    headlineFormula: "What It Actually Looks Like to [Fix / Resolve / Heal] [Symptom] Instead of Just Managing It",
    exampleHeadline: "What It Actually Looks Like to Fix Chronic Fatigue Instead of Just Managing It",
    keyQuote: "I'm done managing this. I've been managing it for 10 years. I want to actually fix it. I want to understand what's actually wrong and actually address it.",
  },
];

for (const p of painPoints) {
  await conn.execute(
    `INSERT INTO avatar_pain_points (stage, category, title, description, emotionalHook, contentTopics, headlineFormula, exampleHeadline, keyQuote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.stage, p.category, p.title, p.description, p.emotionalHook, JSON.stringify(p.contentTopics), p.headlineFormula, p.exampleHeadline, p.keyQuote]
  );
}
console.log(`✓ ${painPoints.length} verified pain points seeded`);

await conn.end();
console.log("\n=== Avatar Intelligence Seeding Complete ===");
console.log(`   ${personas.length} buyer personas (verified Typeform clusters)`);
console.log(`   ${frameworks.length} messaging frameworks (transformation language)`);
console.log(`   ${objections.length} objections with response frameworks`);
console.log(`   ${painPoints.length} pain points across 4 journey stages`);
console.log("   Source: Urban Monk Audience Language Map v2 (5,485 responses)");
