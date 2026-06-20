# Meta Ads Push Skill — Content Hub Integration

> **Purpose:** Push ad creatives directly from the Urban Monk Content Hub to Meta Ads Manager as PAUSED draft campaigns. No budget is set on push — all campaigns require manual review and activation in Meta Ads Manager before spending begins.

---

## How It Works

The workflow is built into the **Ads Manager → Push to Meta** tab in the Content Hub. It handles the complete Meta API flow:

1. **Image upload** — Ad images are uploaded once to Meta's ad image library (stored as hashes). This is a one-time operation; hashes are reused on every subsequent push.
2. **Campaign creation** — One campaign per ad, using `OUTCOME_TRAFFIC` objective, status `PAUSED`.
3. **Ad Set creation** — One ad set per campaign, with a $5/day placeholder budget (must be set manually before activating), targeting US/CA/GB/AU/NZ, ages 35–65, Facebook Feed + Instagram Stream.
4. **Creative creation** — Uses `asset_feed_spec` format (matches the existing account's creative format). Binds image hash + headline + body copy + description + CTA + landing URL.
5. **Ad creation** — One ad per creative, status `PAUSED`.
6. **Push history** — Every push attempt is logged in the `meta_ad_pushes` database table with status (`pending` → `pushed` / `failed`), Meta IDs, and timestamps.

---

## Current Ad Catalog: KBMO Gut Health Test + Consultation

**15 ads across 5 audience variants — all pointing to:**
`https://theacademy.theurbanmonk.com/a/2148285846/PpCdamnj`

| Variant | Slug | Avatar | Ads |
|---------|------|--------|-----|
| 1 | `/precision` | Chronically fatigued, dismissed by conventional medicine | 3 |
| 2 | `/optimizer` | Biohacker hitting an optimization ceiling | 3 |
| 3 | `/gutbrain` | Anxiety/brain fog, gut-brain axis | 3 |
| 4 | `/autoimmune` | Autoimmune flares, elimination diet failures | 3 |
| 5 | `/weight` | Weight loss resistance, metabolic inflammation | 3 |

All 15 images are already uploaded to Meta's ad image library. Their hashes are hardcoded in `server/metaAdPushRouter.ts` under `AD_CATALOG`.

---

## One-Time Setup: Switch Meta App to Live Mode

The Meta app **"Urban Monk Ads Manager"** (App ID: `2150724875769823`) must be in **Live mode** for ad creative creation to work via API. Development mode blocks creative creation with error code `1885183`.

**Steps:**
1. Go to [developers.facebook.com → App Settings → Basic](https://developers.facebook.com/apps/2150724875769823/settings/basic/)
2. Add a Privacy Policy URL: `https://theurbanmonk.com/privacy`
3. Toggle **App Mode** from Development → Live
4. Confirm — no App Review required for ad management apps

Once Live, all 15 ads can be pushed in a single click from the Content Hub.

---

## Adding New Ad Campaigns (Future Batches)

To add a new batch of ads to the Content Hub push workflow:

### Step 1: Upload Images to Meta

```bash
# Upload images to Meta's ad image library
ACCESS_TOKEN="your_token"
AD_ACCOUNT_ID="your_account_id"

for img in ad-newcampaign-1.webp ad-newcampaign-2.webp ad-newcampaign-3.webp; do
  curl -X POST \
    "https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/adimages" \
    -F "access_token=${ACCESS_TOKEN}" \
    -F "filename=@${img}" \
    | python3 -m json.tool
done
```

Save the `hash` values from each response.

### Step 2: Add to AD_CATALOG

Edit `server/metaAdPushRouter.ts` and add a new variant object to the `AD_CATALOG` array:

```typescript
{
  variantNum: 6,                    // next number in sequence
  variantSlug: "newcampaign",       // URL-safe slug
  variantName: "New Campaign Name", // human-readable name
  ads: [
    {
      adId: "newcampaign-a",
      adName: 'Ad 6-A — "Your Hook Here"',
      imageFile: "ad-newcampaign-1.webp",
      imageHash: "HASH_FROM_STEP_1",
      headline: "Your Headline Here",
      primaryText: `Your full ad copy here...`,
      description: "Short description — $Price",
      cta: "LEARN_MORE",  // or WATCH_MORE, SHOP_NOW, SIGN_UP, GET_OFFER
      landingUrl: "https://your-landing-page.com",
    },
    // ... add 2 more ads
  ],
},
```

### Step 3: Update Tests

Add the new variant to `server/metaAdPush.test.ts`:
- Update the "5 variants" test to the new count
- Add the new slug to the "required variant slugs" test

### Step 4: Push from Content Hub

Navigate to **Ads Manager → Push to Meta** tab and use the new variant's "Push All 3" button.

---

## Adding a Landing Page URL (Future Workflow)

When a new landing page is created in the Landing Page Generator, the URL can be passed directly to the push workflow:

1. In the Landing Page Generator, copy the published URL
2. In the Push to Meta tab, the `landingUrl` field on each ad card can be overridden before pushing
3. For bulk updates, edit `AD_CATALOG` in `metaAdPushRouter.ts` and update the `landingUrl` field

**Planned enhancement:** Add a landing page URL override field to the Push to Meta tab UI so URLs can be changed without editing server code.

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `META_AD_ACCESS_TOKEN` | Long-lived user access token with `ads_management` permission |
| `META_AD_ACCOUNT_ID` | Ad account ID (without `act_` prefix) |
| `META_APP_ID` | Meta app ID (`2150724875769823`) |
| `META_APP_SECRET` | Meta app secret |
| `META_PAGE_ID` | Facebook Page ID for ad creative attribution |

All are set in the Content Hub project secrets.

---

## Meta API Endpoints Used

| Step | Endpoint | Method |
|------|----------|--------|
| Upload image | `act_{id}/adimages` | POST (multipart) |
| Create campaign | `act_{id}/campaigns` | POST |
| Create ad set | `act_{id}/adsets` | POST |
| Create creative | `act_{id}/adcreatives` | POST |
| Create ad | `act_{id}/ads` | POST |

API version: `v19.0`

---

## Push History Database Table

All pushes are tracked in `meta_ad_pushes`:

```sql
SELECT map_ad_name, map_variant_slug, map_status, map_campaign_id, map_pushed_at
FROM meta_ad_pushes
ORDER BY map_created_at DESC
LIMIT 20;
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `error_subcode: 1885183` | App in Development mode | Switch app to Live mode (see Setup above) |
| `Invalid image hash` | Image not uploaded to this ad account | Re-upload images using the script in Step 1 |
| `Invalid page_id` | `META_PAGE_ID` env var not set or wrong | Check project secrets |
| `Token expired` | Access token is expired | Generate a new long-lived token in Meta Business Suite |
| `Insufficient permissions` | Token missing `ads_management` scope | Re-authorize the app with correct permissions |

---

*Last updated: June 2026 — Urban Monk Content Hub v1.0*
