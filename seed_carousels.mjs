/**
 * Seed 20 Instagram Reframe Post carousels into the Script Library
 * via direct database insertion using the project's DB connection.
 */
import { config } from "dotenv";
config();

// Use the scripts.seed tRPC procedure via HTTP
// The server is running on port 3000
const BASE_URL = "http://localhost:3000";

const carousels = [
  {
    title: "Your 2 AM Wake-Up Isn't Insomnia — It's Your Liver Talking",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Burnout Recovery Seeker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "Why do you keep waking up at 2 AM even when you're exhausted?" | SLIDE 2 — Reframe: "It's not insomnia. Your liver is trying to tell you something." | SLIDE 3 — The Science: In Chinese medicine, the liver's peak detox window is 1–3 AM. When it's overwhelmed, it signals your adrenals. Your adrenals release cortisol. You wake up. | SLIDE 4 — Western Confirmation: The liver is responsible for clearing cortisol from your bloodstream. When it can't keep up, cortisol accumulates and disrupts your sleep architecture. | SLIDE 5 — What Overwhelms the Liver: Alcohol (even one glass), late-night eating, chronic stress, processed foods. | SLIDE 6 — The 2 AM Mind Race: That racing mind at 2 AM is a cortisol pulse. Your body is trying to mobilize energy to help your liver finish its work. | SLIDE 7 — What Actually Helps: Eat dinner earlier (before 7 PM), cut alcohol for 30 days, add bitter greens (dandelion, arugula), reduce cortisol load during the day. | SLIDE 8 — The Bigger Picture: The 2 AM wake-up is an early warning sign. Your detox system is overloaded. Your stress response is dysregulated. | SLIDE 9 — The Path Forward: You don't need a sleep aid. You need to reduce the burden on your liver and adrenals. | SLIDE 10 — CTA: Urban Monk Academy — link in bio → Free guide.`,
    notes: "HIGH PRIORITY — targets all 8 personas, no competitor owns this hook. Pair with Burnout Recovery Definitive Guide blog post.",
  },
  {
    title: "Eastern Medicine Knew About Leaky Gut 3,000 Years Before Western Science Named It",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Holistic Health Student",
    contentGoal: "llm_seo",
    body: `SLIDE 1 — Hook: "Western medicine discovered 'leaky gut' in the 1980s. Chinese medicine described it 3,000 years ago." | SLIDE 2 — Western Discovery: Intestinal permeability allows undigested particles into the bloodstream, triggering systemic inflammation. | SLIDE 3 — Eastern Description: 'Spleen qi deficiency' — the failure of the digestive system's transformative functions. The Spleen governs the integrity of the gut lining. | SLIDE 4 — Symptoms Match: Bloating, loose stools, fatigue after eating, brain fog, food sensitivities. | SLIDE 5 — What Damages the Spleen: Cold/raw foods, overthinking, irregular meals, sugar/alcohol/dairy. Modern research confirms all of these. | SLIDE 6 — Gut-Brain Connection: 95% of serotonin is made in the gut. When the gut lining breaks down, brain chemistry breaks down with it. | SLIDE 7 — Healing Foods: Bone broth, fermented foods, cooked vegetables, ginger, turmeric, congee. | SLIDE 8 — Stress Connection: Cortisol directly increases intestinal permeability. You cannot heal your gut while chronically stressed. | SLIDE 9 — Integration: Western diagnostics + Eastern dietary principles + stress regulation. | SLIDE 10 — CTA: Urban Monk Academy — 3,000 years of wisdom + modern science.`,
    notes: "Strong LLM SEO play — targets 'leaky gut Chinese medicine' and 'Eastern medicine gut health' gap queries.",
  },
  {
    title: "The 5 Signs Your Adrenals Are Exhausted (And What To Do About It)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Burnout Recovery Seeker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "Your body has been trying to tell you for months. Here are the 5 signs your adrenals are exhausted." | SLIDE 2 — Sign 1: You need coffee to feel human in the morning. Your adrenals are failing to produce adequate morning cortisol. | SLIDE 3 — Sign 2: You get a second wind at 10–11 PM. Cortisol dysregulation — stress hormones firing at the wrong time. | SLIDE 4 — Sign 3: You crash in the afternoon (2–4 PM). Your cortisol curve is collapsing. | SLIDE 5 — Sign 4: You're tired but wired. Can't turn your brain off. HPA axis dysregulation — stress response stuck in 'on' position. | SLIDE 6 — Sign 5: Salt cravings. Your adrenals regulate sodium balance. Depletion = salt cravings. | SLIDE 7 — Root Cause: One pattern — a stress-response system chronically overactivated and now dysregulated. Chinese medicine: Kidney yang deficiency. | SLIDE 8 — What Makes It Worse: Skipping meals, intense exercise when depleted, caffeine after noon, sleep deprivation. | SLIDE 9 — What Helps: Consistent sleep/wake times, ashwagandha/rhodiola/eleuthero, blood sugar stability, gentle movement. | SLIDE 10 — CTA: Urban Monk Academy — complete East-West protocol for adrenal recovery.`,
    notes: "Targets 'adrenal fatigue signs' and 'HPA axis burnout symptoms' — high search volume gap queries.",
  },
  {
    title: "Why Meditation Isn't Working For You (And What To Do Instead)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Spiritual Growth Explorer",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You've tried meditation. It didn't work. Here's why — and what actually does." | SLIDE 2 — Problem: Most people approach meditation like a performance. They try to 'clear their mind,' fail, and conclude they're 'bad at meditation.' | SLIDE 3 — What Meditation Actually Is: Not the absence of thought. The practice of noticing thought without being controlled by it. | SLIDE 4 — Nervous System Problem: In chronic stress, your nervous system is stuck in sympathetic dominance. Stillness feels unbearable — your body is flooded with cortisol. | SLIDE 5 — Missing Step: Downregulate your nervous system BEFORE you meditate. 5 minutes of slow diaphragmatic breathing (4 in, 6 out) activates the vagus nerve. | SLIDE 6 — Eastern Solution: Qigong, pranayama, and tai chi are the preparation for meditation — they move stuck energy and regulate the breath. | SLIDE 7 — Research: MBSR reduces cortisol by measurable amounts. Works best combined with movement practices that discharge accumulated stress. | SLIDE 8 — Better Protocol: 10 min gentle movement → 5 min breathwork → 10–20 min seated meditation. | SLIDE 9 — Real Goal: Cultivating a witness — a part of you that can observe thoughts without being swept away by them. | SLIDE 10 — CTA: Urban Monk Academy — movement, breath, and meditation as one integrated system.`,
    notes: "Targets 'why meditation doesn't work' and 'meditation for stress relief' — high-save format for Spiritual Growth Explorer persona.",
  },
  {
    title: "The Gut-Brain Axis: Why Your Anxiety Lives in Your Belly",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Chronic Condition Navigator",
    contentGoal: "llm_seo",
    body: `SLIDE 1 — Hook: "95% of your serotonin is made in your gut. Your anxiety might not be in your head." | SLIDE 2 — Discovery: The gut-brain axis — bidirectional communication via vagus nerve, enteric nervous system, and microbiome. | SLIDE 3 — Chinese Medicine Knew: 'Overthinking damages the Spleen.' Chronic anxiety disrupts gut motility and microbiome composition. | SLIDE 4 — Microbiome Connection: Gut produces serotonin, GABA, dopamine. Disrupted microbiome = disrupted brain chemistry. | SLIDE 5 — What Disrupts the Microbiome: Antibiotics, chronic stress, ultra-processed foods, alcohol, lack of fiber. | SLIDE 6 — Anxiety-Gut Loop: Anxiety → cortisol → gut inflammation → disrupted microbiome → reduced serotonin → more anxiety. | SLIDE 7 — Breaking the Loop: Fermented foods, prebiotic fiber, breathwork, reducing ultra-processed foods. | SLIDE 8 — Vagus Nerve Key: Activating it shifts you from fight-or-flight to rest-and-digest. Techniques: slow exhalation, cold water, humming, gargling. | SLIDE 9 — Integration: Gut health + nervous system regulation + addressing root stressors. | SLIDE 10 — CTA: Urban Monk Academy — complete gut-brain protocol.`,
    notes: "Targets 'gut brain connection anxiety' and 'microbiome mental health' — strong LLM SEO play, high save rate.",
  },
  {
    title: "What Happens to Your Body in the First 30 Days Without Alcohol",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Midlife Vitality Optimizer",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "What actually happens to your body in the first 30 days without alcohol. Day by day." | SLIDE 2 — Days 1–3: Sleep becomes fragmented (rebound effect), mild anxiety, increased thirst. This is normal. | SLIDE 3 — Days 4–7: Liver enzymes normalize, 2 AM wake-ups resolve, energy improves, skin less puffy. | SLIDE 4 — Days 8–14: Brain fog lifts, sleep quality increases, mood stabilizes, gut inflammation reduces. | SLIDE 5 — Days 15–21: Blood sugar improves, cortisol normalizes, weight loss may begin, immune function improves. | SLIDE 6 — Days 22–30: Sleep dramatically better, consistent energy, clearer skin, significantly reduced anxiety, noticeably improved mental clarity. | SLIDE 7 — Chinese Medicine Perspective: Alcohol is 'damp-heat' — overloads Liver and Spleen, depletes Kidney yin. 30 days allows the Liver to clear its backlog. | SLIDE 8 — Long-Term: After 3 months — liver fat reduces 15%, blood pressure normalizes, cancer risk decreases, cognitive function continues improving. | SLIDE 9 — Hardest Part: Not physical withdrawal — it's social pressure and habit loops. Requires building new rituals. | SLIDE 10 — CTA: Urban Monk Academy — complete protocol for alcohol reduction and liver recovery.`,
    notes: "High-save, high-share. Targets 'what happens when you stop drinking' — massive search volume, no competitor owns the East-West angle.",
  },
  {
    title: "The 5 Stages of Burnout (And Which One You're In)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Burnout Recovery Seeker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "Burnout doesn't happen overnight. It happens in 5 stages. Which one are you in?" | SLIDE 2 — Stage 1 (Honeymoon): High energy, high commitment, high idealism. You love what you do. This is when the seeds of burnout are planted. | SLIDE 3 — Stage 2 (Onset of Stress): Work begins to feel less enjoyable. You're tired but pushing through. Sleep starts to suffer. | SLIDE 4 — Stage 3 (Chronic Stress): Persistent fatigue, cynicism, resentment. You're running on cortisol. The 2 AM wake-ups begin. | SLIDE 5 — Stage 4 (Burnout): Overwhelming exhaustion, self-doubt, sense of failure. Physical symptoms: headaches, gut issues, immune problems. | SLIDE 6 — Stage 5 (Habitual Burnout): Burnout becomes embedded in your life. Depression, anxiety, physical illness. This is the point of no return without major intervention. | SLIDE 7 — The Chinese Medicine Map: Stage 1–2 = Liver qi stagnation. Stage 3 = Kidney yin deficiency. Stage 4–5 = Kidney yang deficiency. Each stage requires different treatment. | SLIDE 8 — The Earlier You Catch It: Stage 1–2 recovery: weeks. Stage 3 recovery: 3–6 months. Stage 4–5 recovery: 12–24 months. | SLIDE 9 — The Assessment: Key questions: Are you tired but wired? Do you wake at 2–4 AM? Do you need caffeine to function? Do you feel emotionally numb? | SLIDE 10 — CTA: Urban Monk Academy — free burnout stage assessment. Link in bio.`,
    notes: "High engagement — people will tag others. Targets 'stages of burnout' — high search volume.",
  },
  {
    title: "The Real Reason You Can't Lose Weight (It's Not What You Think)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Midlife Vitality Optimizer",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You're eating less. You're exercising more. You're still not losing weight. Here's why." | SLIDE 2 — The Cortisol Problem: Chronic stress elevates cortisol. Cortisol signals the body to store fat — especially visceral (belly) fat. You cannot out-exercise a high-cortisol state. | SLIDE 3 — The Sleep Connection: Sleep deprivation increases ghrelin (hunger hormone) and decreases leptin (satiety hormone). One bad night of sleep increases caloric intake by 300–500 calories the next day. | SLIDE 4 — The Thyroid Factor: Chronic stress suppresses thyroid function. A sluggish thyroid slows metabolism. This is why stressed people gain weight even on restricted calories. | SLIDE 5 — The Gut Microbiome: Your gut bacteria influence how many calories you extract from food. A disrupted microbiome extracts more calories from the same food. | SLIDE 6 — The Chinese Medicine View: 'Spleen qi deficiency' — the digestive system's inability to transform and transport nutrients efficiently. Creates 'dampness' — the Chinese medicine term for metabolic stagnation. | SLIDE 7 — The Blood Sugar Trap: Stress → cortisol → blood sugar spike → insulin → fat storage. Then blood sugar crashes → hunger → overeating. The cycle repeats. | SLIDE 8 — What Actually Works: Stress reduction (the root cause), sleep optimization, blood sugar stabilization, gut health support, gentle movement. | SLIDE 9 — The Reframe: Weight loss is not a willpower problem. It is a hormonal and metabolic problem. Fix the hormones and the metabolism. The weight follows. | SLIDE 10 — CTA: Urban Monk Academy — the complete metabolic reset protocol.`,
    notes: "Massive reach potential — weight loss is the highest-volume health topic. The cortisol/stress angle is underserved.",
  },
  {
    title: "What Your Sleep Position Is Telling You About Your Health",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Stressed Parent Multitasker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "The position you sleep in reveals more about your health than you might think." | SLIDE 2 — Fetal Position (Most Common): Curling up protects the vital organs — an ancient survival response. If you always sleep in fetal position, your nervous system may be stuck in a protective, guarded state. | SLIDE 3 — On Your Back: Optimal for spinal alignment and acid reflux. But if you snore or have sleep apnea, this position worsens it. | SLIDE 4 — On Your Left Side: The best position for digestion and detoxification. The stomach and lymphatic system drain more efficiently on the left. Chinese medicine has recommended left-side sleeping for centuries. | SLIDE 5 — On Your Right Side: Can worsen acid reflux and put pressure on the liver. The liver is on the right — sleeping on it can impair its nighttime detox function. | SLIDE 6 — Stomach Sleeping: The worst position for spinal health. Forces the neck into rotation and flattens the lumbar curve. Associated with higher rates of neck and back pain. | SLIDE 7 — The Chinese Medicine Organ Clock: Your body prioritizes different organs at different times of night. 11 PM–1 AM: Gallbladder. 1–3 AM: Liver. 3–5 AM: Lungs. Your sleep position affects how well each organ can do its work. | SLIDE 8 — The Nervous System Signal: If you can't sleep without being curled up tightly, your nervous system is in a chronic state of protection. This is a signal to work on nervous system regulation. | SLIDE 9 — The Optimal Protocol: Left side for the first half of the night (digestion and liver support). On your back for the second half (spinal alignment and deep sleep). | SLIDE 10 — CTA: Urban Monk Academy — the complete sleep optimization protocol.`,
    notes: "High curiosity/share factor. Targets 'sleep position health' — underserved with East-West angle.",
  },
  {
    title: "The 10-Minute Morning Routine That Changes Everything",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Stressed Parent Multitasker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You don't have time for a 2-hour morning routine. Here's what actually matters in 10 minutes." | SLIDE 2 — Minute 1: Don't check your phone. The first stimulus of the day sets your nervous system's baseline. Give your brain 60 seconds of silence before the world rushes in. | SLIDE 3 — Minutes 2–4: Breathwork. 4 counts in, 6 counts out. This activates the vagus nerve, shifts you into parasympathetic mode, and sets your cortisol curve for the day. | SLIDE 4 — Minute 5: Hydration. Your body is dehydrated after 7–8 hours without water. 16 oz of water with a pinch of sea salt (electrolytes) before coffee. | SLIDE 5 — Minutes 6–8: Movement. 2 minutes of gentle movement — sun salutations, qigong, or simply standing and stretching. This activates your lymphatic system and wakes up your body. | SLIDE 6 — Minutes 9–10: Intention. One sentence: What is the most important thing I will do today? Write it down. This activates the prefrontal cortex and sets the direction for the day. | SLIDE 7 — Why This Works: Each element targets a specific system: breath → nervous system, water → cellular hydration, movement → lymphatic activation, intention → prefrontal cortex engagement. | SLIDE 8 — What to Skip: The elaborate journaling, the cold plunge, the 45-minute workout. These are great if you have time. But the 10-minute version captures 80% of the benefit. | SLIDE 9 — The Chinese Medicine Basis: Morning is the time of the Large Intestine (5–7 AM) and Stomach (7–9 AM) in the organ clock. These are the organs of elimination and nourishment — the perfect time to clear and fuel. | SLIDE 10 — CTA: Urban Monk Academy — the complete morning protocol and daily practice system.`,
    notes: "High-save format. Targets 'morning routine for busy people' and 'quick morning routine' — massive search volume.",
  },
  {
    title: "Why You're Always Tired (Even After 8 Hours of Sleep)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Burnout Recovery Seeker",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You slept 8 hours. You're still exhausted. Here's why." | SLIDE 2 — The Sleep Quality Problem: Hours of sleep ≠ quality of sleep. If you're not getting enough deep sleep (slow-wave) and REM sleep, 8 hours won't restore you. | SLIDE 3 — The Cortisol Disruption: High cortisol at night suppresses melatonin and disrupts sleep architecture. You may be 'sleeping' but not actually recovering. | SLIDE 4 — The Mitochondrial Issue: Fatigue that isn't relieved by sleep is often mitochondrial — your cells can't efficiently produce energy. This is the cellular signature of burnout. | SLIDE 5 — The Thyroid Factor: Subclinical hypothyroidism is extremely common and frequently missed. A sluggish thyroid produces fatigue that no amount of sleep can fix. | SLIDE 6 — The Nutrient Deficiencies: Iron, B12, vitamin D, and magnesium deficiencies all cause fatigue that mimics sleep deprivation. These are easily tested and corrected. | SLIDE 7 — The Chinese Medicine Diagnosis: Persistent fatigue despite adequate sleep is a sign of Kidney deficiency — the depletion of the body's deep constitutional reserve (jing). This requires restoration, not just rest. | SLIDE 8 — The Gut Connection: Poor gut health impairs nutrient absorption. You can eat well and still be deficient if your gut isn't absorbing properly. | SLIDE 9 — The Assessment: Key questions — Do you feel unrefreshed after sleep? Do you have brain fog in the morning? Do you need caffeine to function? These point to the root cause. | SLIDE 10 — CTA: Urban Monk Academy — the complete fatigue recovery protocol.`,
    notes: "Extremely high search volume. Targets 'tired after 8 hours sleep' — one of the top burnout-related queries.",
  },
  {
    title: "The Ancient Practice That Modern Science Just Proved Works",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Spiritual Growth Explorer",
    contentGoal: "llm_seo",
    body: `SLIDE 1 — Hook: "Monks have practiced this for 2,000 years. Scientists just figured out why it works." | SLIDE 2 — The Practice: Qigong — the Chinese system of coordinated body movement, breath, and meditation. | SLIDE 3 — The Ancient Claim: Qigong cultivates 'qi' (vital energy), regulates the organ systems, and promotes longevity. Practitioners claimed it could reverse aging and heal chronic disease. | SLIDE 4 — The Modern Research: A 2019 meta-analysis of 33 randomized controlled trials found that qigong significantly reduces cortisol, blood pressure, inflammatory markers, and symptoms of depression and anxiety. | SLIDE 5 — The Mechanism: Qigong activates the vagus nerve (parasympathetic activation), reduces inflammatory cytokines (IL-6, TNF-alpha), improves HPA axis regulation, and increases BDNF (brain-derived neurotrophic factor — the brain's growth hormone). | SLIDE 6 — The Mitochondrial Effect: Slow, coordinated movement combined with breath regulation improves mitochondrial efficiency — the cells' ability to produce energy. This is the mechanism behind the ancient claim that qigong 'cultivates vital energy.' | SLIDE 7 — The Epigenetic Effect: Regular qigong practice has been shown to alter gene expression — specifically, genes involved in inflammation, stress response, and immune function. | SLIDE 8 — How to Start: 10 minutes of basic qigong in the morning is sufficient to produce measurable effects. The key is consistency, not duration. | SLIDE 9 — The Bigger Picture: Qigong is not a supplement or a hack. It is a practice — a way of relating to your body and your energy that changes over time. | SLIDE 10 — CTA: Urban Monk Academy — includes a complete qigong curriculum for beginners.`,
    notes: "Targets 'qigong benefits science' and 'ancient practices modern science' — strong LLM SEO play.",
  },
  {
    title: "What Your Tongue Is Telling You About Your Health",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Holistic Health Student",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "Chinese medicine practitioners have been reading tongues for 2,000 years. Here's what yours is saying." | SLIDE 2 — The Tongue as Diagnostic Tool: In Chinese medicine, the tongue is a map of the body's internal state. Its color, coating, shape, and moisture reveal the condition of the organ systems. | SLIDE 3 — Pale Tongue: Indicates blood deficiency or yang deficiency. Associated with fatigue, cold extremities, and poor circulation. | SLIDE 4 — Red Tongue: Indicates heat in the body — inflammation, infection, or yin deficiency. Associated with anxiety, insomnia, and hot flashes. | SLIDE 5 — Purple/Dusky Tongue: Indicates blood stagnation — poor circulation, chronic pain, or cardiovascular stress. | SLIDE 6 — Thick White Coating: Indicates cold dampness — poor digestion, sluggish metabolism, and excess mucus. Associated with bloating, fatigue, and brain fog. | SLIDE 7 — Thick Yellow Coating: Indicates damp heat — inflammation in the digestive system. Associated with acid reflux, bad breath, and bowel irregularity. | SLIDE 8 — No Coating (Peeled Tongue): Indicates yin deficiency — depletion of the body's cooling, nourishing fluids. Associated with night sweats, dry mouth, and anxiety. | SLIDE 9 — Teeth Marks on the Edges: Indicates Spleen qi deficiency — the digestive system is struggling. Associated with bloating, loose stools, and fatigue after eating. | SLIDE 10 — CTA: Urban Monk Academy — learn to read your body's signals with the complete East-West diagnostic framework.`,
    notes: "High curiosity/share factor. Unique hook — no Western wellness account does tongue diagnosis.",
  },
  {
    title: "The Difference Between Stress and Burnout (And Why It Matters)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Corporate Wellness Advocate",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "Stress and burnout are not the same thing. Treating burnout like stress is why most people don't recover." | SLIDE 2 — Stress: An acute response to a specific stressor. Characterized by urgency, hyperarousal, and the sense that things matter too much. Stress is resolved when the stressor is removed. | SLIDE 3 — Burnout: A chronic state of depletion that develops when stress is sustained without adequate recovery. Characterized by exhaustion, cynicism, and the sense that nothing matters. Burnout is not resolved by removing the stressor. | SLIDE 4 — The Physiological Difference: Stress = hypercortisolism (too much cortisol). Burnout = hypocortisolism (too little cortisol). The adrenal glands have been so chronically overactivated that they can no longer produce adequate cortisol. | SLIDE 5 — Why This Matters for Treatment: Stress responds to relaxation and vacation. Burnout does not. If you take a vacation and come back feeling exactly the same, you have burnout, not stress. | SLIDE 6 — The Chinese Medicine Distinction: Stress = Liver qi stagnation (energy stuck, frustrated, irritable). Burnout = Kidney deficiency (deep reserve depleted, exhausted, unmotivated). Different patterns, different treatments. | SLIDE 7 — The Burnout Trap: Many burned-out people try to treat their burnout with the same strategies that caused it — pushing harder, adding more, optimizing more. This accelerates the depletion. | SLIDE 8 — The Recovery Difference: Stress recovery: days to weeks. Burnout recovery: months to years. The earlier you catch it, the faster the recovery. | SLIDE 9 — The Assessment: Are you exhausted but can't relax? Do you feel emotionally numb? Have you lost your sense of purpose? These are burnout signals, not stress signals. | SLIDE 10 — CTA: Urban Monk Academy — free burnout vs. stress assessment. Link in bio.`,
    notes: "High engagement — corporate wellness audience will share this widely. Targets 'stress vs burnout difference'.",
  },
  {
    title: "Why Your Doctor Missed Your Burnout (And What to Ask For Instead)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Burnout Recovery Seeker",
    contentGoal: "community_engagement",
    body: `SLIDE 1 — Hook: "You told your doctor you were exhausted. They ran standard labs. Everything came back 'normal.' Here's why." | SLIDE 2 — The Standard Lab Problem: Standard labs check for disease, not dysfunction. They will miss HPA axis dysregulation, subclinical thyroid issues, mitochondrial dysfunction, and micronutrient deficiencies — all of which are common in burnout. | SLIDE 3 — The 'Normal' Trap: 'Normal' means within the reference range — a range derived from the average population, which includes many unhealthy people. 'Normal' is not the same as 'optimal.' | SLIDE 4 — What to Ask For: Cortisol awakening response (CAR) test — a 4-point salivary cortisol test that maps your cortisol curve throughout the day. This is the gold standard for HPA axis assessment. | SLIDE 5 — Also Ask For: Full thyroid panel (TSH, free T3, free T4, reverse T3, thyroid antibodies) — not just TSH. Ferritin (not just hemoglobin). Vitamin D (25-OH). Magnesium (RBC, not serum). | SLIDE 6 — The Functional Medicine Difference: Functional medicine practitioners are trained to look for dysfunction, not just disease. They use expanded lab panels and interpret results in the context of your symptoms and history. | SLIDE 7 — The Chinese Medicine Complement: A skilled Chinese medicine practitioner can identify the pattern of imbalance — Liver qi stagnation, Kidney deficiency, Spleen qi deficiency — that underlies your burnout, even before labs confirm it. | SLIDE 8 — What to Bring to Your Doctor: A symptom timeline (when did this start, what has changed), your sleep data (if you have a wearable), and a specific request for the tests listed above. | SLIDE 9 — The Advocacy Imperative: You are the expert on your own body. If your doctor dismisses your symptoms, seek a second opinion. Burnout is a real, measurable, treatable condition. | SLIDE 10 — CTA: Urban Monk Academy — includes a complete guide to navigating the healthcare system for burnout recovery.`,
    notes: "High engagement — people will comment with their own experiences. Builds community trust.",
  },
  {
    title: "The 5 Foods That Are Making Your Anxiety Worse",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Chronic Condition Navigator",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You might be eating your way into anxiety. Here are the 5 foods most likely to make it worse." | SLIDE 2 — Food 1: Sugar. Blood sugar spikes trigger cortisol release. Blood sugar crashes trigger adrenaline. Both amplify anxiety. The rollercoaster of blood sugar is a rollercoaster of anxiety. | SLIDE 3 — Food 2: Caffeine (in excess). Caffeine blocks adenosine (the sleep-promoting neurotransmitter) and stimulates cortisol and adrenaline. For anxiety-prone people, caffeine after noon can disrupt sleep and amplify anxiety for 12+ hours. | SLIDE 4 — Food 3: Alcohol. Alcohol initially reduces anxiety (GABA activation) but produces a rebound anxiety effect as it metabolizes — especially the next morning. Chronic alcohol use depletes GABA and serotonin. | SLIDE 5 — Food 4: Ultra-processed foods. These disrupt the gut microbiome, which produces 95% of your serotonin and significant amounts of GABA. A disrupted microbiome = disrupted neurotransmitter production = amplified anxiety. | SLIDE 6 — Food 5: Gluten (for sensitive individuals). For people with non-celiac gluten sensitivity, gluten triggers gut inflammation and intestinal permeability — both of which amplify anxiety via the gut-brain axis. | SLIDE 7 — The Chinese Medicine View: These foods all create 'dampness and heat' in the digestive system — the Chinese medicine description of gut inflammation and dysbiosis. | SLIDE 8 — What to Eat Instead: Blood sugar stabilizing foods (protein + fat + fiber at every meal), fermented foods (microbiome support), magnesium-rich foods (anxiety regulation), omega-3 rich foods (anti-inflammatory). | SLIDE 9 — The 30-Day Experiment: Remove these 5 foods for 30 days and track your anxiety levels. Most people notice significant improvement within 2 weeks. | SLIDE 10 — CTA: Urban Monk Academy — the complete anti-anxiety nutrition protocol.`,
    notes: "High save/share rate. Targets 'foods that cause anxiety' — high search volume.",
  },
  {
    title: "The Midlife Energy Crisis: What's Really Happening and How to Fix It",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Midlife Vitality Optimizer",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "You used to have energy. Now you don't. Here's what's actually happening in your body — and how to reverse it." | SLIDE 2 — The Hormonal Shift: In your 40s and 50s, testosterone, estrogen, progesterone, DHEA, and growth hormone all decline. These hormones are not just about reproduction — they are the primary drivers of energy, metabolism, and vitality. | SLIDE 3 — The Mitochondrial Decline: Mitochondrial function declines with age — but it declines much faster in people who are chronically stressed, sleep-deprived, and sedentary. The 'midlife energy crisis' is largely a mitochondrial crisis. | SLIDE 4 — The Chinese Medicine View: In Chinese medicine, midlife is the period of Kidney jing depletion — the gradual consumption of the body's deep constitutional reserve. The symptoms are identical: fatigue, reduced libido, cognitive decline, and loss of vitality. | SLIDE 5 — The Cortisol Steal: Chronic stress causes 'pregnenolone steal' — the body diverts the precursor to all sex hormones toward cortisol production instead. The result: low testosterone, low estrogen, low progesterone, high cortisol. | SLIDE 6 — The Sleep Factor: Growth hormone is primarily released during deep sleep. Chronic sleep deprivation suppresses growth hormone — accelerating the aging process and the energy decline. | SLIDE 7 — What Accelerates the Decline: Chronic stress, poor sleep, sedentary lifestyle, ultra-processed diet, alcohol, and the belief that decline is inevitable. | SLIDE 8 — What Reverses It: Resistance training (the most powerful stimulus for testosterone and growth hormone), sleep optimization, stress reduction, mitochondrial support (CoQ10, NMN, magnesium), and adaptogenic herbs. | SLIDE 9 — The Reframe: The midlife energy crisis is not inevitable. It is the predictable outcome of a lifestyle that has been depleting the body without adequate restoration. Change the lifestyle, change the outcome. | SLIDE 10 — CTA: Urban Monk Academy — the complete midlife vitality protocol.`,
    notes: "Targets 'midlife energy decline' and 'low energy 40s 50s' — high search volume, strong persona match.",
  },
  {
    title: "What Chronic Pain Is Trying to Tell You (The Eastern Perspective)",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Chronic Condition Navigator",
    contentGoal: "llm_seo",
    body: `SLIDE 1 — Hook: "In Chinese medicine, there is a saying: 'Where there is free flow, there is no pain. Where there is no free flow, there is pain.'" | SLIDE 2 — The Western View: Pain is a signal from damaged tissue. Treat the tissue, eliminate the signal. This model works for acute injury but fails for chronic pain. | SLIDE 3 — The Eastern View: Chronic pain is a signal of stagnation — blocked flow of qi, blood, or fluids in the body. The goal is not to suppress the signal but to restore the flow. | SLIDE 4 — The Stress-Pain Connection: Chronic stress is the primary driver of qi stagnation in Chinese medicine. Modern research confirms: chronic stress increases pain sensitivity (central sensitization) and perpetuates chronic pain conditions. | SLIDE 5 — The Inflammation Loop: Chronic stress → cortisol dysregulation → increased inflammatory cytokines → tissue inflammation → pain → more stress. Breaking this loop requires addressing the stress, not just the inflammation. | SLIDE 6 — The Gut-Pain Connection: Gut inflammation and intestinal permeability increase systemic inflammatory markers, which amplify pain sensitivity throughout the body. Healing the gut often reduces chronic pain. | SLIDE 7 — The Emotional Component: In Chinese medicine, suppressed emotions create qi stagnation. Modern research confirms: unresolved emotional trauma is a significant driver of chronic pain conditions, particularly fibromyalgia and chronic back pain. | SLIDE 8 — The Acupuncture Evidence: Acupuncture has been shown in multiple meta-analyses to be more effective than sham acupuncture and conventional treatment for chronic back pain, neck pain, osteoarthritis, and headache. | SLIDE 9 — The Integrated Approach: Chronic pain responds best to an integrated approach: acupuncture + anti-inflammatory nutrition + stress regulation + movement + addressing the emotional component. | SLIDE 10 — CTA: Urban Monk Academy — the complete East-West approach to chronic pain and inflammation.`,
    notes: "Targets 'chronic pain Chinese medicine' and 'Eastern medicine chronic pain' — strong LLM SEO play.",
  },
  {
    title: "The Digital Detox Protocol: What Happens When You Put Down Your Phone for 7 Days",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Digital Detox Pursuer",
    contentGoal: "audience_growth",
    body: `SLIDE 1 — Hook: "What actually happens to your brain and body when you put down your phone for 7 days." | SLIDE 2 — Day 1: Withdrawal. Phantom phone vibrations. Restlessness. The urge to check every few minutes. This is dopamine withdrawal — your brain is recalibrating its reward system. | SLIDE 3 — Day 2–3: Boredom. Real boredom. Not the scrolling kind — the kind that precedes creativity. Your default mode network (the brain's creative and reflective system) begins to activate. | SLIDE 4 — Day 4–5: Sleep Improves. Blue light suppresses melatonin. Without the phone before bed, your circadian rhythm begins to normalize. Most people report dramatically better sleep by day 4. | SLIDE 5 — Day 5–6: Presence Returns. You start noticing things you've been missing. Conversations feel deeper. Food tastes better. Your senses are recalibrating. | SLIDE 6 — Day 7: Clarity. Many people report a sense of mental clarity and spaciousness that they haven't felt in years. The constant low-grade anxiety of the information stream has lifted. | SLIDE 7 — The Neuroscience: Smartphone use activates the same dopamine pathways as addictive substances. Variable reward schedules (you never know what you'll find when you scroll) are the most addictive pattern known to behavioral psychology. | SLIDE 8 — The Chinese Medicine View: Excessive screen use depletes Kidney yin and Heart blood — the resources that support calm, focus, and sleep. The symptoms of screen addiction mirror the symptoms of yin deficiency. | SLIDE 9 — The Protocol: You don't have to go cold turkey. Start with phone-free mornings (before 9 AM) and phone-free evenings (after 8 PM). This captures most of the benefit. | SLIDE 10 — CTA: Urban Monk Academy — the complete digital detox and attention restoration protocol.`,
    notes: "High share factor. Targets 'digital detox benefits' and 'phone addiction effects' — strong reach into Digital Detox Pursuer persona.",
  },
  {
    title: "The Urban Monk's Guide to Stress: What It Is, What It Does, and How to Use It",
    scriptType: "instagram_carousel",
    platform: "meta",
    productionStatus: "not_started",
    slideCount: 10,
    persona: "Corporate Wellness Advocate",
    contentGoal: "community_engagement",
    body: `SLIDE 1 — Hook: "Not all stress is bad. Here's how to tell the difference — and how to use stress as a tool for growth." | SLIDE 2 — Eustress vs. Distress: Eustress (positive stress) is the stress of challenge, growth, and meaningful work. It activates the HPA axis briefly, then resolves. Distress (negative stress) is chronic, unresolved, and depleting. | SLIDE 3 — The Hormetic Principle: Small doses of stress make you stronger. This is the principle behind exercise, fasting, and cold exposure. The key is recovery — without adequate recovery, hormetic stress becomes harmful stress. | SLIDE 4 — The Allostatic Load: Your body has a total stress budget. Every stressor — physical, emotional, environmental — draws from this budget. When the budget is exceeded, the system breaks down. | SLIDE 5 — The Chinese Medicine View: Stress is not inherently harmful — it is the failure to return to balance after stress that creates disease. The Taoist concept of wu wei (effortless action) is the art of engaging fully without depleting. | SLIDE 6 — The Recovery Imperative: The most important variable is not how much stress you experience — it is how quickly and completely you recover. Sleep, meditation, movement, and community are the primary recovery tools. | SLIDE 7 — The Meaning Factor: Research by Alia Crum at Stanford shows that your belief about stress determines its physiological effect. People who view stress as a challenge (rather than a threat) have better health outcomes. | SLIDE 8 — The Practical Protocol: Use stress intentionally (exercise, challenging work, cold exposure). Recover deliberately (sleep, meditation, time in nature). Monitor your allostatic load (track energy, sleep quality, mood). | SLIDE 9 — The Urban Monk Framework: The goal is not to eliminate stress — it is to become a person who can engage fully with life's challenges without being depleted by them. This is what the Urban Monk practice is about. | SLIDE 10 — CTA: Urban Monk Academy — the complete stress mastery curriculum.`,
    notes: "Brand-defining carousel. Introduces the Urban Monk philosophy and differentiates from stress-elimination messaging.",
  },
];

