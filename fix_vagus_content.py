#!/usr/bin/env python3
"""Fix intro keyphrase and subheading for Vagus Nerve post (ID: 9878)"""
import os, json, base64, subprocess

WP_URL = os.environ.get('WORDPRESS_URL', 'https://theurbanmonk.com')
WP_USER = os.environ.get('WORDPRESS_USERNAME', '')
WP_PASS = os.environ.get('WORDPRESS_APP_PASSWORD', '')

def curl_get(path):
    result = subprocess.run([
        'curl', '-s', '-H', f'Authorization: Basic {base64.b64encode(f"{WP_USER}:{WP_PASS}".encode()).decode()}',
        f'{WP_URL}/wp-json/wp/v2/{path}'
    ], capture_output=True, text=True)
    return json.loads(result.stdout)

def curl_post(path, data):
    result = subprocess.run([
        'curl', '-s', '-X', 'POST',
        '-H', f'Authorization: Basic {base64.b64encode(f"{WP_USER}:{WP_PASS}".encode()).decode()}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps(data),
        f'{WP_URL}/wp-json/wp/v2/{path}'
    ], capture_output=True, text=True)
    return json.loads(result.stdout)

# Get current post
print("Fetching post 9878...")
post = curl_get("posts/9878")
content = post['content']['rendered']

print(f"Content length: {len(content)} chars")

# Fix 1: Add "vagus nerve stimulation" to intro (first paragraph)
# Current: "...your vagus nerve. Understanding and optimizing this critical nerve, perhaps even with a <strong>vibe vagus nerve stimulator</strong>, can be the missing piece..."
# New: Add "vagus nerve stimulation" explicitly in the opening
old_phrase = "these seemingly disparate symptoms often trace back to a deeper, often overlooked system: your vagus nerve. Understanding and optimizing this critical nerve, perhaps even with a <strong>vibe vagus nerve stimulator</strong>, can be the missing piece in reclaiming your vitality and mental clarity."
new_phrase = "these seemingly disparate symptoms often trace back to one root cause: impaired <strong>vagus nerve stimulation</strong>. This critical nerve — the communication highway between your brain and every major organ — governs your body's ability to heal, rest, and restore. Learning to optimize it can be the missing piece in reclaiming your vitality and mental clarity."

# Fix 3: Fix the awkward subheading
old_heading = "Vagus nerve stimulation: What Most People Get Wrong About Chronic Symptoms"
new_heading = "What Most People Get Wrong About Vagus Nerve Stimulation and Chronic Symptoms"

new_content = content
if old_phrase in new_content:
    new_content = new_content.replace(old_phrase, new_phrase)
    print("✓ Fixed intro - 'vagus nerve stimulation' now appears in first paragraph")
else:
    print(f"⚠ Intro phrase not found. Looking for partial match...")
    if "vibe vagus nerve stimulator" in new_content:
        new_content = new_content.replace(
            "perhaps even with a <strong>vibe vagus nerve stimulator</strong>, can be the missing piece",
            "through intentional <strong>vagus nerve stimulation</strong> — can be the missing piece"
        )
        print("✓ Fixed intro (partial match)")

if old_heading in new_content:
    new_content = new_content.replace(old_heading, new_heading)
    print("✓ Fixed subheading")
else:
    print(f"⚠ Subheading not found exactly. Checking...")
    if "Vagus nerve stimulation:" in new_content:
        new_content = new_content.replace(
            "Vagus nerve stimulation: What Most People Get Wrong About Chronic Symptoms",
            "What Most People Get Wrong About Vagus Nerve Stimulation and Chronic Symptoms"
        )
        print("✓ Fixed subheading (variant match)")

if new_content == content:
    print("⚠ No content changes made - phrases not found")
else:
    print(f"Content changed: {len(content)} -> {len(new_content)} chars")
    result = curl_post("posts/9878", {"content": new_content})
    if 'id' in result:
        print("✓ Post content updated successfully!")
    else:
        print("Error:", result.get('message', str(result)[:200]))
