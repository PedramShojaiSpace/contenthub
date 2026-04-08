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
- [x] Calendar view placeholder
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
- [x] "Generate Image" button
- [x] Image preview and URL copy
- [x] Syndication placeholder with "coming soon" badge

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
- [x] generateImage for visual asset creation (dark, moody, cinematic style)
- [x] Platform-specific prompt templates embedded in backend
- [x] Image prompt auto-generation from content

## Testing
- [x] Vitest tests for auth.logout
- [x] Vitest tests for content, strategy, ai, and assets router structure

## Syndication (Placeholder)
- [ ] Buffer API integration UI (placeholder with "coming soon" toast)
- [ ] Duvo API integration UI (placeholder with "coming soon" toast)

## Calendar View (v2)
- [ ] Real monthly calendar grid with day cells
- [ ] Approved/Scheduled content items displayed on their scheduled date
- [ ] Click-to-schedule: click a day to assign a content item to that date
- [ ] Drag-to-reschedule: drag cards between days
- [ ] Month navigation (prev/next)
- [ ] Platform color-coded badges on calendar cards
- [ ] Unscheduled content sidebar panel

## Nano Banana Image Generation (v2)
- [ ] Platform-specific brand style prompts (LinkedIn, Meta, X, YouTube)
- [ ] LinkedIn: clean, professional, corporate wellness aesthetic
- [ ] Meta/Instagram: warm, lifestyle, aspirational, nature + human connection
- [ ] X/Twitter: bold, high-contrast, typographic, minimal
- [ ] YouTube: cinematic thumbnail style, dramatic lighting, bold composition
- [ ] Style selector UI in Creation Studio image panel
- [ ] Preview style descriptions before generating
- [ ] Auto-select platform style based on active platform tab

## App Rename (v2)
- [x] Rename app title to "Urban Monk Productions Content Hub" in index.html
- [x] Rename sidebar header from "Content Engine" to "UMP Content Hub"
- [x] Update VITE_APP_TITLE to match
- [x] Update all page titles and meta tags
