# Make the $199 Offer Page Look Like One Sales Page

**This guide is deliberately written for someone who does not work in Shopify.** You are not changing checkout, prices, Zipify, ads, or anything complicated. You will only make the top of this one product page look clean and then put the video and sales copy neatly underneath it.

> **What the finished page will look like:** a video image on the **left**, the short product title and orange **Add to Cart** button on the **right**, then the actual video and sales explanation immediately **under** that top section.

This affects only this product:

> **Gut Permeability Test + Health Coach Call — $199 Member Offer**

If any screen looks substantially different from the instructions, **stop and send a screenshot before clicking Save**. That is better than guessing.

## Before Starting

Open these three things in separate browser tabs. Keep this instruction page open so you can return to it.

1. [Download the recommended product-hero image to your computer first](/home/ubuntu/Downloads/urban-monk-199-hero-precision-wellness.jpg). It is the premium green test-kit image that will sit on the left of the purchase panel.
2. [Open the ready-made sales section](/home/ubuntu/lights-on-optin/docs/shopify-gut-permeability-199-custom-liquid-v2.html). You will copy everything in that file later.
3. Open your Shopify Admin in another tab.

**Important:** Do not upload the video file. Upload only the downloaded product-hero image in Step 4 below. The actual Wistia video is already included in the copy-ready sales section.

---

## Part 1 — Fix the Ugly Top Section

### Step 1: Open the correct product

1. In the left-hand black Shopify menu, click **Products**.
2. Click the search box near the top of the page.
3. Type: `Gut Permeability Test + Health Coach Call`
4. Click the product that says **Gut Permeability Test + Health Coach Call — $199 Member Offer**.

You are in the right place if you see **$199.00** and SKU **FIT-22-OCUS-199**.

### Step 2: Shorten the giant headline

1. At the top of the product page, click in the **Title** box.
2. Delete what is there.
3. Paste this exact title:

> **Gut Permeability Test + 1-Hour Health Coach Call**

Do **not** add “$199 Member Offer” to the title. Shopify already shows the price below the title, so repeating it is what made the headline look huge and awkward.

### Step 3: Add the picture on the left

1. Scroll down until you see the section called **Media**.
2. Click **Add** or **Upload new**.
3. Choose the image you downloaded before you started: `urban-monk-199-hero-precision-wellness.jpg`.
4. Wait for the image to finish uploading. You should see it appear in the Media area.
5. Make sure that it is the **first image**. If more than one image appears, drag the new image to the first position.
6. Click the black **Save** button in the upper-right corner.

At this point, do not worry if the full page still looks a little disjointed. The next part puts the video and sales copy in the right place.

---

## Part 2 — Create a Special Layout for This One Product

This sounds technical, but it is simply making a one-product version of the normal product page. It will not change any other product in the store.

### Step 4: Enter the theme editor

1. In the left Shopify menu, look for **Sales channels**.
2. Click **Online Store**. If you already see **Themes**, click **Themes**.
3. Find the area that says **Current theme**. Do **not** choose a draft theme.
4. Click **Customize** on the current theme.

### Step 5: Make the special one-product layout

1. At the top center of the screen, click the drop-down that probably says **Home page**.
2. Choose **Products**.
3. Choose **Default product** if Shopify asks which product page to open.
4. In that same top drop-down area, choose **Create template**.
5. A small box will appear. Fill it in exactly like this:

| Box in Shopify | Type this |
|---|---|
| **Name** | `ocus-199` |
| **Based on** | `Default product` |

6. Click **Create template**.

You are now editing a private layout for this one product. Leave the normal **Product information** section where it is. That section contains the title, price, quantity box, orange Add to Cart button, and Shop Pay button.

### Step 6: Hide the duplicate description area

1. In the left-hand list inside the theme editor, click **Product information**.
2. Look for a block named **Description**.
3. Click the eye icon beside it to hide it. If there is a trash-can icon instead, click that to remove the block **from this special template only**.

Do not remove **Title**, **Price**, **Quantity selector**, **Buy buttons**, or any payment button.

### Step 7: Put the video and sales section below the purchase buttons

1. Still in the left-hand list, scroll all the way down.
2. Click **Add section**.
3. In the search box, type: `Custom liquid`
4. Click **Custom liquid**.
5. Return to the [ready-made sales section](/home/ubuntu/lights-on-optin/docs/shopify-gut-permeability-199-custom-liquid-v2.html).
6. Click inside the code. Press **Control + A** on Windows or **Command + A** on Mac. Then press **Control + C** or **Command + C** to copy everything.
7. Return to Shopify. Click inside the large **Custom liquid** box and press **Control + V** or **Command + V**.
8. In the left-hand list, drag the new **Custom liquid** section until it is directly **below Product information**.
9. Click **Save** in the upper-right corner.

The left-side list should now look roughly like this:

1. **Product information** — title, price, Add to Cart button.
2. **Custom liquid** — video and sales explanation.

---

## Part 3 — Tell Shopify to Use This Layout for Only the $199 Product

### Step 8: Assign the new layout

1. Leave the theme editor by clicking the back arrow in the top-left corner.
2. Go back to **Products**.
3. Open **Gut Permeability Test + Health Coach Call — $199 Member Offer** again.
4. On the right side of the product page, scroll down until you see **Theme template**.
5. Open that drop-down.
6. Select **ocus-199**.
7. Click **Save** in the upper-right corner.

---

## Final Check — Do Not Buy Anything

1. On the product page, click **View** to open the public page in a new tab.
2. On a computer, make sure you see:
   - the thumbnail image on the left;
   - the short product title and purchase buttons on the right;
   - the Wistia video immediately below;
   - the rest of the sales explanation below the video.
3. Open the same product link on your phone. Make sure the picture, title, Add to Cart button, and video stack in a sensible order.
4. Do **not** place an order. You only need to make sure the page looks correct.

## Things You Should Not Touch

Leave all of these alone:

- the $199 price;
- the crossed-out $299 price;
- the product SKU;
- the product URL / handle;
- checkout settings;
- the Zipify app;
- ads and ad links;
- the Wistia video link.

If Shopify does not show **Create template** or **Custom liquid**, stop there and send me a screenshot of that screen. I will give you a different, equally safe path.

## References

[1]: https://help.shopify.com/en/manual/online-store/themes/theme-structure/templates "Shopify Help Center: Templates"
