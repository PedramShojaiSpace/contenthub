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
- [ ] Save checkpoint
