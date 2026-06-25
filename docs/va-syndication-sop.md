# VA Syndication SOP — Medium, Quora & Reddit
**The Urban Monk Content Hub**
*Standard Operating Procedure for Virtual Assistants*

---

## Overview

After each blog post is published to WordPress, the Content Hub automatically generates three syndicated versions:

1. **Medium Article** — adapted for cold audiences who don't know Dr. Pedram Shojai
2. **Quora Answer** — a fresh expert answer to the most relevant question
3. **Reddit Post** — community-native content for relevant health/wellness subreddits

Your job as a VA is to **review, copy, and manually post** each piece to the correct platform. The Content Hub's VA Dashboard (`/va`) shows all pending jobs with the pre-written content ready to copy.

---

## Step 1 — Access the VA Dashboard

1. Log in to the Content Hub at `https://content.theurbanmonk.com`
2. Navigate to **VA Dashboard** in the left sidebar (under Syndication)
3. You will see a table of pending syndication jobs sorted by date
4. Each row shows: blog title, platform, scheduled date, status, and a **Copy Content** button

---

## Step 2 — Medium

### What Medium Is
Medium is a long-form publishing platform. Our goal is to reach readers who have never heard of Dr. Pedram Shojai. The adapted version removes newsletter-native language and adds a cold-audience introduction.

### How to Post

1. In the VA Dashboard, click the **Medium** job card for the post
2. Click **Copy Content** to copy the adapted article (title + body markdown)
3. Open [medium.com/new-story](https://medium.com/new-story) and log in to the Urban Monk Medium account
4. Paste the title into the title field
5. Paste the body into the editor (Medium auto-formats markdown headings)
6. **Set the canonical URL** (critical for SEO):
   - Click the three-dot menu (⋯) → **More settings**
   - Scroll to **Canonical link** and paste the WordPress post URL (shown in the VA Dashboard job card)
7. Add 3–5 tags (use the focus keyword + 2–3 related health topics)
8. Click **Publish** → **Publish now**
9. Copy the Medium post URL and paste it back into the VA Dashboard job card → **Mark as Done**

### Tips
- Do **not** add a paywall — all Urban Monk content should be free on Medium
- If Medium flags the post as a duplicate (because of the canonical URL), that is expected and correct
- The canonical URL tells Google the WordPress post is the original; Medium gets the distribution

---

## Step 3 — Quora

### What Quora Is
Quora is a Q&A platform. Our goal is to position Dr. Pedram Shojai as an expert by answering relevant health questions. The AI generates a fresh answer — never a copy of the WordPress article.

### How to Post

1. In the VA Dashboard, click the **Quora** job card
2. Note the **Target Question** shown at the top of the card (e.g. "What is the gut-brain axis and why does it matter?")
3. Click **Copy Answer** to copy the pre-written answer
4. Open [quora.com](https://quora.com) and log in to the Urban Monk Quora account
5. Search for the target question using the search bar
6. If the exact question exists: click **Answer** and paste the content
7. If the exact question does not exist:
   - Click **Add Question** and type the target question
   - Then click **Answer** on the new question
8. In the answer editor:
   - Paste the answer text
   - Do **not** add promotional links in the body
   - At the end, you may add: *"Follow me on Substack for more: [Substack URL]"*
9. Click **Submit**
10. Copy the Quora answer URL and paste it into the VA Dashboard → **Mark as Done**

### Tips
- Quora penalizes promotional content — keep the answer educational and helpful
- If the answer gets collapsed (hidden by Quora), it may need editing to remove any links
- Aim to answer questions with high view counts (visible on the question page)

---

## Step 4 — Reddit

### What Reddit Is
Reddit is a community forum organized into subreddits. Our goal is to share valuable content in a peer-to-peer, non-promotional style. The AI suggests the best subreddits and writes in Reddit's native voice.

### How to Post

1. In the VA Dashboard, click the **Reddit** job card
2. Note the **Suggested Subreddits** (e.g. r/Microbiome, r/Nootropics, r/Biohackers)
3. Click **Copy Post** to copy the post title and body
4. Open [reddit.com](https://reddit.com) and log in to the Urban Monk Reddit account
5. Navigate to the first suggested subreddit (e.g. reddit.com/r/Microbiome)
6. Click **Create Post**
7. Select **Link** post type (not Text) if the post includes a link to the WordPress article
8. Paste the **Post Title** and **Post Body** from the VA Dashboard
9. In the URL field, paste the WordPress article URL
10. Click **Post**
11. **Check subreddit rules** before posting — some subreddits prohibit self-promotion or external links
    - If the subreddit prohibits links, switch to a **Text** post and include the article URL naturally in the body
12. Repeat for the second suggested subreddit if appropriate
13. Copy the Reddit post URL(s) and paste into the VA Dashboard → **Mark as Done**

### Tips
- Never post the same content to more than 2–3 subreddits (Reddit bans for spam)
- Wait at least 48 hours between posting to the same subreddit
- Engage with comments — reply within 24 hours to build credibility
- Avoid r/Health for link posts (strict no-self-promotion rule); prefer r/Microbiome, r/Nootropics, r/Biohackers, r/Longevity, r/Meditation

---

## Step 5 — Marking Jobs Complete

After posting to all three platforms:

1. Return to the VA Dashboard
2. For each job card, click **Mark as Done** and paste the published URL
3. The job status will change from **Pending** → **Complete**
4. The Content Hub will automatically log the completion date and published URL

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Medium says "duplicate content" | This is expected — the canonical URL is set correctly |
| Quora collapses the answer | Edit to remove any links from the body text |
| Reddit removes the post | Check subreddit rules; switch to text post if links are prohibited |
| VA Dashboard shows no jobs | Wait for the daily syndication cron to run (08:00 UTC) or ask the admin to trigger manually |
| Content looks wrong / outdated | Click **Regenerate** on the job card to re-run the AI adaptation |

---

## Account Credentials

Account credentials are stored in the team password manager. Do not share or store them locally.

- **Medium**: Urban Monk Medium account (ask admin for login)
- **Quora**: Urban Monk Quora account (ask admin for login)
- **Reddit**: u/UrbanMonkOfficial (ask admin for login)

---

*Last updated: June 2026 | Maintained by: Urban Monk Content Team*
