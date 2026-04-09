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
