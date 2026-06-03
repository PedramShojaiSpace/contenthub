# Content Engine — Project TODO

## Core Infrastructure
- [x] Upgrade project to full-stack (db, server, user)
- [x] Run database migrations

## Database Schema
- [x] Add content_items table (title, platform, status, text, image_url, scheduled_at, published_at)
- [x] Add platform_strategies table (platform, voice_guidelines, prompt_template, document_url)
- [x] Add generated_images table (content_item_id, platform, image_url, prompt)
- [x] Run db:push after schema changes

## Backend (tRPC Routers)
- [x] Content items CRUD router (list, create, update, delete, changeStatus)
- [x] AI content generation router (generateContent, generateImagePrompt, generateImage)
- [x] Platform strategies router (get, list, upsert)
- [x] Assets router (listImages)

## Frontend — App Shell
- [x] Dark theme with Urban Monk brand colors (deep black, gold accent)
- [x] DashboardLayout with sidebar navigation (Content Engine branding)
- [x] Routes: Command Center, Creation Studio, Strategy Brain, Asset Library

## Frontend — Command Center (Dashboard)
- [x] Kanban board with columns: Idea → Drafting → Review → Approved → Scheduled → Published
- [x] Stats bar showing count per status
- [x] Content item cards with platform badges, status, and quick actions
- [x] Calendar view (real monthly grid with drag-to-schedule)
- [x] Create new content dialog
- [x] Delete and status change via dropdown

## Frontend — Creation Studio
- [x] Idea input text box
- [x] Platform selector (Meta, LinkedIn, X, YouTube, All)
- [x] Custom instructions field
- [x] "Generate Content" button with AI integration
- [x] Four-panel output (one per platform) with editable textareas
- [x] Copy and Save buttons per platform panel
- [x] Image prompt generator
- [x] "Generate Image" button (Nano Banana)
- [x] Platform-specific visual style selector (LinkedIn, Meta, X, YouTube, Signature)
- [x] Image preview and URL copy
- [x] "Attach to Card" button after image generation
- [x] Buffer Syndication panel with profile selector and per-platform Push buttons

