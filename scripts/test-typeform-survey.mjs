import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const apiKey = process.env.TYPEFORM_API_KEY;

// Simulate the exact questions the LLM generates for a post-webinar survey
const surveyQuestions = [
  { ref: "what_brought_you", title: "What brought you to this webinar today?", type: "long_text", required: true, choices: [], properties: {} },
  { ref: "main_struggle", title: "What's the main health struggle you're dealing with right now?", type: "long_text", required: true, choices: [], properties: {} },
  { ref: "symptoms", title: "Which of these symptoms are you experiencing? (select all that apply)", type: "multiple_choice", required: true, choices: [{ label: "Chronic fatigue" }, { label: "Brain fog" }, { label: "Gut issues / bloating" }, { label: "Poor sleep" }, { label: "Anxiety or stress" }, { label: "Weight issues" }], properties: { allow_multiple_selection: true, allow_other_choice: true } },
  { ref: "how_long", title: "How long have you been dealing with this?", type: "multiple_choice", required: true, choices: [{ label: "Less than 6 months" }, { label: "6 months to 1 year" }, { label: "1-3 years" }, { label: "More than 3 years" }], properties: { allow_multiple_selection: false, allow_other_choice: false } },
  { ref: "tried_before", title: "What have you already tried to address this?", type: "multiple_choice", required: false, choices: [{ label: "Diet changes" }, { label: "Supplements" }, { label: "Prescription medications" }, { label: "Therapy or coaching" }, { label: "Exercise programs" }], properties: { allow_multiple_selection: true, allow_other_choice: true } },
  { ref: "ideal_outcome", title: "What would your life look like if this was completely resolved?", type: "long_text", required: true, choices: [], properties: {} },
  { ref: "commitment_level", title: "On a scale of 1 to 10, how serious are you about finding and fixing your root cause in the next 90 days? (1 = Not serious at all, 10 = Absolutely committed)", type: "rating", required: true, choices: [], properties: { steps: 10 } },
];

// Replicate the exact field-building logic from webinarRouter.ts
const VALID_TF_TYPES = new Set([
  "short_text", "long_text", "multiple_choice", "picture_choice",
  "rating", "opinion_scale", "yes_no", "email", "phone_number",
  "number", "date", "dropdown", "ranking", "matrix", "file_upload",
  "statement", "website",
]);
const TYPES_WITH_VALIDATIONS = new Set([
  "short_text", "long_text", "email", "phone_number", "number", "date", "website",
]);

const fields = surveyQuestions.map((q) => {
  const safeType = VALID_TF_TYPES.has(q.type) ? q.type : "long_text";
  const field = { ref: q.ref, title: q.title, type: safeType };
  if (TYPES_WITH_VALIDATIONS.has(safeType)) {
    field.validations = { required: q.required };
  }
  if (safeType === "multiple_choice" && q.choices && q.choices.length > 0) {
    field.properties = {
      choices: q.choices,
      allow_multiple_selection: q.properties?.allow_multiple_selection ?? false,
      allow_other_choice: q.properties?.allow_other_choice ?? true,
    };
  } else if (safeType === "rating" || safeType === "opinion_scale") {
    field.properties = { steps: q.properties?.steps ?? 10 };
  }
  return field;
});

console.log("Fields being sent to Typeform:");
console.log(JSON.stringify(fields, null, 2));

const payload = {
  title: "Upstream Health Webinar — Post-Webinar Survey",
  fields,
  settings: { is_public: true, is_trial: false, show_progress_bar: true, show_typeform_branding: false },
  thankyou_screens: [{
    ref: "thank_you",
    title: "Thank you for your responses. We appreciate you taking the time.",
    type: "thankyou_screen",
    properties: { show_button: false, share_icons: false },
  }],
};

console.log("\nPushing to Typeform...");
const resp = await fetch("https://api.typeform.com/forms", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify(payload),
});

console.log("Status:", resp.status);
const text = await resp.text();
if (!resp.ok) {
  console.log("ERROR:", text);
} else {
  const data = JSON.parse(text);
  console.log("SUCCESS! Form ID:", data.id, "URL:", data._links?.display);
  // Clean up test form
  const del = await fetch(`https://api.typeform.com/forms/${data.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  console.log("Cleanup:", del.status);
}
