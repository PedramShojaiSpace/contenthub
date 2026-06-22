import dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/lights-on-optin/.env" });

const apiKey = process.env.TYPEFORM_API_KEY;

// Test with show_typeform_branding: false (requires paid plan)
const payload = {
  title: "Branding Test - Delete Me",
  fields: [{ ref: "q1", title: "Test question", type: "short_text" }],
  settings: {
    is_public: true,
    is_trial: false,
    show_progress_bar: true,
    show_typeform_branding: false,  // This requires paid plan
  },
};

console.log("Testing with show_typeform_branding: false...");
const resp = await fetch("https://api.typeform.com/forms", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
  body: JSON.stringify(payload),
});
console.log("Status:", resp.status);
const text = await resp.text();
if (!resp.ok) {
  console.log("ERROR (branding=false):", text);
  
  // Try again without the branding setting
  console.log("\nRetrying without show_typeform_branding...");
  const payload2 = {
    title: "Branding Test 2 - Delete Me",
    fields: [{ ref: "q1", title: "Test question", type: "short_text" }],
    settings: { is_public: true, show_progress_bar: true },
  };
  const resp2 = await fetch("https://api.typeform.com/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload2),
  });
  console.log("Status (no branding):", resp2.status);
  const text2 = await resp2.text();
  if (resp2.ok) {
    const data2 = JSON.parse(text2);
    console.log("SUCCESS without branding! ID:", data2.id);
    await fetch(`https://api.typeform.com/forms/${data2.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } else {
    console.log("ERROR (no branding):", text2);
  }
} else {
  const data = JSON.parse(text);
  console.log("SUCCESS with branding=false! ID:", data.id);
  await fetch(`https://api.typeform.com/forms/${data.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}