// Use the tRPC HTTP endpoint to seed the scripts
// The seed procedure requires authentication, so we'll use the direct DB approach
// by calling the server's internal seed endpoint

async function seedViaApi() {
  console.log(`Seeding ${carousels.length} Instagram carousels into Script Library...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const carousel of carousels) {
    try {
      const response = await fetch(`${BASE_URL}/api/trpc/scripts.create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": process.env.SEED_COOKIE || "",
        },
        body: JSON.stringify({
          json: {
            title: carousel.title,
            scriptType: carousel.scriptType,
            platform: carousel.platform,
            productionStatus: carousel.productionStatus,
            slideCount: carousel.slideCount,
            persona: carousel.persona,
            contentGoal: carousel.contentGoal,
            body: carousel.body,
            notes: carousel.notes,
          }
        }),
      });

      if (response.ok) {
        console.log(`✓ Created: ${carousel.title.substring(0, 60)}...`);
        successCount++;
      } else {
        const err = await response.text();
        console.error(`✗ Failed: ${carousel.title.substring(0, 60)}... — ${response.status}: ${err.substring(0, 100)}`);
        errorCount++;
      }
    } catch (err) {
      console.error(`✗ Network error for: ${carousel.title.substring(0, 60)}... — ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\nDone: ${successCount} created, ${errorCount} failed`);
}

seedViaApi();
