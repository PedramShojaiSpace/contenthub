// Gut Restoration Starter Protocol — polished educational PDF
#import "report-theme.typ": report-theme

#let teal = rgb("#073D42")
#let sage = rgb("#5F806C")
#let gold = rgb("#C79B45")
#let sand = rgb("#F6F1E8")
#let cream = rgb("#FCFAF5")
#let ink = rgb("#263238")
#let mist = rgb("#EAF4F1")
#let palegold = rgb("#FFF6DE")
#let paleink = rgb("#5C6B6D")

#show: report-theme.with(
  title: "Gut Restoration Starter Protocol",
  author: "Dr. Pedram Shojai",
  rhythm: "longform",
  body-size: 10.4pt,
  running-header: true,
)

#set text(font: ("Noto Serif", "Noto Serif CJK SC"), lang: "en", region: "us", fill: ink)
#set page(paper: "us-letter", margin: (top: 1.8cm, bottom: 1.8cm, x: 1.9cm))
#set par(justify: false, leading: 1.16em, spacing: 0.63em)
#show heading: set text(font: ("Noto Sans", "Noto Sans CJK SC"), fill: teal)

#let eyebrow(label) = text(size: 8.6pt, weight: "bold", fill: gold, tracking: 0.08em)[#upper(label)]
#let rule() = line(length: 100%, stroke: 1pt + gold)
#let smallcaps(text-value) = text(size: 8.2pt, weight: "bold", fill: sage, tracking: 0.04em)[#upper(text-value)]
#let soft-card(title, body, fill: mist) = block(
  fill: fill,
  radius: 7pt,
  inset: 13pt,
  width: 100%,
)[
  #text(font: "Noto Sans", weight: "bold", fill: teal, size: 11pt)[#title]
  #v(4pt)
  #body
]
#let phase-card(num, title, line, color: sage) = block(
  fill: cream,
  stroke: 0.6pt + color.lighten(35%),
  radius: 7pt,
  inset: 10pt,
  width: 100%,
)[
  #text(size: 8.5pt, weight: "bold", fill: color)[#num]
  #v(2pt)
  #text(font: "Noto Sans", size: 12pt, weight: "bold", fill: teal)[#title]
  #v(3pt)
  #text(size: 9.2pt, fill: paleink)[#line]
]
#let cta-card(label, body) = block(
  fill: palegold,
  stroke: 0.65pt + gold.lighten(25%),
  radius: 7pt,
  inset: 13pt,
  width: 100%,
)[
  #text(size: 8.4pt, weight: "bold", fill: gold, tracking: 0.06em)[NEXT STEP]
  #v(3pt)
  #text(font: "Noto Sans", size: 11pt, weight: "bold", fill: teal)[#label]
  #v(4pt)
  #body
]
#let day-title(day, title) = [
  #block(above: 12pt, below: 5pt)[
    #text(font: "Noto Sans", size: 11.5pt, weight: "bold", fill: teal)[Day #day — #title]
  ]
]
#let prompt(text-value) = block(
  fill: cream,
  radius: 4pt,
  inset: (x: 9pt, y: 6pt),
  width: 100%,
)[#text(font: "Noto Sans", size: 9.2pt, fill: sage, weight: "bold")[Prompt] #text(size: 9.2pt)[#text-value]]

// ---------- Cover ----------
#page(numbering: none, header: none, margin: 0pt, fill: sand)[
  #place(top + right, dx: 72pt, dy: -18pt)[
    #circle(radius: 170pt, fill: teal.lighten(48%))
  ]
  #place(bottom + right, dx: 35pt, dy: 28pt)[
    #circle(radius: 220pt, fill: gold.lighten(25%))
  ]
  #place(top + right, dx: 115pt, dy: 190pt)[
    #circle(radius: 90pt, fill: sage.lighten(30%))
  ]
  #pad(x: 52pt, top: 65pt, bottom: 50pt)[
    #align(left)[
      #text(size: 9pt, fill: gold, weight: "bold", tracking: 0.1em)[THE URBAN MONK]
      #v(2.5em)
      #text(font: "Noto Sans", size: 31pt, fill: teal, weight: "bold")[Gut Restoration\ Starter Protocol]
      #v(0.7em)
      #block(width: 55%)[#text(size: 17pt, fill: paleink)[A practical 30-day reset plan for turning learning into a more intentional routine]]
      #v(2.2em)
      #line(length: 42%, stroke: 1.3pt + gold)
      #v(2em)
      #text(size: 12pt, fill: ink)[Created by Dr. Pedram Shojai for Interconnected members]
      #v(9em)
      #text(size: 13pt, style: "italic", fill: teal)[“The point is not perfection. It is pattern recognition.”]
      #v(0.8em)
      #text(size: 10.5pt, fill: paleink)[Over 30 days, you will build a calmer, more intentional routine around food, digestion, movement, recovery, and attention—then use what you notice to choose your next step.]
    ]
  ]
]

