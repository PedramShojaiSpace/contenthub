import 'dotenv/config';

const clientId = process.env.KAJABI_CLIENT_ID;
const clientSecret = process.env.KAJABI_CLIENT_SECRET;

console.log('KAJABI_CLIENT_ID set:', !!clientId);
console.log('KAJABI_CLIENT_SECRET set:', !!clientSecret);

if (!clientId || !clientSecret) {
  console.error('❌ Kajabi credentials not set in environment');
  process.exit(1);
}

// Test token fetch
try {
  const res = await fetch('https://api.kajabi.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const data = await res.json();
  if (data.access_token) {
    console.log('✅ Kajabi OAuth token obtained successfully');
    
    // Test contact creation using exact same format as kajabiApi.ts
    const contactRes = await fetch('https://api.kajabi.com/v1/contacts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.access_token}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'contacts',
          attributes: {
            email: 'pipeline-test@gmail.com',
            first_name: 'Pipeline',
            last_name: 'Test',
          },
          relationships: {
            site: {
              data: { type: 'sites', id: '2148432935' }
            }
          }
        }
      }),
    });
    const contactData = await contactRes.json();
    console.log('Kajabi contact response status:', contactRes.status);
    if (contactData.id || contactData.contact?.id) {
      console.log('✅ Kajabi contact created/found:', contactData.id || contactData.contact?.id);
    } else {
      console.log('⚠️ Kajabi contact response:', JSON.stringify(contactData).substring(0, 200));
    }
  } else {
    console.error('❌ Kajabi token error:', JSON.stringify(data));
  }
} catch (err) {
  console.error('❌ Kajabi API error:', err.message);
}
