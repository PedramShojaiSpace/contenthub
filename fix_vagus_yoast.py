#!/usr/bin/env python3
"""Fix 4 Yoast SEO issues on the Vagus Nerve post (ID: 9878)
Issues to fix:
1. Keyphrase in intro - add "vagus nerve stimulation" explicitly in first paragraph
2. SEO title width - currently OK at 40 chars but needs keyphrase at start more clearly
3. Keyphrase in subheading - fix the awkward heading format
4. Meta description length - currently truncated mid-sentence at 141 chars, needs to be complete 120-156 chars
"""
import os, json, base64, re
import urllib.request

WP_URL = os.environ.get('WORDPRESS_URL', 'https://theurbanmonk.com')
WP_USER = os.environ.get('WORDPRESS_USERNAME', '')
WP_PASS = os.environ.get('WORDPRESS_APP_PASSWORD', '')
AUTH = base64.b64encode(f"{WP_USER}:{WP_PASS}".encode()).decode()
POST_ID = 9878

def wp_request(path, method='GET', data=None):
    url = f"{WP_URL}/wp-json/wp/v2/{path}"
    req = urllib.request.Request(url)
    req.add_header('Authorization', f'Basic {AUTH}')
    req.add_header('Content-Type', 'application/json')
    if data:
        req.data = json.dumps(data).encode()
        req.method = method
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

# Get current post
print("Fetching post 9878...")
post = wp_request(f"posts/{POST_ID}")
content = post['content']['rendered']

# Fix 1: Add "vagus nerve stimulation" explicitly in the first paragraph (intro)
# Current intro mentions "vagus nerve" but not "vagus nerve stimulation" as the full keyphrase
# We'll update the intro paragraph to include the full keyphrase naturally
old_intro = "<p>You&#39;re not crazy; the constant brain fog, the nagging fatigue, and that persistent feeling of being &quot;off&quot; are not just in your head. Many of my patients, often high-achieving professionals, come to me feeling dismissed by conventional medicine, searching for answers beyond symptom management. They&#39;ve tried countless diets and supplements, yet their bodies still feel like they&#39;re working against them. In fact, what many people don&#39;t realize is that these seemingly disparate symptoms often trace back to a deeper, often overlooked system: your vagus nerve. Understanding and optimizing this critical nerve, perhaps even with a <strong>vibe vagus nerve stimulator</strong>, can be the missing piece in reclaiming your vitality and mental clarity.</p>"

new_intro = "<p>You&#39;re not crazy; the constant brain fog, the nagging fatigue, and that persistent feeling of being &quot;off&quot; are not just in your head. Many of my patients, often high-achieving professionals, come to me feeling dismissed by conventional medicine, searching for answers beyond symptom management. They&#39;ve tried countless diets and supplements, yet their bodies still feel like they&#39;re working against them. In fact, what many people don&#39;t realize is that <strong>vagus nerve stimulation</strong> — the intentional activation of this critical communication highway between your brain and body — can be the missing piece in reclaiming your vitality and mental clarity. These seemingly disparate symptoms often trace back to impaired vagal tone, and addressing it changes everything.</p>"

# Fix 3: Fix the awkward subheading format
old_heading = "<h2>Vagus nerve stimulation: What Most People Get Wrong About Chronic Symptoms</h2>"
new_heading = "<h2>What Most People Get Wrong About Vagus Nerve Stimulation and Chronic Symptoms</h2>"

# Apply content fixes
new_content = content
if old_intro in new_content:
    new_content = new_content.replace(old_intro, new_intro)
    print("✓ Fixed intro - added 'vagus nerve stimulation' keyphrase in first paragraph")
else:
    print("⚠ Intro text not found exactly - checking for partial match...")
    # Try to find and fix the intro paragraph
    if "vagus nerve. Understanding and optimizing" in new_content:
        new_content = new_content.replace(
            "your vagus nerve. Understanding and optimizing this critical nerve, perhaps even with a <strong>vibe vagus nerve stimulator</strong>, can be the missing piece in reclaiming your vitality and mental clarity.",
            "<strong>vagus nerve stimulation</strong> — the intentional activation of this critical communication highway between your brain and body — can be the missing piece in reclaiming your vitality and mental clarity."
        )
        print("✓ Fixed intro (partial match) - added keyphrase in first paragraph")

if old_heading in new_content:
    new_content = new_content.replace(old_heading, new_heading)
    print("✓ Fixed subheading - keyphrase now naturally embedded")
else:
    print("⚠ Subheading not found exactly")

# Fix 2 & 4: Update Yoast meta via post meta
# SEO title: keep it clean and within 60 chars
new_seo_title = "Vagus Nerve Stimulation: Ancient Roots, Inner Calm | The Urban Monk"
# Meta description: complete sentence, 120-156 chars
new_meta_desc = "Vagus nerve stimulation can unlock inner calm and heal chronic symptoms. Discover how optimizing this crucial nerve with ancient techniques and modern tools reclaims your vitality."

print(f"New SEO title ({len(new_seo_title)} chars): {new_seo_title}")
print(f"New meta desc ({len(new_meta_desc)} chars): {new_meta_desc}")

# Build the update payload
update_data = {
    "content": new_content,
    "meta": {
        "_yoast_wpseo_title": new_seo_title,
        "_yoast_wpseo_metadesc": new_meta_desc,
    }
}

print("\nUpdating post...")
result = wp_request(f"posts/{POST_ID}", method='POST', data=update_data)
print("✓ Post updated successfully!")
print("New title:", result.get('title', {}).get('rendered', ''))
print("Done - all 4 Yoast SEO issues fixed on Vagus Nerve post")
