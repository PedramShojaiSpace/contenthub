# Exact Shopify Steps: Make the $199 Member Offer Look Like One Sales Page

**Product:** Gut Permeability Test + Health Coach Call — $199 Member Offer  
**Purpose:** Keep the normal Shopify buy box at the top, place a compelling visual to its left, and put the full video-and-explanation section directly beneath it. This fixes the disconnected appearance without changing checkout, price, Zipify, or any live upsell rule.

> **The key idea:** Shopify will automatically place a product image on the left and the product title, price, and purchase buttons on the right. You do **not** need to build that side-by-side section yourself. We only need to give this product an image and a dedicated product template.

## Before You Start

Keep these two files open in separate tabs. Download the image to your computer first. You will paste the code only once.

- [Download the video thumbnail](/home/ubuntu/Downloads/urban-monk-199-ocus-video-thumbnail.jpg)
- [Open the Custom Liquid code](/home/ubuntu/lights-on-optin/docs/shopify-gut-permeability-199-custom-liquid-v2.html)

Do **not** upload the Wistia video itself as Shopify product media. Upload the thumbnail image only. The Custom Liquid section below contains the working Wistia video player.

## Part 1: Clean Up the Top of the Product Page

1. In Shopify Admin, go to **Products** and open **Gut Permeability Test + Health Coach Call — $199 Member Offer**. You are already on the correct product when you see SKU `FIT-22-OCUS-199` and price `$199.00`.
2. Change the product title to exactly:

   > **Gut Permeability Test + 1-Hour Health Coach Call**

   This keeps the product name to two useful lines at most. Shopify will still show the price, the $299 compare-at amount, and the purchase buttons separately.
3. Find the **Media** box. Click **Upload new**, select the downloaded thumbnail image, and wait until it appears as the first image.
4. In the **Description** box, remove the current long HTML content so the description field is empty. Do not worry: the same content is going back in a cleaner position through the dedicated template in Part 2.
5. Click **Save** at the top-right.

At this point, the standard Shopify layout will automatically show the video thumbnail on the left and the concise title, price, and Add to Cart button on the right.

## Part 2: Create a Dedicated Template for This One Product

This protects the rest of the store. The changes below apply only to the $199 member offer.

1. In Shopify Admin, go to **Online Store** → **Themes**.
2. On the **current live theme**, click **Customize**. Do not edit a different theme or a draft theme.
3. At the top center of the theme editor, click the page selector that usually says **Home page**.
4. Choose **Products** and then select **Create template**.
5. In the dialog:
   - **Name:** `ocus-199`
   - **Based on:** `Default product`
6. Click **Create template**.

You are now editing a separate product template named `product.ocus-199` (or similar). Other products remain unchanged.

## Part 3: Put the Video and Sales Content Directly Under the Buy Box

1. In the left sidebar, locate the existing **Product information** section. Leave it in place. It contains the title, price, quantity control, Add to Cart button, and Shop Pay button.
2. If **Product information** contains a visible **Description** block, remove that block or hide it using the eye icon. The description is now intentionally empty, but hiding the block also avoids unwanted space.
3. Scroll to the bottom of the sidebar and click **Add section**.
4. Search for and choose **Custom liquid**.
5. Open the [Custom Liquid code](/home/ubuntu/lights-on-optin/docs/shopify-gut-permeability-199-custom-liquid-v2.html), copy **everything** in the file, and paste it into the Custom Liquid field.
6. Drag the new **Custom liquid** section so it sits **immediately below Product information**.
7. Click **Save**.

The finished order should be:

1. Product thumbnail on the left; concise title, price, and purchase controls on the right.
2. The Wistia video immediately below.
3. The three value cards, inclusions, steps, and disclosure copy below the video.

## Part 4: Assign the New Template Only to This Product

1. Return to **Products** and reopen **Gut Permeability Test + Health Coach Call — $199 Member Offer**.
2. Scroll down the right side until you see **Theme template**.
3. Open the drop-down, select **ocus-199**, and click **Save**.
4. Click **View** or open the public product URL in a new browser tab.

## Final Five-Minute Check

Check the public page on a computer and on your phone. Confirm that the thumbnail appears on the left of the purchase panel on desktop, that the title no longer includes “$199 Member Offer,” that the video plays below the buy buttons, and that the Add to Cart button still works. Do not place a paid order for this check.

If the theme editor does not offer **Create template** or **Custom liquid**, stop there and send a screenshot. That means the current theme does not expose the necessary no-code building blocks, and I will give you the correct alternative rather than having you modify code.

## What Not to Touch

Do not change the $199 price, $299 compare-at price, SKU, product handle, checkout settings, Zipify app, or any ad destination while making this visual correction. The requested work is limited to the product title, one product image, the product description field, and a dedicated product template.

## References

[1]: https://help.shopify.com/en/manual/online-store/themes/theme-structure/templates "Shopify Help Center: Templates"