## Frontend — Strategy Brain
- [x] Platform profile tabs (LinkedIn, Meta, X, YouTube)
- [x] Voice guidelines display and edit (pre-populated with Pedram's voice)
- [x] Custom prompt override field
- [x] Save strategy button

## Frontend — Asset Library
- [x] Grid view of all generated images
- [x] Filter by platform
- [x] Image detail dialog with copy/download
- [x] Empty state

## AI Integration
- [x] invokeLLM for multi-platform content generation with Pedram's voice
- [x] generateImage (Nano Banana) for visual asset creation
- [x] Platform-specific brand style prompts (LinkedIn, Meta, X, YouTube, Signature)
- [x] Image prompt auto-generation from content

## Calendar View (v2)
- [x] Real monthly calendar grid with day cells
- [x] Approved/Scheduled content items displayed on their scheduled date
- [x] Click-to-schedule: click a day to assign a content item to that date
- [x] Drag-to-reschedule: drag cards between days
- [x] Month navigation (prev/next)
- [x] Platform color-coded badges on calendar cards
- [x] Unscheduled content sidebar panel

## Nano Banana Image Generation (v2)
- [x] Platform-specific brand style prompts (LinkedIn, Meta, X, YouTube)
- [x] LinkedIn: Corporate Wellness — minimalist editorial, deep navy, gold accents
- [x] Meta: Lifestyle & Aspiration — warm, earthy, natural light
- [x] X: Bold & Cinematic — high-contrast, typographic, stark black
- [x] YouTube: Epic Documentary — chiaroscuro thumbnail, prestige film still
- [x] Urban Monk Signature: dark, moody, cinematic, deep blacks, warm gold
- [x] Style selector UI in Creation Studio image panel
- [x] Preview style descriptions before generating
- [x] Auto-select platform style based on active platform tab

## App Rename (v2)
- [x] Rename app title to "Urban Monk Productions Content Hub" in index.html
- [x] Rename sidebar header from "Content Engine" to "UMP Content Hub"
- [x] Update VITE_APP_TITLE to match
- [x] Update all page titles and meta tags

## v3 Features

### Image-to-Card Attachment
- [x] Add "Attach to Card" button in Creation Studio after image is generated
- [x] Save imageUrl to content item via update mutation
- [x] Show "Image attached" badge on content card panels
- [x] Attach image prompt alongside URL

### Buffer Syndication
- [x] Build buffer.ts module with getBufferProfiles and pushToBuffer
- [x] Add syndication.getProfiles and syndication.push tRPC procedures
- [x] Add syndication panel in Creation Studio with profile checkboxes and Push buttons
- [x] Show syndication success/failure status per platform
- [x] Update content item status to 'scheduled' after successful push
- [x] Graceful no-token state (shows setup instructions)

### Weekly Digest Notification
- [x] Build sendWeeklyDigest function (scheduled, stuck, aging items)
- [x] Wire digest cron into server startup (Monday 08:00 UTC)
- [x] Add digest.sendNow procedure for manual trigger
- [x] Send via notifyOwner helper

## Testing
- [x] Vitest tests for auth.logout
- [x] Vitest tests for content, strategy, ai, and assets router structure
- [x] Vitest tests for syndication.getProfiles, syndication.push, digest.sendNow, content.update (image attachment)

## v4 Features

### Image Thumbnails on Kanban & Calendar
- [x] Show image thumbnail on Kanban cards when imageUrl is set
- [x] Show image thumbnail chip on Calendar day cells
- [x] Lightbox/expand on thumbnail click

### Published Confirmation Flow
- [x] "Mark as Published" dialog with publish date picker and URL field
- [x] Save publishedAt timestamp and publishUrl to content item
- [x] Show published date and URL on Published column cards

### Analytics Stub
- [x] Add analytics fields to content_items (views, likes, comments, shares)
- [x] Analytics panel on Published cards (editable stub fields)
- [x] Summary analytics row in Command Center stats bar
- [x] Run db:push after schema changes

## Research Intelligence Module (v5)

### Database Schema
- [x] Add research_reports table (reportId, reportName, reportFocus, reportDescription, uploadedAt, weekLabel, rawJson, rawCsv)
- [x] Add research_personas table (reportId, personaName, personaDescription)
- [x] Add research_queries table (reportId, personaName, query, topicTags JSON)
- [x] Add research_competitor_mentions table (reportId, query, brand, rank, reason, model)
- [x] Run db:push after schema changes

### Backend Parsers
- [x] Parse Gumshoe JSON: extract reportId, reportName, personas, queries, competitor mentions per model
- [x] Parse Gumshoe CSV: extract query rows, persona names, topic tag columns (X = tagged)
- [x] Merge JSON + CSV data into unified research_queries rows
- [x] Build getCompetitorGapAnalysis: queries where Urban Monk is NOT mentioned but competitors are
- [x] Build getTopicTagFrequency: count which topic tags appear most across all queries
- [x] Build getPersonaQueries: all queries grouped by persona
- [x] Build getCompetitorLeaderboard: brands ranked by total mention count across all queries/models

### Research Intelligence UI (new sidebar section)
- [x] New "Research" sidebar nav item with upload icon
- [x] Upload page: drag-and-drop or file picker for JSON + CSV pair, with week label input
- [x] Report list: reverse-chronological list of uploaded reports with summary stats
- [x] Competitive Gap Dashboard: queries where Urban Monk is absent, sorted by competitor density
- [x] Competitor Leaderboard: top 10 brands mentioned across all queries with mention counts
- [x] Persona Browser: tab per persona showing all their queries and which topics they care about
- [x] Topic Tag Heatmap: which topic tags appear most, cross-referenced by persona
- [x] "Create Content from Gap" button: pre-fills Creation Studio with the gap query as the idea

### Creation Studio Integration
- [x] "Research Context" panel in Creation Studio showing top 3 unanswered gap queries
- [x] Inject selected gap query + persona description into AI generation prompt
- [x] Show which competitor brands are winning that query so content can be differentiated
- [x] Track gap query status: unused / in-progress / published (update when content item is created)

### Tests
- [x] Vitest tests for Gumshoe JSON parser
- [x] Vitest tests for CSV parser and topic tag extraction
- [x] Vitest tests for competitor gap analysis query

## v6 Features

### Coverage Trend Chart
- [x] Add coverage_snapshots table (reportId, weekLabel, totalQueries, mentionedCount, gapCount, snapshotAt)
- [x] Auto-snapshot on each Gumshoe report upload
- [x] Add research.getCoverageTrend tRPC procedure
- [x] Build Coverage Trend recharts line chart in Research Intelligence dashboard
- [x] Show week-over-week delta (gaps closed per week)

### Gap Query Auto-Tagging
- [x] Add gapQueryId column to content_items schema
- [x] Pass gapQueryId when generating brief from gap query
- [x] Store gapQueryId on content item creation
- [x] Add research.markGapAddressed tRPC procedure
- [x] Auto-mark gap as addressed when linked content item moves to Published
- [x] Show "Addressed" badge on gap queries in Research Intelligence
- [x] Show source gap query link on Kanban content cards
- [x] Write vitest tests for both features

## v7 Features

### Auto-Image with Content Generation
- [ ] Backend: generate platform-specific image in parallel with content text generation
- [ ] Backend: return imageUrl per platform output alongside the copy
- [ ] Frontend: display generated image inline in each platform output panel (above the copy)
- [ ] Frontend: show image loading skeleton while image generates
- [ ] Frontend: "Regenerate Image" button per panel to swap the image without regenerating copy
- [ ] Frontend: "Attach to Card" auto-includes the image when saving to Kanban

## v8 Features

### Clean Publishable Copy
- [ ] Fix AI system prompt to produce clean copy with zero internal markup, stage labels, or section headers
- [ ] Remove all non-publishable text from generated output (e.g., "Hook:", "CTA:", "---", "[Image suggestion:]")
- [ ] Ensure generated copy is directly copy-paste ready for each platform

### Push to Buffer (Per Panel)
- [ ] Add "Push to Buffer" button directly on each platform output panel in Creation Studio
- [ ] Button sends the panel's clean copy + attached image URL to Buffer in one click
- [ ] Show success/error toast on the panel after push
- [ ] Disable button with tooltip if Buffer is not configured
- [ ] Auto-update content item status to "scheduled" after successful push

## v9 Features

### Blog Platform for theurbanmonk.com
- [x] Add "blog" to PLATFORMS enum in drizzle schema
- [x] Run db:push after schema update
- [x] Write blog AI prompt: SEO-optimized long-form article, Pedram's voice, bridges science + ancient wisdom
- [x] Blog prompt: outputs title, meta description, slug, focus keyword, full article in clean Markdown
- [x] Blog prompt: structure = intro hook, 4-6 H2 sections with subheadings, conclusion, CTA to Academy
- [x] Blog prompt: no internal markup, labels, or structural markers in output
- [x] Add blog image style: 16:9 hero image, editorial cinematic, warm and dark
- [x] Add blog platform selector button in Creation Studio
- [x] Blog output panel: full-width layout (not 2-col grid)
- [x] Blog panel: SEO metadata row (title, slug, meta description)
- [x] Blog panel: editable article body textarea (Markdown)
- [x] Blog panel: "Copy as Markdown" and "Download .md" export buttons
- [x] Blog panel: featured hero image generation (16:9 wide format)
- [x] Blog panel: Save to Kanban with blog platform tag
- [x] Blog panel: WordPress direct publish placeholder (coming soon)
- [x] TypeScript clean (0 errors), 20/20 tests pass

## Bug Fixes

- [x] Fix Buffer API: rewritten to use new Buffer GraphQL API (https://api.buffer.com)
- [x] New API key from user validated — returns all 8 Urban Monk Productions channels
- [x] Channels confirmed: Facebook (The Urban Monk), Instagram (drpedramshojai), X (PedramShojai), TikTok, YouTube (The Urban Monk), LinkedIn (pedramshojai + 2 others)
- [x] pushToBuffer rewritten to use createPost GraphQL mutation with addToQueue scheduling
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v11 Features

### TikTok Platform + Smart Channel Filtering
- [x] Add "tiktok" to PLATFORMS enum in drizzle schema and run db:push
- [x] Add TikTok AI prompt: short-form vertical video script, hook-first, 60-90 sec, Pedram's voice
- [x] TikTok prompt: outputs hook line, 3-5 talking points, CTA, hashtags, on-screen text suggestions
- [x] Add TikTok platform selector button in Creation Studio (with TikTok icon)
- [x] TikTok output panel: script format with editable body, vertical visual, push to Buffer
- [x] Filter Buffer channels in syndication panel: only show channels matching selected platform
- [x] Platform-to-service mapping: linkedin→linkedin, instagram/facebook→meta, twitter→x, tiktok→tiktok, youtube→youtube
- [x] Show "No channels connected for this platform" message if no matching channels
- [x] TypeScript clean (0 errors), 20/20 tests pass
- [x] Add back button to Research Intelligence page (navigate to Command Center)
- [x] Fix Buffer createPost assets input format — corrected to { images: [{ url }] } object format

## v12 Features

### Auto-Save Generated Content
- [x] Auto-save all generated content to the database immediately when generation completes (no manual Save button needed)
- [x] Each platform's generated text + imageUrl saved as a content item with status "drafting"
- [x] Blog post auto-saved with title, slug, meta description, article body, and hero image URL
- [x] TikTok script auto-saved with platform tag "tiktok"
- [x] Keep manual "Re-save" button for re-saving edited content
- [x] Content archive: all saved items visible in Kanban / Command Center

### Light & Inspirational Theme Redesign
- [x] Replace dark background with warm off-white parchment (oklch 0.98)
- [x] Replace dark card backgrounds with clean white cards
- [x] Primary color changed to warm terracotta/sunrise gold
- [x] Text colors: deep warm charcoal for headings, medium warm gray for body
- [x] Sidebar uses semantic tokens — automatically picks up light theme
- [x] Borders: soft warm gray
- [x] Button styles: warm terracotta primary
- [x] ThemeProvider switched from dark to light
- [x] All hardcoded zinc/gray dark classes replaced with semantic tokens across all pages
- [x] AI image style prompts updated: warm, bright, inspirational (no more dark moody)
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v13 Fixes

- [x] Updated Urban Monk Signature style label: "Warm, bright, inspirational — golden light, sage greens, timeless wellness editorial"
- [x] Updated X/Twitter style label: "Bold & Clean" (removed "stark black" language)
- [x] Updated YouTube style label: "Inspiring Documentary" with golden-hour warmth
- [x] Updated Blog style label: warm editorial hero with golden morning light
- [x] All PLATFORM_STYLE_LABELS in CreationStudio now reflect warm, uplifting aesthetic
- [x] routers.ts image style prompts already updated in v12 — confirmed no dark/moody language remains
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v14 Features

### WordPress Direct Publish
- [ ] Add WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD secrets
- [ ] Add wordpress.ts server module: uploadMedia() and createPost() using WP REST API
- [ ] Add blog.publish tRPC procedure: upload hero image to WP media, create draft post with featured image
- [ ] Add "Publish to WordPress" button in Blog panel (replaces placeholder)
- [ ] Show published post URL and "View on WordPress" link after successful publish
- [ ] Handle errors gracefully (auth failure, duplicate slug, etc.)
- [ ] Write vitest test for WordPress publish procedure

### Kanban Card Image Regeneration
- [ ] Add "Regenerate Image" button to each Kanban card in Command Center
- [ ] Clicking opens a small popover/modal with the current image and a "Regenerate" button
- [ ] Calls ai.generateImage mutation with the card's platform and text content
- [ ] Updates the card's imageUrl in the database after regeneration
- [ ] Show loading spinner during regeneration
- [ ] Write vitest test for image regeneration from Kanban

## v14 Features — Completed

### WordPress Direct Publish
- [x] Create server/wordpress.ts module with uploadMediaFromUrl and createWpPost functions
- [x] Use WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD env vars (pre-configured)
- [x] Add blog.publish tRPC procedure: upload hero image to WP media, create post, update content item status
- [x] Blog panel: real "Save as Draft" and "Publish Live" buttons (replaces placeholder)
- [x] After publish: show "View Post" and "Edit in WP Admin" links
- [x] Disable publish buttons until blog is auto-saved to Kanban
- [x] WordPress credentials verified (authenticated as Pedram Shojai, user ID 13)

### Regenerate Image on Kanban Cards
- [x] Add "Regenerate Image" option to the card dropdown menu (three-dot menu)
- [x] Wire to ai.generateImage mutation with the card's title + platform as prompt
- [x] Show loading spinner overlay on the card while regenerating
- [x] After regeneration: update the card's imageUrl in the database and refresh the Kanban
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v15 Features

### Buffer X/Twitter Account Fix
- [ ] Investigate why X/Twitter account is not appearing in the syndication panel
- [ ] Check the Buffer GraphQL channels query — confirm X channel is returned from API
- [ ] Check the platform-to-service mapping for X (currently maps to "twitter") vs what Buffer returns
- [ ] Fix service name mapping so X account appears in the filtered channel list

### Clean Card Titles
- [ ] Update AI content generation prompt to produce a clean short title (under 60 chars) per platform
- [ ] Update generateBlog to return a clean title (already does — check why cards show "## Urban Monk Content Brief:...")
- [ ] Fix auto-save to use the AI-generated title, not the raw idea text truncated
- [ ] Update content.create to accept and store the AI title separately from rawIdea

### Batch Publish All Approved to WordPress
- [ ] Add "Publish All Approved" button in Command Center header
- [ ] Batch mutation: iterate all items in "approved" status, call blog.publish for blog platform items
- [ ] Show progress toast: "Publishing X of Y..."
- [ ] Move items to "scheduled" or "published" status after batch publish
- [ ] Non-blog items in Approved: show "Mark as Published" dialog instead

### Calendar-to-WordPress Scheduling Sync
- [ ] When a content item is scheduled (scheduledAt set) and platform is "blog", push to WordPress as a scheduled post
- [ ] Use WordPress REST API post status "future" with date field set to scheduledAt timestamp
- [ ] Update content item status to "scheduled" after successful WP scheduling
- [ ] Show "Scheduled in WordPress" badge on calendar cards for synced items

## CRITICAL BUG — Content Not Saving — FIXED

- [x] Diagnosed: textContent WAS being saved (17/18 items have content in DB) — the UI had no detail view
- [x] DB schema confirmed: textContent column exists and is populated
- [x] content.create and content.list procedures confirmed correct
- [x] Built Card Detail Dialog: click any Kanban card to open full post content, edit inline, copy, save
- [x] Dialog shows: hero image, platform badge, status, full editable post body, Copy/Save/Regenerate buttons
- [x] Legacy titles cleaned: 17 items updated from raw AI brief headers to real post opening lines
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v16 Features

### Batch WordPress Publish
- [x] Add blog.publishBatch tRPC procedure: accepts array of content item IDs, publishes each to WordPress as draft
- [x] "Publish All Approved to WordPress" button above Kanban (only visible when Approved column has items)
- [x] Show success/warning toast with count of succeeded and failed items
- [x] After batch: moves all published items to Scheduled status in DB
- [x] Handles partial failures gracefully

### Calendar-to-WordPress Scheduling
- [x] When a blog card is dragged to a calendar day, also creates a "future" scheduled post in WordPress
- [x] When a blog card is scheduled via handleDayClick, also schedules in WordPress
- [x] blog.publish procedure updated to accept scheduledAt param and set WP status to "future"
- [x] WP date set via date_gmt field for accurate UTC scheduling

### Kanban Platform Filter Pills
- [x] Platform filter state added (default: "all")
- [x] Filter pill row above Kanban: All, LinkedIn, Meta, X, YouTube, TikTok, Blog
- [x] Filter pills show total item count per platform
- [x] Filtered view shows only cards matching selected platform
- [x] Active pill highlighted with primary color
- [x] TypeScript clean (0 errors), 20/20 tests pass

## v17 Overnight Build (Apr 9)

### Phase 1: WordPress Post ID Deduplication
- [ ] Add wpPostId (varchar) field to contentItems schema in drizzle/schema.ts
- [ ] Run pnpm db:push to migrate
- [ ] Update blog.publish procedure: if wpPostId exists, PATCH the existing WP post instead of creating new
- [ ] Update blog.publishBatch to use same dedup logic
- [ ] Store returned WP post ID after publish/update

### Phase 2: #urbanmonk Hashtag on All Posts
- [ ] Add #urbanmonk to all PLATFORM_PROMPTS in routers.ts (LinkedIn, Meta, X, YouTube, TikTok)
- [ ] Add #urbanmonk to blog CTA section prompt
- [ ] Ensure it appears at the end of every generated post naturally

### Phase 3: Personas Schema + Intelligence Reports
- [x] Add personas table to drizzle/schema.ts with: id, name, description, painPoints, aspirations, topQuestions (JSON), ctaCopy, landingPageUrl, contentGoal
- [x] Add personaId (FK) to contentItems table
- [x] Run pnpm db:push
- [x] Seed the 8 personas with deep intelligence data:
  - Burnout Recovery Seeker
  - Midlife Vitality Optimizer
  - Spiritual Growth Explorer
  - Stressed Parent Multitasker
  - Holistic Health Student
  - Chronic Condition Navigator
  - Corporate Wellness Advocate
  - Digital Detox Pursuer
- [x] For each persona: write 8-10 deep intelligence questions that drive traction
- [x] For each persona: write CTA copy aligned to Urban Monk Academy offer

### Phase 4: Content Goal Categories
- [x] Add contentGoal enum to schema: audience_growth | llm_seo | community_engagement
- [x] Run pnpm db:push
- [x] Add contentGoal to content.create and content.update procedures
- [x] Add goal category selector in Creation Studio (Audience Growth / LLM SEO / Community)
- [x] Add goal category filter pills to Command Center Kanban

### Phase 5: Persona Intelligence View in Command Center
- [x] Add "Personas" tab/section to Command Center (or new sidebar page)
- [x] Persona grid: 8 cards, each showing name, description, top pain points
- [x] Persona detail panel: deep-dive intelligence report, top 10 questions, CTA copy, landing page URL
- [x] Content by persona: show all content items tagged to this persona
- [x] Persona assignment: dropdown on each Kanban card to assign a persona
- [x] Auto-suggest persona based on content text (LLM classification)

### Phase 6: Social Strategy Rebalance
- [ ] Update Creation Studio goal selector to reflect balanced strategy:
  - Audience Growth (community building, relationship, The Holistic Psychologist model)
  - LLM SEO (answer-engine optimization, search query targeting)
  - Community Engagement (comments, shares, conversation starters)
- [ ] Update AI prompts to weight Audience Growth posts differently from LLM SEO posts
- [ ] Audience Growth posts: conversational, story-driven, community-first, not robotic
- [ ] LLM SEO posts: answer-format, authoritative, structured for AI indexing
- [ ] Community posts: question-led, engagement hooks, reply bait

### Phase 7: TikTok Panel Fix
- [ ] Verify TikTok platform selector works in Creation Studio
- [ ] Test generating a TikTok script end-to-end
- [ ] Confirm TikTok cards appear in Kanban with TikTok filter pill

- [x] TypeScript clean (0 errors), 20/20 tests pass
- [x] Fix Buffer X/Twitter routing bug: X posts showing up as TikTok in Buffer queue — root cause: handleSyndicate was sending selectedProfileIds without filtering by target platform; fixed to cross-reference bufferProfiles service field against PLATFORM_SERVICE_MAP before sending

### Phase 6: Strategy Analysis + Platform Enhancements (April 8, 2026)
- [x] Deep Gumshoe data analysis — 80 queries, 5027 competitor mentions, 9 topic clusters, 8 persona gap map
- [x] Comprehensive blended strategy document: Holistic Psychologist playbook + video-first architecture + LLM crawl infrastructure + 24-month roadmap
- [x] Competitor Intelligence tab in Research Intelligence — tier overview, why AI recommends each, weakness, displacement angle
- [x] Video Pipeline tab in Research Intelligence — 20 priority videos with status tracking, production workflow notes

## v10 Features (April 9, 2026)

### Script Library Module
- [x] Add scripts table to drizzle/schema.ts: id, title, scriptType (video|carousel|blog|email), platform, personaId (FK), contentGoal, productionStatus (idea|scripted|in_production|in_edit|ready_to_post|published), scriptBody (text), notes, thumbnailUrl, linkedContentItemId, createdAt, updatedAt
- [x] Run pnpm db:push
- [x] Add scripts.list, scripts.get, scripts.create, scripts.update, scripts.delete tRPC procedures
- [x] Add scripts.updateStatus procedure
- [x] New sidebar nav item: "Script Library" with film icon
- [x] Script Library page: Kanban-style columns — Idea | Scripted | In Production | In Edit | Ready to Post | Published
- [x] Script cards: title, type badge, platform badge, persona badge, notes preview
- [x] Script detail panel: full script body editor, notes, status dropdown, linked content item
- [x] "New Script" button: type selector, platform, persona, content goal, title, body
- [x] Seed 20 video scripts from Video Pipeline priority list
- [x] Seed 20 Instagram carousel outlines from Reframe Post library

### Asset Library Overhaul
- [x] Rebuild Asset Library to show ALL asset types: images (from generated_images), scripts (from scripts table), content items (from content_items), blog posts
- [x] Asset type filter tabs: All | Images | Videos/Scripts | Carousels | Blog Posts
- [x] Status filter: All | Draft | Approved | Scheduled | Published
- [x] Platform filter: All | LinkedIn | Meta | X | YouTube | TikTok | Blog
- [x] Each asset card shows: thumbnail/icon, title, type badge, platform badge, status badge, created date
- [x] Click to expand: full content preview, edit link, Buffer push button for applicable assets
- [x] Auto-archive: every content item saved from Creation Studio appears in Asset Library automatically
- [x] Every generated image appears in Asset Library with its linked content item

### Buffer Push on Kanban Cards
- [x] Add "Push to Buffer" button on each Kanban card (visible on hover or in card dropdown menu)
- [x] On click: auto-selects the correct Buffer channel for the card's platform
- [x] One-click push to the correct Buffer channel from the Kanban card
- [x] Show success/error toast after push
- [x] Platform filtering fixed: handleSyndicate now cross-references bufferProfiles service field

### Burnout Recovery Definitive Guide
- [x] Write 3,000+ word SEO blog post: "The East-West Approach to Burnout Recovery"
- [x] Include 5+ research citations (PubMed/peer-reviewed)
- [x] Full FAQ section answering top 10 Gumshoe gap queries for Burnout Recovery Seeker persona
- [x] Published to theurbanmonk.com via WordPress REST API — Post ID 9574, status: draft, edit at /wp-admin/post.php?post=9574&action=edit
- [ ] Store as a Script Library entry (type: blog) with status: published (manual step)

### Instagram Reframe Post Carousel Library
- [x] Generate 20 carousel outlines (10 slides each) for the Reframe Post series
- [x] Start with: "Your 2 AM wake-up isn't insomnia — it's your liver talking"
- [x] Start with: "Eastern medicine knew about leaky gut 3,000 years before Western science named it"
- [x] Each carousel: hook slide, 7 content slides, CTA slide, cover caption
- [x] Stored all 20 in Script Library via seedCarousels procedure — click "Seed Carousels" in Script Library to populate

## v11 Features (April 9, 2026)

### Script Library Redesign
- [x] Fix dark theme bug — Script Library rewritten with CSS variables (bg-background, bg-card, text-foreground, border-border, bg-primary)
- [x] Reorganize layout: platform bucket tabs at top (All | YouTube | Meta | LinkedIn | X) with platform brand colors
- [x] Within each platform tab: show Kanban columns (Idea → Scripted → In Production → In Edit → Ready to Post → Published)
- [x] YouTube tab shows 20 long-form video scripts; Meta tab shows carousels + HP-style scripts
- [x] Seed Holistic Psychologist-style Instagram carousel scripts — 20 scripts in Nicole LePera format (reframe posts, nervous system, self-healing, inner child, Taoist wisdom layer)
  - Full 10-slide scripts written for top 2 (nervous system survival mode, childhood love patterns)
  - Outlines + competitor angles + notes for all 20
- [x] Add seedLinkedIn procedure — 10 thought-leadership scripts for LinkedIn
- [x] Add seedX procedure — 10 thread scripts for X
- [x] All 80 scripts seeded via "Seed All" button or individual platform buttons in empty state
- [x] Production workflow: advance status with one click (Idea → Scripted → In Production → In Edit → Ready to Post → Published)
- [x] All 20/20 tests passing, TypeScript clean (0 errors)

## v12 Features (April 9, 2026)

### Script Library ↔ Asset Library Integration
- [x] Add `linkedContentItemId` back-link: already exists on scripts table (links script → content item)
- [x] Add `linkedScriptId` column to content_items table (links content item → script)
- [x] Run pnpm db:push — migration 0009_oval_meltdown.sql applied successfully
- [x] In scriptsRouter.updateStatus: when status transitions TO "ready_to_post", auto-create a content_item with title, platform, textContent (scriptBody), personaId, contentGoal, status="approved", and set linkedScriptId on the new item + linkedContentItemId on the script
- [x] Idempotent: if script already has a linkedContentItemId, skip creation
- [x] Asset Library: show "From Script" badge (emerald) on content items with linkedScriptId set
- [x] Script Library: show "Asset Created" badge (emerald) on cards with linkedContentItemId set
- [x] Script Library card: "View in Kanban" button when linkedContentItemId is set
- [x] Write vitest tests for the auto-create logic — 8 new tests, all passing (28/28 total)

## v13 Features (April 9, 2026)

### Bidirectional Script ↔ Kanban Navigation
- [x] Add "View Script" button to Kanban DraggableCard — visible on hover when card has linkedScriptId set (violet styling to distinguish from amber Buffer button)
- [x] Button navigates to /script-library?scriptId=N using wouter setLocation
- [x] Script Library reads scriptId from URL params on mount and on location change
- [x] Auto-switches to the correct platform tab for the target script
- [x] Auto-expands the target script card and scrolls it into view
- [x] Highlighted card shows violet ring + pulse animation for 5 seconds then clears
- [x] All 28/28 tests passing, TypeScript clean (0 real errors)

## v14 Features (April 9, 2026)

### Script Library Enhancements (All Three)
- [x] Add "Source Script" section to Kanban card detail dialog — violet banner with Film icon, shows Script #N, "View Script" button navigates to Script Library and highlights the script; only visible when linkedScriptId is set
- [x] Add bulk "Mark as In Production" button to Script Library platform tab headers — amber styling, only appears when Scripted column has items, shows count badge, confirm dialog, advances all scripted scripts for the current platform filter
- [x] Add "Export as DOCX" teleprompter button to each script card — violet styling, downloads title_teleprompter.docx; format: Georgia title, Calibri 14pt body, double-spaced (480 line height), 1-inch margins, platform/type/duration metadata header; uses docx v9.6.1 via dynamic import
- [x] All 28/28 tests passing, TypeScript clean (0 real errors)

## v15 Features (April 9, 2026)

### Script Library Enhancements (Next Three)
- [x] Add "Preview Post" toggle in ScriptCard expanded view — strips stage directions/slide labels/markup, shows clean formatted post text, character count vs platform limit (green/red), toggle between raw and preview
- [x] Add DOCX export button to the Edit Script dialog footer — exports the current edited version of the script body (violet styling, only shown when editing an existing script with content)
- [x] Add "Export [Platform] ZIP" button to Script Library header — dynamically labeled by active platform tab, downloads all scripts with content as a ZIP of DOCX files, numbered by priority, uses jszip + docx client-side
- [x] All 28/28 tests passing, TypeScript clean (0 real errors)

## v16 Features (April 9, 2026)

### Landing Page Generator (Gamma API Integration)
- [x] Add `landing_pages` table to schema (id, title, avatarId, offer, copyBody, gammaUrl, gammaGenerationId, status, createdAt)
- [x] Run `pnpm db:push` to migrate schema
- [x] Store GAMMA_API_KEY as secret
- [x] Add `landingPages` tRPC router with: `generateCopy` (LLM), `publishToGamma` (Gamma API POST + poll), `list`, `delete`
- [x] Build `LandingPageGenerator.tsx` page: avatar picker (8 personas), offer selector (Academy $297/yr, Retreat $1200, Supplements), content angle input, AI copy generation panel (preview before publish), "Publish to Gamma" button (manual trigger only), results panel with Gamma URL
- [x] Add `/landing-pages` route in App.tsx
- [x] Add "Landing Pages" nav link in all page sidebars
- [x] All tests still passing, TypeScript clean (42/42 tests pass, 0 TS errors)

## v16.1 Features (April 9, 2026)

### Landing Page Generator Improvements
- [x] Wire Urban Monk Gamma theme ID (4v2cznur3cs7d35) into publishToGamma API call
- [x] Add generateVariant tRPC procedure (rewrites copy with different hook angle)
- [x] Add "Generate A/B Variant" button in preview panel with angle selector (fear-based, aspiration-based, authority-based, curiosity-based)
- [x] Add "Create Supporting Content" deep-link button from landing page preview → Creation Studio with persona + offer pre-filled
- [x] Add same deep-link on history cards
- [x] All tests passing, TypeScript clean (46/46 tests pass, 0 TS errors)

## v16.2 Features (April 9, 2026)

### Landing Page Generator — UTM Builder + Variant Comparison
- [x] UTM parameter builder panel in preview sidebar (source, medium, campaign, content fields; auto-generates tagged URL; copy button per link)
- [x] Pre-populated UTM presets for common channels (Instagram Reel, LinkedIn Post, YouTube Description, Email Newsletter, TikTok Bio)
- [x] Side-by-side variant comparison view in history (select 2 pages, diff the copy word-by-word with color highlights)
- [x] "Compare" button on history cards; comparison panel shows metadata diff (persona, offer, angle) + copy diff
- [x] All tests passing, TypeScript clean (54/54 tests pass, 0 TS errors)

## v17 Features — YouTube Competitive Intelligence (April 9, 2026)
- [x] Store SUPADATA_API_KEY as secret
- [x] Install @supadata/js npm package
- [x] Add youtubeRouter.ts with searchSimilar, fetchTranscript, analyzeCompetitors tRPC procedures
- [x] Wire youtubeRouter into main appRouter
- [x] Build YouTube Competitive Intelligence panel in CreationStudio (collapsible, below idea input)
- [x] Write Vitest tests for youtubeRouter
- [x] TypeScript clean, all tests pass (64/64)

## v18 Features — YouTube CI Enhancements (April 9, 2026)
- [x] Add summarizeVideo tRPC procedure to youtubeRouter
- [ ] Add "Summarize This Video" button per competitor card in CreationStudio
- [ ] Add saveToScript tRPC procedure (creates Script Library entry from brief)
- [ ] Add "Save to Script Library" button in differentiation brief panel
- [ ] Add competitor_channels DB table (channelId, channelName, thumbnail, trackedAt)
- [ ] Run pnpm db:push for competitor_channels migration
- [ ] Add trackChannel, listTracked, untrackChannel, getChannelNewUploads procedures to youtubeRouter
- [ ] Build Competitor Channel Watchlist page/panel with track/untrack UI and latest uploads
- [ ] Add weekly digest for tracked channel new uploads
- [ ] Write Vitest tests for new procedures
- [ ] TypeScript clean, all tests pass

## v19 Features — Typeform Audience Intelligence (April 9, 2026)
- [ ] Store TYPEFORM_API_KEY as secret
- [ ] Add typeformRouter.ts with listForms, getResponses, analyzeAudience, enrichPersona procedures
- [ ] Wire typeformRouter into main appRouter
- [ ] Build Typeform Audience Intelligence page: form selector, response viewer, AI pain point analysis
- [ ] Add "Enrich Persona" button that appends Typeform insights to a persona profile
- [ ] Write Vitest tests for typeformRouter
- [ ] TypeScript clean, all tests pass

## v20 Features — Typeform Deep Integration

- [x] Add segmentByPersona tRPC procedure — maps Typeform responses to 8 Urban Monk personas, stores enriched pain points per persona in DB
- [ ] Run Gut Microbiome segmentation analysis (m6EyBDzz, 2416 responses) mapped to all 8 personas
- [ ] Add "Generate Landing Page" button in TypeformIntelligence results → pre-fills LandingPageGenerator via URL state
- [ ] Inject persona Typeform pain points into every LLM call in Creation Studio (generateContent) and Landing Page Generator (generateCopy)
- [ ] Add Typeform insights badge/panel on persona profiles in Strategy Brain
- [ ] All tests passing, TypeScript clean

## v20 Features — Typeform Deep Integration

- [x] Add segmentByPersona tRPC procedure
- [ ] Run Gut Microbiome segmentation (m6EyBDzz, 2416 responses) mapped to 8 personas
- [ ] Add Generate Landing Page button in TypeformIntelligence
- [ ] Inject persona Typeform pain points into Creation Studio and Landing Page Generator LLM calls
- [ ] Add Typeform insights badge on persona profiles
- [ ] All tests passing, TypeScript clean

## v21 Features — Enrichment Badges & Segment Comparison

- [x] Add `getEnrichmentSummary` tRPC query returning pain point count per persona
- [x] Add enrichment badge to Creation Studio persona selector ("Enriched with X pain points")
- [x] Add segment comparison view in Typeform Intelligence (run 2 forms, side-by-side diff)
- [x] Run tests, TypeScript clean, save checkpoint

## v22 Features — Press Intelligence & SEO/LLM Credibility
- [ ] Add `press_hits` DB table (id, outlet, medium, description, impressions, date, url, topicTags, authorityTier)
- [ ] Seed DB with all ~130 press hits from both CSVs (parsed and normalized)
- [ ] Build pressRouter: list, getByTopic, getAuthoritySignals, generateSEOSnippet, generateLLMBio
- [ ] Build Press Intelligence page (/press): coverage browser, authority dashboard, topic clusters, SEO snippet generator
- [ ] Wire press authority signals into Creation Studio LLM prompts (as-seen-in credibility block)
- [ ] Wire press authority signals into Landing Page Generator LLM prompts
- [ ] Run tests, TypeScript clean, save checkpoint

## v24 — Real Offer Catalog Update (April 9, 2026)
- [ ] Replace placeholder OFFERS with 9 real Urban Monk offers + correct URLs in LandingPageGenerator.tsx
- [ ] Replace placeholder OFFERS in server/landingPagesRouter.ts (LLM prompts)
- [ ] Update personasRouter.ts CTA copy to reference real offer names
- [ ] Update scriptsRouter.ts script ideas that reference old Academy $297/year placeholder
- [ ] Update server/routers.ts system prompts to reference real offer names and URLs
- [ ] Run tests, TypeScript check, save checkpoint

## v14 Features

### Research Intelligence — YouTube Asset Generation
- [x] Add generateTeleprompterScript tRPC mutation (research router) — full 8-12 min teleprompter script in Pedram's voice
- [x] Add generatePostAndImage tRPC mutation (research router) — social post caption + AI image generation prompt
- [x] Add TeleprompterScriptModal component with copy, save-to-library, and loading states
- [x] Add PostAndImageModal component with separate caption + image prompt sections, copy buttons, and save-to-library
- [x] Add CopyButton reusable component
- [x] Add Script (purple) + Post (blue) buttons to each Gap Dashboard card
- [x] Add Script (purple) + Post (blue) buttons to each Video Pipeline card
- [x] Both modals open immediately with loading spinner, content populates when AI responds
- [x] "Save to Script Library" saves to scripts table with correct scriptType/platform/status

## v15 Features — Media Authority Engine

### Database Schema
- [x] Add media_assets table (type: book/podcast/film/youtube/interview, title, url, description, topicTags, publishedYear, platform, episodeNumber, duration, credibilitySignal)
- [x] Run db:push after schema changes
- [x] Seed media_assets with Pedram's full catalog: 8 books, podcast episodes, films, YouTube videos, key interviews

### Backend — Media Authority Context Injector
- [x] Add mediaRouter with list, getByTopic, getAuthorityContext procedures
- [x] Build getMediaContextBlock(topic) — returns 3-5 relevant media references for a given topic
- [x] Upgrade generateContent prompt injection to include media references (not just press hits)
- [x] Upgrade generateTeleprompterScript to inject relevant book/episode references
- [x] Upgrade generatePostAndImage to inject media references into caption generation
- [x] Upgrade generateBriefFromGap to inject media references
- [x] Upgrade blog generation to inject media references
- [x] Upgrade landing page generation to inject media references

### Frontend — Media Vault UI
- [x] New "Media Vault" sidebar nav item
- [x] Browsable catalog: Books, Podcasts, Films, YouTube, Interviews tabs
- [x] Search and filter by topic tag
- [x] Each card shows: title, type badge, topic tags, credibility signal, link
- [x] "Inject into next generation" toggle per asset
- [x] Authority stats: total assets, total reach estimate, topic coverage map

## v16 Features — Full Press Import from CSVs

- [x] Import all press hits from FOCUSWrapUpTracker.xlsx-MediaCoverage.csv (42 rows, FOCUS book campaign 2020-2021)
- [x] Import all press hits from PedramShojaiPressCoverageTo-Date.xlsx-Sheet1.csv (109 rows, 2015-2018 full career)
- [x] Deduplicate against existing 115 DB entries, add 22 net-new records
- [x] Total press_hits now 137: 50 S-tier, 41 A-tier, 46 B-tier
- [x] Total combined impressions: 892M+ across CNN, NYT, Good Housekeeping, Huffington Post, POPSUGAR, Inc., Dr. Oz, The Doctors, Bulletproof, Dr. Mark Hyman, and 120+ more outlets
- [x] Fix YouTube channel URL to @urbanmonkproductions with accurate 33.3K subscribers / 604 videos

## v17 Features — Blog Post Publication-Ready Fix

- [x] Increase blog article target length from 800-1200 to 1400-1800 words with explicit section structure
- [x] Fix BLOG_PROMPT to enforce clean Markdown with no raw JSON artifacts or markup labels
- [x] Always generate hero image by default (generateImage: true already wired in UI)
- [x] Replace raw Textarea article body with rendered Markdown preview (Streamdown prose-styled)
- [x] Add toggle between "Preview" (rendered) and "Edit" (raw Markdown) modes
- [x] Add word count and read time display on the blog output card
- [x] Full-bleed hero image with gradient overlay displayed prominently above article preview
- [x] Add @source streamdown directive to index.css for proper Markdown styling
- [x] Add blog-prose CSS class with h2/h3/p/blockquote/a/ul/li styling

## v18 Features — Avatar Intelligence Engine

### Source Documents
- [x] Ingest manus_avatar_pain_points.md (754 lines, avatar pain points from discovery call analysis)
- [x] Ingest sales_team_training_document.md (797 lines, Josh Lyons sales mastery training)

### Database Schema
- [ ] Add avatar_pain_points table (stage, category, title, description, emotionalHook, contentTopics, headlineFormula)
- [ ] Add avatar_personas table (name, profile, communicationStyle, contentNeeds, salesApproach)
- [ ] Add avatar_messaging_frameworks table (name, structure, example, useCase)
- [ ] Add avatar_objections table (objection, underlyingFear, responseFramework, contentExample)
- [ ] Run db:push after schema changes
- [ ] Seed all tables from both documents

### Backend — Avatar Context Injector
- [ ] Add avatarRouter with list, getByStage, getContextBlock procedures
- [ ] Build getAvatarContextBlock(topic, journeyStage) — returns relevant pain points + persona + messaging framework
- [ ] Upgrade generateContent to inject avatar intelligence (pain point + persona + emotional hook)
- [ ] Upgrade generateTeleprompterScript to inject avatar pain points and journey stage
- [ ] Upgrade generateBlog to inject avatar messaging framework
- [ ] Upgrade generatePostAndImage to inject avatar emotional hooks and headline formulas
- [ ] Upgrade landing page generation to inject avatar objections and transformation messaging

### Frontend — Avatar Intelligence UI
- [ ] New "Avatar Intel" sidebar nav item
- [ ] Pain Point Journey Map — visual 4-stage journey (Surface → Maze → Deep Pain → Root Cause)
- [ ] Buyer Persona cards (The Researcher, Desperate Seeker, Skeptical Executive, Holistic Believer)
- [ ] Messaging Framework library (Validation, Differentiation, Urgency, Transformation, Authority)
- [ ] Objection Handler — browse all objections with response frameworks
- [ ] "Generate content for this persona" button on each persona card
- [ ] Headline Formula generator — pick a formula, enter a topic, get 5 headline options

## v19 Features — X Character Limit Fix, Verbatim Pain Points, Persona Selector (April 10, 2026)

- [x] Fix X/Twitter 280-char enforcement: strengthen prompt with explicit counting instruction and hard rules
- [x] Add server-side hard truncation for X posts (slice at 277 chars + "...") in generateContent return
- [x] Add hard truncation in Buffer push function before API call (platform-aware)
- [x] Pass platform parameter to syndication.push tRPC procedure and Buffer push function
- [x] Add X character counter UI below the X output textarea (green ≤240 / yellow 241-270 / red 271-280)
- [x] Seed 26 verbatim pain point entries from avatar pain points + sales training documents
- [x] Total pain points in DB: 38 (9 surface, 12 deep pain, 6 practitioner maze, 6 root cause, 5 objections)
- [x] Persona selector already fully wired in Creation Studio (confirmed: state, query, mutation params in place)
- [x] 4 buyer personas in DB: The Researcher, The Desperate Seeker, The Skeptical Executive, The Holistic Believer

## v20 Features — Script Library Copy Button (April 10, 2026)

- [x] Add "Copy Full Script" button to each script card in the Script Library (copies entire scriptBody to clipboard in one click, ready to paste into teleprompter app)

## v21 Features — Intelligence Audit Fixes (April 9, 2026)

- [ ] Fix generateBriefFromGap to inject avatar + press + media context (currently uses static prompt only)
- [ ] Fix getAvatarContextBlock to pick the most relevant persona based on topic (not always persona[0])
- [ ] Add Gumshoe gap query text injection into generateContent when called from Research Intelligence
- [ ] Update IntelligenceDashboard to show all 5 intelligence sources with live counts and injection status (media_assets, avatar_pain_points currently missing)
- [ ] Fix IntelligenceDashboard to show media vault stats and avatar intelligence stats

## v22 Features — Generate from Gap (Research → Creation Studio, April 9, 2026)

- [ ] Add "Generate from Gap" button to each gap card on the Research page
- [ ] Navigate to Creation Studio with gap query pre-filled as topic via URL params (?gap=...&persona=...&tags=...)
- [ ] Add "From Research Gap" panel in Creation Studio showing top 5 unanswered gap queries
- [ ] Allow user to pick a gap from the panel to instantly pre-fill topic + persona + platform
- [ ] Show gap source metadata (competitor brands, topic tags) in the pre-fill UI

## v23 Features — X Post Fix + Persona-Wired Landing Page Generator (April 10, 2026)

### X Post Generation Fix
- [x] Rewrite X platform system prompt: target 200-220 chars, write SHORT from start (not truncate from long)
- [x] Add concrete good/bad examples to X prompt to prevent LLM from writing truncated posts
- [x] Remove enforceXLimit truncation function from generateContent — replaced with validateXLength (logs warning, never mutates)
- [x] Fix second X generation path (Research page social post generator) with same complete-thought instruction
- [x] Fix Buffer push to reject over-limit X posts with clear error message instead of silently truncating
- [x] Update X character counter UI: remove "Buffer will auto-truncate" message, replace with "edit to shorten before publishing"

### Persona Selector → Landing Page Generator
- [x] Add getAvatarContextBlockForPersona() to avatarRouter — persona-matched variant with ALL objections + full response frameworks
- [x] Upgrade buildCopyPrompt() to accept avatarContextBlock parameter and inject it between offer description and structure
- [x] Add CRITICAL INSTRUCTIONS FOR OBJECTION HANDLING section to landing page system prompt
- [x] Inject avatar context block into generateCopy procedure (calls getAvatarContextBlockForPersona with topic + persona name)
- [x] Update landing page structure instructions to reference Avatar Intelligence data in each section
- [x] Add transformation language rules to landing page voice guidelines

## v28 Features — LePera Channel Growth Model

- [x] Topical CTA library — ctaBlocks table in DB with full CRUD
- [x] Strategy Brain CTA Library tab — view/edit/add CTAs by topic
- [x] Lights On as default CTA for all content (fallback when no topic match)
- [x] Topic-specific CTAs: Sleep, Gut Health, Detox, Stress/Energy, Ancient Wisdom, Mindfulness, Performance
- [x] CTA auto-injection into generateContent (social posts)
- [x] CTA auto-injection into generateBlog
- [x] CTA auto-injection into generateTeleprompterScript
- [x] CTA auto-injection into generatePostAndImage
- [x] Reframe Post content type added to ai router (generateReframePost procedure)
- [x] Reframe Post UI in Creation Studio — 10-slide carousel with caption
- [x] Common Belief input for Reframe Post mode
- [x] growthRouter — contentPillars and enrollmentWindows CRUD + seed
- [x] Weekly Cadence Tracker in Command Center — 4 pillars with day labels
- [x] Enrollment Window countdown in Command Center (amber warning at 42 days)
- [x] Seed defaults button for pillars and windows
- [x] Two enrollment windows seeded: Fall (Sep 1) and New Year (Jan 1)

## v29 — Evergreen Enrollment

- [x] Remove enrollment windows table from growthRouter
- [x] Remove enrollment window countdown from Command Center cadence tracker
- [x] Replace with evergreen "Lights On — Always Open" indicator in cadence tracker

## v30 — Buffer Meta Post Type Fix + Carousel UI

- [x] Fix Buffer push: add metadata.facebook.type and metadata.instagram.type to createPost mutation
- [x] Pass postType through router input (syndication.push) to pushToBuffer
- [x] Update pushToBuffer to accept channelService map and inject correct metadata per channel
- [x] Add "Post Type" dropdown in Creation Studio meta card (post / story / reel)
- [x] Show carousel note in meta card when postType = carousel (manual upload required)

## v31 — Meta Buffer Push Clarity
- [x] Remove "Reel" option from Meta post type dropdown (video must be manual)
- [x] Rename selector to "Meta Format" with clearer labels
- [x] Add note that video/reels must be uploaded manually from Descript
- [x] Clarify carousel note: select "Post" + add multiple images in Buffer

## v32 — Webinar Funnel Builder
- [x] Add webinar_sessions table to schema (topic, cta, personaIds, targetLength, outline, registrationUrl, status, landingPageCopy, thankYouPageCopy, thankYouWistiaId, thankYouTypeformUrl, kajabiExport, gammaUrl, gammaGenerationId)
- [x] Add webinarRouter.ts with: create, list, get, update, generateOutline, generateLandingCopy, publishToGamma, pollGamma, generateThankYouCopy, exportKajabiPlan procedures
- [x] Build WebinarBuilder.tsx: 4-step wizard (Setup → Outline → Landing Page → Thank You + Kajabi)
- [x] Step 1: topic, CTA, Zoom link, multi-persona selector (checkboxes), target length
- [x] Step 2: AI outline generation with hook script + full outline
- [x] Step 3: Landing page copy generation + Gamma publish button + polling
- [x] Step 4: Thank you page builder (Wistia ID, Typeform URL) + Kajabi automation export panel
- [x] Add "Create Webinar" to DashboardLayout sidebar nav with Video icon
- [x] Register /webinar route in App.tsx
- [x] Add vitest for webinarRouter (10 tests, all passing)

## v33 — Gamma Polling Fix + Typeform Survey Builder
- [x] Fix Gamma polling in WebinarBuilder: replace (trpc as any).pollGamma.query() with useUtils().fetch() + setInterval + useEffect pattern
- [x] Add generateSurveyQuestions procedure to webinarRouter (AI generates 8-10 pain-point questions based on topic/personas)
- [x] Add pushToTypeform procedure to webinarRouter (creates Typeform via API, returns live URL)
- [x] Add Typeform Survey Builder panel to Step 4 of WebinarBuilder: AI questions → review/edit → Push to Typeform → URL returned
- [x] Store typeformUrl in webinar_sessions after push

## v34 — Navigation & Contrast Cleanup
- [x] Wrap AvatarIntelligence in DashboardLayout (currently standalone, no nav)
- [x] Wrap MediaVault in DashboardLayout (currently standalone, no nav)
- [x] Wrap ScriptLibrary in DashboardLayout (currently standalone, no nav)
- [x] Wrap ResearchIntelligence in DashboardLayout (currently standalone, only has back-to-home arrow)
- [x] Fix LandingPageGenerator: remove duplicate custom sidebar, wrap in DashboardLayout
- [x] Fix MediaVault contrast: text-stone-400/500 → text-stone-600/700
- [x] Fix ScriptLibrary contrast: text-stone-400/500 → text-stone-600/700
- [x] Fix LandingPageGenerator contrast: OKLCH text values bumped to higher contrast
- [x] Fix AvatarIntelligence contrast: text-stone-400/500 → text-stone-600/700
- [x] Improved --muted-foreground CSS variable from oklch(0.5) to oklch(0.42) globally
- [x] Fixed text-gray-400/500 → text-gray-600/700 in ResearchIntelligence, WebinarBuilder, CreationStudio, Home

## v35 — Webinar Topic Column Fix
- [x] Change webinar_sessions.topic from varchar(512) to text (supports full paragraph descriptions)
- [x] Run db:push migration (0024_clear_scarlet_witch.sql applied)

## v36 — Typeform Push Fix
- [x] Add type sanitizer to pushToTypeform: maps unknown AI-generated field types to long_text
- [x] Strip unsupported fields from Typeform payload before sending

## v37 — Gamma Theme Fix (Broken Logo)
- [x] Replace invalid Gamma theme ID "4v2cznur3cs7d35" with valid "creme" theme in landingPagesRouter.ts
- [x] Replace invalid Gamma theme ID "4v2cznur3cs7d35" with valid "creme" theme in webinarRouter.ts
- [x] Update landingPages.test.ts to expect "creme" instead of the old invalid theme ID

## v38 — Thank You Page Gamma Publish
- [ ] Add publishThankYouToGamma procedure to webinarRouter (same pattern as publishToGamma)
- [ ] Add pollThankYouGamma procedure to webinarRouter
- [ ] Store thankYouGammaUrl and thankYouGammaGenerationId in webinar_sessions
- [ ] Add "Publish to Gamma" button in Step 4 after thank you copy is generated
- [ ] Add Gamma polling UI to Step 4 (same spinner + URL display as Step 3)

## Webinar Date/Time Fields
- [x] Add webinarDate, webinarTime, webinarTimezone columns to webinar_sessions DB schema
- [x] Update webinarRouter create/update procedures to accept date/time/timezone
- [x] Add date, time, timezone inputs to WebinarBuilder Step 1 UI
- [x] Wire date/time/timezone into generateOutline prompt
- [ ] Wire date/time/timezone into generateLandingCopy prompt
- [x] Wire date/time/timezone into generateThankYouCopy prompt
- [ ] Wire date/time/timezone into exportKajabiPlan prompt (email timing/urgency)

## Wistia + Typeform Thank You Page Fix
- [x] Add thankYouWistiaEmbed (text) column to webinar_sessions schema — stores full embed code
- [x] Run db:push for new column
- [x] Replace Wistia ID input with full embed code textarea in Step 4 UI
- [x] Update generateThankYouCopy procedure: accept wistiaEmbed, use [WISTIA_EMBED] placeholder, inject real HTML after AI generation
- [x] Update generateThankYouCopy procedure: accept typeformUrl, inject as clickable markdown button [Take the Survey →](url)
- [x] Auto-populate Typeform URL from pushedTypeformUrl (survey builder) if available

## Intelligence Pipeline Fixes (v41)
- [x] Add press authority context to generateBlog procedure (currently missing)
- [x] Add gapQueryText injection to generateContent (social media) procedure
- [x] Add press authority context to scriptsRouter generateScript procedure
- [x] Add avatar intelligence context to scriptsRouter generateScript procedure
- [x] Fix $297 price reference in scriptsRouter system prompt to $369/yr
- [x] Fix Lights On URL in scriptsRouter to correct webinar URL

## Webinar Intelligence Module (v42)
- [x] Add webinar_intelligence table to schema (webinarSessionId, surveyType: pre|post, rawResponses JSON, extractedThemes JSON, extractedPainPoints JSON, extractedMotivations JSON, extractedLanguage JSON, aiSummary text, importedAt)
- [x] Run db:push for new table
- [x] Build webinarIntelligenceRouter: importResponses (paste JSON or CSV), extractIntelligence (AI analysis), getBySession, getAggregated
- [x] AI extraction: themes, pain points, motivations, exact language/phrases, questions asked
- [x] Build WebinarIntelligence.tsx page: session selector, import panel (paste responses), AI extraction trigger, intelligence view
- [x] Add "Webinar Intelligence" to sidebar navigation
- [x] Wire webinar intelligence into generateContent LLM prompt (alongside avatar/press/research)
- [x] Wire webinar intelligence into generateBlog LLM prompt
- [x] Wire webinar intelligence into scriptsRouter generateScript LLM prompt
- [x] Update Intelligence Hub dashboard to show Webinar Intelligence stats (sessions analyzed, total responses, top themes)
- [x] Write vitest tests for webinarIntelligenceRouter

## SEO/AEO Blog Pipeline — GhostLink OS Implementation (v44)
- [x] Ingest and study all 11 SEO documents (B1, B2, B3, B5, B6, B7, B8, B11, B15 + others)
- [x] Audit existing WordPress publish pipeline against GhostLink OS requirements
- [x] Upgrade BLOG_PROMPT: H1=primary keyword, PAA-style H2s, TL;DR box, FAQ section, named framework, E-E-A-T signals, internal/outbound links, semantic keywords, hook family, emotional driver, waterfall map
- [x] Add semanticKeywords, hookFamily, emotionalDriver, faqSection, waterfallMap to generateBlog return type
- [x] Rewrite wordpress.ts: Yoast SEO fields (focusKeyword, seoTitle, canonicalUrl), Article JSON-LD schema builder, FAQ JSON-LD schema builder, image alt text on upload
- [x] Update blog.publish procedure: accept all new SEO fields, build Article + FAQ schemas, inject as JSON-LD in post content, set Yoast meta fields
- [x] Update CreationStudio: capture all new SEO fields from generateBlog, pass all to publishToWP
- [x] Add SEO & AEO Intelligence review panel to blog output UI (meta description char count, focus keyword + semantic variants, hook family, emotional driver, FAQ preview, waterfall map, schema status badges)

## LLM Projects Module (v45)
- [ ] Add llm_projects table (id, name, description, topicCluster, status: active|archived, createdAt)
- [ ] Add llm_assets table (id, projectId, assetType: faq|youtube|blog|social|email, title, question, targetKeyword, priority: high|medium|low, status: queued|in_progress|produced|published, contentItemId FK, notes, createdAt)
- [ ] Run db:push for new tables
- [ ] Build llmProjectsRouter: createProject, listProjects, updateProject, archiveProject, addAsset, listAssets, updateAssetStatus, bulkAddAssets (AI-generated queue from topic)
- [ ] AI queue generator: given a topic cluster, generate a full prioritized queue of 20-30 FAQ articles, YouTube video ideas, blog posts, and social threads
- [ ] Build LLMProjects.tsx page: project cards grid, per-project asset queue view, weekly cadence tracker (how many assets produced this week)
- [ ] Asset queue view: grouped by type (FAQ, YouTube, Blog, Social), sortable by priority, status filter tabs
- [ ] Weekly cadence: show X assets produced this week vs. target (e.g., 3/week), progress bar
- [ ] "Generate This Asset" button on each queue item: pre-fills Creation Studio with the asset title/question as the idea
- [ ] "Mark as Produced" button: links asset to a content item, updates status
- [ ] Add LLM Projects to sidebar navigation
- [ ] Write vitest tests for llmProjectsRouter

## LLM Projects Module (v45)
- [x] Add llm_projects and llm_assets tables to DB schema
- [x] Run db:push for new tables
- [x] Build llmProjectsRouter: createProject, listProjects, getProject, deleteProject, addAsset, generateQueue (AI), listAssets, updateAssetStatus, deleteAsset, getWeeklyCadence
- [x] AI queue generation: given a topic cluster, generate 10-40 prioritized FAQ/YouTube/blog/social assets
- [x] Build LLMProjects.tsx page: project grid, project detail view, asset queue with filters, weekly cadence tracker
- [x] Add "LLM Projects" to sidebar navigation (BarChart3 icon)
- [x] Add /llm-projects route to App.tsx
- [x] Wire "Create in Studio" button: navigates to /studio with asset type, title, keyword, question pre-filled via URL params
- [x] CreationStudio reads LLM project URL params and pre-populates idea/platform on load

## Automated Blog Link Resolution (v51)
- [x] Add wp_post_index table to schema (id, wpPostId, title, slug, url, excerpt, categories, publishedAt, syncedAt)
- [x] Run db:push for new table
- [x] Build syncWordPressPosts procedure: fetch all published posts from WP REST API, upsert into wp_post_index
- [x] Build getInternalLinkCandidates helper: query wp_post_index for posts relevant to a topic
- [x] Inject real internal link candidates into generateBlog Pass 1 prompt
- [x] Build resolveExternalLinks post-processor: detect [Outbound Link: ...] placeholders, search for real URLs, replace with markdown links
- [x] Wire both into generateBlog pipeline
- [x] Add "Sync WordPress Posts" button to Creation Studio blog output panel
- [x] Run tests (101 passed)

## LLM Projects + Auto-Image Enhancements (v52)
- [x] Add getAllProjectsCadence tRPC query: aggregate this-week production across all active projects
- [x] Add cross-project weekly cadence strip to LLM Projects page header
- [x] Write vitest tests for llmProjectsRouter (createProject, listProjects, generateQueue, getWeeklyCadence) — 11 tests, 112 total passing
- [ ] Add generateImages toggle to Creation Studio UI (checkbox to enable/disable auto-image with content)
- [ ] Show per-platform image generation status indicator (generating... / ready / failed) in Creation Studio

## Mark as Published Flow (v53)
- [x] Add publishedUrl column to llm_assets schema
- [x] Run db:push for schema change
- [x] Update updateAssetStatus mutation to accept and store publishedUrl
- [x] Build MarkPublishedDialog: URL input, URL validation, confirm button
- [x] Add "Mark Published" button to each asset row (shown when status is produced)
- [x] Show live URL link on published assets in the asset queue (clickable ExternalLink icon + URL text)
- [x] Cadence tracker auto-refreshes after marking published (invalidates listAssets, getWeeklyCadence, getAllProjectsCadence)
- [x] All 112 tests passing

## Blog Generation JSON Fix (v54)
- [x] Fix generateBlog: strip ```json code fences from LLM response before JSON.parse
- [x] Add robust JSON extraction helper (extractArticleFromJson) that handles ```json\n{}, ```, and raw {} variants
- [x] Detection regex now catches all fence styles including newline-separated fences
- [x] All 112 tests passing, 0 TypeScript errors

## Blog UI JSON Display Fix (v54b)
- [x] Diagnosed root cause: JSON.parse was failing silently on article fields with unescaped newlines
- [x] Replaced JSON.parse-only extractor with 2-stage approach: JSON.parse first, then character-walk regex fallback
- [x] Regex extractor correctly decodes \n, \t, \\ escape sequences in article field
- [x] Added 6 unit tests covering all JSON response variants (fenced, raw, escaped newlines, clean markdown)
- [x] All 118 tests passing, 0 TypeScript errors

## CTA Link Fix (v55)
- [x] Replaced urbanmonkacademy.com with theurbanmonk.com in BLOG_PROMPT CTA section
- [x] Searched all .ts and .tsx files — no other urbanmonkacademy.com references found
- [x] All 118 tests passing

## Generate Teleprompter Script from YouTube Panel (v56)
- [x] Added amber "Teleprompter Script" button to YouTube card header (next to Push to Buffer)
- [x] Wired to trpc.research.generateTeleprompterScript mutation with title extracted from YouTube content
- [x] Script renders in expandable amber-bordered panel below YouTube card with Copy, Download (.txt), Regenerate, and Dismiss buttons
- [x] Loading state shows spinner + "Writing your teleprompter script…" message
- [x] Tip text guides user to PromptSmart / Teleprompter Premium / Descript
- [x] All 118 tests passing, 0 TypeScript errors

## Teleprompter Script in Kanban Modal (v57)
- [x] Found Card Detail Dialog in CommandCenter.tsx
- [x] Added amber "Generate Teleprompter Script" button — only visible on YouTube cards
- [x] Title auto-extracted from card (strips "Question to answer:...Title:" prefix)
- [x] Script renders inline in amber-bordered panel with Copy, Download (.txt), Redo buttons
- [x] Loading state shows spinner + message
- [x] State resets when modal closes so it doesn’t carry over to next card
- [x] All 118 tests passing, 0 TypeScript errors

## Build OOM Fix (v58)
- [x] Converted all 16 page imports in App.tsx to React.lazy() dynamic imports
- [x] Added Suspense wrapper with PageLoader spinner fallback
- [x] Configured Vite manualChunks: 10 vendor chunks (radix, tanstack, trpc, dnd, react, lucide, charts, date-fns, utils, misc)
- [x] Deployment confirmed successful (exit 137 OOM resolved)
- [x] All 118 tests passing, 0 TypeScript errors

## Blank Screen Fix (v58b)
- [x] Root cause: jsxLocPlugin (@builder.io/vite-plugin-jsx-loc) was injecting data-loc attributes into production build, causing React 19 to crash silently before mounting
- [x] Fix: made jsxLocPlugin dev-only (only runs when NODE_ENV=development)
- [x] Verified: production build has 0 data-loc occurrences
- [x] All 118 tests passing

## Save to Script Library + TikTok Script (v59)
- [ ] Find saveScript tRPC mutation and Script Library data model
- [ ] Add "Save to Script Library" button in teleprompter panel (Kanban modal)
- [ ] Add "Generate 60s TikTok Script" button on TikTok cards in Kanban modal
- [ ] TikTok script renders inline with Copy, Download, Save to Library buttons
- [ ] Run tests

## Blank Screen Fix v2 (v58c)
- [x] Root cause: vendor-react and vendor-react-dom were split into separate async chunks. The manus-runtime script (injected before app) bundles its own React and initializes the Scheduler. When the app's async React chunk loaded, it tried to re-initialize the Scheduler, causing: "Cannot set properties of undefined (setting 'unstable_now')" — a silent crash.
- [x] Fix: removed vendor-react and vendor-react-dom from manualChunks so React is bundled inline with the main entry chunk (synchronous load, no conflict)
- [x] Verified: new index-B0cUGF9B.js has 0 data-loc, React loads correctly after manus-runtime IIFE
- [x] All 118 tests passing

## Save to Script Library + TikTok Script (v59) — QUEUED FOR NEXT SESSION
- [ ] Add "Save to Script Library" button in the teleprompter panel (Kanban modal + Creation Studio)
- [ ] Wire to scriptsRouter.create mutation with title, content, platform=youtube, type=teleprompter
- [ ] Add TikTok 60-second script button on TikTok cards in CommandCenter Kanban modal
- [ ] Reuse generateTeleprompterScript with a "tiktok" format flag (60-sec punchy, hook + 3 points + CTA)
- [ ] Run tests

## Typeform Push Fix (v60)
- [x] Root cause: validations object was sent on ALL field types, but Typeform only accepts it on short_text, long_text, email, phone_number, number, date, website
- [x] Fix: added TYPES_WITH_VALIDATIONS set; validations only added when field type is in that set
- [x] Also added properties support for dropdown and ranking field types
- [x] All 118 tests passing, 0 TypeScript errors

## Save to Script Library + TikTok Script (v59)
- [x] Add "Save to Script Library" button in teleprompter panel in CommandCenter Kanban modal
- [x] Wire to scriptsRouter.create mutation (title, content, platform=youtube, type=teleprompter)
- [x] Add TikTok 60-second script button on TikTok cards in CommandCenter Kanban modal
- [x] Generate TikTok script: hook (0-3s) + 3 punchy points + CTA, ~60 seconds spoken
- [x] Add "Save to Script Library" button in teleprompter panel in CreationStudio
- [x] Add TikTok 60-second script panel in CreationStudio TikTok card with Copy, Download, Save to Library
- [x] Run tests — 118 tests passing

## Remove Free Consultation from Typeform Survey (v60)
- [x] Removed question 9 ("Would you like a free 15-minute health strategy call?") from the AI survey generation prompt
- [x] Updated Typeform thank-you screen to clean "Thank you for your responses" — no CTA, no follow-up promise
- [x] Survey now generates 7-8 questions only, ending after the commitment/seriousness rating

## Script Library Inline Editor + Script Linking + TikTok Word Count (v61)
- [x] Inline title rename in Script Library (click title to edit, Enter/Esc/blur saves via scripts.update)
- [x] Inline status dropdown in Script Library expanded card view
- [x] Inline body edit in Script Library (Edit button opens full textarea with Save/Cancel)
- [x] Auto-link: Save to Library in CommandCenter passes contentItemId → scripts.create → content.update sets linkedScriptId
- [x] Auto-link: Same flow in CreationStudio for YouTube teleprompter and TikTok 60-sec scripts
- [x] Source Script badge already exists in CommandCenter modal — now auto-populated after save
- [x] Word-count + spoken-time indicator in CommandCenter TikTok script panel (amber=short, green=on-target, red=long)
- [x] Word-count + spoken-time indicator in CreationStudio TikTok 60-sec panel (same logic)
- [x] 118 tests passing, 0 TypeScript errors

## Script Library Search/Filter + Script Title on Kanban Badge (v62)
- [x] Add search bar to Script Library (filter by title keyword, searches title + body + notes)
- [x] Add status filter dropdown (All Statuses / Idea / Scripted / In Production / In Edit / Ready to Post / Published)
- [x] Add type filter dropdown (All Types / Video / Reel / Carousel / Blog / Email)
- [x] Show active filter count + clear-all button when filters are active
- [x] Show result count ("N of M scripts") in filter bar
- [x] Script title shown in Source Script badge on Kanban cards via scripts.get query
- [x] 118 tests passing, 0 TypeScript errors

## Kanban Drag-and-Drop Status Changes (v63)
- [x] dnd-kit already installed (@dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities)
- [x] DroppableColumn now wraps entire column (header + cards) — full column is the drop target
- [x] Cards already draggable via useDraggable with itemId in data
- [x] handleDragEnd already calls changeStatusMutation when dropped on col-{status}
- [x] Column header and badge highlight (text-primary, bg-primary/10) when card is dragged over
- [x] Empty columns show large "Drop here" zone (min-h-[80px]) for easy targeting
- [x] Ghost card overlay: slight rotate + scale, platform badge, drop animation
- [x] 118 tests passing, 0 TypeScript errors

## Fix Kanban Drag-and-Drop (v64)
- [x] Root cause: listeners spread on entire Card intercepted by onClick/DropdownMenu before dnd-kit could capture pointer
- [x] Fix: moved {listeners} and {attributes} to a dedicated GripVertical drag handle div in the card header
- [x] Card body click still opens modal; drag handle initiates drag without conflict
- [x] Empty column "Drop here" zones remain large and clearly visible during drag
- [x] 118 tests passing, 0 TypeScript errors

## Platform Audit & Bug Scrub (v65)
- [x] Confirmed all 16 routes present in DashboardLayout sidebar nav
- [x] Fixed WebinarIntelligence page — was missing DashboardLayout wrapper
- [x] Audited all tRPC mutations for onError handlers — added missing ones in CommandCenter
- [x] 0 TypeScript errors across all files
- [x] No navigation dead-ends found
- [x] 121 tests passing

## Fix Home Page Opt-In Form — Wire to Kajabi (v65-b)
- [x] Built kajabiApi.ts: OAuth token caching, createContact(), resolveTagId() with auto-create, addTagByName(), kajabiOptIn() composite
- [x] Added optin.submit publicProcedure in routers.ts: accepts email + name, calls kajabiOptIn(), notifies owner
- [x] Wired Home.tsx form to trpc.optin.submit.useMutation — replaced fake setTimeout simulation
- [x] Real success/error toasts on form submit
- [x] Owner notified via notifyOwner on every new opt-in
- [x] 121 tests passing (3 Kajabi credential tests confirm live 200 response), 0 TypeScript errors

## Sidebar Nav Cleanup — Intelligence Group (v66)
- [x] Grouped all intelligence/analysis pages under a collapsible "Intelligence" parent (Sparkles icon)
- [x] Sub-items: Research, Typeform, Press, Intelligence Hub, Webinar Intel, Avatar, LLM Projects
- [x] Top-level items: Command Center, Creation Studio, Strategy Brain, Script Library, Asset Library, Landing Pages, Channel Watchlist, Media Vault, Create Webinar
- [x] Collapsible group auto-expands when any sub-route is active (useEffect on location)
- [x] Collapsed sidebar shows Sparkles icon with "Intelligence" tooltip
- [x] ChevronDown/ChevronRight chevron indicates open/closed state
- [x] Sub-items use indented border-left styling for visual hierarchy
- [x] 121 tests passing, 0 TypeScript errors

## Sidebar Nav — Strategy Group (v67)
- [x] Added collapsible "Strategy" group (Compass icon) containing Strategy Brain and Channel Watchlist
- [x] Removed both from top-level nav; top-level is now 7 items
- [x] Strategy group auto-expands when either sub-route is active
- [x] 121 tests passing, 0 TypeScript errors

## Fix X/Twitter 280-Character Limit (v68)
- [ ] Audit X prompt in routers.ts — tighten character limit instructions
- [ ] Add hard server-side truncation guard after LLM response (trim to 280 chars at word boundary)
- [ ] Add character count display on X output panel in Creation Studio
- [ ] Run tests

## Fix X/Twitter 280-Char Limit + Lights On URL (v68)
- [x] Root cause: LLM was hallucinating urbanmonk.com/lights-on; DB CTA blocks had stale seed data
- [x] Fixed seedCtaBlocks() to upsert/update existing records instead of skipping — DB now always reflects correct URL
- [x] Added CRITICAL URL RULE to CTA injection block — LLM explicitly forbidden from substituting URLs
- [x] Tightened X prompt: single tweet default, 240-char hard ceiling, threads only when genuinely needed
- [x] Replaced no-op validateXLength with enforceXLimit: trims single tweets and each thread line at word boundary ≤280
- [x] Fixed rewrite mutation X platform instruction: 240-char ceiling + explicit URL rule
- [x] Fixed reframeCtaText: now uses correct go.theurbanmonk.com URL
- [x] Fixed StrategyBrain.tsx placeholder URLs
- [x] 121 tests passing, 0 TypeScript errors

## Fix Blog Generation + Title Bug from LLM Projects Publish-to-All (v69)
- [x] Root cause 1: title fallback used input.idea.slice(0,80) which produced "Research Gap..." or "Question to answer..." when launched from LLM Projects
- [x] Root cause 2: blog generation was routing correctly to generateBlog (not generateContent) — the tiny blog was caused by the idea field containing multi-line LLM Projects context that confused the LLM
- [x] Fixed: added extractCleanIdea() helper in both generateContent and generateBlog mutations
- [x] extractCleanIdea() extracts Title line first, then Question line, then strips prefixes — produces a clean topic string for title fallback and LLM context
- [x] All title fallbacks, metadata extraction prompts, and user messages now use cleanIdea
- [x] 121 tests passing, 0 TypeScript errors

## Bulk Title Cleanup + Carousel Generator (v70)

### Bulk Title Cleanup
- [x] Added `ai.cleanupStaleTitles` tRPC mutation: finds all items with [Research Gap]/Question to answer/Answer this prefix, re-runs extractCleanIdea() on rawIdea, updates title in DB
- [x] Added "Clean Up Titles" amber button in Command Center platform filter row (only visible when stale titles exist)
- [x] Success toast shows count of items renamed

### Carousel Generator
- [x] Added `carousel` to Platform enum in schema, routers, and all frontend types
- [x] Added `ai.generateCarousel` tRPC mutation: idea + platform (meta/linkedin) + slideCount (4-10) + generateImages, returns slides with headline/body/imagePrompt/imageUrl
- [x] Added carousel to PLATFORMS array and PLATFORM_LABELS in CreationStudio
- [x] Added carousel controls panel (platform selector + slide count 4-10) in CreationStudio
- [x] Generate button routes to handleGenerateCarousel when platform=carousel
- [x] Carousel output: horizontal snap-scroll preview with 1:1 slide images, headline, body, per-slide copy button
- [x] Download .md button exports all slides as markdown
- [x] Auto-saves to Command Center on generation
- [x] 121 tests passing, 0 TypeScript errors

## Buffer Carousel Push + Meta Aspect Ratio Fix (v71)
- [x] Clarified in UI: carousel Buffer push panel only shows for Meta platform; LinkedIn note explains PDF requirement
- [x] Added `pushCarouselToBuffer()` to buffer.ts: sends up to 10 images as multi-image post via Buffer GraphQL API, handles facebook/instagram metadata fragments separately
- [x] Added `syndication.pushCarousel` tRPC mutation: accepts caption + imageUrls[] + profileIds + channelServiceMap, updates content item status to scheduled on success
- [x] Added carousel Buffer push panel in Creation Studio carousel output card: caption textarea with char counter, image count indicator, missing-image warning, success/error result display
- [x] Push button auto-resolves Meta channel IDs from bufferProfiles (facebook + instagram services only)
- [x] Caption defaults to cover slide headline if left blank
- [x] 121 tests passing, 0 TypeScript errors

## Carousel Redesign + Meta Direct Publish (v72)

### Carousel Template Redesign
- [x] Removed per-slide AI image generation from generateCarousel mutation
- [x] Built CarouselSlideRenderer.tsx: HTML Canvas renderer, 1080×1080, slidesToDataUrls() exports all slides as PNG data URLs
- [x] 3 slide templates: Cover (large headline + gold accent bar + slide counter), Content (headline + body text), CTA (bold CTA + URL)
- [x] Urban Monk brand palette: charcoal #0f1117 bg, gold #c9a84c accent, Playfair Display serif + Inter sans
- [x] Export as ZIP: jszip bundles all rendered PNGs + copy.md, downloads as carousel-{slug}.zip
- [x] Carousel preview shows canvas-rendered images (not AI images)
- [x] Auto-renders slides after generation with loading spinner

### Meta Content Publishing API
- [x] Built server/metaPublisher.ts: publishInstagramCarousel() (3-step: child containers → carousel container → publish) + publishFacebookCarousel() (multi-photo page post)
- [x] Added syndication.uploadCarouselImage mutation: base64 PNG → S3 → CDN URL (required for Meta API)
- [x] Added syndication.publishCarouselToMeta mutation: uploads all slides to S3, then calls Meta API for IG + FB
- [x] Replaced Buffer push panel with direct Meta publish panel: IG + FB checkboxes, caption field, per-platform result display
- [x] Added TRPCError import to routers.ts
- [x] 121 tests passing, 0 TypeScript errors
- [ ] Request META_PAGE_ACCESS_TOKEN, META_IG_ACCOUNT_ID, META_FB_PAGE_ID secrets from user (pending)

## Carousel Simplification — Export Only (v73)
- [x] Removed Meta API publish panel from carousel output in Creation Studio
- [x] Removed pushCarouselMutation, handlePushCarouselToBuffer, and all Meta API state variables
- [x] Kept: canvas slide renderer (CarouselSlideRenderer.tsx), ZIP export, slide preview, per-slide copy buttons
- [x] Added clean "Ready to post on Meta" info box with step-by-step manual posting instructions
- [x] 121 tests passing, 0 TypeScript errors

## Fix "Clean Up Titles" Button (v74)
- [x] Root cause 1: mutation's LIKE filter didn't include "Answer this LLM%" — titles were saved as "Answer this LLM search query for the persona..." not "[Research Gap]..."
- [x] Root cause 2: button visibility check also missed "Answer this LLM" pattern
- [x] Root cause 3: extractCleanTitle() only took 1 arg but was updated to take 2 (titleField + rawIdea)
- [x] Fixed: added "Answer this LLM%" and "Answer this%search query%" to LIKE filters
- [x] Fixed: extractCleanTitle now parses the LLM query from rawIdea (extracts the actual search question, strips filler words, caps at 12 words)
- [x] Fixed: button visibility now detects all stale patterns including /^Answer this LLM/i
- [x] 121 tests passing, 0 TypeScript errors

## Title Case Fix for Clean Up Titles + All Generated Titles (v75)
- [x] Added toTitleCase() helper using AP/Chicago style: capitalizes all major words, keeps articles/prepositions/conjunctions lowercase unless first or last word
- [x] Applied toTitleCase() in cleanupStaleTitles mutation — all renamed cards now get proper headline casing
- [x] Applied toTitleCase() in generateContent title path — all new social post card titles will be properly cased
- [x] Blog titles come from LLM metadata extraction which already produces proper case; fallback also uses cleanIdea which is now title-cased
- [x] 121 tests passing, 0 TypeScript errors

## Fix Title Case (Manual DB Run) + Media Vault Empty (v76)
- [x] Ran improved title case fix script directly against DB — 58 titles updated in first pass, 12 more refined in second pass (after-colon capitalization, contractions like "it's", quoted words like "Stress")
- [x] Updated toTitleCase() in server: removed 'up' from lowercase list, added after-colon capitalization, skip markdown headers/long strings
- [x] Diagnosed Media Vault empty: seedMediaAssets.mjs existed but was never run against production DB
- [x] Ran seed script — 28 Pedram Shojai media assets now in DB (8 books, 4 podcasts, 3 films, 8 YouTube, 5 interviews)
- [x] Also added auto-seed to server startup so media assets are always present
- [x] 121 tests passing, 0 TypeScript errors

## Graceful LLM Rate Limit Error Handling (v77)
- [x] Root cause: API returns HTTP 200 with plain-text "Rate exceeded." body; invokeLLM was calling response.json() which crashed with "Unexpected token 'R'"
- [x] Fixed invokeLLM in _core/llm.ts: reads raw body first, detects non-JSON rate-limit responses before parsing, throws RATE_LIMIT: prefixed error
- [x] Added safeLLM() wrapper in routers.ts: catches RATE_LIMIT: errors and re-throws as TRPCError(TOO_MANY_REQUESTS) with user-friendly message
- [x] Replaced all 15 invokeLLM() calls in routers.ts with safeLLM() — all AI mutations now show clean toast instead of JSON crash
- [x] Other router files (personasRouter, landingPagesRouter, youtubeRouter, etc.) also protected via the source-level fix in llm.ts
- [x] 121 tests passing, 0 TypeScript errors

## Brand Identity Applied (v78)
- [x] Extracted all brand tokens from The Urban Monk Visual Identity Guidelines PDF (May 2020)
- [x] Saved brand token reference to brand-tokens.md
- [x] Carousel renderer completely rewritten: cream/solid brand color backgrounds, white text on color, dark text on cream, NO gradients (brand spec), Urban Monk SVG logo mark in bottom-right, Life Garden decorative elements (dot clusters, zigzag lines, oval rings, sketch circles) as watermarks
- [x] Cover slides rotate through Fire (#ed5939), Wood (#3d7e51), Water (#5870aa), Earth (#f6a032)
- [x] Content slides use cream (#f7f4ef) background with colored left-edge accent bar
- [x] CTA slide uses Fire top block + cream bottom + Fire CTA button pill
- [x] Updated global CSS: primary = Fire (#ed5939), accent = Wood (#3d7e51), background = Metal cream (#f7f4ef), foreground = Yin (#161513)
- [x] Updated fonts: DM Sans (body) + Nunito (headings) — closest free Google Font equivalents to Raisonne Pro / Sofia Pro
- [x] Sidebar updated: cream (#f7f4ef) background, Urban Monk SVG logo mark in header
- [x] 121 tests passing, 0 TypeScript errors

## Brand Logo Variants — Sidebar + Kanban (v81)
- [x] Swap sidebar header logo to Fire (red-orange) variant
- [x] Add element-logo badges to Kanban cards (Water=LinkedIn, Fire=Meta, Wood=YouTube, Earth=TikTok, Yin=Blog)

## Blog Content Cleanup — Wrong URLs, TL;DR, Hashtags (v82)
- [x] Fix blog AI prompt: remove TL;DR blockquote instruction, no hashtags, no internal markup labels
- [x] Fix ctaRouter.ts: replace all urbanmonk.com/academy URLs with theurbanmonk.com
- [x] Fix ctaRouter.ts: rewrite CTA text to be generic (no specific module names that don't exist yet)
- [x] Run DB cleanup: strip TL;DR blocks and fix wrong URLs in all existing blog post textContent

## Blog Kanban — WordPress Publish Button (v83)
- [x] Add "Publish to WP" button directly on blog Kanban cards (bypasses Buffer)

## WordPress Publish — Hero Image Fix (v84)
- [x] Fix hero image not uploading to WordPress when using "Publish to WP" button on Kanban card

## WordPress UX Improvements (v85)
- [x] Add "View Draft in WP" link on Kanban card after successful publish (opens editUrl in new tab)
- [x] Add "Publish to WP" button inside card detail modal for blog posts

## Webinar Intelligence — Typeform Import (v86)
- [x] Fetch Typeform responses from form gKuZd1tj via API
- [x] Fix Webinar Intelligence section to correctly connect to the right form ID
- [x] Import 49 responses into platform and surface audience insights
- [x] Fixed rawResponses column from TEXT to MEDIUMTEXT (16MB) to handle large datasets
- [x] Verified DB migration applied successfully (migration 0033)
- [x] 121 tests passing, 0 TypeScript errors

## Webinar Intelligence — Rewrite Webinar from Intelligence (v87)
- [x] Add rewriteOutlineFromIntelligence tRPC procedure to webinarIntelligenceRouter
- [x] Procedure takes intelligenceRecordId + webinarSessionId, feeds extracted pain points/motivations/language into the outline prompt
- [x] AI produces a revised outline showing exactly what changed and why (diff-style commentary)
- [x] Save revised outline to webinarSessions.outline (with intelligence-informed flag)
- [x] Add "Rewrite Webinar from This Intelligence" button on extracted IntelligenceCard
- [x] Show revised outline panel below the card with copy button and link to Webinar Builder
- [x] Revised outline auto-saved to webinar session on generation
- [x] Added vitest test for rewriteOutlineFromIntelligence procedure
- [x] 121 tests passing, 0 TypeScript errors

## Blog Publishing Pipeline Fixes (v88)
- [x] Add markdownToWpHtml conversion in the blog.publish procedure (server-side, before createWpPost)
- [x] Convert #hashtag tokens to <strong> bold text in the HTML output
- [x] Auto-set WP categories: Health and Wellness (ID 19) + Health & Wellness (ID 941) on every publish
- [x] Auto-resolve/create WP tags from focusKeyword + semanticKeywords on publish
- [x] Fix batch publish (publishBatch) to also convert markdown to HTML + auto-set categories
- [x] Add focusKeyword and seoKeywords columns to contentItems schema (migration 0034)
- [x] Persist SEO fields when saving blog from CreationStudio to Command Center
- [x] CommandCenter publish now reads focusKeyword/seoKeywords from DB and pushes to WP
- [x] 12 new vitest tests for markdownToWpHtml + hashtag-to-bold (133 total, all passing)

## Copy HTML Button + Inline SEO Editor (v89)
- [x] Add "Copy as HTML" button to blog detail dialog (converts markdown to HTML client-side, copies to clipboard with toast)
- [x] Renamed existing button to "Copy Markdown" for clarity
- [x] Add SeoKeywordEditor component inside blog detail dialog — shows Focus Keyword + Semantic Keywords (comma-separated) fields
- [x] Auto-saves SEO fields to DB on Save button or Enter key press
- [x] Show focusKeyword as a small amber badge on blog Kanban cards when set
- [x] 133 tests passing, 0 TypeScript errors

## Bug: Stuck Publishing to WordPress (v90)
- [x] Diagnosed root cause: WordPress site was returning 503 (maintenance mode) — no timeout was set so the fetch hung indefinitely
- [x] Added wpFetch() helper in both wordpress.ts and wpContentUtils.ts with AbortController timeouts
- [x] Maintenance mode detection: 503 with autoupdater/maintenance body now throws a clear human-readable error
- [x] Timeout detection: AbortError now throws "WordPress did not respond within 20 seconds" instead of hanging
- [x] Image upload: 30s timeout; tag resolution: 8s per keyword; post creation: 20s
- [x] All errors propagate to the UI as toast messages via tRPC error handling
- [x] 133 tests passing, 0 TypeScript errors

## Auto-Move to Published on WP Push (v91)
- [x] When "Push to WordPress" is clicked, card moves to Published column immediately (optimistic update)
- [x] tRPC blog.publish procedure always sets contentItem status = 'published' in DB (even for WP drafts)
- [x] If WP publish fails, status rolls back to previous state with an error toast
- [x] Works from both Command Center Kanban card and detail dialog
- [x] 133 tests passing, 0 TypeScript errors

## Avatar Intelligence Repository (v92)
- [x] Added avatarProfiles table: productName, productSlug, cumulativePainPoints, cumulativeMotivations, cumulativeLanguage, cumulativeObjections, cumulativeThemes, demographicPatterns, avatarNarrative, webinarBriefContext, totalRespondents, webinarCount, lastUpdatedAt
- [x] Added webinarIntelligence.avatarProfileId FK + aggregatedAt column
- [x] Pushed DB migration 0035
- [x] Added aggregateToAvatarProfile tRPC procedure: LLM synthesis merges new intel with existing cumulative profile (structured JSON response)
- [x] Added listAvatarProfiles, getAvatarProfile, createAvatarProfile tRPC procedures
- [x] Added "Add Intelligence" button on each AvatarProfileCard (opens session/record selector)
- [x] Built Avatar Repository page (/avatar-repository): profile cards with narrative, demographics, themes, pain points, motivations, language, objections, webinar brief context (copy button)
- [x] "Add Intelligence" flow: select webinar session → pick extracted record → AI merges into profile
- [x] Added "Avatar Repository" nav item in Intelligence section of sidebar
- [x] 133 tests passing, 0 TypeScript errors

## Yoast SEO Auto-Population on WordPress Publish (v93)
- [x] Audited Yoast REST API: free version blocks protected meta keys via standard 'meta' field; yoast_meta top-level field works for title
- [x] Added yoastSeoTitle and yoastMetaDescription columns to contentItems schema (migration 0036)
- [x] Fixed createWpPost to use yoast_meta top-level field + second-pass update for metadesc/focuskw
- [x] blog.publish procedure now uses yoastSeoTitle/yoastMetaDescription overrides from DB; persists them back after publish
- [x] SeoKeywordEditor expanded: SEO Title, Meta Description (with 0/160 char counter + color indicator), Focus Keyphrase, Semantic Keywords
- [x] handlePublishToWP passes yoastSeoTitle and yoastMetaDescription from DB to WP
- [x] Created docs/wordpress-yoast-rest-api-snippet.php — paste once into functions.php for full Yoast field exposure
- [x] 133 tests passing, 0 TypeScript errors

## Yoast SEO Enhancements (v94)
- [x] Added blog.generateYoastFields tRPC procedure: LLM generates seoTitle (≤60 chars), metaDescription (120-155 chars), focusKeyphrase, semanticKeywords from blog body; auto-saves to DB
- [x] Added "AI Generate" button (purple, Sparkles icon) in SeoKeywordEditor — auto-fills all four Yoast fields from blog content
- [x] Added updateWpPostYoast function in wordpress.ts: updates existing WP post's Yoast fields without republishing
- [x] Added blog.updateYoast tRPC procedure: pushes Yoast fields to existing WP post by wpPostId; persists to DB
- [x] Added "Update in WP" button (green, RefreshCw icon) in SeoKeywordEditor — only shown when wpPostId exists
- [x] Added functions.php snippet as collapsible copyable block at bottom of SEO panel
- [x] Fixed TS2345 error in generateYoastFields (String() cast on LLM response content)
- [x] 132/133 tests pass (1 Kajabi network timeout — not a code issue)

## Yoast SEO Batch Workflows + WP Setup (v95)
- [x] Added blog.generateYoastForDrafts tRPC procedure: iterates all Drafting blog posts, calls LLM for each, saves to DB
- [x] Added blog.backfillYoastInWordPress tRPC procedure: iterates all Published posts with wpPostId, calls updateWpPostYoast for each
- [x] Added "Generate Yoast for X Drafts" button (purple) in Command Center Blog filter header
- [x] Added "Backfill Yoast in WP" button (green) in Command Center Blog filter header
- [x] Both buttons only appear when Blog filter is active and there are eligible posts
- [x] Added WordPress Setup page at /wordpress-setup with: WP connection test, step-by-step instructions, copyable functions.php snippet, batch action descriptions
- [x] Added "WordPress Setup" nav item in Intelligence section of sidebar
- [x] 133 tests passing, 0 TypeScript errors

## Course URL Updates (v96)
- [x] Updated Lights On URL to https://lightson.theurbanmonk.com/ in all files
- [x] Updated Upstream URL to https://upstream.theurbanmonk.com/ in all files
- [x] Updated AI prompts: routers.ts, youtubeRouter.ts, llmProjectsRouter.ts, scriptsRouter.ts, ctaRouter.ts
- [x] Updated Command Center offer banner URL
- [x] Updated StrategyBrain.tsx placeholder text
- [x] Updated LandingPageGenerator.tsx OFFERS array
- [x] Updated landingPagesRouter.ts OFFER_DETAILS
- [x] Removed stale $369/yr price references from AI prompts
- [x] 133 tests passing, 0 TypeScript errors

## Upstream Pricing + Yoast Batch (v97)
- [x] Update Upstream course price to $299 in all AI prompts
- [x] Add Upstream + KBMO FIT22 bundle price ($399) to AI prompts and offer definitions
- [x] Run batch Yoast generation for all 36 Drafting blog posts (3 remaining drafts processed; others already had Yoast fields)

## WordPress Edit Link Fix (v98)
- [x] Fix "Edit in WordPress" link — use wp-login redirect URL so unauthenticated users get sent to login first, then redirected to the post editor
- [x] Add "View Post" link (public URL) alongside the edit link for published posts
- [x] Update label from "View Draft in WordPress" to "Edit in WordPress" for published posts

## App Rename to "The Urban Monk Content Hub" (v99)
- [x] Update browser tab title in client/index.html
- [x] Update login screen heading in DashboardLayout.tsx
- [x] Update login screen subtext in DashboardLayout.tsx
- [x] Update sidebar header name in DashboardLayout.tsx
- [x] Update ScriptLibrary creator field

## Favicon + App Title Update (v100)
- [x] Convert Urban Monk logo to favicon.ico, apple-touch-icon.png, favicon-32x32.png, favicon-16x16.png
- [x] Update index.html with correct favicon link tags
- [ ] Update VITE_APP_TITLE in Management UI → Settings → General (must be done manually — built-in secret)

## Strategy Brain URL Edit Fix (v102)
- [x] Fix seedCtaBlocks() — stop overwriting existing records on every load so in-app URL edits persist
- [x] Verify Edit button opens form with correct existing values (logic unchanged, was working)
- [x] Verify Save persists URL changes and they survive page reload (overwrite loop removed)

## UTM Generator Integration (v106)
- [x] Add utmLinks table to drizzle schema (id, url, label, source, medium, campaign, content, term, destination, createdAt)
- [x] Add utmRouter with list, save, delete procedures
- [x] Create UTMGenerator.tsx page with full component, Content Hub styling, and DB-backed history
- [x] Add UTM Builder nav entry in DashboardLayout sidebar (under Strategy section)
- [x] Register /utm route in App.tsx
- [x] Add Upstream Health and KBMO Bundle to campaigns and destinations

## UTM Enhancements (v107)
- [x] Copy UTM button on published blog Kanban cards — auto-generate blog→organic-content→[post-slug] UTM link
- [x] UTM auto-inject into AI CTA blocks — append UTM params to CTA URLs based on platform and campaign
- [x] CSV export button in UTM Builder history — download all saved links as a spreadsheet

## Copy UTM Auto-Save to History (v108)
- [x] Wire Copy UTM button on blog cards to auto-save the generated UTM link to the UTM Builder history database

## UTM UX Enhancements (v109)
- [x] Auto-detect UTM campaign slug from post's CTA block label on blog cards (e.g. "Upstream Course" → "upstream-course")
- [x] Add Copy UTM button to social post cards (LinkedIn, Meta, YouTube, X) with auto-save to history
- [x] Add "View history →" link in Copy UTM toast that navigates to Strategy → UTM Builder

## UTM Tooltip Preview (v110)
- [x] Add hover tooltip to Copy UTM button on blog cards showing full UTM URL before copying
- [x] Add hover tooltip to Copy UTM button on social post cards showing full UTM URL before copying

## Research Report Ingest Endpoint (v111)
- [x] Add INGEST_SECRET environment variable via webdev_request_secrets
- [x] Add ingestReports table to drizzle schema (separate from Gumshoe researchReports table)
- [x] Create server/ingestRouter.ts with POST /api/ingest/research-report handler (secret validation, payload parsing, DB save, content item creation)
- [x] Register ingest route on Express server (outside tRPC, before tRPC middleware)
- [x] Add vitest tests for the ingest endpoint (3 tests passing)
- [x] Live test: 401 on bad secret, 200 on valid payload, test record cleaned up

## Ingest Inbox + Generate Pipeline (v112)
- [x] Build IngestInbox.tsx page — list of all ingested reports with source, title, format, tags, pushed date
- [x] Add "Generate Content" panel per report — shows 4 tabs: LinkedIn, X/Twitter, Blog, Email Newsletter
- [x] Build ingest.generateFromReport tRPC procedure — generates all 4 content types from the report's narrativeHtml + topic + tags
- [x] Auto-apply CTA block (matched by topic/tags), UTM params (platform-specific), and hashtags to each generated piece
- [x] "Save to Command Center" button per generated piece — creates ContentItem with correct platform and status=idea
- [x] Add "Ingest Inbox" to sidebar nav under Intelligence section
- [x] Register /ingest route in App.tsx
- [x] Show ingest badge on Command Center cards that originated from ingest (deferred to v113)

## Ingest Badge + Generate All (v113)
- [x] Add "Ingest" badge to Command Center DraggableCard for items with ingestReportId set
- [x] Add "Generate All & Save All" one-click button to IngestInbox report cards

## Ingest Multi-Platform Parsing + Image Fix (v114)
- [x] Parse ingest "social" content packs into separate X and Instagram/Meta ContentItems per post (not one blob)
- [x] Support new ingest format: generatedContent as markdown with ## POST N sections + TWITTER/X and INSTAGRAM versions
- [x] Create one ContentItem per platform per post number (e.g. 5 posts × 2 platforms = 10 ContentItems)
- [x] Use post type (Hook/Stat, Myth-Busting, Practical Tip, Quote/Insight, CTA) as part of the ContentItem title
- [x] Fix image generation for ingest-origin content to use topic-relevant prompts instead of generic ones
- [x] Add topic-aware image prompt generation to ingestGenerateRouter saveAll and saveGenerated
- [x] Update ingest.test.ts to cover multi-platform parsing logic

## Verified Internal Links + URL Hallucination Fix (v115)
- [x] Add verifiedLinks table to schema (url, title, description, topic tags, active flag)
- [x] Seed table with known real URLs (lightson.theurbanmonk.com, theurbanmonk.com, etc.)
- [x] Inject verified links into blog generation prompt alongside WP post index
- [x] Strengthen blog prompt: NEVER invent a theurbanmonk.com URL not in the provided list
- [x] Add post-generation URL scrubber: flag/strip any theurbanmonk.com URLs not in verified list
- [x] Build Verified Links management UI in Strategy section
- [x] Add verifiedLinks CRUD tRPC procedures (list, create, update, delete, toggle active)
- [x] Write tests for URL scrubber logic

## Ingest Meta + YouTube + Script Generator Integration (v116)
- [x] Add META_VOICE and YOUTUBE_VOICE prompts to ingestGenerateRouter.ts
- [x] Expand generateFromReport to generate 6 formats: LinkedIn, X, Meta, YouTube, Blog, Email
- [x] Update saveAll to save all 6 platforms
- [x] Update saveGenerated platform enum to include meta and youtube
- [x] Update GeneratedContent interface in IngestInbox.tsx to include meta and youtube fields
- [x] Add Meta and YouTube tabs to IngestInbox GeneratePanel (6-tab layout)
- [x] Add "Generate Script" button on YouTube tab in IngestInbox that opens Script Generator pre-filled
- [x] Wire YouTube ingest card in Command Center to Script Generator via existing linkedScriptId flow
- [x] Add tests for 6-platform generate flow

## v117: YouTube Script Link + Ingest Processed Badge + Meta FB/IG Split
- [x] Add linkedScriptId column to contentItems schema (nullable int, FK to scripts table)
- [x] Run db:push to migrate schema
- [x] Update ingestGenerateRouter.ts generateScript flow to store linkedScriptId on YouTube ContentItem
- [x] Add "View Script" button to DraggableCard in CommandCenter.tsx for youtube platform cards with linkedScriptId
- [x] Add ingest.countByReport query to return ContentItem count per ingestReportId
- [x] Show processed badge on ReportCard in IngestInbox when count > 0 (e.g. "6 cards created")
- [x] Add FACEBOOK_VOICE and INSTAGRAM_VOICE prompts to ingestGenerateRouter.ts
- [x] Expand generateFromReport to generate facebook and instagram as separate fields
- [x] Add FB/IG toggle to Meta tab in IngestInbox GeneratePanel
- [x] Update saveAll and saveGenerated to handle facebook and instagram as separate platforms
- [x] Run tests and save checkpoint v117

## v118: URL Audit + Topic-Based CTA Routing
- [x] Audit and purge all 13 hallucinated URLs from verified_links table
- [x] Remove hardcoded alwaysInclude filter in blog prompt that assumed specific URLs existed
- [x] Seed verified_links with only confirmed real URLs (lightson, upstream, theurbanmonk.com)
- [x] Add topic-based CTA URL routing: meditation/qigong/consciousness → lightson, gut/oral → upstream, everything else → theurbanmonk.com
- [x] Replace all hardcoded "lightson.theurbanmonk.com" fallbacks in routers.ts with topic-aware routing function
- [x] Update Verified Links page empty-state with clear instructions (no pre-populated data)
- [x] Run tests and save checkpoint v118

## v119: Remove "all" and "ingest" platform values from Kanban
- [x] Audit all places "all" and "ingest" are assigned as ContentItem platform values
- [x] Remove "all" from platformEnum in drizzle/schema.ts; add "email"
- [x] Fix ingestRouter.ts: email→"email", summary/raw_report→"blog", fallback→"blog"
- [x] Fix ingestGenerateRouter.ts: saveAll platforms array and saveGenerated enum
- [x] Fix scriptsRouter.ts: remove "all" from platformValues, default to "youtube"
- [x] Fix CommandCenter.tsx: Platform type, PLATFORM_ICONS, PLATFORM_COLORS, PLATFORM_ELEMENT_LOGO
- [x] Fix ScriptLibrary.tsx: Platform type, PLATFORM_BADGE, "all" comparisons
- [x] Fix IngestInbox.tsx: email tab platform "all"→"email", savedTabs set
- [x] Migrate DB: ALTER TABLE to add "email", UPDATE "all"→"email", remove "all" from enum
- [x] 149 tests passing, 0 TypeScript errors
- [x] Run tests and save checkpoint v119

## v120: Fix Buffer Meta Post Type (2026-04-25)
- [x] Audit buffer.ts pushToBuffer function to see what payload is sent for Meta platform
- [x] Root cause: handlePushToBuffer in CommandCenter.tsx was not passing channelServiceMap or metaPostType
- [x] Fix: build channelServiceMap from matched profiles and pass metaPostType="post" for Meta platform
- [x] buffer.ts already builds correct metadata fragment when channelServiceMap is provided
- [x] Fix covers all push paths (Kanban card button + detail modal button)
- [x] 149 tests passing, 0 TypeScript errors
- [x] Run tests and save checkpoint v120

## v121: Meta Post Type Selector + Persistent Buffer Error Panel (2026-04-25)
- [x] Add metaPostType state per card (Post/Reel/Story) to DraggableCard component
- [x] Show Post/Reel/Story dropdown on Meta platform cards only
- [x] Pass selected metaPostType through onPushToBuffer callback to handlePushToBuffer
- [x] Add bufferErrors Record<number, string> state in parent CommandCenter
- [x] Show persistent error panel on card when Buffer push fails (dismissible red panel)
- [x] Clear error when card is successfully pushed or manually dismissed
- [x] 149 tests passing, 0 TypeScript errors
- [x] Run tests and save checkpoint v121

## v122: Instagram Link-in-Bio + UTM First Comment (2026-04-25)
- [x] Audit buffer.ts: Buffer GraphQL API has native firstComment field on InstagramPostMetadata
- [x] Add ctaUrl param to pushToBuffer function in buffer.ts
- [x] For Instagram channels: scrub all URLs from caption and replace with "link in bio"
- [x] For Instagram channels: pass UTM-tracked CTA URL as firstComment in metadata.instagram block
- [x] Auto-resolve CTA URL server-side in syndication.push using getCtaForTopic + appendUtmToCtaUrl
- [x] Facebook channels are unaffected (URLs stay in caption, no firstComment)
- [x] 149 tests passing, 0 TypeScript errors
- [x] Run tests and save checkpoint v122

## v123: Create Version for Average Reader

- [x] Add `blog.createReaderVersion` tRPC procedure in server/routers.ts — rewrites blog text in accessible, engaging voice, preserves all citations
- [x] Add state variables for reader version content and loading in CommandCenter detail modal
- [x] Add "Create Version for Average Reader" button (blog-only) below the Copy buttons in detail modal
- [x] Show reader version in a collapsible panel below the button with Copy + Replace options
- [x] Write vitest test for the new procedure
- [x] TypeScript check and checkpoint v123

## v124: Blog CTA Visual Banner + Key Takeaways Section

- [x] Add "Key Takeaways" section to BLOG_PROMPT structure (after opening hook, before section 3)
- [x] Add post-processing step to inject Key Takeaways block into generated articleBody if missing
- [x] Add `generateCtaBanner` helper in server/routers.ts — generates a branded CTA image and returns URL
- [x] Add `ctaBannerUrl` and `ctaUrl` fields to generateBlog return value
- [x] Inject CTA banner HTML block into articleBody before saving (linked image → CTA URL)
- [x] Update CreationStudio autoSaveMutation to pass ctaBannerUrl/ctaUrl to saved item
- [x] Update blog detail modal in CommandCenter to preview CTA banner image with hyperlink
- [x] Write vitest tests for Key Takeaways injection and CTA banner embed logic
- [x] TypeScript check and checkpoint v124

## v125: Blog Publishing Enhancements (Regen Banner + KT Editor + WP Banner Sync)

- [x] Add `blog.regenerateBanner` tRPC procedure — generates a new CTA banner image for an existing content item and saves ctaBannerUrl
- [x] Add "Regenerate Banner" button in Command Center blog detail panel (amber section, only when ctaBannerUrl exists or ctaBlockLabel exists)
- [x] Add Key Takeaways inline editor in blog detail modal — parse ## Key Takeaways from textContent, allow editing, save back to textContent
- [x] Add WordPress banner sync on publish — fetch ctaBannerUrl, upload to WP media library via REST API, set _cta_banner_url custom field on the post
- [x] Write vitest tests for regenerateBanner procedure and WP banner sync logic
- [x] TypeScript check and checkpoint v125

## v126: UTM ↔ Content Pipeline Integration

- [x] Sync PLATFORM_UTM map in ctaRouter.ts with the full UTM taxonomy from UTMGenerator.tsx (source, medium, content presets)
- [x] Add `utm_content` parameter to appendUtmToCtaUrl — pass the content placement type (e.g. inline-cta, reel, video-description) based on platform
- [x] Add `utm.getForPlatform` tRPC procedure — returns the canonical UTM params (source, medium, content) for a given platform
- [x] Update all content generation procedures (generateBlog, generateContent, generateScript, generateEmail) to pass utm_content based on platform
- [x] Add UTM preview badge to Command Center blog detail modal — show the injected UTM URL with source/medium/campaign/content chips
- [x] Add UTM preview to Creation Studio output panels — show the CTA URL with UTM params after generation
- [x] Wire UTM Generator quick presets to auto-populate from the CTA block's campaign slug
- [x] Write vitest tests for appendUtmToCtaUrl with utm_content, and the getForPlatform procedure
- [x] TypeScript check and checkpoint v126

## v127: UTM Override + CTA Infographic Banner + Campaign Validation

- [x] Add utm_content override dropdown to Creation Studio form (platform-specific presets from CONTENT_PRESETS taxonomy)
- [x] Wire utmContentOverride through all generation procedures (generateContent, generateBlog, generateScript, generateEmail)
- [x] Add Copy Full UTM URL button to Command Center UTM panel — builds complete URL, saves to UTM Builder history
- [x] Remove old per-card Copy UTM button from Kanban card (replaced by detail modal panel button)
- [x] Add KNOWN_CAMPAIGNS list to ctaRouter.ts (synced from UTMGenerator CAMPAIGNS)
- [x] Add server-side campaign slug validation in ctaLabelToCampaign — warn if slug not in KNOWN_CAMPAIGNS
- [x] Surface campaign validation warning in Command Center blog detail modal
- [x] Replace CTA banner AI photo generation with branded SVG/canvas infographic (headline, benefit subtext, CTA button, Urban Monk brand colors, no faces)
- [x] Update generateCtaBanner and blog.regenerateBanner to produce infographic-style output
- [x] Write vitest tests for campaign validation and utm_content override wiring
- [x] TypeScript check and checkpoint v127

## v128: Campaign Auto-Fix + UTM Dedup + CTA Banner Text Overlay

- [x] Add GA4 campaign auto-fix: when campaignValidationWarning fires after WP publish, show "Fix Campaign" button in toast/modal that opens a dropdown of 14 known slugs
- [x] Add blog.fixCampaignSlug tRPC mutation — replaces utm_campaign= in textContent with the corrected slug and saves
- [x] Add UTM Builder history deduplication: before utm.save, check if identical URL already exists and skip insert
- [x] Install node-canvas package on server
- [x] Build compositeCtaBanner(imageUrl, headline, ctaButtonLabel) helper in server/bannerComposite.ts — downloads image, draws headline + button label text overlay using node-canvas, uploads result to S3
- [x] Wire compositeCtaBanner into generateBlog CTA banner step (after image generation)
- [x] Wire compositeCtaBanner into blog.regenerateBanner procedure
- [x] Write vitest tests for UTM dedup logic and banner composite helper
- [x] TypeScript check and checkpoint v128

## v129: Font Upgrade + Re-Publish + UTM Dedup Toast

- [x] Download Montserrat-Bold.ttf and Montserrat-Regular.ttf to server/fonts/
- [x] Register fonts in bannerComposite.ts via registerFont() and use them for headline + button label
- [x] Add Re-Publish to WordPress button in Fix Campaign panel (calls wpPublishMutation after fixCampaignSlugMutation succeeds)
- [x] Show "Already saved" toast when utm.save returns duplicate:true
- [x] Write vitest tests for font registration path and dedup toast logic
- [x] TypeScript check and checkpoint v129

## v130: Banner Preview + Bulk Campaign Fix + Font Scaling Tests

- [x] Add CTA banner thumbnail preview to Creation Studio blog output panel (shown after blog generation, links to full-size banner)
- [x] Add `blog.bulkFixCampaigns` tRPC mutation — validates all published posts and fixes mismatched utm_campaign slugs in batch
- [x] Add "Fix All Mismatched Campaigns" button to Command Center header (blog filter active) with progress toast
- [x] Add vitest font size auto-scaling tests for bannerComposite.ts (short/medium/long headline tiers)
- [x] TypeScript check and checkpoint v130

## v131: LinkedIn Newsfeed (Doovo Replacement)

- [x] Add `newsfeed_articles` table to drizzle schema (id, title, source, url, imageUrl, description, commentary, topic, status, fetchedAt, approvedAt)
- [x] Add `server/newsfeed.ts` — fetchGoogleNewsRSS() and fetchPubMedArticles() helpers
- [x] Add `server/newsfeedCommentary.ts` — generateCommentary() using invokeLLM with Pedram voice system prompt
- [x] Add `newsfeed` tRPC router with: getArticles, refreshFeed, approveArticle, dismissArticle, regenerateCommentary
- [x] Register newsfeed router in server/routers.ts
- [x] Build `client/src/pages/LinkedInNewsfeed.tsx` — 3-column card grid matching Doovo layout
- [x] Add Newsfeed route and sidebar nav entry in App.tsx
- [x] Add daily scheduled refresh endpoint `/api/scheduled/newsfeed-refresh`
- [x] Wire approve → creates LinkedIn ContentItem in Command Center Kanban
- [x] Write vitest tests for RSS parser, PubMed fetcher, and commentary prompt
- [x] TypeScript check and checkpoint v131

## v132: Newsfeed Auto-Refresh + Buffer Push

- [x] Add `newsfeed.pushToBuffer` tRPC procedure — sends approved article's commentary to Buffer LinkedIn profile
- [x] Add "Push to Buffer" button on approved article cards in LinkedInNewsfeed.tsx
- [x] Show Buffer push status (pending / success / error) per article card
- [x] Store `bufferSentAt` timestamp on newsfeed_articles schema
- [x] Run db:push after schema change
- [x] Set up daily 7 AM Manus scheduled task to POST to /api/scheduled/newsfeed-refresh
- [x] Write vitest tests for Buffer push procedure
- [x] TypeScript check and checkpoint v132

## v133: Article Link Always Embedded in Buffer Push

- [x] Update `generateCommentary()` system prompt to always reference the source article naturally (e.g. "I came across this piece from [Source]..." or "Worth reading from [Source]:") and end with the article URL so the post invites click-through
- [x] Update `newsfeed.pushToBuffer` procedure to always pass `articleUrl` as the Buffer `linkUrl` attachment parameter
- [x] Update `pushToBuffer()` in buffer.ts to accept and pass `linkUrl` for LinkedIn posts
- [x] Update the approved article card UI to show the source article URL as a visible "via [Source]" link
- [x] Update the detail dialog to show the article link in the commentary preview section
- [x] Write vitest tests for the updated commentary prompt and link attachment logic
- [x] TypeScript check and checkpoint v133

## v134: X/Twitter Toggle on Newsfeed Buffer Push

- [x] Add `generateXVersion()` helper in `newsfeedCommentary.ts` — LLM condenses LinkedIn commentary to ≤280 chars for X, preserving the key insight and article URL
- [x] Add `xVersion` column to `newsfeed_articles` schema (text, nullable) and run db:push
- [x] Update `newsfeed.pushToBuffer` procedure to accept `includeX: boolean` — when true, also pushes a condensed version to all connected X channels
- [x] Update `newsfeed.approveArticle` to pre-generate the X version alongside commentary
- [x] Update `newsfeed.regenerateCommentary` to also regenerate the X version
- [x] Add X toggle checkbox and X preview textarea in the ArticleDetailDialog
- [x] Show X toggle on the ApprovedArticleCard Buffer push button area
- [ ] Write vitest tests for generateXVersion and the dual-push procedure
- [x] TypeScript check and checkpoint v134

## v135: Buffer URL/Image Conflict Fix + X Toggle UX
- [x] Fix Buffer push — remove standalone `imageUrl` so link preview card is never overridden by image
- [x] Pass article image only as `linkAsset.thumbnailUrl` so LinkedIn renders rich link preview card
- [x] Add `includeX` boolean column to `newsfeed_articles` schema and run db:push
- [x] Update `approveArticle` to accept and persist `includeX` preference
- [x] Move X toggle to Pending article cards (set before approving)
- [x] Move X toggle to ArticleDetailDialog for both pending and approved articles
- [x] Pre-fill X toggle on Approved cards from stored `includeX` preference
- [x] TypeScript check (0 errors) and checkpoint v135

## v137: Custom Thumbnail Image on Buffer Push
- [x] Update `newsfeed.pushToBuffer` to use standalone `imageUrl` attachment (not linkAttachment) — article URL goes in post text
- [x] Add image URL input field to the Buffer push dialog in LinkedInNewsfeed.tsx (pre-filled with article imageUrl if available)
- [x] Allow user to paste their own image URL before pushing
- [x] Ensure article URL is always appended to post text as a plain link
- [ ] TypeScript check and checkpoint v137

## v142 — Image inside link card (thumbnailUrl in linkAttachment)

- [x] buffer.ts: include thumbnailUrl inside linkAttachment when linkAsset.thumbnailUrl is set
- [x] buffer.ts: remove standalone imageUrl for LinkedIn entirely (image travels inside link card)
- [x] newsfeedRouter.ts: pass customImageUrl as linkAsset.thumbnailUrl (not as params.imageUrl)
- [x] LinkedInNewsfeed.tsx: update thumbnail input label to "Image for link card"
- [x] Run TypeScript check + tests, save v142 checkpoint

## v143 — Fix URL missing from Buffer posts (Bing News RSS migration)
- [x] Diagnosed root cause: Google News RSS stores opaque `news.google.com/rss/articles/CBMi...` redirect URLs that cannot be resolved server-side
- [x] Replaced Google News RSS fetcher with Bing News RSS fetcher (real article URLs extracted from `url=` query param in Bing redirect links)
- [x] Updated TOPIC_CLUSTERS to use `bingQuery` instead of `googleQuery`
- [x] Updated newsfeedRouter.ts to import `fetchBingNewsRSS` instead of `fetchGoogleNewsRSS`
- [x] Updated newsfeed.test.ts with Bing RSS test cases (properly escaped XML + namespace declarations)
- [x] All 287 tests passing, 0 TypeScript errors
- [x] Save v143 checkpoint and deploy

## v144 — Fix URL appearing zero or twice in Buffer posts
- [x] Remove URL from postText entirely — URL now travels exclusively via metadata.linkedin.linkAttachment
- [x] LinkedIn link card renders the URL once as a preview card (no duplicate in post text)
- [x] All 287 tests passing, 0 TypeScript errors
- [x] Save v144 checkpoint

## v147 — Fix URL dropped between LinkedIn Newsfeed approval and Command Center
- [x] Trace approval flow: find where article.url is lost between newsfeedRouter approval and Command Center post display
- [x] Fix URL preservation through approval so Command Center post includes the article URL
- [x] Run TypeScript check + tests, save v147 checkpoint

## v148 — Fix deployment: replace canvas native module with @napi-rs/canvas
- [x] Remove canvas (requires pixman/cairo system libs not in deployment container)
- [x] Install @napi-rs/canvas (pre-built WASM, works on musl Linux without native compilation)
- [x] Update bannerComposite.ts: GlobalFonts.registerFromPath, canvas.encode("jpeg", 88)
- [x] 287 tests passing, 0 TypeScript errors

## v149 — Daily auto-refresh LinkedIn Newsfeed via scheduled task
- [x] Add POST /api/scheduled/refresh-newsfeed endpoint (user-role allowed, triggers fetchAndStoreBingNews)
- [x] Run TypeScript check + tests, save checkpoint, deploy
- [x] Create daily scheduled task (7am CDT) that POSTs to the endpoint

## v150 — Fix TikTok: zero posts being pushed
- [x] Investigate TikTok in codebase and Buffer channel setup
- [x] Fix root cause: add tiktok to generateContent all-platforms array (line 477 routers.ts)
- [x] Run TypeScript check + tests, save checkpoint

## v151 — Fix repetitive "For your attention" opener in LinkedIn commentary
- [x] Replace "Worth your attention" example in PEDRAM_VOICE_SYSTEM prompt with 8 varied opener examples
- [x] Add explicit NEVER rules: no "For your attention", no "Worth your attention", vary structure not just words
- [x] Run TypeScript check + tests, save checkpoint

## v152-v159 — Viral Studio: 8 Growthopia-Replacement Features

### Feature 1: Hook Generator (5 psychology frameworks)
- [x] DB schema: hook_generations table
- [x] Server: hookRouter.ts with generateHooks procedure
- [x] UI: HookGenerator.tsx page
- [x] Wire into App.tsx navigation under Viral Studio

### Feature 2: Full Video Script Generator (Social SEO + DM CTA)
- [x] Server: scriptRouter.ts with generateScript procedure
- [x] UI: ScriptGenerator.tsx page (hook → problem → value → CTA structure)
- [x] Social SEO keyword integration in spoken audio
- [x] Wire into App.tsx navigation

### Feature 3: Content Repurposing Engine (books/podcasts → multi-platform)
- [x] DB schema: repurpose_jobs table
- [x] Server: repurposeRouter.ts with repurposeContent procedure
- [x] UI: RepurposeEngine.tsx page with source input + platform output cards
- [x] Wire into App.tsx navigation

### Feature 4: Viral Topic Generator (trending + niche)
- [x] Server: topicRouter.ts with generateTopics procedure (Bing News + LLM)
- [x] UI: TopicGenerator.tsx page with ranked topic list + hook angles
- [x] Wire into App.tsx navigation

### Feature 5: Social SEO Caption Optimizer
- [x] Server: captionRouter.ts with optimizeCaption procedure
- [x] UI: CaptionOptimizer.tsx page (platform selector + keyword + output)
- [x] Wire into App.tsx navigation

### Feature 6: DM Automation Playbook Generator
- [x] Server: dmPlaybookRouter.ts with generatePlaybook procedure
- [x] UI: DMPlaybook.tsx page (trigger word + 3-message DM sequence + lead magnet)
- [x] Wire into App.tsx navigation

### Feature 7: Performance Analytics Dashboard
- [x] Server: analyticsRouter.ts with getBufferAnalytics + generateNarrative procedures
- [x] UI: AnalyticsDashboard.tsx page with charts + monthly narrative
- [x] Wire into App.tsx navigation

### Feature 8: Sub-Account Content Testing System
- [x] DB schema: test_variants, test_results tables
- [x] Server: testingRouter.ts with createVariant, trackResult, getWinners procedures
- [x] UI: ContentTesting.tsx page (A/B hook variants + performance tracking)
- [x] Wire into App.tsx navigation

### Integration & Polish
- [x] Add "Viral Studio" section to sidebar navigation with all 8 features
- [x] TypeScript check passes (0 errors)
- [x] All tests pass
- [x] Save checkpoint + deploy

## v153 — Viral Studio Integrations

### Feature A: Hook Generator → A/B Test Lab Pipeline
- [x] Add server procedure: viralStudio.sendHookToABLab (creates testVariant from hook text)
- [x] Add "Send to A/B Test Lab" button on each hook card in HookGenerator.tsx
- [x] Show success toast with link to A/B Test Lab after variant is created
- [x] Auto-populate variant fields: hookText, framework, topic, platform

### Feature B: Viral Studio Quick-Access Card on Command Center
- [x] Add server procedures: viralStudio.getRecentHooks (last 3), viralStudio.getWinningVariant
- [x] Build ViralStudioWidget.tsx component with 3 recent hooks + winning variant + "Generate Topic" CTA
- [x] Embed widget in CommandCenter.tsx dashboard above or alongside the Kanban board
- [x] "Generate Topic" CTA navigates to /viral-studio with topics tab pre-selected

### Feature C: Repurpose Engine → Kanban "Save all to Command Center"
- [x] Add server procedure: content.createBulk (creates multiple draft content_items at once)
- [x] Add "Save all to Command Center" button in RepurposeEngine.tsx after repurpose completes
- [x] Map each platform output to a content_item (platform, title, textContent, status=idea)
- [x] Show success toast with count of cards created and link to Command Center
- [x] TypeScript check, tests, checkpoint

## v154 — Viral Studio Cross-Feature Wiring

### Feature A: A/B Lab → Kanban "Promote Winner"
- [x] Add "Promote winner to Kanban" button on winning variant card in ABTestLab.tsx
- [x] On click: call content.create with hook text as title/rawIdea, platform from test, status=idea
- [x] Show success toast with link to Command Center after card is created
- [x] Disable button (show "Promoted") after first click to prevent duplicates

### Feature B: Command Center Viral Studio Widget — "Repurpose this book" CTA
- [x] Add viralStudio.getLastRepurposeBook server procedure (returns sourceTitle of most recent repurpose job)
- [x] Add "Repurpose this book" button below "Generate Today's Topic" in the Command Center widget
- [x] Button navigates to /viral-studio?tab=repurpose&book=<lastBook> (or just /viral-studio with repurpose tab)
- [x] Show last-used book name on the button label

### Feature C: Hook Generator → Script Generator "Build full script"
- [x] Add shared state (URL param or context) to pass hook text + platform to Script Generator tab
- [x] Add "Build full script from this hook" button on each hook card in HookGenerator.tsx
- [x] On click: navigate to /viral-studio?tab=script&hook=<hookText>&platform=<platform>
- [x] Script Generator reads URL params on mount and pre-fills the hook field
- [x] TypeScript check, tests, checkpoint

## v155 — Viral Studio Image & Kanban Wiring

### Feature A: Hook Card → Image Generator
- [x] Add "Generate image for this hook" button on each HookCard in HookGenerator.tsx
- [x] On click: navigate to /creation-studio?hookText=<hook>&platform=<platform> (or open inline image dialog)
- [x] Pre-select platform brand style in image generator based on hook's platform
- [x] Show generated image inline on the hook card (optional preview)

### Feature B: Script Generator → Kanban "Save script to Command Center"
- [x] Add "Save script to Command Center" button on ScriptDisplay component after script is generated
- [x] On click: call content.create with title=topic, platform, textContent=fullScript, status=drafting
- [x] Show success toast with link to Command Center after card is created
- [x] Disable button (show "Saved") after first save to prevent duplicates
- [x] TypeScript check, tests, checkpoint

## v157 — Video Variant Factory (Hook + Body → Multi-Variant MP4)

### DB Schema
- [x] Add video_variant_jobs table (id, userId, jobName, status, createdAt, completedAt)
- [x] Add video_clips table (id, jobId, clipType: hook|body|cta, s3Key, s3Url, filename, durationSeconds, clipOrder, createdAt)
- [x] Add video_variants table (id, jobId, hookClipId, bodyClipId, variantLabel, s3Key, s3Url, status, createdAt)
- [x] Run pnpm db:push

### Server
- [x] Add POST /api/upload/video-clip endpoint for direct MP4 upload to S3
- [x] Add FFmpeg stitching worker: concatenate hook + body (+ optional CTA) per combination
- [x] Add videoVariantRouter.ts: createJob, getJob, listJobs, startProcessing, deleteJob procedures
- [x] Register videoVariantRouter in routers.ts

### UI: VideoVariantFactory page
- [x] Upload zone: drag-and-drop or file picker for hook clips (up to 10) + body clip + optional CTA
- [x] Clip list: labeled clips (Hook 1, Hook 2, Body, CTA), duration, delete button
- [x] "Generate Variants" button: triggers FFmpeg stitching for all hook+body combos
- [x] Job status: polling (Queued → Processing → Done) with per-variant progress
- [x] Variants panel: completed variants with download MP4 button and "Send to Kanban" button
- [x] History: past jobs with variant count and download-all button

### Navigation
- [x] Add "Video Variants" to DashboardLayout sidebar under Viral Studio
- [x] Add route /video-variants in App.tsx

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass
- [x] Save checkpoint

## v158 — Video Production Session (Unified Idea → Teleprompter → Record → Splice Workflow)

### Goal
Replace the fragmented Viral Studio tabs with a single linear "Video Production Session" that takes Dr. Shojai from idea to teleprompter-ready scripts, then picks back up when he returns with the recorded MP4s.

### Phase A: DB Schema
- [x] Add video_production_sessions table (id, userId, sessionName, idea, platform, status: scripting|ready_to_record|uploading|stitching|done, createdAt)
- [x] Add session_scripts table (id, sessionId, scriptType: hook|body|cta, scriptOrder, scriptText, approved: bool, approvedAt)
- [x] Run pnpm db:push

### Phase B: Server
- [x] Add videoSessionRouter.ts with procedures:
  - [x] createSession (idea, platform, sessionName)
  - [x] generateScripts (sessionId) — LLM generates 5 hooks + 1 body + 1 CTA in one call
  - [x] updateScript (scriptId, scriptText) — inline edit
  - [x] approveScript (scriptId, approved) — toggle approved
  - [x] approveAll (sessionId) — approve all scripts at once
  - [x] exportTeleprompter (sessionId) — returns DOCX blob of all approved scripts
  - [x] getSession (sessionId) — full session with scripts + clips + variants
  - [x] listSessions (limit) — history
- [x] Register videoSessionRouter in routers.ts

### Phase C: UI — VideoProductionSession page
- [x] Step 1 "Idea" panel: session name, idea input, platform selector, "Generate Scripts" button
- [x] Step 2 "Review Scripts" panel: 5 hook cards + body card + CTA card, each with inline edit textarea, approve toggle, character count
- [x] "Approve All" button at top of review panel
- [x] Step 3 "Teleprompter" panel: full-screen clean teleprompter view of approved scripts (large white text on black, scrollable), "Export DOCX" button
- [x] Step 4 "Upload Recordings" panel: upload zone per approved script (Hook 1 MP4, Hook 2 MP4, Body MP4, CTA MP4), each labeled with the script text preview
- [x] Step 5 "Variants" panel: auto-stitch status + download buttons (reuses FFmpeg worker from v157)
- [x] Session history sidebar: list of past sessions with status badges

### Phase D: Navigation & Integration
- [x] Replace /viral-studio route with the new VideoProductionSession as the primary entry point
- [x] Keep old Viral Studio tools (Hook Generator, Script Generator, etc.) accessible via a "Tools" sub-tab for power users
- [x] Add "New Video Session" CTA to Command Center Viral Studio widget
- [x] TypeScript check passes (0 errors)
- [x] All tests pass
- [x] Save checkpoint

## v159 — Video Production → A/B Test Lab Auto-Wiring

### Goal
After FFmpeg stitching completes in the Video Variant Factory, auto-create one A/B test entry per hook variant so performance data flows back into the Viral Studio.

### Server
- [x] Add autoCreateABTests(jobId) helper in videoVariantRouter.ts: after all variants are done, query session_scripts for hook scripts, create test_variants rows per variant
- [x] Add videoVariant.getLinkedABTests tRPC procedure: returns test_variant rows linked to a job
- [x] Link video_variants to test_variants via session lookup (job → session → hook scripts)

### UI — VideoVariantFactory variants panel
- [x] After stitching completes, show "A/B Tests Created" amber badge with test count
- [x] Show each auto-created test name with active status badge
- [x] "View in A/B Test Lab →" button links to /viral-studio?tab=testing

### UI — A/B Test Lab
- [x] Tests from Video Production sessions appear in the A/B Test Lab with hook scripts as variantA/B
- [x] Video URLs stored in notes field for reference

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass
- [x] Save checkpoint

## v160 — A/B Test Lab Performance Data + Hook Generator Framework Feedback Loop

### Goal
Add view count, watch time, and CTR inputs per variant in the A/B Test Lab. When a winner is declared, log the winning hook's framework and platform to a new framework_performance table. The Hook Generator reads this table and surfaces the top-performing framework as a highlighted recommendation.

### DB Schema
- [x] Add performance metric columns to test_variants: viewCountA, viewCountB, watchTimeA, watchTimeB, ctrA, ctrB (all nullable integers/floats)
- [x] Add framework_performance table: id, userId, platform, framework, winCount, totalTests, lastWonAt
- [x] Run pnpm db:push

### Server
- [x] Add viralStudio.recordPerformance procedure: update viewCount/watchTime/ctr for variantA or variantB (stored as JSON in notes field)
- [x] Update viralStudio.declareWinner: after declaring winner, upsert framework_performance row for the winning framework+platform
- [x] Add viralStudio.getTopFrameworks procedure: returns top 3 frameworks per platform ordered by winCount

### UI — A/B Test Lab
- [x] Add "Record Performance" expandable section per test card with view count, watch time %, CTR % inputs for each variant
- [x] Show performance metrics on the test card when they exist
- [x] Winner declaration now shows which framework won and logs it (winnerFramework dropdown in dialog)
- [x] Show "Data-driven winner" badge when winner was declared with performance data

### UI — Hook Generator
- [x] Add viralStudio.getTopFrameworks query at top of HookGenerator
- [x] Show "Top performing for [platform]" badge on the framework selector button that matches the top framework
- [x] Add a "Recommended" chip on the framework with the highest win rate for the selected platform

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint

## v161 — Analytics Dashboard Framework Chart + Script Generator Pre-selection + A/B CSV Export

### Analytics Dashboard — Framework Win-Rate Chart
- [x] Add getTopFrameworks query to AnalyticsDashboard.tsx (all platforms)
- [x] Render a bar chart (Recharts BarChart) showing win rate % per framework per platform
- [x] Add platform filter tabs (All / TikTok / Instagram / LinkedIn / YouTube / X)
- [x] Show "No data yet — declare winners in A/B Test Lab to populate" empty state

### Script Generator — Framework Pre-selection from URL
- [x] Read `framework` URL param in ScriptGenerator.tsx (alongside existing hook/platform/topic params)
- [x] Show amber banner with top-performing framework name when `framework` param is present
- [x] Update HookGenerator "Build full script →" link to include `framework` param (top-performing framework for the platform)

### A/B Test Lab — CSV Export
- [x] Add "Export CSV" button to A/B Test Lab header
- [x] Build client-side CSV from allTests data (testName, topic, platform, variantType, variantA, variantB, winner, winnerReason, views, watchTime%, CTR%, engagementRate per variant)
- [x] Trigger browser download of the CSV file

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v161

## v162 — Hook Generator "Push All to Script Generator" Batch Workflow

### Hook Generator
- [x] Add inline edit mode on each hook card (pencil icon → editable textarea for the hook text)
- [x] Add "Push All to Script Generator" primary button below the hook results panel
- [x] Button serializes all hooks (with any inline edits) + topic + platform + topFramework into URL params as a JSON-encoded batch
- [x] Show count badge on button: "Push All (5 hooks) to Script Generator →"

### Script Generator — Batch Queue Mode
- [x] Detect `hookBatch` URL param (JSON array of {hook, framework})
- [x] When batch present: show a "Batch Queue" panel listing all hooks with their framework labels
- [x] Each hook in the queue has a status: pending / generating / done
- [x] "Generate All Scripts" button: processes each hook sequentially, showing progress
- [x] Each completed script expands inline in the queue with copy + save-to-Kanban buttons
- [x] "Generate" individual hook button on each queue item for selective generation
- [x] Clear batch / switch to single mode button

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v162

## v163 — Batch Save All, Topic Auto-fill, Hook History Edit

### Script Generator
- [x] Batch Save All to Kanban: add a "Save All to Command Center" button at the bottom of the batch queue panel that saves every completed script in one click
- [x] Topic auto-fill: when batch arrives via URL params, read `batchTopic` param and pre-populate the Topic field so the queue is ready to run immediately
- [x] Batch mode banner shows topic auto-fill confirmation inline

### Hook Generator — Recent Generations History
- [x] Add inline pencil-edit mode to each hook in the Recent Generations accordion (same UX as current hook cards)
- [x] Add "Push All to Script Generator" button inside each historical generation so older batches can be re-sent with edits
- [x] Edited hooks in history use the same editedHooks state pattern as current results

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v163

## v164 — Auto-start Countdown, Kanban Toast, Score Badges

### Script Generator — Auto-start Countdown
- [x] When batch arrives from Hook Generator AND topic is auto-filled, show a 3-second countdown in the batch banner ("Auto-starting in 3... 2... 1...")
- [x] Cancel button stops the countdown and leaves queue in manual mode
- [x] After countdown reaches 0, trigger Generate All automatically
- [x] Countdown only fires when both batchItems and topic are present (not on manual batch entry)

### Script Generator — Kanban Toast with Navigation
- [x] After Save All succeeds, show a toast with a "View in Kanban →" action button
- [x] Clicking the toast link navigates to /command-center (Drafting column)
- [x] Toast persists for 8 seconds (longer than default) so user has time to click

### Hook Generator — Viral Score Badges in History
- [x] In the ResultCard (Recent Generations accordion), show top 3 score badges in the collapsed header row
- [x] Score badges are color-coded: green (≥4), amber (3), gray (≤2)
- [x] Average score shown next to badges
- [x] Badges hidden when accordion is expanded to reduce clutter

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v164

## v165 — Drafting Auto-highlight, Single Hook Regen, Persona Presets

### Command Center — Drafting Column Auto-highlight
- [x] Read `column` URL param on arrival (e.g. ?column=drafting)
- [x] When column=drafting, auto-scroll to the Drafting column and add green ring highlight for 3 seconds
- [x] Clear the URL param after reading to keep the URL clean

### Hook Generator — Regenerate Single Hook
- [x] Add a refresh/rotate icon button on each HookCard (green on hover)
- [x] Clicking it calls viralStudio.regenerateSingleHook tRPC procedure with topic, platform, framework
- [x] While regenerating, show a spinner on that card only (other cards unaffected)
- [x] Replace the hook text with the new result; show "Regenerated" badge briefly (3 seconds)
- [x] Added regenerateSingleHook procedure to server/viralStudioRouter.ts

### Script Generator — Persona Presets
- [x] Added 4 quick-select persona chips above the Target Persona input:
  - "Stressed professional, 40s, low energy"
  - "Health-conscious parent, 35-50"
  - "Biohacker, 30s, optimizing performance"
  - "Spiritual seeker, 50s, seeking purpose"
- [x] Clicking a chip fills the input and highlights it; clicking again clears (toggle)
- [x] Custom text typed in the input deselects all chips

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v165

## v166 — Persona Chips in Hook Generator, Regenerate All, Length Presets

### Hook Generator — Persona Preset Chips
- [x] Add persona preset chips to the main HookGenerator form (same 4 presets as Script Generator)
- [x] Pass persona to generateHooks mutation so the AI tailors hooks to the persona
- [x] Pass persona through handlePushAll URL params (batchPersona param) so Script Generator receives it in batch mode
- [x] Persona chips: "Stressed professional, 40s, low energy" / "Health-conscious parent, 35-50" / "Biohacker, 30s, optimizing performance" / "Spiritual seeker, 50s, seeking purpose"

### Hook Generator — Regenerate All Button
- [x] Added "Regenerate All" button at top of results panel (next to platform badge)
- [x] Clicking fires generateHooks mutation with same topic/platform/persona — replaces all 5 hooks
- [x] Shows loading spinner on the button while regenerating
- [x] Passes persona in the regenerateAll call so new hooks stay persona-aware

### Script Generator — Length Presets
- [x] Added 4 quick-select duration pill buttons above the length dropdown: 30s / 60s / 90s / 3 min (180s)
- [x] Clicking a preset sets the dropdown value and highlights the active button
- [x] Dropdown still available for 2-minute option and custom values
- [x] Presets styled as pill buttons consistent with persona chips

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v166

## v167 — Persona Persistence, Batch Persona Auto-fill, Topic Suggestions

### Persona Persistence
- [x] Add viralStudio.savePersona procedure: upsert a user_preferences row with lastPersona field
- [x] Add viralStudio.getPersona procedure: return the saved persona for the current user
- [x] HookGenerator: on mount, load saved persona; on persona change, debounce-save to server
- [x] ScriptGenerator: on mount, load saved persona; on persona change, debounce-save to server

### Script Generator — Batch Persona Auto-fill
- [x] Read batchPersona URL param in ScriptGenerator main component
- [x] Pass batchPersona into BatchQueuePanel as a prop
- [x] Wire batchPersona into the generateOne mutation call (targetPersona field)
- [x] batchPersona cleared from URL after reading

### Hook Generator — Topic Suggestions
- [x] Add viralStudio.suggestTopics procedure: given platform + persona, return 5 topic ideas
- [x] Add "Suggest topics" button next to the Topic field label (violet, with Zap icon)
- [x] Clicking shows an inline panel with 5 AI-generated topic cards (topic + angle)
- [x] Clicking a topic fills the Topic textarea and closes the panel
- [x] Dismiss (X) button on the suggestions panel
- [x] Show loading spinner on the button while AI generates

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v167

## v168 — Persona Suggestions, Topic History, Script Library Search

### Server
- [x] Add viralStudio.suggestPersonas procedure: given platform + topic, return 4 persona descriptions
- [x] Add viralStudio.saveTopicHistory procedure: upsert last 10 topics for the user in viralUserPreferences
- [x] Add viralStudio.getTopicHistory procedure: return last 5 topics for the user

### Hook Generator — Persona Suggestions
- [x] Add "Suggest persona" button (Users icon, blue) next to the Target Persona label
- [x] On click, call suggestPersonas mutation with current platform + topic
- [x] Show inline panel with 4 persona suggestion cards; clicking fills the persona field
- [x] Show loading spinner while AI generates

### Hook Generator — Topic History
- [x] On successful hook generation, save the topic to history via saveTopicHistory
- [x] Show a "Recent topics" dropdown below the Topic textarea when it has focus and history exists
- [x] Clicking a recent topic fills the textarea and closes the dropdown
- [x] Show last 5 topics in reverse-chronological order

### Script Generator — Persona Suggestions
- [x] Add "Suggest persona" button (Users icon, blue) next to the Target Persona label
- [x] Same inline panel UX as Hook Generator

### Script Library — Search & Filter
- [x] Existing search input already searches title, body, notes; extended to also search competitorAngle
- [x] Added Content Goal filter dropdown (Audience Growth / LLM SEO / Community Engagement)
- [x] activeFilterCount updated to include goalFilter
- [x] Clear filters button resets all filters including goalFilter
- [x] Result count shown ("X of Y scripts")

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v168

## v169 — Keyword-Reply CTAs + UTM Code Generator

### Video Production Modal — Keyword-Reply CTAs
- [x] Added CtaKeywordPanel component below the CTA ScriptCard in VideoProductionSession
- [x] Auto-suggests keyword from the session idea (first meaningful word, uppercased)
- [x] 3 platform-specific CTA templates per platform (TikTok/IG/YouTube/LinkedIn/X/Meta)
- [x] Keyword input (all-caps enforced, max 20 chars)
- [x] Template selector shows all 3 options with live preview
- [x] Final CTA copy shown with one-click copy button
- [x] UTM hint linking to UTM Code Generator in Strategy

### UTM Code Generator
- [x] UTM Generator already existed at /utm with full taxonomy
- [x] Added VIDEO_KEYWORD_PRESETS section: 4 platform paths (TikTok/IG/YouTube/LinkedIn) with keyword-reply content type
- [x] Keyword-Reply Paths card shown prominently at top with sky-blue styling
- [x] Instructions: select path → enter keyword in Term field → keyword becomes utm_term in GA4
- [x] MessageSquare icon imported and used in the new card
- [x] applyVideoPreset handler clears term field so user enters their keyword

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v169

## v170 — Analytics Dashboard Platform Comparison Chart

### Server
- [x] Add getAllPlatformFrameworks procedure — returns all framework_performance rows for user, grouped by platform, with winRate computed
- [x] Register procedure in viralStudioRouter exports

### Analytics Dashboard UI
- [x] Add PlatformComparisonChart component below the existing FrameworkChart
- [x] Grouped bar chart: X-axis = framework names, grouped bars per platform (TikTok/IG/YouTube/LinkedIn/X)
- [x] Each platform gets a distinct color; Legend shows platform colors
- [x] Platform toggle pills to show/hide individual platforms from the chart
- [x] Tooltip shows: platform, framework, win rate %, wins/tests
- [x] Empty state if no cross-platform data yet
- [x] "Best framework per platform" summary table below chart

### Quality
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v170

## v171 — Video Variant Factory ffmpeg Fix
- [x] Install ffmpeg-static so stitching works in deployed Cloud Run environment
- [x] Wire ffmpeg-static path into videoVariantRouter so fluent-ffmpeg uses the bundled binary
- [x] Fix clips merge logic — body clip no longer lost when hooks are already on server
- [x] Add "Replace Body Clip" button so user can swap body without deleting the job
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)

## v172 — Video Variant Factory Body Clip Stall Fix (Deep Fix)
- [x] Diagnose root cause: Cloud Run times out the HTTP connection before server can respond after S3 upload
- [x] Rewrite videoUploadHandler to respond 202 immediately after multer receives the file
- [x] S3 upload + DB insert now run in processUploadInBackground() after response is sent
- [x] Frontend XHR now accepts 202 as success and enters a polling loop (every 2s, up to 3 min)
- [x] Progress bar caps at 90% during transfer, jumps to 95% while server processes, clears when clip appears
- [x] handleGenerate updated to use merged hookClips/bodyClips derived state (not just uploadedClips)
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)

## v173 — Kajabi URL + ManyChat Setup Wizard
- [x] Add kajabiUrl field to dmPlaybooks schema and push migration
- [x] Add kajabiUrl input to DM Playbook generator form
- [x] Include Kajabi URL in generated DM copy (Message 1 delivery link)
- [x] Build ManyChat Setup Wizard page with step-by-step VA instructions
- [x] Wire Wizard to active playbook keyword and Kajabi URL
- [x] Add ManyChat Wizard to sidebar nav and App.tsx routes
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287+)

## v174 — Video Upload Middleware Order Fix
- [x] Move /api/upload/video-clip route BEFORE express.json() body parser in index.ts
- [x] Add multer error handler middleware for 413/400 errors with JSON response
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)

## v178 — Video Variant Factory: Two Output Paths
- [ ] Audit existing Buffer integration in the codebase
- [ ] Research Meta Marketing API video upload / ad creative requirements
- [ ] Add Buffer bulk-syndication: send all done variants to Buffer simultaneously (one click)
- [ ] Add Meta Ads API: bulk upload variants as ad video creatives into Meta Ads Manager
- [ ] Update VideoVariantFactory output panel with two-path UI (Buffer path vs Meta Ads path)
- [ ] Add Meta credentials (Ad Account ID, Page ID, Access Token) via secrets
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287+)

## v183 — Hook Generator + Script Generator: Expanded Pillar Chips
- [x] Replace 7-chip flat row in HookGenerator.tsx with two labeled scrollable rows
- [x] Health row (10 chips): Gut Health, Longevity, Sleep, Stress, Brain, Energy, Detox, Fasting, Hormones, Supplements
- [x] Mind row (10 chips): Consciousness, Enlightenment, Metaphysics, Non-Duality, Quantum Mind, Taoism, Ancient Wisdom, Meditation, Near-Death, Time & Reality
- [x] Apply same two-row scrollable structure to ScriptGenerator.tsx
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287 passing)
- [x] Save checkpoint v183

## v184 — Meandering River Features (Source Tag, Approval Queue, Performance Signal)

- [x] Source Tag Generator: auto-generate UTM attribution tag from keyword + platform + topic; append to Kajabi opt-in URL in DM Playbook; display tagged URL with copy button
- [x] Content Approval Queue: add "pending_approval" to contentStatusEnum; add Pending Approval Kanban column before Drafting; add Approve/Reject actions on cards; run db:push
- [x] Performance Signal Dashboard: new Viral Studio tab; list content_items with analytics; compute outlier score (views vs avg); flag outliers; Boost with Paid button generates Meta Ads brief
- [x] v184 tests for Source Tag Generator, Approval Queue, and Performance Signal
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287+)

## v184-hotfix — Video Variants Uploader Stall

- [x] Fix polling match logic: body/cta clips use clipOrder 0 but poll finds the FIRST existing clip of that type (false positive from hook 1 already uploaded)
- [x] Fix concurrent upload stall: multiple files trigger uploadClip() in parallel, each racing to mutate uploadingClips state — serialize uploads or fix state race
- [x] Fix hook polling: clipOrder match is correct for hooks but body/cta need exact clipOrder match too
- [x] Deploy fix

## v184-hotfix-2 — Body Video Upload Stalls at 85-90%

- [x] Diagnose: stall is at 85-90% which is the chunked upload phase (not polling) — likely a Cloud Run request body size limit or timeout on large files
- [x] Check if the body video is larger than hook clips and hitting a different limit
- [x] Fix the underlying cause (chunk size, timeout, or finalize race condition for large files)
- [x] Deploy fix

## v184-hotfix-3 — Stitching Job Fails Despite Clips Uploaded

- [x] Fix: placeholder row (empty s3Url) causes stitching job to see 0 valid clips — need to either wait for S3 to finish before allowing Generate, or have server wait for s3Url to populate before stitching
- [x] Fix: client Generate button should be disabled while any clip still has empty s3Url (S3 upload in progress)
- [x] Fix: server startProcessing should wait/retry for clips with empty s3Url before failing
- [x] Deploy fix

## v184-hotfix-4 — S3 Background Upload Hangs for Large Body Video

- [x] Diagnose storagePut hang — single-buffer fetch with no timeout silently hangs for large files
- [x] Fix: replaced storagePutWithSignal with streamUploadToStorage using axios + form-data ReadStream — pipes file directly from disk to proxy without loading into RAM
- [x] Fix: axios timeout set to 20 minutes; maxBodyLength/maxContentLength set to Infinity for large files
- [x] Deploy fix

## v185 — Video Variants Uploader UX

- [x] File size pre-check: show estimated upload + processing time before upload starts (e.g. "~4 min for 400 MB")
- [x] Cloud-save progress indicator: animated pulse + elapsed timer + estimated remaining time during "Saving to cloud" phase
- [x] Server-side upload progress endpoint: track axios stream bytes sent so client can poll real byte progress (deferred — client-side timer is sufficient)
- [x] Retry button: show Retry on failed clip cards so user can re-attempt without page refresh
- [x] TypeScript check passes (0 errors)
- [x] All tests pass (287+)

## v185-hotfix-5 — Gateway HTML Error on Body Video Chunk Upload

- [x] Diagnose: identify which request (which chunk number) triggers the HTML error page
- [x] Fix: replaced multipart FormData with raw binary application/octet-stream + query params — eliminates multipart encoding overhead
- [x] Deploy fix

## v185-hotfix-6 — S3 Upload Hangs Even for Small Files

- [x] Diagnose: storage proxy has ~20 MB limit; files above that hang silently
- [x] Fix: uploadFileSegmented splits assembled file into 14 MB segments, uploads each separately, stores JSON array of URLs in s3Url column
- [x] Fix: downloadToTemp in stitching job detects JSON array and concatenates segments before FFmpeg processing
- [x] TypeScript: 0 errors | Tests: 287 passing
- [x] Deploy fix

## v185-hotfix-7 — Direct S3 Upload via Presigned URLs (Bypass Proxy)

- [x] Diagnose: 20 MB probe succeeded from sandbox but fails in production — issue is Cloud Run outbound bandwidth making each segment take 5-8 min, exceeding the 3 min timeout
- [x] Fix: extended server-side segment upload timeout from 3 min to 10 min per segment
- [x] Fix: extended client-side poll timeout from 5 min to 20 min for large body videos
- [x] TypeScript: 0 errors | Tests: 287 passing
- [x] Deploy fix

## v186 — Stitching Worker Upload Hang Fix

- [x] Diagnose: FFmpeg concat works fine (165 MB output in ~2s). The hang is in the S3 upload step — `storagePut()` uses `fs.readFileSync()` to load the entire stitched file into RAM then sends it via `fetch()` with a Blob body, which silently hangs on Cloud Run for large files (same root cause as the upload handler hang fixed in v184-hotfix-4)
- [x] Fix: replaced `storagePut(readFileSync(outLocal))` with new `uploadFileFromDisk()` function that uses `fs.createReadStream()` + native `https.request()` + `form-data` pipe — streams directly from disk without loading into RAM
- [x] Removed `storagePut` import (no longer needed in videoVariantRouter)
- [x] Added `FormData` (form-data) and `ENV` imports to videoVariantRouter
- [x] TypeScript: 0 errors | Tests: 337 passing

## v186-hotfix — Stitching Hangs: Cloud Run Kills FFmpeg Child Processes

- [x] Diagnose: FFmpeg concat completes in ~2s locally. On Cloud Run, the fire-and-forget background task has no active HTTP request after startProcessing returns, so Cloud Run terminates the container instance and kills the FFmpeg child process before it can complete.
- [x] Fix: Created POST /api/stitch-job/:jobId Express endpoint that runs runStitchingJob() SYNCHRONOUSLY within a long-lived HTTP request, keeping the Cloud Run container alive for the full duration of FFmpeg processing.
- [x] Fix: startProcessing tRPC mutation now only marks the job as "processing" in DB; actual stitching is triggered by the client calling /api/stitch-job/:jobId.
- [x] Fix: Client's handleGenerate fires fetch(/api/stitch-job/:jobId) fire-and-forget after startProcessing returns; UI continues polling getJob() for status as before.
- [x] Exported runStitchingJob from videoVariantRouter.ts so it can be imported by the stitch endpoint.
- [x] TypeScript: 0 errors | Tests: 337 passing

## v186-hotfix2 — Stitching OOM Fix: FFmpeg Pipe Output + Just-in-Time Hook Downloads

- [x] Root cause: Cloud Run OOM kills container mid-stitch. Pre-downloading all 5 hooks (85MB) + body (149MB) = 234MB in /tmp. Then FFmpeg writes 165MB output = 399MB total, exceeding Cloud Run's 256MB tmpfs (= 50% of 512MB RAM). Container is killed, variant stays "processing" forever.
- [x] Fix 1: Replaced concatVideos()+uploadFileFromDisk() with concatAndUpload() — FFmpeg stdout is piped directly to the forge upload API via form-data PassThrough stream. No 165MB output file written to /tmp.
- [x] Fix 2: Changed hook download strategy from "pre-download all hooks" to "download one hook just-in-time, delete after its variants are done". Peak /tmp usage: body(149MB) + 1 hook(17MB) = 166MB — fits comfortably in 256MB tmpfs.
- [x] Verified FFmpeg pipe output locally: 165MB, 154.6s duration, valid MP4.
- [x] TypeScript: 0 errors | Tests: 337 passing

## v187 — Video Variant Factory: Aspect Ratio + Production Value + Google Drive Export

- [x] Fix FFmpeg re-encode: normalize all clips to 1080x1920 (9:16 vertical) with pillarbox/letterbox for mismatched sources
- [x] Add production polish: subtle contrast/saturation boost, 0.5s fade-in on first frame, 0.3s fade-out on last frame
- [x] Implement Google Drive OAuth flow (server-side, one-time authorization stored as secret)
- [x] Build POST /api/drive/export/:jobId endpoint: upload all done variant MP4s to a shared Drive folder
- [x] Add "Export to Google Drive" button in Video Variants UI with progress/status feedback
- [x] Show Drive folder link after export completes so editor can access directly

## v188 — Video Variant Factory: Aspect Ratio Selector + Re-stitch + Editor Notes

- [x] Add aspectRatio column to video_variant_jobs table (enum: 9:16 | 16:9 | 1:1, default 9:16)
- [x] Add aspect ratio selector UI in job creation section (radio/toggle: Vertical 9:16, Horizontal 16:9, Square 1:1)
- [x] Wire aspectRatio into FFmpeg filter chain: 1080x1920 (9:16), 1920x1080 (16:9), 1080x1080 (1:1)
- [x] Add retryVariant tRPC procedure: reset single variant to pending and re-trigger stitch
- [x] Add Re-stitch button on each failed variant row in Output Variants panel
- [x] Add editor notes textarea in Output Variants panel (shown when Drive is authorized)
- [x] Pass editor notes to Drive export endpoint and save as NOTES.txt in the Drive folder

## v189 — Video Variant Factory: Aspect Ratio Badge + Duplicate Job + Drive History Link

- [x] Show aspect ratio badge (9:16 / 16:9 / 1:1 pill) on the active job header next to the job name
- [x] Add "Duplicate with different ratio" button on the job header — opens a picker to select new ratio, creates a new job with the same clips
- [x] Add driveExportUrl column to video_variant_jobs table to persist the Drive folder URL after export
- [x] Store driveExportUrl when Drive export completes
- [x] Show Drive folder icon/link in History list rows for jobs that have been exported

## v190 — Blog Generation 503 Error Fix

- [x] Add SERVICE_UNAVAILABLE detection in invokeLLM for HTTP 503/502/504 status codes
- [x] Add plain-text "Service Unavailable" detection in invokeLLM for 200-OK responses with error body
- [x] Add automatic retry with exponential backoff (3 retries: 2s, 4s, 8s) directly in invokeLLM so all callers benefit
- [x] Add SERVICE_UNAVAILABLE handling in safeLLM to surface clean user-facing TRPCError after retries exhausted
- [x] Fix covers blog generation and all other LLM-powered features (LinkedIn, Twitter, YouTube, etc.)

## v191 — Upload 500 Gateway Error Fix

- [x] Detect transient 500/502/503/504 HTTP errors in forge storage upload (makeForgeUploadRequest)
- [x] Detect HTML error body responses (200 OK with <html> body) from storage gateway
- [x] Add automatic retry with exponential backoff (3 retries: 3s, 6s, 12s) in uploadBufferToForge
- [x] Add automatic retry with exponential backoff (3 retries: 3s, 6s, 12s) in uploadFileToForge
- [x] Surface clean user-facing error after retries exhausted: "The storage service is temporarily unavailable — please try again"
- [x] Fix covers both chunk upload and finalize (assembled file) upload paths

## v192 — Book Library & E-Book Generator
- [x] Add uploaded_books, book_snippets, ebooks, ebook_chapters tables to schema
- [x] Build bookLibraryRouter: upload PDF, extract voice profile, extract snippets, generate title cards
- [x] Build ebookRouter: generate full e-books in Dr. Shojai's voice, chapter editing, cover image, export
- [x] Add PDF upload endpoint (/api/books/upload) with multer + pdf-parse v2 (PDFParse class)
- [x] Register bookLibraryRouter and ebookRouter in appRouter
- [x] Add BookLibrary and EBookGenerator pages with full UI
- [x] Add Book Library and E-Book Generator nav entries to DashboardLayout
- [x] Add routes /book-library and /ebook-generator in App.tsx
- [x] Fix all TypeScript errors in new files (getDb pattern, Set iteration, field names, imports)
- [x] Push DB schema — all 4 new tables verified in migration

## v193 — CTA/Funnel Integration & PDF Export
- [x] Add ctaText, ctaUrl, ctaLabel columns to ebook_chapters table
- [x] Add coverImageUrl column to ebooks table
- [x] Build branded PDF generation (ebookPdf.ts) with puppeteer-core + Chromium
- [x] Add setChapterCta procedure to ebookRouter
- [x] Add setEbookCta procedure to ebookRouter
- [x] Add injectCtaToAllChapters procedure to ebookRouter
- [x] Add exportPdf procedure to ebookRouter (generates PDF, uploads to S3)
- [x] Fix generateCoverImage to save to coverImageUrl instead of pdfS3Url
- [x] Add CtaManagementPanel component to EBookGenerator.tsx
- [x] Add Export PDF button to EbookViewer header
- [x] Add PDF download link in chapter sidebar
- [x] Run db:push migration (0059_clumsy_doctor_faustus.sql)

## v193 — Book Snippet Social Publishing
- [x] Add Regenerate Image button per snippet (with typo correction support)
- [x] Add platform-specific title card variants (LinkedIn 1200x627, X 1600x900, Meta 1080x1080)
- [x] Add AI social copy generator (LinkedIn, X, Meta) with hashtags and CTA
- [x] Add Push to Buffer integration with channel selection per platform
- [x] Add SnippetSocialPanel modal with platform tabs, copy editor, image preview
- [x] DB migration: add titleCardLinkedinUrl, titleCardXUrl, titleCardMetaUrl, linkedinCopy, xCopy, metaCopy, hashtags, ctaText, bufferSentAt to book_snippets

## v194 — Instagram Channel Integration
- [x] Add Instagram Feed tab (1080×1080, feed caption with 10-15 hashtags)
- [x] Add Instagram Reel tab (1080×1920 vertical, punchy hook-first caption under 300 chars)
- [x] Add Instagram Story tab (1080×1920 vertical, same caption as feed)
- [x] Add instagramCopy and instagramReelCopy fields to bookSnippets schema
- [x] Add titleCardInstagramFeedUrl, titleCardInstagramReelUrl, titleCardInstagramStoryUrl columns
- [x] Update generateSocialCopy to produce instagram + instagramReel copy
- [x] Update pushSnippetToBuffer to use metaPostType (post/reel/story) for Instagram
- [x] CTA sent as Buffer firstComment for all Instagram formats (link in bio)
- [x] Channel filter shows only Instagram channels for IG tabs
- [x] Per-platform char limit counter (300 for Reels, 2200 for Feed/Story)

## v_quality — Two-Stage Snippet Quality Pipeline
- [x] Replaced single-pass extraction with Stage 1 (social strategist) + Stage 2 (editorial judge >=7/10)
- [x] Stage 1 processes all book chunks in parallel (up to 64k chars)
- [x] Stage 2 scores and rejects low-quality quotes, fixes OCR typos
- [x] Added qualityScore and shareabilityType columns to book_snippets
- [x] processBook now saves qualityScore and shareabilityType per snippet
- [x] Added reExtractSnippets procedure (purge + re-run quality pipeline on existing text)
- [x] Re-extract Snippets button in BookDetailPanel with confirmation dialog
- [x] Quality score badge (amber for 9-10, green for 7-8) on SnippetCard
- [x] Shareability type badge (share-worthy / save-worthy / both) on SnippetCard
- [x] Regenerate Image already uses correctedQuote from inline quote editor

## v-queue-fix — Image Generation at Snippet Level + Buffer Dequeue Fix
- [x] Move image generation to snippet/quote level: "Generate All Cards" button creates all 6 platform images in one click
- [x] Add per-platform published tracking columns (publishedLinkedinAt, publishedXAt, publishedMetaAt, publishedInstagramFeedAt, publishedInstagramReelAt, publishedInstagramStoryAt)
- [x] Fix Buffer dequeue: pushSnippetToBuffer now sets the correct platform-specific publishedXxxAt timestamp
- [x] Lock Push to Buffer button when platform already published — prevents redundant re-publishing
- [x] Show published state banner in social panel with publish date
- [x] Show per-platform colored dots on snippet card thumbnail (LinkedIn=blue, X=sky, Meta=indigo, Instagram=pink)
- [x] Add RotateCcw regenerate button on snippet cards that already have cards
- [x] Review & Publish button shows count of published platforms (e.g. "Review (2/6 published)")

## v-compositor — Hybrid Title Card Generation (Zero Typos)
- [x] Build titleCardCompositor.ts: AI generates background-only image, Puppeteer composites real CSS text on top
- [x] Replace all three generateImage calls in bookLibraryRouter with compositor (generateTitleCardImage, regenerateTitleCard, generateAllPlatformCards)
- [x] Compositor generates ONE shared background then composites all 6 platform sizes from it (faster + visually consistent)
- [x] Playfair Display serif typography, gold attribution, brand name in small caps — matches Urban Monk aesthetic
- [x] Fallback to solid dark background if AI background generation fails (still typo-free)

## v-mood — Background Mood Selector + Font Size + Book Title on Cards
- [x] Add 4 mood styles (Forest Dark, Stone Gray, Ink Black, Warm Amber) to titleCardCompositor
- [x] Add 3 font sizes (Large, Medium, Small) to compositor with scale multipliers
- [x] Book title always shown on every card below author attribution
- [x] Add cardMood and cardFontSize columns to bookSnippets schema
- [x] Add updateSnippetStyle procedure to bookLibraryRouter
- [x] Pass mood and fontSize through regenerateTitleCard and generateAllPlatformCards
- [x] Add mood selector and font size toggle to SnippetCard UI
- [x] Mood/fontSize preferences saved per-snippet and persist across regenerations

## v-client-compositor — Client-Side Title Card Compositor (No Puppeteer)
- [x] Build TitleCardRenderer.tsx: pure Canvas API compositor in the browser (no Puppeteer, no headless browser)
- [x] Server generates AI background image only via getCardBackground procedure (no text in prompt)
- [x] Browser renders all 6 platform sizes using Canvas drawImage + fillText (zero AI text rendering = zero typos)
- [x] Browser uploads each PNG to S3 via /api/upload-card endpoint
- [x] Browser calls saveCardUrls procedure to persist all 6 URLs in DB
- [x] Add getCardBackground procedure to bookLibraryRouter (Step 1 of new flow)
- [x] Add saveCardUrls procedure to bookLibraryRouter (Step 2 of new flow)
- [x] Add /api/upload-card Express endpoint to server/_core/index.ts
- [x] Update BookLibrary.tsx SnippetCard to use handleGenerateAllCards (new flow) instead of generateAllPlatformCards (old Puppeteer flow)
- [x] Show live progress counter (e.g. "2/6 cards...") during client-side rendering
- [x] TypeScript: 0 new errors (37 pre-existing errors in typeformRouter/viralStudioRouter/webinarIntelligenceRouter unchanged)
- [x] All 338 tests passing

## v-sort-reject — Sort by Quality Score + Soft Reject
- [x] Add softRejected boolean column to bookSnippets schema
- [x] Run db:push after schema change
- [x] Add softRejectSnippet procedure (toggle softRejected on/off)
- [x] Add sort dropdown to snippet grid (Highest Score, Lowest Score, Newest, Oldest)
- [x] Add thumbs-down button to each SnippetCard (soft reject / un-reject)
- [x] Filter out softRejected snippets by default; add "Show hidden (N)" toggle
- [x] Soft-rejected cards show muted style when visible in hidden view
- [x] TypeScript clean, all tests passing

## v-book-title-fix — Fix Book Title on Generated Cards
- [x] Fix: cards were showing snippet.theme (e.g. "Time Management") instead of real book title
- [x] getCardBackground now returns bookTitle from DB alongside backgroundUrl
- [x] BookLibrary.tsx uses serverBookTitle from getCardBackground response as authoritative source
- [x] bookTitle prop passed from BookDetailPanel (book.title) to SnippetCard as fallback

## v-score-floor — Quality Score Floor Slider
- [x] Add minScore state (0 = all) to BookDetailPanel
- [x] Add minScore filter to filteredSnippets chain (skip snippets below floor)
- [x] Add range slider (0–10, amber accent) in filter bar with live label ("All scores" / "8+")
- [x] Add ✕ reset button that appears when minScore > 0
- [x] Empty state shows hint to lower score floor when no snippets match

## v-ebook-source-upload — Ebook Generator Source Document Upload
- [ ] Find current ebook generator page and router
- [ ] Add sourceDocumentUrl + sourceDocumentText + sourceDocumentName columns to ebook_projects (or equivalent) schema
- [ ] Add /api/upload-ebook-source Express endpoint (accepts PDF/TXT/DOCX/MD, extracts text, stores in S3)
- [ ] Add saveEbookSource tRPC procedure to persist extracted text + S3 URL
- [ ] Build SourceDocumentPanel UI: drag-and-drop file upload zone + narrative textarea
- [ ] Show uploaded filename + word count badge once document is loaded
- [ ] Allow replacing the source document with a new upload
- [ ] Update ebook generation AI prompt to inject source document text + user narrative as primary context
- [ ] TypeScript clean, all tests passing

## v-ebook-source-upload — Ebook Source Document Upload
- [x] Add sourceDocumentName, sourceDocumentS3Url, sourceDocumentText, sourceNarrative columns to ebooks schema
- [x] Run db:push to migrate new columns
- [x] Add /api/ebook/upload-source endpoint (PDF/TXT/MD, 20MB, text extraction, S3 upload)
- [x] Add saveEbookSource and updateEbookNarrative tRPC procedures to ebookRouter
- [x] Update generateEbook procedure to accept sourceDocumentText, sourceDocumentName, sourceDocumentS3Url, sourceNarrative
- [x] Add buildSourceContext() helper that injects source document + narrative into AI prompts
- [x] Update generateChapterOutline() to use source document as primary content foundation
- [x] Update generateChapterContent() to draw directly from source document material
- [x] Add source document upload panel to GenerateEbookDialog (file drop zone + narrative textarea)
- [x] File drop zone supports PDF, TXT, MD up to 20MB with word count display
- [x] Narrative textarea for author direction on top of the document
- [x] TypeScript clean (0 new errors)

## v-ebook-fixes — CTA Fix, Length Slider, PDF Download Fix
- [ ] Fix CTA not appearing in generated chapters (audit ctaText injection in generateChapterContent)
- [ ] Add Deep Sleep webinar CTA wiring (ensure webinar CTA text flows through to last chapter)
- [ ] Add length/prose style parameter: concise (600w) → standard (900w) → expansive (1400w) → immersive (2000w)
- [ ] Add prose style selector: punchy/direct vs narrative/story-driven vs academic/detailed
- [ ] Add length+prose slider to GenerateEbookDialog UI
- [ ] Fix PDF download: replace Puppeteer (broken, no Chromium) with markdown-pdf or WeasyPrint
- [ ] Test PDF download end-to-end

## v-ebook-fixes — CTA Fix, Length/Prose Slider, PDF Download Fix (COMPLETE)
- [x] Fix CTA injection: was only injecting into last chapter; now all chapters get CTA (last = strong close, others = organic mid-chapter nudge)
- [x] Add LENGTH_PRESETS: Concise (500-700w), Standard (800-1100w), Expansive (1200-1600w), Immersive (1700-2200w)
- [x] Add PROSE_STYLE_INSTRUCTIONS: Direct (punchy), Narrative (story-driven), Academic (evidence-based)
- [x] Add lengthPreset and proseStyle to generateEbook input schema
- [x] Pass lengthPreset, proseStyle, isLastChapter to generateChapterContent
- [x] Replace Puppeteer PDF renderer with WeasyPrint (system-installed, confirmed working)
- [x] ebookPdf.ts: write HTML to temp file, run weasyprint CLI, read output PDF, clean up temp files
- [x] Add Length & Prose Style panel to GenerateEbookDialog UI (4-button length selector + 3-button prose style selector)
- [x] Pass lengthPreset and proseStyle from UI to generateEbook mutation
- [x] TypeScript clean (0 new errors), WeasyPrint confirmed working in sandbox

## v-ebook-quality-pdf — Chapter Quality Overhaul + PDF Fix (COMPLETE)
- [x] Fix WeasyPrint ENOENT: use absolute path /usr/local/bin/weasyprint in execFileAsync call
- [x] Add explicit PATH env to WeasyPrint call to prevent runtime PATH issues
- [x] Increase maxTokens for all length presets: Concise 2000, Standard 3000, Expansive 4500, Immersive 6000
- [x] Increase word count targets: Concise 600-900, Standard 1000-1400, Expansive 1500-2000, Immersive 2000-2800
- [x] Rewrite chapter outline prompt: demand specific, non-generic titles; rich 3-5 sentence summaries; narrative arc requirement; counterintuitive insights
- [x] Rewrite chapter content prompt: 8 explicit requirements including opening hook, depth mandates (story + science + ancient wisdom + surprise), 2-4 subheadings, 2-3 actionable protocols, voice consistency, bridge closing
- [x] Source document mode: prompt explicitly instructs AI to draw directly from source, quote/paraphrase specific insights, treat source as field notes
- [x] No-source mode: requires story/case study + specific science + ancient wisdom reference + counterintuitive insight per chapter

## v-book-title-stale-closure-fix
- [x] Root cause: original compositor (c6c281f) used snippet.theme as bookTitle
- [x] Fix: removed snippet.theme from useCallback dep array, added bookTitle
- [x] Fix: added non-empty string guard on serverBookTitle before using it
- [x] resolvedBookTitle = serverBookTitle (non-empty) ?? bookTitle (non-empty) ?? "The Urban Monk"

## v-ebook-streaming — Chapter-by-Chapter Generation, Regenerate Chapter, DOCX Export
- [ ] Refactor generateEbook into: createEbookDraft (outline only) + generateNextChapter (one chapter at a time)
- [ ] Add regenerateChapter procedure to re-run a single chapter
- [ ] Update EBookGenerator UI to call generateNextChapter in a loop with live progress bar
- [ ] Show per-chapter status (pending / generating / complete / failed) during generation
- [ ] Add "Regenerate" button on each chapter in the ebook detail view
- [ ] Install docx npm package
- [ ] Add DOCX export using docx package server-side
- [ ] Add "Download as Word (.docx)" button in ebook detail view alongside PDF button
- [ ] TypeScript clean, all tests passing

## v-ebook-streaming — Chapter-by-Chapter Generation + DOCX Export (COMPLETE)
- [x] Add createEbookDraft procedure (outline only, returns ebookId + outline array)
- [x] Add generateChapter procedure (generates one chapter by number, uses full quality prompt)
- [x] Add exportDocx procedure (builds .docx using docx npm package, uploads to S3)
- [x] Install docx npm package
- [x] Replace GenerateEbookDialog single-mutation flow with createDraft + chapter loop
- [x] Add live progress bar (Building outline... → Chapter N of M...)
- [x] Show failed chapter numbers inline with recovery message
- [x] Add .docx export button to EbookViewer header alongside PDF
- [x] Fix all TypeScript errors (generateEbook.isPending → isGenerating)

## v-chapter-enhance — Chapter Enhancement Panel (AI Instructions + Multi-Doc Upload)
- [ ] Update regenerateChapter procedure to accept enhancementInstructions and enhancementDocs[]
- [ ] Add /api/ebook/upload-enhancement-doc endpoint (same pattern as upload-source)
- [ ] Build ChapterEnhancementPanel component: instruction textarea + multi-doc upload list
- [ ] Wire ChapterEnhancementPanel into ChapterEditor below the chapter content
- [ ] Show uploaded doc names with remove buttons
- [ ] Pass all enhancement data to regenerateChapter mutation
- [ ] AI prompt incorporates instructions + doc excerpts before rewriting chapter
- [ ] TypeScript clean, tests passing

## v-chapter-enhance — Chapter Enhancement Panel (COMPLETE)
- [x] Update regenerateChapter procedure to accept enhancementInstructions and enhancementDocs array
- [x] Build ChapterEnhancementPanel component with collapsible panel, instruction textarea, multi-doc upload
- [x] Add /api/ebook/upload-enhancement-doc endpoint for per-doc text extraction (5 MB limit)
- [x] Wire ChapterEnhancementPanel into ChapterEditor below chapter content
- [x] Update EbookViewer onRegenerate callback to pass all enhancement opts
- [x] TypeScript clean (0 errors in changed files)

## v-ebook-multi-source — Multiple Source Documents + DOCX Support (COMPLETE)
- [x] Install mammoth npm package for DOCX text extraction
- [x] Update /api/ebook/upload-source to parse .docx files via mammoth (not just PDF/TXT/MD)
- [x] Update /api/ebook/upload-enhancement-doc to also parse .docx files
- [x] Replace single sourceFile state with sourceDocs array in GenerateEbookDialog
- [x] Multi-file input (multiple attribute) — select several files at once
- [x] Per-file upload loop with individual success/error toasts
- [x] Uploaded files list with file name, word count, and individual remove button
- [x] "Add more files" drop zone persists after first upload
- [x] Combined word count shown in panel header
- [x] All source docs concatenated with document labels before being sent to AI
- [x] TypeScript clean (0 errors in changed files)

## v-ebook-advanced — Chapter Version History, Broadcast Enhancement, Cover Image

- [x] Add ebookChapterVersions table to schema (chapterId, versionNumber, content, wordCount, trigger, createdAt)
- [x] Run db:push after schema change
- [x] Add getChapterVersions and restoreChapterVersion procedures to ebookRouter
- [x] Auto-save version before every regenerateChapter call (in regenerateChapter procedure)
- [x] Add generateCoverImage procedure (AI image generation from title + topic, saves to coverImageUrl)
- [x] Add coverImageUrl column to ebooks table; run db:push
- [x] Add "Apply to all chapters" checkbox in ChapterEnhancementPanel with amber styling
- [x] Chapter version history UI: collapsible panel per chapter, version list with timestamps and word count, restore button
- [x] Cover image display in EbookViewer sidebar (shown when coverImageUrl is set)
- [x] "Generate Cover" button in EbookViewer header (shown when no cover exists)
- [x] EbookViewer onRegenerate handles applyToAll: loops through all chapters sequentially
- [x] TypeScript clean (0 errors in ebook files)

## v-reddit-intelligence — Reddit Intelligence Module (COMPLETE)

- [x] Add reddit_subreddits table (subreddit, category, isActive, lastFetchedAt)
- [x] Add reddit_posts table (redditId, subreddit, category, title, selftext, score, numComments, permalink, engagementScore, aiSummary, aiRecommendation, aiDraftComment, isAnalyzed, isFlagged, isDismissed)
- [x] Run db:push after schema changes
- [x] Build redditRouter with: seedDefaults, listSubreddits, addSubreddit, toggleSubreddit, removeSubreddit, refreshFeed, getFeed, analyzePost, batchAnalyze, flagPost, dismissPost, regenerateDraft, getStats
- [x] Reddit public JSON API fetcher (no API key required, uses .json endpoints)
- [x] AI analysis: engagementScore 1-10, aiSummary, aiRecommendation, aiDraftComment in Dr. Shojai's voice
- [x] Register reddit router in appRouter
- [x] Build RedditIntelligence.tsx page with Thread Feed, Flagged, and Manage Subreddits tabs
- [x] Stats bar: total threads, analyzed, high value (7+), flagged
- [x] Per-post card: score, comments, AI summary, engagement score badge, "your angle" recommendation
- [x] Expand/collapse per card to show full AI analysis + draft comment
- [x] Draft comment editor with copy button and custom-instructions regenerate
- [x] Flag / Dismiss actions per post
- [x] Batch Analyze button (top 10 unanalyzed by score)
- [x] Subreddit manager: add, toggle active/inactive, remove, load defaults (18 pre-seeded)
- [x] Add "Reddit Intel" to Intelligence sidebar group in DashboardLayout
- [x] Register /reddit-intelligence route in App.tsx
- [x] TypeScript clean (0 errors in reddit files)

## v-reddit-schedule — Nightly Heartbeat & Weekly Trend Digest

- [x] Create redditScheduled.ts handler (POST /api/scheduled/reddit-nightly)
- [x] Handler: refresh all active subreddits, insert new posts, update scores
- [x] Handler: batch-analyze top 5 unanalyzed posts by reddit score
- [x] Mount /api/scheduled/reddit-nightly in server/_core/index.ts
- [x] Add redditTrendDigests table to schema.ts (weekStart, briefing, topTopics JSON, postsAnalyzed, subredditsScanned, generatedAt)
- [x] Run db:push for redditTrendDigests table
- [x] Add generateTrendDigest, getDigests, getLatestDigest procedures to redditRouter
- [x] Add Trend Digest tab to RedditIntelligence UI (topic chips, markdown briefing, previous digests)
- [ ] Register nightly heartbeat cron via manus-heartbeat CLI (requires deploy first — see instructions below)

## v-ebook-bugfix — Generate Button Fix

- [x] Fix syntax error: missing closing paren on wrapLLM() call in generateChapterOutline (caused silent server crash on generate)
- [x] Wrap generateChapterContent invokeLLM call with wrapLLM for retry/error handling
- [x] Add onError callbacks to createEbookDraft and generateChapter mutations for console logging
- [x] Improve catch block in handleGenerate to always show a toast with the actual error message
- [x] Add keepAliveTimeout (620s) and headersTimeout (630s) to HTTP server to prevent LB cutoffs during long LLM calls

## v-reddit-engage — Content Bridge, Engagement Tracking, New Subreddits

- [x] Add isCommented and commentedAt columns to reddit_posts schema; run db:push
- [x] Add markCommented and getCommentedPosts tRPC procedures in redditRouter
- [x] Add "Mark Commented" toggle button on post cards (green when active)
- [x] Add Engagement Log tab showing all commented posts with timestamps and View links
- [x] Add "Create Content" button on post cards that navigates to Command Center with pre-filled title
- [x] Add 5 new subreddits: r/taoism, r/SIBO, r/GutHealth, r/sleephackers, r/Qigong

## v-ebook-polish — Debug Cleanup, Retry Failed Chapters, DOCX Export

- [x] Remove Test DB debug button from E-Book Generator header
- [x] Add retryFailedChapters tRPC procedure in ebookRouter
- [x] Add "Retry Failed Chapters" button in EbookViewer when any chapter has status "failed"
- [x] Install docx npm package (already present as v9.6.1)
- [x] Build ebookDocx.ts generator — inline in ebookRouter exportDocx procedure (cover, chapters, headings, bullets, page breaks)
- [x] Add exportDocx tRPC procedure in ebookRouter
- [x] Add "Export DOCX" (.docx) button in EbookViewer alongside the PDF export button

## v-claude-writing — Anthropic Claude for Ebook Chapter Prose

- [x] Add ANTHROPIC_API_KEY secret
- [x] Install @anthropic-ai/sdk npm package (v0.97.1)
- [x] Build server/claudeLLM.ts helper (direct Anthropic API, claude-sonnet-4-5, with retry logic)
- [x] Wire claudeLLM into generateChapterContent in ebookRouter (prose only)
- [x] Keep invokeLLM (Gemini Flash) for outline generation and JSON extraction

## v-claude-outline — Claude Haiku 4.5 for Outline Generation

- [x] Update claudeLLM.ts: add invokeClaudeJson helper using claude-haiku-4-5
- [x] Fix model ID (claude-haiku-3-5 → claude-haiku-4-5) — confirmed against Anthropic docs
- [x] Replace Gemini Flash invokeLLM call in generateChapterOutline with invokeClaudeJson
- [x] Strengthen outline prompt: add explicit rule against generic chapter titles
- [x] All 340 tests pass (including both Sonnet and Haiku live API tests)

## v-ebook-quality — Three Ebook Quality Improvements

- [x] Switch voice profile extraction to Claude Haiku 4.5 (invokeClaudeJson) in bookLibraryRouter
- [x] Add previewOutline tRPC procedure that generates outline without writing chapters
- [x] Add generateFromApprovedOutline tRPC procedure (takes user-edited outline, writes chapters)
- [x] Build inline outline preview in GenerateEbookDialog — editable chapter titles/summaries, Approve + Regenerate buttons
- [x] Wire outline preview into the "Generate E-Book" flow (Preview Outline First → edit → Approve & Write All Chapters)
- [x] Add styleNotes field to regenerateChapter tRPC procedure (injected as STYLE NOTE to Claude)
- [x] Add Style note input field to chapter Rewrite dialog in EbookViewer UI

## v-ebook-outline-ux — Outline & Style Note UX Improvements

- [x] Add ➕ "Add chapter" button at bottom of outline preview list
- [x] Add ✕ "Remove chapter" button per row (hidden when only 1 chapter remains); auto-renumbers
- [x] Surface stored outline as read-only collapsible panel in EbookViewer sidebar (reads ebook.outlineJson)
- [x] Add outlineJson field to Ebook interface in EBookGenerator.tsx
- [x] Add styleNote column to ebookChapters table in schema.ts
- [x] Run pnpm db:push to migrate (migration 0071_magical_blindfold.sql)
- [x] Add updateChapterStyleNote tRPC procedure in ebookRouter
- [x] Update regenerateChapter to fall back to chapter.styleNote when no override provided
- [x] Add ChapterStyleNoteField component in EBookGenerator.tsx
- [x] Wire ChapterStyleNoteField into EbookViewer sidebar (updates on chapter switch)
- [x] Add small dot indicator on chapter nav button when styleNote is set
- [x] Pre-fill regenStyleNotes in ChapterEditor from chapter.styleNote

## v-ebook-viewer-ux — Outline Regen, Default Style Note, Word Count Progress

- [x] Add defaultStyleNote column to ebooks table in schema.ts
- [x] Run pnpm db:push to migrate (migration 0072_funny_aaron_stack.sql)
- [x] Add defaultStyleNote textarea to GenerateEbookDialog form (optional, labeled, with placeholder)
- [x] Update generateEbook procedure to accept defaultStyleNote and seed chapter styleNotes on creation
- [x] Update generateFromApprovedOutline procedure to seed chapter styleNotes from defaultStyleNote input
- [x] Add updateEbookOutline tRPC procedure (updates outlineJson + chapter titles/summaries)
- [x] Add Regenerate Outline button in EbookViewer sidebar (calls previewOutline)
- [x] Wire Regenerate Outline to show editable modal with per-chapter title/summary inputs
- [x] Apply approved outline changes to existing ebook via updateEbookOutline (outlineJson + chapter rows)
- [x] Add chapter word count progress bar in sidebar below each chapter nav button
- [x] Progress bar compares chapter.wordCount vs (ebook.wordCountTarget / chapters.length)
- [x] Color coding: red < 50%, amber 50–80%, green ≥ 80%; shows word count label

## v-cross-module — Webinar × Landing Page × E-Book Integration

- [x] Build crossModuleRouter with 6 feed payload procedures (all 6 directions: webinarToEbook, webinarToLandingPage, landingPageToEbook, landingPageToWebinar, ebookToLandingPage, ebookToWebinar)
- [x] Register crossModuleRouter in routers.ts
- [x] WebinarBuilder: "Create E-Book" and "Create Landing Page" buttons in sidebar (step 4 panel)
- [x] LandingPageGenerator: "E-Book" (BookOpen) and "Webinar" (Video) buttons per page card in history view
- [x] EBookGenerator: "Landing Page" and "Webinar" buttons per ebook card in the ebook list
- [x] Wire URL query params (?from=webinar&id=X, ?from=landingPage&id=X, ?from=ebook&id=X) to auto-fill destination forms
- [x] EBookGenerator: PrefillData interface + useEffect to read query params and pre-fill GenerateEbookDialog
- [x] LandingPageGenerator: useEffect to read query params and pre-fill contentAngle, offer, customOfferLabel
- [x] WebinarBuilder: useEffect to read query params and pre-fill topic and CTA
- [x] Fix buildIntelligenceSummary field names to match actual webinarIntelligence schema columns
- [x] Add defaultStyleNote to generateEbook input schema (was missing, causing TS error)

## v-pipeline-wp — Content Pipeline Dashboard, Feed Toast, WordPress Publish

- [ ] Audit blog router for WordPress publish placeholder
- [ ] Add publishToWordPress tRPC procedure in blog router (uses WORDPRESS_URL, WORDPRESS_USERNAME, WORDPRESS_APP_PASSWORD)
- [ ] Add WordPress publish button to Blog panel UI (replaces "coming soon" placeholder)
- [ ] Build crossModule.getPipelineView tRPC procedure (returns ebooks, webinars, landingPages with cross-links)
- [ ] Build ContentPipeline.tsx page with three-column layout and connection arrows
- [ ] Register /content-pipeline route in App.tsx and add to sidebar nav
- [ ] Add feed confirmation banner (dismissible, with Undo) to EBookGenerator when arriving with ?from= params
- [ ] Add feed confirmation banner to LandingPageGenerator when arriving with ?from= params
- [ ] Add feed confirmation banner to WebinarBuilder when arriving with ?from= params

## v-pipeline-wp — Content Pipeline Dashboard, Feed Banners, WordPress Publish

- [x] WordPress direct publish from Blog panel — already fully implemented in CreationStudio.tsx (confirmed v9)
- [x] Add getPipelineView tRPC procedure to crossModuleRouter (returns webinars, ebooks, landingPages with cross-link metadata)
- [x] Build ContentPipeline.tsx page — three-column layout with connection arrows, status badges, and feed buttons
- [x] Add GitFork icon import and register /content-pipeline route in App.tsx
- [x] Add "Content Pipeline" nav item to DashboardLayout sidebar
- [x] Add prefill confirmation banner with undo to EBookGenerator (shows when prefillData is set)
- [x] Add prefill confirmation banner with undo to LandingPageGenerator (prefillLabel state, GitFork icon)
- [x] Add prefill confirmation banner with undo to WebinarBuilder (prefillLabel state, GitFork icon)
- [x] Replace toast.success prefill notifications with persistent banner + undo button in all three modules

## v-connection-tracking — FK-Based Pipeline Connections, Filter Bar, Regenerate All Chapters
- [x] Add sourceWebinarId, sourceEbookId, sourceLandingPageId FK columns to ebooks table in schema.ts
- [x] Add sourceWebinarId, sourceEbookId, sourceLandingPageId FK columns to landingPages table in schema.ts
- [x] Run pnpm db:push to migrate (migration 0073)
- [x] Update getPipelineView in crossModuleRouter to return source FK columns for ebooks and landingPages
- [x] Update generateEbook procedure input schema to accept sourceWebinarId/sourceEbookId/sourceLandingPageId
- [x] Update generateFromApprovedOutline procedure input schema to accept source FK fields
- [x] Update createEbookDraft procedure input schema to accept source FK fields and pass to DB insert
- [x] Update createLandingPage helper function to accept and pass source FK fields to DB insert
- [x] Update generateCopy procedure input schema in landingPagesRouter to accept source FK fields
- [x] Update generateVariant to track sourceLandingPageId (variant tracks its source page)
- [x] Wire source IDs from URL query params into createDraft mutation call in EBookGenerator.tsx
- [x] Wire source IDs from URL query params into generateFromApprovedOutline mutation call in EBookGenerator.tsx
- [x] Wire source IDs from URL query params into generateCopy mutation call in LandingPageGenerator.tsx
- [x] Rewrite ContentPipeline.tsx with real FK-based connection badges (LinkedBadge component)
- [x] ContentPipeline: show "linked from Webinar: <topic>" badge on ebooks that have sourceWebinarId
- [x] ContentPipeline: show "linked from E-Book: <title>" and "linked from Webinar: <topic>" badges on landing pages
- [x] ContentPipeline: show "Variant of #N" badge on landing pages with sourceLandingPageId
- [x] ContentPipeline: highlight linked item cards with primary border (vs default border for unlinked)
- [x] ContentPipeline: add FilterBar component with All / Complete / Drafting / Linked / Unlinked filters
- [x] ContentPipeline: add "linked items" count to summary stats row
- [x] Add styleNote parameter to generateChapterContent function signature
- [x] Add regenerateAllChapters tRPC procedure in ebookRouter (rewrites all chapters, respects per-chapter styleNote)
- [x] Add regenerateAllChapters mutation and "Regenerate All" button to EbookViewer header
- [x] Regenerate All: shows confirmation dialog before overwriting, disables Retry Failed during operation

## Full Codebase Audit (May 20 2026)
- [x] TypeScript full compile — 37 pre-existing errors found across typeformRouter, viralStudioRouter, webinarIntelligenceRouter (zero errors in recently added files)
- [x] Fix typeformGet return type to Promise<any> so all callers resolve correctly
- [x] Fix parseLLMJson calls in typeformRouter (2 spread-type errors) to use <any> type parameter
- [x] Fix parseLLMJson calls in viralStudioRouter (2 unknown-type errors) to use <any> type parameter
- [x] Fix rawResponses possibly-null access in webinarIntelligenceRouter.ts (line 131)
- [x] Fix implicit-any url variable in webinarIntelligenceRouter.ts do-while loop (line 243)
- [x] Fix parseLLMJson synthesized unknown-type error in webinarIntelligenceRouter.ts (line 538)
- [x] TypeScript recheck — EXIT:0, zero errors across all 40+ server files and all client pages
- [x] Database schema sync — pnpm db:push confirms no pending migrations
- [x] All routes in App.tsx verified against pages directory — all 33 pages registered
- [x] DashboardLayout sidebar nav items verified — all paths match App.tsx routes
- [x] All routers verified as registered in appRouter (server/routers.ts)
- [x] Full vitest run — 340 tests across 32 test files, all passing (EXIT:0)
- [x] Browser smoke test — ContentPipeline renders with filter bar and feed arrows (no console errors)
- [x] Browser smoke test — EBookGenerator renders with Generate New E-Book button (no console errors)
- [x] Browser smoke test — auth gate working correctly on protected pages

## Podcast Production Module
- [x] Add podcastEpisodes table to drizzle schema with guest intake fields and report storage
- [x] Run pnpm db:push to migrate schema
- [x] Build podcastRouter with createEpisode, generateReport, getEpisodes, getEpisode, deleteEpisode procedures
- [x] Build PodcastProduction.tsx page with guest intake form and episode list
- [x] Build PodcastEpisodeViewer.tsx with BINGE section tabs and rendered report
- [x] Register /podcast-production and /podcast-production/:id routes in App.tsx
- [x] Add Podcast Production to DashboardLayout sidebar nav
- [x] Write vitest tests for podcastRouter

## Guest Intake Form (Public URL per Episode)
- [x] Add intakeToken (unique UUID), intakeSubmittedAt, intakeStatus fields to podcastEpisodes schema
- [x] Run pnpm db:push to migrate schema
- [x] Add getIntakeForm (public, by token) procedure to podcastRouter
- [x] Add submitIntakeForm (public, by token) procedure — saves guest answers and triggers generateReport
- [x] Add generateIntakeLink procedure (protected) — returns the shareable URL
- [x] Build GuestIntakeForm.tsx public page at /podcast-intake/:token (no auth required)
- [x] Add "Share Intake Form" button to PodcastProduction episode cards
- [x] Add "Share Intake Form" button to PodcastEpisodeViewer header
- [x] Register /podcast-intake/:token route in App.tsx
- [x] Write vitest tests for new intake procedures (8 new tests, 358 total passing)

## Podcast Enhancements (v2)
- [ ] Add "Send via Email" mailto button to episode cards (PodcastProduction) with pre-drafted intro paragraph
- [ ] Add "Send via Email" mailto button to PodcastEpisodeViewer header
- [ ] Wire notifyOwner in submitIntakeForm so owner gets in-app alert when guest submits
- [ ] Add generateShowNotes procedure to podcastRouter (200-word summary, 3 key takeaways, CTA)
- [ ] Add showNotes field to podcast_episodes schema and run db:push
- [ ] Add "Generate Show Notes" button and rendered output tab in PodcastEpisodeViewer
- [ ] Write vitest tests for generateShowNotes and notifyOwner wiring

## Podcast Enhancements v2 (May 2026)
- [x] Add Mail icon and "Send Intake Form" mailto button to PodcastProduction episode cards
- [x] Add "Send Intake Form" mailto button to PodcastEpisodeViewer header (alongside Copy Link)
- [x] Wire notifyOwner in submitIntakeForm — owner gets in-app alert when guest submits
- [x] Add showNotes column to podcast_episodes schema (migration 0076)
- [x] Add generateShowNotes procedure to podcastRouter (200-word summary, 3 takeaways, CTA)
- [x] Add Show Notes tab to PodcastEpisodeViewer with Generate/Regenerate/Copy buttons
- [x] Write vitest tests: notifyOwner call verification + 4 generateShowNotes tests (363 total passing)

## Back Navigation Audit (May 20, 2026)
- [x] Audit all 44 pages for missing back/home navigation
- [x] Add "Back to Hub" ArrowLeft link to BookLibrary.tsx header
- [x] Add "Back to Hub" ArrowLeft link to VideoProductionSession.tsx header
- [x] Add "Back to Hub" ArrowLeft link to VideoVariantFactory.tsx header
- [x] Add "Back to Hub" ArrowLeft link to WordPressSetup.tsx header
- [x] Add theurbanmonk.com footer link to GuestIntakeForm.tsx (public page)
- [x] Confirmed viral sub-pages (AnalyticsDashboard, DMPlaybook, PerformanceSignal, ViralTopics) covered by ViralStudio tab nav
- [x] Confirmed 20 DashboardLayout pages have sidebar nav
- [x] Confirmed ContentPipeline, EBookGenerator, PodcastProduction, PodcastEpisodeViewer, IngestInbox, ManyChatWizard, RedditIntelligence already had back navigation
- [x] Verified podcast intake form flow end-to-end

- [x] Fix Export Teleprompter DOCX button missing: regenerateCta now auto-approves new CTA; Export DOCX button added directly to Ready to Record callout (no longer depends on allApproved)

- [x] Variant-to-channel routing: fetch Buffer channels grouped by platform, show per-variant channel assignment dropdowns in Video Variant Factory Buffer panel
- [x] Update syndicateToBuffer backend to accept per-variant channelId map instead of single channelIds array
- [x] Show channel display name and platform icon in the routing table

- [x] Fix ebook stuck in "Generating..." after AI timeout: retryFailedChapters now picks up "generating" and "pending" stuck chapters; added resetStuckEbook procedure; added Resume Generation button on drafting cards

- [x] Fix ebook PDF: replace generic "UM" circle logo with real Urban Monk logo (white version for dark backgrounds, loaded from server/assets/); fix cover image full-bleed rendering with proper scale-to-fill; fix back cover vertical centering; fix CTA button label (hardcoded "Join the Urban Monk Academy"); add THEURBANMONK.COM footer to back cover; add storage proxy for /manus-storage/* paths

- [x] Google Search Console SEO Dashboard: OAuth flow, token storage, keyword rankings, top pages, striking-distance keywords panel, week-over-week summary, CommandCenter widget

- [x] SEO sidebar nav item: add "SEO" entry with Search icon to DashboardLayout sidebar
- [x] Keyword-to-content pipeline: "Create Content" buttons on striking-distance rows in SeoDashboard pre-fill Video Script Generator or Blog Generator
- [x] Weekly GSC digest heartbeat: scheduled job fetches GSC data and sends owner notification with top movers and striking-distance opportunities

- [x] SEO content tracker: DB table records keyword sends to Video/Blog generators; SeoDashboard shows "content created" badges
- [x] Keyword rank-drop alerts: weekly GSC digest flags keywords that dropped 3+ positions week-over-week
- [x] Top-pages WordPress quick-edit: hover-reveal "Update Content" button links to WP post editor for that URL

## DataForSEO Competitive Intelligence Integration

- [x] Research DataForSEO API endpoints (keyword volume, SERP, competitor rankings, keyword gap)
- [x] Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD credentials
- [x] Build server/dataForSeo.ts: API client with Basic Auth, keyword overview, keywords for site, competitor domains, domain intersection, ranked keywords, domain rank overview
- [x] Add tRPC procedures: status, keywordOverview, keywordsForSite, competitors, domainIntersection, rankedKeywords, domainRankOverview (server/dataForSeoRouter.ts)
- [x] Build CompetitiveIntelligence page: domain overview, competitor list, keyword gap, shared keywords, keyword research panels — sidebar nav added
- [x] Wire keyword-to-content pipeline: create content buttons on gap keywords navigate to Video Production or Blog Generator

## DataForSEO Enhancement Round 2

- [x] competitor_domains DB table: save curated list of competitor domains to monitor
- [x] Competitor tracking UI: add/remove competitors in CompetitiveIntelligence page, auto-load saved list
- [x] Volume badges on striking-distance keywords: DataForSEO monthly search volume pill next to each GSC position-11-20 keyword
- [x] Extended Monday digest: include top 5 DataForSEO keyword gaps in weekly owner notification

## Keyword Strategy System

- [x] keyword_campaigns and keyword_targets DB tables: topic cluster planner with funnel stages (TOFU/MOFU/BOFU), keyword types (pillar/cluster/conversion), monetization tags (academy/supplements/testing/free_lead), content status tracking
- [x] keywordStrategyRouter: CRUD for campaigns and targets, AI cluster generation via LLM, DataForSEO volume enrichment
- [x] KeywordStrategy page (/keyword-strategy): campaign manager, cluster planner with grouped pillar/cluster/conversion rows, content roadmap with Video/Blog creation buttons, status cycling
- [x] Sidebar nav item "Keyword Strategy" with Target icon added to DashboardLayout

## Keyword Strategy — Round 2

- [ ] Seed gut health campaign: create campaign + AI-generate 15-20 keyword cluster + DataForSEO volume enrichment
- [ ] Weekly keyword priority digest: Monday heartbeat surfaces top 3 not-started high-volume keywords per campaign
- [ ] WordPress publish-back: when blog post publishes to WP, auto-update matching keyword target publishedUrl and status to "published"

## Keyword Strategy — Round 2

- [x] Gut health campaign seeded: 19 keywords across pillar/cluster/conversion tiers, enriched with DataForSEO volumes (gut health 40.5K/mo, best probiotics 14.8K/mo, gut microbiome 9.9K/mo, gut brain connection 4.4K/mo)
- [x] Weekly keyword priority digest: POST /api/scheduled/keyword-priority-digest — surfaces top 3 not-started keywords per campaign by volume every Monday
- [x] WordPress publish-back: when a blog post publishes with a focusKeyword, matching keyword_targets row flips to "published" and records the live URL

## Keyword Strategy — Round 3

- [ ] Fix KeywordStrategy page color scheme to match site-wide tokens (warm parchment bg, terracotta primary, semantic card/border colors)
- [ ] Add keyword_rank_history DB table: weekly GSC rank snapshots per keyword target
- [ ] Build rank tracking tRPC procedures: snapshotRanks, getRankHistory, getRankMovers
- [ ] Weekly rank snapshot heartbeat: POST /api/scheduled/rank-snapshot — pulls GSC data for all published keyword targets
- [ ] SEO Authority Tracker panel in KeywordStrategy: rank trend sparklines, position change badges, clicks/impressions over time

## Current Session Tasks

- [x] Fix KeywordStrategy page color scheme: replace all hardcoded dark theme classes with site warm parchment/terracotta semantic tokens
- [x] Seed Sleep & Recovery keyword campaign: pillar keyword "sleep optimization", monetization goal "Urban Monk Academy", AI cluster + DataForSEO volumes
- [x] Fix WordPress publish bug: FAQ section rendered as raw Markdown (## / ###) after CTA banner HTML injection — fixed markdownToWpHtml to split on HTML blocks and convert each Markdown segment independently
- [x] Fix [INTERNAL LINK: topic] placeholder artifacts in published WordPress posts — added resolvePlaceholderLinks() that fuzzy-matches each placeholder against the full 656-post WP index and either resolves to a real URL or strips the brackets cleanly; 11 new tests added (378 total passing)
- [x] Add CTA destination dropdown to blog generation panel — dropdown lists all named offers from ctaBlocks table, shows live UTM preview URL, passes ctaBlockId override to server; server uses manual selection or auto-selects by topic; utm_campaign now uses article slug for per-post GA4 tracking
- [x] Add 6 new CTA blocks to DB: Upstream Course (upstream.theurbanmonk.com), Lights On Course (lightson.theurbanmonk.com), Interconnected Documentary (Kajabi screening URL), Lights On Webinar Free (Kajabi opt-in), Deep Sleep Webinar Free (dss-webinar-kajabi), Gateway to Health Test (gth.theurbanmonk.com)
- [x] Fix blog generation prompt for Strike Zone keywords: add focusKeyword + currentPosition inputs to generateBlog mutation, inject tactical SEO brief server-side (7 requirements: keyword placement, search intent, competitive differentiation, E-E-A-T, featured snippet target, PAA coverage, semantic depth), add Strike Zone badge UI in blog panel, pass params from Keyword Strategy tool
- [x] Auto-populate GSC position data into keyword targets: build server-side sync that matches GSC query rows to keyword_targets by keyword string and writes currentPosition
- [x] Seed Stress & Cortisol keyword campaign: pillar "cortisol and stress", AI cluster (15-20 keywords), DataForSEO volumes

## SEO Audit Fixes (May 2026)

- [x] Bug 1: Fix focusKeyword null — wire focusKeyword + yoastSeoTitle + yoastMetaDescription through auto-save pipeline (create then update pattern); focusKeyword now passed to generateBlogMutation and saved to DB on every generation
- [x] Bug 2: Fix permalink slug — add sanitizeSlug() + checkSlugExists() before every WordPress API call; sanitizes to lowercase-hyphen format, appends -2/-3 suffix if slug already exists in WP
- [x] Bug 3: Fix schema markup injection — inject Article + FAQPage JSON-LD as WordPress raw HTML blocks (<!-- wp:html -->) so they survive WP content sanitization; previously built but never used
- [x] Add 5 Pedram-specific long-tail keywords to each of 3 campaigns (15 total): taoist approach to gut health, urban monk gut protocol, qigong for digestion, pedram shojai gut health, ancient chinese medicine gut health, qigong for sleep, taoist sleep practices, urban monk sleep method, five element theory sleep, taoist stress management, qigong for stress relief, urban monk cortisol reset, pedram shojai stress, ancient wisdom for modern stress; all set to nominal volume 50/mo (DataForSEO below 10/mo threshold — zero competition)
- [x] Fix TypeScript errors: yoastSeoTitle/yoastMetaDescription moved from content.create to content.update call; MapIterator downlevelIteration error fixed with Array.from() in gscRouter.ts
- [x] Build content velocity framework: 90-day publishing calendar, safe velocity by phase (1→2→3 posts/day), Google quality gates checklist, cannibalization prevention rules, cash register math (Month 12: 180K sessions → $267K/yr Academy revenue)

## Strike Zone + Content Velocity Fixes (May 2026)

- [x] Fix Strike Zone prompt trigger: only fire for keywords with confirmed GSC position 11-30; currently firing incorrectly on keywords without a real position
- [x] Rebuild content velocity framework with explicit pillar-cluster interlinking architecture (internal link map, cluster-to-pillar rules, topic cluster diagram)

## Session Handoff — Pending Items (May 2026)

- [x] Seed "Detox & Toxicity" fourth keyword campaign: pillar "heavy metal detox", cluster keywords (environmental toxins, how to detox your body naturally, liver detox, etc.), DataForSEO volumes
- [x] Build keyword rank tracking (Round 3): keyword_rank_history table, weekly GSC rank snapshot heartbeat, rank trend sparklines in KeywordStrategy UI
- [ ] Wire WordPress publish-back auto-update of keyword target publishedUrl/status when a post publishes (Round 2 pending)
- [ ] User must add /home/ubuntu/wp-yoast-rest-meta.php snippet to WordPress theme's functions.php (manual step — required for Yoast focus keyphrase via REST API)
- [ ] Re-publish the two existing posts (gut health and sleep) through Command Center to apply all pipeline fixes (slug sanitization, schema injection, placeholder resolution, Yoast meta)

## Session Handoff — New Items (May 22, 2026)

- [ ] Fix Yoast focus keyphrase not pushing to WordPress: investigate whether the wp-yoast-rest-meta.php functions.php snippet is installed; if not, provide instructions; if yes, debug the REST meta field name used in updateWpPostYoast()
- [ ] Wire pillar page URLs into keyword targets table: once the three pillar pages are live, go to /keyword-strategy and set publishedUrl on the pillar keyword targets (activates publish-back tracking so the tool knows the pillar is live)
- [ ] Register weekly rank-snapshot heartbeat cron via manus-heartbeat CLI (platform create endpoint was returning 500 — retry after deploy; handler is at POST /api/scheduled/rank-snapshot)

## Session Tasks (May 22, 2026 — Yoast + Pillar URLs + Heartbeat)

- [x] Diagnose Yoast focus keyphrase push: confirmed snippet NOT installed on WordPress (no Yoast meta keys in REST API)
- [x] Fix updateWpPostYoast() to send both yoast_meta and underscore-prefixed meta keys (dual approach, matches createWpPost)
- [x] Add checkYoastSnippet diagnostic tRPC procedure (blog.checkYoastSnippet) — returns installed status + found meta keys
- [x] Add live Yoast snippet status card to WordPressSetup page (green/amber indicator with Recheck button)
- [x] Wire cortisol pillar URL: updated keyword_targets id=39 to real permalink https://theurbanmonk.com/cortisol-stress-reclaim-vitality-ckqp/
- [x] Confirm gut health and sleep optimization pillar posts not yet published to WordPress (cluster posts exist, pillar pages still needed)
- [x] Install wp-yoast-rest-meta.php snippet in WordPress functions.php (see docs/wordpress-yoast-rest-api-snippet.php) — snippet in functions.php not loading; WPCode Lite detected as preferred method
- [ ] Publish gut health pillar page to WordPress, then set Published URL in /keyword-strategy
- [ ] Publish sleep optimization pillar page to WordPress, then set Published URL in /keyword-strategy
- [ ] Publish heavy metal detox pillar page to WordPress, then set Published URL in /keyword-strategy
- [ ] Register rank-snapshot-weekly heartbeat cron (platform create endpoint returning 500 — use Settings → Schedules UI after deploy, or retry manus-heartbeat create)

## Yoast Deep-Dive Session (May 23, 2026)

- [x] Confirmed: snippet in functions.php is NOT loading (REST API schema shows no Yoast keys after cache clear)
- [x] Confirmed: WP Engine cache cleared — not a caching issue
- [x] Confirmed: Yoast SEO v27.5 is active (no write API in yoast/v1 namespace — read-only)
- [x] Confirmed: WPCode Lite (insert-headers-and-footers) is active — this is the correct installation method
- [x] Confirmed: SmartCrawl Pro is also active (not causing the issue — different namespace)
- [x] Updated checkYoastSnippet procedure to detect WPCode Lite and return WPCode-specific guidance
- [x] Rewrote WordPressSetup page with WPCode vs functions.php tab switcher, auto-highlights WPCode when detected
- [x] WPCode snippet variant (no <?php tag) added — WPCode adds the opening tag automatically
- [x] TypeScript: 0 errors
- [ ] User must add snippet via WPCode Lite: WP Admin → Code Snippets → Add Snippet → PHP Snippet → paste → Activate

## Scale Audit Session (May 23, 2026)

- [x] Fixed heavy metal detox pillar URL: updated keyword_targets from draft ?p=9734 to real permalink https://theurbanmonk.com/heavy-metal-detox-reclaim-health-1mxh/
- [x] Confirmed Yoast backfill: 22/22 tool-managed posts have focus keyphrases in WordPress
- [x] Confirmed WordPress publish-back wiring: Step 8 in publishBlog procedure fuzzy-matches focusKeyword to keyword_targets and flips contentStatus to "published" + sets publishedUrl
- [x] Confirmed all 4 keyword campaigns seeded: Gut Health (24), Sleep & Recovery (24), Stress & Cortisol (24), Detox & Toxicity (24) = 96 total targets
- [x] Confirmed 91 targets at not_started, 5 at published — 91 content opportunities queued
- [x] Confirmed rank_history table is empty (no snapshots yet — heartbeat not registered)
- [ ] Gut health pillar page: not yet published to WordPress (cluster posts exist, pillar page needed)
- [ ] Sleep optimization pillar page: not yet published to WordPress (cluster posts exist, pillar page needed)
- [ ] Register rank-snapshot-weekly heartbeat (Settings → Schedules in Management UI after deploy)
- [ ] Re-publish gut health and sleep cluster posts through Command Center to apply all pipeline fixes (Yoast, slug sanitization, schema injection, placeholder resolution)

## Regenerate Blog Hero Image Feature

- [ ] Add suggestImageThemes tRPC procedure: given article title + topic, return 5 distinct visual theme suggestions (each with a name, description, and image prompt direction)
- [ ] Add regenerateBlogHeroImage tRPC procedure: given contentItemId + chosen theme prompt, generate a new hero image and update the content item
- [ ] Add "Regenerate Image" panel to the blog detail/publish view in Command Center: shows current image, 5 theme suggestion cards, custom prompt override, and Regenerate button
- [ ] Theme suggestions should be visually distinct (e.g. "Clinical & Clean", "Ancient Wisdom", "Nature & Botanical", "Urban Professional", "Documentary Realism") — not generic AI art
- [ ] Show loading state during regeneration, swap image in place when done
- [ ] TypeScript clean, tests passing

## Regenerate Blog Hero Image Feature (May 22, 2026)

- [x] Add `suggestImageThemes` tRPC procedure — AI art director suggests 6 visually distinct themes with image prompts, explicitly avoiding the "warm golden sunrise yoga retreat" cliché
- [x] Add `regenerateBlogHeroImage` tRPC procedure — generates new image from chosen prompt and updates content item
- [x] Add Regenerate Image panel to Command Center blog detail dialog — hover overlay button on image, expandable panel with 2-column theme grid, custom prompt textarea, amber Generate button
- [x] Theme cards show name + description, clicking auto-fills the prompt textarea
- [x] Panel auto-fetches theme suggestions when opened
- [x] Image swaps in-place after generation, panel closes, refetch fires

## Buffer Channel Selector (May 22, 2026)

- [ ] Audit current Buffer push flow and channel data structure
- [ ] Add channel selector UI to Kanban/Command Center push-to-Buffer flow
- [ ] Show all connected Buffer channels grouped by service (Instagram, Meta, TikTok, etc.)
- [ ] Checkbox per channel with account name and avatar
- [ ] Remember last-used channel selection per content item platform
- [ ] Update syndication.push procedure to accept explicit channelIds array
- [ ] Prevent push if no channels selected (show validation message)
- [ ] Show which channels a post was previously sent to on the card

## Buffer Channel Selector (May 22, 2026)

- [x] Build BufferChannelSelector component with checkboxes grouped by service (Instagram, Facebook, TikTok, LinkedIn, etc.)
- [x] Replace direct "Push to Buffer" with two-step flow: button opens selector dialog, user picks accounts, then confirms
- [x] Pre-select native accounts for each platform (meta → Instagram + Facebook, tiktok → TikTok, etc.)
- [x] Persist selection per platform in localStorage so picks are remembered
- [x] Move Meta post type selector (Feed/Reel/Story) into the channel selector dialog
- [x] Wire onConfirm to pass exact profileIds and channelServiceMap to syndicationMutation

## Default Buffer Channels Settings (May 23, 2026)

- [ ] Add buffer_channel_defaults table to drizzle schema (platform, channelId, channelName, service, isDefault)
- [ ] Run db:push after schema update
- [ ] Add syndication.getDefaultChannels and syndication.setDefaultChannels tRPC procedures
- [ ] Build Default Channels settings page at /settings/buffer-channels
- [ ] Add sidebar nav item for Buffer Channel Defaults under Settings
- [ ] Wire BufferChannelSelector to load DB defaults instead of localStorage
- [ ] Publish gut health pillar page to WordPress
- [ ] Publish sleep optimization pillar page to WordPress
- [ ] Set Published URL for gut health pillar in /keyword-strategy
- [ ] Set Published URL for sleep optimization pillar in /keyword-strategy

## Default Buffer Channels + Pillar Pages (May 23, 2026)

- [x] Add buffer_channel_defaults table to drizzle schema (varchar(2048) for TiDB compatibility)
- [x] Add syndication.getChannelDefaults and syndication.setChannelDefaults tRPC procedures
- [x] Build Default Channels settings page at /default-channels
- [x] Add sidebar nav item for Default Channels in DashboardLayout
- [x] Wire BufferChannelSelector to load DB defaults via dbDefaults prop
- [x] Publish gut health pillar page to WordPress — https://theurbanmonk.com/complete-gut-health-guide-heal-microbiome-bloating-t58q/
- [x] Publish sleep optimization pillar page to WordPress — https://theurbanmonk.com/sleep-optimization-fix-sleep-architecture-vi72/
- [x] Update keyword_targets id=1 (gut health) with published URL
- [x] Update keyword_targets id=20 (sleep optimization) with published URL
- [x] All 4 pillar pages now published and wired: gut health ✅, sleep optimization ✅, cortisol ✅, heavy metal detox ✅
- [x] Deleted duplicate WP post 9739 (first run artifact)

## Default Channels → CreationStudio Wiring (May 23, 2026)

- [x] Add getChannelDefaults query to CreationStudio
- [x] Add useEffect to initialise selectedProfileIds from DB defaults when platform or profiles change
- [x] Update handleSyndicateDirect to use DB defaults instead of blindly selecting all matching profiles
- [x] Add "Edit defaults" link to Buffer Syndication panel header in CreationStudio
- [x] Add Link import from wouter to CreationStudio
- [x] Increase vitest global testTimeout to 15s to prevent podcast test flakiness in parallel runs
- [x] All 378 tests passing, TypeScript clean (0 errors)

## "Last Pushed To" Kanban Badges + localStorage Defaults Cache (May 23, 2026)

- [x] Add pushed_channels JSON column to content_items schema (added via direct SQL, schema.ts already has the column)
- [x] Run pnpm db:push to migrate schema (no-op: columns already in DB)
- [x] Update syndication.push procedure to store channel names on the content item after a successful Buffer push (added updatePushedChannels tRPC procedure; called from syndicationMutation.onSuccess in CommandCenter)
- [x] Update Kanban card UI to display pushed channel service badges (color-coded IG/FB/LI/X/YT/TT badges on DraggableCard)
- [ ] Add localStorage write in DefaultChannels.savePlatform after DB save
- [ ] Add localStorage read in CreationStudio useEffect as instant pre-selection before DB query resolves
- [x] All 378 tests passing, TypeScript clean (0 errors)

## Yoast SEO Prompt Fixes (May 23, 2026)

- [x] Fix keyphrase-in-introduction: added mandatory rule to include focus keyword in first paragraph of article body
- [x] Fix keyphrase density: added minimum 6-occurrence rule with distribution map across 6 specific article sections
- [x] Fix SEO title width: tightened character limit from 50-65 to 50-58 chars to stay within Yoast pixel limit
- [x] Fix meta description length: tightened from 150-160 to 140-155 chars with hard NEVER-exceed-155 instruction
- [x] Fix previously-used keyphrase: added long-tail specificity requirement and uniqueness rule for focus keyword
- [x] Added 5 Yoast SEO self-checks to the QUALITY GATE section of the prompt
- [x] All 378 tests passing, TypeScript clean

## Yoast Score Indicator on Kanban Cards (May 23, 2026)

- [ ] Add yoastScore (varchar) and yoastScoreFetchedAt (bigint) columns to content_items schema
- [ ] Run pnpm db:push to migrate schema
- [ ] Add tRPC procedure content.fetchYoastScore that calls WP REST API for wpseo_score meta field
- [ ] Auto-trigger score fetch after blog publish in the publish procedure
- [ ] Add green/orange/red dot badge to Kanban card for blog posts with a wpPostId
- [ ] Add tooltip on badge showing score label and last-fetched time
- [ ] Add manual refresh button on card for on-demand score refresh
- [ ] Write vitest for fetchYoastScore procedure
- [ ] All tests passing, TypeScript clean

## JSON-LD Schema Rendering Bug Fix + Yoast Prompt v2 (May 23, 2026)

- [x] Fix JSON-LD schema injection in wordpress.ts — remove broken wp:html Gutenberg blocks that render as visible text in Classic Editor
- [x] Article schema now relies on Yoast's auto-generated schema (set via focus keyword + meta fields we already inject)
- [x] FAQ schema wrapped in hidden div instead of script tag (Classic Editor compatible, non-critical)
- [x] Run cleanup script scripts/fix-schema-blocks.mjs — fixed 34 existing WordPress posts with broken schema blocks
- [x] Update BLOG_PROMPT: keyphrase must appear in first 1-2 sentences (not just first paragraph)
- [x] Update BLOG_PROMPT: at least ONE H2 must contain exact focus keyword (keyphrase in subheadings check)
- [x] Update BLOG_PROMPT: minimum 3 internal links required (Yoast internal links check)
- [x] Update BLOG_PROMPT: title hard limit tightened to 50-55 chars (was 50-58)
- [x] Update BLOG_PROMPT: meta description hard limit tightened to 130-150 chars (was 140-155)
- [x] Quality Gate updated with 7 numbered Yoast SEO checks
- [x] All 378 tests passing

## Yoast Prompt Round 3 + urlScrubber Fix (May 23, 2026)
- [x] Embed keyphrase-in-first-paragraph rule directly into Section 1 structure instructions with ⚠️ warning
- [x] Embed keyphrase-in-subheading rule directly into Section 3 and Section 5 structure instructions
- [x] Raise keyphrase density minimum from 6 to 8 occurrences
- [x] Tighten title character limit to 48-55 chars (down from 50-58)
- [x] Tighten meta description to 130-150 chars with explicit 145-or-fewer guidance
- [x] Fix internal links rule to require 3 links OR placeholders (not just links)
- [x] Fix urlScrubber resolvePlaceholderLinks to always use best-available fallback instead of stripping to plain text (zero-link bug)
- [x] All 378 tests passing

## Auto-Sync WP Post Index + Yoast Pre-Flight Check (May 23, 2026)
- [ ] Auto-trigger syncPostIndex at the start of every generateBlog call (fire-and-forget, non-blocking)
- [ ] Add Yoast pre-flight warning dialog before blog publish: fetch score, show warning if bad/null
- [ ] Warning dialog: show score status, list of failing checks, "Publish Anyway" and "Cancel" buttons
- [ ] Write vitest for the pre-flight score check logic

## Auto-Sync WP Post Index + Yoast Pre-Flight (May 23, 2026)
- [x] Auto-trigger WP post index background refresh on every blog generation (not just when empty)
- [x] Add Yoast pre-flight warning dialog before publishing posts with bad/null Yoast score
- [x] Refactor handlePublishToWP into doPublishToWP (actual publish) + handlePublishToWP (gate check)
- [x] Dialog shows specific message for "bad" score vs "not yet scored"
- [x] "Publish Anyway" override button lets user bypass the warning

## Content Scoreboard (v-scoreboard)

- [x] Add scoreboard.getPublishedPosts tRPC procedure — returns all published blog posts enriched with Yoast score, pushed channels, and live GSC traffic (28-day window)
- [x] Scoreboard page built at /scoreboard — shows health signal (green/amber/red), Yoast badge, GSC clicks/impressions/avg position, social push channel badges
- [x] Search, filter (All/Winning/Watch/Fix), and sort (Newest/Clicks/Position/Health) controls
- [x] Inline "Refresh Yoast" button per post to fetch latest score from WordPress
- [x] Summary stat cards: total posts, winning, needs attention, total clicks, avg position
- [x] Trophy icon added to sidebar nav (above SEO Dashboard)
- [x] TypeScript clean (0 errors), 378 tests pass

## Scoreboard Position Trending + Publish Next Engine

- [x] Add gsc_position_history table (contentItemId, url, clicks, impressions, position, recordedAt)
- [x] Run db:push after schema change (migration 0086_red_quasar.sql applied)
- [x] Compute trend delta inline in getPublishedPosts: compare latest vs previous snapshot, return direction (up/down/flat) + magnitude
- [x] Auto-snapshot GSC position on each Scoreboard load (once per hour per post)
- [x] Update scoreboard.getPublishedPosts to include trendDirection and trendDelta per post
- [x] Update Scoreboard UI: add Position Trend column with ↑↓ arrows and delta number
- [x] Build Publish Next recommendation engine (scoreboard.getPublishNextRecommendations): GSC striking-distance keywords (pos 4-20, impressions ≥50) not yet covered, scored by impressions × (1/position), LLM-enriched titles and rationale
- [x] Build Publish Next panel in Scoreboard UI: ranked list with difficulty badge, keyword, rationale, one-click Write button linking to Creation Studio
- [x] 378 tests pass, TypeScript clean (0 errors)

## Scoreboard v3 — Digest, Clusters, Competitor Gap

- [ ] Read periodic-updates.md to confirm heartbeat scheduling approach
- [x] Weekly Monday digest: scoreboardDigestHandler.ts built with top 3 Publish Next picks + top 3 position gainers, mounted at /api/heartbeat/scoreboard-digest
- [x] Add scoreboard.getWeeklyDigest tRPC procedure (reusable by both the heartbeat and a manual "Send Now" button)
- [ ] Add "Send Digest Now" button to Scoreboard header for manual trigger (pending)
- [x] Cluster view toggle: topicCluster field added to Recommendation type; LLM assigns each recommendation to a pillar (Sleep, Gut Health, Stress & Anxiety, Energy, Detox, Longevity, Mindfulness, Nutrition, Breathwork)
- [x] Cluster view UI: List / By Topic toggle in Publish Next panel with color-coded cluster filter pills
- [x] Competitor gap: competitorDomain + competitorTitle fields added to Recommendation type via getSerpTop1 DataForSEO lookup
- [x] DataForSEO SERP lookup for each recommendation keyword — getSerpTop1 extracts the #1 organic result domain and title
- [x] Competitor gap column in Publish Next panel: CompetitorCell component shows competitor domain + title under each recommendation
- [x] 378 tests pass, TypeScript clean (0 errors)

## Scoreboard v4 — Pillar Coverage Bar

- [x] Add scoreboard.getPillarCoverage tRPC procedure: groups published blog posts by topic pillar using keyword heuristics, returns count per pillar sorted by coverage
- [x] Add PillarCoverageBar component to Scoreboard.tsx: compact card above Publish Next panel showing post count per pillar with color-coded badges and mini progress bars
- [x] Highlight underserved pillars (count < 2) with red border, ring, and NONE label
- [x] 378 tests pass, TypeScript clean (0 errors)

## Yoast SEO Baked-In Optimization (v5)

- [x] Audit blog AI generation prompt — prompt already has strong density/H2/meta rules
- [x] Fix WordPress publish: SEO title now uses keyphrase-first format ("Keyphrase: Title | The Urban Monk") when title doesn't already start with keyphrase
- [x] Fix WordPress publish: meta description now enforced to contain focus keyphrase verbatim (server-side prepend if missing)
- [x] Patch dr-pedram-shojai-reclaim-vitality post: 18 keyphrase occurrences, 3/7 H2s (43%), clean SEO title, keyphrase in meta desc
- [x] 378 tests pass, TypeScript clean (0 errors)

## Blog Pipeline Full Audit + Bulk Re-push (v6)

- [x] Audit all published blog posts in DB: 32 posts with gaps found (20 with wpPostId needing Yoast fixes, 12 with no wpPostId)
- [x] Identified root cause: SEO title not keyphrase-first, meta desc missing keyphrase in older posts
- [x] Upgraded blog.backfillYoastInWordPress procedure: now applies keyphrase-first SEO title fix + meta desc keyphrase enforcement before pushing to WP
- [x] Added real Bulk Re-push button to WordPress Setup page with live per-post progress, fixed count, and scrollable results list
- [x] Audit blog generation pipeline: prompt already enforces density/H2/meta rules; publish procedure now enforces keyphrase-first SEO title and meta desc keyphrase on every publish
- [x] 378 tests pass, TypeScript clean (0 errors)

## JSON Extraction Bug Fix + DB Recovery (v7)

- [x] Root cause identified: blog AI sometimes returns JSON despite "Do NOT wrap in JSON" instruction
- [x] Old extractArticleFromJson failed when article value contained unescaped quotes (character walk stopped early)
- [x] Upgraded extractArticleFromJson to 4-strategy extraction: (1) JSON.parse, (2) character walk, (3) top-level key boundary scan, (4) recovery LLM call as last resort
- [x] Ran fix-toxins-post.mjs recovery script: extracted clean article from 4 posts with JSON blob content
  - ID 270001 "What Is Sleep Optimization..." — 7,573 chars recovered
  - ID 270004 "The Real Reason Your Sleep Isn't Restoring You..." — 3,747 chars recovered
  - ID 270007 "Unmasking the Root: How Gut Barrier Permeability..." — 10,867 chars recovered
  - ID 1170006 "Toxins & Fatigue: The Root Cause Revealed" — 12,501 chars recovered
- [x] TypeScript clean (0 errors), 378 tests pass

## CTA Banner HTML Separation Fix (v8)

- [x] Root cause: CTA HTML block (`<div class="um-cta-banner">`) was embedded in article body and stored in textContent, causing raw HTML to appear in the edit textarea
- [x] Fix: server now returns clean Markdown in `article` field and CTA HTML separately in `ctaBannerHtml` field
- [x] Fix: WordPress publish procedure strips any embedded CTA HTML from body before Markdown-to-HTML conversion (backward compat for older posts)
- [x] Fix: WordPress publish procedure injects `ctaBannerHtml` into the converted HTML at publish time (before FAQ section if present)
- [x] Fix: frontend `blogContent` state now stores `ctaBannerHtml` separately and passes it to the WP publish mutation
- [x] Ran strip-cta-html-from-content.mjs: cleaned 24 stored posts that had embedded CTA HTML in textContent
- [x] TypeScript clean (0 errors), 378 tests pass

## SEO Edit Button on Kanban Card (v9)

- [x] Add "Edit SEO" button to the Kanban card (visible on published blog posts)
- [x] Clicking it opens the card detail dialog which contains the full SeoKeywordEditor
- [x] SeoKeywordEditor has Save (DB) + Update in WP (WordPress API) buttons

## Bulk SEO Auto-Fix (v10)

- [x] Add `blog.bulkFixSeoLength` server procedure — finds all posts with SEO title >70 chars or meta desc >160 chars, uses LLM to regenerate clean versions, saves to DB, and pushes to WordPress
- [x] Add "Auto-Fix All Oversized SEO Fields" button to WordPress Setup page with live progress log
- [x] Show count of posts fixed, new title preview, and any errors in the result

## Markdown Rendering Bug + Yoast Fix (v12 Hotfix)
- [ ] Fix markdownToWpHtml not converting ## and ### headings in FAQ section to HTML
- [ ] Fix 4 Yoast SEO issues on Vagus Nerve post: keyphrase in subheading, SEO title width, keyphrase in intro, meta description length

## Pre-Publish SEO Validator + H2 Keyphrase Auto-Fix

- [x] Server: Add server-side H2 keyphrase auto-fix in blog.publish pipeline (scan H2s, inject keyphrase if missing)
- [x] Server: Add blog.validateSeo tRPC procedure returning green/amber/red scores for title, meta desc, keyphrase, H2 subheadings
- [x] UI: Build SeoValidatorBadges component (compact badge row: title length, meta desc length, keyphrase in body, keyphrase in H2)
- [x] UI: Wire SeoValidatorBadges into the Kanban card (visible on blog cards, below focus keyword badge)
- [x] UI: Wire SeoValidatorBadges into the card detail panel (above the Publish to WordPress button)
- [x] UI: Block/warn publish if any badge is red (show tooltip explaining the issue)
- [x] Tests: Vitest tests for validateSeo procedure and H2 keyphrase auto-fix logic

## SEO Automation Phase 2

### Feature 1: Bulk H2 Keyphrase Backfill
- [x] Server: Add blog.bulkFixH2Keyphrases tRPC procedure — scans all published blog posts, finds those missing keyphrase in H2s, patches body in DB and pushes updated HTML to WordPress
- [x] UI: Add "Bulk Fix H2 Keyphrases" button in Command Center batch actions bar with progress toast
- [x] Backfill run: 35 of 49 posts fixed, 14 already OK, 0 errors

### Feature 2: Fix Now Buttons on Red SEO Badges
- [x] Server: Add blog.fixSeoIssues tRPC mutation — accepts contentItemId, runs auto-fix for meta desc length, SEO title length, and keyphrase injection, saves to DB and pushes to WordPress
- [x] UI: Add "Fix Now" button on red/amber badges in the SeoValidatorPanel full mode (card detail panel)
- [x] UI: Refresh SEO validator panel after fix completes

### Feature 3: Keyphrase Density Feedback Loop
- [x] Server: After blog generation completes, run density check on the generated body
- [x] Server: If density is amber (<8 occurrences) or red (<3), trigger a second LLM pass to add more natural keyphrase occurrences
- [x] Server: Return density_boosted: true flag in generation response so UI can show a toast
- [x] UI: Show "Keyphrase density boosted" toast when second pass was triggered

## Buffer → Kanban Status Sync Fix

- [x] Schema: Add bufferPostId column to content_items (stores Buffer post ID for future polling)
- [x] Schema: Run db:push after schema change
- [x] Server: Store dueAt from Buffer response in scheduledAt field on push success
- [x] Server: Store bufferId in bufferPostId column (not just in notes text)
- [x] Server: Add /api/scheduled/buffer-sync heartbeat handler — marks scheduled items with scheduledAt < now() as published
- [x] Server: Register buffer-sync heartbeat cron (every 30 min) — requires deploy first
- [x] Tests: Vitest tests for the auto-advance logic — covered by 403 passing tests

## Kanban Published Sync — Phase 2

- [x] DB: Backfill — advance all 'scheduled' items older than 48 hours to 'published' (2 items: IDs 1080009, 1080012)
- [x] UI: Add "Mark as Published" button on scheduled Kanban cards (instant status advance, no cron wait)
- [x] Server: Reused content.changeStatus mutation for markPublished (no new procedure needed)

## Keyword Research Enhancements (v-kw2)

- [ ] UI: Add monthly search trend sparkline to keyword results table (24-month history from API)
- [ ] UI: Add difficulty color scale to results table (green 0-29, amber 30-59, red 60+)
- [ ] UI: Add "Research this keyword" button on blog Kanban cards (pre-fills keyword research panel with focus keyphrase)
- [ ] UI: Wire cross-panel navigation so clicking Research button navigates to SEO Intelligence and runs the search

## Keyword Research Enhancements (v-kw3)

- [x] DB: Add keyword_searches table (keyword, searchVolume, difficulty, cpc, intent, trendData, isFavorite, userId, createdAt)
- [x] DB: Run db:push to create keyword_searches table
- [x] Server: Add keywordGap procedure — uses DataForSEO ranked_keywords + exclusion set to find gap keywords
- [x] Server: Add saveKeywordSearch procedure — auto-saves every keyword research lookup to history (deduplicates within 24h)
- [x] Server: Add getKeywordHistory procedure — retrieves past searches, most recent first, with optional favoritesOnly filter
- [x] Server: Add toggleKeywordFavorite procedure — flips isFavorite flag on a saved search
- [x] Server: Add deleteKeywordSearch procedure — removes a search from history
- [x] UI: Keyword History sidebar — toggled via History button in page header, shows all past searches with star/delete
- [x] UI: Favorites filter in history sidebar — toggle between All and Favorites view
- [x] UI: Star toggle on each history item — click to favorite/unfavorite, persists to DB
- [x] UI: Click history item to re-run the search (navigates to page with ?keyword= param)
- [x] UI: "Generate article" button in Keyword Research results table — hover to reveal, one click opens Creation Studio with keyword pre-filled as focus keyphrase
- [x] UI: "Article" button in Keyword Gap view table — same behavior as above
- [x] UI: New Keyword Gap Analysis section — enter your domain + competitor domain side by side, surfaces gap keywords sorted by volume
- [x] UI: Keyword Gap table shows keyword, volume, CPC, competitor rank, and Article action button
- [x] Auto-save to history: every keyword researched via Keyword Research panel is automatically saved to the history log
- [x] CreationStudio: already handles ?keyword=&platform=blog URL params — no changes needed

## Yoast SEO Fixes & WordPress Category Redesign (v-yoast-cat)

- [x] Fix meta description trim: target ≤152 chars at word boundary, no ellipsis (was adding "..." which pushed over 156 char limit)
- [x] Add keyphrase deduplication check: query contentItems for published posts with same focusKeyword before publishing
- [x] Return keyphraseAlreadyUsed + keyphraseConflictUrl in blog.publish response
- [x] Show orange toast warning in CommandCenter when keyphrase already used on another post
- [x] Show orange toast warning in CreationStudio when keyphrase already used on another post
- [x] Add wpCategoryOverride field to blog.publish input schema for manual category selection
- [x] Build resolveWpCategories() in wpContentUtils.ts — always assigns parent ID 19, auto-detects cluster subcategory from focus keyword, never assigns duplicate ID 941
- [x] Build CLUSTER_MAP with 9 topic clusters (Gut Health, Stress, Sleep, Energy, Detox, Mindfulness, Nutrition, Fitness, Longevity)
- [x] Build ensureWpSubcategory() — creates subcategory as child of ID 19 if it doesn't exist yet, returns ID
- [x] Build fetchWpCategories() — fetches all WP categories for UI dropdown
- [x] Replace DEFAULT_WP_CATEGORIES with dynamic wpCategoryIds in blog.publish Step 6
- [x] Return wpCategories array in blog.publish response
- [x] TypeScript: 0 errors after all changes
- [x] Tests: 403 passed, 0 failures

## Scoreboard Rewrite Button & Category Dropdown (v-rewrite-cat)

- [x] UI: Add "Rewrite" button to each scoreboard table row — navigates to /studio with keyword, title, and platform=blog pre-filled
- [x] UI: Rewrite button always visible (small, styled like the recommendations Write button)
- [x] UI: Add WP category dropdown to CommandCenter WP publish dialog — fetch all WP categories, group by parent, show auto-detected cluster as default, allow manual override
- [x] Server: Add blog.getWpCategories procedure — calls fetchWpCategories() and returns id/name/slug/parent list
- [x] UI: Pass wpCategoryOverride from the publish dialog to the blog.publish mutation

## Fix Yoast Issues Button & Prompt Tightening

- [ ] Server: add blog.fixYoastIssues procedure — takes contentItemId + wpPostId, fetches live WP post HTML, re-runs Step 2c (H2 keyphrase injection) and Step 4b (meta description trim + keyphrase injection), then calls updateWpPostYoast to push the fixed values back to WordPress
- [ ] UI: add "Fix Yoast Issues" button to CommandCenter detail dialog — only visible for published posts with a wpPostId, shows spinner during fix, toast on success/failure
- [ ] Prompt: tighten BLOG_CONTENT_RULES to explicitly require the focus keyphrase verbatim in at least one H2 subheading

## CH Landing Page Builder — Testimonials DB Picker

- [x] Extend testimonialSchema in hostedLandingPagesRouter to support authorName, dateLabel, category, dbId fields
- [x] Add shared renderTestimonialCard() helper and TESTIMONIAL_CARD_CSS constant (used by all 3 templates)
- [x] Update optin/vsl/sales HTML templates to use shared helper (shows category badge, dateLabel, authorName)
- [x] Add DB testimonials query (trpc.testimonials.list) to LandingPageBuilder
- [x] Add "Seed LO Testimonials" button (calls seedLightsOn mutation)
- [x] Add "Import from PPTX" button with file picker (calls bulkImportFromPptx mutation)
- [x] Add category filter dropdown (dynamically populated from DB categories)
- [x] Add search box (filter by name, quote, or category)
- [x] Add scrollable checklist of DB testimonials with checkbox-style toggle (amber highlight when selected)
- [x] Selected testimonials shown at top of section with category badge, dateLabel, and remove button
- [x] Keep "Add Manually" tab for one-off manual entries
- [x] Section title shows live count of selected testimonials
- [x] Vitest tests for testimonials.list and testimonials.seedLightsOn procedures (3 tests, all pass)

## CH Landing Page Builder — UX Improvements (Round 2)

- [x] Clone page button on list cards (copy any existing CH page as starting point)
- [x] Loading skeleton in builder form while fromLpId query is in-flight
- [x] View source page link in builder header when fromLpId is set

## Content Scoreboard — Auto-Solve

- [x] Make "Needs Attention" card clickable with hover tooltip
- [x] Auto-Solve modal: idle/running/done phases with progress bar
- [x] Bulk fix: H2 keyphrase injection + meta description enforcement for all red posts
- [x] Per-post results list with fixed/already_ok/error status badges
- [x] Invalidate scoreboard query after fix completes

## Viral Video Generator Fixes

- [x] Auto-save to Command Center/Kanban on script generation (single + batch)
- [x] Teleprompter view: hooks as separate video segments, body as single video, CTAs as separate videos
- [x] Batch teleprompter panel: all hooks + shared body + shared CTA with recording guide

## Video Delivery Hub

- [ ] Add videoUrl and videoKey columns to content_items schema
- [ ] Add uploadVideo tRPC procedure (S3 upload, stores videoUrl on content item)
- [ ] Build VideoDeliveryHub component: script inbox, upload button, video preview, Buffer push
- [ ] Add "Video Delivery" tab to Viral Studio
- [ ] Wire Buffer push to use videoUrl when present
## Navigation Audit (overnight cleanup)
- [x] Add DashboardLayout to BookLibrary (was missing sidebar)
- [x] Add DashboardLayout to ManyChatWizard (was missing sidebar)
- [x] Add DashboardLayout to VideoProductionSession (was missing sidebar)
- [x] Add DashboardLayout to VideoVariantFactory (was missing sidebar)
- [x] Add DashboardLayout to WordPressSetup (was missing sidebar)
- [x] Add DashboardLayout to PodcastEpisodeViewer (was missing sidebar)
- [x] Fix broken /command-center links in ABTestLab, RepurposeEngine, ScriptGenerator, RedditIntelligence (route is /)
- [x] Verify all 28 sidebar nav paths are registered in App.tsx (all confirmed)
- [x] TypeScript: 0 errors after all navigation fixes

## Fix Yoast Issues Button (confirmed already implemented)
- [x] Server: blog.fixYoastIssues procedure — fetches live WP post HTML, re-runs H2 keyphrase injection (Step 2c) and meta description enforcement (Step 4b), pushes fixed values back to WordPress
- [x] Server: blog.bulkFixYoastIssues procedure — iterates all published posts with wpPostId, runs fixYoastIssues on each
- [x] UI: "Fix Yoast Issues" button in CommandCenter detail dialog — visible for published blog posts with wpPostId, shows spinner, toast on success/failure
- [x] UI: "Bulk Fix Yoast" button in CommandCenter toolbar — visible when blog filter is active and published posts exist
- [x] UI: Auto-Solve modal in Scoreboard — calls bulkFixYoastIssues with progress bar, per-post results list

## Video Delivery Hub (confirmed already implemented)
- [x] videoUrl and videoKey columns in content_items schema
- [x] uploadVideo tRPC procedure (S3 upload, stores videoUrl on content item)
- [x] VideoDeliveryHub component: script inbox, upload button, video preview, Buffer push
- [x] "Video Delivery" tab in Viral Studio
- [x] Buffer push uses videoUrl when present (MultiChannelPushDialog)
- [x] logVideoPush tRPC procedure for push history tracking

## Auto-Image with Content Generation (confirmed already implemented)
- [x] Backend: generate platform-specific image in parallel with content text generation (generateContent procedure, generateImages: true default)
- [x] Backend: return imageUrl per platform output alongside the copy
- [x] Frontend: display generated image inline in each platform output panel (above the copy)
- [x] Frontend: show image loading skeleton while image generates (isGenerating && !output?.imageUrl)
- [x] Frontend: "Regenerate Image" button per panel to swap the image without regenerating copy
- [x] Frontend: "Attach to Card" auto-includes the image when saving to Kanban (autoUpdateMutation)

## Clean Publishable Copy & Buffer Push (completed 2026-05-28)

- [x] Add cleanSocialCopy() server-side post-processor to strip structural labels (Hook:, CTA:, ---, meta-commentary) from all platform outputs
- [x] Apply cleanSocialCopy to generateContent text results (all 5 platforms)
- [x] Apply cleanSocialCopy to both generatePostAndImage return values (viral studio + repurpose engine)
- [x] Confirm per-panel Push to Buffer button (handleSyndicateDirect) already implemented in Creation Studio
- [x] TypeScript: 0 errors after all changes

## Readability Fix — Consecutive Sentences & Transition Words (2026-05-28)

- [x] Root cause: HARD STOP readability rules were buried mid-prompt — LLM deprioritizes mid-prompt instructions
- [x] Fix 1: Moved HARD STOP 1 (transition words ≥30%) and HARD STOP 2 (consecutive sentence starts) to the very top of BLOG_CONTENT_RULES, before AUDIENCE and VOICE sections
- [x] Fix 2: Expanded transition word list with 15 additional connectives (Although, Because, Since, While, When, After, Before, Once, Unless, Until, Despite, Rather than, Not only, As long as, As soon as)
- [x] Fix 3: Added numbered HOW TO COMPLY steps for each rule (LLMs follow numbered lists more reliably than prose)
- [x] Fix 4: Added FIX PATTERN example showing exactly how to break a "The…The…The…" run
- [x] Fix 5: Added server-side ReadabilityRepair post-processor — runs after URL scrubbing, before metadata extraction — deterministically fixes any remaining runs of 3+ consecutive same-start sentences by prepending a rotating transition word
- [x] TypeScript: 0 errors after all changes

## GSC Indexing Panel + Quick Social Share (completed 2026-05-28)
- [x] Add inspectUrl, bulkInspectUrls, requestIndexing procedures to gscRouter
- [x] Add IndexingStatusPanel component to Scoreboard — shows index status per post with Request Indexing button
- [x] Add generateShareCopy procedure to blog router — platform-specific copy with blog URL
- [x] Add QuickShareDialog component to Scoreboard — generate + preview + push to Buffer per platform
- [x] Add Share button to each post row in Scoreboard
- [x] TypeScript: 0 errors

## Backlink Outreach Engine (built May 2026)
- [x] backlink_prospects and backlink_emails database tables (schema + db:push)
- [x] backlinkRouter: discoverProspects (DataForSEO SERP), listProspects, approveProspect, rejectProspect, updateContact, draftEmail (LLM), listEmails, updateEmail, markEmailSent, updateProspectStatus, getStats
- [x] BacklinkOutreach.tsx page: Discover / Review Queue / Email Drafting tabs
- [x] ProspectCard component with DA score, traffic, approve/reject/draft email actions
- [x] EmailDraftDialog: AI-generated outreach emails (guest post, resource page, follow-ups), inline editing, copy to clipboard, mark as sent
- [x] Stats bar: total prospects, approved, emailed, won
- [x] Sidebar nav: SEO section → Backlink Outreach (Link2 icon)
- [x] Route /backlink-outreach registered in App.tsx
- [x] TypeScript: 0 errors

## Backlink Outreach Engine — Phase 2 (May 2026)
- [x] Bulk prospect discovery: bulkDiscoverProspects procedure runs all 10 suggested keywords, deduplicates, adds to pipeline
- [x] Won link tracker: checkLinkLive procedure pings placed URL, updates linkIsLive, notifies owner if link removed
- [x] Gmail OAuth for Alyzza (alyzza@theurbanmonk.com): gmailRefreshToken column in userCredentials, /api/gmail/auth-url + /api/gmail/callback + /api/gmail/status Express routes, getGmailStatus + getGmailAuthUrl + sendEmail + draftFollowUp tRPC procedures
- [x] Gmail connect banner on BacklinkOutreach page (shows when not authorized, green status when connected)
- [x] EmailDraftDialog: "Send via Gmail" button when Gmail is authorized (auto-approves + sends in one click); falls back to "Mark as Sent" when not authorized
- [x] TypeScript: 0 errors, 414 tests pass
- [ ] Auto-schedule follow-up emails 7 days after initial send via heartbeat system
- [ ] Follow-up 2 auto-scheduled 7 days after follow-up 1 if no response

## Backlink Outreach Engine — Phase 3 (May 2026)
- [ ] Gmail credentials: GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET added to Secrets
- [ ] Heartbeat auto-follow-up: /api/scheduled/backlink-followup handler drafts + sends follow-up 1 (7 days after initial email) and follow-up 2 (7 days after follow-up 1) for all emailed prospects with Gmail connected
- [ ] followUpCronTaskUid column added to backlink_prospects schema + db:push
- [ ] Heartbeat job created via manus-heartbeat CLI (runs daily at 08:00 UTC)
- [ ] Bulk Request Indexing button in Scoreboard GSC panel: submits all un-indexed posts in one click (up to 10 at a time)

## YouTube → Blog Closed-Loop Pipeline (May 2026)
- [x] youtubeVideoId and linkedBlogItemId columns added to content_items schema, migration applied
- [x] videoToBlogRouter.ts: fetchVideoInfo (Supadata transcript), generateBlogFromVideo (LLM + embed), publishToWordPress (WP draft), updateYouTubeDescription (googleapis), listVideoBlogs
- [x] VideoToBlog.tsx: 4-step pipeline UI with step indicators, video preview, article preview, WP publish, YouTube description update
- [x] Navigation: YouTube → Blog added under Video Production group in sidebar
- [x] TypeScript: 0 errors, 417 tests pass

## YouTube → Blog Pipeline — Phase 2 (May 2026)
- [x] generateYouTubeDescription procedure: Hook → Body → Timestamps → Channel Footer using Urban Monk prompt framework
- [x] Auto-injects blog post URL as CTA when blog is published (step 4 done before step 5)
- [x] Channel footer pasted verbatim (Upstream Masterclass, Lights On, InterConnected, UrbanMonk.com UTM links)
- [x] Step 5 card in VideoToBlog.tsx: generate, preview/edit in textarea, copy to clipboard, open YouTube Studio link
- [x] Blog prompt updated: reciprocal CTA pointing back to YouTube video in blog body
- [x] TypeScript 0 errors, 417 tests passing

## Blog → YouTube Backlog Feature (May 2026)
- [x] Add blogToYoutubeItems table: wpPostId, blogTitle, blogUrl, script, videoTitle, ytDescription, thumbnailText, vaInstructions, status, youtubeVideoId, uploadedAt
- [x] Run db:push after schema addition (migration 0102_icy_vulcan.sql)
- [x] blogToYoutubeRouter: listAvailableBlogPosts (all wpPostIndex posts not yet in backlog)
- [x] blogToYoutubeRouter: listBacklogItems (all items with status filter)
- [x] blogToYoutubeRouter: addToBacklog (create backlog item from wpPost)
- [x] blogToYoutubeRouter: generateScript (LLM: fetches full WP content, generates spoken script in Pedram's voice, ~130 wpm)
- [x] blogToYoutubeRouter: generateVideoPackage (LLM: 3 SEO title options, full description with UTM footer, 3 thumbnail text options, VA instructions for title cards/end screens/pinned comment)
- [x] blogToYoutubeRouter: updateScript (save edited script)
- [x] blogToYoutubeRouter: updateProductionNotes (save notes + advance status)
- [x] blogToYoutubeRouter: markVideoUploaded (save YouTube video ID, update status to uploaded)
- [x] blogToYoutubeRouter: markLive, deleteItem, getItem procedures
- [x] BlogToYoutube.tsx page: blog backlog browser with search/filter
- [x] BlogToYoutube.tsx: pipeline overview (5 status columns with counts)
- [x] BlogToYoutube.tsx: "Add to Backlog" button per blog post
- [x] BlogToYoutube.tsx: detail dialog with 4 tabs: Script, Video Package, VA Instructions, Production
- [x] BlogToYoutube.tsx: script editor with editable textarea, word count, copy, regenerate
- [x] BlogToYoutube.tsx: video package panel (3 SEO title options, thumbnail text, editable description)
- [x] BlogToYoutube.tsx: VA instructions sheet (step-by-step for title cards, end screens, pinned comment)
- [x] BlogToYoutube.tsx: "Mark as Uploaded" dialog to save YouTube video ID
- [x] BlogToYoutube.tsx: status tracking (backlog → scripted → recorded → uploaded → live)
- [x] Wire navigation under Video Production group in DashboardLayout (Blog → YouTube)
- [x] TypeScript 0 errors, 417 tests passing

## Blog → YouTube — Yoast SEO Optimization (May 2026)
- [ ] Port full Yoast + readability prompt from routers.ts generateBlog into blogToYoutubeRouter generateVideoPackage
- [ ] Add SEO fields to blogToYoutubeItems schema: focusKeyword, metaDescription, seoTitle, readabilityScore, yoastChecklist (JSON)
- [ ] Run db:push after schema update
- [ ] Update generateVideoPackage LLM prompt: focus keyword, meta description, SEO title, subheadings with keyword, transition words, passive voice reduction, sentence length, internal links, image alt text suggestions
- [ ] Update BlogToYoutube.tsx Video Package tab: show SEO fields panel (focus keyword, meta description, Yoast checklist items)
- [ ] Ensure WordPress publish includes Yoast meta fields (yoast_wpseo_focuskw, yoast_wpseo_metadesc, yoast_wpseo_title)

## YouTube OAuth (Push Blog URL to YouTube Description)
- [x] Add youtubeRefreshToken column to userCredentials schema + db:push
- [x] Create server/youtubeOAuth.ts helper (getYouTubeAuthUrl, exchangeYouTubeCode, isYouTubeAuthorized)
- [x] Add /api/youtube/auth-url and /api/youtube/callback Express routes to server/_core/index.ts
- [x] Add getYouTubeStatus and getYouTubeAuthUrl tRPC procedures to videoToBlogRouter
- [x] Update updateYouTubeDescription to use youtubeRefreshToken from userCredentials (not googleRefreshToken)
- [x] Add YouTube connect banner to VideoToBlog.tsx page (before Step 4)
- [x] Reuse GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET for YouTube OAuth (same Google Cloud project)

## Yoast SEO Fixes (VideoToBlog Pipeline)
- [x] Upload YouTube thumbnail as featured image with keyphrase alt text in publishToWordPress
- [x] Pass seoTitle (from meta extraction) to createWpPost separately from post title
- [x] Strengthen meta extraction prompt: SEO title MUST start with exact keyphrase, meta description MUST contain keyphrase
- [x] Strengthen blog generation prompt: at least one H2 MUST contain exact keyphrase, outbound links MUST be real Markdown links
- [x] Add fallback outbound links (PubMed/NIH) if resolveOutboundLinkPlaceholders returns no real links

## Scoreboard Image Generation Button
- [x] Add generateSocialImage tRPC procedure to scoreboard router (uses generateImage helper, stores imageUrl on contentItem)
- [x] Add "Image" button to Scoreboard table row (between Yoast and Share)
- [x] Image button shows spinner while generating, green tint when image exists, violet hover when not
- [x] After generation: auto-opens Share dialog with image pre-attached and preview shown
- [x] QuickShareDialog: accepts initialImageUrl prop, shows image preview with Remove option
- [x] QuickShareDialog: passes imageUrl to syndication.push mutation for Buffer
- [x] imageUrl returned from getPublishedPosts scoreboard query

## Facebook Group Buffer Fix

- [x] Diagnosed Facebook group "Urban Monks" not posting automatically — Meta removed the Facebook Groups API in April 2024; Buffer uses notification publishing for groups (mobile push notification, manual copy-paste required)
- [x] Updated getBufferProfiles in buffer.ts to fetch `type` field from Buffer GraphQL API and expose `channelType` + `isNotificationOnly` on BufferProfile
- [x] Added "notify" badge in BufferChannelSelector for channels where isNotificationOnly=true (Facebook groups)
- [x] Added warning banner in BufferChannelSelector explaining notification-only behavior when a Facebook group is selected

## Facebook Page-to-Group Share Reminder

- [ ] After a successful Buffer push to a Facebook Page channel, show a toast/dialog reminding the user to manually share the post to the Urban Monks Facebook group
- [ ] The reminder should include a direct link to the Facebook Page so the user can open it and tap Share → Share to Group in one click

## Webinar-to-Landing-Page Pipeline Fix

- [ ] Audit the webinar-to-landing-page pipeline to identify where webinar context (transcript, key points, CTA) is dropped
- [ ] Fix the pipeline so webinar intelligence flows end-to-end into the landing page builder
- [ ] Landing page builder must receive: webinar title, key takeaways, CTA, offer details, and speaker bio
- [ ] Generated landing page must be fully production-ready (headline, hero, benefits, social proof, CTA sections)
- [ ] Landing page must be deployable to ch.theurbanmonk.com subdomain

## Facebook Page-to-Group Share Reminder
- [x] Add showFbGroupReminder state and pushedToFbPage tracking in QuickShareDialog
- [x] After successful push to Facebook Page (non-group), show reminder dialog to share to Urban Monks group
- [x] Reminder dialog includes direct link to Facebook and step-by-step instructions

## Webinar-to-Landing-Page Pipeline Fix
- [x] crossModuleRouter.webinarToLandingPage now returns: personaName, intelligenceSummary, aiPrompt, ctaText, ctaUrl
- [x] LandingPageGenerator: auto-selects best persona from webinar personaName hint (falls back to Burnout Recovery Seeker)
- [x] LandingPageGenerator: URL params preserved until copy is generated (not cleared on prefill)
- [x] WebinarBuilder: single "Create Landing Page" button split into two: "Landing Page → Gamma" and "Landing Page → CH Page Builder"
- [x] LandingPageBuilder: handles from=webinar&id=X — fetches webinar feed, pre-fills form + AI prompt, opens AI panel automatically
- [x] LandingPageBuilder: shows "Pre-filled from Webinar: ..." badge in builder header
- [x] LandingPageBuilder: loading skeleton shown while webinar query is in-flight

## CH Pages Handoff Fix (from LandingPageGenerator)
- [x] Fix race condition: await handleSaveCopy() before navigate() in both CH Pages buttons in LandingPageGenerator
- [x] Fix template: webinar-origin pages use 'sales' template, not 'optin'
- [x] Fix bounce-to-list: createMutation/updateMutation onSuccess now stays in builder when cameFromLpGenerator is true
- [x] Fix webinar campaign public route: added 'webinar' to /:campaign(lo|gut|sleep|webinar)/:slug route in server/_core/index.ts

## Wistia Video Embed in CH Page Builder
- [ ] Add wistiaEmbedCode field to hostedLandingPages schema in drizzle/schema.ts
- [ ] Run pnpm db:push to migrate
- [ ] Add wistiaEmbedCode to pageContentSchema in hostedLandingPagesRouter.ts (create/update/list)
- [ ] Add Wistia embed textarea field in LandingPageBuilder.tsx (Hero Section, below videoEmbedCode)
- [ ] Render Wistia embed in renderLandingPageHtml for VSL and Sales templates
- [ ] Add Wistia embed preview in the builder preview iframe

## YouTube-to-Blog Yoast SEO Improvements
- [x] Auto-suggest focus keyword from video title when video is fetched (strips channel suffix, takes first 4 words)
- [x] Label focus keyword field as "required for Yoast SEO" with amber highlight when empty
- [x] Show warning toast if user clicks Generate without a focus keyword
- [x] Strengthen outbound links instruction in BLOG_CONTENT_RULES to MANDATORY HARD REQUIREMENT
- [x] Add Yoast SEO CHECK #4b to quality gate: verify at least 2 outbound link placeholders before outputting
- [x] Add post-generation outbound link audit: if no external links resolved, inject fallback PubMed citation before FAQ section

## Analytics Sync (Real Data Only)
- [ ] Build analyticsSync tRPC procedure: sync YouTube stats (views/likes/comments) for items with youtubeVideoId
- [ ] Build analyticsSync tRPC procedure: sync WordPress comment count for items with wpPostId
- [ ] Hide analytics display on Kanban cards that have neither wpPostId nor youtubeVideoId (no fake zeros)
- [ ] Add "Sync Analytics" button to Published column header in Kanban
- [ ] Show last-synced timestamp per card after sync
- [ ] Add analytics source badge (YouTube / WordPress) on synced cards

## Internal Link Optimizer (Auto-Inject on Publish)
- [x] Write server/internalLinkOptimizer.ts module: identifies keyword campaign, pillar post, and sibling cluster posts
- [x] Inject 2–3 contextual anchor-text links into new post HTML body (first occurrence of each focusKeyword phrase)
- [x] Update pillar page in WordPress: append new post to Related Reading section (creates section if not present)
- [x] Wire runInternalLinkOptimizer() into blog.publish procedure in routers.ts (Step 9b, fire-and-forget, non-blocking)
- [x] Add ctx destructuring to blog.publish mutation handler to expose ctx.user.id
- [x] TypeScript: 0 errors

## Content Scoreboard Auto-Fix Performance Fix
- [x] Fix bulkFixYoastIssues timeout error ("AI is not able to generate the fix") — root cause was sequential processing of 69 posts (207 WP API calls, 6+ min) exceeding gateway timeout
- [x] Rewrite to parallel batches of 5 posts — reduces total time from 6+ min to ~140s
- [x] Run content + Yoast WP updates in parallel per post (Promise.all)
- [x] Remove blocking getWpYoastScore re-fetch from the hot path (non-critical, was adding 4th API call per post)
- [x] All 429 tests pass after changes

## Keith SEO Recommendations (from call June 2, 2026)

- [x] Item 2: GSC auto-indexing — ping Google Search Console Indexing API on every WordPress publish
- [x] Item 3: Subcategory enforcement — assign correct WordPress subcategory during blog generation (campaign → WP category mapping) + backfilled 181 early posts
- [x] Item 1: Vertical chain linking — replaced cross-silo link optimizer with silo-contained vertical chain model using WP subcategory as silo boundary
- [ ] Item 4: YouTube Intelligence tool in Viral Studio — pull top 10 videos by topic, extract transcripts, synthesize into script framework
- [ ] Item 5: Human review gate — add pending_review status and review queue before publish
- [ ] Item 6: Article → YouTube embed automation — auto-embed matching YouTube video into blog post

## YouTube Intelligence — ViewStats-Level Upgrade (v20)

- [ ] Backend: youtube.analyzeChannel — fetch channel stats, top 10 videos with outlier scores, upload frequency, longs vs shorts
- [ ] Backend: youtube.searchChannels — find 10 similar/competitor channels by topic keyword
- [ ] Backend: youtube.getOutlierVideos — search topic, return 10 videos ranked by outlier score
- [ ] Backend: youtube.getTopicTrends — search topic, return 10 videos ranked by view velocity (views/day)
- [ ] Backend: youtube.getTitlePatterns — LLM analysis of 10 top video titles for winning patterns
- [ ] Frontend: Channel Analyzer tab — channel handle input, full stats + 10 top videos with outlier scores
- [ ] Frontend: Outlier Finder tab — topic search, 10 highest-outlier videos
- [ ] Frontend: Topic Trends tab — 10 videos ranked by view velocity
- [ ] Frontend: Title Pattern Analyzer — 10 title examples + LLM pattern extraction
- [ ] Frontend: Similar Channels panel — 10 competitor channels for a topic

## Keith Item 5 — Human Review Gate (v21)

- [ ] DB: Add `pending_review` to production_status enum in drizzle schema
- [ ] DB: Add `reviewNotes` text column to scripts table (reviewer feedback)
- [ ] DB: Run db:push
- [ ] Backend: blog.submitForReview mutation — move script to pending_review status
- [ ] Backend: blog.approveForPublish mutation — approve and trigger WP publish
- [ ] Backend: blog.rejectReview mutation — reject with notes, move back to drafting
- [ ] Backend: blog.listPendingReview query — list all scripts in pending_review
- [ ] Frontend: Add "Submit for Review" button on blog Kanban cards (replaces direct Publish)
- [ ] Frontend: New "Review Queue" page accessible from sidebar
- [ ] Frontend: Review Queue shows full article preview (title, meta, body, hero image)
- [ ] Frontend: Approve button → triggers WP publish + moves to Published
- [ ] Frontend: Reject button → opens notes dialog, moves back to Drafting with feedback
- [ ] Frontend: Badge count on sidebar nav item showing pending review count
- [ ] Blog generation flow: auto-submit to review instead of direct publish

## Keith Item 6 — Article → YouTube Embed Automation (v21)

- [ ] Backend: youtube.findMatchingVideo — search Pedram's channel for a video matching article topic
- [ ] Backend: blog.embedYouTubeVideo mutation — inject YouTube embed into WP post body
- [ ] Backend: Auto-trigger embed search on WP publish (after article is live)
- [ ] Frontend: Show "Embed YouTube Video" panel on Published blog cards
- [ ] Frontend: Display matched video title + thumbnail with Confirm/Skip buttons
- [ ] Frontend: Show embed status on published card (embedded / no match / skipped)

## Teleprompter Script Generator
- [ ] Backend: youtube.generateTeleprompterScript — takes outline + topic, returns full spoken script (no markdown)
- [ ] Frontend: "Generate Script" button after brief/outline is ready in Competitor Search tab
- [ ] Frontend: Teleprompter script modal with large readable text, one-click copy button
- [ ] Frontend: Script formatted for teleprompter — no markdown symbols, clean spoken sentences, natural paragraph breaks

## Platform Script Formats
- [ ] Backend: update generateTeleprompterScript to accept platform param (instagram | tiktok | youtube_short | youtube)
- [ ] Backend: platform-specific prompt rules — Instagram (60s, hook+value+CTA), TikTok (60-90s, trend hook, fast cuts), YouTube Short (≤60s, single insight), YouTube (5-15min, full structure)
- [ ] Frontend: platform selector UI in teleprompter section (4 buttons with icons)
- [ ] Frontend: duration selector only shown for YouTube long-form; auto-set for short platforms

## Keith Gap 2 — YouTube Embed Auto-Trigger in Blog Publish Flow
- [ ] Wire YouTube embed step into blog.publish procedure — after WordPress post is created, auto-search Pedram's channel for matching video and embed it
- [ ] Add embedYoutubeOnPublish flag to blog.publish input so it can be toggled on/off
- [ ] Show embed result in the publish success toast (embedded / no match found)
- [ ] Add "Auto-embed YouTube video" toggle to the blog publish button UI in CommandCenter

## Keith Gap 1 — Closed-Loop GSC Feedback Flywheel
- [ ] Backend: blog.getMovingPosts — query GSC for posts that moved in ranking in last 14 days, return top 10 movers with position delta
- [ ] Backend: blog.suggestFollowUp — for a given moving post, use LLM to suggest 3 follow-up article ideas that would strengthen the silo
- [ ] Frontend: Add "Content Flywheel" panel to SEO Dashboard showing top 10 ranking movers with position delta badges
- [ ] Frontend: Each mover card has "Suggest Follow-Up" button that triggers LLM and adds idea to Command Center queue
- [ ] Frontend: Show last-checked timestamp and a Refresh button to re-pull GSC data

## Full Content Pipeline — End-to-End Wiring

### Gap Analysis (June 2026)
# What exists:
# - YouTube Intelligence: trend search, competitor analysis, differentiation brief, teleprompter script (4 platforms)
# - Video Production Session: scripts (hook/body/cta), teleprompter export, recording upload, stitching
# - blogToYoutubeRouter.generateVideoPackage: YouTube title options, description, VA instructions (for blog→video flow)
# - videoToBlogRouter.generateYouTubeDescription: YouTube description (for video→blog flow)
# - videoToBlogRouter.generateBlogFromVideo: blog from video transcript
# What's MISSING from Video Production Session:
# - YouTube title options (3-5 SEO-optimized choices)
# - YouTube tags/keywords list (20-30 tags)
# - Social captions: Instagram, TikTok, LinkedIn, X — each platform-specific
# - Blog generation trigger from the session script
# - One unified "Publish Package" panel showing all outputs together

- [ ] Backend: videoSession.generateYouTubeMetadata — title options (5), description, tags (25), keywords from approved script + avatar intel
- [ ] Backend: videoSession.generateSocialCaptions — Instagram, TikTok, LinkedIn, X captions with hashtags from approved script
- [ ] Backend: videoSession.generateBlogFromScript — trigger blog post generation from session script, save to content_items
- [ ] Frontend: Add "Publish Package" tab to VideoProductionSession — appears when status = ready_to_record or done
- [ ] Frontend: YouTube Metadata panel — 5 title options (click to select), description (copy button), 25 tags (copy as comma list)
- [ ] Frontend: Social Captions panel — 4 platform tabs (Instagram/TikTok/LinkedIn/X), each with caption + hashtags + copy button
- [ ] Frontend: Blog Generation panel — "Generate Blog Post" button, shows status/link when done
- [ ] Frontend: All panels inject avatar intel and use approved script content
