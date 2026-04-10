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

## v24 Features — X Two-Pass Condenser (April 10, 2026)

- [x] Replace validateXLength (no-op warning) with condenseXPost() — a second LLM pass that rewrites over-limit X posts into a complete, coherent tweet under 240 chars
- [x] Condenser prompt explicitly forbids ellipses, requires complete thought, targets 240 chars (60-char buffer below X's 280 limit)
- [x] Condenser preserves Pedram's voice and core insight — never just truncates
- [x] Fallback: if condense pass fails, returns original text so user can edit manually
- [x] 87/87 tests pass
