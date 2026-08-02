import * as dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.KLAVIYO_PRIVATE_KEY;
const LIST_ID = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID;

console.log('KLAVIYO_PRIVATE_KEY present:', !!KEY, '| first 10 chars:', KEY?.slice(0,10));
console.log('SMS_LIST_ID:', LIST_ID);

// 1. Test account connection
const acctRes = await fetch('https://a.klaviyo.com/api/accounts/', {
  headers: { 'Authorization': `Klaviyo-API-Key ${KEY}`, 'revision': '2024-10-15' }
});
const acctData = await acctRes.json();
console.log('\n=== KLAVIYO ACCOUNT ===');
if (!acctRes.ok) {
  console.error('FAILED:', acctRes.status, JSON.stringify(acctData).slice(0,300));
} else {
  const name = acctData?.data?.[0]?.attributes?.contact_information?.organization_name ?? 'unknown';
  console.log('Connected to:', name, '✓');
}

// 2. Check the list exists
console.log('\n=== LIST CHECK ===');
const listRes = await fetch(`https://a.klaviyo.com/api/lists/${LIST_ID}/`, {
  headers: { 'Authorization': `Klaviyo-API-Key ${KEY}`, 'revision': '2024-10-15' }
});
const listData = await listRes.json();
if (!listRes.ok) {
  console.error('List check FAILED:', listRes.status, JSON.stringify(listData).slice(0,300));
} else {
  console.log('List name:', listData?.data?.attributes?.name);
  console.log('List type:', listData?.data?.attributes?.list_type);
  console.log('List ID confirmed:', listData?.data?.id);
}

// 3. Try to upsert a test profile (Sharon from our DB who gave SMS consent)
console.log('\n=== TEST PROFILE UPSERT (Sharon) ===');
const profileBody = {
  data: {
    type: 'profile',
    attributes: {
      email: 'sharonsz@aol.com',
      first_name: 'Sharon',
      phone_number: '+16175102416',
      properties: {
        sms_consent: true,
        sms_consent_source: 'interconnected-optin',
        sms_consent_timestamp: new Date().toISOString(),
      }
    }
  }
};
const profRes = await fetch('https://a.klaviyo.com/api/profiles/', {
  method: 'POST',
  headers: { 'Authorization': `Klaviyo-API-Key ${KEY}`, 'revision': '2024-10-15', 'Content-Type': 'application/json' },
  body: JSON.stringify(profileBody)
});
const profData = await profRes.json();
let profileId = null;
if (profRes.status === 409) {
  profileId = profData?.errors?.[0]?.meta?.duplicate_profile_id;
  console.log('Profile already exists, ID:', profileId);
} else if (!profRes.ok) {
  console.error('Profile upsert FAILED:', profRes.status, JSON.stringify(profData).slice(0,400));
} else {
  profileId = profData?.data?.id;
  console.log('Profile created, ID:', profileId);
}

// 4. Subscribe to SMS list
if (profileId && LIST_ID) {
  console.log('\n=== SMS SUBSCRIBE TEST ===');
  const subBody = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        profiles: {
          data: [{
            type: 'profile',
            id: profileId,
            attributes: {
              subscriptions: { sms: { marketing: { consent: 'SUBSCRIBED' } } }
            }
          }]
        }
      },
      relationships: {
        list: { data: { type: 'list', id: LIST_ID } }
      }
    }
  };
  const subRes = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
    method: 'POST',
    headers: { 'Authorization': `Klaviyo-API-Key ${KEY}`, 'revision': '2024-10-15', 'Content-Type': 'application/json' },
    body: JSON.stringify(subBody)
  });
  const subText = await subRes.text();
  console.log('SMS subscribe status:', subRes.status, subText.slice(0,300));
}
