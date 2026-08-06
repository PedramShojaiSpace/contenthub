import { config } from 'dotenv';
config();

const tokenRes = await fetch('https://api.kajabi.com/v1/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.KAJABI_CLIENT_ID,
    client_secret: process.env.KAJABI_CLIENT_SECRET,
  })
});
const { access_token } = await tokenRes.json();
console.log('Token:', access_token ? 'OK' : 'FAILED');

// The form that worked earlier today - try a few clean emails
const FORM_ID = '2149563926';
const testEmails = [
  'pedram@gmail.com',
  'john.smith@gmail.com',
  'urbanmonktest@gmail.com',
];

for (const email of testEmails) {
  const res = await fetch(`https://api.kajabi.com/v1/forms/${FORM_ID}/submit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
    },
    body: JSON.stringify({
      data: { type: 'form_submissions', attributes: { email, name: 'Test User' } }
    })
  });
  const text = await res.text();
  console.log(`${email} -> ${res.status}: ${text.slice(0, 150)}`);
}

// Also check what the form fields look like
const formRes = await fetch(`https://api.kajabi.com/v1/forms/${FORM_ID}`, {
  headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/vnd.api+json' }
});
console.log('\nForm details status:', formRes.status);
const formText = await formRes.text();
console.log('Form details:', formText.slice(0, 500));
