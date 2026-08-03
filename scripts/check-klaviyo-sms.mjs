import * as dotenv from 'dotenv';
dotenv.config();

const KEY = process.env.KLAVIYO_PRIVATE_KEY;
const SMS_LIST = process.env.KLAVIYO_INTERCONNECTED_SMS_LIST_ID || 'Xer7ua';

async function kl(path) {
  const res = await fetch(`https://a.klaviyo.com/api/${path}`, {
    headers: {
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision: '2024-10-15',
    },
  });
  return res.json();
}

async function main() {
  console.log('\n=== KLAVIYO SMS STATUS CHECK ===\n');

  // 1. Check account sending channels
  const channels = await kl('sending-channels/');
  console.log('Sending channels:', JSON.stringify(channels, null, 2));

  // 2. Check SMS list profile count
  const list = await kl(`lists/${SMS_LIST}/?additional-fields[list]=profile_count`);
  console.log('\nSMS List:', JSON.stringify(list?.data?.attributes, null, 2));

  // 3. Try a test SMS subscription with a real-format phone number
  console.log('\n--- Testing SMS subscription ---');
  const testRes = await fetch('https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/', {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${KEY}`,
      revision: '2024-10-15',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'profile-subscription-bulk-create-job',
        attributes: {
          profiles: {
            data: [
              {
                type: 'profile',
                attributes: {
                  email: 'sms_test_check@urbanmonk.com',
                  phone_number: '+15551234567',
                  subscriptions: {
                    sms: {
                      marketing: {
                        consent: 'SUBSCRIBED',
                      },
                    },
                  },
                },
              },
            ],
          },
          historical_import: false,
        },
        relationships: {
          list: {
            data: {
              type: 'list',
              id: SMS_LIST,
            },
          },
        },
      },
    }),
  });
  const testData = await testRes.json();
  console.log('Test subscription result (HTTP', testRes.status, '):', JSON.stringify(testData, null, 2));
}

main().catch(console.error);
