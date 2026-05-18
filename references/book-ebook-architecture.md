# Book Snippets + E-Book Generator — Architecture Design

## Overview

Two deeply integrated features built on a shared **Book Library** foundation:

1. **Book Snippet Generator** — Upload PDFs → extract quote-worthy passages → generate branded social title cards
2. **E-Book Generator** — Learn Dr. Shojai's voice from uploaded books → generate full e-books from a topic → connect to CTAs, landing pages, webinars, and funnels

---

## Database Schema

### `uploaded_books` table
Stores the uploaded PDF books with extracted text and voice profile.

| Column | Type | Purpose |
|---|---|---|
| id | int PK | |
| userId | int FK | |
| title | varchar(255) | e.g. "The Urban Monk" |
| author | varchar(255) | default "Dr. Pedram Shojai" |
| s3Key | text | S3 key for the PDF file |
| s3Url | text | CDN URL for the PDF |
| extractedText | longtext | Full text extracted from PDF |
| voiceProfileJson | longtext | JSON: tone, vocabulary, sentence patterns, themes |
| pageCount | int | |
| wordCount | int | |
| status | enum: uploading/processing/ready/failed | |
| errorMessage | text | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### `book_snippets` table
Extracted quote-worthy passages with metadata.

| Column | Type | Purpose |
|---|---|---|
| id | int PK | |
| bookId | int FK → uploaded_books | |
| userId | int FK | |
| passageText | text | The raw quote/passage |
| pageNumber | int | Source page |
| chapter | varchar(255) | Source chapter |
| theme | varchar(128) | e.g. "energy", "mindfulness", "gut health" |
| platform | enum: instagram/linkedin/twitter/facebook | Best platform for this snippet |
| titleCardUrl | text | S3 URL of generated title card image |
| titleCardStatus | enum: pending/generating/ready/failed | |
| savedToKanban | boolean | Whether pushed to content_items |
| contentItemId | int FK → content_items | If saved to Kanban |
| createdAt | timestamp | |

### `ebooks` table
Generated e-books with full content and integration links.

| Column | Type | Purpose |
|---|---|---|
| id | int PK | |
| userId | int FK | |
| title | varchar(255) | |
| topic | text | User-entered topic/angle |
| targetPersona | text | Who this e-book is for |
| chapterCount | int | |
| wordCountTarget | int | default 5000 |
| status | enum: outline/drafting/complete/failed | |
| outlineJson | longtext | JSON array of chapters with titles + summaries |
| fullContent | longtext | Full markdown content of the e-book |
| pdfS3Key | text | S3 key for generated PDF |
| pdfS3Url | text | CDN URL for PDF download |
| ctaBlockId | int FK → cta_blocks | Primary CTA embedded in e-book |
| landingPageId | int FK → landing_pages | Landing page this e-book drives to |
| webinarSessionId | int FK → webinar_sessions | Webinar this e-book promotes |
| funnelStage | enum: awareness/consideration/conversion | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### `ebook_chapters` table
Individual chapters for incremental generation and editing.

| Column | Type | Purpose |
|---|---|---|
| id | int PK | |
| ebookId | int FK → ebooks | |
| chapterNumber | int | |
| title | varchar(255) | |
| summary | text | 2-3 sentence summary |
| content | longtext | Full chapter markdown |
| wordCount | int | |
| status | enum: pending/generating/complete/failed | |
| createdAt | timestamp | |

---

## Voice Profile System

When a book PDF is uploaded:
1. Extract full text using `pdf-parse` npm package (server-side)
2. Sample ~8,000 tokens from different sections (intro, middle, conclusion)
3. Send to LLM with a structured prompt to extract a **Voice Profile JSON**:
   - `tone`: ["direct", "spiritual", "scientific", "conversational"]
   - `sentenceStyle`: "short punchy sentences with occasional long philosophical ones"
   - `vocabulary`: ["qi", "prana", "mitochondria", "urban monk", "life force"] (top 50 distinctive words)
   - `themes`: ["energy", "mindfulness", "gut health", "sleep", "consciousness"]
   - `openingPatterns`: ["Let me tell you something...", "Here's the thing:"]
   - `closingPatterns`: ["This is the work.", "You know this already."]
   - `metaphorStyle`: "Eastern philosophy meets Western science"
   - `authorityMarkers`: ["As a doctor of Oriental medicine...", "In my clinic..."]
4. Store voice profile JSON in `uploaded_books.voiceProfileJson`
5. When multiple books are uploaded, **merge** voice profiles into a master profile

The master voice profile is injected into every e-book generation prompt.

---

## Book Snippet Pipeline

1. **Upload PDF** → extract text → store in `uploaded_books`
2. **Extract Snippets** → LLM analyzes full text, extracts 20-50 quote-worthy passages per book
   - Each passage: text, page estimate, theme, best platform
   - Stored in `book_snippets` table
3. **Generate Title Card** → for each snippet:
   - Use `generateImage` with a branded prompt: dark/earthy background, Dr. Shojai's name, quote text, Urban Monk logo area
   - Store image URL in `book_snippets.titleCardUrl`
4. **Social Export** → download title card, or push directly to Buffer/Kanban

---

## E-Book Generator Pipeline

1. **Topic Input** → user enters: topic, target persona, funnel stage, CTA/landing page/webinar links
2. **Outline Generation** → LLM generates chapter outline (8-12 chapters) using voice profile
3. **Chapter-by-Chapter Writing** → each chapter generated sequentially with voice profile injection
   - Each chapter: 400-600 words, Dr. Shojai's voice, embedded CTAs at natural break points
4. **CTA Integration** → at end of each chapter, insert relevant CTA block
   - Final chapter always drives to the linked landing page / webinar
5. **PDF Generation** → convert markdown to styled PDF using `manus-md-to-pdf` or a custom styled template
6. **Funnel Wiring** → store links to CTA block, landing page, webinar in `ebooks` table

---

## UI Structure

### `/book-library` — Book Library & Snippet Generator
- Upload zone (PDF drag-and-drop)
- Book list with status badges (processing/ready)
- Per-book: "Extract Snippets" button, snippet grid with title card previews
- Filter snippets by theme / platform
- Bulk actions: generate all title cards, push all to Kanban

### `/ebook-generator` — E-Book Generator
- New E-Book form: topic, persona, funnel stage, CTA/landing page/webinar selectors
- Outline editor: drag-to-reorder chapters, edit titles/summaries
- Chapter-by-chapter generation with progress
- Full preview in markdown viewer
- PDF export button
- Integration panel: shows linked CTA, landing page, webinar with edit links

---

## Integration Points (Existing Features)

| E-Book connects to | How |
|---|---|
| CTA Blocks | `ctaBlockId` FK; CTA text injected at chapter ends |
| Landing Pages | `landingPageId` FK; final chapter drives to LP |
| Webinar Sessions | `webinarSessionId` FK; e-book promotes the webinar |
| Content Kanban | Snippets can be pushed as `content_items` |
| Creation Studio | E-book topic can seed blog/LinkedIn/YouTube generation |
| Personas | `targetPersona` field; voice profile adapts to persona |

---

## Navigation

- Add **"Book Library"** to sidebar under a new **"Content Assets"** section
- Add **"E-Book Generator"** to sidebar under **"Content Assets"**
- Both pages accessible from Command Center via quick-access cards
