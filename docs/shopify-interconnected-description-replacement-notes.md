# Shopify Interconnected Product Description Replacement

## What the HTML is designed to improve

The current Shopify product page has a strong product image, clear $67 price, and visible cart controls, but its below-offer description begins as a small, undifferentiated list. Cold visitors must mentally assemble the value after they have already reached the purchase control. The supplied HTML makes the below-offer area behave as a calm conversion section: first explain the product in plain language, then establish the three core purchase assurances, then make the included resources scannable, and finally return the visitor to the existing **Add to Cart** control.

The Kajabi checkout is used only as a reference for hierarchy and reassurance: an explicit value stack, clear permanent-access language, and a simple purchase next step. The Shopify version is intentionally more restrained. It does not copy the Kajabi countdown, social-proof count, rating, dollar-value claims, guarantee language, or payment-security claims because those should appear only where they are independently confirmed for the Shopify purchase flow.

## How to paste it into Shopify

| Step | Action |
|---|---|
| 1 | Open **Shopify Admin → Products → Interconnected: The Complete Healing Protocol**. |
| 2 | In the **Description** editor, select the **Show HTML** button (`<>`). |
| 3 | Copy the entire contents of `shopify-interconnected-description-replacement.html`, including the outer `<div>` and excluding nothing. |
| 4 | Replace only the current plain product-description copy. Do **not** alter the product title, $67 price, inventory, buy buttons, product media, checkout, or any Shopify theme files. |
| 5 | Save, then inspect the product page in a private/incognito browser on desktop and phone. Confirm the native **Add to Cart** and accelerated checkout button still appear above the new section. |

## Deliberate boundaries

This is static, inline HTML for the product description only. It contains no Liquid, JavaScript, external image, countdown, review, rating, customer testimonial, or tracking element. Its one reference to **Add to Cart** points the visitor to Shopify’s existing native control rather than inserting a second, potentially conflicting checkout button.

The $67 price shown in the product header remains the sole live price reference. The HTML does not assert a discount, temporary promotion, money-back guarantee, number of customers, medical outcome, or unverified expert/bonus entitlement. Confirm those independently before adding them to the Shopify product page.

## Comparison rationale

| Current Shopify description | Kajabi reference pattern | HTML replacement approach |
|---|---|---|
| Begins as plain bullets below the cart controls. | Makes the value stack and purchase reassurance immediately legible. | Starts with a concise product promise, followed by a three-item assurance row. |
| Included items are present but visually compressed. | Uses clearly separated benefit/value units. | Gives each verified included asset its own readable, calm panel. |
| Lifetime access is stated only at the end. | Permanent access is prominent in the checkout CTA. | Elevates one-time purchase and permanent access early, then reinforces it near the purchase prompt. |
| No clear distinction between free viewing and the paid experience. | Frames a complete bundle around the payment decision. | Uses a “Why choose the complete protocol?” section that differentiates permanent access and companion resources without denigrating the free series. |

## Source pages reviewed

The live [Shopify product page](https://shop.theurbanmonk.com/products/interconnected-the-complete-healing-protocol) was reviewed for its current product title, $67 pricing, native purchase controls, and listed inclusions. The supplied [Kajabi checkout](https://theacademy.theurbanmonk.com/offers/57E3XFtT/checkout) was reviewed only as a visual and conversion-hierarchy reference. No Shopify or Kajabi change was made.
