#!/usr/bin/env python3
"""Generate and publish the Gut Health pillar page to WordPress"""
import os, json, base64, subprocess, sys

WP_URL = os.environ.get('WORDPRESS_URL', 'https://theurbanmonk.com')
WP_USER = os.environ.get('WORDPRESS_USERNAME', '')
WP_PASS = os.environ.get('WORDPRESS_APP_PASSWORD', '')
ANTHROPIC_KEY = os.environ.get('ANTHROPIC_API_KEY', '')

def wp_post(path, data):
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        '-H', f'Authorization: Basic {base64.b64encode(f"{WP_USER}:{WP_PASS}".encode()).decode()}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(data),
        f'{WP_URL}/wp-json/wp/v2/{path}'
    ], capture_output=True, text=True, timeout=30)
    return json.loads(result.stdout)

def call_claude(prompt):
    payload = {
        "model": "claude-opus-4-5",
        "max_tokens": 8000,
        "messages": [{"role": "user", "content": prompt}]
    }
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        '-H', f'x-api-key: {ANTHROPIC_KEY}',
        '-H', 'anthropic-version: 2023-06-01',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(payload),
        'https://api.anthropic.com/v1/messages'
    ], capture_output=True, text=True, timeout=300)
    resp = json.loads(result.stdout)
    if 'content' in resp:
        return resp['content'][0]['text']
    print("Claude error:", resp)
    return None

print("Generating gut health pillar page content via Claude...")

PROMPT = """You are Dr. Pedram Shojai (The Urban Monk), a Doctor of Oriental Medicine, Qigong master, and New York Times bestselling author. Write a comprehensive, authoritative pillar page for the keyword "gut health" targeting the Urban Monk Academy audience.

REQUIREMENTS:
- 3,500-4,500 words
- Format as clean HTML (h2, h3, p, ul, ol tags only — no divs, no classes)
- Tone: warm, authoritative, first-person, integrative medicine perspective
- Include these sections:
  1. Opening hook (personal story or patient case)
  2. What Is Gut Health? (definition, why it matters)
  3. The Gut-Brain Connection (your specialty — vagus nerve, microbiome-mood link)
  4. Signs Your Gut Health Is Compromised (symptoms list)
  5. The Root Causes of Poor Gut Health (stress, diet, antibiotics, toxins, sleep)
  6. The Urban Monk Approach to Gut Healing (Daoist principles + functional medicine)
  7. 7 Evidence-Based Strategies to Improve Gut Health Naturally
  8. The Role of Probiotics, Prebiotics, and Fermented Foods
  9. Gut Health and Longevity (connection to aging, inflammation, chronic disease)
  10. When to Seek Help (functional medicine vs. conventional)
  11. Conclusion with CTA to Urban Monk Academy

- Weave in references to your books (The Urban Monk, Exhausted, Grow a Pair) naturally
- Include a CTA near the end: "Ready to take control of your gut health? Join thousands of members inside the Urban Monk Academy at theurbanmonkacademy.com"
- Do NOT include any markdown — pure HTML only
- Start directly with <h1>The Urban Monk's Complete Guide to Gut Health</h1>"""

content = call_claude(PROMPT)
if not content:
    print("Failed to generate content")
    sys.exit(1)

print(f"Generated {len(content)} chars of content")
print("First 200 chars:", content[:200])

# Publish to WordPress
print("\nPublishing to WordPress...")
post_data = {
    "title": "The Urban Monk's Complete Guide to Gut Health",
    "content": content,
    "status": "publish",
    "slug": "gut-health-complete-guide",
    "meta": {
        "_yoast_wpseo_focuskw": "gut health",
        "_yoast_wpseo_title": "Gut Health: The Urban Monk's Complete Guide | Dr. Pedram Shojai",
        "_yoast_wpseo_metadesc": "Dr. Pedram Shojai's complete guide to gut health: heal your microbiome, restore the gut-brain connection, and reclaim your vitality with integrative medicine."
    }
}

result = wp_post("posts", post_data)
if 'id' in result:
    print(f"\n✓ Published! Post ID: {result['id']}")
    print(f"  URL: {result.get('link', 'N/A')}")
    print(f"  Status: {result.get('status', 'N/A')}")
else:
    print("Error:", result.get('message', str(result)[:300]))