#pagebreak()

= Start here

#soft-card("A clear boundary", [This is an educational routine, not a diagnosis, treatment plan, or substitute for individual medical care. Do not use it to self-diagnose. If you are pregnant, managing a medical condition, have a history of disordered eating, take medications that affect digestion or blood sugar, or have persistent or concerning symptoms, work with an appropriately qualified healthcare professional before making significant dietary or exercise changes.], fill: palegold)

The protocol is intentionally simple. You are not trying to “fix” everything in a month. You are building a reliable baseline, noticing your responses, and deciding where more personalized support would be useful.

== How to use this guide

Each day gives you one primary action. The action should feel achievable even on a busy day. Use the check-in prompts to notice your patterns, not to criticize them. If you miss a day, resume on the next day; the protocol is not a test.

#soft-card("Your 30-day promise", [For the next month, choose consistency over intensity. A small action repeated is more useful than a perfect plan you cannot sustain.])

== The Six Rs

The starter protocol is organized around six practical phases. The first R, *Connect*, is where the work becomes personal. The other five Rs provide the structure.

#grid(columns: (1fr, 1fr, 1fr), gutter: 10pt,
  phase-card("01", "Connect", "Slow down enough to observe your current patterns."),
  phase-card("02", "Remove", "Reduce the inputs that most obviously disrupt your routine."),
  phase-card("03", "Replace", "Build supportive defaults around food, hydration, movement, and recovery."),
  phase-card("04", "Reinoculate", "Add variety gradually and widen your food repertoire as tolerated."),
  phase-card("05", "Repair", "Protect the conditions that support consistency: sleep, stress regulation, and a realistic plan."),
  phase-card("06", "Rebalance", "Review what you learned and choose the next appropriate level of support."),
)

== Your daily floor

Keep these five actions small enough to repeat. They form the foundation of every day in the protocol.

#grid(columns: (1fr, 1fr), gutter: 11pt,
  soft-card("1. Start with a pause", [Before your first meal, take three slow breaths. Ask: *How is my energy? How is my digestion? How did I sleep?*]),
  soft-card("2. Build one real-food meal", [Choose one meal each day to make intentionally. Use a simple plate: a protein source, colorful plants, a fiber-containing carbohydrate or legume if it works for you, and a nourishing fat.]),
  soft-card("3. Hydrate consistently", [Keep water visible. If you increase dietary fiber, add it gradually and pair it with fluids. Fiber and fluid intake are commonly discussed together in digestive-health guidance. [1]]),
  soft-card("4. Move after a meal", [Take a short walk, do gentle mobility, or simply stand and move for a few minutes after one meal. Small amounts of activity count. [2]]),
  soft-card("5. Create an evening landing strip", [Choose one consistent cue that starts your wind-down: dim the lights, charge the phone outside the bedroom, take a shower, or make tea. [3]]),
  soft-card("Use a daily log", [Record sleep, energy, digestion, food, stress, and one small win. The log is a way to see trends that are otherwise easy to miss.]),
)

#pagebreak()

= The 30-day map

