import { describe, expect, it } from "vitest";
import { parseCsv, parseGumshoeJson } from "./gumshoe";

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_JSON = JSON.stringify({
  reportId: 42,
  reportName: "Urban Monk LLM Gap Analysis",
  reportFocus: "Online Wellness Education",
  reportDescription: "Competitive analysis for LLM search positioning",
  reportCreatedAt: "2026-04-08T00:00:00Z",
  reportRunId: 1,
  personas: [
    {
      name: "Burnout Recovery Seeker",
      description: "Professional experiencing chronic stress",
      questions: [
        {
          query: "What are the best online wellness platforms for burnout recovery?",
          topics: ["Stress Relief Outcomes", "Holistic Approach"],
          answers: [
            {
              model: "ChatGPT",
              mentions: [
                { rank: 1, brand: "Mindvalley", reason: "Comprehensive wellness programs" },
                { rank: 2, brand: "Headspace", reason: "Meditation focus" },
              ],
              citations: [],
            },
            {
              model: "Claude",
              mentions: [
                { rank: 1, brand: "Sounds True", reason: "Spiritual growth content" },
              ],
              citations: [],
            },
          ],
        },
        {
          query: "How does The Urban Monk Academy compare to Mindvalley?",
          topics: ["Program Depth", "Instructor Credibility"],
          answers: [
            {
              model: "ChatGPT",
              mentions: [
                { rank: 1, brand: "The Urban Monk", reason: "Dr. Pedram Shojai's expertise" },
                { rank: 2, brand: "Mindvalley", reason: "Broader content library" },
              ],
              citations: [],
            },
          ],
        },
      ],
    },
  ],
});

const SAMPLE_CSV = [
  `id,persona,query,"t-Evidence-Based Methods","t-Stress Relief Outcomes","t-Flexible Learning Format","t-Program Depth","t-Instructor Credibility","t-Community Support","t-Holistic Approach","t-Practical Daily Use","t-Time Commitment","t-Price Value"`,
  `1,"Burnout Recovery Seeker","What are the best online wellness platforms for burnout recovery?","","X","","","","","X","","",""`,
  `2,"Burnout Recovery Seeker","How does The Urban Monk Academy compare to Mindvalley?","","","","X","X","","","","",""`,
].join("\n");

// ─── JSON Parser Tests ────────────────────────────────────────────────────────

describe("parseGumshoeJson", () => {
  it("parses report metadata correctly", () => {
    const report = parseGumshoeJson(SAMPLE_JSON);
    expect(report.reportId).toBe(42);
    expect(report.reportName).toBe("Urban Monk LLM Gap Analysis");
    expect(report.personas).toHaveLength(1);
  });

  it("parses persona questions correctly", () => {
    const report = parseGumshoeJson(SAMPLE_JSON);
    const persona = report.personas[0]!;
    expect(persona.name).toBe("Burnout Recovery Seeker");
    expect(persona.questions).toHaveLength(2);
    expect(persona.questions[0]!.query).toContain("burnout recovery");
  });

  it("parses competitor mentions from answers", () => {
    const report = parseGumshoeJson(SAMPLE_JSON);
    const question = report.personas[0]!.questions[0]!;
    expect(question.answers).toHaveLength(2);
    expect(question.answers[0]!.mentions[0]!.brand).toBe("Mindvalley");
    expect(question.answers[0]!.mentions[0]!.rank).toBe(1);
  });
});

// ─── CSV Parser Tests ─────────────────────────────────────────────────────────

describe("parseCsv", () => {
  it("parses CSV rows correctly", () => {
    const rows = parseCsv(SAMPLE_CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe(1);
    expect(rows[0]!.persona).toBe("Burnout Recovery Seeker");
    expect(rows[0]!.query).toContain("burnout recovery");
  });

  it("extracts topic tags from X-marked columns", () => {
    const rows = parseCsv(SAMPLE_CSV);
    expect(rows[0]!.topicTags).toContain("Stress Relief Outcomes");
    expect(rows[0]!.topicTags).toContain("Holistic Approach");
    expect(rows[0]!.topicTags).not.toContain("Evidence-Based Methods");
  });

  it("extracts different tags for second row", () => {
    const rows = parseCsv(SAMPLE_CSV);
    expect(rows[1]!.topicTags).toContain("Program Depth");
    expect(rows[1]!.topicTags).toContain("Instructor Credibility");
    expect(rows[1]!.topicTags).not.toContain("Stress Relief Outcomes");
  });

  it("handles empty CSV gracefully", () => {
    const rows = parseCsv("");
    expect(rows).toHaveLength(0);
  });

  it("handles CSV with only header gracefully", () => {
    const rows = parseCsv(SAMPLE_CSV.split("\n")[0]!);
    expect(rows).toHaveLength(0);
  });
});

// ─── Gap Score Logic Tests ────────────────────────────────────────────────────

describe("Urban Monk mention detection", () => {
  it("detects Urban Monk is NOT mentioned in first query (gap opportunity)", () => {
    const report = parseGumshoeJson(SAMPLE_JSON);
    const q1 = report.personas[0]!.questions[0]!;
    const allMentions = q1.answers.flatMap((a) => a.mentions.map((m) => m.brand.toLowerCase()));
    const urbanMonkNames = ["urban monk", "pedram shojai", "the urban monk", "urban monk academy"];
    const mentioned = allMentions.some((b) => urbanMonkNames.some((n) => b.includes(n)));
    expect(mentioned).toBe(false); // Gap! Urban Monk not appearing
  });

  it("detects Urban Monk IS mentioned in second query", () => {
    const report = parseGumshoeJson(SAMPLE_JSON);
    const q2 = report.personas[0]!.questions[1]!;
    const allMentions = q2.answers.flatMap((a) => a.mentions.map((m) => m.brand.toLowerCase()));
    const urbanMonkNames = ["urban monk", "pedram shojai", "the urban monk", "urban monk academy"];
    const mentioned = allMentions.some((b) => urbanMonkNames.some((n) => b.includes(n)));
    expect(mentioned).toBe(true);
  });
});
