/**
 * Gut Microbiome Segmentation Analysis
 * Typeform form ID: m6EyBDzz (2416 responses)
 * Runs segmentByPersona logic directly without going through tRPC
 */
import "dotenv/config";

const TYPEFORM_API_KEY = process.env.TYPEFORM_API_KEY;
if (!TYPEFORM_API_KEY) {
  console.error("TYPEFORM_API_KEY not set");
  process.exit(1);
}

const FORM_ID = "m6EyBDzz";
const FORM_TITLE = "Gut Microbiome Assessment";
const SAMPLE_SIZE = 200;

async function typeformGet(path: string) {
  const res = await fetch(`https://api.typeform.com${path}`, {
    headers: { Authorization: `Bearer ${TYPEFORM_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Typeform API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function flattenResponse(item: any, fields: any[]): Record<string, string> {
  const result: Record<string, string> = {};
  const answers: any[] = item.answers ?? [];
  for (const answer of answers) {
    const field = fields.find((f: any) => f.id === answer.field?.id);
    const question = field?.title ?? answer.field?.id ?? "Unknown";
    let value = "";
    switch (answer.type) {
      case "text": value = answer.text ?? ""; break;
      case "choice": value = answer.choice?.label ?? ""; break;
      case "choices": value = (answer.choices?.labels ?? []).join(", "); break;
      case "number": value = String(answer.number ?? ""); break;
      case "boolean": value = answer.boolean ? "Yes" : "No"; break;
      case "email": value = answer.email ?? ""; break;
      default: value = JSON.stringify(answer).slice(0, 100);
    }
    result[question] = value;
  }
  return result;
}

const THE_8_PERSONAS = [
  { id: "burnout-executive", name: "The Burned-Out Executive", description: "High-performing professional, 40-55, running on cortisol and caffeine. Chronic stress, poor sleep, gut issues from travel and bad food. Wants to perform without burning out." },
  { id: "health-seeker", name: "The Awakening Health Seeker", description: "35-50, starting to question conventional medicine. Gut issues, brain fog, fatigue. Wants root-cause solutions, not symptom management." },
  { id: "spiritual-entrepreneur", name: "The Spiritual Entrepreneur", description: "30-45, building a purpose-driven business. Wants to integrate mindfulness, ancient wisdom, and modern performance. Feels scattered and depleted." },
  { id: "midlife-woman", name: "The Midlife Woman in Transition", description: "45-60, navigating hormonal shifts, weight changes, energy crashes. Wants to feel vital and reclaim herself. Open to holistic approaches." },
  { id: "functional-parent", name: "The Functional Parent", description: "35-50, putting family first at the expense of their own health. Exhausted, inflamed, wants energy to show up fully for their kids." },
  { id: "biohacker", name: "The Biohacker & Optimizer", description: "28-45, data-driven, already doing intermittent fasting, cold plunges, supplements. Wants the next level — ancient wisdom meets cutting-edge science." },
  { id: "chronic-illness", name: "The Chronic Illness Warrior", description: "Any age, dealing with autoimmune, IBS, SIBO, Lyme, or mystery symptoms. Frustrated with conventional medicine. Wants a guide who understands complexity." },
  { id: "conscious-professional", name: "The Conscious Professional", description: "30-50, values-driven career in medicine, coaching, or wellness. Wants to deepen their own practice and help clients more effectively." },
];

async function main() {
  console.log(`Fetching form metadata for ${FORM_ID}...`);
  const formMeta = await typeformGet(`/forms/${FORM_ID}`);
  const fields: any[] = formMeta.fields ?? [];
  console.log(`Form: "${formMeta.title}" — ${fields.length} fields`);

  console.log(`Fetching ${SAMPLE_SIZE} responses...`);
  const data = await typeformGet(`/forms/${FORM_ID}/responses?page_size=${SAMPLE_SIZE}`);
  const items: any[] = data.items ?? [];
  console.log(`Got ${items.length} responses (total: ${data.total_items ?? "unknown"})`);

  if (items.length === 0) {
    console.error("No responses found");
    process.exit(1);
  }

  const sample = items.slice(0, 150);
  const responseText = sample
    .map((item, i) => {
      const answers = flattenResponse(item, fields);
      const lines = Object.entries(answers)
        .map(([q, a]) => `  Q: ${q}\n  A: ${a}`)
        .join("\n");
      return `--- Response ${i + 1} ---\n${lines}`;
    })
    .join("\n\n");

  console.log(`Running LLM segmentation on ${sample.length} responses...`);

  const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
  const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

  const systemPrompt = `You are an expert audience segmentation analyst for The Urban Monk brand (Dr. Pedram Shojai, OMD).

You have ${sample.length} Typeform survey responses from "${FORM_TITLE}" (${items.length} total).

Your task: Segment these responses across the 8 Urban Monk audience personas. For EACH persona:
1. Estimate what % of respondents match this persona (0-100, must sum to ~100)
2. Extract 5-8 specific pain points that respondents in this persona cluster mentioned
3. Extract 4-6 specific aspirations from this cluster
4. Write a 2-sentence "voice of customer" quote that captures how someone in this persona would describe their situation
5. Identify 3-5 content hooks that would resonate with this persona based on the survey data

Return a JSON array of 8 persona segment objects.`;

  const llmRes = await fetch(`${BUILT_IN_FORGE_API_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${BUILT_IN_FORGE_API_KEY}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `The 8 Urban Monk personas:\n${THE_8_PERSONAS.map(p => `- ${p.name}: ${p.description}`).join("\n")}\n\nSurvey responses:\n${responseText}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "persona_segments",
          strict: true,
          schema: {
            type: "object",
            properties: {
              segments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    personaId: { type: "string" },
                    personaName: { type: "string" },
                    percentage: { type: "number" },
                    painPoints: { type: "array", items: { type: "string" } },
                    aspirations: { type: "array", items: { type: "string" } },
                    voiceOfCustomer: { type: "string" },
                    contentHooks: { type: "array", items: { type: "string" } },
                  },
                  required: ["personaId", "personaName", "percentage", "painPoints", "aspirations", "voiceOfCustomer", "contentHooks"],
                  additionalProperties: false,
                },
              },
            },
            required: ["segments"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  if (!llmRes.ok) {
    const err = await llmRes.text();
    console.error("LLM error:", err);
    process.exit(1);
  }

  const llmData = await llmRes.json() as any;
  const content = llmData.choices?.[0]?.message?.content;
  if (!content) {
    console.error("No content in LLM response");
    process.exit(1);
  }

  const parsed = JSON.parse(content);
  const segments = parsed.segments;

  // Write results to file
  const output = {
    formId: FORM_ID,
    formTitle: FORM_TITLE,
    totalResponses: data.total_items,
    sampleSize: sample.length,
    analyzedAt: new Date().toISOString(),
    segments,
  };

  const fs = await import("fs");
  fs.writeFileSync("/tmp/gut_microbiome_segmentation.json", JSON.stringify(output, null, 2));

  // Print summary
  console.log("\n=== GUT MICROBIOME SEGMENTATION RESULTS ===\n");
  for (const seg of segments) {
    console.log(`\n## ${seg.personaName} — ${seg.percentage}% of respondents`);
    console.log(`Voice: "${seg.voiceOfCustomer}"`);
    console.log(`Top Pain Points:`);
    seg.painPoints.slice(0, 3).forEach((p: string) => console.log(`  • ${p}`));
    console.log(`Content Hooks:`);
    seg.contentHooks.slice(0, 2).forEach((h: string) => console.log(`  → ${h}`));
  }

  console.log("\n\nFull results saved to /tmp/gut_microbiome_segmentation.json");
}

main().catch(console.error);