#table(
  columns: (0.7fr, 1.1fr, 1.55fr, 1.6fr),
  inset: 7pt,
  stroke: 0.35pt + sage.lighten(45%),
  fill: (x, y) => if y == 0 {teal} else if calc.even(y) {cream} else {white},
  table.header(
    [#text(weight: "bold", fill: white)[Days]],
    [#text(weight: "bold", fill: white)[Phase]],
    [#text(weight: "bold", fill: white)[Primary job]],
    [#text(weight: "bold", fill: white)[Carry question]],
  ),
  [1–3], [Connect], [Establish a baseline without judgment], [What is already true?],
  [4–7], [Remove], [Reduce obvious friction and noise], [What can I pause for one week?],
  [8–12], [Replace], [Create supportive defaults], [What can I make easier?],
  [13–17], [Reinoculate], [Add variety slowly and notice tolerance], [What widens my options?],
  [18–23], [Repair], [Protect sleep, stress regulation, and recovery], [What helps me stay consistent?],
  [24–30], [Rebalance], [Review the data and choose a next step], [What support would actually help now?],
)

#v(1.4em)

== Your six-line daily log

Use one note on your phone or a small notebook. Each day, record only these six lines:

- *Sleep:* bedtime, wake time, and a 1–5 quality score.
- *Energy:* morning and afternoon, each scored 1–5.
- *Digestion:* comfort, regularity, and any pattern you notice.
- *Food:* one meal that felt supportive and one meal that did not.
- *Stress:* your strongest stress moment and what helped you reset.
- *Win:* one action you kept, even if it was small.

#soft-card("Keep the log honest and light", [Do not turn the log into a surveillance project. It is a way to see what tends to happen before you decide what, if anything, to change.])

#pagebreak()

= Week 1 — Connect and Remove

#eyebrow("Days 1–3")

== Connect to your baseline

#day-title("1", "Set your intention")
Write one sentence: *“At the end of 30 days, I want to understand [your pattern] more clearly.”* Do not choose a diagnosis or a dramatic outcome. Choose a pattern: afternoon energy, meal regularity, sleep consistency, digestive comfort, or stress eating.

*Action:* Take a baseline note using the six-line daily log.  
*Interconnected pairing:* Watch one episode with a notebook nearby. Capture one idea that feels personal instead of trying to retain every fact.

#day-title("2", "Map your rhythm")
Without changing anything yet, notice the timing of your first meal, your most rushed meal, your best energy window, and your evening routine.

*Action:* Circle the single point in your day that feels most chaotic.
#prompt([What happens right before this moment? What would make it 10% easier?])

#day-title("3", "Notice without interpreting")
Look for patterns, not villains. A late meal, a hard conversation, poor sleep, travel, alcohol, a skipped lunch, and a heavy workload may all show up in the same week. Your job is to describe, not diagnose.

*Action:* Write three observations in this format: “When [this] happens, I notice [this].”

#eyebrow("Days 4–7")

== Remove friction, not your entire life

The “Remove” phase is not a restrictive cleanse. It is a short experiment in reducing the most obvious sources of friction so you can better see what changes your day.

#day-title("4", "Choose one friction point")
Choose *one* for the next four days: late-night grazing that leaves you feeling off the next morning; a rushed breakfast or skipped first meal; unplanned afternoon caffeine; alcohol on work nights; an ultra-processed convenience food you reach for automatically; or eating while scrolling, driving, or working.

*Action:* Create an if–then plan. Example: “If I want a snack after 9 p.m., then I will make tea, wait ten minutes, and decide again.”

#day-title("5", "Clear the runway")
Make the supportive option visible and easy.

*Action:* Wash produce, prepare one protein, portion a snack, or stock a simple breakfast. Aim for friction reduction, not culinary performance.

#day-title("6", "Make a calmer meal")
Choose one meal to eat seated, with no screen and no multitasking.

*Action:* Take the first five bites slowly. Notice hunger, taste, and the point at which you begin to feel satisfied.

#day-title("7", "Weekly reset")
Review your seven log entries.

- Which one action felt surprisingly easy?
- Which moment creates the most downstream chaos?
- What is one friction point I want to keep removing next week?

= Week 2 — Replace and Reinoculate

#eyebrow("Days 8–12")

== Replace the missing structure

Removing friction makes room. Now put simple structure in its place.

#day-title("8", "Build your anchor meal")
Choose a repeatable meal you can make in under 15 minutes. Keep it simple: protein, plants, a satisfying carbohydrate or legume if desired, and a source of nourishing fat.

*Action:* Make your anchor meal once today and once more this week.

#day-title("9", "Add plants gradually")
Aim to add one extra plant food today: a vegetable, fruit, bean, lentil, whole grain, nut, seed, herb, or spice. If you are increasing fiber, gradual changes are easier for many people to tolerate. [1]

*Action:* Write down the plant and how you felt afterward.

#day-title("10", "Pair food with movement")
Choose one meal after which you will walk or move gently for 10 minutes.

*Action:* Put shoes by the door or schedule the movement before you eat.

#day-title("11", "Make hydration specific")
Do not use vague intentions like “drink more water.” Choose a cue: one glass upon waking, one bottle before lunch, or a refill when you return from a walk.

*Action:* Pick your cue and log whether you completed it.

#day-title("12", "Protect your evening")
Choose one evening boundary for three nights: no screens for the final 30 minutes, a consistent wind-down alarm, a gentle stretch, or a short journal entry.

*Action:* Put the cue in your calendar or set a reminder now.

#eyebrow("Days 13–17")

== Reinoculate through variety

Here, “Reinoculate” means widening the diversity of whole foods you regularly eat—slowly and with curiosity. It does *not* require supplements, fermented foods, or a radical diet change.

#day-title("13", "Color challenge")
Add two colors of plants to one meal.

*Action:* Photograph the meal or write down the colors. The goal is awareness, not a social-media-worthy plate.

#day-title("14", "Legume or whole-grain experiment")
If it fits your preferences and tolerance, include a small serving of beans, lentils, oats, brown rice, quinoa, or another whole grain.

*Action:* Start with a portion that feels realistic. Observe comfort, fullness, and energy without assigning moral value to the result.

#day-title("15", "Herb and spice upgrade")
Use fresh or dried herbs and spices in one meal. This is a low-pressure way to widen flavor and plant variety.

#day-title("16", "Shop with a one-plant rule")
At the store, buy one plant food you do not usually buy but can easily use this week.

*Action:* Decide exactly how you will use it before you leave the store.

#day-title("17", "Build your repeat list")
List five foods or meals that felt easy, satisfying, and supportive over the past two weeks. This becomes your personal starting menu.

= Week 3 — Repair the Conditions That Support Change

#eyebrow("Days 18–23")

You do not need a perfect routine. You need a routine that can survive a busy life. This week, focus on the conditions that help your food and movement choices become repeatable.

#day-title("18", "Sleep audit")
Look at the last three nights. What is the earliest point where your evening begins to drift?

*Action:* Choose one boundary: a consistent lights-out time, phone charging outside the bedroom, a 30-minute device-free window, or avoiding late caffeine. CDC guidance recommends consistent sleep/wake timing and turning off electronics at least 30 minutes before bed as examples of sleep-supporting habits. [3]

#day-title("19", "Stress reset rehearsal")
Choose a two-minute reset: three slow breaths, a short walk outside, a few stretches, prayer, meditation, or writing down one next action.

*Action:* Practice it once when you are not stressed so it is available when you are.

#day-title("20", "Strength and stability")
If appropriate for you, add one short session of bodyweight, resistance-band, or light strength work. The aim is to build capacity, not to punish yourself.

*Action:* Do one set of a movement you know how to perform safely, or use a qualified coach’s program.

#day-title("21", "Rehearse a busy-day plan")
Imagine tomorrow gets chaotic. What will you eat first? What is your five-minute movement option? What is your evening boundary?

*Action:* Prepare one supportive option in advance.

#day-title("22", "Make room for connection")
Eat one meal with another person, call someone, or take a walk with a friend. Recovery is not only what happens on a yoga mat or in a supplement cabinet; it also includes the relationships and rhythms that help you regulate.

#day-title("23", "Review your conditions")
Answer honestly: *When did I make the better choice most easily?* You may notice it was after sleep, a prepared meal, movement, or a calmer schedule. That is useful data.

#pagebreak()

= Week 4 — Rebalance and Choose Your Next Step

#eyebrow("Days 24–30")

This week is not about doing more. It is about deciding what to keep, what to stop guessing about, and what support would make the next 90 days more useful.

#day-title("24", "Identify your strongest signal")
Look at your log. Pick one pattern that repeated at least three times.

*Action:* Write it as a neutral statement: “When I [do this], I tend to notice [this].”

#day-title("25", "Identify your strongest lever")
Which action had the best return for the least effort? It may be an anchor breakfast, an after-dinner walk, a protected bedtime, or a prepared lunch.

*Action:* Put that action on your calendar for the next seven days.

#day-title("26", "Create your minimum viable routine")
Write a three-item version of your plan that works on a hard day:

1. One real-food meal.
2. Ten minutes of movement or outdoor time.
3. One evening recovery cue.

This is your fallback plan—not your failure plan.

#day-title("27", "Decide what needs more context")
Some questions are not answered by a generic protocol. If you are still unsure what applies to you, note the exact question you want help answering.

Examples: “Which patterns in my food and energy log are worth investigating?” “How can I make a more personalized plan without following contradictory advice?” “What information would help me talk more productively with my clinician?”

#day-title("28", "The Upstream Navigator moment")
The *Upstream Navigator* is the next step when you want more structured, evidence-informed context for the questions your 30-day log uncovered. The Six Rs can give you a map; the Navigator is designed to help you explore the relevant terrain in a more organized way.

#cta-card("Explore the Upstream Navigator", [If you are ready to move from general education to a more personalized decision-making framework, explore the #link("https://upstream.theurbanmonk.com/")[Upstream Navigator].])

#day-title("29", "The Upstream Course moment")
The *Upstream Course* is for the member who wants a deeper educational pathway beyond this starter protocol: more context, more structure, and more time to work through the principles at a sustainable pace.

#cta-card("Consider the Upstream Course", [If this month showed you that you learn best with a guided curriculum, consider the Upstream Course as your next layer of education. It is not about doing more—it is about understanding what is most relevant to you.])

#day-title("30", "Your next 30 days")
Write a short continuation plan:

- *Keep:* the two actions that made the biggest difference.
- *Pause:* the one habit that created the most friction.
- *Explore:* the one question you do not want to keep guessing about.
- *Support:* the person, tool, course, or clinician who could help you take the next step wisely.

#soft-card("Close with this sentence", [“I do not need a perfect plan. I need a plan I can repeat.”], fill: palegold)

= Completion checklist and next step

== Your 30-day completion checklist

#grid(columns: (1fr, 1fr), gutter: 10pt,
  soft-card("Notice", [□ I kept a short daily log on most days.  
□ I identified at least one food or rhythm pattern worth noticing.  
□ I wrote one clear question for my next level of support.]),
  soft-card("Build", [□ I built one repeatable meal or food-prep habit.  
□ I practiced a short post-meal movement habit.  
□ I chose one sleep or wind-down boundary.]),
  soft-card("Widen", [□ I increased variety gradually where it felt appropriate.  
□ I identified the smallest routine I can maintain on a hard day.]),
  soft-card("Choose", [□ I know what I want to keep.  
□ I know what I want to stop guessing about.]),
)

== When more support makes sense

This protocol is a starting point. It is appropriate to seek personalized guidance when you are dealing with persistent or concerning symptoms, major food restrictions, a complex medical history, medication questions, or uncertainty that does not improve with basic routine changes.

Your next step may be a conversation with a qualified healthcare professional, a more structured educational pathway such as the Upstream Course, or the Upstream Navigator when you want more organized context for the questions you have uncovered.

#v(0.4em)
#text(font: "Noto Sans", size: 10.5pt, weight: "bold", fill: teal)[The real goal]  
#text(size: 10.6pt, style: "italic", fill: ink)[The goal is not to outsource your agency. The goal is to stop guessing alone.]

#pagebreak()

= References

[1] National Institute of Diabetes and Digestive and Kidney Diseases. *Eating, Diet, & Nutrition for Constipation.* The page discusses gradual fiber increases, fluids, and examples of fiber-containing foods. #link("https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/eating-diet-nutrition")[https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/eating-diet-nutrition]

[2] Centers for Disease Control and Prevention. *What You Can Do to Meet Physical Activity Recommendations.* The page recommends at least 150 minutes of moderate-intensity activity weekly and muscle-strengthening activity on two days for most adults. #link("https://www.cdc.gov/physical-activity-basics/guidelines/index.html")[https://www.cdc.gov/physical-activity-basics/guidelines/index.html]

[3] Centers for Disease Control and Prevention. *About Sleep.* The page outlines adult sleep-duration guidance and examples of supportive sleep habits. #link("https://www.cdc.gov/sleep/about/index.html")[https://www.cdc.gov/sleep/about/index.html]

#v(2em)
#text(size: 8.5pt, fill: paleink)[Educational content for Interconnected members. This resource does not provide individual medical advice or replace care from a qualified healthcare professional.]
