# Kajabi Setup Guide — Interconnected Wide Native Canvas

## Objective

Create one reusable Kajabi Visual Editor template that uses the platform’s native email width once—rather than placing a second full email document inside it. The result is a cleaner, wider body area and one consistent Interconnected presentation.

## Recommended template name

**Interconnected — Wide Native Canvas**

**Suggested template description:**

> One native Text canvas for Interconnected source fragments. Uses a single full-width navy header, 18px body copy, blue CTAs, and the standard Kajabi footer. Do not paste a complete HTML email document into this template.

## Design settings

| Item | Setting |
| --- | --- |
| Outer email canvas | Kajabi default (native responsive email width) |
| Content sections | One **Text** section plus the default Kajabi **Footer** |
| Unneeded sections | Remove extra Image/Logo/header sections so nothing precedes the content fragment |
| Text-section background | `#FFFFFF` |
| Desktop left/right padding | `0` (the fragment supplies its own 28px padding) |
| Mobile left/right padding | `0` (the fragment supplies its own 28px padding) |
| Header | Comes from the fragment: `#071D2D` navy with `#287FBB` blue rule |
| Body type | 18px Arial/Helvetica, 1.6 line-height |
| CTA button | Blue `#287FBB`, white type, 18px bold |
| Footer | Keep Kajabi’s native footer/unsubscribe/address section enabled |

## Build the reusable template

1. Go to **Marketing → Email Campaigns** and open a draft email in the **Email Visual Editor**.
2. In **Sections**, retain one **Text** section and the **Footer** section.
3. Remove extra Image, Logo, and decorative header sections. The fragment already includes the Interconnected header.
4. Open the Text section. In **Desktop Layout**, set the left and right padding to `0`. Repeat in **Mobile Layout**.
5. In the Text section, click **Source Code** (`<>`) and paste any one file from `text-source-fragments/` as a visual sample. Save the Text section.
6. Click **Save as template**. Use the name and description above.
7. When building each sequence email, apply this template and then replace only the Text-section source with the matching numbered fragment.

## Pasting one fragment

> The `text-source-fragments/` files are intentionally the easiest files for a VA to open and copy. Every `.txt` file byte-matches its corresponding `.html` file.

1. Match the email number and timing in `sequence-manifest.json`.
2. Open the Text section → **Source Code** (`<>`).
3. Select everything in that source field. Paste the matching `.txt` fragment.
4. Save the section and email.
5. Verify the visual editor preview: no extra 640px inset card, a full native-width navy header, normal 18px paragraphs, and centered blue buttons.

## Critical routing confirmation

The Day 0 primary and Day 0 follow-up $99 buttons intentionally route to:

`https://content.theurbanmonk.com/interconnected/thank-you-klaviyo`

They do **not** route directly to checkout. The explanatory page shows the approved video and then passes interested visitors to the $99 Kajabi checkout/native OCU path.

## Final QA before any activation

1. Preview on desktop and mobile. The copy should use the native canvas rather than a nested narrow card.
2. Send an internal test only for Day 0 primary and an episode email.
3. Click all CTAs without ordering. Confirm destinations and that Day 0 visits the video-led information page first.
4. Confirm the standard Kajabi footer, unsubscribe link, and sender/address details display normally.
5. Keep the sequence draft-only, with no subscribers or triggers, until the owner approves activation.
