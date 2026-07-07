import { config } from 'dotenv';
config();

const BUILT_IN_FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL;
const BUILT_IN_FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

console.log('API URL:', BUILT_IN_FORGE_API_URL ? 'set' : 'MISSING');
console.log('API KEY:', BUILT_IN_FORGE_API_KEY ? 'set' : 'MISSING');

const response = await fetch(`${BUILT_IN_FORGE_API_URL}/llm/v1/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${BUILT_IN_FORGE_API_KEY}`
  },
  body: JSON.stringify({
    messages: [
      { role: 'system', content: 'You are a Meta ad copywriter.' },
      { role: 'user', content: 'Generate 5 Meta ad variants for an oral microbiome product. Return JSON with a "variants" array of 5 objects each having: primaryText, headline, description, callToAction, imagePrompt, audienceNote.' }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'meta_ad_variants',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            variants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  primaryText: { type: 'string' },
                  headline: { type: 'string' },
                  description: { type: 'string' },
                  callToAction: { type: 'string' },
                  imagePrompt: { type: 'string' },
                  audienceNote: { type: 'string' },
                },
                required: ['primaryText', 'headline', 'description', 'callToAction', 'imagePrompt', 'audienceNote'],
                additionalProperties: false,
              }
            }
          },
          required: ['variants'],
          additionalProperties: false,
        }
      }
    }
  })
});

console.log('HTTP Status:', response.status);
const data = await response.json();
if (data.error) {
  console.error('LLM Error:', JSON.stringify(data.error, null, 2));
} else {
  const content = data.choices?.[0]?.message?.content;
  console.log('Content type:', typeof content);
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      console.log('SUCCESS - variants count:', parsed.variants?.length);
      console.log('First variant headline:', parsed.variants?.[0]?.headline);
    } catch(e) {
      console.error('JSON parse error:', e.message);
      console.log('Raw content:', content.substring(0, 300));
    }
  } else {
    console.log('Non-string content:', JSON.stringify(content).substring(0, 300));
  }
}
